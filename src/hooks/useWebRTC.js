import { useEffect, useRef, useState } from "react";

const DEFAULT_SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL ?? "wss://realtimerivals-backend.onrender.com/ws";

// Identifies this tab to the server across refreshes and reconnects, so a
// returning player takes their own seat back instead of finding the room full.
const PLAYER_ID_STORAGE_KEY = "rtr.playerId";

const getPlayerId = () => {
  try {
    let id = window.sessionStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem(PLAYER_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
};

const getSignalingUrl = (roomCode, roomAction, playerId) => {
  const rawUrl = DEFAULT_SIGNALING_URL;

  try {
    const parsedUrl = new URL(rawUrl);

    if (parsedUrl.protocol === "http:") {
      parsedUrl.protocol = "ws:";
    }

    if (parsedUrl.protocol === "https:") {
      parsedUrl.protocol = "wss:";
    }

    if (!parsedUrl.pathname || parsedUrl.pathname === "/") {
      parsedUrl.pathname = "/ws";
    }

    parsedUrl.searchParams.set("room", roomCode);
    parsedUrl.searchParams.set("action", roomAction);
    parsedUrl.searchParams.set("player", playerId);

    return parsedUrl.toString();
  } catch (error) {
    console.error("Invalid signaling URL:", rawUrl, error);
    return `${DEFAULT_SIGNALING_URL}?room=${encodeURIComponent(roomCode)}&action=${encodeURIComponent(roomAction)}&player=${encodeURIComponent(playerId)}`;
  }
};

const list = (value) =>
  (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

// STUN finds a direct path when both networks allow one. When they do not
// (mobile data, strict NATs, Brave hiding local addresses, two players behind
// the same router) the match only connects through a TURN relay, which needs
// credentials from a TURN provider. The old shared openrelay.metered.ca login
// no longer exists, so the relay now comes from the environment.
const turnUrls = list(import.meta.env.VITE_TURN_URLS);

const iceServers = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ...(turnUrls.length
    ? [
        {
          urls: turnUrls,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL,
        },
      ]
    : []),
];

if (!turnUrls.length) {
  console.warn(
    "No TURN server configured (VITE_TURN_URLS). Players on different networks may fail to connect."
  );
}

// How long an offer or answer waits for the microphone prompt. Past this the
// match connects without voice, and the track is added when it arrives.
const MIC_WAIT_MS = 4000;

// Reconnect backoff: 1s, 2s, 4s, 8s, then every 10s for as long as the game
// screen is open.
const reconnectDelay = (attempt) => Math.min(1000 * 2 ** attempt, 10000);

// A "disconnected" peer often recovers on its own; give it this long first.
const DISCONNECT_GRACE_MS = 5000;

export const useWebRTC = (roomCode, roomAction, onData, options = {}) => {
  const { enabled = true } = options;
  const channelRef = useRef(null);
  const onDataRef = useRef(onData);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioSupported, setAudioSupported] = useState(enabled);
  const [audioStatus, setAudioStatus] = useState(
    enabled ? "Requesting microphone access..." : "Voice chat unavailable in computer matches"
  );
  const [connectionStatus, setConnectionStatus] = useState(
    enabled ? "Connecting to room..." : "Computer opponent ready"
  );
  const [isHost, setIsHost] = useState(!enabled);
  const [playerNumber, setPlayerNumber] = useState(null);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    if (!enabled) {
      setAudioEnabled(false);
      setAudioSupported(false);
      setAudioStatus("Voice chat unavailable in computer matches");
      setConnectionStatus("Computer opponent ready");
      setIsHost(true);
      setPlayerNumber(1);
      return undefined;
    }

    let isMounted = true;
    let socket = null;
    // A peer connection that has failed or been closed cannot be reused, so
    // every opponent (including the same one rejoining) gets a fresh one.
    let pc = null;
    let initiator = false;
    let started = false;
    let negotiated = false;
    let restartedIce = false;
    let pendingCandidates = [];
    let audioReady = Promise.resolve();
    let messageQueue = Promise.resolve();
    const playerId = getPlayerId();
    // After the first successful join every reconnect is a "rejoin": the
    // room may have emptied, or still hold this player's old socket.
    let currentAction = roomAction;
    let joinedOnce = false;
    let fatalError = false;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let disconnectTimer = null;
    let signalingLost = false;

    const sendSignal = (message) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    const waitForMicrophone = () =>
      Promise.race([audioReady, new Promise((resolve) => setTimeout(resolve, MIC_WAIT_MS))]);

    const attachChannel = (channel) => {
      channelRef.current = channel;

      channel.onopen = () => {
        console.log("Data channel open");
        if (isMounted) {
          setConnectionStatus(`Connected in room ${roomCode}`);
        }
      };

      channel.onmessage = (event) => {
        const parsedData = JSON.parse(event.data);
        console.log("Received peer data:", parsedData);
        onDataRef.current(parsedData);
      };

      // The match ran on this channel alone while the server link was down;
      // now that it has gone too, go back through the server to find the
      // opponent again.
      channel.onclose = () => {
        if (isMounted && channelRef.current === channel && signalingLost) {
          reconnect("Lost the opponent. Reconnecting...");
        }
      };
    };

    // Drop the current server socket and connect again. The server sees the
    // same player id, replaces the old seat, and both players get a fresh
    // "ready" to rebuild the peer connection from scratch.
    const reconnect = (status) => {
      if (!isMounted || fatalError || reconnectTimer) return;

      const previous = socket;
      socket = null;
      if (previous) {
        previous.onclose = null;
        previous.close();
      }

      const delay = reconnectDelay(reconnectAttempts);
      reconnectAttempts += 1;
      setConnectionStatus(`${status} (attempt ${reconnectAttempts})`);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectSignaling();
      }, delay);
    };

    const handlePeerFailure = () => {
      // First, one ICE restart from the host: cheap, and keeps the match.
      if (initiator && !restartedIce && pc?.signalingState === "stable") {
        restartedIce = true;
        pc.restartIce();
        setConnectionStatus("Connection dropped. Retrying...");
        return;
      }

      setAudioStatus("Reconnecting to your opponent...");
      reconnect("Connection to opponent failed. Reconnecting...");
    };

    const addLocalTracks = (connection) => {
      const stream = localStreamRef.current;
      if (!stream || !connection || connection.signalingState === "closed") return;

      const sending = connection.getSenders().map((sender) => sender.track);
      stream.getTracks().forEach((track) => {
        if (!sending.includes(track)) connection.addTrack(track, stream);
      });
    };

    const flushPendingIceCandidates = async () => {
      while (pendingCandidates.length > 0) {
        const candidate = pendingCandidates.shift();
        try {
          await pc.addIceCandidate(candidate);
        } catch (error) {
          console.error("ICE error:", error);
        }
      }
    };

    const resetPeer = () => {
      channelRef.current?.close();
      channelRef.current = null;
      pc?.close();

      started = false;
      negotiated = false;
      restartedIce = false;
      pendingCandidates = [];

      const connection = new RTCPeerConnection({ iceServers });
      pc = connection;
      addLocalTracks(connection);

      connection.onicecandidate = (event) => {
        if (event.candidate) sendSignal({ type: "ice", candidate: event.candidate });
      };

      // Only fires for changes after the first offer/answer: the microphone
      // arriving late, or an ICE restart.
      connection.onnegotiationneeded = async () => {
        if (connection !== pc || !negotiated || connection.signalingState !== "stable") return;
        try {
          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          sendSignal({ type: "offer", offer });
        } catch (error) {
          console.error("Renegotiation error:", error);
        }
      };

      connection.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", connection.iceConnectionState);

        if (connection !== pc || !isMounted) return;

        if (
          connection.iceConnectionState === "connected" ||
          connection.iceConnectionState === "completed"
        ) {
          setAudioStatus((currentStatus) =>
            currentStatus === "Microphone connected" ? "Peer connected" : currentStatus
          );
        }

        if (connection.iceConnectionState === "failed") {
          setAudioStatus("Peer connection failed. TURN relay may be unavailable.");
          setConnectionStatus("Peer connection failed");
        }
      };

      connection.onconnectionstatechange = () => {
        console.log("Peer connection state:", connection.connectionState);

        if (connection !== pc || !isMounted) return;

        clearTimeout(disconnectTimer);
        disconnectTimer = null;

        if (connection.connectionState === "connected") {
          reconnectAttempts = 0;
        }

        if (connection.connectionState === "failed") {
          handlePeerFailure();
        }

        if (connection.connectionState === "disconnected") {
          setAudioStatus("Peer disconnected");
          setConnectionStatus("Opponent connection unstable...");
          disconnectTimer = setTimeout(() => {
            disconnectTimer = null;
            if (connection === pc && connection.connectionState !== "connected") {
              handlePeerFailure();
            }
          }, DISCONNECT_GRACE_MS);
        }
      };

      connection.ondatachannel = (event) => {
        attachChannel(event.channel);
      };

      connection.ontrack = (event) => {
        const [remoteStream] = event.streams;

        if (!remoteStream || !remoteAudioRef.current) return;

        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current
          .play()
          .then(() => {
            if (isMounted) {
              setAudioStatus("Voice chat connected");
            }
          })
          .catch((error) => {
            console.error("Remote audio playback error:", error);

            if (isMounted) {
              setAudioStatus("Remote audio blocked. Click the page and try again.");
            }
          });
      };
    };

    const startOffer = async () => {
      if (started) return;
      started = true;

      // Put the microphone in the first offer when it is ready in time, so
      // voice does not depend on renegotiating later.
      await waitForMicrophone();
      if (!isMounted) return;

      addLocalTracks(pc);
      attachChannel(pc.createDataChannel("game"));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({ type: "offer", offer });
    };

    const handleOffer = async (offer) => {
      if (!pc) resetPeer();

      // Both sides offering at once: the host keeps its own offer, the guest
      // rolls back and answers.
      if (pc.signalingState !== "stable") {
        if (initiator) return;
        await pc.setLocalDescription({ type: "rollback" });
      }

      const firstOffer = !negotiated;
      started = true;

      await pc.setRemoteDescription(offer);
      await flushPendingIceCandidates();

      if (firstOffer) {
        await waitForMicrophone();
        if (!isMounted) return;
        addLocalTracks(pc);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal({ type: "answer", answer });
      negotiated = true;
    };

    const handleAnswer = async (answer) => {
      if (pc?.signalingState !== "have-local-offer") return;

      await pc.setRemoteDescription(answer);
      await flushPendingIceCandidates();
      negotiated = true;
    };

    const handleMessage = async (message) => {
      if (!isMounted) return;

      if (message.type === "joined") {
        joinedOnce = true;
        currentAction = "rejoin";
        signalingLost = false;
        setPlayerNumber(message.playerNumber);
        setConnectionStatus(`Joined room ${message.room}. Waiting for opp...`);
      }

      if (message.type === "ready") {
        // A new opponent, or the same one back after a refresh: start clean.
        initiator = message.initiator;
        resetPeer();
        setIsHost(message.initiator);
        setConnectionStatus(
          message.initiator
            ? `Room ${message.room} ready. You are Host.`
            : `Room ${message.room} ready. You joined as Player 2.`
        );

        if (message.initiator) {
          await startOffer();
        }
      }

      if (message.type === "offer") {
        await handleOffer(message.offer);
      }

      if (message.type === "answer") {
        await handleAnswer(message.answer);
      }

      if (message.type === "ice") {
        if (pc?.remoteDescription) {
          try {
            await pc.addIceCandidate(message.candidate);
          } catch (error) {
            console.error("ICE error:", error);
          }
        } else {
          pendingCandidates.push(message.candidate);
        }
      }

      if (message.type === "peer_left") {
        resetPeer();
        setAudioStatus("Peer disconnected");
        setConnectionStatus(`Room ${roomCode} is waiting for another player...`);
        console.log("Peer disconnected");
      }

      if (message.type === "error") {
        console.error(message.message);
        // A wrong or taken room code will not fix itself (fatalError, set in
        // onmessage); a full room may be this player's old seat not yet
        // cleared, so that one is retried.
        setConnectionStatus(message.message);
      }
    };

    const setupAudio = async () => {
      if (!window.isSecureContext) {
        if (isMounted) {
          setAudioSupported(false);
          setAudioStatus("Microphone needs HTTPS on this device/browser.");
        }
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMounted) {
          setAudioSupported(false);
          setAudioStatus("Microphone is not supported in this browser.");
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        // If the match connected before the prompt was answered, this adds
        // the track and onnegotiationneeded sends it to the opponent.
        if (negotiated) addLocalTracks(pc);
        setAudioEnabled(true);
        setAudioStatus("Microphone connected");
      } catch (error) {
        console.error("Microphone access error:", error);

        if (isMounted) {
          setAudioEnabled(false);
          if (error?.name === "NotAllowedError") {
            setAudioStatus("Microphone permission denied. Allow mic access and reload.");
            return;
          }

          if (error?.name === "NotFoundError") {
            setAudioStatus("No microphone was found on this device.");
            return;
          }

          if (error?.name === "NotReadableError") {
            setAudioStatus("Microphone is busy in another app or blocked by the OS.");
            return;
          }

          setAudioStatus("Microphone unavailable. Check browser and system settings.");
        }
      }
    };

    const connectSignaling = () => {
      if (!isMounted) return;

      const signalingUrl = getSignalingUrl(roomCode, currentAction, playerId);
      let thisSocket;
      try {
        thisSocket = new WebSocket(signalingUrl);
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        setAudioStatus("Signaling server URL is invalid.");
        setConnectionStatus("Could not connect to signaling server");
        return;
      }
      socket = thisSocket;

      thisSocket.onopen = () => {
        console.log("Connected to signaling server", signalingUrl);
        if (isMounted) {
          setConnectionStatus(`Joined room ${roomCode}. Waiting for opponent...`);
        }
      };

      thisSocket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      thisSocket.onclose = (event) => {
        console.log("WebSocket closed", event.code, event.reason);
        if (!isMounted || socket !== thisSocket || fatalError) return;

        // Mid-match the game runs peer to peer and does not need the server
        // until something breaks; reconnect then rather than interrupting.
        if (channelRef.current?.readyState === "open") {
          signalingLost = true;
          return;
        }

        reconnect("Lost connection to the game server. Reconnecting...");
      };

      // Handle signaling messages one at a time: an ICE candidate must not be
      // applied while the offer before it is still being processed.
      thisSocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        // Decided here, not in the queue: the server closes right after an
        // error, and onclose must already know not to retry.
        if (message.type === "error" && !joinedOnce && !/full/i.test(message.message)) {
          fatalError = true;
        }
        messageQueue = messageQueue
          .then(() => handleMessage(message))
          .catch((error) => console.error("Signaling error:", error));
      };
    };

    // Deferred so React StrictMode's mount-unmount-mount in development does
    // not open two sockets, which made "create" collide with itself.
    const startTimer = setTimeout(() => {
      resetPeer();
      audioReady = setupAudio();
      connectSignaling();
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(startTimer);
      clearTimeout(reconnectTimer);
      clearTimeout(disconnectTimer);
      channelRef.current?.close();
      channelRef.current = null;
      socket?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      pc?.close();
    };
  }, [enabled, roomAction, roomCode]);

  const toggleAudio = () => {
    if (!enabled) return;

    const [audioTrack] = localStreamRef.current?.getAudioTracks() ?? [];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setAudioEnabled(audioTrack.enabled);
    setAudioStatus(audioTrack.enabled ? "Microphone on" : "Microphone muted");
  };

  const sendData = (data) => {
    if (!enabled) return;

    if (channelRef.current?.readyState === "open") {
      console.log("Sending peer data:", data);
      channelRef.current.send(JSON.stringify(data));
    }
  };

  return {
    audioEnabled,
    audioStatus,
    audioSupported,
    connectionStatus,
    isHost,
    playerNumber,
    remoteAudioRef,
    sendData,
    toggleAudio,
  };
};

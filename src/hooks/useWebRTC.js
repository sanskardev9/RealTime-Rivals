import { useEffect, useRef, useState } from "react";

const DEFAULT_SIGNALING_URL = "wss://realtimerivals-backend.onrender.com/ws";

const getSignalingUrl = () => {
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

    return parsedUrl.toString();
  } catch (error) {
    console.error("Invalid signaling URL:", rawUrl, error);
    return DEFAULT_SIGNALING_URL;
  }
};

const signalingUrl = getSignalingUrl();
const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:openrelay.metered.ca:80" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export const useWebRTC = (onData) => {
  const channelRef = useRef(null);
  const onDataRef = useRef(onData);
  const pendingCandidatesRef = useRef([]);
  const startedRef = useRef(false);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioSupported, setAudioSupported] = useState(true);
  const [audioStatus, setAudioStatus] = useState("Requesting microphone access...");

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    let isMounted = true;
    let socket;
    let cleanupChannel = null;
    const pc = new RTCPeerConnection({
      iceServers,
    });

    const attachChannel = (channel) => {
      channelRef.current = channel;

      channel.onopen = () => {
        console.log("Data channel open");
      };

      channel.onmessage = (event) => {
        const parsedData = JSON.parse(event.data);
        console.log("Received peer data:", parsedData);
        onDataRef.current(parsedData);
      };
    };

    const flushPendingIceCandidates = async () => {
      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift();
        await pc.addIceCandidate(candidate);
      }
    };

    const startOffer = async () => {
      if (startedRef.current) return;
      startedRef.current = true;

      attachChannel(pc.createDataChannel("game"));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.send(JSON.stringify({ type: "offer", offer }));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "ice",
            candidate: event.candidate,
          })
        );
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);

      if (!isMounted) return;

      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setAudioStatus((currentStatus) =>
          currentStatus === "Microphone connected" ? "Peer connected" : currentStatus
        );
      }

      if (pc.iceConnectionState === "failed") {
        setAudioStatus("Peer connection failed. TURN relay may be unavailable.");
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("Peer connection state:", pc.connectionState);

      if (!isMounted) return;

      if (pc.connectionState === "failed") {
        setAudioStatus("Connection failed. Refresh both players and try again.");
      }

      if (pc.connectionState === "disconnected") {
        setAudioStatus("Peer disconnected");
      }
    };

    pc.ondatachannel = (event) => {
      attachChannel(event.channel);
    };

    pc.ontrack = (event) => {
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

    const setupAudio = async () => {
      if (!window.isSecureContext) {
        if (isMounted) {
          setAudioSupported(false);
          setAudioStatus("Microphone needs HTTPS on this device/browser.");
        }
        return;
      }

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
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
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
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
      try {
        socket = new WebSocket(signalingUrl);
      } catch (error) {
        console.error("Failed to create WebSocket:", error);

        if (isMounted) {
          setAudioStatus("Signaling server URL is invalid.");
        }
        return;
      }

      socket.onopen = () => {
        console.log("Connected to signaling server", signalingUrl);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socket.onclose = (event) => {
        console.log("WebSocket closed", event.code, event.reason);
      };

      socket.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        if (message.type === "ready" && message.initiator) {
          await startOffer();
        }

        if (message.type === "offer") {
          startedRef.current = true;

          await pc.setRemoteDescription(message.offer);
          await flushPendingIceCandidates();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.send(JSON.stringify({ type: "answer", answer }));
        }

        if (message.type === "answer") {
          await pc.setRemoteDescription(message.answer);
          await flushPendingIceCandidates();
        }

        if (message.type === "ice") {
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(message.candidate);
            } catch (error) {
              console.error("ICE error:", error);
            }
          } else {
            pendingCandidatesRef.current.push(message.candidate);
          }
        }

        if (message.type === "peer_left") {
          startedRef.current = false;
          channelRef.current?.close();
          channelRef.current = null;

          if (isMounted) {
            setAudioStatus("Peer disconnected");
          }

          console.log("Peer disconnected");
        }

        if (message.type === "error") {
          console.error(message.message);
        }
      };

      cleanupChannel = () => {
        socket.close();
      };
    };

    connectSignaling();
    setupAudio();

    return () => {
      isMounted = false;
      channelRef.current?.close();
      cleanupChannel?.();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      pc.close();
    };
  }, []);

  const toggleAudio = () => {
    const [audioTrack] = localStreamRef.current?.getAudioTracks() ?? [];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setAudioEnabled(audioTrack.enabled);
    setAudioStatus(audioTrack.enabled ? "Microphone on" : "Microphone muted");
  };

  const sendData = (data) => {
    if (channelRef.current?.readyState === "open") {
      console.log("Sending peer data:", data);
      channelRef.current.send(JSON.stringify(data));
    }
  };

  return {
    audioEnabled,
    audioStatus,
    audioSupported,
    remoteAudioRef,
    sendData,
    toggleAudio,
  };
};

import { useEffect, useRef } from "react";

export const useWebRTC = (onData) => {
  const channelRef = useRef(null);

  useEffect(() => {
    const pc = new RTCPeerConnection();

    const channel = pc.createDataChannel("game");
    channelRef.current = channel;

    channel.onmessage = (e) => {
      onData(JSON.parse(e.data));
    };

    // ⚠️ Signaling part will come next (FastAPI)

  }, []);

  const sendData = (data) => {
    if (channelRef.current?.readyState === "open") {
      channelRef.current.send(JSON.stringify(data));
    }
  };

  return { sendData };
};

import { useEffect, useRef } from "react";
import { useGameState } from "../hooks/useGameState";
import { useControls } from "../hooks/useControls";
import { useWebRTC } from "../hooks/useWebRTC";

export default function GameCanvas() {
  const canvasRef = useRef();
  const playerRef = useRef(null);
  const opponentRef = useRef(null);
  const { player, opponent, setOpponent, updatePlayer, movePlayer } = useGameState();

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    opponentRef.current = opponent;
  }, [opponent]);

  const { sendData } = useWebRTC((data) => {
    setOpponent(data);
  });

  useControls((input) => {
    const updated = movePlayer(playerRef.current, input);

    sendData(updated);
    updatePlayer(input);
  });

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    let animationFrameId;

    const loop = () => {
      const currentPlayer = playerRef.current;
      const currentOpponent = opponentRef.current;

      ctx.clearRect(0, 0, 800, 400);

      // Player
      ctx.fillStyle = "blue";
      ctx.fillRect(currentPlayer.x, 300, 50, 50);

      // Opponent
      ctx.fillStyle = "red";
      ctx.fillRect(currentOpponent.x, 300, 50, 50);

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} width={800} height={400} />;
}

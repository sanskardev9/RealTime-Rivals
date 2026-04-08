import { useEffect, useRef } from "react";
import { useGameState } from "../hooks/useGameState";
import { useControls } from "../hooks/useControls";
import { useWebRTC } from "../hooks/useWebRTC";
import { getAttackBoxX } from "../game/collision";
import HealthBar from "./HealthBar";

export default function GameCanvas() {
  const canvasRef = useRef();
  const playerRef = useRef(null);
  const opponentRef = useRef(null);
  const { player, opponent, setOpponent, updatePlayer } = useGameState();

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    opponentRef.current = opponent;
  }, [opponent]);

  const { sendData } = useWebRTC((data) => {
    setOpponent(data);
  });

  useEffect(() => {
    sendData(player);
  }, [player, sendData]);

  useControls((input) => {
    if (!playerRef.current) {
      return;
    }

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
      if (currentPlayer.isAttacking) {
        ctx.fillStyle = "yellow";
        ctx.fillRect(getAttackBoxX(currentPlayer), 315, 20, 20);
      }

      // Opponent
      ctx.fillStyle = "red";
      ctx.fillRect(currentOpponent.x, 300, 50, 50);
      if (currentOpponent.isAttacking) {
        ctx.fillStyle = "orange";
        ctx.fillRect(getAttackBoxX(currentOpponent), 315, 20, 20);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div>
      <div className="hud">
        <HealthBar health={player.health} color="blue" />
        <HealthBar health={opponent.health} color="red" />
      </div>
      <canvas ref={canvasRef} width={800} height={400} />
    </div>
  );
}

import { useEffect, useRef } from "react";
import { useGameState } from "../hooks/useGameState";
import { useControls } from "../hooks/useControls";
import { useWebRTC } from "../hooks/useWebRTC";
import { getAttackBoxX } from "../game/collision";
import HealthBar from "./HealthBar";

export default function GameCanvas() {
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const opponentRef = useRef(null);

  const {
    player,
    opponent,
    setOpponent,
    updatePlayer,
    gameStatus,
  } = useGameState();

  // Keep refs updated (important for game loop)
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    opponentRef.current = opponent;
  }, [opponent]);

  // WebRTC sync
  const { sendData } = useWebRTC((data) => {
    setOpponent(data);
  });

  // Send player state
  useEffect(() => {
    sendData(player);
  }, [player, sendData]);

  // Controls
  useControls((input) => {
    if (gameStatus !== "playing") return;
    if (!playerRef.current) return;

    updatePlayer(input);
  });

  // Game loop
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    let animationFrameId;

    const loop = () => {
      if (gameStatus !== "playing") return;

      const currentPlayer = playerRef.current;
      const currentOpponent = opponentRef.current;

      if (!currentPlayer || !currentOpponent) return;

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

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameStatus]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white relative">
      
      {/* HUD */}
      <div className="w-[800px] flex justify-between mb-3">
        <HealthBar health={player.health} color="blue" />
        <HealthBar health={opponent.health} color="red" />
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="bg-zinc-800 border border-zinc-700"
      />

      {/* Game Over Overlay */}
      {gameStatus !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
          <h1 className="text-4xl font-bold mb-4">
            {gameStatus === "playerWon" ? "You Win 🏆" : "You Lose 💀"}
          </h1>

          <button
            className="px-6 py-2 bg-white text-black rounded-lg"
            onClick={() => window.location.reload()}
          >
            Restart
          </button>
        </div>
      )}
    </div>
  );
}
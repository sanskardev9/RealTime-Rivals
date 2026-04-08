import { useEffect, useRef } from "react";
import { useGameState } from "../hooks/useGameState";
import { useControls } from "../hooks/useControls";
import { useWebRTC } from "../hooks/useWebRTC";
import { getAttackBoxX } from "../game/collision";
import { INPUT_REPEAT_MS } from "../game/player";
import HealthBar from "./HealthBar";

export default function GameCanvas() {
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const opponentRef = useRef(null);
  const touchControlsRef = useRef({
    left: false,
    right: false,
  });
  const touchMoveIntervalRef = useRef(null);

  const {
    player,
    opponent,
    syncOpponent,
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
  const {
    audioEnabled,
    audioStatus,
    audioSupported,
    remoteAudioRef,
    sendData,
    toggleAudio,
  } = useWebRTC((data) => {
    syncOpponent(data);
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

  useEffect(() => {
    touchMoveIntervalRef.current = setInterval(() => {
      if (gameStatus !== "playing" || !playerRef.current) return;

      if (touchControlsRef.current.left) {
        updatePlayer("left");
      }

      if (touchControlsRef.current.right) {
        updatePlayer("right");
      }
    }, INPUT_REPEAT_MS);

    return () => {
      clearInterval(touchMoveIntervalRef.current);
    };
  }, [gameStatus, updatePlayer]);

  const setTouchMovement = (direction, isPressed) => {
    touchControlsRef.current[direction] = isPressed;
  };

  const stopAllTouchMovement = () => {
    touchControlsRef.current.left = false;
    touchControlsRef.current.right = false;
  };

  const handleTouchAttack = () => {
    if (gameStatus !== "playing") return;
    updatePlayer("attack");
  };

  const bindMovementButton = (direction) => ({
    onMouseDown: () => setTouchMovement(direction, true),
    onMouseUp: () => setTouchMovement(direction, false),
    onMouseLeave: () => setTouchMovement(direction, false),
    onTouchStart: (event) => {
      event.preventDefault();
      setTouchMovement(direction, true);
    },
    onTouchEnd: (event) => {
      event.preventDefault();
      setTouchMovement(direction, false);
    },
    onTouchCancel: (event) => {
      event.preventDefault();
      setTouchMovement(direction, false);
    },
    onPointerCancel: stopAllTouchMovement,
  });

  const controlButtonClass =
    "select-none touch-none rounded-2xl border border-zinc-500 bg-zinc-800 px-5 py-4 text-base font-semibold text-white active:scale-95 active:bg-zinc-700";

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
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-black px-4 py-6 text-white">
      
      {/* HUD */}
      <div className="mb-3 flex w-full max-w-[800px] gap-3">
        <HealthBar health={player.health} color="blue" />
        <HealthBar health={opponent.health} color="red" />
      </div>

      <div className="mb-3 flex w-full max-w-[800px] items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm">
        <span>{audioStatus}</span>
        <button
          className="shrink-0 rounded-md border border-zinc-500 px-3 py-1 disabled:opacity-50"
          disabled={!audioSupported}
          onClick={toggleAudio}
        >
          {audioEnabled ? "Mute Mic" : "Unmute Mic"}
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="block aspect-[2/1] w-full max-w-[800px] rounded-xl border border-zinc-700 bg-zinc-800"
      />
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="mt-4 grid w-full max-w-[800px] grid-cols-3 gap-3 sm:hidden">
        <button
          className={controlButtonClass}
          {...bindMovementButton("left")}
        >
          Left
        </button>
        <button
          className={controlButtonClass}
          onMouseDown={handleTouchAttack}
          onTouchStart={(event) => {
            event.preventDefault();
            handleTouchAttack();
          }}
        >
          Attack
        </button>
        <button
          className={controlButtonClass}
          {...bindMovementButton("right")}
        >
          Right
        </button>
      </div>

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

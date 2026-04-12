import { useEffect, useMemo, useRef, useState } from "react";
import { useGameState } from "../hooks/useGameState";
import { useControls } from "../hooks/useControls";
import { useWebRTC } from "../hooks/useWebRTC";
import { getAttackBoxWidth, getAttackBoxX } from "../game/collision";
import { INPUT_REPEAT_MS, PLAYER_WIDTH, SPECIAL_HIT_TARGET } from "../game/player";
import HealthBar from "./HealthBar";

const ARENA_HEIGHT = 400;
const FLOOR_Y = 350;

const ChargeMeter = ({ align = "left", charge, ready, tint }) => {
  const chargePercent = Math.max(0, Math.min(100, (charge / SPECIAL_HIT_TARGET) * 100));

  return (
    <div className={`mt-2 ${align === "right" ? "text-right" : ""}`}>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${chargePercent}%`,
            background: ready
              ? "linear-gradient(90deg, #f59e0b 0%, #fde047 45%, #fff7ae 100%)"
              : tint,
            boxShadow: ready ? "0 0 12px rgba(253, 224, 71, 0.55)" : "none",
          }}
        />
      </div>
    </div>
  );
};

const drawStage = (ctx, pulse) => {
  const skyGradient = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
  skyGradient.addColorStop(0, "#090909");
  skyGradient.addColorStop(0.28, "#2a0f0f");
  skyGradient.addColorStop(0.62, "#3b0d18");
  skyGradient.addColorStop(1, "#12070d");

  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, 800, ARENA_HEIGHT);

  const horizonGlow = ctx.createRadialGradient(400, 175, 20, 400, 175, 240);
  horizonGlow.addColorStop(0, `rgba(255, 120, 40, ${0.24 + pulse * 0.08})`);
  horizonGlow.addColorStop(0.45, `rgba(255, 60, 80, ${0.14 + pulse * 0.06})`);
  horizonGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, 0, 800, ARENA_HEIGHT);

  ctx.fillStyle = `rgba(255, 180, 80, ${0.08 + pulse * 0.05})`;
  ctx.fillRect(0, 155, 800, 4);

  ctx.fillStyle = `rgba(56, 189, 248, ${0.08 + pulse * 0.04})`;
  ctx.beginPath();
  ctx.arc(150, 70, 110, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(244, 63, 94, ${0.09 + pulse * 0.05})`;
  ctx.beginPath();
  ctx.arc(670, 110, 140, 0, Math.PI * 2);
  ctx.fill();

  for (let index = 0; index < 11; index += 1) {
    const x = index * 80;
    ctx.strokeStyle = "rgba(255, 120, 120, 0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 160);
    ctx.lineTo(400, FLOOR_Y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 210, 160, 0.12)";
  ctx.lineWidth = 1.5;
  for (let y = 175; y < FLOOR_Y; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(800, y);
    ctx.stroke();
  }

  const floorGradient = ctx.createLinearGradient(0, FLOOR_Y - 20, 0, ARENA_HEIGHT);
  floorGradient.addColorStop(0, "#2a0d12");
  floorGradient.addColorStop(0.45, "#13060a");
  floorGradient.addColorStop(1, "#040405");
  ctx.fillStyle = floorGradient;
  ctx.fillRect(0, FLOOR_Y, 800, ARENA_HEIGHT - FLOOR_Y);

  const floorSheen = ctx.createLinearGradient(0, FLOOR_Y, 0, ARENA_HEIGHT);
  floorSheen.addColorStop(0, `rgba(255, 80, 80, ${0.14 + pulse * 0.04})`);
  floorSheen.addColorStop(1, "rgba(255, 80, 80, 0)");
  ctx.fillStyle = floorSheen;
  ctx.fillRect(0, FLOOR_Y, 800, 50);

  ctx.strokeStyle = "rgba(255,180,120,0.2)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y);
  ctx.lineTo(800, FLOOR_Y);
  ctx.stroke();

  for (let index = 0; index < 16; index += 1) {
    const stripeX = index * 52;
    ctx.strokeStyle = "rgba(255, 90, 90, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(stripeX, FLOOR_Y);
    ctx.lineTo(stripeX - 40, ARENA_HEIGHT);
    ctx.stroke();
  }
};

const drawShadow = (ctx, player, intensity = 0.18, pose = "normal") => {
  if (pose === "celebrate") {
    intensity = 0.12;
  }

  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${intensity})`;
  ctx.beginPath();
  ctx.ellipse(
    player.x + PLAYER_WIDTH / 2,
    FLOOR_Y + 8,
    pose === "down" ? 34 : 28,
    pose === "down" ? 10 : 8,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
};

const drawFighter = (ctx, player, palette, time, pose = "normal") => {
  const facing = player.direction === "left" ? -1 : 1;
  const centerX = player.x + PLAYER_WIDTH / 2;
  const centerY = FLOOR_Y - 38;
  const idleSwing = Math.sin(time / 120) * 1.5;
  const isDown = pose === "down";
  const isCelebrating = pose === "celebrate";
  const isPunching = !isDown && !isCelebrating && (player.isAttacking || player.isSpecialAttacking);
  const torsoLean = isCelebrating
    ? 0
    : player.isSpecialAttacking
      ? 14
      : player.isAttacking
        ? 8
        : 2;
  const leadFistX = isCelebrating
    ? 12
    : player.isSpecialAttacking
      ? 40
      : player.isAttacking
        ? 28
        : 12;
  const leadFistY = isCelebrating
    ? -34
    : player.isSpecialAttacking
      ? -2
      : player.isAttacking
        ? 2
        : 10;
  const rearFistX = isCelebrating ? -12 : player.isSpecialAttacking ? -6 : -10;
  const rearFistY = isCelebrating ? -36 : player.isSpecialAttacking ? 10 : 4;
  const kneeBend = isDown ? 10 : isPunching ? 4 : 0;

  ctx.save();
  ctx.translate(centerX, centerY + (isDown ? 40 : idleSwing));
  ctx.scale(isCelebrating ? 1 : facing, 1);

  if (isDown) {
    ctx.rotate(Math.PI / 2.35);
  }

  ctx.rotate((-torsoLean * Math.PI) / 180);

  ctx.strokeStyle = palette.limb;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(-8, 26);
  ctx.lineTo(isDown ? -2 : -14, 46 + kneeBend);
  ctx.moveTo(8, 26);
  ctx.lineTo(isDown ? 18 : 14, 50 - kneeBend);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 26);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-2, 4);
  ctx.lineTo(rearFistX, rearFistY);
  ctx.moveTo(2, 0);
  ctx.lineTo(leadFistX, leadFistY);
  ctx.stroke();

  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(leadFistX, leadFistY, player.isSpecialAttacking && !isCelebrating ? 7 : 5, 0, Math.PI * 2);
  ctx.arc(rearFistX, rearFistY, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.body;
  ctx.beginPath();
  ctx.roundRect(-14, -2, 28, 32, 10);
  ctx.fill();

  ctx.fillStyle = palette.accent;
  ctx.fillRect(-5, 2, 10, 20);

  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(0, -20, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(4, -21, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.hair;
  ctx.beginPath();
  ctx.arc(-1, -24, 14, Math.PI, Math.PI * 2);
  ctx.fill();

  if (player.isSpecialAttacking && !isDown && !isCelebrating) {
    ctx.fillStyle = palette.glow;
    ctx.beginPath();
    ctx.arc(leadFistX + 2, leadFistY, 10 + Math.sin(time / 45) * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

const drawAttackSlash = (ctx, player, color) => {
  const width = getAttackBoxWidth(player);
  const x = getAttackBoxX(player);
  const y = FLOOR_Y - 35;

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x + width / 2, y + 12, width / 2, 10, -0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.arc(x + width - 4, y + 10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawBeam = (ctx, player, beamColor, coreColor, time) => {
  const width = getAttackBoxWidth(player);
  const x = getAttackBoxX(player);
  const y = FLOOR_Y - 52;
  const beamHeight = 36 + Math.sin(time / 40) * 4;

  ctx.save();
  ctx.shadowColor = beamColor;
  ctx.shadowBlur = 26;

  const beamGradient = ctx.createLinearGradient(x, 0, x + width, 0);
  beamGradient.addColorStop(0, "rgba(255,255,255,0.08)");
  beamGradient.addColorStop(0.2, beamColor);
  beamGradient.addColorStop(0.6, coreColor);
  beamGradient.addColorStop(1, "rgba(255,255,255,0.12)");

  ctx.fillStyle = beamGradient;
  ctx.beginPath();
  ctx.roundRect(x, y, width, beamHeight, 18);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();
  ctx.roundRect(x + 10, y + beamHeight / 2 - 5, Math.max(16, width - 20), 10, 8);
  ctx.fill();

  for (let index = 0; index < 4; index += 1) {
    const sparkX = x + ((time / 2 + index * 37) % Math.max(width - 18, 20));
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(sparkX, y + beamHeight / 2 + Math.sin((time + index * 20) / 20) * 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

export default function GameCanvas({
  difficulty = null,
  matchType = "online",
  playerName,
  roomAction,
  roomCode,
}) {
  const isComputerMatch = matchType === "computer";
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const opponentRef = useRef(null);
  const syncHostStateRef = useRef(null);
  const applyRemoteInputRef = useRef(null);
  const isHostRef = useRef(false);
  const touchMoveIntervalRef = useRef(null);
  const [opponentName, setOpponentName] = useState("Waiting for opponent...");

  const {
    audioEnabled,
    audioStatus,
    audioSupported,
    connectionStatus,
    isHost,
    remoteAudioRef,
    sendData,
    toggleAudio,
  } = useWebRTC(roomCode, roomAction, (data) => {
    if (data.type === "profile") {
      setOpponentName(data.name || "Opponent");
    }

    if (data.type === "input" && isHostRef.current) {
      applyRemoteInputRef.current?.(data.input);
    }

    if (data.type === "state" && !isHostRef.current) {
      if (data.state?.names?.player) {
        setOpponentName(data.state.names.player);
      }

      syncHostStateRef.current?.(data.state);
    }
  }, { enabled: !isComputerMatch });

  const {
    player,
    opponent,
    gameStatus,
    updatePlayer,
    applyRemoteInput,
    syncHostState,
  } = useGameState(isHost, {
    difficulty,
    opponentMode: isComputerMatch ? "computer" : "remote",
  });

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    opponentRef.current = opponent;
  }, [opponent]);

  useEffect(() => {
    syncHostStateRef.current = syncHostState;
  }, [syncHostState]);

  useEffect(() => {
    applyRemoteInputRef.current = applyRemoteInput;
  }, [applyRemoteInput]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    if (!isComputerMatch) {
      return;
    }

    const difficultyLabel = difficulty
      ? `${difficulty[0].toUpperCase()}${difficulty.slice(1)}`
      : "Medium";
    setOpponentName(`CPU ${difficultyLabel}`);
  }, [difficulty, isComputerMatch]);

  useEffect(() => {
    if (isComputerMatch) {
      return;
    }

    if (connectionStatus.startsWith("Connected in room")) {
      sendData({ type: "profile", name: playerName });
    }
  }, [connectionStatus, isComputerMatch, playerName, sendData]);

  useEffect(() => {
    if (isComputerMatch) {
      return;
    }

    if (isHost) {
      sendData({
        type: "state",
        state: {
          gameStatus,
          names: {
            opponent: opponentName,
            player: playerName,
          },
          opponent,
          player,
        },
      });
    }
  }, [gameStatus, isComputerMatch, isHost, opponent, opponentName, player, playerName, sendData]);

  const handleInput = (input) => {
    if (gameStatus !== "playing") return;

    if (isComputerMatch || isHost) {
      updatePlayer(input);
      return;
    }

    sendData({ type: "input", input });
  };

  useControls((input) => {
    if (!playerRef.current) return;
    handleInput(input);
  });

  useEffect(() => {
    return () => {
      clearInterval(touchMoveIntervalRef.current);
    };
  }, []);

  const handleTouchAttack = () => {
    handleInput("attack");
  };

  const handleTouchSpecialAttack = () => {
    handleInput("specialAttack");
  };

  const startTouchMovement = (direction) => {
    if (gameStatus !== "playing" || !playerRef.current) return;

    clearInterval(touchMoveIntervalRef.current);
    handleInput(direction);
    touchMoveIntervalRef.current = setInterval(() => {
      if (playerRef.current && gameStatus === "playing") {
        handleInput(direction);
      }
    }, INPUT_REPEAT_MS);
  };

  const stopTouchMovement = () => {
    clearInterval(touchMoveIntervalRef.current);
    touchMoveIntervalRef.current = null;
  };

  const bindMovementButton = (direction) => ({
    onPointerDown: (event) => {
      event.preventDefault();
      startTouchMovement(direction);
    },
    onPointerUp: (event) => {
      event.preventDefault();
      stopTouchMovement();
    },
    onPointerLeave: stopTouchMovement,
    onPointerCancel: stopTouchMovement,
  });

  const controlButtonClass =
    "select-none touch-none rounded-2xl border border-zinc-500 bg-zinc-800 px-5 py-4 text-base font-semibold text-white active:scale-95 active:bg-zinc-700";

  const resultLabel = useMemo(() => {
    if (player.health <= 0 && opponent.health <= 0) {
      return "Match Tie";
    }

    if (player.health <= 0) {
      return "You Lose";
    }

    if (opponent.health <= 0) {
      return "You Win";
    }

    return "";
  }, [opponent.health, player.health]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const loop = (time = 0) => {
      const pulse = (Math.sin(time / 700) + 1) / 2;

      const currentPlayer = playerRef.current;
      const currentOpponent = opponentRef.current;

      if (!currentPlayer || !currentOpponent) return;

      const playerPose =
        currentPlayer.health <= 0 && currentOpponent.health <= 0
          ? "down"
          : currentPlayer.health <= 0
            ? "down"
            : currentOpponent.health <= 0
              ? "celebrate"
              : "normal";
      const opponentPose =
        currentPlayer.health <= 0 && currentOpponent.health <= 0
          ? "down"
          : currentOpponent.health <= 0
            ? "down"
            : currentPlayer.health <= 0
              ? "celebrate"
              : "normal";

      ctx.clearRect(0, 0, 800, ARENA_HEIGHT);
      drawStage(ctx, pulse);
      drawShadow(ctx, currentPlayer, 0.18, playerPose);
      drawShadow(ctx, currentOpponent, 0.18, opponentPose);

      if (currentPlayer.isSpecialAttacking && playerPose === "normal") {
        drawBeam(ctx, currentPlayer, "#a855f7", "#e9d5ff", time);
      } else if (currentPlayer.isAttacking && playerPose === "normal") {
        drawAttackSlash(ctx, currentPlayer, "#fde047");
      }

      if (currentOpponent.isSpecialAttacking && opponentPose === "normal") {
        drawBeam(ctx, currentOpponent, "#f97316", "#fdba74", time + 60);
      } else if (currentOpponent.isAttacking && opponentPose === "normal") {
        drawAttackSlash(ctx, currentOpponent, "#fb923c");
      }

      drawFighter(
        ctx,
        currentPlayer,
        {
          accent: "#93c5fd",
          body: "#1d4ed8",
          glow: "rgba(147, 197, 253, 0.45)",
          hair: "#0f172a",
          limb: "#cbd5e1",
          skin: "#f1c27d",
        },
        time,
        playerPose
      );
      drawFighter(
        ctx,
        currentOpponent,
        {
          accent: "#fdba74",
          body: "#b91c1c",
          glow: "rgba(251, 146, 60, 0.42)",
          hair: "#3f1d0f",
          limb: "#fecaca",
          skin: "#e0ac69",
        },
        time + 90,
        opponentPose
      );

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameStatus]);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-black px-4 py-6 text-white">
      <div className="mb-3 flex w-full max-w-[800px] items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Room</p>
          <p className="font-mono text-lg tracking-[0.35em]">{roomCode}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Role</p>
          <p>{isComputerMatch ? "Solo" : isHost ? "Host" : "Client"}</p>
        </div>
      </div>

      <div className="mb-3 flex w-full max-w-[800px] gap-3">
        <HealthBar color="blue" health={player.health} label={playerName} />
        <HealthBar color="red" health={opponent.health} label={opponentName} />
      </div>

      <div className="mb-3 grid w-full max-w-[800px] grid-cols-2 gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Your Charge</p>
          <p>{player.specialReady ? "Long-range attack ready" : "Charging beam..."}</p>
          <ChargeMeter
            charge={player.hitCount}
            ready={player.specialReady}
            tint="linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)"
          />
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Opp. Charge</p>
          <p>{opponent.specialReady ? "Long-range attack ready" : "Charging beam..."}</p>
          <ChargeMeter
            align="right"
            charge={opponent.hitCount}
            ready={opponent.specialReady}
            tint="linear-gradient(90deg, #dc2626 0%, #f97316 100%)"
          />
        </div>
      </div>

      <div className="mb-3 flex w-full max-w-[800px] items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm">
        <span>
          {isComputerMatch
            ? `Computer Battle${
                difficulty ? ` · ${difficulty[0].toUpperCase()}${difficulty.slice(1)}` : ""
              }`
            : connectionStatus}
        </span>
      </div>

      {!isComputerMatch && (
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
      )}

      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="block aspect-[2/1] w-full max-w-[800px] rounded-xl border border-zinc-700 bg-zinc-800"
      />
      {!isComputerMatch && <audio ref={remoteAudioRef} autoPlay playsInline />}

      <div className="mt-4 grid w-full max-w-[800px] grid-cols-4 gap-3 sm:hidden">
        <button className={controlButtonClass} {...bindMovementButton("left")}>
          Left
        </button>
        <button
          className={controlButtonClass}
          onPointerDown={(event) => {
            event.preventDefault();
            handleTouchAttack();
          }}
        >
          Attack
        </button>
        <button
          className={`${controlButtonClass} ${!player.specialReady ? "opacity-50" : "border-fuchsia-400 bg-fuchsia-950 text-fuchsia-100"}`}
          disabled={!player.specialReady}
          onPointerDown={(event) => {
            event.preventDefault();
            handleTouchSpecialAttack();
          }}
        >
          Beam
        </button>
        <button className={controlButtonClass} {...bindMovementButton("right")}>
          Right
        </button>
      </div>

      {gameStatus !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
          <h1 className="mb-4 text-4xl font-bold">{resultLabel}</h1>

          <button
            className="rounded-lg bg-white px-6 py-2 text-black"
            onClick={() => window.location.reload()}
          >
            Restart
          </button>
        </div>
      )}
    </div>
  );
}

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

const copyTextWithExecCommand = (text) => {
  if (typeof document === "undefined") {
    return false;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.opacity = "0";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, text.length);

  let didCopy = false;

  try {
    didCopy = document.execCommand("copy");
  } catch (error) {
    console.error("Fallback copy failed:", error);
  }

  document.body.removeChild(textArea);
  return didCopy;
};

export default function GameCanvas({
  difficulty = null,
  matchType = "online",
  onExitToLobby,
  playerName,
  roomAction,
  roomCode,
  showTutorialOnStart = false,
}) {
  const isComputerMatch = matchType === "computer";
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const opponentRef = useRef(null);
  const syncHostStateRef = useRef(null);
  const applyRemoteInputRef = useRef(null);
  const isHostRef = useRef(false);
  const touchMoveIntervalRef = useRef(null);
  const countdownTimeoutRef = useRef(null);
  const rejectionTimeoutRef = useRef(null);
  const matchNumberRef = useRef(1);
  const previousGameStatusRef = useRef("playing");
  const [opponentName, setOpponentName] = useState("Waiting...");
  const [matchNumber, setMatchNumber] = useState(1);
  const [rematchState, setRematchState] = useState("idle");
  const [rematchRequesterName, setRematchRequesterName] = useState("");
  const [rematchFeedback, setRematchFeedback] = useState("");
  const [countdownValue, setCountdownValue] = useState(null);
  const [rejectionCountdown, setRejectionCountdown] = useState(null);
  const [showTutorial, setShowTutorial] = useState(showTutorialOnStart);
  const [opponentTutorialOpen, setOpponentTutorialOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [copyStatus, setCopyStatus] = useState("idle");
  const [roundScore, setRoundScore] = useState({
    opponent: 0,
    player: 0,
    ties: 0,
  });
  const tutorialCards = useMemo(
    () => [
      {
        label: "Move",
        value: "Arrow Left / Arrow Right",
        body: "Move in and out of range to bait attacks and control spacing.",
      },
      {
        label: "Attack",
        value: "Space or mobile Attack",
        body: "Quick close-range hit. Great for pressure and building charge.",
      },
      {
        label: "Beam",
        value: "Q or mobile Beam",
        body: "Your special attack unlocks once the charge meter is full.",
      },
      {
        label: "Rematch",
        value: "Restart after match end",
        body: "Both players vote. Accept starts the next match in the same room.",
      },
      {
        label: "Voice Chat",
        value: "Mic icon in match HUD",
        body: "Talk to your opponent live in online matches, and tap the mic icon anytime to mute or unmute yourself.",
      },
    ],
    []
  );

  const isTutorialBlocking = showTutorial || opponentTutorialOpen;
  const isMatchLocked = countdownValue !== null || isTutorialBlocking;

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

    if (data.type === "tutorial_state") {
      setOpponentTutorialOpen(Boolean(data.open));
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

    if (data.type === "rematch_request") {
      if (rematchState === "requesting") {
        if (isHostRef.current) {
          const nextMatchNumber = matchNumberRef.current + 1;
          sendData({ type: "rematch_start", matchNumber: nextMatchNumber });
          beginRematch(nextMatchNumber);
        } else {
          setRematchState("accepted");
          sendData({ type: "rematch_accept" });
        }
        return;
      }

      setRematchState("incoming");
      setRematchRequesterName(data.requesterName || "Your opponent");
      setRematchFeedback("");
    }

    if (data.type === "rematch_accept" && isHostRef.current) {
      const nextMatchNumber = matchNumberRef.current + 1;
      sendData({ type: "rematch_start", matchNumber: nextMatchNumber });
      beginRematch(nextMatchNumber);
    }

    if (data.type === "rematch_reject") {
      beginRejectionExit(`${data.responderName || "Your opponent"} rejected the rematch request.`);
    }

    if (data.type === "rematch_start") {
      beginRematch(data.matchNumber ?? matchNumberRef.current + 1);
    }
  }, { enabled: !isComputerMatch });

  const {
    player,
    opponent,
    gameStatus,
    updatePlayer,
    applyRemoteInput,
    resetGame,
    syncHostState,
  } = useGameState(isHost, {
    difficulty,
    opponentMode: isComputerMatch ? "computer" : "remote",
    paused: isMatchLocked,
  });

  const clearCountdown = () => {
    if (countdownTimeoutRef.current) {
      clearTimeout(countdownTimeoutRef.current);
      countdownTimeoutRef.current = null;
    }
  };

  const clearRejectionRedirect = () => {
    if (rejectionTimeoutRef.current) {
      clearTimeout(rejectionTimeoutRef.current);
      rejectionTimeoutRef.current = null;
    }
  };

  const copyRoomCode = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(roomCode);
      } else {
        const didCopy = copyTextWithExecCommand(roomCode);

        if (!didCopy) {
          setCopyStatus("unsupported");
          window.setTimeout(() => {
            setCopyStatus("idle");
          }, 1800);
          return;
        }
      }

      setCopyStatus("copied");
      window.setTimeout(() => {
        setCopyStatus("idle");
      }, 1800);
    } catch (error) {
      console.error("Failed to copy room code:", error);
      setCopyStatus("error");
      window.setTimeout(() => {
        setCopyStatus("idle");
      }, 1800);
    }
  };

  const beginRejectionExit = (message) => {
    clearCountdown();
    clearRejectionRedirect();
    setCountdownValue(null);
    setRematchState("rejected");
    setRematchRequesterName("");
    setRematchFeedback(message);

    const runRedirectStep = (nextValue) => {
      setRejectionCountdown(nextValue);

      if (nextValue === null) {
        rejectionTimeoutRef.current = null;
        onExitToLobby?.();
        return;
      }

      rejectionTimeoutRef.current = setTimeout(() => {
        runRedirectStep(nextValue > 1 ? nextValue - 1 : null);
      }, 1000);
    };

    runRedirectStep(3);
  };

  const startCountdown = () => {
    clearCountdown();
    clearRejectionRedirect();
    setRejectionCountdown(null);

    const runCountdownStep = (nextValue) => {
      setCountdownValue(nextValue);

      if (nextValue === null) {
        countdownTimeoutRef.current = null;
        return;
      }

      countdownTimeoutRef.current = setTimeout(() => {
        runCountdownStep(nextValue > 1 ? nextValue - 1 : null);
      }, 1000);
    };

    runCountdownStep(3);
  };

  const beginRematch = (nextMatchNumber) => {
    clearInterval(touchMoveIntervalRef.current);
    touchMoveIntervalRef.current = null;
    resetGame();
    setMatchNumber(nextMatchNumber);
    setRematchState("idle");
    setRematchRequesterName("");
    setRematchFeedback("");
    setRejectionCountdown(null);
    startCountdown();
  };

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
    matchNumberRef.current = matchNumber;
  }, [matchNumber]);

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
      sendData({ type: "tutorial_state", open: showTutorial });
    }
  }, [connectionStatus, isComputerMatch, playerName, sendData, showTutorial]);

  useEffect(() => {
    if (isComputerMatch || !connectionStatus.startsWith("Connected in room")) {
      return;
    }

    sendData({ type: "tutorial_state", open: showTutorial });
  }, [connectionStatus, isComputerMatch, sendData, showTutorial]);

  useEffect(() => {
    return () => {
      clearCountdown();
      clearRejectionRedirect();
    };
  }, []);

  useEffect(() => {
    if (gameStatus === "playing") {
      setRematchFeedback("");
    }
  }, [gameStatus]);

  const closeTutorial = () => {
    setShowTutorial(false);
  };

  const requestExitToLobby = () => {
    if (gameStatus === "playing" && !isTutorialBlocking) {
      setShowLeaveConfirm(true);
      return;
    }

    onExitToLobby?.();
  };

  const confirmExitToLobby = () => {
    setShowLeaveConfirm(false);
    onExitToLobby?.();
  };

  const cancelExitToLobby = () => {
    setShowLeaveConfirm(false);
  };

  useEffect(() => {
    const previousStatus = previousGameStatusRef.current;

    if (previousStatus === "playing" && gameStatus !== "playing") {
      setRoundScore((currentScore) => {
        if (player.health <= 0 && opponent.health <= 0) {
          return {
            ...currentScore,
            ties: currentScore.ties + 1,
          };
        }

        if (opponent.health <= 0) {
          return {
            ...currentScore,
            player: currentScore.player + 1,
          };
        }

        if (player.health <= 0) {
          return {
            ...currentScore,
            opponent: currentScore.opponent + 1,
          };
        }

        return currentScore;
      });
    }

    previousGameStatusRef.current = gameStatus;
  }, [gameStatus, opponent.health, player.health]);

  const requestRematch = () => {
    if (isComputerMatch) {
      beginRematch(matchNumberRef.current + 1);
      return;
    }

    if (rematchState !== "idle") {
      return;
    }

    sendData({ type: "rematch_request", requesterName: playerName });
    setRematchState("requesting");
    setRematchRequesterName("");
    setRematchFeedback("");
  };

  const acceptRematch = () => {
    if (isComputerMatch) {
      beginRematch(matchNumberRef.current + 1);
      return;
    }

    const nextMatchNumber = matchNumberRef.current + 1;

    if (isHostRef.current) {
      sendData({ type: "rematch_start", matchNumber: nextMatchNumber });
      beginRematch(nextMatchNumber);
      return;
    }

    sendData({ type: "rematch_accept" });
    setRematchState("accepted");
    setRematchFeedback("");
  };

  const rejectRematch = () => {
    if (isComputerMatch) {
      return;
    }

    sendData({ type: "rematch_reject", responderName: playerName });
    beginRejectionExit("You rejected the rematch. Returning to home...");
  };

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
    if (gameStatus !== "playing" || isMatchLocked) return;

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
    if (
      gameStatus !== "playing" ||
      isMatchLocked ||
      !playerRef.current
    ) {
      return;
    }

    clearInterval(touchMoveIntervalRef.current);
    handleInput(direction);
    touchMoveIntervalRef.current = setInterval(() => {
      if (playerRef.current && gameStatus === "playing" && !isMatchLocked) {
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
    "select-none touch-none rounded-2xl border border-zinc-500 bg-zinc-800 px-2 py-3 text-sm font-semibold text-white active:scale-95 active:bg-zinc-700 sm:px-5 sm:py-4 sm:text-base";

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

  const endOverlayTitle = useMemo(() => {
    if (countdownValue !== null) {
      return countdownValue;
    }

    if (rematchState === "incoming") {
      return "Rematch Request";
    }

    if (rematchState === "requesting") {
      return "Awaiting Reply";
    }

    if (rematchState === "accepted") {
      return "Rematch Locked";
    }

    if (rematchState === "rejected") {
      return "Rematch Rejected";
    }

    return resultLabel;
  }, [countdownValue, rematchState, resultLabel]);

  const endOverlayMessage = useMemo(() => {
    if (countdownValue !== null) {
      return `Match ${matchNumber} starts in...`;
    }

    if (isComputerMatch) {
      return `Prepare for match ${matchNumber + 1}.`;
    }

    if (rematchState === "incoming") {
      return `${rematchRequesterName || "Your opponent"} wants a rematch.`;
    }

    if (rematchState === "requesting") {
      return "Rematch request sent. Waiting for your opponent to accept.";
    }

    if (rematchState === "accepted") {
      return "Rematch accepted. Starting new match...";
    }

    if (rematchState === "rejected") {
      return `${rematchFeedback} Returning to home in ${rejectionCountdown ?? 0}...`;
    }

    if (rematchFeedback) {
      return rematchFeedback;
    }

    return "Restart in the same room and keep the rivalry going.";
  }, [
    countdownValue,
    isComputerMatch,
    matchNumber,
    rejectionCountdown,
    rematchFeedback,
    rematchRequesterName,
    rematchState,
  ]);

  const roundSummary = useMemo(() => {
    if (player.health <= 0 && opponent.health <= 0) {
      return `Rounds tied: ${roundScore.ties}`;
    }

    if (opponent.health <= 0) {
      return `${playerName} leads ${roundScore.player}-${roundScore.opponent}`;
    }

    if (player.health <= 0) {
      return `${opponentName} leads ${roundScore.opponent}-${roundScore.player}`;
    }

    return `${playerName}: ${roundScore.player} | ${opponentName}: ${roundScore.opponent}`;
  }, [opponent.health, opponentName, player.health, playerName, roundScore]);

  const overlayIcon = useMemo(() => {
    if (countdownValue !== null) {
      return countdownValue;
    }

    if (player.health <= 0 && opponent.health <= 0) {
      return (
        <svg
          aria-hidden="true"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M8 8l8 8" />
          <path d="M16 8l-8 8" />
        </svg>
      );
    }

    if (opponent.health <= 0) {
      return (
        <svg
          aria-hidden="true"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    }

    if (player.health <= 0) {
      return (
        <svg
          aria-hidden="true"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      );
    }

    if (rematchState === "incoming") {
      return "?";
    }

    return "!";
  }, [countdownValue, opponent.health, player.health, rematchState]);

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
    <div className="relative flex h-[100svh] w-full flex-col items-center justify-start overflow-hidden bg-black px-3 py-3 text-white sm:h-auto sm:min-h-screen sm:justify-center sm:overflow-visible sm:px-4 sm:py-6">
      <div className="mb-2 grid w-full max-w-[800px] grid-cols-[1fr_auto_auto] items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.38)] sm:mb-3 sm:gap-3 sm:px-4 sm:py-3 sm:text-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Room</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="truncate font-mono text-[13px] tracking-[0.18em] sm:text-lg sm:tracking-[0.35em]">
              {roomCode}
            </p>
            {!isComputerMatch && (
              <button
                aria-label={
                  copyStatus === "copied"
                    ? "Room code copied"
                    : copyStatus === "error"
                      ? "Retry copying room code"
                      : copyStatus === "unsupported"
                        ? "Copy not supported on this browser"
                        : "Copy room code"
                }
                className={`shrink-0 rounded-full border bg-zinc-950 p-1.5 text-zinc-200 transition sm:p-2 ${
                  copyStatus === "copied"
                    ? "border-emerald-400 text-emerald-200"
                    : copyStatus === "error"
                      ? "border-rose-400 text-rose-200"
                      : copyStatus === "unsupported"
                        ? "border-amber-400 text-amber-200"
                        : "border-zinc-600 hover:border-zinc-400"
                }`}
                onClick={copyRoomCode}
                title={
                  copyStatus === "copied"
                    ? "Copied"
                    : copyStatus === "error"
                      ? "Retry copy"
                      : copyStatus === "unsupported"
                        ? "Copy unavailable"
                        : "Copy room code"
                }
                type="button"
              >
                {copyStatus === "copied" ? (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : copyStatus === "error" || copyStatus === "unsupported" ? (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Match</p>
          <p className="text-sm font-semibold sm:text-lg">{matchNumber}</p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Role</p>
            <p>{isComputerMatch ? "Solo" : isHost ? "Host" : "Client"}</p>
          </div>
          <button
            aria-label="Go home"
            className="shrink-0 rounded-full border border-zinc-600 bg-zinc-950 p-1.5 text-zinc-200 transition hover:border-zinc-400 sm:p-2"
            onClick={requestExitToLobby}
            title="Go home"
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
              <path d="M9 21v-6h6v6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mb-2 flex w-full max-w-[800px] gap-2 sm:mb-3 sm:gap-3">
        <HealthBar color="blue" health={player.health} label={playerName} />
        <HealthBar color="red" health={opponent.health} label={opponentName} />
      </div>

      <div className="mb-2 grid w-full max-w-[800px] grid-cols-3 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-xs sm:mb-3 sm:gap-3 sm:px-4 sm:py-3 sm:text-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Round Wins</p>
          <p className="mt-1 text-sm font-semibold text-sky-200 sm:text-lg">
            {playerName} <br/> {roundScore.player}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Ties</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100 sm:text-lg">{roundScore.ties}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Opp. Wins</p>
          <p className="mt-1 text-sm font-semibold text-orange-200 sm:text-lg">
            {opponentName} <br/> {roundScore.opponent}
          </p>
        </div>
      </div>

      <div className="mb-2 grid w-full max-w-[800px] grid-cols-2 gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs sm:mb-3 sm:gap-3 sm:px-4 sm:py-3 sm:text-sm">
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

      <div className="mb-2 flex w-full max-w-[800px] items-center justify-between gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs sm:mb-3 sm:gap-3 sm:px-4 sm:py-3 sm:text-sm">
        <span className="min-w-0 truncate">
          {isComputerMatch
            ? `Computer Battle${
                difficulty ? ` · ${difficulty[0].toUpperCase()}${difficulty.slice(1)}` : ""
              }`
            : connectionStatus}
        </span>
        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-400">
          {isComputerMatch ? "Local Mode" : "Live Duel"}
        </span>
      </div>

      {!isComputerMatch && (
        <div className="mb-2 flex w-full max-w-[800px] items-center justify-between gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs sm:mb-3 sm:gap-3 sm:px-4 sm:py-3 sm:text-sm">
          <span className="min-w-0 truncate">{audioStatus}</span>
          <button
            aria-label={audioEnabled ? "Mute microphone" : "Unmute microphone"}
            className={`shrink-0 rounded-full border p-2 transition disabled:opacity-50 ${
              audioEnabled
                ? "border-emerald-400/70 bg-emerald-500/10 text-emerald-200"
                : "border-zinc-500 bg-zinc-950 text-zinc-200"
            }`}
            disabled={!audioSupported}
            onClick={toggleAudio}
            title={audioEnabled ? "Mute mic" : "Unmute mic"}
            type="button"
          >
            {audioEnabled ? (
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 1 1-6 0V6a3 3 0 0 1 3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <path d="M12 19v3" />
                <path d="M8 22h8" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M12 3a3 3 0 0 1 3 3v3" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                <path d="M17 10v2a5 5 0 0 1-.7 2.58" />
                <path d="M7 10v2a5 5 0 0 0 8 4" />
                <path d="M12 19v3" />
                <path d="M8 22h8" />
                <path d="m3 3 18 18" />
              </svg>
            )}
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="block aspect-[2/1] max-h-[42svh] w-full max-w-[800px] rounded-xl border border-zinc-700 bg-zinc-800 sm:max-h-none"
      />
      {!isComputerMatch && <audio ref={remoteAudioRef} autoPlay playsInline />}

      <div className="mt-2 grid w-full max-w-[800px] grid-cols-4 gap-2 sm:hidden">
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

      {showTutorial && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/82 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-6">
          <div className="flex max-h-[calc(100svh-24px)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-cyan-500/30 bg-[linear-gradient(145deg,rgba(16,24,40,0.98),rgba(10,10,10,0.98))] shadow-[0_25px_80px_rgba(8,145,178,0.18)]">
            <div className="flex items-start justify-between gap-3 border-b border-white/5 px-4 pb-3 pt-4 sm:gap-4 sm:px-6 sm:pb-4 sm:pt-6">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Tutorial Mode</p>
                <h2 className="mt-2 text-xl font-bold text-white sm:text-3xl">
                  Learn the match before it starts.
                </h2>
                <p className="mt-2 max-w-xl text-xs leading-5 text-zinc-300 sm:mt-3 sm:text-sm">
                  The fight stays paused until you close this screen, so you can read everything
                  safely before the first hit.
                </p>
              </div>
              <button
                className="rounded-full border border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:border-zinc-400 sm:px-4 sm:py-2 sm:text-sm"
                onClick={closeTutorial}
                type="button"
              >
                Ready
              </button>
            </div>
 
            <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"> 
                {tutorialCards.map((card) => (
                  <div
                    key={card.label}
                    className={`rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 sm:p-4 ${
                      card.label === "Voice Chat" ? "sm:col-span-2" : ""
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">{card.label}</p>
                    <p className="mt-2 text-sm font-semibold text-white sm:mt-3 sm:text-lg">
                      {card.value}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-300 sm:mt-2 sm:text-sm sm:leading-6">
                      {card.body}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-50 sm:mt-6 sm:p-4 sm:text-sm">
                <p className="font-semibold uppercase tracking-[0.25em] text-amber-200">Rematch Flow</p>
                <p className="mt-2 leading-5 sm:leading-6">
                  After the fight, press `Restart` to request a rematch. If the other player
                  accepts, both of you stay in the same room and the next round starts after `3, 2, 1`.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!showTutorial && opponentTutorialOpen && gameStatus === "playing" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/78 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-zinc-950/95 px-5 py-7 text-center shadow-[0_20px_70px_rgba(0,0,0,0.55)] sm:px-7 sm:py-8">
            <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Match Waiting</p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              Waiting for tutorial to finish
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Your opponent is still reading the tutorial. The match will unlock as soon as they
              press `Ready`.
            </p>
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/82 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-zinc-950/95 px-5 py-7 text-center shadow-[0_20px_70px_rgba(0,0,0,0.55)] sm:px-7 sm:py-8">
            <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Leave Match</p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              Leave this match?
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              The current match is still in progress. If you leave now, you will go back to the
              home screen.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                className="rounded-full bg-white px-6 py-3 font-semibold text-black transition hover:scale-[1.01]"
                onClick={confirmExitToLobby}
                type="button"
              >
                Leave Match
              </button>
              <button
                className="rounded-full border border-zinc-500 px-6 py-3 font-semibold text-white transition hover:border-zinc-300"
                onClick={cancelExitToLobby}
                type="button"
              >
                Stay Here
              </button>
            </div>
          </div>
        </div>
      )}

      {(gameStatus !== "playing" || countdownValue !== null || rematchState === "rejected") && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-xl rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.18),rgba(8,8,8,0.96)_65%)] px-5 py-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:px-8 sm:py-10">
            {/* <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl font-bold text-white">
              {overlayIcon}
            </div> */}
            <h1 className="mb-3 text-4xl font-bold">{endOverlayTitle}</h1>
            <p className="mx-auto mb-6 max-w-md text-sm leading-6 text-zinc-200">
              {endOverlayMessage}
            </p>

            <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Round Scoreboard</p>
              <p className="mt-2 leading-6">{roundSummary}</p>
              <p className="text-sm leading-6 text-zinc-300">
                {playerName}: {roundScore.player} | {opponentName}: {roundScore.opponent} | Ties: {roundScore.ties}
              </p>
            </div>

            {countdownValue === null && rematchState !== "rejected" && (
              <>
                {rematchState === "incoming" ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                      className="rounded-full bg-white px-7 py-3 font-semibold text-black transition hover:scale-[1.01]"
                      onClick={acceptRematch}
                    >
                      Accept Rematch
                    </button>
                    <button
                      className="rounded-full border border-zinc-400 px-7 py-3 font-semibold text-white transition hover:border-zinc-200"
                      onClick={rejectRematch}
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                      <button
                        className="rounded-full bg-white px-7 py-3 font-semibold text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={rematchState === "requesting" || rematchState === "accepted"}
                        onClick={requestRematch}
                      >
                        {isComputerMatch
                          ? "Start Next Match"
                          : rematchState === "requesting"
                            ? "Waiting for opponent..."
                            : rematchState === "accepted"
                              ? "Starting rematch..."
                              : "Request Rematch"}
                      </button>
                      <button
                        className="rounded-full border border-zinc-500 px-7 py-3 font-semibold text-white transition hover:border-zinc-300"
                        onClick={requestExitToLobby}
                        type="button"
                      >
                        Home
                      </button>
                    </div>
                    <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                      Same room. Same rival. No code re-entry.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

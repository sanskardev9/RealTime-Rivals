import { useEffect, useMemo, useRef, useState } from "react";
import { useGameState } from "../hooks/useGameState";
import { useControls } from "../hooks/useControls";
import { useWebRTC } from "../hooks/useWebRTC";
import { getAttackBoxWidth, getAttackBoxX } from "../game/collision";
import {
  ATTACK_DURATION,
  BEAM_DAMAGE,
  INPUT_REPEAT_MS,
  MAX_HEALTH,
  PLAYER_WIDTH,
  SPECIAL_HIT_TARGET,
  THROW_DURATION,
  THROW_STUN_MS,
} from "../game/player";
import HealthBar from "./HealthBar";

const ARENA_HEIGHT = 400;
const FLOOR_Y = 350;

const isTargetInFront = (attacker, defender) => {
  const attackerCenter = attacker.x + PLAYER_WIDTH / 2;
  const defenderCenter = defender.x + PLAYER_WIDTH / 2;
  return attacker.direction === "left"
    ? defenderCenter < attackerCenter
    : defenderCenter > attackerCenter;
};

const createBloodBurst = (target, tint, count = 10) => {
  const centerX = target.x + PLAYER_WIDTH / 2;
  const centerY = FLOOR_Y - 40;
  const particles = [];

  for (let index = 0; index < count; index += 1) {
    particles.push({
      x: centerX + (Math.random() * 12 - 6),
      y: centerY + (Math.random() * 10 - 5),
      vx: (Math.random() * 2.8 - 1.4) + (target.direction === "left" ? -0.6 : 0.6),
      vy: -(Math.random() * 2.2 + 0.8),
      radius: 1.8 + Math.random() * 2.4,
      life: 30 + Math.floor(Math.random() * 20),
      tint,
      floorHit: false,
    });
  }

  return particles;
};

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
  if (pose === "thrown") {
    intensity = 0.1;
  }

  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${intensity})`;
  ctx.beginPath();
  ctx.ellipse(
    player.x + PLAYER_WIDTH / 2,
    FLOOR_Y + 8,
    pose === "down" ? 34 : pose === "thrown" ? 18 : 28,
    pose === "down" ? 10 : pose === "thrown" ? 6 : 8,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();
};

const drawChargeCannon = (ctx, palette, time) => {
  const recoil = Math.sin(time / 28) * 1.5;
  const pulse = 0.65 + (Math.sin(time / 42) + 1) * 0.18;
  const plasma = palette.weapon;
  const plasmaLight = palette.weaponGlow;

  ctx.save();
  ctx.translate(2, -7 + recoil);

  // Metallic receiver and barrel housing.
  const metal = ctx.createLinearGradient(-24, -18, 62, 18);
  metal.addColorStop(0, "#090d18");
  metal.addColorStop(0.34, "#6b7280");
  metal.addColorStop(0.5, "#d1d5db");
  metal.addColorStop(0.7, "#374151");
  metal.addColorStop(1, "#080b14");
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.roundRect(-24, -10, 79, 22, 8);
  ctx.fill();
  ctx.strokeStyle = "#020617";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Glass plasma chamber, inspired by the reference weapon's exposed energy cell.
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.roundRect(-6, -16, 34, 21, 6);
  ctx.fill();
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const chamber = ctx.createLinearGradient(-3, -13, 25, 2);
  chamber.addColorStop(0, "#581c87");
  chamber.addColorStop(0.45, plasma);
  chamber.addColorStop(0.7, plasmaLight);
  chamber.addColorStop(1, "#581c87");
  ctx.fillStyle = chamber;
  ctx.globalAlpha = pulse;
  ctx.beginPath();
  ctx.roundRect(-2, -12, 25, 13, 4);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(1, -5);
  ctx.lineTo(20, -5 + Math.sin(time / 30) * 2);
  ctx.stroke();

  // Energy coils wrapped around the barrel.
  ctx.strokeStyle = plasma;
  ctx.shadowColor = plasma;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 3;
  for (let coil = 0; coil < 5; coil += 1) {
    const coilX = 29 + coil * 5;
    ctx.beginPath();
    ctx.ellipse(coilX, 1, 3.3, 13, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Top rail, rear stock, and a pistol grip make the cannon feel held rather than floating.
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.roundRect(-18, -21, 34, 5, 2);
  ctx.fill();
  ctx.fillStyle = "#030712";
  ctx.beginPath();
  ctx.roundRect(-34, 0, 16, 10, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(4, 8, 10, 20, 3);
  ctx.fill();
  ctx.fillStyle = plasma;
  ctx.globalAlpha = pulse;
  ctx.fillRect(7, 12, 3, 11);
  ctx.globalAlpha = 1;

  // Oversized glowing muzzle and emitter ring.
  ctx.fillStyle = "#030712";
  ctx.beginPath();
  ctx.arc(58, 1, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = plasma;
  ctx.shadowColor = plasma;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(58, 1, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = plasmaLight;
  ctx.globalAlpha = pulse;
  ctx.beginPath();
  ctx.arc(58, 1, 4.5 + Math.sin(time / 35), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawFighter = (ctx, player, palette, time, pose = "normal") => {
  const facing = player.direction === "left" ? -1 : 1;
  const centerX = (player.renderX ?? player.x) + PLAYER_WIDTH / 2;
  // The sole line is y=50 in local space, so anchor it exactly to FLOOR_Y.
  const centerY = FLOOR_Y - 50;
  const idleSwing = Math.sin(time / 120) * 1.5;
  const isDown = pose === "down";
  const isThrown = pose === "thrown";
  const isCelebrating = pose === "celebrate";
  const isGunAttacking = player.isAttacking && player.attackWeapon === "gun";
  const isThrowing = player.isThrowing && !isDown && !isCelebrating;
  const isPunching = !isDown && !isCelebrating && (player.isAttacking || player.isSpecialAttacking || player.isThrowing);
  const isWalking = Boolean(player.isWalking) && !isPunching && !isDown && !isThrown && !isCelebrating;
  const walkCycle = player.walkCycle ?? 0;
  const torsoLean = isCelebrating
    ? 0
    : isThrowing
      ? 22
    : player.isSpecialAttacking
      ? 2
      : player.isAttacking
        ? 8
        : 2;
  const leadFistX = isCelebrating
    ? 12
    : isThrowing
      ? 32
    : player.isSpecialAttacking
      ? 36
      : player.isAttacking
        ? 28
        : 12;
  const leadFistY = isCelebrating
    ? -34
    : isThrowing
      ? -8
    : player.isSpecialAttacking
      ? 4
      : player.isAttacking
        ? 2
        : 10;
  const rearFistX = isCelebrating ? -12 : isThrowing ? 22 : player.isSpecialAttacking ? 16 : -10;
  const rearFistY = isCelebrating ? -36 : isThrowing ? -10 : player.isSpecialAttacking ? 9 : 4;
  const kneeBend = isDown ? 10 : isPunching ? 4 : 0;
  const stride = isWalking ? Math.sin(walkCycle) * 10 : 0;
  const rearStride = isWalking ? -stride : 0;

  ctx.save();
  ctx.translate(
    centerX,
    centerY + (isDown ? 40 : isThrown ? -42 : idleSwing) + (player.renderYOffset ?? 0)
  );
  ctx.scale(isCelebrating ? 1 : facing, 1);

  if (isDown) {
    ctx.rotate(Math.PI / 2.35);
  } else if (isThrown) {
    ctx.rotate(-Math.PI / 1.35 + Math.sin(time / 65) * 0.25);
  }

  if (!isDown && player.renderRotation) {
    ctx.rotate(player.renderRotation);
  }

  ctx.rotate((-torsoLean * Math.PI) / 180);

  // Two-joint legs with feet locked on the floor: the old one-line legs made the
  // fighters look as if they were hovering.
  const drawLeg = (hipX, footX, kneeOffset) => {
    const kneeX = (hipX + footX) / 2 + kneeOffset;
    const kneeY = isWalking ? 39 - Math.abs(footX) * 0.12 : 39 + kneeBend;
    ctx.beginPath();
    ctx.moveTo(hipX, 25);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, 50);
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(footX - 3, 50);
    ctx.lineTo(footX + 7, 50);
    ctx.stroke();
    ctx.lineWidth = 6;
  };

  ctx.strokeStyle = palette.limb;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  drawLeg(-8, isDown ? -2 : -12 + rearStride, isDown ? 0 : -4);
  drawLeg(8, isDown ? 18 : 12 + stride, isDown ? 0 : 4);

  if (player.isSpecialAttacking && !isDown && !isCelebrating) {
    drawChargeCannon(ctx, palette, time);
  }

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

  if (isGunAttacking && !isDown && !isCelebrating) {
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.roundRect(leadFistX - 2, leadFistY - 4, 20, 8, 3);
    ctx.fill();
    ctx.fillRect(leadFistX + 2, leadFistY + 3, 5, 8);
  }

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

  if (isThrowing) {
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(22, 2, 16, Math.PI * 0.1, Math.PI * 1.35);
    ctx.stroke();
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

const drawGunShot = (ctx, player, target, color, nowMs) => {
  const width = getAttackBoxWidth(player);
  const x = getAttackBoxX(player);
  // Match the projectile to the small pistol's muzzle (the old line was near
  // the fighter's waist, making bullets appear below the weapon).
  const y = FLOOR_Y - 60;
  const movingLeft = player.direction === "left";
  const startX = movingLeft ? x + width : x;
  let endX = movingLeft ? x : x + width;
  const canHitTarget = target && isTargetInFront(player, target);

  if (canHitTarget) {
    endX = target.x + PLAYER_WIDTH / 2;
  }

  const startedAt = player.attackStartedAt ?? nowMs;
  const progress = Math.max(0, Math.min(1, (nowMs - startedAt) / ATTACK_DURATION));
  const bulletX = startX + (endX - startX) * progress;
  const tailDirection = movingLeft ? 1 : -1;
  const tailLength = 26;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(startX, y + 10);
  ctx.lineTo(endX, y + 10);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(255, 251, 220, 0.52)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, y + 10);
  ctx.lineTo(bulletX, y + 10);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(bulletX + tailLength * tailDirection, y + 10);
  ctx.lineTo(bulletX, y + 10);
  ctx.stroke();

  ctx.fillStyle = "#fffde7";
  ctx.beginPath();
  ctx.arc(bulletX, y + 10, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 240, 170, 0.9)";
  ctx.beginPath();
  ctx.arc(startX, y + 10, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

const drawBeam = (ctx, player, beamColor, coreColor, time) => {
  const direction = player.direction === "left" ? -1 : 1;
  // Match the charge cannon's transformed muzzle: local x=58, 2px cannon
  // offset, and a 13px emitter ring. This is deliberately separate from the
  // collision box, whose start is the fighter edge rather than the gun tip.
  const muzzleX = Math.max(
    0,
    Math.min(800, player.x + PLAYER_WIDTH / 2 + direction * 73)
  );
  const beamEndX = Math.max(0, Math.min(800, muzzleX + direction * 180));
  const x = Math.min(muzzleX, beamEndX);
  const width = Math.abs(beamEndX - muzzleX);
  const beamHeight = 18 + Math.sin(time / 40) * 2;
  const muzzleY = FLOOR_Y - 57;
  const y = muzzleY - beamHeight / 2;

  ctx.save();
  ctx.shadowColor = beamColor;
  ctx.shadowBlur = 26;

  const beamGradient = ctx.createLinearGradient(muzzleX, 0, beamEndX, 0);
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

  // Hide the join with a bright muzzle flare so the beam visibly originates
  // inside the cannon's emitter ring.
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.arc(muzzleX, muzzleY, 5 + Math.sin(time / 32), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

const drawThrowImpact = (ctx, thrower, color, time) => {
  const movingLeft = thrower.direction === "left";
  const impactX = thrower.x + PLAYER_WIDTH / 2 + (movingLeft ? -34 : 34);
  const impactY = FLOOR_Y - 8;
  const ring = 12 + (Math.sin(time / 80) + 1) * 5;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(impactX, impactY, ring, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(impactX, impactY, ring + 11, 0, Math.PI * 2);
  ctx.stroke();
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
  const bloodParticlesRef = useRef([]);
  const bloodStainsRef = useRef([]);
  const fighterMotionRef = useRef({});
  const previousPlayerHealthRef = useRef(MAX_HEALTH);
  const previousOpponentHealthRef = useRef(MAX_HEALTH);
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
        body: "Quick gun shot. Great for pressure and building charge.",
      },
      {
        label: "Beam",
        value: "Q or mobile Beam",
        body: "Your special attack unlocks once the charge meter is full.",
      },
      {
        label: "Throw",
        value: "E or mobile Throw",
        body: "Close-range takedown that hits hard. Best used when you step into your opponent.",
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

  const handleTouchThrow = () => {
    handleInput("throw");
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
    if (player.health < previousPlayerHealthRef.current) {
      bloodParticlesRef.current.push(...createBloodBurst(player, "rgba(220, 38, 38, 0.82)", 18));
    }

    if (opponent.health < previousOpponentHealthRef.current) {
      bloodParticlesRef.current.push(...createBloodBurst(opponent, "rgba(185, 28, 28, 0.82)", 18));
    }

    previousPlayerHealthRef.current = player.health;
    previousOpponentHealthRef.current = opponent.health;
  }, [opponent, player]);

  useEffect(() => {
    if (gameStatus === "playing" && player.health === MAX_HEALTH && opponent.health === MAX_HEALTH) {
      bloodParticlesRef.current = [];
      bloodStainsRef.current = [];
    }
  }, [gameStatus, opponent.health, player.health]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let previousFrameTime = 0;

    const getFighterMotion = (key, fighter, time) => {
      const previous = fighterMotionRef.current[key] ?? {
        lastX: fighter.x,
        speed: 0,
        walkCycle: 0,
      };
      const frameMs = previousFrameTime ? Math.min(50, time - previousFrameTime) : 16;
      const distanceMoved = Math.abs(fighter.x - previous.lastX);
      const speed = distanceMoved > 0.05
        ? Math.min(1, distanceMoved / 3.5)
        : Math.max(0, previous.speed - frameMs / 150);
      const next = {
        lastX: fighter.x,
        speed,
        walkCycle: previous.walkCycle + frameMs * (0.007 + speed * 0.024),
      };
      fighterMotionRef.current[key] = next;

      return {
        isWalking: speed > 0.08,
        walkCycle: next.walkCycle,
      };
    };

    const loop = (time = 0) => {
      const pulse = (Math.sin(time / 700) + 1) / 2;
      const now = Date.now();

      const currentPlayer = playerRef.current;
      const currentOpponent = opponentRef.current;

      if (!currentPlayer || !currentOpponent) return;

      const playerMotion = getFighterMotion("player", currentPlayer, time);
      const opponentMotion = getFighterMotion("opponent", currentOpponent, time);
      previousFrameTime = time;

      const playerPose =
        currentPlayer.health <= 0 && currentOpponent.health <= 0
          ? "down"
          : currentPlayer.throwStunUntil > now
            ? currentPlayer.throwStunUntil - now > THROW_STUN_MS * 0.42
              ? "thrown"
              : "down"
          : currentPlayer.health <= 0
            ? "down"
            : currentOpponent.health <= 0
              ? "celebrate"
              : "normal";
      const opponentPose =
        currentPlayer.health <= 0 && currentOpponent.health <= 0
          ? "down"
          : currentOpponent.throwStunUntil > now
            ? currentOpponent.throwStunUntil - now > THROW_STUN_MS * 0.42
              ? "thrown"
              : "down"
          : currentOpponent.health <= 0
            ? "down"
            : currentPlayer.health <= 0
              ? "celebrate"
              : "normal";

      ctx.clearRect(0, 0, 800, ARENA_HEIGHT);
      drawStage(ctx, pulse);
      let renderPlayer = { ...currentPlayer, ...playerMotion };
      let renderOpponent = { ...currentOpponent, ...opponentMotion };
      let renderPlayerPose = playerPose;
      let renderOpponentPose = opponentPose;
      const lerp = (start, end, t) => start + (end - start) * t;

      if (currentPlayer.isThrowing && currentOpponent.throwStunUntil > now) {
        const throwProgress = Math.max(
          0,
          Math.min(1, (now - (currentPlayer.attackStartedAt ?? now)) / THROW_DURATION)
        );
        const facingDir = currentPlayer.direction === "left" ? -1 : 1;

        if (throwProgress < 0.18) {
          const rushT = throwProgress / 0.18;
          renderPlayer = {
            ...currentPlayer,
            renderX: currentPlayer.x + facingDir * lerp(0, 16, rushT),
            renderYOffset: lerp(0, 8, rushT),
            renderRotation: facingDir * lerp(0, 0.08, rushT),
          };
          renderOpponentPose = "normal";
        } else if (throwProgress < 0.5) {
          const carryT = (throwProgress - 0.18) / 0.32;
          renderPlayer = {
            ...currentPlayer,
            renderX: currentPlayer.x + facingDir * lerp(16, 20, carryT),
            renderYOffset: lerp(8, -2, carryT),
            renderRotation: facingDir * lerp(0.08, -0.08, carryT),
          };
          renderOpponent = {
            ...currentOpponent,
            renderX: currentPlayer.x + facingDir * lerp(23, 28, carryT),
            renderYOffset: lerp(2, -10, carryT),
            renderRotation: facingDir * lerp(-0.08, -0.28, carryT),
          };
          renderOpponentPose = "thrown";
        } else {
          const launchT = (throwProgress - 0.5) / 0.5;
          const travelT = 1 - (1 - launchT) ** 3;
          renderPlayer = {
            ...currentPlayer,
            renderX: currentPlayer.x + facingDir * lerp(20, 8, launchT),
            renderYOffset: lerp(-2, 3, launchT),
            renderRotation: facingDir * lerp(-0.08, 0.04, launchT),
          };
          renderOpponent = {
            ...currentOpponent,
            renderX: lerp(currentPlayer.x + facingDir * 28, currentOpponent.x, travelT),
            renderYOffset: -Math.sin(launchT * Math.PI) * 92,
            renderRotation: facingDir * lerp(-0.28, Math.PI * 2.4, launchT),
          };
          renderOpponentPose = launchT > 0.88 ? "down" : "thrown";
        }
      } else if (currentOpponent.isThrowing && currentPlayer.throwStunUntil > now) {
        const throwProgress = Math.max(
          0,
          Math.min(1, (now - (currentOpponent.attackStartedAt ?? now)) / THROW_DURATION)
        );
        const facingDir = currentOpponent.direction === "left" ? -1 : 1;

        if (throwProgress < 0.18) {
          const rushT = throwProgress / 0.18;
          renderOpponent = {
            ...currentOpponent,
            renderX: currentOpponent.x + facingDir * lerp(0, 16, rushT),
            renderYOffset: lerp(0, 8, rushT),
            renderRotation: facingDir * lerp(0, 0.08, rushT),
          };
          renderPlayerPose = "normal";
        } else if (throwProgress < 0.5) {
          const carryT = (throwProgress - 0.18) / 0.32;
          renderOpponent = {
            ...currentOpponent,
            renderX: currentOpponent.x + facingDir * lerp(16, 20, carryT),
            renderYOffset: lerp(8, -2, carryT),
            renderRotation: facingDir * lerp(0.08, -0.08, carryT),
          };
          renderPlayer = {
            ...currentPlayer,
            renderX: currentOpponent.x + facingDir * lerp(23, 28, carryT),
            renderYOffset: lerp(2, -10, carryT),
            renderRotation: facingDir * lerp(-0.08, -0.28, carryT),
          };
          renderPlayerPose = "thrown";
        } else {
          const launchT = (throwProgress - 0.5) / 0.5;
          const travelT = 1 - (1 - launchT) ** 3;
          renderOpponent = {
            ...currentOpponent,
            renderX: currentOpponent.x + facingDir * lerp(20, 8, launchT),
            renderYOffset: lerp(-2, 3, launchT),
            renderRotation: facingDir * lerp(-0.08, 0.04, launchT),
          };
          renderPlayer = {
            ...currentPlayer,
            renderX: lerp(currentOpponent.x + facingDir * 28, currentPlayer.x, travelT),
            renderYOffset: -Math.sin(launchT * Math.PI) * 92,
            renderRotation: facingDir * lerp(-0.28, Math.PI * 2.4, launchT),
          };
          renderPlayerPose = launchT > 0.88 ? "down" : "thrown";
        }
      }

      drawShadow(ctx, renderPlayer, 0.18, renderPlayerPose);
      drawShadow(ctx, renderOpponent, 0.18, renderOpponentPose);

      if (currentPlayer.isSpecialAttacking && renderPlayerPose === "normal") {
        drawBeam(ctx, currentPlayer, "#a855f7", "#e9d5ff", time);
      } else if (currentPlayer.isThrowing && renderPlayerPose === "normal") {
        drawThrowImpact(ctx, currentPlayer, "#fca5a5", time);
      } else if (currentPlayer.isAttacking && renderPlayerPose === "normal") {
        if (currentPlayer.attackWeapon === "gun") {
          drawGunShot(ctx, currentPlayer, currentOpponent, "#fde047", now);
        } else {
          drawAttackSlash(ctx, currentPlayer, "#fde047");
        }
      }

      if (currentOpponent.isSpecialAttacking && renderOpponentPose === "normal") {
        drawBeam(ctx, currentOpponent, "#f97316", "#fdba74", time + 60);
      } else if (currentOpponent.isThrowing && renderOpponentPose === "normal") {
        drawThrowImpact(ctx, currentOpponent, "#fb7185", time + 45);
      } else if (currentOpponent.isAttacking && renderOpponentPose === "normal") {
        if (currentOpponent.attackWeapon === "gun") {
          drawGunShot(ctx, currentOpponent, currentPlayer, "#fb923c", now);
        } else {
          drawAttackSlash(ctx, currentOpponent, "#fb923c");
        }
      }

      bloodParticlesRef.current = bloodParticlesRef.current
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vy: particle.vy + 0.14,
          life: particle.life - 1,
          radius: Math.max(0.4, particle.radius * 0.97),
        }))
        .filter((particle) => {
          if (particle.y >= FLOOR_Y - 2 && !particle.floorHit) {
            particle.floorHit = true;
            bloodStainsRef.current.push({
              x: particle.x,
              y: FLOOR_Y + (Math.random() * 8 - 2),
              radius: Math.max(2, particle.radius * 2.8),
              alpha: 0.5 + Math.random() * 0.25,
              tint: particle.tint,
            });
          }

          return particle.life > 0;
        });

      bloodStainsRef.current = bloodStainsRef.current
        .map((stain) => ({
          ...stain,
          alpha: Math.max(0.1, stain.alpha - 0.0008),
        }))
        .slice(-240);

      for (const stain of bloodStainsRef.current) {
        ctx.fillStyle = stain.tint.replace(/[\d.]+\)$/, `${stain.alpha})`);
        ctx.beginPath();
        ctx.ellipse(stain.x, stain.y, stain.radius * 1.7, stain.radius, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const particle of bloodParticlesRef.current) {
        ctx.fillStyle = particle.tint;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      drawFighter(
        ctx,
        renderPlayer,
        {
          accent: "#93c5fd",
          body: "#1d4ed8",
          glow: "rgba(147, 197, 253, 0.45)",
          hair: "#0f172a",
          limb: "#cbd5e1",
          skin: "#f1c27d",
          weapon: "#2563eb",
          weaponGlow: "#67e8f9",
        },
        time,
        renderPlayerPose
      );
      drawFighter(
        ctx,
        renderOpponent,
        {
          accent: "#fdba74",
          body: "#b91c1c",
          glow: "rgba(251, 146, 60, 0.42)",
          hair: "#3f1d0f",
          limb: "#fecaca",
          skin: "#e0ac69",
          weapon: "#dc2626",
          weaponGlow: "#fbbf24",
        },
        time + 90,
        renderOpponentPose
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
        <HealthBar color="blue" health={player.health} label={playerName} maxHealth={MAX_HEALTH} />
        <HealthBar color="red" health={opponent.health} label={opponentName} maxHealth={MAX_HEALTH} />
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
          <p>
            {player.specialReady
              ? `Beam ready`
              : `${player.hitCount}/${SPECIAL_HIT_TARGET} bullet hits`}
          </p>
          <ChargeMeter
            charge={player.hitCount}
            ready={player.specialReady}
            tint="linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)"
          />
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Opp. Charge</p>
          <p>
            {opponent.specialReady
              ? `Beam ready. `
              : `${opponent.hitCount}/${SPECIAL_HIT_TARGET} bullet hits`}
          </p>
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

      <div className="mt-2 grid w-full max-w-[800px] grid-cols-5 gap-2 sm:hidden">
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
          className={`${controlButtonClass} border-rose-400 bg-rose-950 text-rose-100`}
          onPointerDown={(event) => {
            event.preventDefault();
            handleTouchThrow();
          }}
        >
          Throw
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
                className="rounded-full cursor-pointer whitespace-nowrap border border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition hover:border-zinc-400 sm:px-4 sm:py-2 sm:text-sm"
                onClick={closeTutorial}
                type="button"
              >
                Ready to fight
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

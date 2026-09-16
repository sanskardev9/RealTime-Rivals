const PLAYER_WIDTH = 50;
const ARENA_WIDTH = 800;
const MAX_HEALTH = 150;
const MOVE_SPEED = 4;
const INPUT_REPEAT_MS = 45;
const ATTACK_DURATION = 200;
const THROW_DURATION = 560;
const SPECIAL_ATTACK_DURATION = 300;
const THROW_STUN_MS = 660;
const BULLET_DAMAGE = 2;
const BULLETS_PER_BEAM = 6;
const BEAM_DAMAGE = BULLET_DAMAGE * BULLETS_PER_BEAM;
const SPECIAL_HIT_TARGET = BULLETS_PER_BEAM;
const SPECIAL_HIT_REWARD = 1;

export const createPlayer = ({
  x,
  health = MAX_HEALTH,
  isAttacking = false,
  isSpecialAttacking = false,
  isThrowing = false,
  attackWeapon = "gun",
  attackStartedAt = null,
  throwStunUntil = 0,
  direction = "right",
  hitCount = 0,
  specialReady = false,
} = {}) => ({
  x,
  health,
  isAttacking,
  isSpecialAttacking,
  isThrowing,
  attackWeapon,
  attackStartedAt,
  throwStunUntil,
  direction,
  hitCount,
  specialReady,
});

export const movePlayer = (currentPlayer, input) => {
  if (currentPlayer.throwStunUntil && currentPlayer.throwStunUntil > Date.now()) {
    return currentPlayer;
  }

  const updatedPlayer = { ...currentPlayer };

  if (input === "right") {
    updatedPlayer.x += MOVE_SPEED;
    updatedPlayer.direction = "right";
  }

  if (input === "left") {
    updatedPlayer.x -= MOVE_SPEED;
    updatedPlayer.direction = "left";
  }

  updatedPlayer.x = Math.max(0, Math.min(ARENA_WIDTH - PLAYER_WIDTH, updatedPlayer.x));

  return updatedPlayer;
};

export const startAttack = (currentPlayer, attackWeapon = "gun") => ({
  ...currentPlayer,
  isAttacking: true,
  attackWeapon,
  attackStartedAt: Date.now(),
});

export const endAttack = (currentPlayer) => ({
  ...currentPlayer,
  isAttacking: false,
  isSpecialAttacking: false,
  isThrowing: false,
  attackWeapon: "gun",
  attackStartedAt: null,
});

export const startThrow = (currentPlayer) => ({
  ...currentPlayer,
  isAttacking: false,
  isSpecialAttacking: false,
  isThrowing: true,
  attackStartedAt: Date.now(),
});

export const startSpecialAttack = (currentPlayer) => ({
  ...currentPlayer,
  isAttacking: false,
  isSpecialAttacking: true,
  isThrowing: false,
  attackStartedAt: null,
  specialReady: false,
  hitCount: 0,
});

export const applyThrowLaunch = (defender, throwDirection, distance = 250) => {
  let finalDirection = throwDirection;

  const isAtRightEnd = defender.x >= ARENA_WIDTH - PLAYER_WIDTH - 10;
  const isAtLeftEnd = defender.x <= 10;

  if ((isAtRightEnd && throwDirection === "right") || (isAtLeftEnd && throwDirection === "left")) {
    finalDirection = throwDirection === "right" ? "left" : "right";
  }

  const directionOffset = finalDirection === "left" ? -distance : distance;
  const launchedX = Math.max(0, Math.min(ARENA_WIDTH - PLAYER_WIDTH, defender.x + directionOffset));

  return {
    ...defender,
    x: launchedX,
    throwStunUntil: Date.now() + THROW_STUN_MS,
  };
};

export const registerHit = (currentPlayer) => {
  const nextHitCount = currentPlayer.hitCount + SPECIAL_HIT_REWARD;

  if (nextHitCount >= SPECIAL_HIT_TARGET) {
    return {
      ...currentPlayer,
      hitCount: SPECIAL_HIT_TARGET,
      specialReady: true,
    };
  }

  return {
    ...currentPlayer,
    hitCount: nextHitCount,
  };
};

export const clampHealth = (health) => Math.max(0, Math.min(MAX_HEALTH, health));

export const mirrorPlayerX = (x) => ARENA_WIDTH - PLAYER_WIDTH - x;

export const flipDirection = (direction) =>
  direction === "left" ? "right" : "left";

export {
  ARENA_WIDTH,
  ATTACK_DURATION,
  INPUT_REPEAT_MS,
  MAX_HEALTH,
  PLAYER_WIDTH,
  THROW_DURATION,
  THROW_STUN_MS,
  SPECIAL_ATTACK_DURATION,
  SPECIAL_HIT_TARGET,
  SPECIAL_HIT_REWARD,
  BULLET_DAMAGE,
  BULLETS_PER_BEAM,
  BEAM_DAMAGE,
};

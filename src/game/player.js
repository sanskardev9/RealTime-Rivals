const PLAYER_WIDTH = 50;
const ARENA_WIDTH = 800;
const MOVE_SPEED = 4;
const INPUT_REPEAT_MS = 45;
const ATTACK_DURATION = 200;
const SPECIAL_ATTACK_DURATION = 300;
const SPECIAL_HIT_TARGET = 10;

export const createPlayer = ({
  x,
  health = 100,
  isAttacking = false,
  isSpecialAttacking = false,
  direction = "right",
  hitCount = 0,
  specialReady = false,
} = {}) => ({
  x,
  health,
  isAttacking,
  isSpecialAttacking,
  direction,
  hitCount,
  specialReady,
});

export const movePlayer = (currentPlayer, input) => {
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

export const startAttack = (currentPlayer) => ({
  ...currentPlayer,
  isAttacking: true,
});

export const endAttack = (currentPlayer) => ({
  ...currentPlayer,
  isAttacking: false,
  isSpecialAttacking: false,
});

export const startSpecialAttack = (currentPlayer) => ({
  ...currentPlayer,
  isAttacking: false,
  isSpecialAttacking: true,
  specialReady: false,
  hitCount: 0,
});

export const registerHit = (currentPlayer) => {
  const nextHitCount = currentPlayer.hitCount + 1;

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

export const clampHealth = (health) => Math.max(0, Math.min(100, health));

export const mirrorPlayerX = (x) => ARENA_WIDTH - PLAYER_WIDTH - x;

export const flipDirection = (direction) =>
  direction === "left" ? "right" : "left";

export {
  ARENA_WIDTH,
  ATTACK_DURATION,
  INPUT_REPEAT_MS,
  PLAYER_WIDTH,
  SPECIAL_ATTACK_DURATION,
  SPECIAL_HIT_TARGET,
};

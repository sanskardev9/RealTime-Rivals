const PLAYER_WIDTH = 50;
const ARENA_WIDTH = 800;
const MOVE_SPEED = 4;
const ATTACK_DURATION = 200;

export const createPlayer = ({
  x,
  health = 100,
  isAttacking = false,
  direction = "right",
} = {}) => ({
  x,
  health,
  isAttacking,
  direction,
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
});

export const clampHealth = (health) => Math.max(0, Math.min(100, health));

export const mirrorPlayerX = (x) => ARENA_WIDTH - PLAYER_WIDTH - x;

export const flipDirection = (direction) =>
  direction === "left" ? "right" : "left";

export { ARENA_WIDTH, ATTACK_DURATION, PLAYER_WIDTH };

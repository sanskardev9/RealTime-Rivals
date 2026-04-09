import { clampHealth, PLAYER_WIDTH } from "./player";

const ATTACK_RANGE = 60;
const ATTACK_DAMAGE = 1;

export const checkHit = (attacker, defender) =>
  Math.abs(attacker.x - defender.x) < ATTACK_RANGE;

export const applyAttackDamage = (attacker, defender) => {
  if (!attacker.isAttacking || !checkHit(attacker, defender)) {
    return defender;
  }

  return {
    ...defender,
    health: clampHealth(defender.health - ATTACK_DAMAGE),
  };
};

export const getAttackBoxX = (player) =>
  player.direction === "left" ? player.x - 20 : player.x + PLAYER_WIDTH;

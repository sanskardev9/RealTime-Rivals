import { clampHealth, PLAYER_WIDTH } from "./player";

const ATTACK_RANGE = 60;
const ATTACK_DAMAGE = 2;
const SPECIAL_ATTACK_RANGE = 220;
const SPECIAL_ATTACK_DAMAGE = 12;

export const checkHit = (attacker, defender, range = ATTACK_RANGE) =>
  Math.abs(attacker.x - defender.x) < range;

export const applyAttackDamage = (attacker, defender) => {
  if (!attacker.isAttacking || !checkHit(attacker, defender)) {
    return defender;
  }

  return {
    ...defender,
    health: clampHealth(defender.health - ATTACK_DAMAGE),
  };
};

export const applySpecialAttackDamage = (attacker, defender) => {
  if (!attacker.isSpecialAttacking || !checkHit(attacker, defender, SPECIAL_ATTACK_RANGE)) {
    return defender;
  }

  return {
    ...defender,
    health: clampHealth(defender.health - SPECIAL_ATTACK_DAMAGE),
  };
};

export const getAttackBoxX = (player) =>
  player.direction === "left"
    ? player.x - getAttackBoxWidth(player)
    : player.x + PLAYER_WIDTH;

export const getAttackBoxWidth = (player) => (player.isSpecialAttacking ? 180 : 20);

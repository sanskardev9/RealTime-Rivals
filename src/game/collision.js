import { ARENA_WIDTH, BEAM_DAMAGE, BULLET_DAMAGE, clampHealth, PLAYER_WIDTH } from "./player";

const ATTACK_RANGE = 60;
const ATTACK_DAMAGE = 2;
const THROW_RANGE = 70;
const THROW_DAMAGE = 16;
const SPECIAL_ATTACK_RANGE = 220;

export const checkHit = (attacker, defender, range = ATTACK_RANGE) =>
  Math.abs(attacker.x - defender.x) < range;

export const applyAttackDamage = (attacker, defender) => {
  if (!attacker.isAttacking) {
    return defender;
  }

  const isGunAttack = attacker.attackWeapon === "gun";
  if (isGunAttack) {
    const attackerCenter = attacker.x + PLAYER_WIDTH / 2;
    const defenderCenter = defender.x + PLAYER_WIDTH / 2;
    const isFacingTarget =
      attacker.direction === "left"
        ? defenderCenter < attackerCenter
        : defenderCenter > attackerCenter;

    if (!isFacingTarget) {
      return defender;
    }
  } else if (!checkHit(attacker, defender, ATTACK_RANGE)) {
    return defender;
  }

  return {
    ...defender,
    health: clampHealth(defender.health - (isGunAttack ? BULLET_DAMAGE : ATTACK_DAMAGE)),
  };
};

export const applySpecialAttackDamage = (attacker, defender) => {
  if (!attacker.isSpecialAttacking || !checkHit(attacker, defender, SPECIAL_ATTACK_RANGE)) {
    return defender;
  }

  return {
    ...defender,
    health: clampHealth(defender.health - BEAM_DAMAGE),
  };
};

export const applyThrowDamage = (attacker, defender) => {
  if (!attacker.isThrowing) {
    return defender;
  }

  const attackerCenter = attacker.x + PLAYER_WIDTH / 2;
  const defenderCenter = defender.x + PLAYER_WIDTH / 2;
  const isFacingTarget =
    attacker.direction === "left"
      ? defenderCenter < attackerCenter
      : defenderCenter > attackerCenter;

  if (!isFacingTarget) {
    return defender;
  }

  if (!checkHit(attacker, defender, THROW_RANGE)) {
    return defender;
  }

  return {
    ...defender,
    health: clampHealth(defender.health - THROW_DAMAGE),
  };
};

export const getAttackBoxX = (player) =>
  player.direction === "left"
    ? player.x - getAttackBoxWidth(player)
    : player.x + PLAYER_WIDTH;

export const getAttackBoxWidth = (player) => {
  if (player.isSpecialAttacking) {
    return 180;
  }

  if (player.attackWeapon === "gun") {
    return player.direction === "left"
      ? Math.max(0, player.x)
      : Math.max(0, ARENA_WIDTH - (player.x + PLAYER_WIDTH));
  }

  return 20;
};

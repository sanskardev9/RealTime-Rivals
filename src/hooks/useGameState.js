import { useEffect, useRef, useState } from "react";
import { applyAttackDamage, applySpecialAttackDamage, applyThrowDamage } from "../game/collision";
import {
  ATTACK_DURATION,
  PLAYER_WIDTH,
  THROW_DURATION,
  applyThrowLaunch,
  createPlayer,
  endAttack,
  flipDirection,
  mirrorPlayerX,
  movePlayer,
  registerHit,
  SPECIAL_ATTACK_DURATION,
  startAttack,
  startThrow,
  startSpecialAttack,
} from "../game/player";

const mirrorPlayerState = (player) => ({
  ...player,
  x: mirrorPlayerX(player.x),
  direction: flipDirection(player.direction),
});

const invertMovementInput = (input) => {
  if (input === "left") {
    return "right";
  }

  if (input === "right") {
    return "left";
  }

  return input;
};

const createInitialPlayerState = () => createPlayer({ x: 100 });
const createInitialOpponentState = () =>
  createPlayer({ x: 600, direction: "left" });

const BOT_PROFILES = {
  easy: {
    attackChance: 0.45,
    throwChance: 0.14,
    specialChance: 0.2,
    farAttackChance: 0.2,
    preferredDistance: 170,
    retreatDistance: 120,
    strafeChance: 0.18,
    movementSteps: 1,
    tickMs: 420,
  },
  medium: {
    attackChance: 0.72,
    throwChance: 0.22,
    specialChance: 0.45,
    farAttackChance: 0.45,
    preferredDistance: 250,
    retreatDistance: 120,
    strafeChance: 0.26,
    movementSteps: 2,
    tickMs: 250,
  },
  hard: {
    attackChance: 0.97,
    throwChance: 0.46,
    specialChance: 0.8,
    farAttackChance: 0.86,
    preferredDistance: 190,
    retreatDistance: 96,
    strafeChance: 0.35,
    movementSteps: 3,
    tickMs: 150,
  },
};

export const useGameState = (isHost, options = {}) => {
  const { difficulty = "medium", opponentMode = "remote", paused = false } = options;
  const isComputerOpponent = opponentMode === "computer";
  const [player, setPlayer] = useState(createInitialPlayerState);
  const [opponent, setOpponent] = useState(createInitialOpponentState);
  const [gameStatus, setGameStatus] = useState("playing");
  const isStunned = (fighter) => fighter.throwStunUntil && fighter.throwStunUntil > Date.now();

  const playerAttackTimeoutRef = useRef(null);
  const opponentAttackTimeoutRef = useRef(null);
  const playerRef = useRef(createInitialPlayerState());
  const opponentRef = useRef(createInitialOpponentState());
  const gameStatusRef = useRef("playing");
  const pausedRef = useRef(paused);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    opponentRef.current = opponent;
  }, [opponent]);

  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    return () => {
      if (playerAttackTimeoutRef.current) {
        clearTimeout(playerAttackTimeoutRef.current);
      }

      if (opponentAttackTimeoutRef.current) {
        clearTimeout(opponentAttackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (player.health <= 0 && opponent.health <= 0) {
      setGameStatus("tie");
      return;
    }

    if (player.health <= 0) {
      setGameStatus("opponentWon");
      return;
    }

    if (opponent.health <= 0) {
      setGameStatus("playerWon");
      return;
    }

    if (player.health > 0 && opponent.health > 0) {
      setGameStatus("playing");
    }
  }, [player.health, opponent.health]);

  const queueAttackEnd = (target, timeoutRef, duration = ATTACK_DURATION) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      target((currentCharacter) => endAttack(currentCharacter));
    }, duration);
  };

  const resolveDamage = (attacker, defender, damageFn) => {
    const damagedDefender = damageFn(attacker, defender);
    const didLandHit = damagedDefender.health !== defender.health;

    return {
      damagedDefender,
      didLandHit,
    };
  };

  const resolveThrow = (attacker, defender) => {
    const damagedDefender = applyThrowDamage(attacker, defender);
    const didLandHit = damagedDefender.health !== defender.health;

    return {
      damagedDefender: didLandHit
        ? applyThrowLaunch(damagedDefender, attacker.direction)
        : damagedDefender,
      didLandHit,
    };
  };

  const runOpponentInput = (
    input,
    { invertMovement = false, facePlayer = false, movementSteps = 1 } = {}
  ) => {
    if (pausedRef.current || gameStatusRef.current !== "playing") {
      return;
    }

    if (input === "attack") {
      if (isStunned(opponentRef.current)) {
        return;
      }

      if (
        opponentRef.current.isAttacking ||
        opponentRef.current.isSpecialAttacking ||
        opponentRef.current.isThrowing
      ) {
        return;
      }

      const attackingOpponent = startAttack(opponentRef.current, "gun");
      const { damagedDefender, didLandHit } = resolveDamage(
        attackingOpponent,
        playerRef.current,
        applyAttackDamage
      );
      const updatedOpponent = didLandHit
        ? registerHit(attackingOpponent)
        : attackingOpponent;

      setPlayer(damagedDefender);
      setOpponent(updatedOpponent);

      queueAttackEnd(setOpponent, opponentAttackTimeoutRef);
      return;
    }

    if (input === "specialAttack") {
      if (isStunned(opponentRef.current)) {
        return;
      }

      if (!opponentRef.current.specialReady) {
        return;
      }

      const specialAttacker = startSpecialAttack(opponentRef.current);

      setPlayer(
        resolveDamage(specialAttacker, playerRef.current, applySpecialAttackDamage)
          .damagedDefender
      );
      setOpponent(specialAttacker);

      queueAttackEnd(setOpponent, opponentAttackTimeoutRef, SPECIAL_ATTACK_DURATION);
      return;
    }

    if (input === "throw") {
      if (isStunned(opponentRef.current)) {
        return;
      }

      if (
        opponentRef.current.isAttacking ||
        opponentRef.current.isSpecialAttacking ||
        opponentRef.current.isThrowing
      ) {
        return;
      }

      const throwingOpponent = startThrow(opponentRef.current);
      const { damagedDefender } = resolveThrow(throwingOpponent, playerRef.current);

      setPlayer(damagedDefender);
      setOpponent(throwingOpponent);

      queueAttackEnd(setOpponent, opponentAttackTimeoutRef, THROW_DURATION);
      return;
    }

    const movementInput = invertMovement ? invertMovementInput(input) : input;
    setOpponent((currentOpponent) => {
      let movedOpponent = currentOpponent;
      for (let step = 0; step < movementSteps; step += 1) {
        movedOpponent = movePlayer(movedOpponent, movementInput);
      }

      // The computer can retreat without blindly turning its back. This keeps its
      // weapon and throw direction trained on the player while it creates space.
      if (!facePlayer) {
        return movedOpponent;
      }

      const playerCenter = playerRef.current.x + PLAYER_WIDTH / 2;
      const opponentCenter = movedOpponent.x + PLAYER_WIDTH / 2;
      return {
        ...movedOpponent,
        direction: playerCenter < opponentCenter ? "left" : "right",
      };
    });
  };

  const updatePlayer = (input) => {
    if (pausedRef.current || gameStatusRef.current !== "playing") {
      return;
    }

    if (input === "attack") {
      if (isStunned(playerRef.current)) {
        return;
      }

      if (
        playerRef.current.isAttacking ||
        playerRef.current.isSpecialAttacking ||
        playerRef.current.isThrowing
      ) {
        return;
      }

      const attackingPlayer = startAttack(playerRef.current, "gun");

      if (isHost) {
        const { damagedDefender, didLandHit } = resolveDamage(
          attackingPlayer,
          opponentRef.current,
          applyAttackDamage
        );

        const updatedPlayer = didLandHit
          ? registerHit(attackingPlayer)
          : attackingPlayer;

        setPlayer(updatedPlayer);
        setOpponent(damagedDefender);
      } else {
        setPlayer(attackingPlayer);
      }

      queueAttackEnd(setPlayer, playerAttackTimeoutRef);
      return;
    }

    if (input === "specialAttack") {
      if (isStunned(playerRef.current)) {
        return;
      }

      if (!playerRef.current.specialReady) {
        return;
      }

      const specialAttacker = startSpecialAttack(playerRef.current);

      if (isHost) {
        setOpponent(
          resolveDamage(specialAttacker, opponentRef.current, applySpecialAttackDamage)
            .damagedDefender
        );
      }

      setPlayer(specialAttacker);

      queueAttackEnd(setPlayer, playerAttackTimeoutRef, SPECIAL_ATTACK_DURATION);
      return;
    }

    if (input === "throw") {
      if (isStunned(playerRef.current)) {
        return;
      }

      if (
        playerRef.current.isAttacking ||
        playerRef.current.isSpecialAttacking ||
        playerRef.current.isThrowing
      ) {
        return;
      }

      const throwingPlayer = startThrow(playerRef.current);

      if (isHost) {
        const { damagedDefender } = resolveThrow(throwingPlayer, opponentRef.current);

        setPlayer(throwingPlayer);
        setOpponent(damagedDefender);
      } else {
        setPlayer(throwingPlayer);
      }

      queueAttackEnd(setPlayer, playerAttackTimeoutRef, THROW_DURATION);
      return;
    }

    setPlayer((currentPlayer) => movePlayer(currentPlayer, input));
  };

  const applyRemoteInput = (input) => {
    if (!isHost) {
      return;
    }

    runOpponentInput(input, { invertMovement: true });
  };

  const syncHostState = (state) => {
    if (!state || isHost) {
      return;
    }

    setPlayer(mirrorPlayerState(state.opponent));
    setOpponent(mirrorPlayerState(state.player));
    setGameStatus(state.gameStatus ?? "playing");
  };

  const resetGame = () => {
    if (playerAttackTimeoutRef.current) {
      clearTimeout(playerAttackTimeoutRef.current);
      playerAttackTimeoutRef.current = null;
    }

    if (opponentAttackTimeoutRef.current) {
      clearTimeout(opponentAttackTimeoutRef.current);
      opponentAttackTimeoutRef.current = null;
    }

    setPlayer(createInitialPlayerState());
    setOpponent(createInitialOpponentState());
    setGameStatus("playing");
  };

  useEffect(() => {
    if (!isComputerOpponent || !isHost || gameStatus !== "playing" || paused) {
      return undefined;
    }

    const botProfile = BOT_PROFILES[difficulty] ?? BOT_PROFILES.medium;

    const intervalId = window.setInterval(() => {
      const currentPlayer = playerRef.current;
      const currentOpponent = opponentRef.current;

      if (!currentPlayer || !currentOpponent) {
        return;
      }

      if (currentPlayer.health <= 0 || currentOpponent.health <= 0) {
        return;
      }

      const playerCenter = currentPlayer.x + PLAYER_WIDTH / 2;
      const opponentCenter = currentOpponent.x + PLAYER_WIDTH / 2;
      const distance = Math.abs(playerCenter - opponentCenter);
      const moveTowardPlayer = opponentCenter > playerCenter ? "left" : "right";
      const moveAwayFromPlayer = moveTowardPlayer === "left" ? "right" : "left";
      const isAtLeftCorner = currentOpponent.x <= 2;
      const isAtRightCorner = currentOpponent.x >= 800 - PLAYER_WIDTH - 2;
      const retreatBlocked =
        (moveAwayFromPlayer === "left" && isAtLeftCorner) ||
        (moveAwayFromPlayer === "right" && isAtRightCorner);
      const isFacingPlayer =
        currentOpponent.direction === "left"
          ? playerCenter < opponentCenter
          : playerCenter > opponentCenter;

      if (
        currentOpponent.specialReady &&
        distance <= 210 &&
        Math.random() < botProfile.specialChance
      ) {
        runOpponentInput("specialAttack");
        return;
      }

      if (distance <= 58) {
        if (Math.random() < botProfile.throwChance) {
          runOpponentInput("throw");
          return;
        }

        if (Math.random() < botProfile.attackChance) {
          runOpponentInput("attack");
          return;
        }

        if (difficulty === "easy" && Math.random() < 0.35) {
          runOpponentInput(moveAwayFromPlayer);
          return;
        }
      }

      if (distance > 58 && isFacingPlayer && Math.random() < botProfile.farAttackChance) {
        runOpponentInput("attack");
        return;
      }

      if (distance < botProfile.retreatDistance) {
        if (!retreatBlocked) {
          runOpponentInput(moveAwayFromPlayer, {
            facePlayer: true,
            movementSteps: botProfile.movementSteps,
          });
          return;
        }

        if (distance <= 95 && Math.random() < botProfile.throwChance + 0.2) {
          runOpponentInput("throw");
          return;
        }

        if (Math.random() < Math.max(botProfile.attackChance, botProfile.farAttackChance)) {
          runOpponentInput("attack");
          return;
        }

        runOpponentInput(moveTowardPlayer);
        return;
      }

      if (distance > botProfile.preferredDistance) {
        runOpponentInput(moveTowardPlayer, {
          facePlayer: true,
          movementSteps: botProfile.movementSteps,
        });
        return;
      }

      if (Math.random() < botProfile.strafeChance) {
        runOpponentInput(Math.random() < 0.5 ? moveTowardPlayer : moveAwayFromPlayer, {
          facePlayer: true,
          movementSteps: botProfile.movementSteps,
        });
      }
    }, botProfile.tickMs);

    return () => window.clearInterval(intervalId);
  }, [difficulty, gameStatus, isComputerOpponent, isHost, paused]);

  return {
    player,
    opponent,
    gameStatus,
    updatePlayer,
    applyRemoteInput,
    resetGame,
    syncHostState,
  };
};

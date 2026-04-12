import { useEffect, useRef, useState } from "react";
import { applyAttackDamage, applySpecialAttackDamage } from "../game/collision";
import {
  ATTACK_DURATION,
  PLAYER_WIDTH,
  createPlayer,
  endAttack,
  flipDirection,
  mirrorPlayerX,
  movePlayer,
  registerHit,
  SPECIAL_ATTACK_DURATION,
  startAttack,
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
    specialChance: 0.2,
    tickMs: 420,
  },
  medium: {
    attackChance: 0.72,
    specialChance: 0.45,
    tickMs: 250,
  },
  hard: {
    attackChance: 0.92,
    specialChance: 0.7,
    tickMs: 150,
  },
};

export const useGameState = (isHost, options = {}) => {
  const { difficulty = "medium", opponentMode = "remote" } = options;
  const isComputerOpponent = opponentMode === "computer";
  const [player, setPlayer] = useState(createInitialPlayerState);
  const [opponent, setOpponent] = useState(createInitialOpponentState);
  const [gameStatus, setGameStatus] = useState("playing");

  const playerAttackTimeoutRef = useRef(null);
  const opponentAttackTimeoutRef = useRef(null);
  const playerRef = useRef(createInitialPlayerState());
  const opponentRef = useRef(createInitialOpponentState());

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    opponentRef.current = opponent;
  }, [opponent]);

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

  const runOpponentInput = (input, { invertMovement = false } = {}) => {
    if (input === "attack") {
      const attackingOpponent = startAttack(opponentRef.current);
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

    const movementInput = invertMovement ? invertMovementInput(input) : input;
    setOpponent((currentOpponent) => movePlayer(currentOpponent, movementInput));
  };

  const updatePlayer = (input) => {
    if (input === "attack") {
      const attackingPlayer = startAttack(playerRef.current);

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
    if (!isComputerOpponent || !isHost || gameStatus !== "playing") {
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

      if (
        currentOpponent.specialReady &&
        distance <= 210 &&
        Math.random() < botProfile.specialChance
      ) {
        runOpponentInput("specialAttack");
        return;
      }

      if (distance <= 58) {
        if (Math.random() < botProfile.attackChance) {
          runOpponentInput("attack");
          return;
        }

        if (difficulty === "easy" && Math.random() < 0.35) {
          runOpponentInput(moveAwayFromPlayer);
          return;
        }
      }

      if (distance > 46) {
        runOpponentInput(moveTowardPlayer);
      }
    }, botProfile.tickMs);

    return () => window.clearInterval(intervalId);
  }, [difficulty, gameStatus, isComputerOpponent, isHost]);

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

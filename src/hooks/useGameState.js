import { useEffect, useRef, useState } from "react";
import { applyAttackDamage, applySpecialAttackDamage } from "../game/collision";
import {
  ATTACK_DURATION,
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

export const useGameState = (isHost) => {
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

    setOpponent((currentOpponent) =>
      movePlayer(currentOpponent, invertMovementInput(input))
    );
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

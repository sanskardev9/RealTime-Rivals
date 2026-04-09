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

export const useGameState = (isHost) => {
  const [player, setPlayer] = useState(() => createPlayer({ x: 100 }));
  const [opponent, setOpponent] = useState(() =>
    createPlayer({ x: 600, direction: "left" })
  );
  const [gameStatus, setGameStatus] = useState("playing");

  const playerAttackTimeoutRef = useRef(null);
  const opponentAttackTimeoutRef = useRef(null);

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
    if (player.health <= 0) {
      setGameStatus("opponentWon");
    }

    if (opponent.health <= 0) {
      setGameStatus("playerWon");
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
      setPlayer((currentPlayer) => {
        const attackingPlayer = startAttack(currentPlayer);

        if (isHost) {
          setOpponent((currentOpponent) => {
            const { damagedDefender, didLandHit } = resolveDamage(
              attackingPlayer,
              currentOpponent,
              applyAttackDamage
            );

            if (didLandHit) {
              setPlayer((latestPlayer) => registerHit(latestPlayer));
            }

            return damagedDefender;
          });
        }

        return attackingPlayer;
      });

      queueAttackEnd(setPlayer, playerAttackTimeoutRef);
      return;
    }

    if (input === "specialAttack") {
      setPlayer((currentPlayer) => {
        if (!currentPlayer.specialReady) {
          return currentPlayer;
        }

        const specialAttacker = startSpecialAttack(currentPlayer);

        if (isHost) {
          setOpponent((currentOpponent) =>
            resolveDamage(specialAttacker, currentOpponent, applySpecialAttackDamage)
              .damagedDefender
          );
        }

        queueAttackEnd(setPlayer, playerAttackTimeoutRef, SPECIAL_ATTACK_DURATION);
        return specialAttacker;
      });

      return;
    }

    setPlayer((currentPlayer) => movePlayer(currentPlayer, input));
  };

  const applyRemoteInput = (input) => {
    if (!isHost) {
      return;
    }

    if (input === "attack") {
      setOpponent((currentOpponent) => {
        const attackingOpponent = startAttack(currentOpponent);

        setPlayer((currentPlayer) => {
          const { damagedDefender, didLandHit } = resolveDamage(
            attackingOpponent,
            currentPlayer,
            applyAttackDamage
          );

          if (didLandHit) {
            setOpponent((latestOpponent) => registerHit(latestOpponent));
          }

          return damagedDefender;
        });

        return attackingOpponent;
      });

      queueAttackEnd(setOpponent, opponentAttackTimeoutRef);
      return;
    }

    if (input === "specialAttack") {
      setOpponent((currentOpponent) => {
        if (!currentOpponent.specialReady) {
          return currentOpponent;
        }

        const specialAttacker = startSpecialAttack(currentOpponent);

        setPlayer((currentPlayer) =>
          resolveDamage(specialAttacker, currentPlayer, applySpecialAttackDamage)
            .damagedDefender
        );

        queueAttackEnd(setOpponent, opponentAttackTimeoutRef, SPECIAL_ATTACK_DURATION);
        return specialAttacker;
      });

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

  return {
    player,
    opponent,
    gameStatus,
    updatePlayer,
    applyRemoteInput,
    syncHostState,
  };
};

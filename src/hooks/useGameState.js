import { useEffect, useRef, useState } from "react";
import { applyAttackDamage } from "../game/collision";
import {
  ATTACK_DURATION,
  createPlayer,
  endAttack,
  flipDirection,
  mirrorPlayerX,
  movePlayer,
  startAttack,
} from "../game/player";

export const useGameState = () => {
  const [player, setPlayer] = useState(() => createPlayer({ x: 100 }));
  const [opponent, setOpponent] = useState(() =>
    createPlayer({ x: 600, direction: "left" })
  );
  const [gameStatus, setGameStatus] = useState("playing");

  const attackTimeoutRef = useRef(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (attackTimeoutRef.current) {
        clearTimeout(attackTimeoutRef.current);
      }
    };
  }, []);

  // 🔥 GAME OVER DETECTION (BOTH SIDES)
  useEffect(() => {
    if (player.health <= 0) {
      setGameStatus("opponentWon");
    }

    if (opponent.health <= 0) {
      setGameStatus("playerWon");
    }
  }, [player.health, opponent.health]);

  const updatePlayer = (input) => {
    // 🥊 ATTACK
    if (input === "attack") {
      if (attackTimeoutRef.current) {
        clearTimeout(attackTimeoutRef.current);
      }

      setPlayer((currentPlayer) => {
        return startAttack(currentPlayer);
      });

      // End attack after duration
      attackTimeoutRef.current = setTimeout(() => {
        setPlayer((currentPlayer) => endAttack(currentPlayer));
      }, ATTACK_DURATION);

      return;
    }

    // 🚶 Movement
    setPlayer((currentPlayer) => movePlayer(currentPlayer, input));
  };

  const syncOpponent = (remotePlayer) => {
    setOpponent((currentOpponent) => {
      const normalizedRemotePlayer = {
        ...remotePlayer,
        x: mirrorPlayerX(remotePlayer.x),
        direction: flipDirection(remotePlayer.direction),
      };
      const isNewAttack =
        normalizedRemotePlayer.isAttacking && !currentOpponent.isAttacking;

      if (isNewAttack) {
        setPlayer((currentPlayer) =>
          applyAttackDamage(normalizedRemotePlayer, currentPlayer)
        );
      }

      return normalizedRemotePlayer;
    });
  };

  return {
    player,
    opponent,
    syncOpponent,
    updatePlayer,
    gameStatus,
  };
};

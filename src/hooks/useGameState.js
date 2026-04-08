import { useEffect, useRef, useState } from "react";
import { applyAttackDamage } from "../game/collision";
import {
  ATTACK_DURATION,
  createPlayer,
  endAttack,
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
        const attackingPlayer = startAttack(currentPlayer);

        // Apply damage
        setOpponent((currentOpponent) =>
          applyAttackDamage(attackingPlayer, currentOpponent)
        );

        return attackingPlayer;
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

  return {
    player,
    opponent,
    setOpponent,
    updatePlayer,
    gameStatus,
  };
};
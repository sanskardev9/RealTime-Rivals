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
    createPlayer({ x: 600, direction: "left" }),
  );
  const attackTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (attackTimeoutRef.current) {
        clearTimeout(attackTimeoutRef.current);
      }
    };
  }, []);

  const updatePlayer = (input) => {
    if (input === "attack") {
      if (attackTimeoutRef.current) {
        clearTimeout(attackTimeoutRef.current);
      }

      setPlayer((currentPlayer) => {
        const attackingPlayer = startAttack(currentPlayer);

        setOpponent((currentOpponent) =>
          applyAttackDamage(attackingPlayer, currentOpponent),
        );

        return attackingPlayer;
      });

      attackTimeoutRef.current = setTimeout(() => {
        setPlayer((currentPlayer) => endAttack(currentPlayer));
      }, ATTACK_DURATION);

      return;
    }

    setPlayer((currentPlayer) => movePlayer(currentPlayer, input));
  };

  return { player, opponent, setOpponent, updatePlayer, movePlayer };
};

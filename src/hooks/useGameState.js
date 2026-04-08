import { useState } from "react";

const movePlayer = (currentPlayer, input) => {
  const updatedPlayer = { ...currentPlayer };

  if (input === "right") updatedPlayer.x += 10;
  if (input === "left") updatedPlayer.x -= 10;

  return updatedPlayer;
};

export const useGameState = () => {
  const [player, setPlayer] = useState({ x: 100, health: 100 });
  const [opponent, setOpponent] = useState({ x: 600, health: 100 });

  const updatePlayer = (input) => {
    setPlayer((currentPlayer) => movePlayer(currentPlayer, input));
  };

  return { player, opponent, setOpponent, updatePlayer, movePlayer };
};

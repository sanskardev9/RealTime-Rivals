import { useState } from "react";
import Lobby from "./components/Lobby";
import GameCanvas from "./components/GameCanvas";

export default function App() {
  const [started, setStarted] = useState(false);

  return (
    <div>
      {!started ? (
        <Lobby onStart={() => setStarted(true)} />
      ) : (
        <GameCanvas />
      )}
    </div>
  );
}
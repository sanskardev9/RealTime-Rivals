import { useState } from "react";
import Lobby from "./components/Lobby";
import GameCanvas from "./components/GameCanvas";

export default function App() {
  const [session, setSession] = useState(null);

  return (
    <div>
      {!session ? (
        <Lobby onStart={setSession} />
      ) : (
        <GameCanvas
          playerName={session.playerName}
          roomAction={session.roomAction}
          roomCode={session.roomCode}
        />
      )}
    </div>
  );
}

import { useState } from "react";
import Lobby from "./components/Lobby";
import GameCanvas from "./components/GameCanvas";

export default function App() {
  const [session, setSession] = useState(null);
  const handleExitToLobby = () => {
    setSession(null);
  };

  return (
    <div>
      {!session ? (
        <Lobby onStart={setSession} />
      ) : (
        <GameCanvas
          difficulty={session.difficulty}
          matchType={session.matchType}
          showTutorialOnStart={session.showTutorialOnStart}
          playerName={session.playerName}
          roomAction={session.roomAction}
          roomCode={session.roomCode}
          onExitToLobby={handleExitToLobby}
        />
      )}
    </div>
  );
}

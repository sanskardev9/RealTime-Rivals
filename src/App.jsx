import { useState } from "react";
import Lobby from "./components/Lobby";
import GameCanvas from "./components/GameCanvas";

// The match in progress, kept per tab so a refresh lands back in the game
// instead of the lobby.
const ACTIVE_SESSION_STORAGE_KEY = "rtr.activeSession";

const loadSession = () => {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY));
    if (!saved) return null;

    // After a refresh this player is coming back, not creating or joining
    // fresh: "rejoin" re-enters the room, or reopens it if it emptied.
    return {
      ...saved,
      showTutorialOnStart: false,
      roomAction: saved.matchType === "online" ? "rejoin" : saved.roomAction,
    };
  } catch {
    return null;
  }
};

const saveSession = (session) => {
  try {
    if (session) {
      window.sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
  } catch {
    // Storage blocked (private mode): the game still works, refresh just exits.
  }
};

export default function App() {
  const [session, setSession] = useState(loadSession);

  const handleStart = (nextSession) => {
    saveSession(nextSession);
    setSession(nextSession);
  };

  const handleExitToLobby = () => {
    saveSession(null);
    setSession(null);
  };

  return (
    <div>
      {!session ? (
        <Lobby onStart={handleStart} />
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

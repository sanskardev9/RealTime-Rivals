import { useMemo, useState } from "react";

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PLAYER_NAME_STORAGE_KEY = "realtime-rivals-player-name";
const SESSION_PLAYER_NAME_STORAGE_KEY = "realtime-rivals-session-player-name";

const generateRoomCode = () =>
  Array.from({ length: ROOM_CODE_LENGTH }, () => {
    const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    return ROOM_CODE_ALPHABET[index];
  }).join("");

export default function Lobby({ onStart }) {
  const [joinCode, setJoinCode] = useState("");
  const [computerDifficulty, setComputerDifficulty] = useState("medium");
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const sessionPlayerName = window.sessionStorage.getItem(
      SESSION_PLAYER_NAME_STORAGE_KEY
    );

    if (sessionPlayerName) {
      return sessionPlayerName;
    }

    return window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? "";
  });
  const nextRoomCode = useMemo(() => generateRoomCode(), []);
  const normalizedJoinCode = joinCode.trim().toUpperCase();
  const normalizedPlayerName = playerName.trim();

  const startSession = ({
    difficulty = null,
    forceTutorial = false,
    matchType = "online",
    roomAction,
    roomCode,
  }) => {
    const isNewUser =
      window.sessionStorage.getItem(SESSION_PLAYER_NAME_STORAGE_KEY) === null;

    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, normalizedPlayerName);
    window.sessionStorage.setItem(
      SESSION_PLAYER_NAME_STORAGE_KEY,
      normalizedPlayerName
    );

    onStart({
      difficulty,
      showTutorialOnStart: forceTutorial || isNewUser,
      matchType,
      playerName: normalizedPlayerName,
      roomAction,
      roomCode,
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h1 className="text-3xl font-bold">Real Time Rivals</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Create a private room or join a friend using the same 6-character pin.
        </p>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Player Name</p>
          <input
            className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base outline-none placeholder:text-zinc-600"
            maxLength={20}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Enter your fighter name"
            value={playerName}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Create Room</p>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3">
            <span className="font-mono text-2xl tracking-[0.35em]">{nextRoomCode}</span>
            <button
              className="rounded-lg bg-white px-2 py-2 sm:px-2 sm:px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!normalizedPlayerName}
              onClick={() => startSession({ roomAction: "create", roomCode: nextRoomCode })}
            >
              Host Game
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Join Room</p>
          <input
            className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-mono text-lg tracking-[0.35em] outline-none placeholder:text-zinc-600"
            maxLength={ROOM_CODE_LENGTH}
            onChange={(event) =>
              setJoinCode(
                event.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
              )
            }
            placeholder="ABC123"
            value={joinCode.toUpperCase()}
          />
          <button
            className="mt-3 w-full rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            disabled={normalizedJoinCode.length !== ROOM_CODE_LENGTH || !normalizedPlayerName}
            onClick={() =>
              startSession({ roomAction: "join", roomCode: normalizedJoinCode })
            }
          >
            Join Game
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Computer Battle</p>
          <p className="mt-2 text-sm text-zinc-400">
            Fight locally against an AI opponent. Voice chat stays available only in
            online matches.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {["easy", "medium", "hard"].map((level) => {
              const isSelected = computerDifficulty === level;

              return (
                <button
                  key={level}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold capitalize ${
                    isSelected
                      ? "border-sky-400 bg-sky-500/20 text-sky-100"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300"
                  }`}
                  onClick={() => setComputerDifficulty(level)}
                  type="button"
                >
                  {level}
                </button>
              );
            })}
          </div>

          <button
            className="mt-4 w-full rounded-lg bg-sky-400 px-4 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!normalizedPlayerName}
            onClick={() =>
              startSession({
                difficulty: computerDifficulty,
                matchType: "computer",
                roomAction: "computer",
                roomCode: `CPU-${computerDifficulty.toUpperCase()}`,
              })
            }
          >
            Fight Computer
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Tutorial</p>
          <p className="mt-2 text-sm text-zinc-400">
            Learn movement, attacks, beam, rematch flow, and voice chat before the
            match begins.
          </p>

          <button
            className="mt-4 w-full rounded-lg bg-white px-4 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!normalizedPlayerName}
            onClick={() =>
              startSession({
                difficulty: "easy",
                forceTutorial: true,
                matchType: "computer",
                roomAction: "computer",
                roomCode: "TUTORIAL",
              })
            }
          >
            Open Tutorial
          </button>
        </div>
      </div>
    </div>
  );
}

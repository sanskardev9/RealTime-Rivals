export default function Lobby({ onStart }) {
  return (
    <div style={{ textAlign: "center", marginTop: 100 }}>
      <h1>🥊 Fighting Game</h1>
      <button onClick={onStart}>Start Game</button>
    </div>
  );
}
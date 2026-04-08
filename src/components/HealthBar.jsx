export default function HealthBar({ health, color }) {
  return (
    <div
      style={{
        width: 200,
        background: "#444",
        margin: 10,
        border: "1px solid #666",
      }}
    >
      <div
        style={{
          width: `${health}%`,
          height: 20,
          background: color,
          transition: "width 120ms linear",
        }}
      />
    </div>
  );
}

export default function HealthBar({ health, color }) {
  return (
    <div
      style={{
        width: "100%",
        background: "#444",
        border: "1px solid #666",
        borderRadius: 8,
        overflow: "hidden",
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

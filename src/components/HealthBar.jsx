export default function HealthBar({ health, color, label, maxHealth = 100 }) {
  const clampedPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between gap-3 text-sm text-zinc-300">
        <span className="truncate">{label}</span>
        <span>{health}</span>
      </div>
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
            width: `${clampedPercent}%`,
            height: 20,
            background: color,
            transition: "width 120ms linear",
          }}
        />
      </div>
    </div>
  );
}

/**
 * components/dashboard/KPICard.jsx
 */
export default function KPICard({ label, value, sub, color = "var(--brand-primary)", icon, trend }) {
  return (
    <div className="card" style={{ padding: "22px 24px", position: "relative", overflow: "hidden" }}>
      {/* Accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: color, borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Bricolage Grotesque', sans-serif", color: "var(--text-primary)", lineHeight: 1 }}>
            {value ?? "—"}
          </div>
          {sub && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              {sub}
            </div>
          )}
          {trend != null && (
            <div style={{ fontSize: 12, color: trend >= 0 ? "#15803d" : "var(--red)", marginTop: 4, fontWeight: 600 }}>
              {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%
            </div>
          )}
        </div>
        {icon && (
          <div style={{
            width: 44, height: 44,
            borderRadius: "var(--radius-md)",
            background: color + "18",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

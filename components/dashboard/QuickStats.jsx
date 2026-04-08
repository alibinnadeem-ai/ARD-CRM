/**
 * components/dashboard/QuickStats.jsx
 * A compact horizontal stats strip beneath KPI cards
 */
export default function QuickStats({ kpis }) {
  const stats = [
    {
      label: "Won",
      value: kpis?.wonDeals ?? 0,
      color: "#15803d",
      bg: "#dcfce7",
    },
    {
      label: "Lost",
      value: kpis?.lostDeals ?? 0,
      color: "#dc2626",
      bg: "#fee2e2",
    },
    {
      label: "Conversion",
      value: `${kpis?.conversionRate ?? 0}%`,
      color: "#1d4ed8",
      bg: "#dbeafe",
    },
    {
      label: "Won Value",
      value: kpis?.wonValue >= 1_000_000
        ? `PKR ${(kpis.wonValue / 1_000_000).toFixed(1)}M`
        : kpis?.wonValue > 0
          ? `PKR ${kpis.wonValue.toLocaleString()}`
          : "PKR 0",
      color: "#7c3aed",
      bg: "#ede9fe",
    },
  ];

  return (
    <div style={{
      display: "flex",
      gap: 12,
      marginBottom: 28,
      flexWrap: "wrap",
    }}>
      {stats.map((s) => (
        <div key={s.label} style={{
          flex: "1 1 120px",
          background: s.bg,
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: s.color, opacity: 0.75, marginBottom: 2 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              {s.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

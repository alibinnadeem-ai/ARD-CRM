/**
 * components/ui/EmptyState.jsx
 */
export default function EmptyState({ icon = "◎", title, description, action }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "72px 32px", gap: 14,
      color: "var(--text-muted)", textAlign: "center",
    }}>
      <div style={{
        width: 72, height: 72,
        background: "var(--bg-page)",
        border: "2px solid var(--border)",
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, marginBottom: 4,
      }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)" }}>{title}</div>
      {description && (
        <div style={{ fontSize: 13.5, maxWidth: 320, lineHeight: 1.6 }}>{description}</div>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

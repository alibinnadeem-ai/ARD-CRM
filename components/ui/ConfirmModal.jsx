/**
 * components/ui/ConfirmModal.jsx
 */
export default function ConfirmModal({ open, title, message, onConfirm, onCancel, danger = true }) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "28px 28px 0" }}>
          <div style={{
            width: 48, height: 48,
            background: danger ? "#fee2e2" : "#dbeafe",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, marginBottom: 16,
          }}>
            {danger ? "⚠" : "?"}
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.6 }}>{message}</p>
        </div>
        <div style={{
          display: "flex", gap: 10, justifyContent: "flex-end",
          padding: "24px 28px 28px",
        }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            style={danger ? { background: "var(--red)", color: "white" } : {}}
          >
            {danger ? "Delete" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

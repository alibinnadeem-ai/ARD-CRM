/**
 * components/ui/Pagination.jsx
 * Reusable pagination bar
 */
export default function Pagination({ page, totalPages, totalItems, pageSize, onPage }) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalItems);

  // Build visible page numbers (window of 5 around current)
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 20px",
      borderTop: "1px solid var(--border)",
      background: "var(--bg-page)",
      flexWrap: "wrap",
      gap: 10,
    }}>
      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        Showing <strong style={{ color: "var(--text-primary)" }}>{from}–{to}</strong> of{" "}
        <strong style={{ color: "var(--text-primary)" }}>{totalItems}</strong> records
      </span>

      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        {/* First */}
        <PageBtn onClick={() => onPage(1)} disabled={page <= 1} label="«" />
        {/* Prev */}
        <PageBtn onClick={() => onPage(page - 1)} disabled={page <= 1} label="‹" />

        {pages.map((p) => (
          <PageBtn
            key={p}
            onClick={() => onPage(p)}
            active={p === page}
            label={String(p)}
          />
        ))}

        {/* Next */}
        <PageBtn onClick={() => onPage(page + 1)} disabled={page >= totalPages} label="›" />
        {/* Last */}
        <PageBtn onClick={() => onPage(totalPages)} disabled={page >= totalPages} label="»" />
      </div>
    </div>
  );
}

function PageBtn({ onClick, disabled, active, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 34,
        height: 34,
        border: "1px solid",
        borderColor: active ? "var(--brand-primary)" : "var(--border)",
        borderRadius: "var(--radius-sm)",
        background: active ? "var(--brand-primary)" : "white",
        color: active ? "white" : disabled ? "var(--text-muted)" : "var(--text-secondary)",
        fontSize: 13,
        fontWeight: active ? 700 : 400,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        transition: "all 0.12s",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  );
}

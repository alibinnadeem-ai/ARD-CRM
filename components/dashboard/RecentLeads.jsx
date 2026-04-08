/**
 * components/dashboard/RecentLeads.jsx
 */
import Link from "next/link";
import { StatusBadge } from "../ui/StatusBadge";

export default function RecentLeads({ records = [] }) {
  const recent = records
    .filter((r) => r.status !== "Deleted")
    .slice(0, 8);

  if (!recent.length) {
    return (
      <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>
        No records yet. Add your first lead.
      </div>
    );
  }

  return (
    <div style={{ overflow: "hidden" }}>
      {recent.map((r, i) => (
        <Link
          key={r._rowIndex ?? i}
          href={`/leads/${r._rowIndex}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "13px 0",
            borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none",
            textDecoration: "none",
            transition: "opacity 0.15s",
          }}
        >
          {/* Avatar */}
          <div style={{
            width: 38, height: 38,
            background: `hsl(${(r.name?.charCodeAt(0) || 200) % 360}deg 40% 88%)`,
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700,
            color: `hsl(${(r.name?.charCodeAt(0) || 200) % 360}deg 40% 35%)`,
            flexShrink: 0,
          }}>
            {(r.name || r.company || "?")[0].toUpperCase()}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {r.name || r.company || "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
              {r.company && r.name ? r.company : (r.phone || r.email || "No contact info")}
            </div>
          </div>

          {/* Status */}
          <StatusBadge value={r.status} />

          {/* Source */}
          {r.source && (
            <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "none", "@media(minWidth:900px)": { display: "block" } }}>
              {r.source}
            </span>
          )}

          {/* Arrow */}
          <span style={{ color: "var(--text-muted)", fontSize: 14, flexShrink: 0 }}>›</span>
        </Link>
      ))}
    </div>
  );
}

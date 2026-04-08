/**
 * components/ui/StatusBadge.jsx
 * Maps CRM status/stage values to colored badges
 */
const STATUS_COLORS = {
  "New Lead":       "badge-blue",
  "Contacted":      "badge-navy",
  "Qualified":      "badge-purple",
  "Proposal Sent":  "badge-purple",
  "Negotiation":    "badge-amber",
  "Won":            "badge-green",
  "Lost":           "badge-red",
  "On Hold":        "badge-amber",
  "Deleted":        "badge-gray",
};

const STAGE_COLORS = {
  "Awareness":      "badge-blue",
  "Interest":       "badge-blue",
  "Consideration":  "badge-purple",
  "Intent":         "badge-purple",
  "Evaluation":     "badge-amber",
  "Purchase":       "badge-green",
  "Post-Sale":      "badge-green",
};

export function StatusBadge({ value, type = "status" }) {
  if (!value) return <span className="badge badge-gray">—</span>;
  const map = type === "stage" ? STAGE_COLORS : STATUS_COLORS;
  const cls = map[value] || "badge-gray";
  return <span className={`badge ${cls}`}>{value}</span>;
}

export function SourceBadge({ value }) {
  if (!value) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 9px", borderRadius: 99,
      fontSize: 11.5, fontWeight: 600,
      background: "#f0f4ff", color: "#3b5bdb",
      border: "1px solid #c5d0e6",
    }}>{value}</span>
  );
}

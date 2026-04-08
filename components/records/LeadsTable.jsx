/**
 * components/records/LeadsTable.jsx
 * Reusable lead records table with actions
 */
import Link from "next/link";
import { StatusBadge, SourceBadge } from "../ui/StatusBadge";

function fmtDate(val) {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("en-PK", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return val; }
}

function isOverdue(val, status) {
  if (!val) return false;
  if (["Won", "Lost", "Deleted"].includes(status)) return false;
  return new Date(val) < new Date();
}

export default function LeadsTable({ records = [], page = 1, pageSize = 25, onDelete }) {
  if (!records.length) return null;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 42 }}>#</th>
            <th>Name / Company</th>
            <th>Contact</th>
            <th style={{ width: 130 }}>Status</th>
            <th style={{ width: 110 }}>Stage</th>
            <th style={{ width: 130 }}>Source</th>
            <th>Assigned To</th>
            <th style={{ width: 120 }}>Follow-up</th>
            <th style={{ width: 120 }}>Value</th>
            <th style={{ width: 140 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => {
            const overdue = isOverdue(r.follow_up, r.status);
            const idx = (page - 1) * pageSize + i + 1;

            return (
              <tr key={r._rowIndex ?? i} style={{ cursor: "pointer" }}>
                <td style={{ color: "var(--text-muted)", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                  {idx}
                </td>

                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Mini avatar */}
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                      background: `hsl(${((r.name || r.company || "?").charCodeAt(0) || 65) % 360}deg 35% 88%)`,
                      color: `hsl(${((r.name || r.company || "?").charCodeAt(0) || 65) % 360}deg 35% 32%)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                    }}>
                      {((r.name || r.company || "?")[0] || "?").toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.name || <em style={{ color: "var(--text-muted)", fontWeight: 400 }}>No name</em>}
                      </div>
                      {r.company && (
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.company}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                <td>
                  <div style={{ fontSize: 13 }}>{r.phone || "—"}</div>
                  {r.email && (
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.email}
                    </div>
                  )}
                </td>

                <td><StatusBadge value={r.status} /></td>

                <td>
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    {r.stage || "—"}
                  </span>
                </td>

                <td><SourceBadge value={r.source} /></td>

                <td>
                  <span style={{ fontSize: 13, color: r.assigned_to ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {r.assigned_to || "Unassigned"}
                  </span>
                </td>

                <td>
                  <span style={{
                    fontSize: 12.5,
                    color: overdue ? "var(--red)" : "var(--text-secondary)",
                    fontWeight: overdue ? 600 : 400,
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {overdue && <span title="Overdue">⚠</span>}
                    {fmtDate(r.follow_up)}
                  </span>
                </td>

                <td>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {r.value
                      ? `PKR ${Number(r.value).toLocaleString()}`
                      : "—"}
                  </span>
                </td>

                <td>
                  <div style={{ display: "flex", gap: 5 }}>
                    <Link
                      href={`/leads/${r._rowIndex}`}
                      className="btn btn-ghost btn-sm"
                    >
                      View
                    </Link>
                    <Link
                      href={`/leads/${r._rowIndex}?edit=1`}
                      className="btn btn-ghost btn-sm"
                    >
                      Edit
                    </Link>
                    <button
                      className="btn btn-sm"
                      style={{
                        background: "#fee2e2",
                        color: "var(--red)",
                        border: "1px solid #fecaca",
                      }}
                      onClick={() => onDelete?.(r)}
                    >
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

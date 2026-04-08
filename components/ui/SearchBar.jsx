/**
 * components/ui/SearchBar.jsx
 * Global search bar with status/stage filters and sort
 */
import { STATUS_OPTIONS, STAGE_OPTIONS } from "../../lib/transforms/mapper";

export default function SearchBar({
  searchQuery, setSearchQuery,
  statusFilter, setStatusFilter,
  stageFilter, setStageFilter,
  sortBy, setSortBy,
  sortDir, setSortDir,
  resultCount, totalCount,
}) {
  return (
    <div style={{
      background: "white",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      boxShadow: "var(--shadow-sm)",
    }}>
      {/* Search input */}
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
          color: "var(--text-muted)", fontSize: 15, pointerEvents: "none",
        }}>⌕</span>
        <input
          className="input"
          style={{ paddingLeft: 38, fontSize: 14 }}
          placeholder="Search by name, company, phone, email, status, notes, tags…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", fontSize: 16, lineHeight: 1,
            }}
          >×</button>
        )}
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select
          className="input"
          style={{ width: "auto", minWidth: 140 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.filter(s => s !== "Deleted").map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          className="input"
          style={{ width: "auto", minWidth: 140 }}
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="All">All Stages</option>
          {STAGE_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          className="input"
          style={{ width: "auto", minWidth: 150 }}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="created_at">Sort: Date Added</option>
          <option value="name">Sort: Name</option>
          <option value="company">Sort: Company</option>
          <option value="status">Sort: Status</option>
          <option value="stage">Sort: Stage</option>
          <option value="follow_up">Sort: Follow-up</option>
          <option value="assigned_to">Sort: Assigned To</option>
          <option value="value">Sort: Value</option>
        </select>

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
          title="Toggle sort direction"
        >
          {sortDir === "asc" ? "↑ ASC" : "↓ DESC"}
        </button>

        {/* Result count */}
        <div style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {resultCount !== totalCount
            ? <><strong style={{ color: "var(--brand-primary)" }}>{resultCount}</strong> of {totalCount} records</>
            : <><strong style={{ color: "var(--brand-primary)" }}>{totalCount}</strong> records</>
          }
        </div>
      </div>
    </div>
  );
}

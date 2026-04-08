/**
 * pages/leads/index.jsx
 * All Leads — full table, search, filters, pagination, CRUD, CSV export
 */
import { useState, useCallback } from "react";
import Link from "next/link";
import Layout from "../../components/ui/Layout";
import AuthGuard from "../../components/ui/AuthGuard";
import SearchBar from "../../components/ui/SearchBar";
import LeadsTable from "../../components/records/LeadsTable";
import Pagination from "../../components/ui/Pagination";
import ConfirmModal from "../../components/ui/ConfirmModal";
import EmptyState from "../../components/ui/EmptyState";
import { useLeads } from "../../hooks/useLeads";
import { useToast } from "../../components/ui/Toast";
import { readApiResponse } from "../../utils/helpers";

const PAGE_SIZE = 25;

export default function LeadsPage() {
  const toast = useToast();
  const {
    filtered, records,
    loading, error, syncedAt,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    stageFilter, setStageFilter,
    sortBy, setSortBy,
    sortDir, setSortDir,
    refresh,
  } = useLeads();

  const [page, setPage]               = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  const handleSearch = useCallback((q) => { setSearchQuery(q); setPage(1); }, [setSearchQuery]);
  const handleStatus = useCallback((s) => { setStatusFilter(s); setPage(1); }, [setStatusFilter]);
  const handleStage  = useCallback((s) => { setStageFilter(s); setPage(1); }, [setStageFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res  = await fetch(`/api/leads/${deleteTarget._rowIndex}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("ard_crm_token")}`,
          Accept: "application/json",
        },
      });
      await readApiResponse(res, "Failed to delete lead");
      toast("Lead deleted from database", "success");
      setDeleteTarget(null);
      refresh();
      if (paged.length === 1 && page > 1) setPage((p) => p - 1);
    } catch (err) {
      toast("Delete failed: " + err.message, "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    const params = new URLSearchParams();
    if (statusFilter !== "All") params.set("status", statusFilter);
    try {
      const res = await fetch(`/api/export/csv?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("ard_crm_token")}` },
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ard-crm-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast("CSV export started", "success");
    } catch (err) {
      toast("Export failed: " + err.message, "error");
    }
  }

  return (
    <AuthGuard>
    <Layout title="All Leads" syncedAt={syncedAt} onRefresh={refresh} loading={loading}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22, flexWrap:"wrap", gap:14 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:"var(--brand-primary)" }}>All Leads</h1>
          <p style={{ color:"var(--text-muted)", fontSize:13, marginTop:3 }}>
            {records.length} total records · search, filter, and manage all CRM entries
          </p>
        </div>
        <div style={{ display:"flex", gap:9, flexWrap:"wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExport}>↓ Export CSV</button>
          <Link href="/leads/new" className="btn btn-primary">+ New Lead</Link>
        </div>
      </div>

      {error && (
        <div style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderLeft:"4px solid var(--brand-accent)", borderRadius:10, padding:"14px 18px", marginBottom:18, color:"#9a3412", fontSize:13.5, display:"flex", gap:10 }}>
          <span>⚠</span>
          <div>
            <strong>Connection issue:</strong> {error}
            <div style={{ marginTop:4, fontSize:12.5 }}>Check database configuration. <a href="/api/health" target="_blank" style={{ color:"var(--brand-accent)" }}>Run health check →</a></div>
          </div>
        </div>
      )}

      <div style={{ marginBottom:14 }}>
        <SearchBar
          searchQuery={searchQuery}    setSearchQuery={handleSearch}
          statusFilter={statusFilter}  setStatusFilter={handleStatus}
          stageFilter={stageFilter}    setStageFilter={handleStage}
          sortBy={sortBy}              setSortBy={setSortBy}
          sortDir={sortDir}            setSortDir={setSortDir}
          resultCount={filtered.length}
          totalCount={records.length}
        />
      </div>

      <div className="card" style={{ padding:0, overflow:"hidden" }}>
        {loading && !records.length && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:"56px 32px", color:"var(--text-muted)" }}>
            <span className="spinner" /><span>Connecting to database…</span>
          </div>
        )}

        {!loading && paged.length === 0 && (
          <EmptyState
            icon={searchQuery || statusFilter !== "All" ? "⌕" : "◎"}
            title={searchQuery ? `No results for "${searchQuery}"` : statusFilter !== "All" ? `No "${statusFilter}" leads` : "No leads yet"}
            description={searchQuery || statusFilter !== "All" ? "Try adjusting your search or filters." : "Add your first lead — it saves directly to the database."}
            action={!searchQuery && statusFilter === "All" && <Link href="/leads/new" className="btn btn-primary">+ Add First Lead</Link>}
          />
        )}

        {paged.length > 0 && (
          <LeadsTable records={paged} page={page} pageSize={PAGE_SIZE} onDelete={setDeleteTarget} />
        )}

        <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
      </div>

      {records.length > 0 && !loading && (
        <div style={{ marginTop:14, padding:"11px 16px", background:"var(--bg-page)", border:"1px solid var(--border)", borderRadius:"var(--radius-md)", fontSize:12.5, color:"var(--text-muted)", display:"flex", gap:20, flexWrap:"wrap" }}>
          <span>💡 <strong>Tip:</strong> Click <em>View</em> for full detail, <em>Edit</em> for inline editing.</span>
          <span>· Database changes reflect here every 90s (or click Refresh).</span>
          <a href="/api/health" target="_blank" style={{ color:"var(--brand-primary)", marginLeft:"auto" }}>Health check →</a>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Lead"
        message={`Delete "${deleteTarget?.name || deleteTarget?.company || "this record"}"? It will be soft-deleted in the database.`}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </Layout>
    </AuthGuard>
  );
}

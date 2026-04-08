/**
 * pages/leads/[rowIndex].jsx
 * Lead Detail View + Inline Edit + Delete
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "../../components/ui/Layout";
import AuthGuard from "../../components/ui/AuthGuard";
import RecordForm from "../../components/records/RecordForm";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { StatusBadge, SourceBadge } from "../../components/ui/StatusBadge";
import { useToast } from "../../components/ui/Toast";
import { readApiResponse } from "../../utils/helpers";

function fmtDate(val) {
  if (!val) return null;
  try {
    return new Date(val).toLocaleDateString("en-PK", {
      weekday: "short", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return val; }
}

function isOverdue(val) {
  if (!val) return false;
  return new Date(val) < new Date();
}

export default function LeadDetailPage() {
  const router = useRouter();
  const toast = useToast();
  const { rowIndex } = router.query;
  const editMode = router.query.edit === "1";

  function authHeaders() {
    const token = typeof window !== "undefined" ? localStorage.getItem("ard_crm_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  const [record, setRecord] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(editMode);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!rowIndex) return;
    setIsEditing(editMode);
    fetchRecord();
  }, [rowIndex, editMode]);

  async function fetchRecord() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${rowIndex}`, { headers: authHeaders() });
      const data = await readApiResponse(res, "Failed to load lead");
      setRecord(data.record);
      setHeaders(data.headers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(formData) {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${rowIndex}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(formData),
      });
      await readApiResponse(res, "Failed to update lead");
      toast("Record updated in database", "success");
      setIsEditing(false);
      fetchRecord();
    } catch (err) {
      toast("Update failed: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/leads/${rowIndex}`, {
        method: "DELETE",
        headers: { ...authHeaders(), Accept: "application/json" },
      });
      await readApiResponse(res, "Failed to delete lead");
      toast("Lead deleted from database", "success");
      router.push("/leads");
    } catch (err) {
      toast("Delete failed: " + err.message, "error");
      setDeleting(false);
    }
  }

  const overdue = record && isOverdue(record.follow_up) && !["Won", "Lost"].includes(record.status);

  return (
    <AuthGuard>
    <Layout title={record?.name || "Lead Detail"}>

      {/* Breadcrumb + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/leads" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: 13.5 }}>
            ← All Leads
          </Link>
          <span style={{ color: "var(--border)" }}>›</span>
          <span style={{ fontSize: 13.5, color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {record?.name || record?.company || `Row ${rowIndex}`}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {!isEditing && !loading && record && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>
                ✎ Edit
              </button>
              <button
                className="btn btn-sm"
                style={{ background: "#fee2e2", color: "var(--red)", border: "1px solid #fecaca" }}
                onClick={() => setShowDelete(true)}
              >
                Delete
              </button>
            </>
          )}
          {isEditing && (
            <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(false)}>
              ✕ Cancel Edit
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 48, justifyContent: "center", color: "var(--text-muted)" }}>
          <span className="spinner" /> Loading record…
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: "#fee2e2", border: "1px solid #fecaca",
          borderRadius: 10, padding: "16px 20px", color: "#991b1b",
        }}>
          Failed to load record: {error}
        </div>
      )}

      {/* Edit Form */}
      {isEditing && record && (
        <div style={{ maxWidth: 780 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{
              display: "flex", gap: 10, alignItems: "center",
              marginBottom: 24, padding: "0 0 16px",
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{
                background: "#fef3c7", color: "#d97706",
                padding: "4px 12px", borderRadius: 99,
                fontSize: 12, fontWeight: 700,
              }}>EDIT MODE</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Changes are saved to Neon Postgres immediately
              </span>
            </div>
            <RecordForm
              initial={record}
              onSubmit={handleUpdate}
              onCancel={() => setIsEditing(false)}
              loading={saving}
            />
          </div>
        </div>
      )}

      {/* View Mode */}
      {!isEditing && record && (
        <div style={{ maxWidth: 900 }}>

          {/* Identity card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
              {/* Avatar */}
              <div style={{
                width: 64, height: 64,
                background: `hsl(${(record.name?.charCodeAt(0) || 200) % 360}deg 40% 88%)`,
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, fontWeight: 700,
                color: `hsl(${(record.name?.charCodeAt(0) || 200) % 360}deg 40% 35%)`,
                flexShrink: 0,
              }}>
                {(record.name || record.company || "?")[0].toUpperCase()}
              </div>

              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--brand-primary)", marginBottom: 4 }}>
                  {record.name || "—"}
                </h2>
                {record.company && (
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 10 }}>{record.company}</div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <StatusBadge value={record.status} />
                  {record.stage && <StatusBadge value={record.stage} type="stage" />}
                  {record.source && <SourceBadge value={record.source} />}
                  {overdue && (
                    <span className="badge badge-amber">⚠ Follow-up Overdue</span>
                  )}
                </div>
              </div>

              {/* Value */}
              {record.value && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 4 }}>Deal Value</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--brand-accent)" }}>
                    PKR {Number(record.value).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div className="card">
              <SectionTitle>Contact Details</SectionTitle>
              <DetailGrid>
                <Detail label="Phone" value={record.phone} type="phone" />
                <Detail label="Email" value={record.email} type="email" />
                <Detail label="City / Area" value={record.city} />
              </DetailGrid>
            </div>

            <div className="card">
              <SectionTitle>Pipeline Info</SectionTitle>
              <DetailGrid>
                <Detail label="Assigned To" value={record.assigned_to} />
                <Detail label="Follow-up Date" value={fmtDate(record.follow_up)}
                  style={overdue ? { color: "var(--red)", fontWeight: 600 } : {}}
                />
                <Detail label="Tags" value={record.tags} />
              </DetailGrid>
            </div>
          </div>

          {/* Notes */}
          {record.notes && (
            <div className="card" style={{ marginBottom: 16 }}>
              <SectionTitle>Notes & Remarks</SectionTitle>
              <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--text-secondary)", whiteSpace: "pre-wrap", marginTop: 4 }}>
                {record.notes}
              </p>
            </div>
          )}

          {/* Extra fields (dynamic columns from data source) */}
          {record._extra && Object.keys(record._extra).length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <SectionTitle>Additional Fields</SectionTitle>
              <DetailGrid>
                {Object.entries(record._extra)
                  .filter(([, v]) => v && v !== "")
                  .map(([k, v]) => (
                    <Detail
                      key={k}
                      label={k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                      value={v}
                    />
                  ))}
              </DetailGrid>
            </div>
          )}

          {/* Meta */}
          <div className="card">
            <SectionTitle>Record Metadata</SectionTitle>
            <DetailGrid>
              <Detail label="Row Index" value={`Row ${record._rowIndex}`} />
              <Detail label="Created" value={fmtDate(record.created_at)} />
              <Detail label="Last Updated" value={fmtDate(record.updated_at)} />
            </DetailGrid>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={showDelete}
        title="Delete Lead"
        message={`Delete "${record?.name || record?.company || "this record"}"? It will be marked as Deleted in the database.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </Layout>
    </AuthGuard>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.09em", color: "var(--text-muted)",
      marginBottom: 14, paddingBottom: 10,
      borderBottom: "1px solid var(--border)",
    }}>{children}</div>
  );
}

function DetailGrid({ children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {children}
    </div>
  );
}

function Detail({ label, value, type, style = {} }) {
  if (!value) return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>—</div>
    </div>
  );

  let display = <span style={{ fontSize: 13.5, color: "var(--text-primary)", ...style }}>{value}</span>;

  if (type === "phone") {
    display = <a href={`tel:${value}`} style={{ fontSize: 13.5, color: "var(--brand-primary)", textDecoration: "none", fontWeight: 600 }}>{value}</a>;
  } else if (type === "email") {
    display = <a href={`mailto:${value}`} style={{ fontSize: 13.5, color: "var(--brand-primary)", textDecoration: "none" }}>{value}</a>;
  }

  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
      {display}
    </div>
  );
}

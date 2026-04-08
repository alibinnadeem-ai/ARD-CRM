/**
 * pages/index.jsx
 * ARD CRM — Dashboard
 */
import Link from "next/link";
import Layout from "../components/ui/Layout";
import AuthGuard from "../components/ui/AuthGuard";
import KPICard from "../components/dashboard/KPICard";
import QuickStats from "../components/dashboard/QuickStats";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import RecentLeads from "../components/dashboard/RecentLeads";
import {
  StatusDonut,
  SourceBarChart,
  AgentBarChart,
  StagePipelineChart,
} from "../components/charts/DashboardCharts";
import { useSync, useLeads } from "../hooks/useLeads";

function fmtCompact(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}
function fmtPKR(n) {
  if (!n) return "PKR 0";
  if (n >= 10_000_000) return `PKR ${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `PKR ${(n / 100_000).toFixed(1)} Lac`;
  return `PKR ${n.toLocaleString()}`;
}

export default function Dashboard() {
  const { data: syncData, loading: syncLoading, syncedAt, refresh } = useSync();
  const { records, loading: leadsLoading } = useLeads();

  const loading = syncLoading || leadsLoading;
  const kpis    = syncData?.kpis   || {};
  const charts  = syncData?.charts || {};
  const meta    = syncData?.meta   || {};

  const CARD_GRID = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))",
    gap: 14,
    marginBottom: 18,
  };

  const CHART_ROW = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
    marginBottom: 18,
  };

  return (
    <AuthGuard>
    <Layout
      title="Dashboard"
      syncedAt={syncedAt}
      onRefresh={refresh}
      loading={loading}
    >
      {/* ── Page header ───────────────────────────────────────────────── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:14 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:700, color:"var(--brand-primary)", lineHeight:1.1 }}>
            Sales Intelligence
          </h1>
          <p style={{ color:"var(--text-muted)", fontSize:13.5, marginTop:5 }}>
            {meta.title || "ARD CRM"} · Live Neon Postgres · auto-syncs every 90s
          </p>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <Link href="/leads/new" className="btn btn-accent">+ New Lead</Link>
          <Link href="/leads" className="btn btn-ghost">View All →</Link>
        </div>
      </div>

      {/* ── Loading hint ──────────────────────────────────────────────── */}
      {loading && !syncData && (
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20, color:"var(--text-muted)", fontSize:13.5 }}>
          <span className="spinner" /> Connecting to Neon Postgres…
        </div>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────────────── */}
      <div style={CARD_GRID}>
        <KPICard
          label="Total Records"
          value={fmtCompact(kpis.totalRecords)}
          icon="◈"
          color="var(--brand-primary)"
          sub="in database"
        />
        <KPICard
          label="Active Clients"
          value={fmtCompact(kpis.activeClients)}
          icon="●"
          color="#22c55e"
          sub="not lost or deleted"
        />
        <KPICard
          label="New Leads"
          value={fmtCompact(kpis.newLeads)}
          icon="✦"
          color="#3b82f6"
          sub="awaiting contact"
        />
        <KPICard
          label="Follow-ups Due"
          value={fmtCompact(kpis.followUpsDue)}
          icon="⏰"
          color={kpis.followUpsDue > 0 ? "#f59e0b" : "#22c55e"}
          sub={kpis.followUpsDue > 0 ? "needs attention now" : "all clear"}
        />
        <KPICard
          label="Won Deals"
          value={fmtCompact(kpis.wonDeals)}
          icon="★"
          color="#22c55e"
          sub={`${kpis.conversionRate ?? 0}% conversion rate`}
        />
        <KPICard
          label="Pipeline Value"
          value={fmtPKR(kpis.totalPipelineValue)}
          icon="₨"
          color="var(--brand-accent)"
          sub={`Won: ${fmtPKR(kpis.wonValue)}`}
        />
      </div>

      {/* ── Quick Stats strip ─────────────────────────────────────────── */}
      <QuickStats kpis={kpis} />

      {/* ── Charts row 1 ─────────────────────────────────────────────── */}
      <div style={CHART_ROW}>
        <div className="card">
          <ChartHeader title="Status Distribution" sub="All leads by current status" />
          <StatusDonut data={charts.statusDistribution} />
        </div>
        <div className="card">
          <ChartHeader title="Lead Sources" sub="Where your leads come from" />
          <SourceBarChart data={charts.sourceDistribution} />
        </div>
      </div>

      {/* ── Charts row 2 ─────────────────────────────────────────────── */}
      <div style={CHART_ROW}>
        <div className="card">
          <ChartHeader title="Agent Performance" sub="Leads assigned per agent / BDM" />
          <AgentBarChart data={charts.agentSummary} />
        </div>
        <div className="card">
          <ChartHeader title="Pipeline Funnel" sub="Leads by deal stage" />
          <StagePipelineChart data={charts.stagePipeline} />
        </div>
      </div>

      {/* ── Bottom row ───────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.65fr", gap:18 }}>
        <div className="card">
          <ChartHeader title="Insights" sub="Auto-generated from your data" />
          <InsightsPanel kpis={kpis} charts={charts} />
        </div>
        <div className="card">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <ChartHeader title="Recent Leads" sub={`Last ${Math.min(8, records.length)} added`} noMargin />
            <Link href="/leads" className="btn btn-ghost btn-sm">View all →</Link>
          </div>
          <RecentLeads records={records} />
        </div>
      </div>

      {/* ── Footer quick-actions ─────────────────────────────────────── */}
      <div style={{
        marginTop: 20,
        padding: "14px 20px",
        background: "var(--brand-primary)",
        borderRadius: "var(--radius-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <div style={{ color:"white", fontWeight:600, fontSize:14 }}>ARD Builders & Developers</div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:12 }}>CRM v1.0 · Neon Postgres · Vercel-Ready</div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <a href="/api/health" target="_blank" style={{ color:"rgba(255,255,255,0.6)", fontSize:12.5, textDecoration:"none" }}>
            Health check
          </a>
          <span style={{ color:"rgba(255,255,255,0.2)" }}>·</span>
          <Link href="/integrations" style={{ color:"rgba(255,255,255,0.6)", fontSize:12.5, textDecoration:"none" }}>
            Integrations
          </Link>
          <span style={{ color:"rgba(255,255,255,0.2)" }}>·</span>
          <a href="/api/export/csv" style={{ color:"rgba(255,255,255,0.6)", fontSize:12.5, textDecoration:"none" }}>
            Export CSV
          </a>
        </div>
      </div>
    </Layout>
    </AuthGuard>
  );
}

function ChartHeader({ title, sub, noMargin }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 16 }}>
      <div style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>{title}</div>
      {sub && <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

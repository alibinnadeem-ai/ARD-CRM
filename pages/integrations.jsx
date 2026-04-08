/**
 * pages/integrations.jsx
 * External integrations are intentionally disabled.
 */
import Link from "next/link";
import Layout from "../components/ui/Layout";
import AuthGuard from "../components/ui/AuthGuard";

const CARD_STYLE = {
  maxWidth: 760,
  padding: "28px 30px",
};

export default function IntegrationsPage() {
  return (
    <AuthGuard>
      <Layout title="Integrations Disabled">
        <div className="card" style={CARD_STYLE}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--brand-primary)", marginBottom: 8 }}>
              External integrations are disabled
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.7 }}>
              This CRM is now configured for internal lead management only. External pull jobs,
              webhooks, and third-party connector imports are turned off.
            </p>
          </div>

          <div style={{
            display: "grid",
            gap: 12,
            marginBottom: 24,
          }}>
            {[
              "Use New Lead to add records manually.",
              "Use All Leads to search, review, edit, and export records.",
              "External API endpoints under /api/integrations now return a disabled response.",
            ].map((item) => (
              <div
                key={item}
                style={{
                  background: "var(--bg-page)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  fontSize: 13.5,
                  color: "var(--text-secondary)",
                }}
              >
                {item}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/leads/new" className="btn btn-accent">+ New Lead</Link>
            <Link href="/leads" className="btn btn-ghost">View All Leads</Link>
          </div>
        </div>
      </Layout>
    </AuthGuard>
  );
}

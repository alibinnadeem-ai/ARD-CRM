/**
 * pages/integrations.jsx
 * Integration Hub — connector status, webhook URL, env checklist
 */
import { useState, useEffect } from "react";
import Layout from "../components/ui/Layout";
import AuthGuard from "../components/ui/AuthGuard";

const CONNECTOR_DOCS = {
  multitechno: {
    label: "MultiTechno ERP",
    icon: "🏢",
    description: "Sync leads and clients two-way with MultiTechno ERP. Won deals auto-push to ERP on status change.",
    envVars: ["MULTITECHNO_API_URL", "MULTITECHNO_API_KEY"],
    docs: "Set enabled: true in lib/connectors/index.js → MultiTechnoConnector",
  },
  telecrm: {
    label: "TeleCRM",
    icon: "📞",
    description: "Pull contacted leads from TeleCRM and sync call notes back into the CRM database.",
    envVars: ["TELECRM_API_URL", "TELECRM_API_KEY"],
    docs: "Set enabled: true in lib/connectors/index.js → TeleCRMConnector",
  },
  metaAds: {
    label: "Meta / Facebook Lead Ads",
    icon: "📣",
    description: "Automatically pull inbound leads from Facebook Lead Ad forms into the CRM.",
    envVars: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"],
    docs: "Set enabled: true in lib/connectors/index.js → MetaAdsConnector",
  },
  webhook: {
    label: "Inbound Webhook",
    icon: "⚡",
    description: "Receive leads from any platform (Zameen, OLX, website forms, Ufone vPBX) via HTTP POST.",
    envVars: ["WEBHOOK_SECRET"],
    docs: "Always active. POST to /api/integrations/webhook with x-webhook-secret header.",
  },
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      style={{ fontSize: 11.5 }}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ children }) {
  return (
    <code style={{
      display: "block",
      background: "#0f1923",
      color: "#a3e7bc",
      padding: "14px 16px",
      borderRadius: 8,
      fontSize: 12.5,
      fontFamily: "monospace",
      overflowX: "auto",
      lineHeight: 1.7,
      whiteSpace: "pre",
    }}>{children}</code>
  );
}

export default function IntegrationsPage() {
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/integrations/status", { headers: { Authorization: `Bearer ${localStorage.getItem("ard_crm_token")}` } })
      .then(r => r.json())
      .then(d => { setConnectors(d.connectors || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/integrations/webhook`
    : "/api/integrations/webhook";

  return (
    <AuthGuard>
    <Layout title="Integrations">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--brand-primary)" }}>Integration Hub</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginTop: 4 }}>
          Connect ARD CRM to MultiTechno ERP, TeleCRM, Meta Ads, and any webhook-capable platform.
        </p>
      </div>

      {/* Connector Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
        {loading ? (
          <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: 10, padding: 32, color: "var(--text-muted)" }}>
            <span className="spinner" /> Loading connector status…
          </div>
        ) : (
          Object.entries(CONNECTOR_DOCS).map(([key, meta]) => {
            const live = connectors.find(c => c.key === key);
            const enabled = live?.enabled ?? (key === "webhook");
            return (
              <div key={key} className="card" style={{ position: "relative" }}>
                {/* Status indicator */}
                <div style={{
                  position: "absolute", top: 20, right: 20,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: enabled ? "var(--green)" : "var(--text-muted)",
                    boxShadow: enabled ? "0 0 0 3px rgba(34,197,94,0.2)" : "none",
                  }} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: enabled ? "#15803d" : "var(--text-muted)" }}>
                    {enabled ? "ACTIVE" : "DISABLED"}
                  </span>
                </div>

                <div style={{ fontSize: 24, marginBottom: 10 }}>{meta.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{meta.label}</div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
                  {meta.description}
                </p>

                {/* Env vars checklist */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 8 }}>
                    Required Env Vars
                  </div>
                  {meta.envVars.map(v => (
                    <div key={v} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: "50%",
                        background: enabled ? "#dcfce7" : "#f1f5f9",
                        color: enabled ? "#15803d" : "var(--text-muted)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700, flexShrink: 0,
                      }}>{enabled ? "✓" : "–"}</span>
                      <code style={{ fontSize: 11.5, color: "var(--brand-primary)", background: "#f0f6ff", padding: "2px 6px", borderRadius: 4 }}>
                        {v}
                      </code>
                    </div>
                  ))}
                </div>

                <div style={{
                  fontSize: 12, color: "var(--text-muted)",
                  background: "var(--bg-page)", padding: "10px 12px",
                  borderRadius: 6, fontFamily: "monospace",
                  lineHeight: 1.5,
                }}>
                  {meta.docs}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Webhook Endpoint */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>⚡ Inbound Webhook Endpoint</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              POST leads from any external source — forms, platforms, or automation tools
            </p>
          </div>
          <span className="badge badge-green">Always Active</span>
        </div>

        {/* URL */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
          <div style={{
            flex: 1, background: "var(--bg-page)", border: "1.5px solid var(--border)",
            borderRadius: 8, padding: "11px 14px",
            fontFamily: "monospace", fontSize: 13,
            color: "var(--brand-primary)", wordBreak: "break-all",
          }}>
            POST {webhookUrl}
          </div>
          <CopyButton text={webhookUrl} />
        </div>

        {/* Request format */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 8 }}>
            Request Format
          </div>
          <CodeBlock>{`POST /api/integrations/webhook
Headers:
  Content-Type: application/json
  x-webhook-secret: YOUR_WEBHOOK_SECRET

Body:
{
  "source": "facebook_ads",     // or "zameen", "olx", "website_form", etc.
  "payload": {
    "name": "Ahmed Raza",
    "phone": "+92 300 0000000",
    "email": "ahmed@example.com",
    "company": "ARD City Inquiry",
    "message": "Interested in Block B apartments",
    "city": "Islamabad"
  }
}`}</CodeBlock>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 8 }}>
            Response
          </div>
          <CodeBlock>{`{
  "success": true,
  "message": "Lead received and saved",
  "id": "ARD-1748012345678"
}`}</CodeBlock>
        </div>
      </div>

      {/* Environment Variables Reference */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>🔐 Environment Variables Reference</h3>
        <CodeBlock>{`# .env.local — never commit this file

# ── Core (Required) ──────────────────────────────────────
      DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
WEBHOOK_SECRET=your-secure-random-secret
      API_SECRET_TOKEN=optional-internal-token

# ── MultiTechno ERP (Optional) ──────────────────────────
MULTITECHNO_API_URL=https://erp.multitechno.com
MULTITECHNO_API_KEY=

# ── TeleCRM (Optional) ──────────────────────────────────
TELECRM_API_URL=
TELECRM_API_KEY=

# ── Meta / Facebook Ads (Optional) ──────────────────────
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=`}</CodeBlock>
      </div>

      {/* MultiTechno ERP Sync Plan */}
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>🏢 MultiTechno ERP — Two-Way Sync Architecture</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          When ready to activate, the sync flow works as follows:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { dir: "CRM → ERP", desc: "On lead status change to 'Won', push full record to MultiTechno via REST API. Map CRM fields to ERP schema using transform layer." },
            { dir: "ERP → CRM", desc: "Scheduled pull from MultiTechno ERP fetches new/updated clients. Transformed and upserted into Neon Postgres." },
            { dir: "Webhook Push", desc: "ERP posts updates to /api/integrations/webhook. CRM receives, transforms, and updates the matching database record." },
            { dir: "Field Mapping", desc: "lib/connectors/index.js MultiTechnoConnector.transform() maps ERP fields to CRM canonical fields. Edit to match your ERP schema." },
          ].map((item) => (
            <div key={item.dir} style={{
              padding: "14px 16px",
              background: "var(--bg-page)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand-primary)", marginBottom: 6 }}>{item.dir}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
    </AuthGuard>
  );
}

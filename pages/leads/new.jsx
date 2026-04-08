/**
 * pages/leads/new.jsx
 * Create a new lead — saves directly to database
 */
import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Layout from "../../components/ui/Layout";
import AuthGuard from "../../components/ui/AuthGuard";
import RecordForm from "../../components/records/RecordForm";
import { useToast } from "../../components/ui/Toast";
import { readApiResponse } from "../../utils/helpers";

export default function NewLeadPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData) {
    setLoading(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...({ Authorization: `Bearer ${localStorage.getItem("ard_crm_token")}` }),
        },
        body: JSON.stringify(formData),
      });
      await readApiResponse(res, "Failed to create lead");
      toast("Lead created successfully! Saved to database.", "success");
      router.push("/leads");
    } catch (err) {
      toast("Failed to save: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard>
    <Layout title="New Lead">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <Link href="/leads" style={{
          display: "flex", alignItems: "center", gap: 6,
          color: "var(--text-muted)", textDecoration: "none", fontSize: 13.5,
        }}>
          ← All Leads
        </Link>
        <span style={{ color: "var(--border)" }}>›</span>
        <span style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>New Lead</span>
      </div>

      <div style={{ maxWidth: 780 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--brand-primary)" }}>Create New Lead</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13.5, marginTop: 4 }}>
            Fill in the details below. The record will be saved directly to Neon Postgres.
          </p>
        </div>

        <div className="card">
          <RecordForm
            onSubmit={handleSubmit}
            onCancel={() => router.push("/leads")}
            loading={loading}
          />
        </div>
      </div>
    </Layout>
    </AuthGuard>
  );
}

/**
 * pages/404.jsx
 */
import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-page)",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      gap: 16,
      textAlign: "center",
      padding: 32,
    }}>
      <div style={{
        fontSize: 72, fontWeight: 700,
        fontFamily: "'Bricolage Grotesque', sans-serif",
        color: "var(--brand-primary)",
        lineHeight: 1,
      }}>404</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
        Page Not Found
      </div>
      <div style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 320 }}>
        This page doesn't exist in the ARD CRM. Head back to the dashboard.
      </div>
      <Link href="/" className="btn btn-primary" style={{ marginTop: 8 }}>
        ← Back to Dashboard
      </Link>
    </div>
  );
}

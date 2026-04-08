/**
 * components/ui/Sidebar.jsx
 */
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../../hooks/useAuth";

const NAV = [
  { href: "/", label: "Dashboard", icon: "⬡" },
  { href: "/leads", label: "All Leads", icon: "◈" },
  { href: "/leads/new", label: "New Lead", icon: "＋" },
];

export default function Sidebar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside style={{
      width: "var(--sidebar-w)",
      minHeight: "100vh",
      background: "var(--bg-sidebar)",
      display: "flex",
      flexDirection: "column",
      padding: "0",
      position: "fixed",
      top: 0,
      left: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        padding: "28px 24px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: 36, height: 36,
            background: "var(--brand-accent)",
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "white",
          }}>A</div>
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif" }}>ARD CRM</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>Sales Intelligence</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        {NAV.map((item) => {
          const active = router.pathname === item.href ||
            (item.href !== "/" && router.pathname.startsWith(item.href) && item.href !== "/leads/new");
          return (
            <Link key={item.href} href={item.href} style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              color: active ? "white" : "rgba(255,255,255,0.55)",
              background: active ? "rgba(255,255,255,0.12)" : "transparent",
              fontSize: 13.5,
              fontWeight: active ? 600 : 400,
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 15, opacity: active ? 1 : 0.6 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Utility Link */}
      <div style={{ padding: "16px 12px 24px" }}>
        {user && (
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
              border: "none",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
              marginBottom: 12,
            }}
          >
            <span>⏻</span>
            Logout{user.name ? ` (${user.name})` : ""}
          </button>
        )}
        <a
          href="/api/health"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: "var(--radius-md)",
            background: "rgba(232,99,58,0.18)",
            color: "#f4a07a",
            textDecoration: "none",
            fontSize: 12.5,
            fontWeight: 600,
            border: "1px solid rgba(232,99,58,0.25)",
          }}
        >
          <span>↗</span>
          Open Health Check
        </a>
        <div style={{ marginTop: 16, padding: "0 4px" }}>
          <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10.5 }}>ARD Builders & Developers</div>
          <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 10 }}>v1.0 · Neon Postgres CRM</div>
        </div>
      </div>
    </aside>
  );
}

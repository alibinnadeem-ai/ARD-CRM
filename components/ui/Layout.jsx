/**
 * components/ui/Layout.jsx
 */
import Sidebar from "./Sidebar";
import { useState } from "react";

export default function Layout({ children, title = "ARD CRM", syncedAt, onRefresh, loading }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{
        marginLeft: "var(--sidebar-w)",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}>
        {/* Top header */}
        <header style={{
          height: "var(--header-h)",
          background: "white",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Bricolage Grotesque', sans-serif", color: "var(--brand-primary)" }}>
            {title}
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {syncedAt && (
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                Synced {new Date(syncedAt).toLocaleTimeString()}
              </span>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="btn btn-ghost btn-sm"
                title="Refresh from database"
              >
                {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "↻"}
                {" "}Refresh
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "28px", maxWidth: 1400, width: "100%" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

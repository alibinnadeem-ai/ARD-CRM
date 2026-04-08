/**
 * components/ui/AuthGuard.jsx
 * Redirects to /login if the user is not authenticated.
 */

import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text-muted)", fontSize: 14 }}>
        <span className="spinner" style={{ marginRight: 10 }} /> Loading...
      </div>
    );
  }

  if (!user) return null;

  return children;
}

/**
 * components/ui/Toast.jsx
 * Global toast notification system
 */
import { useState, useEffect, createContext, useContext, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success", duration = 3500) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={{
        position: "fixed", bottom: 28, right: 28,
        zIndex: 9999, display: "flex", flexDirection: "column", gap: 10,
        maxWidth: 360,
      }}>
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}

function Toast({ message, type }) {
  const bg = type === "success" ? "#0f5132" : type === "error" ? "#842029" : "#664d03";
  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";

  return (
    <div style={{
      background: bg,
      color: "white",
      padding: "13px 18px",
      borderRadius: 10,
      fontSize: 13.5,
      fontWeight: 500,
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      animation: "slideUp 0.25s ease",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <span style={{
        width: 22, height: 22,
        background: "rgba(255,255,255,0.15)",
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, flexShrink: 0,
      }}>{icon}</span>
      {message}
    </div>
  );
}

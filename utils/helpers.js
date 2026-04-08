/**
 * utils/helpers.js
 * Shared utility functions across the CRM
 */

// ─── Date Formatting ─────────────────────────────────────────────────────────

export function formatDate(val, options = {}) {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d)) return val;
    return d.toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
      ...options,
    });
  } catch {
    return val;
  }
}

export function formatDateTime(val) {
  return formatDate(val, { hour: "2-digit", minute: "2-digit" });
}

export function isOverdue(dateVal) {
  if (!dateVal) return false;
  try {
    return new Date(dateVal) < new Date();
  } catch {
    return false;
  }
}

export function daysUntil(dateVal) {
  if (!dateVal) return null;
  try {
    const diff = new Date(dateVal) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

// ─── Number Formatting ───────────────────────────────────────────────────────

export function formatPKR(n) {
  const num = parseFloat(String(n || "").replace(/[^0-9.]/g, "")) || 0;
  if (num >= 10_000_000) return `PKR ${(num / 10_000_000).toFixed(2)} Cr`;
  if (num >= 100_000) return `PKR ${(num / 100_000).toFixed(1)} Lac`;
  if (num >= 1_000) return `PKR ${(num / 1_000).toFixed(0)}K`;
  return `PKR ${num.toLocaleString()}`;
}

export function formatCompact(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

// ─── String Utilities ────────────────────────────────────────────────────────

export function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

export function avatarColor(name) {
  const hue = ((name || "").charCodeAt(0) || 200) % 360;
  return {
    background: `hsl(${hue}deg 40% 88%)`,
    color: `hsl(${hue}deg 40% 30%)`,
  };
}

export function truncate(str, len = 40) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

export function slugify(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}

export function isValidPhone(phone) {
  return /^[+0-9\s\-()]{7,20}$/.test(phone || "");
}

export function validateLeadForm(form) {
  const errors = {};
  if (!form.name?.trim() && !form.email?.trim() && !form.phone?.trim()) {
    errors._base = "At least one of Name, Email, or Phone is required.";
  }
  if (form.email && !isValidEmail(form.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (form.phone && !isValidPhone(form.phone)) {
    errors.phone = "Enter a valid phone number.";
  }
  return errors;
}

// ─── CSV Utilities ───────────────────────────────────────────────────────────

export function downloadCSV(headers, rows, filename = "export.csv") {
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Debounce ────────────────────────────────────────────────────────────────

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ─── API helpers ─────────────────────────────────────────────────────────────

export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return readApiResponse(res);
}

export async function readApiResponse(res, fallbackMessage = "Request failed") {
  const contentType = res.headers?.get?.("content-type") || "";
  const text = await res.text();
  const looksLikeJson =
    contentType.includes("application/json") || /^[\s\r\n]*[{[]/.test(text);

  if (looksLikeJson) {
    try {
      const data = JSON.parse(text);
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || fallbackMessage);
      }
      return data;
    } catch (err) {
      if (err instanceof Error && err.message !== "Unexpected end of JSON input") {
        throw err;
      }
    }
  }

  const looksLikeHtml =
    contentType.includes("text/html") || /^\s*</.test(text);
  const redirectedToLogin =
    res.redirected ||
    /\/login(?:[/?#]|$)/i.test(res.url || "") ||
    /<title>\s*login/i.test(text) ||
    /<form[^>]+/i.test(text);

  if (res.status === 401 || res.status === 403 || (looksLikeHtml && redirectedToLogin)) {
    throw new Error("Your session expired. Please log in again.");
  }

  if (looksLikeHtml) {
    throw new Error(`Server returned HTML instead of JSON (${res.status} ${res.statusText})`);
  }

  if (!res.ok) {
    throw new Error(text.trim() || `${fallbackMessage} (${res.status} ${res.statusText})`);
  }

  throw new Error(text.trim() || fallbackMessage);
}

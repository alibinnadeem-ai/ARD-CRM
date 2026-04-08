/**
 * config/crm.js
 * CRM-wide configuration constants
 * Edit this file to customize for your deployment
 */

export const CRM_CONFIG = {
  // App identity
  appName: "ARD CRM",
  appSubtitle: "Sales Intelligence",
  companyName: "ARD Builders & Developers",
  companyShort: "ARD City",

  // Data source
  dataSource: "Neon Postgres",
  dataTable: "public.leads",

  // Auto-refresh interval (ms)
  refreshInterval: 90_000,

  // Pagination
  defaultPageSize: 25,
  pageSizeOptions: [10, 25, 50, 100],

  // Currency
  currency: "PKR",
  locale: "en-PK",

  // Default sort
  defaultSort: { field: "created_at", dir: "desc" },

  // Soft delete: true = mark status="Deleted", false = clear row
  softDelete: true,

  // Follow-up warning threshold (days before overdue)
  followUpWarningDays: 1,

  // Theme colors (matches globals.css vars)
  colors: {
    primary: "#1a3a5c",
    accent: "#e8633a",
    green: "#22c55e",
    amber: "#f59e0b",
    red: "#ef4444",
    blue: "#3b82f6",
  },

  // Sales verticals (for future B2G/B2B/B2C filtering)
  salesVerticals: ["B2C", "B2B", "B2G", "Channel Partners", "Overseas/NRP"],

  // Quick filter presets
  quickFilters: [
    { label: "New Leads", status: "New Lead" },
    { label: "Follow-ups Due", preset: "followup_overdue" },
    { label: "Won Deals", status: "Won" },
    { label: "Unassigned", preset: "unassigned" },
  ],
};

export default CRM_CONFIG;

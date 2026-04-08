/**
 * lib/transforms/mapper.js
 * Column mapping & data normalization layer.
 *
 * Maps raw record headers to CRM canonical fields.
 * Edit FIELD_MAP to match your source field names.
 * Unknown columns are passed through as-is (dynamic support).
 */

// ─── Canonical CRM field → possible source column aliases ────────────────────
export const FIELD_MAP = {
  id:           ["id", "lead_id", "record_id", "uid"],
  name:         ["name", "full_name", "client_name", "contact_name", "lead_name"],
  company:      ["company", "company_name", "organization", "firm", "account"],
  email:        ["email", "email_address", "e-mail"],
  phone:        ["phone", "phone_number", "mobile", "cell", "contact_no"],
  status:       ["status", "lead_status", "record_status"],
  stage:        ["stage", "pipeline_stage", "deal_stage", "funnel_stage"],
  source:       ["source", "lead_source", "origin", "channel"],
  assigned_to:  ["assigned_to", "assigned", "owner", "agent", "sales_rep", "bdm"],
  notes:        ["notes", "note", "remarks", "comments", "description"],
  tags:         ["tags", "tag", "label", "labels"],
  follow_up:    ["follow_up", "follow_up_date", "next_action", "callback_date"],
  created_at:   ["created_at", "date_added", "created_date", "date_created"],
  updated_at:   ["updated_at", "last_updated", "modified_date"],
  value:        ["value", "deal_value", "amount", "revenue", "budget"],
  city:         ["city", "location", "area"],
  deleted:      ["deleted", "is_deleted", "archived"],
};

// Reverse map: source_key → canonical_key
let _reverseMap = null;
function getReverseMap() {
  if (_reverseMap) return _reverseMap;
  _reverseMap = {};
  for (const [canonical, aliases] of Object.entries(FIELD_MAP)) {
    for (const alias of aliases) {
      _reverseMap[alias.toLowerCase()] = canonical;
    }
  }
  return _reverseMap;
}

/**
 * Normalize a raw record → CRM record.
 * Unknown columns are preserved under their original key.
 */
export function normalizeRecord(raw) {
  const reverseMap = getReverseMap();
  const normalized = {};
  const extra = {};

  for (const [key, val] of Object.entries(raw)) {
    if (key === "_rowIndex") {
      normalized._rowIndex = val;
      continue;
    }
    const canonical = reverseMap[key.toLowerCase()];
    if (canonical) {
      normalized[canonical] = val;
    } else {
      extra[key] = val;
    }
  }

  normalized._extra = extra;
  return normalized;
}

/**
 * Denormalize a CRM record → row object (using actual headers).
 */
export function denormalizeRecord(crmRecord, headers) {
  const reverseMap = getReverseMap();
  const row = {};

  for (const header of headers) {
    const canonical = reverseMap[header.toLowerCase()] || header;
    row[header] = crmRecord[canonical] ?? crmRecord._extra?.[header] ?? "";
  }

  return row;
}

function hasTextValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function hasLeadIdentity(record = {}) {
  return ["name", "company", "email", "phone"].some((field) =>
    hasTextValue(record[field])
  );
}

export function isDeletedRecord(record = {}) {
  return (
    record.status === "Deleted" ||
    String(record.deleted || "").toUpperCase() === "TRUE" ||
    String(record._extra?.deleted || "").toUpperCase() === "TRUE"
  );
}

export function isVisibleLeadRecord(record = {}) {
  return hasLeadIdentity(record) && !isDeletedRecord(record);
}

// ─── Status / Stage Enums ────────────────────────────────────────────────────
export const STATUS_OPTIONS = [
  "New Lead",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost",
  "On Hold",
  "Deleted",
];

export const STAGE_OPTIONS = [
  "Awareness",
  "Interest",
  "Consideration",
  "Intent",
  "Evaluation",
  "Purchase",
  "Post-Sale",
];

export const SOURCE_OPTIONS = [
  "Walk-in",
  "Website",
  "Referral",
  "Social Media",
  "Facebook Ads",
  "Google Ads",
  "Cold Call",
  "TeleCRM",
  "Ufone vPBX",
  "Channel Partner",
  "Expo / Event",
  "Sales Sheet",
  "WhatsApp Incoming",
  "Phone Incoming",
  "Other",
];

// ─── KPI computation from normalized records ──────────────────────────────────
export function computeKPIs(records) {
  const active = records.filter(
    (r) => r.status && !["Deleted", "Lost"].includes(r.status)
  );
  const newLeads = records.filter((r) => r.status === "New Lead");
  const won = records.filter((r) => r.status === "Won");
  const lost = records.filter((r) => r.status === "Lost");

  const today = new Date();
  const followUpsDue = records.filter((r) => {
    if (!r.follow_up) return false;
    const d = new Date(r.follow_up);
    return !isNaN(d) && d <= today && r.status !== "Won" && r.status !== "Lost";
  });

  const totalValue = records.reduce((sum, r) => {
    const v = parseFloat(String(r.value || "").replace(/[^0-9.]/g, "")) || 0;
    return sum + v;
  }, 0);

  const wonValue = won.reduce((sum, r) => {
    const v = parseFloat(String(r.value || "").replace(/[^0-9.]/g, "")) || 0;
    return sum + v;
  }, 0);

  const conversionRate = records.length > 0
    ? ((won.length / records.length) * 100).toFixed(1)
    : "0.0";

  return {
    totalRecords: records.length,
    activeClients: active.length,
    newLeads: newLeads.length,
    followUpsDue: followUpsDue.length,
    wonDeals: won.length,
    lostDeals: lost.length,
    totalPipelineValue: totalValue,
    wonValue,
    conversionRate: parseFloat(conversionRate),
  };
}

export function computeStatusDistribution(records) {
  const counts = {};
  for (const r of records) {
    const s = r.status || "Unknown";
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export function computeSourceDistribution(records) {
  const counts = {};
  for (const r of records) {
    const s = r.source || "Unknown";
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function computeAgentSummary(records) {
  const counts = {};
  for (const r of records) {
    const a = r.assigned_to || "Unassigned";
    counts[a] = (counts[a] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function computeStagePipeline(records) {
  const counts = {};
  for (const r of records) {
    const s = r.stage || "Unknown";
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

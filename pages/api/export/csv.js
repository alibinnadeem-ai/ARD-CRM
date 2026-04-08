/**
 * pages/api/export/csv.js
 * GET /api/export/csv?status=Won&stage=Purchase
 * Exports filtered records as CSV download
 */

import { getAllRows } from "../../../lib/db/connector";
import { normalizeRecord, isVisibleLeadRecord } from "../../../lib/transforms/mapper";
import { requireAuth } from "../../../lib/auth";

function escapeCSV(val) {
  if (val == null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default requireAuth(async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const { records, headers } = await getAllRows();
    let normalized = records.map(normalizeRecord)
      .filter(isVisibleLeadRecord);

    // Optional filters
    if (req.query.status && req.query.status !== "All") {
      normalized = normalized.filter(r => r.status === req.query.status);
    }
    if (req.query.assigned_to) {
      normalized = normalized.filter(r => r.assigned_to === req.query.assigned_to);
    }

    // Build CSV columns (canonical + extra)
    const canonicalCols = ["id","name","company","email","phone","status","stage","source","assigned_to","value","city","follow_up","tags","notes","created_at","updated_at"];
    const extraCols = [...new Set(normalized.flatMap(r => Object.keys(r._extra || {})))];
    const cols = [...canonicalCols, ...extraCols];

    const header = cols.map(escapeCSV).join(",");
    const rows = normalized.map(r =>
      cols.map(c => escapeCSV(r[c] ?? r._extra?.[c] ?? "")).join(",")
    );

    const csv = [header, ...rows].join("\n");

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="ard-crm-export-${date}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * pages/api/leads/bulk.js
 * POST /api/leads/bulk
 * Bulk status update for multiple records
 *
 * Body: { rowIndexes: [2, 3, 5], action: "updateStatus", value: "Contacted" }
 */

import { getAllRows, updateRow } from "../../../lib/db/connector";
import { normalizeRecord, denormalizeRecord } from "../../../lib/transforms/mapper";
import { requireAuth } from "../../../lib/auth";

export default requireAuth(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { rowIndexes, action, value } = req.body || {};

  if (!Array.isArray(rowIndexes) || rowIndexes.length === 0) {
    return res.status(400).json({ success: false, error: "rowIndexes array is required" });
  }
  if (!action) {
    return res.status(400).json({ success: false, error: "action is required" });
  }

  try {
    const { headers, records } = await getAllRows();
    const results = [];
    const errors = [];

    for (const ri of rowIndexes) {
      const raw = records.find((r) => r._rowIndex === ri);
      if (!raw) {
        errors.push({ rowIndex: ri, error: "Not found" });
        continue;
      }

      const normalized = normalizeRecord(raw);

      try {
        if (action === "updateStatus") {
          normalized.status = value;
        } else if (action === "assignTo") {
          normalized.assigned_to = value;
        } else if (action === "updateStage") {
          normalized.stage = value;
        } else {
          errors.push({ rowIndex: ri, error: `Unknown action: ${action}` });
          continue;
        }

        normalized.updated_at = new Date().toISOString();
        const rowData = denormalizeRecord(normalized, headers);
        await updateRow(ri, rowData);
        results.push({ rowIndex: ri, success: true });
      } catch (err) {
        errors.push({ rowIndex: ri, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      updated: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

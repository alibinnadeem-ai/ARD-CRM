/**
 * pages/api/leads/[rowIndex].js
 * GET    /api/leads/:rowIndex  → get single record
 * PUT    /api/leads/:rowIndex  → update record
 * DELETE /api/leads/:rowIndex  → soft-delete record
 */

import { getAllRows, updateRow, deleteRow } from "../../../lib/db/connector";
import {
  normalizeRecord,
  denormalizeRecord,
  isVisibleLeadRecord,
} from "../../../lib/transforms/mapper";
import { requireAuth } from "../../../lib/auth";

export default requireAuth(async function handler(req, res) {
  const { rowIndex } = req.query;
  const ri = parseInt(rowIndex, 10);

  if (isNaN(ri)) {
    return res.status(400).json({ success: false, error: "Invalid rowIndex" });
  }

  if (req.method === "GET") {
    try {
      const { headers, records } = await getAllRows();
      const raw = records.find((r) => r._rowIndex === ri);
      if (!raw) return res.status(404).json({ success: false, error: "Not found" });
      const record = normalizeRecord(raw);
      if (!isVisibleLeadRecord(record)) {
        return res.status(404).json({ success: false, error: "Not found" });
      }
      return res.status(200).json({ success: true, record, headers });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === "PUT") {
    try {
      const { headers } = await getAllRows();
      const rowData = denormalizeRecord(req.body, headers);
      rowData.updated_at = new Date().toISOString();
      await updateRow(ri, rowData);
      return res.status(200).json({ success: true, message: "Record updated" });
    } catch (err) {
      console.error("[PUT /api/leads/:rowIndex]", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === "DELETE") {
    try {
      const softDelete = req.query.hard !== "true";
      await deleteRow(ri, softDelete);
      return res.status(200).json({ success: true, message: "Record deleted" });
    } catch (err) {
      console.error("[DELETE /api/leads/:rowIndex]", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});

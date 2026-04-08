/**
 * pages/api/leads/index.js
 * GET  /api/leads  → fetch all records from database
 * POST /api/leads  → append new record to database
 */

import { getAllRows, appendRow } from "../../../lib/db/connector";
import { normalizeRecord, isVisibleLeadRecord } from "../../../lib/transforms/mapper";
import { requireAuth } from "../../../lib/auth";

export default requireAuth(async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const { headers, records } = await getAllRows();
      const normalized = records.map(normalizeRecord);
      const visible = normalized.filter(isVisibleLeadRecord);
      return res.status(200).json({
        success: true,
        headers,
        records: visible,
        total: visible.length,
        syncedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[GET /api/leads]", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === "POST") {
    try {
      const body = req.body;
      if (!body.name && !body.email && !body.phone) {
        return res.status(400).json({
          success: false,
          error: "At least one of name, email, or phone is required.",
        });
      }

      body.created_at = body.created_at || new Date().toISOString();
      body.status = body.status || "New Lead";

      const result = await appendRow(body);
      return res.status(201).json({ success: true, record: result });
    } catch (err) {
      console.error("[POST /api/leads]", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});

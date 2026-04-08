/**
 * pages/api/leads/search.js
 * GET /api/leads/search?q=ahmed&status=New+Lead&limit=10
 * Fast server-side search across all lead fields
 */

import { getAllRows } from "../../../lib/db/connector";
import { normalizeRecord, isVisibleLeadRecord } from "../../../lib/transforms/mapper";
import { requireAuth } from "../../../lib/auth";

export default requireAuth(async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const q = (req.query.q || "").toLowerCase().trim();
  const status = req.query.status || "All";
  const limit = parseInt(req.query.limit || "20", 10);

  try {
    const { records } = await getAllRows();
    let normalized = records.map(normalizeRecord)
      .filter(isVisibleLeadRecord);

    if (status !== "All") {
      normalized = normalized.filter(r => r.status === status);
    }

    if (q) {
      normalized = normalized.filter(r => {
        const text = [
          r.name, r.company, r.email, r.phone,
          r.status, r.stage, r.source, r.assigned_to,
          r.notes, r.tags, r.city,
          ...Object.values(r._extra || {}),
        ].filter(Boolean).join(" ").toLowerCase();
        return text.includes(q);
      });
    }

    return res.status(200).json({
      success: true,
      results: normalized.slice(0, limit),
      count: normalized.length,
      query: q,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

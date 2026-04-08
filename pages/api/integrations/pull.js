/**
 * pages/api/integrations/pull.js
 * POST /api/integrations/pull
 * Triggers a pull from all enabled external connectors
 * and appends new records to the database
 *
 * Can be called manually from the Integrations page
 * or scheduled via Vercel Cron Jobs
 */

import { appendRow, getAllRows } from "../../../lib/db/connector";
import { normalizeRecord } from "../../../lib/transforms/mapper";
import { pullAllConnectors } from "../../../lib/connectors";
import { requireAuth } from "../../../lib/auth";

export default requireAuth(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const incoming = await pullAllConnectors();

    if (incoming.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No enabled connectors returned data.",
        imported: 0,
      });
    }

    // Deduplicate against existing records by phone + email
    const { records: existing } = await getAllRows();
    const normalized = existing.map(normalizeRecord);
    const existingPhones = new Set(normalized.map((r) => r.phone).filter(Boolean));
    const existingEmails = new Set(normalized.map((r) => r.email).filter(Boolean));

    const toImport = incoming.filter((lead) => {
      const phoneExists = lead.phone && existingPhones.has(lead.phone);
      const emailExists = lead.email && existingEmails.has(lead.email);
      return !phoneExists && !emailExists;
    });

    const results = [];
    for (const lead of toImport) {
      lead.created_at = lead.created_at || new Date().toISOString();
      lead.status = lead.status || "New Lead";
      const result = await appendRow(lead);
      results.push(result);
    }

    return res.status(200).json({
      success: true,
      message: `Pulled ${incoming.length} records, imported ${results.length} new (${incoming.length - results.length} duplicates skipped)`,
      imported: results.length,
      duplicatesSkipped: incoming.length - results.length,
      records: results,
    });
  } catch (err) {
    console.error("[POST /api/integrations/pull]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

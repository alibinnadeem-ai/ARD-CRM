/**
 * pages/api/integrations/webhook.js
 * POST /api/integrations/webhook
 *
 * Receives inbound lead payloads from external platforms:
 * - Facebook Lead Ads
 * - TeleCRM push
 * - Zameen / OLX webhook
 * - Custom form submissions
 *
 * Validates the source secret, transforms the payload,
 * and appends to the database automatically.
 */

import { appendRow } from "../../../lib/db/connector";
import { connectors } from "../../../lib/connectors";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validate webhook secret
  const secret = req.headers["x-webhook-secret"];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { source = "webhook", payload } = req.body;

    const transformed = await connectors.webhook.processInbound(payload, source);

    // Auto-append to database
    const result = await appendRow(transformed);

    return res.status(200).json({
      success: true,
      message: "Lead received and saved",
      id: result.id,
    });
  } catch (err) {
    console.error("[POST /api/integrations/webhook]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

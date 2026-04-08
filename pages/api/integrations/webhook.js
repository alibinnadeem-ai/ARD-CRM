/**
 * pages/api/integrations/webhook.js
 * External integrations are disabled for this deployment.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(410).json({
    success: false,
    error: "External webhook ingestion is disabled. Create leads inside the CRM instead.",
  });
}

/**
 * pages/api/integrations/pull.js
 * External integrations are disabled for this deployment.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  return res.status(410).json({
    success: false,
    error: "External lead imports are disabled. Use the New Lead form instead.",
  });
}

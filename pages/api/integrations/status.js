/**
 * pages/api/integrations/status.js
 * External integrations are disabled for this deployment.
 */

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  return res.status(410).json({
    success: false,
    error: "External integrations are disabled for this project.",
  });
}

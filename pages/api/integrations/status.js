/**
 * pages/api/integrations/status.js
 * GET /api/integrations/status → returns enabled/disabled state of all connectors
 */

import { connectors } from "../../../lib/connectors";
import { requireAuth } from "../../../lib/auth";

export default requireAuth(async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const status = Object.entries(connectors).map(([key, c]) => ({
    key,
    name: c.name,
    enabled: c.enabled,
  }));

  return res.status(200).json({ success: true, connectors: status });
});

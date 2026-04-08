/**
 * pages/api/auth/me.js
 * GET /api/auth/me  → returns current authenticated user
 */

import { requireAuth } from "../../../lib/auth";

export default requireAuth(async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({
    success: true,
    user: req.user,
  });
});

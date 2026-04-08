/**
 * pages/api/health.js
 * GET /api/health — system health check
 * Verifies database connection and returns status
 */

import { getSheetMeta } from "../../lib/db/connector";

export default async function handler(req, res) {
  const start = Date.now();

  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    app: "ARD CRM",
    checks: {},
  };

  // Database connectivity check
  try {
    const meta = await getSheetMeta();
    health.checks.database = {
      status: "ok",
      title: meta.title,
      tabs: meta.tabs,
      backend: meta.backend,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    health.checks.database = {
      status: "error",
      error: err.message,
    };
    health.status = "degraded";
  }

  // Env vars check
  const requiredEnv = ["DATABASE_URL"];
  const missingEnv = requiredEnv.filter(k => !process.env[k]);
  health.checks.envVars = {
    status: missingEnv.length === 0 ? "ok" : "error",
    missing: missingEnv,
  };
  if (missingEnv.length > 0) health.status = "degraded";

  const statusCode = health.status === "ok" ? 200 : 503;
  return res.status(statusCode).json(health);
}

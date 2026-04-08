/**
 * lib/middleware.js
 * API middleware utilities
 * - CORS headers
 * - Basic rate-limit logging
 * - Request logging
 * - Future: JWT auth check
 */

/**
 * Wrap an API handler with standard middleware.
 * Usage: export default withMiddleware(handler)
 */
export function withMiddleware(handler, options = {}) {
  return async function (req, res) {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-webhook-secret,Authorization");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    // Request logging (minimal, no sensitive data)
    const start = Date.now();
    console.log(`[API] ${req.method} ${req.url}`);

    // Future: JWT auth check
    if (options.requireAuth) {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token || token !== process.env.API_SECRET_TOKEN) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
    }

    // Call the actual handler
    try {
      await handler(req, res);
    } catch (err) {
      console.error(`[API ERROR] ${req.method} ${req.url}:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    }

    const ms = Date.now() - start;
    console.log(`[API] ${req.method} ${req.url} → ${res.statusCode} (${ms}ms)`);
  };
}

/**
 * Validate required fields in request body.
 * Returns { valid, missing }
 */
export function validateBody(body, required = []) {
  const missing = required.filter((k) => !body?.[k]);
  return { valid: missing.length === 0, missing };
}

/**
 * Standard success response shape
 */
export function success(res, data, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

/**
 * Standard error response shape
 */
export function error(res, message, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

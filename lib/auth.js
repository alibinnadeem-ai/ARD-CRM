/**
 * lib/auth.js
 * Authentication utilities: password hashing, JWT, and route protection.
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "./db/connector";

const JWT_SECRET = process.env.JWT_SECRET || "ard-crm-dev-secret-change-in-production";
const JWT_EXPIRES_IN = "7d";

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function requireAuth(handler) {
  return async (req, res) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    try {
      const decoded = verifyToken(token);
      const { rows } = await query("SELECT id, name, email, role FROM users WHERE id = $1", [decoded.userId]);
      if (!rows[0]) {
        return res.status(401).json({ success: false, error: "User not found" });
      }
      req.user = rows[0];
    } catch (err) {
      return res.status(401).json({ success: false, error: "Invalid or expired token" });
    }

    try {
      return await handler(req, res);
    } catch (err) {
      console.error("[requireAuth]", err);
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: err?.message || "Internal server error",
        });
      }
    }
  };
}

/**
 * pages/api/auth/signup.js
 * POST /api/auth/signup  → creates a new user, returns JWT
 */

import crypto from "crypto";
import { query, ensureSchema } from "../../../lib/db/connector";
import { hashPassword, signToken } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await ensureSchema();

    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    const { rows: existing } = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: "Email already registered" });
    }

    const id = `user-${crypto.randomBytes(8).toString("hex")}`;
    const passwordHash = await hashPassword(password);

    await query(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'user')`,
      [id, name.trim(), email.toLowerCase().trim(), passwordHash]
    );

    const token = signToken({ userId: id, email: email.toLowerCase().trim() });

    return res.status(201).json({
      success: true,
      token,
      user: { id, name: name.trim(), email: email.toLowerCase().trim(), role: "user" },
    });
  } catch (err) {
    console.error("[POST /api/auth/signup]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

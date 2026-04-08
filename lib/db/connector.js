/**
 * lib/db/connector.js
 * Neon Postgres connector used by API routes.
 *
 * This preserves the existing connector contract:
 * - getAllRows()
 * - appendRow(data)
 * - updateRow(rowIndex, data)
 * - deleteRow(rowIndex, softDelete)
 * - getSheetMeta()
 */

import { Pool } from "pg";

const TABLE_NAME = "leads";
const SOURCES_TABLE = "lead_sources";
const AGENTS_TABLE = "lead_agents";
const FOLLOWUPS_TABLE = "lead_followups";
const EVENTS_TABLE = "lead_events";
const CANONICAL_FIELDS = [
  "id",
  "name",
  "company",
  "email",
  "phone",
  "status",
  "stage",
  "source",
  "assigned_to",
  "notes",
  "tags",
  "follow_up",
  "created_at",
  "updated_at",
  "value",
  "city",
  "deleted",
];

let pool;
let initPromise;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL env var is missing. Set it in .env.local or Vercel settings.");
  }

  const useSsl =
    connectionString.includes("neon.tech") || connectionString.includes("sslmode=require");

  pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on("error", (err) => {
    console.error("[db pool] Unexpected error", err);
  });

  return pool;
}

export async function query(sql, params = []) {
  const db = getPool();
  return db.query(sql, params);
}

export async function ensureSchema() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id TEXT PRIMARY KEY,
        name TEXT,
        company TEXT,
        email TEXT,
        phone TEXT,
        status TEXT,
        stage TEXT,
        source TEXT,
        assigned_to TEXT,
        notes TEXT,
        tags TEXT,
        follow_up TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        value TEXT,
        city TEXT,
        deleted BOOLEAN NOT NULL DEFAULT FALSE,
        extra JSONB NOT NULL DEFAULT '{}'::jsonb
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_created_at ON ${TABLE_NAME}(created_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_status ON ${TABLE_NAME}(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_email ON ${TABLE_NAME}(email)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_phone ON ${TABLE_NAME}(phone)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_deleted ON ${TABLE_NAME}(deleted)`);

    await query(`
      CREATE TABLE IF NOT EXISTS ${SOURCES_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ${AGENTS_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ${FOLLOWUPS_TABLE} (
        lead_id TEXT PRIMARY KEY REFERENCES ${TABLE_NAME}(id) ON DELETE CASCADE,
        follow_up_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_${FOLLOWUPS_TABLE}_follow_up_at ON ${FOLLOWUPS_TABLE}(follow_up_at)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_${FOLLOWUPS_TABLE}_status ON ${FOLLOWUPS_TABLE}(status)`);

    await query(`
      CREATE TABLE IF NOT EXISTS ${EVENTS_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        lead_id TEXT NOT NULL REFERENCES ${TABLE_NAME}(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        previous_status TEXT,
        next_status TEXT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_${EVENTS_TABLE}_lead_id ON ${EVENTS_TABLE}(lead_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_${EVENTS_TABLE}_event_type ON ${EVENTS_TABLE}(event_type)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_${EVENTS_TABLE}_created_at ON ${EVENTS_TABLE}(created_at DESC)`);

    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  })();

  return initPromise;
}

function cleanDimensionValue(value) {
  if (value === undefined || value === null) return null;
  const out = String(value).trim();
  return out ? out : null;
}

async function upsertSource(name) {
  const sourceName = cleanDimensionValue(name);
  if (!sourceName) return;

  await query(
    `
      INSERT INTO ${SOURCES_TABLE} (name)
      VALUES ($1)
      ON CONFLICT (name) DO NOTHING
    `,
    [sourceName]
  );
}

async function upsertAgent(name) {
  const agentName = cleanDimensionValue(name);
  if (!agentName) return;

  await query(
    `
      INSERT INTO ${AGENTS_TABLE} (name)
      VALUES ($1)
      ON CONFLICT (name) DO NOTHING
    `,
    [agentName]
  );
}

async function syncFollowUp(leadId, followUpAt, note = null) {
  if (!leadId) return;

  if (!followUpAt) {
    await query(`DELETE FROM ${FOLLOWUPS_TABLE} WHERE lead_id = $1`, [leadId]);
    return;
  }

  await query(
    `
      INSERT INTO ${FOLLOWUPS_TABLE} (lead_id, follow_up_at, note)
      VALUES ($1, $2, $3)
      ON CONFLICT (lead_id) DO UPDATE SET
        follow_up_at = EXCLUDED.follow_up_at,
        note = EXCLUDED.note,
        updated_at = NOW()
    `,
    [leadId, followUpAt, note]
  );
}

async function insertLeadEvent({
  leadId,
  eventType,
  previousStatus = null,
  nextStatus = null,
  payload = {},
  createdAt,
}) {
  if (!leadId || !eventType) return;

  await query(
    `
      INSERT INTO ${EVENTS_TABLE} (
        lead_id,
        event_type,
        previous_status,
        next_status,
        payload,
        created_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, COALESCE($6, NOW()))
    `,
    [leadId, eventType, previousStatus, nextStatus, JSON.stringify(payload || {}), createdAt || null]
  );
}

function normalizeTextInput(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return String(value).trim();
}

function normalizeBooleanInput(value) {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(v)) return true;
    if (["false", "0", "no", "n", ""].includes(v)) return false;
  }
  if (typeof value === "number") return value === 1;
  return Boolean(value);
}

function normalizeDateInput(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return undefined;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function serializeDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}

function generateLeadId() {
  return `ARD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitInput(data = {}) {
  const payload = {
    id: normalizeTextInput(data.id),
    name: normalizeTextInput(data.name),
    company: normalizeTextInput(data.company),
    email: normalizeTextInput(data.email),
    phone: normalizeTextInput(data.phone),
    status: normalizeTextInput(data.status),
    stage: normalizeTextInput(data.stage),
    source: normalizeTextInput(data.source),
    assigned_to: normalizeTextInput(data.assigned_to),
    notes: normalizeTextInput(data.notes),
    tags: normalizeTextInput(data.tags),
    follow_up: normalizeDateInput(data.follow_up),
    created_at: normalizeDateInput(data.created_at),
    updated_at: normalizeDateInput(data.updated_at),
    value: normalizeTextInput(data.value),
    city: normalizeTextInput(data.city),
    deleted: normalizeBooleanInput(data.deleted),
    extra: {},
  };

  if (data._extra && typeof data._extra === "object") {
    payload.extra = { ...data._extra };
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === "_rowIndex" || key === "_extra") continue;
    if (CANONICAL_FIELDS.includes(key)) continue;
    payload.extra[key] = value;
  }

  return payload;
}

function dbRowToRecord(row, rowIndex) {
  const record = {
    _rowIndex: rowIndex,
    id: row.id || "",
    name: row.name || "",
    company: row.company || "",
    email: row.email || "",
    phone: row.phone || "",
    status: row.status || "",
    stage: row.stage || "",
    source: row.source || "",
    assigned_to: row.assigned_to || "",
    notes: row.notes || "",
    tags: row.tags || "",
    follow_up: serializeDate(row.follow_up),
    created_at: serializeDate(row.created_at),
    updated_at: serializeDate(row.updated_at),
    value: row.value || "",
    city: row.city || "",
    deleted: row.deleted ? "TRUE" : "FALSE",
  };

  for (const [key, value] of Object.entries(row.extra || {})) {
    record[key] = value;
  }

  return record;
}

async function findIdByRowIndex(rowIndex) {
  const offset = Number(rowIndex) - 2;
  if (Number.isNaN(offset) || offset < 0) {
    throw new Error("Invalid rowIndex");
  }

  const { rows } = await query(
    `
      SELECT id
      FROM ${TABLE_NAME}
      ORDER BY created_at ASC, id ASC
      OFFSET $1 LIMIT 1
    `,
    [offset]
  );

  if (!rows[0]) {
    throw new Error("Record not found");
  }

  return rows[0].id;
}

export async function getAllRows() {
  await ensureSchema();

  const { rows } = await query(`
    SELECT *, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) + 1 AS _row_index
    FROM ${TABLE_NAME}
    ORDER BY created_at ASC, id ASC
  `);

  const extraHeaders = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row.extra || {})) {
      extraHeaders.add(key);
    }
  }

  const headers = [...CANONICAL_FIELDS, ...Array.from(extraHeaders).sort()];
  const records = rows.map((row) => dbRowToRecord(row, Number(row._row_index)));

  return { headers, records };
}

export async function appendRow(data) {
  await ensureSchema();

  const parsed = splitInput(data);
  const id = parsed.id || generateLeadId();
  const now = new Date();
  const createdAt = parsed.created_at ?? now;
  const updatedAt = parsed.updated_at ?? now;
  const status = parsed.status || (parsed.deleted ? "Deleted" : "New Lead");

  const { rows } = await query(
    `
      INSERT INTO ${TABLE_NAME} (
        id, name, company, email, phone, status, stage, source,
        assigned_to, notes, tags, follow_up, created_at, updated_at,
        value, city, deleted, extra
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18::jsonb
      )
      RETURNING *
    `,
    [
      id,
      parsed.name ?? null,
      parsed.company ?? null,
      parsed.email ?? null,
      parsed.phone ?? null,
      status,
      parsed.stage ?? null,
      parsed.source ?? null,
      parsed.assigned_to ?? null,
      parsed.notes ?? null,
      parsed.tags ?? null,
      parsed.follow_up ?? null,
      createdAt,
      updatedAt,
      parsed.value ?? null,
      parsed.city ?? null,
      parsed.deleted ?? false,
      JSON.stringify(parsed.extra || {}),
    ]
  );

  const inserted = rows[0];

  await upsertSource(inserted.source);
  await upsertAgent(inserted.assigned_to);
  await syncFollowUp(inserted.id, inserted.follow_up, inserted.notes);
  await insertLeadEvent({
    leadId: inserted.id,
    eventType: "created",
    previousStatus: null,
    nextStatus: inserted.status || null,
    payload: {
      source: inserted.source || null,
      assigned_to: inserted.assigned_to || null,
    },
    createdAt: inserted.created_at,
  });

  return dbRowToRecord(inserted, null);
}

export async function updateRow(rowIndex, data) {
  await ensureSchema();

  const id = await findIdByRowIndex(rowIndex);
  const existingResult = await query(`SELECT * FROM ${TABLE_NAME} WHERE id = $1`, [id]);
  const existing = existingResult.rows[0];

  if (!existing) {
    throw new Error("Record not found");
  }

  const parsed = splitInput(data);
  const nextStatus = parsed.status !== undefined
    ? parsed.status
    : existing.status;
  const nextDeleted = parsed.deleted !== undefined
    ? parsed.deleted
    : existing.deleted;

  const mergedExtra = {
    ...(existing.extra || {}),
    ...(parsed.extra || {}),
  };

  const now = new Date();

  const { rows } = await query(
    `
      UPDATE ${TABLE_NAME}
      SET
        name = $2,
        company = $3,
        email = $4,
        phone = $5,
        status = $6,
        stage = $7,
        source = $8,
        assigned_to = $9,
        notes = $10,
        tags = $11,
        follow_up = $12,
        created_at = $13,
        updated_at = $14,
        value = $15,
        city = $16,
        deleted = $17,
        extra = $18::jsonb
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      parsed.name !== undefined ? parsed.name : existing.name,
      parsed.company !== undefined ? parsed.company : existing.company,
      parsed.email !== undefined ? parsed.email : existing.email,
      parsed.phone !== undefined ? parsed.phone : existing.phone,
      nextStatus,
      parsed.stage !== undefined ? parsed.stage : existing.stage,
      parsed.source !== undefined ? parsed.source : existing.source,
      parsed.assigned_to !== undefined ? parsed.assigned_to : existing.assigned_to,
      parsed.notes !== undefined ? parsed.notes : existing.notes,
      parsed.tags !== undefined ? parsed.tags : existing.tags,
      parsed.follow_up !== undefined ? parsed.follow_up : existing.follow_up,
      parsed.created_at !== undefined ? parsed.created_at : existing.created_at,
      parsed.updated_at !== undefined ? parsed.updated_at : now,
      parsed.value !== undefined ? parsed.value : existing.value,
      parsed.city !== undefined ? parsed.city : existing.city,
      nextDeleted,
      JSON.stringify(mergedExtra),
    ]
  );

  const updated = rows[0];
  const changedFields = [];
  for (const key of Object.keys(parsed)) {
    if (key === "extra") continue;
    if (parsed[key] !== undefined) changedFields.push(key);
  }
  if (Object.keys(parsed.extra || {}).length > 0) changedFields.push("_extra");

  await upsertSource(updated.source);
  await upsertAgent(updated.assigned_to);
  await syncFollowUp(updated.id, updated.follow_up, updated.notes);
  await insertLeadEvent({
    leadId: updated.id,
    eventType: existing.status !== updated.status ? "status_changed" : "updated",
    previousStatus: existing.status || null,
    nextStatus: updated.status || null,
    payload: {
      changedFields,
    },
    createdAt: now,
  });

  return { rowIndex, id };
}

export async function deleteRow(rowIndex, softDelete = true) {
  await ensureSchema();

  const id = await findIdByRowIndex(rowIndex);
  const existingResult = await query(`SELECT id, status FROM ${TABLE_NAME} WHERE id = $1`, [id]);
  const existing = existingResult.rows[0];

  if (softDelete) {
    await query(
      `
        UPDATE ${TABLE_NAME}
        SET status = $2, deleted = TRUE, updated_at = NOW()
        WHERE id = $1
      `,
      [id, "Deleted"]
    );

    await syncFollowUp(id, null, null);
    await insertLeadEvent({
      leadId: id,
      eventType: "deleted",
      previousStatus: existing?.status || null,
      nextStatus: "Deleted",
      payload: { softDelete: true },
      createdAt: new Date(),
    });
    return;
  }

  await query(`DELETE FROM ${TABLE_NAME} WHERE id = $1`, [id]);
}

export async function getSheetMeta() {
  await ensureSchema();

  const [{ rows: leadsRows }, { rows: sourcesRows }, { rows: agentsRows }, { rows: eventsRows }, { rows: followupsRows }] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total FROM ${TABLE_NAME}`),
    query(`SELECT COUNT(*)::int AS total FROM ${SOURCES_TABLE}`),
    query(`SELECT COUNT(*)::int AS total FROM ${AGENTS_TABLE}`),
    query(`SELECT COUNT(*)::int AS total FROM ${EVENTS_TABLE}`),
    query(`SELECT COUNT(*)::int AS total FROM ${FOLLOWUPS_TABLE}`),
  ]);

  return {
    title: "ARD CRM (Neon Postgres)",
    sheetUrl: null,
    tabs: [
      `public.${TABLE_NAME}`,
      `public.${SOURCES_TABLE}`,
      `public.${AGENTS_TABLE}`,
      `public.${FOLLOWUPS_TABLE}`,
      `public.${EVENTS_TABLE}`,
    ],
    totalRecords: leadsRows[0]?.total ?? 0,
    relational: {
      sources: sourcesRows[0]?.total ?? 0,
      agents: agentsRows[0]?.total ?? 0,
      followups: followupsRows[0]?.total ?? 0,
      events: eventsRows[0]?.total ?? 0,
    },
    backend: "postgres",
  };
}

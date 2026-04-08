import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { Client } from "pg";

const DEFAULT_SHEET_ID = "1tHjazheToVYFD2A281JM48iUq2NNwekwg8ngdH487Pw";

const FIELD_MAP = {
  id: ["id", "lead_id", "record_id", "uid"],
  name: ["name", "full_name", "client_name", "contact_name", "lead_name"],
  company: ["company", "company_name", "organization", "firm", "account"],
  email: ["email", "email_address", "e_mail"],
  phone: ["phone", "phone_number", "mobile", "cell", "contact_no"],
  status: ["status", "lead_status", "record_status"],
  stage: ["stage", "pipeline_stage", "deal_stage", "funnel_stage"],
  source: ["source", "lead_source", "origin", "channel"],
  assigned_to: ["assigned_to", "assigned", "owner", "agent", "sales_rep", "bdm"],
  notes: ["notes", "note", "remarks", "comments", "description"],
  tags: ["tags", "tag", "label", "labels"],
  follow_up: ["follow_up", "follow_up_date", "next_action", "callback_date"],
  created_at: ["created_at", "date_added", "created_date", "date_created", "date"],
  updated_at: ["updated_at", "last_updated", "modified_date"],
  value: ["value", "deal_value", "amount", "revenue", "budget"],
  city: ["city", "location", "area"],
  deleted: ["deleted", "is_deleted", "archived"],
};

function normalizeHeader(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getReverseMap() {
  const reverse = {};
  for (const [canonical, aliases] of Object.entries(FIELD_MAP)) {
    for (const alias of aliases) {
      reverse[alias] = canonical;
    }
  }
  return reverse;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function toDateOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return false;
  const v = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  return false;
}

function mapRow(rawRow, reverseMap) {
  const canonical = {};
  const extra = {};

  for (const [header, value] of Object.entries(rawRow)) {
    const trimmedValue = value == null ? "" : String(value).trim();
    if (trimmedValue === "") continue;

    const normalizedKey = normalizeHeader(header);
    const canonicalKey = reverseMap[normalizedKey];

    if (canonicalKey) {
      canonical[canonicalKey] = trimmedValue;
    } else {
      extra[normalizedKey || header] = trimmedValue;
    }
  }

  return { canonical, extra };
}

function hasAnyContent(row) {
  return Object.values(row).some((value) => {
    if (value == null) return false;
    return String(value).trim() !== "";
  });
}

function hasLeadIdentity(canonical) {
  return [canonical.name, canonical.company, canonical.email, canonical.phone]
    .some((value) => value != null && String(value).trim() !== "");
}

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS leads (
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

  await client.query("CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_leads_deleted ON leads(deleted)");

  await client.query(`
    CREATE TABLE IF NOT EXISTS lead_sources (
      id BIGSERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS lead_agents (
      id BIGSERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS lead_followups (
      lead_id TEXT PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
      follow_up_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS lead_events (
      id BIGSERIAL PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      previous_status TEXT,
      next_status TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query("CREATE INDEX IF NOT EXISTS idx_lead_followups_follow_up_at ON lead_followups(follow_up_at)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_lead_events_event_type ON lead_events(event_type)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_lead_events_created_at ON lead_events(created_at DESC)");
}

function cleanDimensionValue(value) {
  if (value === undefined || value === null) return null;
  const out = String(value).trim();
  return out ? out : null;
}

async function upsertSource(client, source) {
  const sourceName = cleanDimensionValue(source);
  if (!sourceName) return;

  await client.query(
    `INSERT INTO lead_sources (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
    [sourceName]
  );
}

async function upsertAgent(client, agent) {
  const agentName = cleanDimensionValue(agent);
  if (!agentName) return;

  await client.query(
    `INSERT INTO lead_agents (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
    [agentName]
  );
}

async function syncFollowUp(client, leadId, followUpAt, note = null) {
  if (!followUpAt) {
    await client.query(`DELETE FROM lead_followups WHERE lead_id = $1`, [leadId]);
    return;
  }

  await client.query(
    `
      INSERT INTO lead_followups (lead_id, follow_up_at, note)
      VALUES ($1, $2, $3)
      ON CONFLICT (lead_id) DO UPDATE SET
        follow_up_at = EXCLUDED.follow_up_at,
        note = EXCLUDED.note,
        updated_at = NOW()
    `,
    [leadId, followUpAt, note]
  );
}

async function ensureCreatedEvent(client, leadId, nextStatus, createdAt, payload) {
  await client.query(
    `
      INSERT INTO lead_events (lead_id, event_type, previous_status, next_status, payload, created_at)
      SELECT $1, 'created', NULL, $2, $3::jsonb, $4
      WHERE NOT EXISTS (
        SELECT 1 FROM lead_events WHERE lead_id = $1 AND event_type = 'created'
      )
    `,
    [leadId, nextStatus, JSON.stringify(payload || {}), createdAt]
  );
}

async function main() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Set it in .env.local or environment.");
  }

  const sheetId = process.env.LEGACY_GOOGLE_SHEET_ID || process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID;
  const gid = process.env.LEGACY_GOOGLE_GID || "0";
  const csvUrl = process.env.LEGACY_CSV_URL || `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV (${response.status} ${response.statusText}) from ${csvUrl}`);
  }

  const csvText = await response.text();
  const parsedRows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
    trim: true,
  });

  if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
    console.log("No rows found in legacy source. Nothing to import.");
    return;
  }

  const reverseMap = getReverseMap();
  const useSsl = databaseUrl.includes("neon.tech") || databaseUrl.includes("sslmode=require");

  const client = new Client({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  try {
    await ensureSchema(client);

    const existing = await client.query("SELECT id FROM leads");
    const existingIds = new Set(existing.rows.map((r) => r.id));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let skippedNonLead = 0;

    for (let i = 0; i < parsedRows.length; i += 1) {
      const rawRow = parsedRows[i];
      if (!hasAnyContent(rawRow)) {
        skipped += 1;
        continue;
      }

      const { canonical, extra } = mapRow(rawRow, reverseMap);
      // Skip aggregate KPI/stat rows that do not identify an actual lead.
      if (!hasLeadIdentity(canonical)) {
        skippedNonLead += 1;
        continue;
      }

      const rowIndex = i + 2;
      const id = canonical.id || `LEGACY-${sheetId}-${rowIndex}`;

      const status = canonical.status || (Number(extra.converted_booked_sold || 0) > 0 ? "Won" : "New Lead");
      const deleted = toBool(canonical.deleted) || String(status).toLowerCase() === "deleted";
      const createdAt = toDateOrNull(canonical.created_at || extra.date) || new Date();
      const updatedAt = toDateOrNull(canonical.updated_at) || createdAt;
      const followUp = toDateOrNull(canonical.follow_up);

      await client.query(
        `
          INSERT INTO leads (
            id, name, company, email, phone, status, stage, source,
            assigned_to, notes, tags, follow_up, created_at, updated_at,
            value, city, deleted, extra
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            company = EXCLUDED.company,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            status = EXCLUDED.status,
            stage = EXCLUDED.stage,
            source = EXCLUDED.source,
            assigned_to = EXCLUDED.assigned_to,
            notes = EXCLUDED.notes,
            tags = EXCLUDED.tags,
            follow_up = EXCLUDED.follow_up,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at,
            value = EXCLUDED.value,
            city = EXCLUDED.city,
            deleted = EXCLUDED.deleted,
            extra = EXCLUDED.extra
        `,
        [
          id,
          canonical.name || null,
          canonical.company || null,
          canonical.email || null,
          canonical.phone || null,
          status,
          canonical.stage || null,
          canonical.source || "Legacy Sheet Import",
          canonical.assigned_to || null,
          canonical.notes || null,
          canonical.tags || null,
          followUp,
          createdAt,
          updatedAt,
          canonical.value || null,
          canonical.city || null,
          deleted,
          JSON.stringify(extra),
        ]
      );

      await upsertSource(client, canonical.source || "Legacy Sheet Import");
      await upsertAgent(client, canonical.assigned_to);
      await syncFollowUp(client, id, followUp, canonical.notes || null);
      await ensureCreatedEvent(
        client,
        id,
        status,
        createdAt,
        {
          source: canonical.source || "Legacy Sheet Import",
          importer: "seed:historical",
        }
      );

      if (existingIds.has(id)) {
        updated += 1;
      } else {
        inserted += 1;
        existingIds.add(id);
      }
    }

    const totalResult = await client.query("SELECT COUNT(*)::int AS total FROM leads");
    const total = totalResult.rows[0]?.total || 0;

    console.log(JSON.stringify({
      source: csvUrl,
      processed: parsedRows.length,
      inserted,
      updated,
      skipped,
      skippedNonLead,
      totalInDatabase: total,
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Historical seed failed:", err.message);
  process.exit(1);
});

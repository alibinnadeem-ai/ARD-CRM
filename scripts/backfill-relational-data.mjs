import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
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

    if (!process.env[key]) process.env[key] = value;
  }
}

function cleanDimensionValue(value) {
  if (value === undefined || value === null) return null;
  const out = String(value).trim();
  return out ? out : null;
}

async function ensureSchema(client) {
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

async function main() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const useSsl =
    process.env.DATABASE_URL.includes("neon.tech") ||
    process.env.DATABASE_URL.includes("sslmode=require");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  try {
    await ensureSchema(client);

    const { rows: leads } = await client.query(`
      SELECT id, status, source, assigned_to, notes, follow_up, created_at, updated_at, deleted
      FROM leads
    `);

    let sourcesAdded = 0;
    let agentsAdded = 0;
    let followupsUpserted = 0;
    let eventsCreated = 0;

    for (const lead of leads) {
      const source = cleanDimensionValue(lead.source);
      if (source) {
        const result = await client.query(
          `INSERT INTO lead_sources (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`,
          [source]
        );
        if (result.rowCount > 0) sourcesAdded += 1;
      }

      const agent = cleanDimensionValue(lead.assigned_to);
      if (agent) {
        const result = await client.query(
          `INSERT INTO lead_agents (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`,
          [agent]
        );
        if (result.rowCount > 0) agentsAdded += 1;
      }

      if (lead.follow_up) {
        await client.query(
          `
            INSERT INTO lead_followups (lead_id, follow_up_at, note)
            VALUES ($1, $2, $3)
            ON CONFLICT (lead_id) DO UPDATE SET
              follow_up_at = EXCLUDED.follow_up_at,
              note = EXCLUDED.note,
              updated_at = NOW()
          `,
          [lead.id, lead.follow_up, lead.notes || null]
        );
        followupsUpserted += 1;
      }

      const createdEvent = await client.query(
        `
          INSERT INTO lead_events (lead_id, event_type, previous_status, next_status, payload, created_at)
          SELECT $1, 'created', NULL, $2, $3::jsonb, COALESCE($4, NOW())
          WHERE NOT EXISTS (
            SELECT 1 FROM lead_events WHERE lead_id = $1 AND event_type = 'created'
          )
          RETURNING id
        `,
        [
          lead.id,
          lead.status || null,
          JSON.stringify({ source: lead.source || null, backfilled: true }),
          lead.created_at || null,
        ]
      );
      if (createdEvent.rowCount > 0) eventsCreated += 1;

      if (lead.deleted || String(lead.status || "").toLowerCase() === "deleted") {
        const deletedEvent = await client.query(
          `
            INSERT INTO lead_events (lead_id, event_type, previous_status, next_status, payload, created_at)
            SELECT $1, 'deleted', NULL, 'Deleted', $2::jsonb, COALESCE($3, NOW())
            WHERE NOT EXISTS (
              SELECT 1 FROM lead_events WHERE lead_id = $1 AND event_type = 'deleted'
            )
            RETURNING id
          `,
          [
            lead.id,
            JSON.stringify({ backfilled: true }),
            lead.updated_at || null,
          ]
        );
        if (deletedEvent.rowCount > 0) eventsCreated += 1;
      }
    }

    const { rows: sourcesRows } = await client.query("SELECT COUNT(*)::int AS total FROM lead_sources");
    const { rows: agentsRows } = await client.query("SELECT COUNT(*)::int AS total FROM lead_agents");
    const { rows: followupsRows } = await client.query("SELECT COUNT(*)::int AS total FROM lead_followups");
    const { rows: eventsRows } = await client.query("SELECT COUNT(*)::int AS total FROM lead_events");

    console.log(JSON.stringify({
      leadsProcessed: leads.length,
      sourcesAdded,
      agentsAdded,
      followupsUpserted,
      eventsCreated,
      totals: {
        lead_sources: sourcesRows[0]?.total || 0,
        lead_agents: agentsRows[0]?.total || 0,
        lead_followups: followupsRows[0]?.total || 0,
        lead_events: eventsRows[0]?.total || 0,
      },
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err.message);
  process.exit(1);
});

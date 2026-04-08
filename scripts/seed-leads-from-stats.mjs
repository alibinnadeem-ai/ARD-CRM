/**
 * scripts/seed-leads-from-stats.mjs
 *
 * Upserts the `leads` table from ARD Stats HTML files:
 *   - Sales Sheet.html → Won leads with sale details
 *   - Incoming Stats HTML files → New Lead entries with inquiry data
 *
 * Safe to rerun: imported rows get deterministic IDs and unrelated leads remain untouched.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";

const SOURCE_DIR_DEFAULT = "ARD Stats";
const IMPORTER_TAG = "ard_stats_html";

const INCOMING_FILES = [
  { file: "ARD Incoming Stats .html", label: "Phone Incoming" },
  { file: "ARD WhatsApp Incoming Stats .html", label: "WhatsApp Incoming" },
  { file: "UPH Incoming Stats .html", label: "Phone Incoming" },
  { file: "UPH WhatsApp Incoming Stats .html", label: "WhatsApp Incoming" },
];

// ─── Env loader ──────────────────────────────────────────────────────────────

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
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

// ─── HTML parsing helpers (from seed-ard-stats.mjs) ─────────────────────────

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripCell(value) {
  return decodeEntities(value)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRowsFromHtml(html) {
  const tableMatch = html.match(/<table[^>]*class="[^"]*waffle[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];
  const tableHtml = tableMatch[1];
  const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  return rowMatches.map((rowMatch) => {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) => stripCell(cellMatch[1]));
    return cells;
  });
}

function rowWithoutIndex(row) {
  return row.slice(1).map((cell) => String(cell || "").trim());
}

function parseDateFlexible(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [_, y, m, d] = iso;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    let [, dd, mm, yy] = slash;
    if (yy.length === 2) yy = `20${yy}`;
    return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseNumber(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "-") return null;
  const cleaned = raw.replace(/,/g, "").replace(/%/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return num;
}

function sanitizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return { raw: null, normalized: null };
  const normalized = raw.replace(/[^0-9]/g, "");
  return { raw, normalized: normalized || null };
}

function normalizeStablePart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildLeadId(prefix, parts) {
  const hash = crypto
    .createHash("sha1")
    .update(parts.map(normalizeStablePart).join("|"))
    .digest("hex")
    .slice(0, 16);

  return `${prefix}-${hash}`;
}

// ─── Transform Sales Sheet → leads ──────────────────────────────────────────

function parseSalesSheet(rows, sourceFile = "Sales Sheet.html") {
  const headerIdx = rows.findIndex((r, i) => {
    if (i > 25) return false;
    const joined = rowWithoutIndex(r).join(" | ").toLowerCase();
    return joined.includes("client name") && joined.includes("plot size") && joined.includes("sale completed");
  });

  if (headerIdx < 0) {
    console.warn("  [Sales Sheet] Header row not found, skipping");
    return [];
  }

  const leads = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rowWithoutIndex(rows[i]);
    const saleDate = parseDateFlexible(row[0]);
    if (!saleDate) continue;

    const clientName = String(row[1] || "").trim();
    if (!clientName) continue;

    const city = String(row[2] || "").trim() || null;
    const plotSize = parseNumber(row[3]);
    const tokenTaken = parseNumber(row[4]);
    const expectedPaymentDate = String(row[5] || "").trim() || null;
    const firstPayment = parseNumber(row[6]);
    const downPayment = parseNumber(row[7]);
    const dealerRebate = String(row[8] || "").trim() || null;
    const paymentReceivedDate = String(row[9] || "").trim() || null;
    const installmentPlan = String(row[10] || "").trim() || null;
    const closer = String(row[11] || "").trim() || null;
    const discountOffered = String(row[12] || "").trim() || null;
    const fileHandedOverText = String(row[13] || "").trim().toLowerCase();
    const fileHandedOver = fileHandedOverText
      ? ["yes", "y", "true", "1"].includes(fileHandedOverText)
      : null;
    const saleCompletedBy = String(row[14] || "").trim() || null;

    leads.push({
      id: buildLeadId("STATS-SALE", [
        saleDate,
        clientName,
        city,
        plotSize,
        tokenTaken,
        firstPayment,
        downPayment,
        closer,
        saleCompletedBy,
      ]),
      name: clientName,
      city,
      value: downPayment != null ? String(downPayment) : null,
      assigned_to: closer || null,
      status: "Won",
      stage: "Purchase",
      source: "Sales Sheet",
      created_at: saleDate,
      extra: {
        importer: IMPORTER_TAG,
        source_file: sourceFile,
        import_kind: "sales_sheet",
        sale_date: saleDate,
        plot_size: plotSize,
        token_taken: tokenTaken,
        expected_payment_receiving_date: expectedPaymentDate,
        first_payment: firstPayment,
        down_payment: downPayment,
        dealer_rebate: dealerRebate,
        payment_received_date: paymentReceivedDate,
        installment_plan: installmentPlan,
        discount_offered: discountOffered,
        file_handed_over: fileHandedOver,
        sale_completed_by: saleCompletedBy,
      },
    });
  }

  return leads;
}

// ─── Transform Incoming Stats → leads ───────────────────────────────────────

function parseIncomingStats(rows, label, sourceFile) {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const joined = rowWithoutIndex(rows[i]).join(" | ").toLowerCase();
    if (!joined.includes("phone")) continue;
    if (!(joined.includes("time") || joined.includes("date"))) continue;
    if (!(joined.includes("query") || joined.includes("querry"))) continue;
    headerIdx = i;
    break;
  }

  if (headerIdx < 0) {
    console.warn(`  [${label}] Header row not found, skipping`);
    return [];
  }

  const leads = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rowWithoutIndex(rows[i]);
    const interactionDate = parseDateFlexible(row[0]);
    if (!interactionDate) continue;

    const time = String(row[1] || "").trim() || null;
    const phone = sanitizePhone(row[2]);
    const personName = String(row[3] || "").trim() || null;
    const queryNature = String(row[4] || "").trim() || null;
    const clientQuery = String(row[5] || "").trim() || null;
    const actionSteps = String(row[6] || "").trim() || null;
    const followUpRequired = String(row[7] || "").trim() || null;

    if (!phone.raw && !personName && !queryNature && !clientQuery) continue;

    leads.push({
      id: buildLeadId("STATS-INCOMING", [
        label,
        interactionDate,
        time,
        phone.normalized || phone.raw,
        personName,
        queryNature,
        clientQuery,
      ]),
      name: personName || phone.raw || "Unknown",
      phone: phone.raw || null,
      notes: clientQuery || null,
      status: "New Lead",
      source: label,
      created_at: interactionDate,
      _dedupKey: `${phone.normalized || ""}|${interactionDate}`,
      extra: {
        importer: IMPORTER_TAG,
        source_file: sourceFile,
        import_kind: "incoming_stats",
        interaction_date: interactionDate,
        interaction_time: time,
        phone_number_normalized: phone.normalized,
        query_nature: queryNature,
        client_query: clientQuery,
        action_steps: actionSteps,
        follow_up_required: followUpRequired,
      },
    });
  }

  return leads;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const envPaths = [".env.local", ".env"];
  for (const p of envPaths) loadEnvFile(p);

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Exiting.");
    process.exit(1);
  }

  const sourceDir = path.resolve(process.argv[2] || SOURCE_DIR_DEFAULT);
  if (!fs.existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  console.log(`[seed-leads] Reading HTML files from: ${sourceDir}`);

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("[seed-leads] Connected to database");

  // ── Parse Sales Sheet ────────────────────────────────────────────────
  const salesFile = path.join(sourceDir, "Sales Sheet.html");
  let salesLeads = [];
  if (fs.existsSync(salesFile)) {
    const html = fs.readFileSync(salesFile, "utf8");
    const rows = extractRowsFromHtml(html);
    console.log(`[Sales Sheet] Parsed ${rows.length} rows from HTML`);
    salesLeads = parseSalesSheet(rows, "Sales Sheet.html");
    console.log(`[Sales Sheet] Found ${salesLeads.length} sale records`);
  } else {
    console.warn(`[Sales Sheet] File not found: ${salesFile}`);
  }

  // ── Parse Incoming Stats ─────────────────────────────────────────────
  let incomingLeads = [];
  const seenDedup = new Set();

  for (const { file, label } of INCOMING_FILES) {
    const filePath = path.join(sourceDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`[${label}] File not found: ${filePath}`);
      continue;
    }

    const html = fs.readFileSync(filePath, "utf8");
    const rows = extractRowsFromHtml(html);
    console.log(`[${label}] Parsed ${rows.length} rows from HTML`);

    const parsed = parseIncomingStats(rows, label, file);

    // Deduplicate by (phone_normalized, date) across all incoming files
    const before = parsed.length;
    const deduped = parsed.filter((lead) => {
      if (!lead._dedupKey) return true;
      if (seenDedup.has(lead._dedupKey)) return false;
      seenDedup.add(lead._dedupKey);
      return true;
    });

    console.log(`[${label}] ${deduped.length} unique incoming leads (${before - deduped.length} duplicates removed)`);
    incomingLeads.push(...deduped);
  }

  // ── Insert all leads ─────────────────────────────────────────────────
  const allLeads = [...salesLeads, ...incomingLeads];
  console.log(`\n[seed-leads] Total leads to insert: ${allLeads.length} (${salesLeads.length} sales + ${incomingLeads.length} incoming)`);

  const importIds = allLeads.map((lead) => lead.id);
  const existingIds = new Set();
  if (importIds.length > 0) {
    const { rows } = await client.query(
      "SELECT id FROM leads WHERE id = ANY($1::text[])",
      [importIds]
    );
    for (const row of rows) existingIds.add(row.id);
  }

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const lead of allLeads) {
    try {
      await client.query(
        `
        INSERT INTO leads (
          id, name, company, email, phone, status, stage, source,
          assigned_to, notes, tags, follow_up, created_at, updated_at,
          value, city, deleted, extra
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, NOW(),
          $14, $15, FALSE, $16::jsonb
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
          updated_at = NOW(),
          value = EXCLUDED.value,
          city = EXCLUDED.city,
          deleted = FALSE,
          extra = EXCLUDED.extra
        `,
        [
          lead.id,
          lead.name || null,
          lead.company || null,
          lead.email || null,
          lead.phone || null,
          lead.status || "New Lead",
          lead.stage || null,
          lead.source || null,
          lead.assigned_to || null,
          lead.notes || null,
          lead.tags || null,
          lead.follow_up || null,
          lead.created_at || new Date().toISOString(),
          lead.value || null,
          lead.city || null,
          JSON.stringify(lead.extra || {}),
        ]
      );

      // Upsert source + agent dimension tables
      if (lead.source) {
        await client.query(
          `INSERT INTO lead_sources (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
          [lead.source]
        );
      }
      if (lead.assigned_to) {
        await client.query(
          `INSERT INTO lead_agents (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
          [lead.assigned_to]
        );
      }

      if (existingIds.has(lead.id)) {
        updated++;
      } else {
        inserted++;
      }
    } catch (err) {
      console.error(`  Error inserting lead "${lead.name}": ${err.message}`);
      errors++;
    }
  }

  console.log(`\n[seed-leads] Done! Inserted: ${inserted}, Updated: ${updated}, Errors: ${errors}`);

  // ── Verify ───────────────────────────────────────────────────────────
  const { rows: countRows } = await client.query("SELECT COUNT(*)::int AS total FROM leads");
  const { rows: statusRows } = await client.query(
    "SELECT status, COUNT(*)::int AS cnt FROM leads GROUP BY status ORDER BY cnt DESC"
  );

  console.log(`\n[seed-leads] Verification:`);
  console.log(`  Total leads in DB: ${countRows[0].total}`);
  for (const row of statusRows) {
    console.log(`  ${row.status}: ${row.cnt}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("[seed-leads] Fatal error:", err);
  process.exit(1);
});

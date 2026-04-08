import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";

const SOURCE_DIR_DEFAULT = "ARD Stats";

const FILE_KIND_MAP = {
  "Areeba.html": { kind: "agent_daily", label: "Areeba" },
  "Doha.html": { kind: "agent_daily", label: "Doha" },
  "Rehan.html": { kind: "agent_daily", label: "Rehan" },
  "Sarwat.html": { kind: "agent_daily", label: "Sarwat" },
  "Sehrish.html": { kind: "agent_daily", label: "Sehrish" },
  "Zia.html": { kind: "agent_daily", label: "Zia" },
  "Al Aswad Developers Pvt Ltd.html": { kind: "project_daily", label: "Al Aswad Developers Pvt Ltd" },
  "ARD Sales Support   UPH.html": { kind: "team_daily", label: "ARD Sales Support / UPH" },
  "UPH TOTAL .html": { kind: "team_daily", label: "UPH TOTAL" },
  "Weekly Report.html": { kind: "weekly_snapshot", label: "Weekly Report" },
  "ARD Incoming Stats .html": { kind: "incoming_interaction", label: "ARD Incoming" },
  "ARD WhatsApp Incoming Stats .html": { kind: "incoming_interaction", label: "ARD WhatsApp" },
  "UPH Incoming Stats .html": { kind: "incoming_interaction", label: "UPH Incoming" },
  "UPH WhatsApp Incoming Stats .html": { kind: "incoming_interaction", label: "UPH WhatsApp" },
  "Sales Sheet.html": { kind: "sales_conversion", label: "Sales Sheet" },
  "Al Raheem Total.html": { kind: "period_summary", label: "Al Raheem Total" },
};

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

function normalizeHeaderName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[%()]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildHeaderIndex(headerCells) {
  const map = new Map();
  headerCells.forEach((cell, idx) => {
    const key = normalizeHeaderName(cell);
    if (!key) return;
    if (!map.has(key)) map.set(key, idx);
  });
  return map;
}

function getByAliases(cells, headerMap, aliases) {
  for (const alias of aliases) {
    const key = normalizeHeaderName(alias);
    if (!headerMap.has(key)) continue;
    const idx = headerMap.get(key);
    if (idx == null || idx >= cells.length) continue;
    return String(cells[idx] || "").trim();
  }
  return "";
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

function parseInteger(value) {
  const n = parseNumber(value);
  if (n == null) return null;
  return Math.trunc(n);
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

function parseDateRange(value) {
  const raw = String(value || "").trim();
  if (!raw) return { label: null, start: null, end: null };

  const parts = raw.split(/\s*-\s*/);
  if (parts.length < 2) {
    return { label: raw, start: null, end: null };
  }

  const start = parseDateFlexible(parts[0]);
  const end = parseDateFlexible(parts[1]);
  return { label: raw, start, end };
}

function looksLikeDate(value) {
  return Boolean(parseDateFlexible(value));
}

function isMeaningfulMetricsRow(metrics) {
  return Object.values(metrics).some((v) => {
    if (v == null) return false;
    if (typeof v === "number") return true;
    return String(v).trim() !== "";
  });
}

function findHeaderRow(rows, requiredTerms) {
  for (let i = 0; i < Math.min(rows.length, 25); i += 1) {
    const cells = rowWithoutIndex(rows[i]);
    const joined = cells.join(" | ").toLowerCase();
    const ok = requiredTerms.every((term) => joined.includes(term));
    if (ok) return i;
  }
  return -1;
}

function toRowHash(record) {
  return crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

function sanitizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return { raw: null, normalized: null };
  const normalized = raw.replace(/[^0-9]/g, "");
  return {
    raw,
    normalized: normalized || null,
  };
}

function transformAgentDaily(fileName, label, rows) {
  const headerIdx = findHeaderRow(rows, ["date", "total leads", "connected"]);
  if (headerIdx < 0) return [];

  const headerMap = buildHeaderIndex(rowWithoutIndex(rows[headerIdx]));
  const records = [];

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rowWithoutIndex(rows[i]);
    const dateVal = parseDateFlexible(row[0]);
    if (!dateVal) continue;

    const data = {
      stat_date: dateVal,
      shift: getByAliases(row, headerMap, ["Shift"]),
      total_leads: parseInteger(getByAliases(row, headerMap, ["Total Leads"])),
      dialed_new: parseInteger(getByAliases(row, headerMap, ["Dialed (NEW)", "Dialed"])),
      dialed_previous: parseInteger(getByAliases(row, headerMap, ["Previously Dialed"])),
      connected: parseInteger(getByAliases(row, headerMap, ["Connected"])),
      talk_time_mins: parseInteger(getByAliases(row, headerMap, ["Talk Time (mins)"])),
      hot: parseInteger(getByAliases(row, headerMap, ["Hot"])),
      warm: parseInteger(getByAliases(row, headerMap, ["Warm"])),
      cold: parseInteger(getByAliases(row, headerMap, ["Cold"])),
      meeting_push: parseInteger(getByAliases(row, headerMap, ["Meeting Push", "Meeting push"])),
      meeting_push_previous: parseInteger(getByAliases(row, headerMap, ["Meeting Push (Previous)", "Meeting push (previous)", "Meeting Push(Previous)"])),
      not_reachable: parseInteger(getByAliases(row, headerMap, ["Not Reachable"])),
      wrong_number: parseInteger(getByAliases(row, headerMap, ["Wrong Number"])),
      cb_scheduled: parseInteger(getByAliases(row, headerMap, ["CB Scheduled"])),
      meetings_done: parseInteger(getByAliases(row, headerMap, ["Meetings Done"])),
      followups_due: parseInteger(getByAliases(row, headerMap, ["Follow-ups Due"])),
      converted_booked_sold: parseInteger(getByAliases(row, headerMap, ["Converted (Booked/Sold)"])),
      conversion_pct: parseNumber(getByAliases(row, headerMap, ["Conversion %"])),
      remarks: getByAliases(row, headerMap, ["Remarks"]),
    };

    if (!isMeaningfulMetricsRow(data)) continue;

    records.push({
      dataset_key: "fact_agent_daily_stats",
      source_file: fileName,
      source_row_number: i + 1,
      owner_label: label,
      payload: data,
      raw_row: row,
    });
  }

  return records;
}

function transformTeamOrProjectDaily(fileName, label, rows, datasetKey) {
  const headerIdx = findHeaderRow(rows, ["total leads", "connected"]);
  if (headerIdx < 0) return [];

  const headerMap = buildHeaderIndex(rowWithoutIndex(rows[headerIdx]));
  const records = [];

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rowWithoutIndex(rows[i]);
    const dateVal = parseDateFlexible(row[0]);
    if (!dateVal) continue;

    const data = {
      stat_date: dateVal,
      total_leads: parseInteger(getByAliases(row, headerMap, ["Total Leads"])),
      dialed_new: parseInteger(getByAliases(row, headerMap, ["Dialed (NEW)", "Dialed"])),
      connected: parseInteger(getByAliases(row, headerMap, ["Connected"])),
      hot: parseInteger(getByAliases(row, headerMap, ["Hot"])),
      warm: parseInteger(getByAliases(row, headerMap, ["Warm"])),
      cold: parseInteger(getByAliases(row, headerMap, ["Cold"])),
      not_reachable: parseInteger(getByAliases(row, headerMap, ["Not Reachable"])),
      wrong_number: parseInteger(getByAliases(row, headerMap, ["Wrong Number"])),
      cb_scheduled: parseInteger(getByAliases(row, headerMap, ["CB Scheduled"])),
      meetings_done: parseInteger(getByAliases(row, headerMap, ["Meetings Done"])),
      converted_booked_sold: parseInteger(getByAliases(row, headerMap, ["Converted (Booked/Sold)"])),
      conversion_pct: parseNumber(getByAliases(row, headerMap, ["Conversion %"])),
      meeting_push: parseInteger(getByAliases(row, headerMap, ["Meeting Push", "Meeting push"])),
      meeting_push_previous: parseInteger(getByAliases(row, headerMap, ["Meeting Push (Previous)", "Meeting push (previous)"])),
      total_tokens: parseInteger(getByAliases(row, headerMap, ["Total Tokens"])),
      token_received: parseNumber(getByAliases(row, headerMap, ["Token Received"])),
      remarks: getByAliases(row, headerMap, ["Remarks"]),
    };

    if (!isMeaningfulMetricsRow(data)) continue;

    records.push({
      dataset_key: datasetKey,
      source_file: fileName,
      source_row_number: i + 1,
      owner_label: label,
      payload: data,
      raw_row: row,
    });
  }

  return records;
}

function transformIncomingInteractions(fileName, label, rows) {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
    const joined = rowWithoutIndex(rows[i]).join(" | ").toLowerCase();
    if (!joined.includes("phone")) continue;
    if (!(joined.includes("time") || joined.includes("date"))) continue;
    if (!(joined.includes("query") || joined.includes("querry"))) continue;
    headerIdx = i;
    break;
  }

  if (headerIdx < 0) return [];

  const records = [];

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
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

    records.push({
      dataset_key: "fact_incoming_interactions",
      source_file: fileName,
      source_row_number: i + 1,
      owner_label: label,
      payload: {
        interaction_date: interactionDate,
        interaction_time: time,
        phone_number_raw: phone.raw,
        phone_number_normalized: phone.normalized,
        person_name: personName,
        query_nature: queryNature,
        client_query: clientQuery,
        action_steps: actionSteps,
        follow_up_required: followUpRequired,
      },
      raw_row: row,
    });
  }

  return records;
}

function transformSalesConversions(fileName, label, rows) {
  const headerIdx = findHeaderRow(rows, ["client name", "plot size", "sale completed"]);
  if (headerIdx < 0) return [];

  const records = [];

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rowWithoutIndex(rows[i]);
    const saleDate = parseDateFlexible(row[0]);
    if (!saleDate) continue;

    const clientName = String(row[1] || "").trim();
    if (!clientName) continue;

    const fileHandedOverText = String(row[13] || "").trim().toLowerCase();
    const fileHandedOver = fileHandedOverText
      ? ["yes", "y", "true", "1"].includes(fileHandedOverText)
      : null;

    records.push({
      dataset_key: "fact_sales_conversions",
      source_file: fileName,
      source_row_number: i + 1,
      owner_label: label,
      payload: {
        sale_date: saleDate,
        client_name: clientName,
        city: String(row[2] || "").trim() || null,
        plot_size: parseNumber(row[3]),
        token_taken: parseNumber(row[4]),
        expected_payment_receiving_date: String(row[5] || "").trim() || null,
        first_payment: parseNumber(row[6]),
        down_payment: parseNumber(row[7]),
        dealer_rebate: String(row[8] || "").trim() || null,
        payment_received_date: String(row[9] || "").trim() || null,
        installment_plan: String(row[10] || "").trim() || null,
        closer: String(row[11] || "").trim() || null,
        discount_offered: String(row[12] || "").trim() || null,
        file_handed_over: fileHandedOver,
        sale_completed_by: String(row[14] || "").trim() || null,
      },
      raw_row: row,
    });
  }

  return records;
}

function transformWeeklySnapshots(fileName, label, rows) {
  const headerIdx = findHeaderRow(rows, ["date", "total leads", "token received"]);
  if (headerIdx < 0) return [];

  let weekStart = null;
  let weekEnd = null;
  for (let i = 0; i < headerIdx; i += 1) {
    const text = rowWithoutIndex(rows[i]).join(" ").trim();
    if (!/weekly report/i.test(text)) continue;
    const rangeMatch = text.match(/from\s+([^\s]+)\s+to\s+([^\s]+)/i);
    if (rangeMatch) {
      weekStart = parseDateFlexible(rangeMatch[1]);
      weekEnd = parseDateFlexible(rangeMatch[2]);
    }
  }

  const headerMap = buildHeaderIndex(rowWithoutIndex(rows[headerIdx]));
  const records = [];

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rowWithoutIndex(rows[i]);
    if (!row.some((cell) => String(cell || "").trim())) continue;

    const firstCell = String(row[0] || "").trim();
    const isTotal = /^total$/i.test(firstCell);

    const statDate = isTotal
      ? (weekEnd || weekStart || "1900-01-01")
      : parseDateFlexible(firstCell);

    if (!isTotal && !statDate) continue;

    const data = {
      week_start_date: weekStart,
      week_end_date: weekEnd,
      stat_date: statDate,
      is_total: isTotal,
      total_leads: parseInteger(getByAliases(row, headerMap, ["Total Leads"])),
      dialed_new: parseInteger(getByAliases(row, headerMap, ["Dialed", "Dialed (NEW)"])),
      connected: parseInteger(getByAliases(row, headerMap, ["Connected"])),
      hot: parseInteger(getByAliases(row, headerMap, ["Hot"])),
      warm: parseInteger(getByAliases(row, headerMap, ["Warm"])),
      cold: parseInteger(getByAliases(row, headerMap, ["Cold"])),
      not_reachable: parseInteger(getByAliases(row, headerMap, ["Not Reachable"])),
      wrong_number: parseInteger(getByAliases(row, headerMap, ["Wrong Number"])),
      cb_scheduled: parseInteger(getByAliases(row, headerMap, ["CB Scheduled"])),
      meetings_done: parseInteger(getByAliases(row, headerMap, ["Meetings Done"])),
      converted_booked_sold: parseInteger(getByAliases(row, headerMap, ["Converted (Booked/Sold)"])),
      conversion_pct: parseNumber(getByAliases(row, headerMap, ["Conversion %"])),
      meeting_push: parseInteger(getByAliases(row, headerMap, ["Meeting Push"])),
      meeting_push_previous: parseInteger(getByAliases(row, headerMap, ["Meeting Push (Previous)"])),
      total_tokens: parseInteger(getByAliases(row, headerMap, ["Total Tokens"])),
      token_received: parseNumber(getByAliases(row, headerMap, ["Token Received"])),
    };

    if (!isMeaningfulMetricsRow(data)) continue;

    records.push({
      dataset_key: "fact_weekly_snapshots",
      source_file: fileName,
      source_row_number: i + 1,
      owner_label: label,
      payload: data,
      raw_row: row,
    });
  }

  return records;
}

function transformPeriodSummary(fileName, label, rows) {
  const headerIdx = findHeaderRow(rows, ["name", "date", "interested hot leads"]);
  if (headerIdx < 0) return [];

  const records = [];

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rowWithoutIndex(rows[i]);
    if (!row.some((cell) => String(cell || "").trim())) continue;

    const nameCell = String(row[0] || "").trim();
    if (!nameCell) continue;

    if (/total leads/i.test(nameCell)) {
      const totalMatch = nameCell.match(/(\d+)/);
      records.push({
        dataset_key: "fact_period_summaries",
        source_file: fileName,
        source_row_number: i + 1,
        owner_label: label,
        payload: {
          name: "AL-RAHEEM",
          period_label: "TOTAL",
          period_start_date: null,
          period_end_date: null,
          total_leads: totalMatch ? Number(totalMatch[1]) : parseInteger(row[2]),
          interested_hot_leads: parseInteger(row[3]),
          record_type: "grand_total",
        },
        raw_row: row,
      });
      continue;
    }

    const range = parseDateRange(row[1]);
    const totalLeads = parseInteger(row[2]);
    const hotLeads = parseInteger(row[3]);

    if (!range.start && !range.end && totalLeads == null && hotLeads == null) continue;

    records.push({
      dataset_key: "fact_period_summaries",
      source_file: fileName,
      source_row_number: i + 1,
      owner_label: label,
      payload: {
        name: nameCell,
        period_label: range.label,
        period_start_date: range.start,
        period_end_date: range.end,
        total_leads: totalLeads,
        interested_hot_leads: hotLeads,
        record_type: "period",
      },
      raw_row: row,
    });
  }

  return records;
}

async function ensureStatsSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS etl_import_batches (
      id BIGSERIAL PRIMARY KEY,
      source_path TEXT NOT NULL,
      status TEXT NOT NULL,
      files_processed INT NOT NULL DEFAULT 0,
      rows_staged INT NOT NULL DEFAULT 0,
      rows_loaded INT NOT NULL DEFAULT 0,
      summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      error_message TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS stg_raw_stats_rows (
      id BIGSERIAL PRIMARY KEY,
      import_batch_id BIGINT NOT NULL REFERENCES etl_import_batches(id) ON DELETE CASCADE,
      dataset_key TEXT NOT NULL,
      file_name TEXT NOT NULL,
      sheet_row_number INT NOT NULL,
      row_hash TEXT NOT NULL,
      raw_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(import_batch_id, dataset_key, file_name, sheet_row_number, row_hash)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS dim_agents (
      id BIGSERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS dim_teams (
      id BIGSERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS dim_projects (
      id BIGSERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS dim_channels (
      id BIGSERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS fact_agent_daily_stats (
      id BIGSERIAL PRIMARY KEY,
      agent_id BIGINT NOT NULL REFERENCES dim_agents(id),
      stat_date DATE NOT NULL,
      shift TEXT NOT NULL DEFAULT '',
      total_leads INT,
      dialed_new INT,
      dialed_previous INT,
      connected INT,
      talk_time_mins INT,
      hot INT,
      warm INT,
      cold INT,
      meeting_push INT,
      meeting_push_previous INT,
      not_reachable INT,
      wrong_number INT,
      cb_scheduled INT,
      meetings_done INT,
      followups_due INT,
      converted_booked_sold INT,
      conversion_pct NUMERIC(8,2),
      remarks TEXT,
      source_file TEXT NOT NULL,
      source_row_number INT NOT NULL,
      import_batch_id BIGINT NOT NULL REFERENCES etl_import_batches(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(agent_id, stat_date, shift)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS fact_team_daily_stats (
      id BIGSERIAL PRIMARY KEY,
      team_id BIGINT NOT NULL REFERENCES dim_teams(id),
      stat_date DATE NOT NULL,
      total_leads INT,
      dialed_new INT,
      connected INT,
      hot INT,
      warm INT,
      cold INT,
      not_reachable INT,
      wrong_number INT,
      cb_scheduled INT,
      meetings_done INT,
      converted_booked_sold INT,
      conversion_pct NUMERIC(8,2),
      meeting_push INT,
      meeting_push_previous INT,
      total_tokens INT,
      token_received NUMERIC(12,2),
      remarks TEXT,
      source_file TEXT NOT NULL,
      source_row_number INT NOT NULL,
      import_batch_id BIGINT NOT NULL REFERENCES etl_import_batches(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(team_id, stat_date)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS fact_project_daily_stats (
      id BIGSERIAL PRIMARY KEY,
      project_id BIGINT NOT NULL REFERENCES dim_projects(id),
      stat_date DATE NOT NULL,
      total_leads INT,
      dialed_new INT,
      connected INT,
      hot INT,
      warm INT,
      cold INT,
      not_reachable INT,
      wrong_number INT,
      cb_scheduled INT,
      meetings_done INT,
      converted_booked_sold INT,
      conversion_pct NUMERIC(8,2),
      meeting_push INT,
      meeting_push_previous INT,
      total_tokens INT,
      token_received NUMERIC(12,2),
      remarks TEXT,
      source_file TEXT NOT NULL,
      source_row_number INT NOT NULL,
      import_batch_id BIGINT NOT NULL REFERENCES etl_import_batches(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id, stat_date)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS fact_incoming_interactions (
      id BIGSERIAL PRIMARY KEY,
      channel_id BIGINT NOT NULL REFERENCES dim_channels(id),
      interaction_date DATE NOT NULL,
      interaction_time TEXT NOT NULL DEFAULT '',
      phone_number_raw TEXT,
      phone_number_normalized TEXT NOT NULL DEFAULT '',
      person_name TEXT NOT NULL DEFAULT '',
      query_nature TEXT,
      client_query TEXT,
      action_steps TEXT,
      follow_up_required TEXT,
      source_file TEXT NOT NULL,
      source_row_number INT NOT NULL,
      import_batch_id BIGINT NOT NULL REFERENCES etl_import_batches(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(channel_id, interaction_date, interaction_time, phone_number_normalized, person_name)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS fact_sales_conversions (
      id BIGSERIAL PRIMARY KEY,
      sale_date DATE NOT NULL,
      client_name TEXT NOT NULL,
      city TEXT,
      plot_size NUMERIC(8,2),
      token_taken NUMERIC(12,2),
      expected_payment_receiving_date TEXT,
      first_payment NUMERIC(12,2),
      down_payment NUMERIC(12,2),
      dealer_rebate TEXT,
      payment_received_date TEXT,
      installment_plan TEXT,
      closer TEXT NOT NULL DEFAULT '',
      discount_offered TEXT,
      file_handed_over BOOLEAN,
      sale_completed_by TEXT,
      source_file TEXT NOT NULL,
      source_row_number INT NOT NULL,
      import_batch_id BIGINT NOT NULL REFERENCES etl_import_batches(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(client_name, sale_date, closer)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS fact_weekly_snapshots (
      id BIGSERIAL PRIMARY KEY,
      week_start_date DATE,
      week_end_date DATE,
      stat_date DATE NOT NULL,
      is_total BOOLEAN NOT NULL DEFAULT FALSE,
      total_leads INT,
      dialed_new INT,
      connected INT,
      hot INT,
      warm INT,
      cold INT,
      not_reachable INT,
      wrong_number INT,
      cb_scheduled INT,
      meetings_done INT,
      converted_booked_sold INT,
      conversion_pct NUMERIC(8,2),
      meeting_push INT,
      meeting_push_previous INT,
      total_tokens INT,
      token_received NUMERIC(12,2),
      source_file TEXT NOT NULL,
      source_row_number INT NOT NULL,
      import_batch_id BIGINT NOT NULL REFERENCES etl_import_batches(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(week_start_date, week_end_date, stat_date, is_total)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS fact_period_summaries (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      period_label TEXT,
      period_start_date DATE,
      period_end_date DATE,
      total_leads INT,
      interested_hot_leads INT,
      record_type TEXT NOT NULL,
      source_file TEXT NOT NULL,
      source_row_number INT NOT NULL,
      import_batch_id BIGINT NOT NULL REFERENCES etl_import_batches(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(name, period_label, record_type)
    )
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_stg_raw_stats_rows_batch ON stg_raw_stats_rows(import_batch_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fact_agent_daily_stats_date ON fact_agent_daily_stats(stat_date)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fact_team_daily_stats_date ON fact_team_daily_stats(stat_date)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fact_project_daily_stats_date ON fact_project_daily_stats(stat_date)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fact_incoming_interactions_date ON fact_incoming_interactions(interaction_date)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fact_sales_conversions_date ON fact_sales_conversions(sale_date)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fact_weekly_snapshots_week ON fact_weekly_snapshots(week_start_date, week_end_date)`);
}

async function getOrCreateDimensionId(client, cache, tableName, name) {
  const value = String(name || "").trim();
  if (!value) return null;
  const key = `${tableName}:${value}`;
  if (cache.has(key)) return cache.get(key);

  const { rows } = await client.query(
    `
      INSERT INTO ${tableName} (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [value]
  );

  const id = rows[0].id;
  cache.set(key, id);
  return id;
}

async function stageRawRow(client, importBatchId, record) {
  const rowHash = toRowHash({
    dataset_key: record.dataset_key,
    file: record.source_file,
    row: record.source_row_number,
    payload: record.payload,
  });

  await client.query(
    `
      INSERT INTO stg_raw_stats_rows (
        import_batch_id,
        dataset_key,
        file_name,
        sheet_row_number,
        row_hash,
        raw_json
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      ON CONFLICT (import_batch_id, dataset_key, file_name, sheet_row_number, row_hash)
      DO NOTHING
    `,
    [
      importBatchId,
      record.dataset_key,
      record.source_file,
      record.source_row_number,
      rowHash,
      JSON.stringify({ payload: record.payload, raw_row: record.raw_row }),
    ]
  );
}

async function upsertFactRow(client, cache, importBatchId, record) {
  const p = record.payload;

  if (record.dataset_key === "fact_agent_daily_stats") {
    const agentId = await getOrCreateDimensionId(client, cache, "dim_agents", record.owner_label);

    await client.query(
      `
        INSERT INTO fact_agent_daily_stats (
          agent_id, stat_date, shift,
          total_leads, dialed_new, dialed_previous, connected, talk_time_mins,
          hot, warm, cold, meeting_push, meeting_push_previous,
          not_reachable, wrong_number, cb_scheduled, meetings_done, followups_due,
          converted_booked_sold, conversion_pct, remarks,
          source_file, source_row_number, import_batch_id
        ) VALUES (
          $1, $2, COALESCE($3, ''),
          $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18,
          $19, $20, $21,
          $22, $23, $24
        )
        ON CONFLICT (agent_id, stat_date, shift)
        DO UPDATE SET
          total_leads = EXCLUDED.total_leads,
          dialed_new = EXCLUDED.dialed_new,
          dialed_previous = EXCLUDED.dialed_previous,
          connected = EXCLUDED.connected,
          talk_time_mins = EXCLUDED.talk_time_mins,
          hot = EXCLUDED.hot,
          warm = EXCLUDED.warm,
          cold = EXCLUDED.cold,
          meeting_push = EXCLUDED.meeting_push,
          meeting_push_previous = EXCLUDED.meeting_push_previous,
          not_reachable = EXCLUDED.not_reachable,
          wrong_number = EXCLUDED.wrong_number,
          cb_scheduled = EXCLUDED.cb_scheduled,
          meetings_done = EXCLUDED.meetings_done,
          followups_due = EXCLUDED.followups_due,
          converted_booked_sold = EXCLUDED.converted_booked_sold,
          conversion_pct = EXCLUDED.conversion_pct,
          remarks = EXCLUDED.remarks,
          source_file = EXCLUDED.source_file,
          source_row_number = EXCLUDED.source_row_number,
          import_batch_id = EXCLUDED.import_batch_id,
          updated_at = NOW()
      `,
      [
        agentId,
        p.stat_date,
        p.shift,
        p.total_leads,
        p.dialed_new,
        p.dialed_previous,
        p.connected,
        p.talk_time_mins,
        p.hot,
        p.warm,
        p.cold,
        p.meeting_push,
        p.meeting_push_previous,
        p.not_reachable,
        p.wrong_number,
        p.cb_scheduled,
        p.meetings_done,
        p.followups_due,
        p.converted_booked_sold,
        p.conversion_pct,
        p.remarks || null,
        record.source_file,
        record.source_row_number,
        importBatchId,
      ]
    );

    return;
  }

  if (record.dataset_key === "fact_team_daily_stats") {
    const teamId = await getOrCreateDimensionId(client, cache, "dim_teams", record.owner_label);

    await client.query(
      `
        INSERT INTO fact_team_daily_stats (
          team_id, stat_date,
          total_leads, dialed_new, connected,
          hot, warm, cold, not_reachable, wrong_number,
          cb_scheduled, meetings_done, converted_booked_sold, conversion_pct,
          meeting_push, meeting_push_previous, total_tokens, token_received,
          remarks,
          source_file, source_row_number, import_batch_id
        ) VALUES (
          $1, $2,
          $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18,
          $19,
          $20, $21, $22
        )
        ON CONFLICT (team_id, stat_date)
        DO UPDATE SET
          total_leads = EXCLUDED.total_leads,
          dialed_new = EXCLUDED.dialed_new,
          connected = EXCLUDED.connected,
          hot = EXCLUDED.hot,
          warm = EXCLUDED.warm,
          cold = EXCLUDED.cold,
          not_reachable = EXCLUDED.not_reachable,
          wrong_number = EXCLUDED.wrong_number,
          cb_scheduled = EXCLUDED.cb_scheduled,
          meetings_done = EXCLUDED.meetings_done,
          converted_booked_sold = EXCLUDED.converted_booked_sold,
          conversion_pct = EXCLUDED.conversion_pct,
          meeting_push = EXCLUDED.meeting_push,
          meeting_push_previous = EXCLUDED.meeting_push_previous,
          total_tokens = EXCLUDED.total_tokens,
          token_received = EXCLUDED.token_received,
          remarks = EXCLUDED.remarks,
          source_file = EXCLUDED.source_file,
          source_row_number = EXCLUDED.source_row_number,
          import_batch_id = EXCLUDED.import_batch_id,
          updated_at = NOW()
      `,
      [
        teamId,
        p.stat_date,
        p.total_leads,
        p.dialed_new,
        p.connected,
        p.hot,
        p.warm,
        p.cold,
        p.not_reachable,
        p.wrong_number,
        p.cb_scheduled,
        p.meetings_done,
        p.converted_booked_sold,
        p.conversion_pct,
        p.meeting_push,
        p.meeting_push_previous,
        p.total_tokens,
        p.token_received,
        p.remarks || null,
        record.source_file,
        record.source_row_number,
        importBatchId,
      ]
    );

    return;
  }

  if (record.dataset_key === "fact_project_daily_stats") {
    const projectId = await getOrCreateDimensionId(client, cache, "dim_projects", record.owner_label);

    await client.query(
      `
        INSERT INTO fact_project_daily_stats (
          project_id, stat_date,
          total_leads, dialed_new, connected,
          hot, warm, cold, not_reachable, wrong_number,
          cb_scheduled, meetings_done, converted_booked_sold, conversion_pct,
          meeting_push, meeting_push_previous, total_tokens, token_received,
          remarks,
          source_file, source_row_number, import_batch_id
        ) VALUES (
          $1, $2,
          $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18,
          $19,
          $20, $21, $22
        )
        ON CONFLICT (project_id, stat_date)
        DO UPDATE SET
          total_leads = EXCLUDED.total_leads,
          dialed_new = EXCLUDED.dialed_new,
          connected = EXCLUDED.connected,
          hot = EXCLUDED.hot,
          warm = EXCLUDED.warm,
          cold = EXCLUDED.cold,
          not_reachable = EXCLUDED.not_reachable,
          wrong_number = EXCLUDED.wrong_number,
          cb_scheduled = EXCLUDED.cb_scheduled,
          meetings_done = EXCLUDED.meetings_done,
          converted_booked_sold = EXCLUDED.converted_booked_sold,
          conversion_pct = EXCLUDED.conversion_pct,
          meeting_push = EXCLUDED.meeting_push,
          meeting_push_previous = EXCLUDED.meeting_push_previous,
          total_tokens = EXCLUDED.total_tokens,
          token_received = EXCLUDED.token_received,
          remarks = EXCLUDED.remarks,
          source_file = EXCLUDED.source_file,
          source_row_number = EXCLUDED.source_row_number,
          import_batch_id = EXCLUDED.import_batch_id,
          updated_at = NOW()
      `,
      [
        projectId,
        p.stat_date,
        p.total_leads,
        p.dialed_new,
        p.connected,
        p.hot,
        p.warm,
        p.cold,
        p.not_reachable,
        p.wrong_number,
        p.cb_scheduled,
        p.meetings_done,
        p.converted_booked_sold,
        p.conversion_pct,
        p.meeting_push,
        p.meeting_push_previous,
        p.total_tokens,
        p.token_received,
        p.remarks || null,
        record.source_file,
        record.source_row_number,
        importBatchId,
      ]
    );

    return;
  }

  if (record.dataset_key === "fact_incoming_interactions") {
    const channelId = await getOrCreateDimensionId(client, cache, "dim_channels", record.owner_label);

    await client.query(
      `
        INSERT INTO fact_incoming_interactions (
          channel_id,
          interaction_date,
          interaction_time,
          phone_number_raw,
          phone_number_normalized,
          person_name,
          query_nature,
          client_query,
          action_steps,
          follow_up_required,
          source_file,
          source_row_number,
          import_batch_id
        ) VALUES (
          $1, $2, COALESCE($3, ''), $4, COALESCE($5, ''), COALESCE($6, ''),
          $7, $8, $9, $10,
          $11, $12, $13
        )
        ON CONFLICT (channel_id, interaction_date, interaction_time, phone_number_normalized, person_name)
        DO UPDATE SET
          phone_number_raw = EXCLUDED.phone_number_raw,
          query_nature = EXCLUDED.query_nature,
          client_query = EXCLUDED.client_query,
          action_steps = EXCLUDED.action_steps,
          follow_up_required = EXCLUDED.follow_up_required,
          source_file = EXCLUDED.source_file,
          source_row_number = EXCLUDED.source_row_number,
          import_batch_id = EXCLUDED.import_batch_id,
          updated_at = NOW()
      `,
      [
        channelId,
        p.interaction_date,
        p.interaction_time,
        p.phone_number_raw,
        p.phone_number_normalized,
        p.person_name,
        p.query_nature,
        p.client_query,
        p.action_steps,
        p.follow_up_required,
        record.source_file,
        record.source_row_number,
        importBatchId,
      ]
    );

    return;
  }

  if (record.dataset_key === "fact_sales_conversions") {
    await client.query(
      `
        INSERT INTO fact_sales_conversions (
          sale_date, client_name, city, plot_size,
          token_taken, expected_payment_receiving_date, first_payment,
          down_payment, dealer_rebate, payment_received_date,
          installment_plan, closer, discount_offered, file_handed_over,
          sale_completed_by,
          source_file, source_row_number, import_batch_id
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10,
          $11, COALESCE($12, ''), $13, $14,
          $15,
          $16, $17, $18
        )
        ON CONFLICT (client_name, sale_date, closer)
        DO UPDATE SET
          city = EXCLUDED.city,
          plot_size = EXCLUDED.plot_size,
          token_taken = EXCLUDED.token_taken,
          expected_payment_receiving_date = EXCLUDED.expected_payment_receiving_date,
          first_payment = EXCLUDED.first_payment,
          down_payment = EXCLUDED.down_payment,
          dealer_rebate = EXCLUDED.dealer_rebate,
          payment_received_date = EXCLUDED.payment_received_date,
          installment_plan = EXCLUDED.installment_plan,
          discount_offered = EXCLUDED.discount_offered,
          file_handed_over = EXCLUDED.file_handed_over,
          sale_completed_by = EXCLUDED.sale_completed_by,
          source_file = EXCLUDED.source_file,
          source_row_number = EXCLUDED.source_row_number,
          import_batch_id = EXCLUDED.import_batch_id,
          updated_at = NOW()
      `,
      [
        p.sale_date,
        p.client_name,
        p.city,
        p.plot_size,
        p.token_taken,
        p.expected_payment_receiving_date,
        p.first_payment,
        p.down_payment,
        p.dealer_rebate,
        p.payment_received_date,
        p.installment_plan,
        p.closer,
        p.discount_offered,
        p.file_handed_over,
        p.sale_completed_by,
        record.source_file,
        record.source_row_number,
        importBatchId,
      ]
    );

    return;
  }

  if (record.dataset_key === "fact_weekly_snapshots") {
    await client.query(
      `
        INSERT INTO fact_weekly_snapshots (
          week_start_date,
          week_end_date,
          stat_date,
          is_total,
          total_leads,
          dialed_new,
          connected,
          hot,
          warm,
          cold,
          not_reachable,
          wrong_number,
          cb_scheduled,
          meetings_done,
          converted_booked_sold,
          conversion_pct,
          meeting_push,
          meeting_push_previous,
          total_tokens,
          token_received,
          source_file,
          source_row_number,
          import_batch_id
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23
        )
        ON CONFLICT (week_start_date, week_end_date, stat_date, is_total)
        DO UPDATE SET
          total_leads = EXCLUDED.total_leads,
          dialed_new = EXCLUDED.dialed_new,
          connected = EXCLUDED.connected,
          hot = EXCLUDED.hot,
          warm = EXCLUDED.warm,
          cold = EXCLUDED.cold,
          not_reachable = EXCLUDED.not_reachable,
          wrong_number = EXCLUDED.wrong_number,
          cb_scheduled = EXCLUDED.cb_scheduled,
          meetings_done = EXCLUDED.meetings_done,
          converted_booked_sold = EXCLUDED.converted_booked_sold,
          conversion_pct = EXCLUDED.conversion_pct,
          meeting_push = EXCLUDED.meeting_push,
          meeting_push_previous = EXCLUDED.meeting_push_previous,
          total_tokens = EXCLUDED.total_tokens,
          token_received = EXCLUDED.token_received,
          source_file = EXCLUDED.source_file,
          source_row_number = EXCLUDED.source_row_number,
          import_batch_id = EXCLUDED.import_batch_id,
          updated_at = NOW()
      `,
      [
        p.week_start_date,
        p.week_end_date,
        p.stat_date,
        p.is_total,
        p.total_leads,
        p.dialed_new,
        p.connected,
        p.hot,
        p.warm,
        p.cold,
        p.not_reachable,
        p.wrong_number,
        p.cb_scheduled,
        p.meetings_done,
        p.converted_booked_sold,
        p.conversion_pct,
        p.meeting_push,
        p.meeting_push_previous,
        p.total_tokens,
        p.token_received,
        record.source_file,
        record.source_row_number,
        importBatchId,
      ]
    );

    return;
  }

  if (record.dataset_key === "fact_period_summaries") {
    await client.query(
      `
        INSERT INTO fact_period_summaries (
          name,
          period_label,
          period_start_date,
          period_end_date,
          total_leads,
          interested_hot_leads,
          record_type,
          source_file,
          source_row_number,
          import_batch_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (name, period_label, record_type)
        DO UPDATE SET
          period_start_date = EXCLUDED.period_start_date,
          period_end_date = EXCLUDED.period_end_date,
          total_leads = EXCLUDED.total_leads,
          interested_hot_leads = EXCLUDED.interested_hot_leads,
          source_file = EXCLUDED.source_file,
          source_row_number = EXCLUDED.source_row_number,
          import_batch_id = EXCLUDED.import_batch_id,
          updated_at = NOW()
      `,
      [
        p.name,
        p.period_label,
        p.period_start_date,
        p.period_end_date,
        p.total_leads,
        p.interested_hot_leads,
        p.record_type,
        record.source_file,
        record.source_row_number,
        importBatchId,
      ]
    );
  }
}

function transformByKind(fileName, kind, label, rows) {
  if (kind === "agent_daily") return transformAgentDaily(fileName, label, rows);
  if (kind === "team_daily") return transformTeamOrProjectDaily(fileName, label, rows, "fact_team_daily_stats");
  if (kind === "project_daily") return transformTeamOrProjectDaily(fileName, label, rows, "fact_project_daily_stats");
  if (kind === "incoming_interaction") return transformIncomingInteractions(fileName, label, rows);
  if (kind === "sales_conversion") return transformSalesConversions(fileName, label, rows);
  if (kind === "weekly_snapshot") return transformWeeklySnapshots(fileName, label, rows);
  if (kind === "period_summary") return transformPeriodSummary(fileName, label, rows);
  return [];
}

async function main() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const sourceDir = process.env.ARD_STATS_SOURCE_DIR || path.join(cwd, SOURCE_DIR_DEFAULT);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Stats source directory not found: ${sourceDir}`);
  }

  const useSsl =
    process.env.DATABASE_URL.includes("neon.tech") ||
    process.env.DATABASE_URL.includes("sslmode=require");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  const dimCache = new Map();
  const includeFilesRaw = process.env.ARD_STATS_INCLUDE_FILES || "";
  const includeSet = includeFilesRaw
    ? new Set(includeFilesRaw.split(",").map((s) => s.trim()).filter(Boolean))
    : null;

  const files = Object.keys(FILE_KIND_MAP)
    .filter((f) => fs.existsSync(path.join(sourceDir, f)))
    .filter((f) => (includeSet ? includeSet.has(f) : true))
    .sort((a, b) => a.localeCompare(b));

  await ensureStatsSchema(client);

  const { rows: batchRows } = await client.query(
    `
      INSERT INTO etl_import_batches (source_path, status)
      VALUES ($1, 'running')
      RETURNING id, started_at
    `,
    [sourceDir]
  );

  const importBatchId = batchRows[0].id;

  const summary = {
    import_batch_id: importBatchId,
    source_dir: sourceDir,
    files_total: files.length,
    files_processed: 0,
    rows_staged: 0,
    rows_loaded: 0,
    by_file: {},
  };

  try {
    for (const fileName of files) {
      const meta = FILE_KIND_MAP[fileName];
      const html = fs.readFileSync(path.join(sourceDir, fileName), "utf8");
      const rows = extractRowsFromHtml(html);
      const transformed = transformByKind(fileName, meta.kind, meta.label, rows);

      let staged = 0;
      let loaded = 0;

      for (const record of transformed) {
        await stageRawRow(client, importBatchId, record);
        staged += 1;

        await upsertFactRow(client, dimCache, importBatchId, record);
        loaded += 1;
      }

      summary.files_processed += 1;
      summary.rows_staged += staged;
      summary.rows_loaded += loaded;
      summary.by_file[fileName] = {
        kind: meta.kind,
        owner: meta.label,
        rows_extracted: rows.length,
        rows_transformed: transformed.length,
        rows_staged: staged,
        rows_loaded: loaded,
      };

      await client.query(
        `
          UPDATE etl_import_batches
          SET
            files_processed = $2,
            rows_staged = $3,
            rows_loaded = $4,
            summary = $5::jsonb
          WHERE id = $1
        `,
        [
          importBatchId,
          summary.files_processed,
          summary.rows_staged,
          summary.rows_loaded,
          JSON.stringify(summary),
        ]
      );
    }

    await client.query(
      `
        UPDATE etl_import_batches
        SET
          status = 'completed',
          files_processed = $2,
          rows_staged = $3,
          rows_loaded = $4,
          summary = $5::jsonb,
          completed_at = NOW()
        WHERE id = $1
      `,
      [importBatchId, summary.files_processed, summary.rows_staged, summary.rows_loaded, JSON.stringify(summary)]
    );

    const reportPath = path.join(cwd, "docs", "stats-import-last-summary.json");
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));

    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    await client.query(
      `
        UPDATE etl_import_batches
        SET
          status = 'failed',
          files_processed = $2,
          rows_staged = $3,
          rows_loaded = $4,
          summary = $5::jsonb,
          error_message = $6,
          completed_at = NOW()
        WHERE id = $1
      `,
      [
        importBatchId,
        summary.files_processed,
        summary.rows_staged,
        summary.rows_loaded,
        JSON.stringify(summary),
        String(err.message || err),
      ]
    );

    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Stats seed failed:", err.message);
  process.exit(1);
});

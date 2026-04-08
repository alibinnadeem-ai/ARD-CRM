/**
 * pages/api/sync/stats.js
 * GET /api/sync/stats
 * Returns extended analytics including time-series data for trend charts
 */

import { getAllRows } from "../../../lib/db/connector";
import { normalizeRecord, isVisibleLeadRecord } from "../../../lib/transforms/mapper";
import { requireAuth } from "../../../lib/auth";

function groupByMonth(records, field = "created_at") {
  const counts = {};
  for (const r of records) {
    const val = r[field];
    if (!val) continue;
    try {
      const d = new Date(val);
      if (isNaN(d)) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      counts[key] = (counts[key] || 0) + 1;
    } catch {}
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

function topN(records, field, n = 5) {
  const counts = {};
  for (const r of records) {
    const v = r[field] || "Unknown";
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([name, value]) => ({ name, value }));
}

export default requireAuth(async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const { records } = await getAllRows();
    const normalized = records
      .map(normalizeRecord)
      .filter(isVisibleLeadRecord);

    const leadsOverTime = groupByMonth(normalized, "created_at");
    const wonOverTime = groupByMonth(
      normalized.filter((r) => r.status === "Won"),
      "updated_at"
    );

    const avgValue = (() => {
      const withValue = normalized.filter((r) => r.value && !isNaN(parseFloat(r.value)));
      if (!withValue.length) return 0;
      const sum = withValue.reduce((s, r) => s + parseFloat(r.value), 0);
      return Math.round(sum / withValue.length);
    })();

    const topCities = topN(normalized, "city");
    const topAgents = topN(normalized, "assigned_to");
    const topSources = topN(normalized, "source");

    const statusBreakdown = (() => {
      const counts = {};
      for (const r of normalized) {
        counts[r.status || "Unknown"] = (counts[r.status || "Unknown"] || 0) + 1;
      }
      return counts;
    })();

    return res.status(200).json({
      success: true,
      stats: {
        leadsOverTime,
        wonOverTime,
        avgDealValue: avgValue,
        topCities,
        topAgents,
        topSources,
        statusBreakdown,
        totalRecords: normalized.length,
      },
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

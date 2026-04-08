/**
 * pages/api/sync/index.js
 * GET /api/sync  → return database metadata + KPIs
 */

import { getSheetMeta, getAllRows } from "../../../lib/db/connector";
import {
  normalizeRecord,
  isVisibleLeadRecord,
  computeKPIs,
  computeStatusDistribution,
  computeSourceDistribution,
  computeAgentSummary,
  computeStagePipeline,
} from "../../../lib/transforms/mapper";
import { requireAuth } from "../../../lib/auth";

export default requireAuth(async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [meta, { records }] = await Promise.all([
      getSheetMeta(),
      getAllRows(),
    ]);

    const normalized = records
      .map(normalizeRecord)
      .filter(isVisibleLeadRecord);

    const kpis = computeKPIs(normalized);
    const statusDist = computeStatusDistribution(normalized);
    const sourceDist = computeSourceDistribution(normalized);
    const agentSummary = computeAgentSummary(normalized);
    const stagePipeline = computeStagePipeline(normalized);

    return res.status(200).json({
      success: true,
      meta,
      kpis,
      charts: {
        statusDistribution: statusDist,
        sourceDistribution: sourceDist,
        agentSummary,
        stagePipeline,
      },
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[GET /api/sync]", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * components/dashboard/InsightsPanel.jsx
 * Generates human-readable insights from KPI and chart data
 */

function generateInsights(kpis, charts) {
  const insights = [];

  if (!kpis) return insights;

  // Conversion rate
  if (kpis.conversionRate != null) {
    const rate = kpis.conversionRate;
    insights.push({
      icon: rate >= 20 ? "🎯" : rate >= 10 ? "📈" : "⚠️",
      type: rate >= 20 ? "positive" : rate >= 10 ? "neutral" : "warning",
      text: `Conversion rate is ${rate}%. ${
        rate >= 20 ? "Excellent pipeline performance."
        : rate >= 10 ? "Room to improve closing rate."
        : "Focus on qualification and follow-ups."
      }`,
    });
  }

  // Follow-ups due
  if (kpis.followUpsDue > 0) {
    insights.push({
      icon: "📅",
      type: kpis.followUpsDue > 5 ? "warning" : "neutral",
      text: `${kpis.followUpsDue} follow-up${kpis.followUpsDue > 1 ? "s" : ""} overdue. Take action today to avoid losing leads.`,
    });
  }

  // New leads
  if (kpis.newLeads > 0) {
    insights.push({
      icon: "🔥",
      type: "positive",
      text: `${kpis.newLeads} fresh lead${kpis.newLeads > 1 ? "s" : ""} in the pipeline — assign and contact quickly.`,
    });
  }

  // Top source
  if (charts?.sourceDistribution?.length) {
    const top = charts.sourceDistribution[0];
    insights.push({
      icon: "📡",
      type: "neutral",
      text: `Best lead source: "${top.name}" with ${top.value} leads. Consider doubling down on this channel.`,
    });
  }

  // Top agent
  if (charts?.agentSummary?.length) {
    const top = charts.agentSummary[0];
    if (top.name !== "Unassigned") {
      insights.push({
        icon: "🏆",
        type: "positive",
        text: `Top performer: ${top.name} with ${top.value} assigned leads.`,
      });
    }
    // Unassigned warning
    const unassigned = charts.agentSummary.find(a => a.name === "Unassigned");
    if (unassigned?.value > 0) {
      insights.push({
        icon: "👤",
        type: "warning",
        text: `${unassigned.value} leads are unassigned. Assign them to agents to prevent drop-off.`,
      });
    }
  }

  // Pipeline value
  if (kpis.totalPipelineValue > 0) {
    const fmt = kpis.totalPipelineValue >= 1_000_000
      ? `PKR ${(kpis.totalPipelineValue / 1_000_000).toFixed(1)}M`
      : `PKR ${kpis.totalPipelineValue.toLocaleString()}`;
    insights.push({
      icon: "💰",
      type: "positive",
      text: `Total pipeline value: ${fmt}. Won value: PKR ${(kpis.wonValue / 1_000_000 || 0).toFixed(1)}M.`,
    });
  }

  return insights.slice(0, 5);
}

const TYPE_STYLES = {
  positive: { bg: "#f0fdf4", border: "#bbf7d0", icon: "#16a34a", text: "#166534" },
  warning:  { bg: "#fffbeb", border: "#fde68a", icon: "#d97706", text: "#92400e" },
  neutral:  { bg: "#f0f6ff", border: "#bfdbfe", icon: "#2563eb", text: "#1e3a5f" },
};

export default function InsightsPanel({ kpis, charts }) {
  const insights = generateInsights(kpis, charts);

  if (!insights.length) {
    return (
      <div style={{ padding: "24px", color: "var(--text-muted)", fontSize: 13.5, textAlign: "center" }}>
        Add data to your database to see insights here.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {insights.map((ins, i) => {
        const s = TYPE_STYLES[ins.type];
        return (
          <div key={i} style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            padding: "13px 16px",
            background: s.bg,
            border: `1px solid ${s.border}`,
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{ins.icon}</span>
            <p style={{ fontSize: 13, color: s.text, lineHeight: 1.55, margin: 0 }}>
              {ins.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

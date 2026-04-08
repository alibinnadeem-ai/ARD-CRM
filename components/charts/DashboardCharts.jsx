/**
 * components/charts/DashboardCharts.jsx
 * All dashboard chart components using Recharts
 */
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  FunnelChart, Funnel, LabelList,
} from "recharts";

const PALETTE = [
  "#1a3a5c", "#e8633a", "#3b82f6", "#22c55e",
  "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4",
  "#84cc16", "#ec4899",
];

const CustomTooltipStyle = {
  background: "white",
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 8,
  padding: "10px 14px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontSize: 13,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

/* ── Status Distribution Donut ────────────────────────────────────────────── */
export function StatusDonut({ data }) {
  if (!data?.length) return <ChartEmpty />;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div style={CustomTooltipStyle}>
        <strong>{d.name}</strong>
        <div style={{ color: "#64748b" }}>{d.value} leads</div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={65}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={9}
          wrapperStyle={{ fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Lead Source Bar Chart ───────────────────────────────────────────────── */
export function SourceBarChart({ data }) {
  if (!data?.length) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data.slice(0, 8)}
        layout="vertical"
        margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={CustomTooltipStyle}
          cursor={{ fill: "rgba(26,58,92,0.04)" }}
          formatter={(v) => [v + " leads", "Count"]}
        />
        <Bar dataKey="value" fill="#1a3a5c" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? "#e8633a" : "#1a3a5c"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Agent Performance Bar ───────────────────────────────────────────────── */
export function AgentBarChart({ data }) {
  if (!data?.length) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data.slice(0, 6)}
        margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={CustomTooltipStyle}
          cursor={{ fill: "rgba(26,58,92,0.04)" }}
          formatter={(v) => [v + " leads", "Assigned"]}
        />
        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={36}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Stage Pipeline Funnel ───────────────────────────────────────────────── */
export function StagePipelineChart({ data }) {
  if (!data?.length) return <ChartEmpty />;

  const enriched = data.map((d, i) => ({
    ...d,
    fill: PALETTE[i % PALETTE.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <FunnelChart>
        <Tooltip
          contentStyle={CustomTooltipStyle}
          formatter={(v) => [v + " leads", "Count"]}
        />
        <Funnel
          dataKey="value"
          data={enriched}
          isAnimationActive
        >
          <LabelList
            position="center"
            content={({ x, y, width, height, value, name }) => {
              if (!width || width < 40) return null;
              return (
                <text
                  x={x + width / 2}
                  y={y + height / 2}
                  fill="white"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {name} ({value})
                </text>
              );
            }}
          />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}

function ChartEmpty() {
  return (
    <div style={{
      height: 240, display: "flex", alignItems: "center",
      justifyContent: "center", color: "var(--text-muted)", fontSize: 13.5,
    }}>
      No data available yet
    </div>
  );
}

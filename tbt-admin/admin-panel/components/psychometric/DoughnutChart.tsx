"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

// A fixed palette looks better for small counts, but this chart's slice count
// depends on how many distinct recommended businesses exist, which grows
// with the number of question-type categories — so it must not run out.
const BASE_COLORS = ["#CB1417", "#1F2937", "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#EC4899", "#06B6D4"];
function colorsFor(count: number): string[] {
  if (count <= BASE_COLORS.length) return BASE_COLORS.slice(0, count);
  return Array.from({ length: count }, (_, i) => `hsl(${Math.round((i * 360) / count)}, 65%, 55%)`);
}

// Drawn with recharts (TBT Admin's charting library) instead of the standalone app's chart.js.
export default function DoughnutChart({ labels, data }: { labels: string[]; data: number[] }) {
  if (!labels.length) return <p className="text-sm text-center py-8" style={{ color: "var(--tbt-muted)" }}>No data yet.</p>;
  const rows = labels.map((name, i) => ({ name, value: data[i] ?? 0 }));
  const colors = colorsFor(rows.length);
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius="65%" outerRadius="90%" stroke="#fff" strokeWidth={2}>
            {rows.map((r, i) => <Cell key={r.name} fill={colors[i]} />)}
          </Pie>
          <Tooltip />
          <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: 12, color: "#1F2937" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

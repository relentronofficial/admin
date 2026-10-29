"use client";

import { Bar, BarChart as RBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Same chart as the standalone app (which drew it with chart.js), drawn with
// recharts — the charting library TBT Admin already ships.
export default function BarChart({ labels, data, label = "Assessments" }: { labels: string[]; data: number[]; label?: string }) {
  const rows = labels.map((name, i) => ({ name, value: data[i] ?? 0 }));
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <RBarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="#F3F4F6" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v) => [v, label]} />
          <Bar dataKey="value" fill="#CB1417" radius={[4, 4, 0, 0]} />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}

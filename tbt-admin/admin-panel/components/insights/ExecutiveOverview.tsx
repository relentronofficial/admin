"use client";

import { useState } from "react";
import Link from "next/link";
import { Bar as RBar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useInsightsOverview, type InsightsRange } from "@/lib/hooks/useInsights";
import { ErrorNote, KpiCard, Loading, Note, RangePicker, Section, fmtDay, fmtInr, fmtInrShort, fmtNum, fmtPct, labelCls } from "./ui";

const KPI_LABELS: Record<string, { title: string; money?: boolean; spark?: string; invert?: boolean }> = {
  revenue: { title: "Revenue", money: true, spark: "revenue" },
  newMembers: { title: "New members", spark: "newMembers" },
  activeMembers: { title: "Active members", spark: "activeMembers" },
  avgDailyActive: { title: "Avg daily active" },
  lessonsCompleted: { title: "Lessons completed", spark: "lessons" },
  coursesCompleted: { title: "Courses completed" },
  enrollments: { title: "Course enrollments" },
  payingMembers: { title: "Paying members" },
  revenuePerPayingMember: { title: "Revenue / paying member", money: true },
  tasksSubmitted: { title: "Tasks submitted" },
  ticketsCreated: { title: "Support tickets", invert: true },
};

const ORDER = ["revenue", "newMembers", "activeMembers", "lessonsCompleted", "payingMembers", "revenuePerPayingMember", "coursesCompleted", "enrollments", "avgDailyActive", "tasksSubmitted", "ticketsCreated"];

const tooltipStyle = { background: "#141414", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 };

/**
 * Executive overview: KPIs with change vs the previous equal period, trend
 * lines, stickiness and weekly-report compliance. `compact` = Dashboard
 * version (fewer cards, link to Insights).
 */
export function ExecutiveOverview({ compact = false, range: controlled, onRangeChange }: {
  compact?: boolean; range?: InsightsRange; onRangeChange?: (r: InsightsRange) => void;
}) {
  const [own, setOwn] = useState<InsightsRange>({ range: "30d" });
  const range = controlled ?? own;
  const setRange = onRangeChange ?? setOwn;
  const { data, isLoading, isError } = useInsightsOverview(range);
  const [metric, setMetric] = useState<"revenue" | "activeMembers" | "newMembers" | "lessons">("revenue");

  const kpis: any[] = data?.kpis ?? [];
  const byKey = Object.fromEntries(kpis.map((k) => [k.key, k]));
  const keys = compact ? ORDER.slice(0, 4) : ORDER;
  const series = data?.series ?? [];
  const compliance: any[] = data?.weeklyReportCompliance ?? [];
  const lastFull = compliance.length >= 2 ? compliance[compliance.length - 2] : null;
  const current = compliance[compliance.length - 1];

  return (
    <Section
      title={compact ? "Business at a glance" : "Executive overview"}
      subtitle={data?.range ? `${fmtDay(data.range.from)} – ${fmtDay(data.range.to)} vs ${fmtDay(data.range.prevFrom)} – ${fmtDay(data.range.prevTo)} (IST)` : undefined}
      actions={
        <>
          <RangePicker value={range} onChange={setRange} />
          {compact && (
            <Link href="/insights" className="text-[10px] font-bold text-[#888] hover:text-[#e02020] font-rajdhani uppercase tracking-widest">
              All insights →
            </Link>
          )}
        </>
      }
    >
      {isLoading && !data ? <Loading /> : isError ? <ErrorNote /> : (
        <div className="space-y-5">
          <div className={`grid gap-3 grid-cols-1 sm:grid-cols-2 ${compact ? "lg:grid-cols-4" : "lg:grid-cols-4 xl:grid-cols-6"}`}>
            {keys.map((k) => {
              const meta = KPI_LABELS[k];
              const kpi = byKey[k];
              if (!meta || !kpi) return null;
              return (
                <KpiCard
                  key={k}
                  title={meta.title}
                  value={meta.money ? fmtInr(kpi.value) : fmtNum(kpi.value)}
                  change={kpi.change}
                  invert={meta.invert}
                  sub={`prev ${meta.money ? fmtInr(kpi.previous) : fmtNum(kpi.previous)}`}
                  spark={meta.spark ? series : undefined}
                  sparkKey={meta.spark}
                />
              );
            })}
            {!compact && (
              <KpiCard
                title="Stickiness (DAU / MAU)"
                value={fmtPct(data?.stickiness?.percent)}
                sub={`${fmtNum(data?.stickiness?.avgDailyActive)} daily of ${fmtNum(data?.stickiness?.mau)} monthly active`}
              />
            )}
          </div>

          {!compact && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className={labelCls}>Trend</p>
                  <div className="flex gap-1">
                    {([["revenue", "Revenue"], ["activeMembers", "Active"], ["newMembers", "New members"], ["lessons", "Lessons"]] as const).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => setMetric(k)}
                        className={`px-2.5 h-7 rounded-md text-[11px] font-bold ${metric === k ? "bg-[#2a2a2a] text-white" : "text-[#888] hover:text-white"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="#222" vertical={false} />
                      <XAxis dataKey="bucket" tickFormatter={fmtDay} tick={{ fill: "#777", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#2a2a2a" }} minTickGap={24} />
                      <YAxis tick={{ fill: "#777", fontSize: 10 }} tickLine={false} axisLine={false} width={56}
                        tickFormatter={(v) => (metric === "revenue" ? fmtInrShort(v) : fmtNum(v))} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => fmtDay(String(v))}
                        formatter={(v: any) => [metric === "revenue" ? fmtInr(v) : fmtNum(v), metric === "lessons" ? "Lessons" : metric === "revenue" ? "Revenue" : metric === "newMembers" ? "New members" : "Active members"]} />
                      <Line type="monotone" dataKey={metric} stroke="#dc2626" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {data?.range?.bucket === "week" && <Note>Long ranges are shown in 7-day buckets.</Note>}
                {data?.trackingSince && <Note>Active-member counts start on {fmtDay(data.trackingSince)}, when activity tracking began.</Note>}
              </div>

              <div className="min-w-0">
                <p className={`${labelCls} mb-2`}>Weekly report compliance</p>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="font-rajdhani text-2xl font-bold text-[#f0f0f0]">{fmtPct(lastFull?.percent)}</span>
                  <span className="text-[11px] text-[#888]">last week ({fmtNum(lastFull?.submitted)} of {fmtNum(lastFull?.required)})</span>
                </div>
                <p className="text-[11px] text-[#888] mb-2">This week so far: {fmtPct(current?.percent)} ({fmtNum(current?.submitted)} of {fmtNum(current?.required)})</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compliance} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid stroke="#222" vertical={false} />
                      <XAxis dataKey="weekStart" tickFormatter={fmtDay} tick={{ fill: "#777", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#2a2a2a" }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "#777", fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Week of ${fmtDay(String(v))}`}
                        formatter={(v: any, _n, p: any) => [`${v ?? "—"}% (${p?.payload?.submitted}/${p?.payload?.required})`, "Submitted"]} />
                      <RBar dataKey="percent" fill="#dc2626" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
          <Note>Revenue = completed course payments + paid coin orders + approved credit purchases. Changes compare with the previous period of the same length.</Note>
        </div>
      )}
    </Section>
  );
}

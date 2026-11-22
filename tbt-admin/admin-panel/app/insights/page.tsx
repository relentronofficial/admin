"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Search, Send, X } from "lucide-react";
import {
  Area, AreaChart, Bar as RBar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ExecutiveOverview } from "@/components/insights/ExecutiveOverview";
import {
  Bar, ChangeBadge, CsvButton, DataTable, downloadCsv, Empty, ErrorNote, KpiCard, Loading, Note, RangePicker, Section,
  fmtDate, fmtDay, fmtInr, fmtInrShort, fmtNum, fmtPct, labelCls, type Column,
} from "@/components/insights/ui";
import {
  useInsightsCohorts, useInsightsCourseLessons, useInsightsCourses, useInsightsDigestPreview, useInsightsFunnelStuck,
  useInsightsFunnels, useInsightsMentorship, useInsightsRevenue, useInsightsRisk, useInsightsSupport, useInsightsUsage,
  useSendInsightsDigest, type InsightsRange,
} from "@/lib/hooks/useInsights";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "funnels", label: "Funnels" },
  { id: "retention", label: "Retention" },
  { id: "courses", label: "Courses" },
  { id: "mentorship", label: "Mentorship" },
  { id: "support", label: "Support" },
  { id: "revenue", label: "Revenue" },
  { id: "usage", label: "Usage" },
  { id: "risk", label: "At-risk" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const tooltipStyle = { background: "#141414", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 };
const axis = { tick: { fill: "#777", fontSize: 10 }, tickLine: false } as const;
const SERIES_COLORS = ["#dc2626", "#3b82f6", "#22c55e"];
const memberName = (r: any) => `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "Member";
const MemberLink = ({ id, name }: { id: string; name: string }) => (
  <Link href={`/members/${id}`} className="text-[#f0f0f0] hover:text-[#e02020] font-medium" onClick={(e) => e.stopPropagation()}>{name}</Link>
);

export default function InsightsPage() {
  const [tab, setTab] = useState<TabId>("overview");
  const [range, setRange] = useState<InsightsRange>({ range: "30d" });

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((x) => x.id === t)) setTab(t as TabId);
  }, []);

  const pick = (id: TabId) => {
    setTab(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url.toString());
  };

  const showRange = tab !== "retention" && tab !== "risk" && tab !== "overview";

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-2.5 items-start">
            <div className="w-0.5 bg-[#e02020] rounded-sm min-h-[40px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0]">Insights</h1>
              <p className="text-[12px] text-[#888] font-medium uppercase tracking-wider font-rajdhani">
                Growth, revenue, learning, mentorship, support and churn risk — all times IST.
              </p>
            </div>
          </div>
          {showRange && <RangePicker value={range} onChange={setRange} />}
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-[#2a2a2a] -mx-1 px-1">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => pick(t.id)}
              className={`px-3.5 h-9 text-[12px] font-bold uppercase tracking-wider font-rajdhani whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id ? "border-[#dc2626] text-white" : "border-transparent text-[#888] hover:text-white"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <ExecutiveOverview range={range} onRangeChange={setRange} />}
        {tab === "funnels" && <FunnelsTab range={range} />}
        {tab === "retention" && <RetentionTab />}
        {tab === "courses" && <CoursesTab range={range} />}
        {tab === "mentorship" && <MentorshipTab range={range} />}
        {tab === "support" && <SupportTab range={range} />}
        {tab === "revenue" && <RevenueTab range={range} />}
        {tab === "usage" && <UsageTab range={range} />}
        {tab === "risk" && <RiskTab />}
      </div>
    </DashboardLayout>
  );
}

// ── Funnels ──────────────────────────────────────────────────────────────────

const stuckColumns: Column<any>[] = [
  { key: "name", label: "Member", render: (r) => <MemberLink id={r.id} name={memberName(r)} />, csv: memberName },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "plan", label: "Plan" },
  { key: "verificationStatus", label: "Verification" },
  { key: "joinedAt", label: "Joined", render: (r) => fmtDate(r.joinedAt), csv: (r) => fmtDate(r.joinedAt) },
  { key: "lastActiveAt", label: "Last active", render: (r) => fmtDate(r.lastActiveAt), csv: (r) => fmtDate(r.lastActiveAt) },
];

function FunnelBlock({ title, subtitle, kind, funnel, range }: { title: string; subtitle?: string; kind: "onboarding" | "purchase"; funnel: any; range: InsightsRange }) {
  const [step, setStep] = useState<string | null>(null);
  const stuck = useInsightsFunnelStuck(range, kind, step);
  const steps: any[] = funnel?.steps ?? [];
  const stepIdx = steps.findIndex((s) => s.key === step);
  const rows: any[] = stuck.data ?? [];
  return (
    <Section title={title} subtitle={subtitle}>
      {!steps.length || steps[0].count === 0 ? <Empty text="No members entered this funnel in this period." /> : (
        <div className="space-y-4">
          <div className="space-y-2.5">
            {steps.map((s, i) => (
              <button key={s.key} type="button" disabled={i === 0}
                onClick={() => setStep(step === s.key ? null : s.key)}
                className={`w-full text-left rounded-lg p-3 border transition-colors ${step === s.key ? "border-[#dc2626] bg-[#dc2626]/5" : "border-[#2a2a2a] hover:border-[#3a3a3a]"} disabled:cursor-default`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
                  <span className="text-[13px] font-semibold text-[#f0f0f0]">{i + 1}. {s.label}</span>
                  <span className="text-[12px] text-[#a0a0a0] tabular-nums">
                    <b className="text-[#f0f0f0]">{fmtNum(s.count)}</b> · {fmtPct(s.ofStart)} of start
                    {i > 0 && <> · {fmtPct(s.ofPrevious)} of previous{s.dropped > 0 && <span className="text-red-400"> · {fmtNum(s.dropped)} stuck</span>}</>}
                  </span>
                </div>
                <Bar percent={s.ofStart} />
              </button>
            ))}
          </div>
          {kind === "onboarding" && funnel?.medianDaysToApproval != null && (
            <Note>Median time from sign-up to approval: {funnel.medianDaysToApproval} days.</Note>
          )}
          {funnel?.note && <Note>{funnel.note}</Note>}
          {kind === "purchase" && funnel?.pageTrackingSince && <Note>Course-page views are counted from {fmtDay(funnel.pageTrackingSince)}.</Note>}
          {kind === "purchase" && !funnel?.pageTrackingSince && <Note>Course-page views start counting once the updated web app is live.</Note>}
          {step && (
            <div className="border-t border-[#2a2a2a] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className={labelCls}>Reached “{steps[stepIdx - 1]?.label}” but not “{steps[stepIdx]?.label}”</p>
                <div className="flex items-center gap-2">
                  <CsvButton filename={`funnel-${kind}-${step}`} columns={stuckColumns} rows={rows} />
                  <button type="button" onClick={() => setStep(null)} className="text-[#888] hover:text-white" aria-label="Close list"><X size={16} /></button>
                </div>
              </div>
              {stuck.isLoading ? <Loading /> : stuck.isError ? <ErrorNote /> : (
                <DataTable columns={stuckColumns} rows={rows} empty="Nobody is stuck at this step." maxHeight={420} />
              )}
              {rows.length >= 200 && <Note>Showing the first 200 members.</Note>}
            </div>
          )}
          {!step && <Note>Click a step to see the members who stopped before it.</Note>}
        </div>
      )}
    </Section>
  );
}

function FunnelsTab({ range }: { range: InsightsRange }) {
  const { data, isLoading, isError } = useInsightsFunnels(range);
  if (isLoading && !data) return <Loading />;
  if (isError) return <ErrorNote />;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <FunnelBlock title="Onboarding funnel" subtitle="Sign-up → approval → first lesson" kind="onboarding" funnel={data?.onboarding} range={range} />
      <FunnelBlock title="Purchase funnel" subtitle="Course page → checkout → paid → started → completed" kind="purchase" funnel={data?.purchase} range={range} />
    </div>
  );
}

// ── Retention ────────────────────────────────────────────────────────────────

function cellColor(v: number | null) {
  if (v == null) return "transparent";
  return `rgba(220, 38, 38, ${0.08 + Math.min(1, v / 100) * 0.72})`;
}

function RetentionTab() {
  const [months, setMonths] = useState(6);
  const { data, isLoading, isError } = useInsightsCohorts(months);
  const rows: any[] = data?.rows ?? [];
  const weeks: number = data?.weeks ?? 12;
  const columns: Column<any>[] = [
    { key: "cohort", label: "Cohort" },
    { key: "size", label: "Members" },
    ...Array.from({ length: weeks + 1 }, (_, k) => ({ key: `w${k}`, label: `Week ${k}`, csv: (r: any) => r.weeks[k] ?? "" })),
  ];
  return (
    <Section title="Cohort retention" subtitle="Share of each sign-up month active in week N after joining"
      actions={
        <>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}
            className="h-8 bg-[#1a1a1a] border border-[#333] rounded-lg px-2 text-[12px] text-white outline-none focus:border-[#dc2626]">
            {[3, 6, 9, 12].map((m) => <option key={m} value={m}>Last {m} months</option>)}
          </select>
          <CsvButton filename="cohort-retention" columns={columns} rows={rows} />
        </>
      }>
      {isLoading && !data ? <Loading /> : isError ? <ErrorNote /> : !rows.length ? <Empty text="No sign-ups in this period." /> : (
        <div className="space-y-3">
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="text-[12px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className={`${labelCls} text-left pr-3`}>Cohort</th>
                  <th className={`${labelCls} text-right pr-3`}>Members</th>
                  {Array.from({ length: weeks + 1 }, (_, k) => <th key={k} className={`${labelCls} w-12 text-center`}>W{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.cohort}>
                    <td className="pr-3 text-[#d0d0d0] whitespace-nowrap">{new Date(`${r.cohort}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })}</td>
                    <td className="pr-3 text-right text-[#a0a0a0] tabular-nums">{fmtNum(r.size)}</td>
                    {r.weeks.map((v: number | null, k: number) => (
                      <td key={k} title={v == null ? "Not measurable yet" : `${v}% active in week ${k}`}
                        className="w-12 h-8 text-center rounded tabular-nums text-[11px] font-semibold"
                        style={{ background: cellColor(v), color: v == null ? "#555" : "#fff" }}>
                        {v == null ? "–" : `${Math.round(v)}%`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>Week 0 is the sign-up week. “–” means the week has not happened for every member yet, or falls before activity tracking began{data?.trackingSince ? ` (${fmtDay(data.trackingSince)})` : ""}.</Note>
        </div>
      )}
    </Section>
  );
}

// ── Courses ──────────────────────────────────────────────────────────────────

const courseColumns: Column<any>[] = [
  { key: "title", label: "Course", render: (r) => <span className="text-[#f0f0f0] font-medium">{r.title}{!r.isPublished && <span className="ml-1.5 text-[10px] text-[#777]">(unpublished)</span>}</span> },
  { key: "module", label: "Module", render: (r) => r.module ?? "—" },
  { key: "lessons", label: "Lessons", align: "right" },
  { key: "enrolled", label: "Enrolled", align: "right", render: (r) => fmtNum(r.enrolled) },
  { key: "enrolledInRange", label: "New in period", align: "right", render: (r) => fmtNum(r.enrolledInRange) },
  { key: "activeLearners", label: "Active learners", align: "right", render: (r) => fmtNum(r.activeLearners) },
  { key: "completionRate", label: "Completion", align: "right", render: (r) => fmtPct(r.completionRate) },
  { key: "medianDaysToComplete", label: "Median days", align: "right", render: (r) => r.medianDaysToComplete ?? "—" },
  { key: "avgRating", label: "Rating /10", align: "right", render: (r) => (r.avgRating == null ? "—" : `${r.avgRating} (${r.ratings})`) },
  { key: "revenueInRange", label: "Revenue (period)", align: "right", render: (r) => fmtInr(r.revenueInRange) },
  { key: "revenueAll", label: "Revenue (all time)", align: "right", render: (r) => fmtInr(r.revenueAll) },
];

const lessonColumns: Column<any>[] = [
  { key: "position", label: "#", align: "right" },
  { key: "title", label: "Lesson" },
  { key: "started", label: "Started", align: "right" },
  { key: "completed", label: "Completed", align: "right" },
  { key: "completionOfStarted", label: "Finish rate", align: "right", render: (r) => fmtPct(r.completionOfStarted) },
  { key: "dropFromPrevious", label: "Drop vs prev", align: "right",
    render: (r) => (r.dropFromPrevious == null ? "—" : <span className={r.dropFromPrevious >= 20 ? "text-red-400 font-bold" : ""}>{r.dropFromPrevious}%</span>) },
  { key: "avgWatchedPercent", label: "Avg watched", align: "right", render: (r) => fmtPct(r.avgWatchedPercent) },
  { key: "avgRating", label: "Rating /10", align: "right",
    render: (r) => (r.avgRating == null ? "—" : <span className={r.avgRating <= 5 ? "text-red-400 font-bold" : ""}>{r.avgRating} ({r.ratings})</span>) },
];

function CoursesTab({ range }: { range: InsightsRange }) {
  const { data, isLoading, isError } = useInsightsCourses(range);
  const [open, setOpen] = useState<string | null>(null);
  const lessons = useInsightsCourseLessons(open);
  const rows: any[] = data ?? [];
  const lessonRows: any[] = lessons.data?.lessons ?? [];
  const feedback = lessonRows.flatMap((l) => (l.lowRatedFeedback ?? []).map((f: any) => ({ ...f, lesson: l.title })));
  return (
    <div className="space-y-5">
      <Section title="Course performance" subtitle="Click a course for lesson-by-lesson drop-off"
        actions={<CsvButton filename="courses" columns={courseColumns} rows={rows} />}>
        {isLoading && !data ? <Loading /> : isError ? <ErrorNote /> : (
          <DataTable columns={courseColumns} rows={rows} onRowClick={(r) => setOpen(r.id)} empty="No courses yet." />
        )}
      </Section>
      {open && (
        <Section title={lessons.data?.course?.title ?? "Lessons"} subtitle="All-time lesson progress"
          actions={
            <>
              <CsvButton filename={`lessons-${open}`} columns={lessonColumns} rows={lessonRows} />
              <button type="button" onClick={() => setOpen(null)} className="text-[#888] hover:text-white" aria-label="Close lessons"><X size={16} /></button>
            </>
          }>
          {lessons.isLoading ? <Loading /> : lessons.isError ? <ErrorNote /> : (
            <div className="space-y-5">
              <DataTable columns={lessonColumns} rows={lessonRows} empty="This course has no visible lessons." />
              <Note>“Drop vs prev” = fewer completions than the lesson before; 20%+ is highlighted. Ratings of 5 or below are highlighted.</Note>
              <div>
                <p className={`${labelCls} mb-2`}>Recent low-rated feedback (4/10 or below)</p>
                {!feedback.length ? <Empty text="No low-rated written feedback." /> : (
                  <ul className="space-y-2">
                    {feedback.map((f, i) => (
                      <li key={i} className="rounded-lg border border-[#2a2a2a] p-3">
                        <div className="flex flex-wrap justify-between gap-2 text-[11px] text-[#888] mb-1">
                          <span>{f.lesson}</span><span>{f.rating}/10 · {fmtDate(f.at)}</span>
                        </div>
                        <p className="text-[13px] text-[#d0d0d0] whitespace-pre-wrap">{f.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

// ── Mentorship ───────────────────────────────────────────────────────────────

const batchColumns: Column<any>[] = [
  { key: "batch", label: "Batch" },
  { key: "members", label: "Reporting", align: "right" },
  { key: "revenue", label: "Revenue", align: "right", render: (r) => fmtInr(r.revenue) },
  { key: "revenuePrev", label: "Previous", align: "right", render: (r) => fmtInr(r.revenuePrev) },
  { key: "change", label: "Change", align: "right", render: (r) => <ChangeBadge change={r.change} />, csv: (r) => r.change ?? "" },
];
const improverColumns: Column<any>[] = [
  { key: "name", label: "Member", render: (r) => <MemberLink id={r.id} name={r.name} /> },
  { key: "batch", label: "Batch", render: (r) => r.batch ?? "—" },
  { key: "avgWeeklyBefore", label: "Avg / week before", align: "right", render: (r) => fmtInr(r.avgWeeklyBefore) },
  { key: "avgWeeklyNow", label: "Avg / week now", align: "right", render: (r) => fmtInr(r.avgWeeklyNow) },
  { key: "gain", label: "Gain", align: "right", render: (r) => <span className="text-green-400 font-bold">{fmtInr(r.gain)}</span> },
];

function MentorshipTab({ range }: { range: InsightsRange }) {
  const { data, isLoading, isError } = useInsightsMentorship(range);
  if (isLoading && !data) return <Loading />;
  if (isError) return <ErrorNote />;
  const s = data?.summary ?? {};
  const weekly: any[] = data?.weekly ?? [];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Member-reported revenue" value={fmtInr(s.revenue)} change={s.change} sub={`prev ${fmtInr(s.revenuePrev)}`} />
        <KpiCard title="Members reporting" value={fmtNum(s.reportingMembers)} sub={`prev ${fmtNum(s.reportingMembersPrev)}`} />
        <KpiCard title="Avg per reporting member" value={fmtInr(s.reportingMembers ? s.revenue / s.reportingMembers : null)} />
        <KpiCard title="Ever reported" value={fmtNum(data?.reportingMembersAllTime)} sub="members, all time" />
      </div>
      <Section title="Weekly member revenue" subtitle="Self-reported in “Your Revenue Stats”, by ISO week">
        {!weekly.length ? <Empty text="No revenue reported in this period." /> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weekly} margin={{ top: 4, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid stroke="#222" vertical={false} />
                <XAxis dataKey="week" tickFormatter={fmtDay} {...axis} axisLine={{ stroke: "#2a2a2a" }} />
                <YAxis yAxisId="l" tickFormatter={(v) => fmtInrShort(v)} {...axis} axisLine={false} width={56} />
                <YAxis yAxisId="r" orientation="right" {...axis} axisLine={false} width={32} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => `Week of ${fmtDay(String(v))}`}
                  formatter={(v: any, name: any) => [name === "Members reporting" ? fmtNum(v) : fmtInr(v), name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <RBar yAxisId="l" dataKey="revenue" name="Revenue" fill="#dc2626" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line yAxisId="r" type="monotone" dataKey="members" name="Members reporting" stroke="#3b82f6" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Section title="By batch" actions={<CsvButton filename="mentorship-by-batch" columns={batchColumns} rows={data?.byBatch ?? []} />}>
          <DataTable columns={batchColumns} rows={data?.byBatch ?? []} empty="No batch revenue in this period." />
        </Section>
        <Section title="Top improvers" subtitle="Average weekly revenue, this period vs the previous one"
          actions={<CsvButton filename="mentorship-top-improvers" columns={improverColumns} rows={data?.topImprovers ?? []} />}>
          <DataTable columns={improverColumns} rows={data?.topImprovers ?? []} empty="Needs revenue reported in both periods." />
        </Section>
      </div>
      <Section title="Members by total reported revenue" subtitle="All time">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(data?.totalRevenueBuckets ?? []).map((b: any) => (
            <div key={b.label} className="rounded-lg border border-[#2a2a2a] p-3">
              <p className={labelCls}>{b.label}</p>
              <p className="font-rajdhani text-2xl font-bold text-[#f0f0f0]">{fmtNum(b.members)}</p>
              <Bar percent={data?.reportingMembersAllTime ? (b.members / data.reportingMembersAllTime) * 100 : 0} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Support ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Sales", tech: "Tech", content: "Content", marketing: "Marketing", one_to_one: "Mentor 1-on-1", group_qa: "Group Q&A",
};
const categoryColumns: Column<any>[] = [
  { key: "category", label: "Category", render: (r) => CATEGORY_LABELS[r.category] ?? r.category, csv: (r) => CATEGORY_LABELS[r.category] ?? r.category },
  { key: "sessions", label: "Slots", align: "right" },
  { key: "sessionsCancelled", label: "Slots cancelled", align: "right" },
  { key: "capacity", label: "Seats", align: "right" },
  { key: "booked", label: "Booked", align: "right" },
  { key: "fillRate", label: "Fill rate", align: "right", render: (r) => fmtPct(r.fillRate) },
  { key: "attended", label: "Attended", align: "right" },
  { key: "noShow", label: "No-show", align: "right" },
  { key: "noShowRate", label: "No-show rate", align: "right", render: (r) => fmtPct(r.noShowRate) },
  { key: "cancelled", label: "Member cancels", align: "right" },
];
const hostColumns: Column<any>[] = [
  { key: "host", label: "Host" },
  { key: "sessions", label: "Slots", align: "right" },
  { key: "scheduledHours", label: "Hours", align: "right" },
  { key: "booked", label: "Booked", align: "right" },
  { key: "attended", label: "Attended", align: "right" },
  { key: "noShow", label: "No-show", align: "right" },
];
const planColumns: Column<any>[] = [
  { key: "plan", label: "Plan" },
  { key: "type", label: "Support type" },
  { key: "used", label: "Used", align: "right" },
  { key: "members", label: "Members", align: "right" },
];

function SupportTab({ range }: { range: InsightsRange }) {
  const { data, isLoading, isError } = useInsightsSupport(range);
  if (isLoading && !data) return <Loading />;
  if (isError) return <ErrorNote />;
  const t = data?.tickets ?? {};
  const hours = (v: number | null | undefined) => (v == null ? "—" : v < 48 ? `${v} h` : `${Math.round((v / 24) * 10) / 10} days`);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <KpiCard title="Tickets created" value={fmtNum(t.created)} />
        <KpiCard title="Tickets resolved" value={fmtNum(t.resolved)} />
        <KpiCard title="Open now" value={fmtNum(t.open)} sub={`${fmtNum(t.openHighPriority)} high / urgent`} />
        <KpiCard title="Overdue now" value={<span className={t.overdue ? "text-red-400" : ""}>{fmtNum(t.overdue)}</span>} sub="past resolve deadline" />
        <KpiCard title="Median first reply" value={hours(t.medianFirstResponseHours)} />
        <KpiCard title="Median resolution" value={hours(t.medianResolutionHours)} />
      </div>
      <Section title="Support calls by category" subtitle="Slots starting in this period"
        actions={<CsvButton filename="support-calls-by-category" columns={categoryColumns} rows={data?.calls?.byCategory ?? []} />}>
        <DataTable columns={categoryColumns} rows={data?.calls?.byCategory ?? []} empty="No support-call slots in this period." />
      </Section>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Section title="Load by host" actions={<CsvButton filename="support-calls-by-host" columns={hostColumns} rows={data?.calls?.byHost ?? []} />}>
          <DataTable columns={hostColumns} rows={data?.calls?.byHost ?? []} empty="No hosted slots in this period." />
        </Section>
        <Section title="Support used by plan" subtitle="Calls counted against plan entitlements"
          actions={<CsvButton filename="support-usage-by-plan" columns={planColumns} rows={data?.usageByPlan ?? []} />}>
          <DataTable columns={planColumns} rows={data?.usageByPlan ?? []} empty="No support usage recorded in this period." />
        </Section>
      </div>
    </div>
  );
}

// ── Revenue ──────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = { courses: "Course payments", coins: "TBT coin orders", credits: "Support credits" };
const methodColumns: Column<any>[] = [
  { key: "method", label: "Method" },
  { key: "count", label: "Payments", align: "right" },
  { key: "amount", label: "Amount", align: "right", render: (r) => fmtInr(r.amount) },
];
const courseRevColumns: Column<any>[] = [
  { key: "title", label: "Course" },
  { key: "count", label: "Payments", align: "right" },
  { key: "amount", label: "Amount", align: "right", render: (r) => fmtInr(r.amount) },
];
const expiringColumns: Column<any>[] = [
  { key: "name", label: "Member", render: (r) => <MemberLink id={r.memberId} name={r.name || "Member"} /> },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "course", label: "Course" },
  { key: "expiresAt", label: "Access ends", render: (r) => fmtDate(r.expiresAt), csv: (r) => fmtDate(r.expiresAt) },
  { key: "lastActiveAt", label: "Last active", render: (r) => fmtDate(r.lastActiveAt), csv: (r) => fmtDate(r.lastActiveAt) },
  { key: "paidAmount", label: "Paid", align: "right", render: (r) => fmtInr(r.paidAmount) },
];

function RevenueTab({ range }: { range: InsightsRange }) {
  const { data, isLoading, isError } = useInsightsRevenue(range);
  if (isLoading && !data) return <Loading />;
  if (isError) return <ErrorNote />;
  const b = data?.buyers ?? {};
  const f = data?.failed ?? {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(data?.bySource ?? []).map((s: any) => (
          <KpiCard key={s.source} title={SOURCE_LABELS[s.source] ?? s.source} value={fmtInr(s.revenue)} change={s.change}
            sub={`${fmtNum(s.count)} payments · prev ${fmtInr(s.revenuePrev)}`} />
        ))}
      </div>
      <Section title="Revenue by source">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.series ?? []} margin={{ top: 4, right: 8, left: -4, bottom: 0 }}>
              <CartesianGrid stroke="#222" vertical={false} />
              <XAxis dataKey="bucket" tickFormatter={fmtDay} {...axis} axisLine={{ stroke: "#2a2a2a" }} minTickGap={24} />
              <YAxis tickFormatter={(v) => fmtInrShort(v)} {...axis} axisLine={false} width={56} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => fmtDay(String(v))} formatter={(v: any, name: any) => [fmtInr(v), name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {["courses", "coins", "credits"].map((k, i) => (
                <Area key={k} type="monotone" dataKey={k} name={SOURCE_LABELS[k]} stackId="1" stroke={SERIES_COLORS[i]} fill={SERIES_COLORS[i]} fillOpacity={0.25} isAnimationActive={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard title="Buyers this period" value={fmtNum(b.inRange)} sub={`${fmtPct(b.returningPercent)} bought before`} />
        <KpiCard title="Repeat buyers" value={fmtPct(b.repeatPercentAllTime)} sub={`${fmtNum(b.repeatAllTime)} of ${fmtNum(b.buyersAllTime)} buyers, all time`} />
        <KpiCard title="Refunds" value={fmtInr(data?.refunds?.amount)} sub={`${fmtNum(data?.refunds?.count)} · ${fmtPct(data?.refunds?.ratePercent)} of gross`} />
        <KpiCard title="Failed payments" value={fmtNum((f.coursePayments ?? 0) + (f.coinOrders ?? 0))}
          sub={`${fmtInr((f.coursePaymentsAmount ?? 0) + (f.coinOrdersAmount ?? 0))} not collected`} />
        <KpiCard title="Pending payments" value={fmtNum(data?.pending?.count)}
          sub={<>{fmtInr(data?.pending?.amount)} · {fmtNum(data?.pending?.olderThanADay)} older than a day</>} />
        <KpiCard title="Access ending ≤ 30 days" value={fmtNum(data?.expiringSoon?.length)} sub="renewal opportunities" />
        <KpiCard title="Access ended, last 30 days" value={fmtNum(data?.expiredLast30Days)} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Section title="Course payments by method" actions={<CsvButton filename="revenue-by-method" columns={methodColumns} rows={data?.byMethod ?? []} />}>
          <DataTable columns={methodColumns} rows={data?.byMethod ?? []} />
        </Section>
        <Section title="Top courses by revenue" subtitle="Bundle purchases count on the course that was bought"
          actions={<CsvButton filename="revenue-by-course" columns={courseRevColumns} rows={data?.byCourse ?? []} />}>
          <DataTable columns={courseRevColumns} rows={data?.byCourse ?? []} />
        </Section>
      </div>
      <Section title="Course access ending in the next 30 days" subtitle="Time-limited access — contact these members to renew"
        actions={<CsvButton filename="access-expiring" columns={expiringColumns} rows={data?.expiringSoon ?? []} />}>
        <DataTable columns={expiringColumns} rows={data?.expiringSoon ?? []} empty="No access ends in the next 30 days." maxHeight={480} />
      </Section>
    </div>
  );
}

// ── Usage ────────────────────────────────────────────────────────────────────

const sectionColumns: Column<any>[] = [
  { key: "label", label: "Section" },
  { key: "members", label: "Members", align: "right", render: (r) => fmtNum(r.members) },
  { key: "membersPrev", label: "Previous", align: "right", render: (r) => fmtNum(r.membersPrev) },
  { key: "change", label: "Change", align: "right", render: (r) => <ChangeBadge change={r.change} />, csv: (r) => r.change ?? "" },
  { key: "minutes", label: "Active minutes", align: "right", render: (r) => fmtNum(r.minutes) },
  { key: "perMember", label: "Min / member", align: "right",
    render: (r) => (r.members ? Math.round((r.minutes / r.members) * 10) / 10 : "—"), csv: (r) => (r.members ? Math.round((r.minutes / r.members) * 10) / 10 : "") },
];
const usageCourseColumns: Column<any>[] = [
  { key: "title", label: "Course" },
  { key: "pageViewers", label: "Page viewers", align: "right" },
  { key: "pageMinutes", label: "Page minutes", align: "right" },
  { key: "learners", label: "Learners", align: "right" },
  { key: "learningMinutes", label: "Learning minutes", align: "right" },
];

function UsageTab({ range }: { range: InsightsRange }) {
  const { data, isLoading, isError } = useInsightsUsage(range);
  if (isLoading && !data) return <Loading />;
  if (isError) return <ErrorNote />;
  const sections: any[] = data?.sections ?? [];
  const max = Math.max(1, ...sections.map((s) => s.members));
  return (
    <div className="space-y-5">
      <Note>
        {data?.note}{" "}
        {data?.trackingSince ? `Counted from ${fmtDay(data.trackingSince)}.` : "Counting starts once the updated web app is live."}
      </Note>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Section title="Most used sections" subtitle="Members active per section">
          {!sections.length ? <Empty text="No usage recorded in this period." /> : (
            <div className="space-y-2.5">
              {sections.slice(0, 12).map((s) => (
                <div key={s.section}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-[#d0d0d0]">{s.label}</span>
                    <span className="text-[#a0a0a0] tabular-nums">{fmtNum(s.members)}</span>
                  </div>
                  <Bar percent={(s.members / max) * 100} />
                </div>
              ))}
            </div>
          )}
        </Section>
        <div className="xl:col-span-2 min-w-0">
          <Section title="All sections" actions={<CsvButton filename="usage-sections" columns={sectionColumns} rows={sections} />}>
            <DataTable columns={sectionColumns} rows={sections} empty="No usage recorded in this period." />
          </Section>
        </div>
      </div>
      <Section title="Courses — page views and learning time" actions={<CsvButton filename="usage-courses" columns={usageCourseColumns} rows={data?.courses ?? []} />}>
        <DataTable columns={usageCourseColumns} rows={data?.courses ?? []} empty="No course page or lesson usage in this period." />
      </Section>
    </div>
  );
}

// ── At-risk ──────────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<string, string> = {
  high: "bg-red-500/15 text-red-400 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-green-500/15 text-green-400 border-green-500/30",
};
const riskColumns: Column<any>[] = [
  { key: "name", label: "Member", render: (r) => <MemberLink id={r.id} name={r.name} /> },
  { key: "score", label: "Score", align: "right",
    render: (r) => <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold ${LEVEL_STYLE[r.level]}`}>{r.score}</span> },
  { key: "level", label: "Level" },
  { key: "reasons", label: "Why", render: (r) => <span className="text-[#a0a0a0]">{r.reasons.join(" · ") || "—"}</span>, csv: (r) => r.reasons.join("; ") },
  { key: "batch", label: "Batch", render: (r) => r.batch ?? "—" },
  { key: "plan", label: "Plan" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "lastActiveAt", label: "Last active", render: (r) => fmtDate(r.lastActiveAt), csv: (r) => fmtDate(r.lastActiveAt) },
];

function RiskTab() {
  const [level, setLevel] = useState<"atRisk" | "high" | "medium" | "low">("atRisk");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;
  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isLoading, isError, isFetching } = useInsightsRisk({ level, search: q || undefined, page, limit });
  const all = useInsightsRisk({ level, search: q || undefined, page: 1, limit: 500 }, false);
  const rows: any[] = data?.data ?? [];
  const meta = data?.meta ?? {};
  const counts = meta.counts ?? {};
  const pages = Math.max(1, Math.ceil((meta.total ?? 0) / limit));
  const [showDigest, setShowDigest] = useState(false);
  const digest = useInsightsDigestPreview(showDigest);
  const send = useSendInsightsDigest();

  const exportAll = async () => {
    const r = await all.refetch();
    const list: any[] = r.data?.data ?? [];
    downloadCsv(`at-risk-${level}`, riskColumns, list);
  };

  const levels = [
    { id: "atRisk", label: "High + medium", count: (counts.high ?? 0) + (counts.medium ?? 0) },
    { id: "high", label: "High", count: counts.high },
    { id: "medium", label: "Medium", count: counts.medium },
    { id: "low", label: "Low", count: counts.low },
  ] as const;

  return (
    <div className="space-y-5">
      <Section title="Members at risk of dropping off"
        subtitle="Score 0–100 from inactivity, falling activity, missed weekly reports, low ratings, stalled courses, ending access and stale tickets. High ≥ 50, medium ≥ 25."
        actions={
          <button type="button" onClick={exportAll} disabled={!meta.total}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#333] bg-[#1a1a1a] text-[11px] font-bold uppercase tracking-wider font-rajdhani text-[#a0a0a0] hover:text-white disabled:opacity-40">
            CSV (up to 500)
          </button>
        }>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {levels.map((l) => (
                <button key={l.id} type="button" onClick={() => { setLevel(l.id); setPage(1); }}
                  className={`h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider font-rajdhani border ${
                    level === l.id ? "bg-[#dc2626] border-[#dc2626] text-white" : "bg-[#1a1a1a] border-[#333] text-[#a0a0a0] hover:text-white"
                  }`}>
                  {l.label} <span className="opacity-70">({fmtNum(l.count ?? 0)})</span>
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone or email"
                className="h-8 w-60 bg-[#1a1a1a] border border-[#333] rounded-lg pl-8 pr-3 text-[12px] text-white outline-none focus:border-[#dc2626]" />
            </div>
          </div>
          {isLoading && !data ? <Loading /> : isError ? <ErrorNote /> : (
            <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
              <DataTable columns={riskColumns} rows={rows} empty="No members match." />
            </div>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 text-[12px] text-[#a0a0a0]">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-7 px-3 rounded border border-[#333] disabled:opacity-40">Prev</button>
              <span>Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="h-7 px-3 rounded border border-[#333] disabled:opacity-40">Next</button>
            </div>
          )}
          <Note>Scores refresh every 5 minutes. Active members only.</Note>
        </div>
      </Section>

      <Section title="Weekly summary" subtitle="Sent automatically every Monday from 09:00 IST to the admin bell (and WhatsApp when an admin number is set)"
        actions={
          <>
            <button type="button" onClick={() => setShowDigest((v) => !v)}
              className="h-8 px-3 rounded-lg border border-[#333] bg-[#1a1a1a] text-[11px] font-bold uppercase tracking-wider font-rajdhani text-[#a0a0a0] hover:text-white">
              {showDigest ? "Hide preview" : "Preview"}
            </button>
            <button type="button" disabled={send.isPending}
              onClick={() => {
                if (!window.confirm("Send last week's summary to all admins now?")) return;
                send.mutate(undefined, {
                  onSuccess: () => toast.success("Weekly summary sent"),
                  onError: () => toast.error("Could not send the summary"),
                });
              }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-wider font-rajdhani disabled:opacity-50">
              <Send size={13} /> {send.isPending ? "Sending…" : "Send now"}
            </button>
          </>
        }>
        {!showDigest ? <Note>Preview shows last week’s summary exactly as it will be sent.</Note>
          : digest.isLoading ? <Loading /> : digest.isError ? <ErrorNote /> : (
            <div className="space-y-3">
              {(digest.data?.alerts ?? []).length > 0 && (
                <ul className="space-y-1">
                  {digest.data.alerts.map((a: string, i: number) => <li key={i} className="text-[13px] text-amber-400">⚠ {a}</li>)}
                </ul>
              )}
              <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-[#d0d0d0] bg-[#141414] border border-[#2a2a2a] rounded-lg p-4 font-sans">{digest.data?.text}</pre>
            </div>
          )}
      </Section>
    </div>
  );
}

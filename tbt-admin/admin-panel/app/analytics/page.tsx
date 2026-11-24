"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Users, Activity, CheckCircle2, TrendingUp, AlertTriangle, Loader2, PlayCircle, Clock,
  FileText, ClipboardCheck, BookOpen, Search, Download, ArrowUp, ArrowDown, X, UserX,
} from "lucide-react";
import {
  useAnalyticsOverview, useAtRiskMembers, useListBatches, useListVodCourses,
  useMemberActivityAnalytics, fetchMemberActivityAnalytics, type MemberActivityAnalyticsParams,
} from "@/lib/hooks/useTbt";
import { formatDistanceToNow, format } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PAGE_SIZE = 25;
const label = "text-[10px] uppercase tracking-widest text-[#888] font-bold font-rajdhani";
const select = "bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-[12px] text-[#f0f0f0] outline-none focus:border-[#dc2626]";

const ACTIVITY_OPTIONS = [
  { value: "any", label: "Any activity" },
  { value: "active_today", label: "Active today" },
  { value: "active_7d", label: "Active in last 7 days" },
  { value: "active_30d", label: "Active in last 30 days" },
  { value: "inactive_7d", label: "Inactive 7+ days" },
  { value: "inactive_30d", label: "Inactive 30+ days" },
  { value: "never", label: "Never active" },
];
const STATUS_OPTIONS = ["active", "pending", "inactive", "paused", "suspended"];
const PLAN_OPTIONS = ["free", "starter", "premium", "vip", "enterprise"];

const fmtMinutes = (m: number) => {
  if (!m) return "0m";
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
};
const fmtAgo = (d?: string | null) => (d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : "Never");

function StatCard({ title, value, sub, icon: Icon, color }: { title: string; value: React.ReactNode; sub?: React.ReactNode; icon: any; color: string }) {
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4 sm:p-5 min-w-0">
      <div className={`mb-2.5 ${color}`}><Icon size={17} /></div>
      <p className={`${label} mb-1`}>{title}</p>
      <p className="font-rajdhani text-2xl font-bold text-[#f0f0f0] truncate">{value ?? "—"}</p>
      {sub && <p className="text-[11px] text-[#777] mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: overviewData, isLoading: overviewLoading, isError: overviewError } = useAnalyticsOverview();
  const o = (overviewData as any)?.data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex gap-2.5 items-start">
          <div className="w-0.5 bg-[#e02020] rounded-sm min-h-[40px]" />
          <div>
            <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0]">Platform Analytics</h1>
            <p className="text-[12px] text-[#888] font-medium uppercase tracking-wider font-rajdhani">
              Member activity, video watching, lessons and weekly reports.
            </p>
          </div>
        </div>

        {overviewLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="bg-[#181818] border border-[#2a2a2a] rounded-xl h-[112px] animate-pulse" />)}
          </div>
        ) : overviewError || !o ? (
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 text-center text-[#888] text-sm font-rajdhani uppercase tracking-widest">Failed to load overview stats.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Members" value={o.totalMembers?.toLocaleString()} sub={`+${o.newMembersLast7d ?? 0} joined this week`} icon={Users} color="text-[#e02020]" />
              <StatCard title="Active Today" value={o.activeToday?.toLocaleString()} sub={`${o.activeMembers7d ?? 0} in last 7 days`} icon={Activity} color="text-green-400" />
              <StatCard title="Active (30d)" value={o.activeMembers30d?.toLocaleString()} sub={`${o.neverActive ?? 0} never active`} icon={TrendingUp} color="text-blue-400" />
              <StatCard title="Avg Engagement" value={`${o.avgHealthScore ?? 0}%`} sub="Active days in last 14 (active members)" icon={TrendingUp} color="text-purple-400" />
              <StatCard title="Video Watch Time" value={`${(o.totalWatchHours ?? 0).toLocaleString()} h`} sub={`${fmtMinutes(o.videoMinutes30d ?? 0)} watched in last 30 days`} icon={PlayCircle} color="text-red-400" />
              <StatCard title="Lessons Completed" value={o.completedEpisodes?.toLocaleString()} sub={`${o.lessonsCompleted30d ?? 0} in last 30 days · ${o.coursesCompleted ?? 0} courses finished`} icon={CheckCircle2} color="text-green-400" />
              <StatCard title="Avg Time / Active Member" value={fmtMinutes(o.avgActiveMinutesPerMember30d ?? 0)} sub={`${fmtMinutes(o.activeMinutes30d ?? 0)} total, last 30 days`} icon={Clock} color="text-yellow-400" />
              <StatCard
                title="Weekly Reports"
                value={`${o.weeklyReports?.submitted ?? 0} / ${o.weeklyReports?.required ?? 0}`}
                sub="Submitted this week / enrolled members"
                icon={FileText}
                color="text-orange-400"
              />
              <StatCard title="Enrollments" value={o.totalEnrollments?.toLocaleString()} sub={`${o.courseEnrollments ?? 0} courses · ${o.workshopEnrollments ?? 0} workshops`} icon={BookOpen} color="text-yellow-400" />
              <StatCard title="Tasks Submitted (30d)" value={o.tasksSubmitted30d?.toLocaleString()} sub={`${o.tasksPendingReview ?? 0} waiting for review`} icon={ClipboardCheck} color="text-blue-400" />
              <StatCard title="Challenges Completed" value={o.completedChallenges?.toLocaleString()} sub="Workshops" icon={CheckCircle2} color="text-orange-400" />
              <StatCard title="Assignments Submitted" value={o.submittedAssignments?.toLocaleString()} sub="Workshops" icon={FileText} color="text-purple-400" />
            </div>
            <DailyActiveChart rows={o.dailyActive ?? []} trackingSince={o.trackingSince} />
          </>
        )}

        <MemberActivityTable />
        <AtRiskSection />
      </div>
    </DashboardLayout>
  );
}

function DailyActiveChart({ rows, trackingSince }: { rows: { date: string; members: number; minutes: number; videoMinutes: number }[]; trackingSince?: string | null }) {
  const data = rows.map((r) => ({ ...r, label: format(new Date(`${r.date}T00:00:00`), "d MMM") }));
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4 sm:p-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h3 className="font-rajdhani text-lg font-semibold tracking-wide uppercase text-[#f0f0f0]">Daily Active Members — last 30 days</h3>
        {trackingSince && <span className="text-[11px] text-[#777]">Minute tracking since {format(new Date(`${trackingSince}T00:00:00`), "d MMM yyyy")}</span>}
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#222" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#777", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#2a2a2a" }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} tick={{ fill: "#777", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#f0f0f0" }}
              formatter={(value: any, name: any, item: any) =>
                name === "members"
                  ? [`${value} members · ${fmtMinutes(item.payload.minutes)} active · ${fmtMinutes(item.payload.videoMinutes)} video`, "Active"]
                  : [value, name]}
            />
            <Bar dataKey="members" fill="#dc2626" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type SortKey = "name" | "last_active" | "active_days" | "active_minutes" | "video_minutes" | "lessons" | "watch_time" | "tasks" | "joined";

function MemberActivityTable() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState("any");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [batchId, setBatchId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [weeklyReport, setWeeklyReport] = useState("any");
  const [rangeDays, setRangeDays] = useState(30);
  const [sort, setSort] = useState<SortKey>("last_active");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data: batchesData } = useListBatches();
  const { data: coursesData } = useListVodCourses({ limit: 200 });
  const batches: any[] = (batchesData as any)?.data ?? [];
  const courses: any[] = (coursesData as any)?.data ?? [];

  const params: MemberActivityAnalyticsParams = useMemo(() => ({
    search: search || undefined,
    activity: activity !== "any" ? activity : undefined,
    status: status || undefined,
    plan: plan || undefined,
    batchId: batchId || undefined,
    courseId: courseId || undefined,
    weeklyReport: weeklyReport !== "any" ? weeklyReport : undefined,
    rangeDays, sort, order, page, limit: PAGE_SIZE,
  }), [search, activity, status, plan, batchId, courseId, weeklyReport, rangeDays, sort, order, page]);

  const { data, isLoading, isError, isFetching } = useMemberActivityAnalytics(params);
  const rows: any[] = (data as any)?.data ?? [];
  const total: number = (data as any)?.meta?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtersOn = !!(search || activity !== "any" || status || plan || batchId || courseId || weeklyReport !== "any");
  const reset = () => {
    setSearchInput(""); setSearch(""); setActivity("any"); setStatus(""); setPlan("");
    setBatchId(""); setCourseId(""); setWeeklyReport("any"); setPage(1);
  };
  const change = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  const toggleSort = (key: SortKey) => {
    if (sort === key) setOrder(order === "desc" ? "asc" : "desc");
    else { setSort(key); setOrder(key === "name" ? "asc" : "desc"); }
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetchMemberActivityAnalytics({ ...params, page: 1, limit: 5000 });
      const list: any[] = res?.data ?? [];
      const header = ["Member ID", "Name", "Email", "Phone", "Status", "Plan", "Batch", "Account manager", "Joined", "Last active",
        `Active days (${rangeDays}d)`, `Active minutes (${rangeDays}d)`, `Video minutes (${rangeDays}d)`,
        `Lessons completed (${rangeDays}d)`, "Lessons completed (all time)", "Watch minutes (all time)",
        "Courses enrolled", `Tasks submitted (${rangeDays}d)`, "Weekly report this week"];
      const cell = (v: unknown) => {
        const s = v == null ? "" : String(v);
        const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
        return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
      };
      const lines = [header, ...list.map((r) => [
        r.memberId, r.name, r.email, r.phone, r.status, r.plan, r.batchName ?? "", r.accountManagerName ?? "",
        r.joinedAt ? format(new Date(r.joinedAt), "yyyy-MM-dd") : "",
        r.lastActiveAt ? format(new Date(r.lastActiveAt), "yyyy-MM-dd HH:mm") : "Never",
        r.activeDays, r.activeMinutes, r.videoMinutes, r.lessonsCompleted, r.lessonsCompletedTotal,
        r.watchMinutesTotal, r.coursesEnrolled, r.tasksSubmitted, r.weeklyReportSubmitted ? "Yes" : "No",
      ])].map((row) => row.map(cell).join(","));
      const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `member-activity-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const Th = ({ k, children, right }: { k?: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-3 ${right ? "text-right" : "text-left"} text-[9px] uppercase tracking-widest text-[#777] font-bold font-rajdhani whitespace-nowrap`}>
      {k ? (
        <button onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 hover:text-white ${sort === k ? "text-[#f0f0f0]" : ""}`}>
          {children}
          {sort === k && (order === "desc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />)}
        </button>
      ) : children}
    </th>
  );

  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
      <div className="px-4 sm:px-6 pt-[18px] pb-4 border-b border-[#2a2a2a] space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Users size={16} className="text-[#e02020]" />
            <h3 className="font-rajdhani text-lg font-semibold tracking-wide uppercase text-[#f0f0f0]">Member Activity</h3>
            <span className="text-[9px] font-bold bg-[#dc2626]/10 text-[#e02020] border border-[#dc2626]/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {total.toLocaleString()} members
            </span>
            {isFetching && !isLoading && <Loader2 size={13} className="animate-spin text-[#777]" />}
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => { setRangeDays(d); setPage(1); }}
                className={`px-3 h-8 rounded text-[10px] font-bold font-rajdhani uppercase tracking-widest ${rangeDays === d ? "bg-[#dc2626] text-white" : "bg-[#1a1a1a] text-[#888] hover:text-white border border-[#2a2a2a]"}`}
              >
                {d} days
              </button>
            ))}
            <button
              onClick={exportCsv}
              disabled={exporting || total === 0}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[10px] font-bold font-rajdhani uppercase tracking-widest text-[#a0a0a0] hover:text-white disabled:opacity-40"
            >
              {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, email, phone, member ID"
              className={`${select} w-full pl-9`}
            />
          </div>
          <select value={activity} onChange={(e) => change(setActivity)(e.target.value)} className={select} aria-label="Activity">
            {ACTIVITY_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <select value={status} onChange={(e) => change(setStatus)(e.target.value)} className={select} aria-label="Status">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select value={plan} onChange={(e) => change(setPlan)(e.target.value)} className={select} aria-label="Plan">
            <option value="">All plans</option>
            {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </select>
          <select value={batchId} onChange={(e) => change(setBatchId)(e.target.value)} className={select} aria-label="Batch">
            <option value="">All batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={courseId} onChange={(e) => change(setCourseId)(e.target.value)} className={select} aria-label="Course">
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select value={weeklyReport} onChange={(e) => change(setWeeklyReport)(e.target.value)} className={select} aria-label="Weekly report">
            <option value="any">Weekly report: any</option>
            <option value="submitted">Submitted this week</option>
            <option value="missing">Missing this week</option>
          </select>
          {filtersOn && (
            <button onClick={reset} className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-[#2a2a2a] text-[11px] text-[#a0a0a0] hover:text-white">
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
        <p className="text-[11px] text-[#606060]">
          Active days, active time, video time, lessons and tasks cover the last {rangeDays} days. Lessons include course lessons and workshop episodes.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-[#777]" /></div>
      ) : isError ? (
        <div className="text-center py-16 text-[#888] text-sm font-rajdhani uppercase tracking-widest">Failed to load member activity.</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-[#888] text-sm">No members match these filters.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px]">
              <thead>
                <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                  <Th k="name">Member</Th>
                  <Th>Account manager</Th>
                  <Th k="last_active">Last active</Th>
                  <Th k="active_days" right>Active days</Th>
                  <Th k="active_minutes" right>Time on app</Th>
                  <Th k="video_minutes" right>Video time</Th>
                  <Th k="lessons" right>Lessons</Th>
                  <Th k="watch_time" right>Total watched</Th>
                  <Th right>Courses</Th>
                  <Th k="tasks" right>Tasks</Th>
                  <Th>Weekly report</Th>
                  <Th k="joined">Joined</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f]">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-3 max-w-[240px]">
                      <Link href={`/members/${r.id}`} className="block hover:text-[#e02020]">
                        <p className="text-[13px] font-bold text-[#f0f0f0] truncate">{r.name || r.email}</p>
                        <p className="text-[11px] text-[#888] truncate">{r.phone} · {r.memberId}</p>
                        <p className="text-[10px] text-[#606060] truncate">
                          {r.status} · {r.plan}{r.batchName ? ` · ${r.batchName}` : ""}
                        </p>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-[12px] max-w-[160px]">
                      <p className={`truncate ${r.accountManagerName ? "text-[#d0d0d0]" : "text-[#606060] italic"}`} title={r.accountManagerName ?? undefined}>
                        {r.accountManagerName ?? "Unassigned"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-[12px] whitespace-nowrap" title={r.lastActiveAt ? format(new Date(r.lastActiveAt), "d MMM yyyy, h:mm a") : undefined}>
                      <span className={r.lastActiveAt ? "text-[#a0a0a0]" : "text-[#606060]"}>{fmtAgo(r.lastActiveAt)}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-[12px] text-[#a0a0a0] font-rajdhani font-bold">{r.activeDays}</td>
                    <td className="px-3 py-3 text-right text-[12px] text-[#a0a0a0] whitespace-nowrap">{fmtMinutes(r.activeMinutes)}</td>
                    <td className="px-3 py-3 text-right text-[12px] text-[#a0a0a0] whitespace-nowrap">{fmtMinutes(r.videoMinutes)}</td>
                    <td className="px-3 py-3 text-right text-[12px] text-[#a0a0a0] whitespace-nowrap">
                      {r.lessonsCompleted} <span className="text-[#606060]">/ {r.lessonsCompletedTotal}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-[12px] text-[#a0a0a0] whitespace-nowrap">{fmtMinutes(r.watchMinutesTotal)}</td>
                    <td className="px-3 py-3 text-right text-[12px] text-[#a0a0a0]">{r.coursesEnrolled}</td>
                    <td className="px-3 py-3 text-right text-[12px] text-[#a0a0a0]">{r.tasksSubmitted}</td>
                    <td className="px-3 py-3 text-[11px] whitespace-nowrap">
                      {r.weeklyReportSubmitted
                        ? <span className="text-green-400 font-bold">Submitted</span>
                        : r.coursesEnrolled > 0 ? <span className="text-orange-400 font-bold">Missing</span> : <span className="text-[#606060]">—</span>}
                    </td>
                    <td className="px-3 py-3 text-[11px] text-[#777] whitespace-nowrap">{r.joinedAt ? format(new Date(r.joinedAt), "d MMM yyyy") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 sm:px-6 py-3 border-t border-[#1f1f1f] flex items-center justify-between gap-3">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-[11px] font-bold font-rajdhani uppercase tracking-widest text-[#888] hover:text-white disabled:opacity-30">← Prev</button>
            <span className="text-[10px] text-[#777]">Page {page} of {pages} · {total.toLocaleString()} members</span>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="text-[11px] font-bold font-rajdhani uppercase tracking-widest text-[#888] hover:text-white disabled:opacity-30">Next →</button>
          </div>
        </>
      )}
    </div>
  );
}

function AtRiskSection() {
  const [inactiveDays, setInactiveDays] = useState(7);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAtRiskMembers({ inactiveDays, completionThreshold: 50, page, limit: 20 });
  const atRisk: any[] = (data as any)?.data || [];
  const total: number = (data as any)?.meta?.total ?? 0;

  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
      <div className="px-4 sm:px-6 pt-[18px] pb-[14px] border-b border-[#2a2a2a] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle size={16} className="text-orange-400" />
          <h3 className="font-rajdhani text-lg font-semibold tracking-wide uppercase text-[#f0f0f0]">At-Risk Members</h3>
          {total > 0 && (
            <span className="text-[9px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">{total} members</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-[#888] font-rajdhani uppercase tracking-widest">Inactive for:</span>
          {[3, 7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => { setInactiveDays(d); setPage(1); }}
              className={`px-3 py-1 rounded text-[10px] font-bold font-rajdhani uppercase tracking-widest ${inactiveDays === d ? "bg-[#dc2626] text-white" : "bg-[#1a1a1a] text-[#888] hover:text-white border border-[#2a2a2a]"}`}
            >
              {d}d+
            </button>
          ))}
        </div>
      </div>
      <p className="px-4 sm:px-6 pt-3 text-[11px] text-[#606060]">
        Active members enrolled in a course or workshop, not seen for {inactiveDays}+ days, and active on fewer than half of the last 14 days.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-[#777]" /></div>
      ) : isError ? (
        <div className="text-center py-16 text-[#888] text-sm font-rajdhani uppercase tracking-widest">Failed to load at-risk members.</div>
      ) : atRisk.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 size={32} className="mx-auto text-green-500 mb-3" />
          <p className="text-[#a0a0a0] font-rajdhani font-bold uppercase tracking-widest text-sm">No at-risk members in this window.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                  {["Member", "Engagement (14d)", "Courses", "Workshops", "Last Active"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-[#777] font-bold font-rajdhani">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f]">
                {atRisk.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <Link href={`/members/${m.id}`} className="hover:text-[#e02020]">
                        <p className="text-[13px] font-bold text-[#f0f0f0]">{m.firstName} {m.lastName}</p>
                        <p className="text-[11px] text-[#888]">{m.phone || m.email}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#111] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${m.healthScore ?? 0}%`, backgroundColor: (m.healthScore ?? 0) >= 30 ? "#eab308" : "#dc2626" }} />
                        </div>
                        <span className="text-[11px] font-bold font-rajdhani text-[#a0a0a0]">{m.healthScore ?? 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-[#888]">{m.courseEnrollments ?? 0}</td>
                    <td className="px-4 py-3.5 text-[12px] text-[#888]">{m.workshopEnrollments ?? 0}</td>
                    <td className="px-4 py-3.5 text-[11px] text-[#777]">
                      {m.lastActiveAt ? fmtAgo(m.lastActiveAt) : <span className="inline-flex items-center gap-1"><UserX size={11} /> Never</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 20 && (
            <div className="px-6 py-3 border-t border-[#1f1f1f] flex items-center justify-between">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-[11px] font-bold font-rajdhani uppercase tracking-widest text-[#888] hover:text-white disabled:opacity-30">← Prev</button>
              <span className="text-[10px] text-[#777]">Page {page} · {total} total</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="text-[11px] font-bold font-rajdhani uppercase tracking-widest text-[#888] hover:text-white disabled:opacity-30">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

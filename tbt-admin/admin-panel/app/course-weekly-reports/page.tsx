"use client";

import { useState } from "react";
import {
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Filter,
  Send,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquareText,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListCourseWeeklyReports,
  useCreateOrSendCourseReport,
  useListCourseWeeklyFeedback,
  useUpdateCourseFeedbackStatus,
  useListVodCourses,
} from "@/lib/hooks/useTbt";
import { useListMembers } from "@/lib/hooks/useMembers";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Status badge ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  sent: { label: "Sent", color: "#22c55e", bg: "rgba(34,197,94,0.12)", Icon: CheckCircle2 },
  failed: { label: "Failed", color: "#dc2626", bg: "rgba(220,38,38,0.12)", Icon: XCircle },
  skipped: { label: "Skipped", color: "#a0a0a0", bg: "rgba(160,160,160,0.12)", Icon: Clock },
  draft: { label: "Draft", color: "#a0a0a0", bg: "rgba(160,160,160,0.12)", Icon: Clock },
  new: { label: "New", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", Icon: Clock },
  reviewed: { label: "Reviewed", color: "#22c55e", bg: "rgba(34,197,94,0.12)", Icon: CheckCircle2 },
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  const cfg = STATUS_CONFIG[status ?? "skipped"] ?? STATUS_CONFIG.skipped;
  const Icon = cfg.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

// ─── Create / send panel ────────────────────────────────────────────────────

function CreateSendPanel() {
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
  const [courseId, setCourseId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [force, setForce] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: memberResults } = useListMembers({ search, limit: 8 });
  const members: any[] = memberResults?.data ?? [];
  const { data: coursesRes } = useListVodCourses({ limit: 200 });
  const courses: any[] = coursesRes?.data ?? [];

  const send = useCreateOrSendCourseReport();
  const canAct = !!selectedMember && !!courseId;

  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest flex items-center gap-2">
        <Send size={15} className="text-[#dc2626]" />
        Create &amp; Send Weekly Report
      </h2>
      <p className="text-xs text-[#888]">
        Sends this week&apos;s progress report to the member over WhatsApp now — the same delivery path the weekly automation uses.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1.5">
            Member
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <input
              value={selectedMember ? selectedMember.name : search}
              onChange={(e) => {
                setSelectedMember(null);
                setSearch(e.target.value);
                setResult(null);
              }}
              placeholder="Search member by name, email, phone…"
              className="pl-9 pr-4 h-10 w-full text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626]"
            />
          </div>
          {!selectedMember && search.length >= 2 && members.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-[#181818] border border-[#2a2a2a] rounded-lg overflow-hidden shadow-lg">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedMember({ id: m.id, name: `${m.firstName} ${m.lastName ?? ""}`.trim() });
                    setSearch("");
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-[#f0f0f0] hover:bg-[#222] transition-colors flex items-center justify-between"
                >
                  <span>{m.firstName} {m.lastName ?? ""}</span>
                  <span className="text-[#888]">{m.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1.5">
            Course
          </label>
          <select
            value={courseId}
            onChange={(e) => { setCourseId(e.target.value); setResult(null); }}
            className="h-10 px-3 w-full text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] outline-none focus:border-[#dc2626] cursor-pointer"
          >
            <option value="">Select a course…</option>
            {courses.map((c: any) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1.5">
          Admin Remarks <span className="text-[#666] normal-case tracking-normal">(optional)</span>
        </label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={2}
          placeholder="A short note included in this week's report…"
          className="w-full text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626] resize-none"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          disabled={!canAct || send.isPending}
          onClick={async () => {
            const res = await send.mutateAsync({
              memberId: selectedMember!.id,
              courseId,
              remarks: remarks.trim() || undefined,
              force,
            });
            setResult(res);
          }}
          className="inline-flex items-center gap-2 px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={13} /> Send Now
        </button>
        <label className="flex items-center gap-1.5 text-[11px] text-[#888] cursor-pointer select-none">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="accent-[#dc2626]" />
          Force (resend even if already sent this week)
        </label>
      </div>

      {result && (
        <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-4 text-xs space-y-2">
          <p className="text-[#f0f0f0]">
            Result: <StatusBadge status={result.status} />
            {result.reason && <span className="text-[#888] ml-2">{result.reason}</span>}
          </p>
          {result.report && (
            <p className="text-[#888]">
              Week {result.report.weekNumber} · {result.report.progressPercentage}% progress ·{" "}
              {result.report.completedLessons}/{result.report.totalLessons} lessons complete
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pagination footer ──────────────────────────────────────────────────────

function Pagination({ page, setPage, total, limit }: { page: number; setPage: (fn: (p: number) => number) => void; total: number; limit: number }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-[#888]">{total} total</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="p-1.5 rounded border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs text-[#a0a0a0]">{page} / {totalPages}</span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="p-1.5 rounded border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Reports tab ─────────────────────────────────────────────────────────────

function ReportsTab({ courses }: { courses: any[] }) {
  const [page, setPage] = useState(1);
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const LIMIT = 25;

  const { data, isLoading } = useListCourseWeeklyReports({
    page,
    limit: LIMIT,
    courseId: courseFilter || undefined,
    status: statusFilter || undefined,
  });
  const rows: any[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <select
            value={courseFilter}
            onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#a0a0a0] outline-none focus:border-[#dc2626] appearance-none cursor-pointer"
          >
            <option value="">All courses</option>
            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#a0a0a0] outline-none focus:border-[#dc2626] appearance-none cursor-pointer"
          >
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-[#888] text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <ClipboardList size={32} className="text-[#666]" />
            <p className="text-[#888] text-sm">No weekly reports yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {["Member", "Course", "Week", "Progress", "Status", "Remarks", "Sent At"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className={cn("border-b border-[#1f1f1f] hover:bg-[#181818] transition-colors", i === rows.length - 1 && "border-b-0")}>
                    <td className="px-4 py-3">
                      <p className="text-[#f0f0f0] font-medium text-xs">{row.member?.firstName} {row.member?.lastName ?? ""}</p>
                      <p className="text-[#888] text-[11px]">{row.member?.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-[#a0a0a0] text-xs">{row.course?.title}</td>
                    <td className="px-4 py-3 text-[#a0a0a0] text-xs font-mono">{row.weekNumber}</td>
                    <td className="px-4 py-3 text-[#a0a0a0] text-xs">
                      {row.completedLessons}/{row.totalLessons} · {row.progressPercentage}%
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={row.whatsappStatus ?? row.status} /></td>
                    <td className="px-4 py-3 max-w-xs text-[#888] text-xs truncate">{row.remarks || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-[#a0a0a0] text-xs">{row.whatsappSentAt ? format(new Date(row.whatsappSentAt), "dd MMM yyyy") : "—"}</p>
                      {row.whatsappSentAt && <p className="text-[#888] text-[11px]">{format(new Date(row.whatsappSentAt), "HH:mm:ss")}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} setPage={setPage} total={total} limit={LIMIT} />
    </div>
  );
}

// ─── Feedback tab ────────────────────────────────────────────────────────────

function FeedbackTab({ courses }: { courses: any[] }) {
  const [page, setPage] = useState(1);
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const LIMIT = 25;

  const { data, isLoading } = useListCourseWeeklyFeedback({
    page,
    limit: LIMIT,
    courseId: courseFilter || undefined,
    status: statusFilter || undefined,
  });
  const rows: any[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const updateStatus = useUpdateCourseFeedbackStatus();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <select
            value={courseFilter}
            onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#a0a0a0] outline-none focus:border-[#dc2626] appearance-none cursor-pointer"
          >
            <option value="">All courses</option>
            {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#a0a0a0] outline-none focus:border-[#dc2626] appearance-none cursor-pointer"
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </div>

      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-[#888] text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <MessageSquareText size={32} className="text-[#666]" />
            <p className="text-[#888] text-sm">No feedback submitted yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {["Member", "Course", "Week", "Feedback", "Status", "WhatsApp", "Submitted", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} className={cn("border-b border-[#1f1f1f] hover:bg-[#181818] transition-colors", i === rows.length - 1 && "border-b-0")}>
                    <td className="px-4 py-3">
                      <p className="text-[#f0f0f0] font-medium text-xs">{row.member?.firstName} {row.member?.lastName ?? ""}</p>
                      <p className="text-[#888] text-[11px]">{row.member?.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-[#a0a0a0] text-xs">{row.course?.title}</td>
                    <td className="px-4 py-3 text-[#a0a0a0] text-xs font-mono">{row.weekNumber}</td>
                    <td className="px-4 py-3 max-w-xs text-[#888] text-xs truncate">{row.feedback}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3"><StatusBadge status={row.whatsappStatus} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-[#a0a0a0] text-xs">{format(new Date(row.submittedAt), "dd MMM yyyy")}</p>
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "new" && (
                        <button
                          onClick={() => updateStatus.mutate({ id: row.id, status: "reviewed" })}
                          disabled={updateStatus.isPending}
                          className="text-[11px] font-bold uppercase tracking-wider text-[#dc2626] hover:text-red-400 disabled:opacity-40 transition-colors"
                        >
                          Mark Reviewed
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} setPage={setPage} total={total} limit={LIMIT} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CourseWeeklyReportsPage() {
  const [tab, setTab] = useState<"reports" | "feedback">("reports");
  const { data: coursesRes } = useListVodCourses({ limit: 200 });
  const courses: any[] = coursesRes?.data ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest flex items-center gap-2">
            <ClipboardList size={20} className="text-[#dc2626]" />
            Weekly Course Reports
          </h1>
          <p className="text-xs text-[#888] mt-0.5">
            Weekly course progress reports (admin → member) and feedback (member → admin) — delivered over WhatsApp, continues every week until course completion
          </p>
        </div>

        <CreateSendPanel />

        <div className="flex items-center gap-1 bg-[#111] border border-[#1e1e1e] rounded-lg p-1 w-fit">
          {(["reports", "feedback"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3.5 py-1.5 rounded-md text-[12px] font-bold uppercase tracking-wider transition-all",
                tab === t ? "bg-[#dc2626] text-white shadow-sm" : "text-[#505050] hover:text-[#a0a0a0] hover:bg-[#181818]",
              )}
            >
              {t === "reports" ? "Reports" : "Feedback"}
            </button>
          ))}
        </div>

        {tab === "reports" ? <ReportsTab courses={courses} /> : <FeedbackTab courses={courses} />}
      </div>
    </DashboardLayout>
  );
}

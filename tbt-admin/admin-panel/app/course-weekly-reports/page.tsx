"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  Video,
  Eye,
  EyeOff,
  Star,
  ThumbsUp,
  ThumbsDown,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WeeklyQuestionsTab } from "@/components/course-reports/WeeklyQuestionsTab";
import {
  useListCourseWeeklyReports,
  useCreateOrSendCourseReport,
  useListCourseWeeklyFeedback,
  useUpdateCourseFeedbackStatus,
  useListCourseEpisodeFeedback,
  useUpdateCourseEpisodeFeedbackStatus,
  useListVodCourses,
  useGetCourseWeeklyReport,
  useGetCourseWeeklyFeedback,
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
  const [sendError, setSendError] = useState<string | null>(null);

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
                setSendError(null);
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
            onChange={(e) => { setCourseId(e.target.value); setResult(null); setSendError(null); }}
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
            setResult(null);
            setSendError(null);
            try {
              const res = await send.mutateAsync({
                memberId: selectedMember!.id,
                courseId,
                remarks: remarks.trim() || undefined,
                force,
              });
              setResult(res);
            } catch (err: any) {
              setSendError(err?.message ?? 'Send failed — check backend logs for details.');
            }
          }}
          className="inline-flex items-center gap-2 px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={13} /> {send.isPending ? 'Sending…' : 'Send Now'}
        </button>
        <label className="flex items-center gap-1.5 text-[11px] text-[#888] cursor-pointer select-none">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="accent-[#dc2626]" />
          Force (resend even if already sent this week)
        </label>
      </div>

      {sendError && (
        <div className="bg-[#0f0f0f] border border-[#dc2626]/30 rounded-lg p-4 text-xs space-y-1">
          <p className="text-[#dc2626] font-semibold uppercase tracking-wider text-[10px] font-rajdhani">Send failed</p>
          <p className="text-[#a0a0a0]">{sendError}</p>
        </div>
      )}

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

function ViewButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#a0a0a0] hover:text-[#f0f0f0] transition-colors whitespace-nowrap"
      title="View full report"
    >
      <Eye size={13} /> View
    </button>
  );
}

// ─── Full-detail modal (Reports + Weekly Feedback rows) ──────────────────────

function titleList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((t: any) => (typeof t === "string" ? t : t?.title ?? t?.name ?? ""))
    .filter((t: string) => !!t);
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1">{label}</p>
      <div className="text-xs text-[#e0e0e0]">{children}</div>
    </div>
  );
}

function fmtDateTime(v: string | null | undefined) {
  return v ? format(new Date(v), "dd MMM yyyy, HH:mm") : "—";
}

function DetailModal({
  kind,
  id,
  onClose,
}: {
  kind: "report" | "feedback";
  id: string;
  onClose: () => void;
}) {
  const reportQ = useGetCourseWeeklyReport(kind === "report" ? id : null);
  const feedbackQ = useGetCourseWeeklyFeedback(kind === "feedback" ? id : null);
  const q = kind === "report" ? reportQ : feedbackQ;
  const row: any = q.data;
  const updateStatus = useUpdateCourseFeedbackStatus();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const completed = titleList(row?.completedTitles);
  const pending = titleList(row?.pendingTitles);

  if (typeof document === "undefined") return null;
  // Portal to <body> above the fixed sidebar (z-[100]) so nothing covers the view.
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#141414] border border-[#2a2a2a] rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 px-5 py-4 bg-[#141414] border-b border-[#2a2a2a]">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest">
              {kind === "report" ? "Weekly Progress Report" : "Member Weekly Report"}
            </h2>
            {row && (
              <p className="text-xs text-[#888] mt-0.5 truncate">
                {row.member?.firstName} {row.member?.lastName ?? ""} · {row.course?.title} · Week {row.weekNumber}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-[#f0f0f0] transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {q.isLoading ? (
            <p className="text-sm text-[#888] py-8 text-center">Loading…</p>
          ) : q.isError || !row ? (
            <p className="text-sm text-[#dc2626] py-8 text-center">Could not load this report.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <DetailField label="Member">
                  <p>{row.member?.firstName} {row.member?.lastName ?? ""}</p>
                  {row.member?.phone && <p className="text-[#888]">{row.member.phone}</p>}
                  {row.member?.email && <p className="text-[#888] break-all">{row.member.email}</p>}
                </DetailField>
                <DetailField label="Course">{row.course?.title ?? "—"}</DetailField>
                <DetailField label="Week">{row.weekNumber}</DetailField>
                {kind === "report" ? (
                  <>
                    <DetailField label="Status"><StatusBadge status={row.whatsappStatus ?? row.status} /></DetailField>
                    <DetailField label="Created">{fmtDateTime(row.createdAt)}</DetailField>
                    <DetailField label="Sent at">{fmtDateTime(row.whatsappSentAt)}</DetailField>
                  </>
                ) : (
                  <>
                    <DetailField label="Review status"><StatusBadge status={row.status} /></DetailField>
                    <DetailField label="Submitted">{fmtDateTime(row.submittedAt)}</DetailField>
                    <DetailField label="Last updated">{fmtDateTime(row.updatedAt)}</DetailField>
                    <DetailField label="WhatsApp to admin"><StatusBadge status={row.whatsappStatus} /></DetailField>
                  </>
                )}
              </div>

              {kind === "report" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Progress</p>
                      <p className="text-xs text-[#e0e0e0]">
                        {row.completedLessons}/{row.totalLessons} lessons · {row.progressPercentage}%
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-[#2a2a2a] overflow-hidden">
                      <div
                        className="h-full bg-[#dc2626]"
                        style={{ width: `${Math.max(0, Math.min(100, Number(row.progressPercentage) || 0))}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailField label={`Completed lessons (${completed.length})`}>
                      {completed.length ? (
                        <ul className="space-y-1 list-disc pl-4">
                          {completed.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      ) : <span className="text-[#606060]">None this week</span>}
                    </DetailField>
                    <DetailField label={`Pending lessons (${pending.length})`}>
                      {pending.length ? (
                        <ul className="space-y-1 list-disc pl-4 text-[#a0a0a0]">
                          {pending.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      ) : <span className="text-[#606060]">None</span>}
                    </DetailField>
                  </div>
                </>
              )}

              {kind === "feedback" && row.answers?.length > 0 && (
                <DetailField label={`Answers${row.batchName ? ` · ${row.batchName}` : ""}`}>
                  <ol className="space-y-3 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3">
                    {row.answers.map((a: any, i: number) => (
                      <li key={a.id}>
                        <p className="text-[#a0a0a0] break-words">{i + 1}. {a.question}</p>
                        <p className="mt-0.5 text-sm text-[#f0f0f0] whitespace-pre-wrap break-words">
                          {a.value === null ? <span className="text-[#888] italic">Not answered</span>
                            : Array.isArray(a.value) ? a.value.join(", ")
                            : a.type === "rating" ? `${a.value} / 10`
                            : a.type === "number" ? Number(a.value).toLocaleString("en-IN")
                            : a.value}
                        </p>
                      </li>
                    ))}
                  </ol>
                </DetailField>
              )}

              {kind === "feedback" && !row.answers?.length && (
                <DetailField label="Report">
                  <p className="whitespace-pre-wrap leading-relaxed bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3 break-words">
                    {row.feedback || <span className="text-[#606060] italic">Empty</span>}
                  </p>
                </DetailField>
              )}

              <DetailField label="Admin remarks">
                <p className="whitespace-pre-wrap break-words">{row.remarks || <span className="text-[#606060]">—</span>}</p>
              </DetailField>

              {row.whatsappFailureReason && (
                <DetailField label="WhatsApp failure reason">
                  <p className="text-[#dc2626] break-words">{row.whatsappFailureReason}</p>
                </DetailField>
              )}

              {kind === "feedback" && row.status === "new" && (
                <button
                  onClick={() => updateStatus.mutate({ id: row.id, status: "reviewed" })}
                  disabled={updateStatus.isPending}
                  className="inline-flex items-center gap-2 px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40 transition-colors"
                >
                  <CheckCircle2 size={13} /> Mark Reviewed
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
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
  const [openId, setOpenId] = useState<string | null>(null);
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
                  {["Member", "Course", "Week", "Progress", "Status", "Remarks", "Sent At", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} onClick={() => setOpenId(row.id)} className={cn("border-b border-[#1f1f1f] hover:bg-[#181818] transition-colors cursor-pointer", i === rows.length - 1 && "border-b-0")}>
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
                    <td className="px-4 py-3">
                      <ViewButton onClick={() => setOpenId(row.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} setPage={setPage} total={total} limit={LIMIT} />
      {openId && <DetailModal kind="report" id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

// ─── Feedback tab ────────────────────────────────────────────────────────────

function FeedbackTab({ courses, initialOpenId }: { courses: any[]; initialOpenId: string | null }) {
  const [page, setPage] = useState(1);
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [weekFilter, setWeekFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  useEffect(() => { if (initialOpenId) setOpenId(initialOpenId); }, [initialOpenId]);
  const LIMIT = 25;

  const { data, isLoading } = useListCourseWeeklyFeedback({
    page,
    limit: LIMIT,
    week: weekFilter ? Number(weekFilter) : undefined,
    courseId: courseFilter || undefined,
    status: statusFilter || undefined,
  });
  const rows: any[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const updateStatus = useUpdateCourseFeedbackStatus();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <select
          value={weekFilter}
          aria-label="Week"
          onChange={(e) => { setWeekFilter(e.target.value); setPage(1); }}
          className="px-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#a0a0a0] outline-none focus:border-[#dc2626] cursor-pointer"
        >
          <option value="">All weeks</option>
          {Array.from({ length: 18 }, (_, i) => <option key={i} value={i + 1}>Week {i + 1}</option>)}
        </select>
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
                  <tr key={row.id} onClick={() => setOpenId(row.id)} className={cn("border-b border-[#1f1f1f] hover:bg-[#181818] transition-colors cursor-pointer", i === rows.length - 1 && "border-b-0")}>
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
                      <p className="text-[#a0a0a0] text-xs">{format(new Date(row.submittedAt), "dd MMM yyyy")}</p><p className="text-[#888] text-[11px]">{format(new Date(row.submittedAt), "hh:mm a")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ViewButton onClick={() => setOpenId(row.id)} />
                        {row.status === "new" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: row.id, status: "reviewed" }); }}
                            disabled={updateStatus.isPending}
                            className="text-[11px] font-bold uppercase tracking-wider text-[#dc2626] hover:text-red-400 disabled:opacity-40 transition-colors whitespace-nowrap"
                          >
                            Mark Reviewed
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination page={page} setPage={setPage} total={total} limit={LIMIT} />
      {openId && <DetailModal kind="feedback" id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

// ─── Video (episode) feedback tab ───────────────────────────────────────────

function EpisodeFeedbackTab({ courses, initialOpenId }: { courses: any[]; initialOpenId: string | null }) {
  const [page, setPage] = useState(1);
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(initialOpenId);
  const LIMIT = 25;

  const { data, isLoading } = useListCourseEpisodeFeedback({
    page,
    limit: LIMIT,
    courseId: courseFilter || undefined,
    status: statusFilter || undefined,
  });
  const rows: any[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const updateStatus = useUpdateCourseEpisodeFeedbackStatus();

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
            <Video size={32} className="text-[#666]" />
            <p className="text-[#888] text-sm">No video feedback submitted yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {["Member", "Course", "Video", "Rating", "Liked", "Feedback", "Status", "WhatsApp", "Submitted", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const expanded = expandedId === row.id;
                  return (
                    <>
                      <tr key={row.id} className={cn("border-b border-[#1f1f1f] hover:bg-[#181818] transition-colors", i === rows.length - 1 && !expanded && "border-b-0")}>
                        <td className="px-4 py-3">
                          <p className="text-[#f0f0f0] font-medium text-xs">{row.member?.firstName} {row.member?.lastName ?? ""}</p>
                          <p className="text-[#888] text-[11px]">{row.member?.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-[#a0a0a0] text-xs">{row.course?.title}</td>
                        <td className="px-4 py-3 text-[#a0a0a0] text-xs">{row.episode?.title}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.rating != null ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-400">
                              <Star size={11} fill="currentColor" />
                              {row.rating}/10
                            </span>
                          ) : (
                            <span className="text-[#606060] text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.liked === true && <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-400"><ThumbsUp size={11} /> Like</span>}
                          {row.liked === false && <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400"><ThumbsDown size={11} /> Dislike</span>}
                          {row.liked == null && <span className="text-[#606060] text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 max-w-xs text-[#888] text-xs truncate">{row.feedback}</td>
                        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-3"><StatusBadge status={row.whatsappStatus} /></td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-[#a0a0a0] text-xs">{format(new Date(row.submittedAt), "dd MMM yyyy")}</p><p className="text-[#888] text-[11px]">{format(new Date(row.submittedAt), "hh:mm a")}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setExpandedId(expanded ? null : row.id)}
                              className="text-[#888] hover:text-[#f0f0f0] transition-colors"
                              title={expanded ? "Hide full feedback" : "View full feedback"}
                            >
                              {expanded ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            {row.status === "new" && (
                              <button
                                onClick={() => updateStatus.mutate({ id: row.id, status: "reviewed" })}
                                disabled={updateStatus.isPending}
                                className="text-[11px] font-bold uppercase tracking-wider text-[#dc2626] hover:text-red-400 disabled:opacity-40 transition-colors whitespace-nowrap"
                              >
                                Mark Reviewed
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr key={`${row.id}-detail`} className={cn("border-b border-[#1f1f1f]", i === rows.length - 1 && "border-b-0")}>
                          <td colSpan={10} className="px-4 py-3 bg-[#0a0a0a]">
                            <div className="flex items-center gap-4 mb-2">
                              {row.rating != null && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-400">
                                  <Star size={11} fill="currentColor" /> {row.rating}/10
                                </span>
                              )}
                              {row.liked === true && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-400">
                                  <ThumbsUp size={11} /> Liked
                                </span>
                              )}
                              {row.liked === false && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
                                  <ThumbsDown size={11} /> Disliked
                                </span>
                              )}
                              {row.updatedAt && row.updatedAt !== row.submittedAt && (
                                <span className="text-[10px] text-[#606060]">Updated {format(new Date(row.updatedAt), "dd MMM yyyy HH:mm")}</span>
                              )}
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1.5">Full Feedback</p>
                            <p className="text-xs text-[#e0e0e0] whitespace-pre-wrap leading-relaxed">{row.feedback || <span className="text-[#606060] italic">No comment provided</span>}</p>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
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
  const [tab, setTab] = useState<"reports" | "questions" | "feedback" | "video-feedback">("reports");
  const [questionsDirty, setQuestionsDirty] = useState(false);
  const [initialOpenFeedbackId, setInitialOpenFeedbackId] = useState<string | null>(null);
  const [initialOpenWeeklyId, setInitialOpenWeeklyId] = useState<string | null>(null);

  // Deep-link from notification: ?tab=video-feedback&open=<feedbackId>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    const openId = params.get("open");
    if (t === "questions" || t === "video-feedback" || t === "feedback" || t === "reports") setTab(t);
    if (openId) {
      if (t === "feedback") setInitialOpenWeeklyId(openId);
      else setInitialOpenFeedbackId(openId);
    }
    if (t || openId) window.history.replaceState({}, "", "/course-weekly-reports");
  }, []);
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
            Weekly course progress reports (admin → member), weekly feedback, and per-video feedback (member → admin) — delivered over WhatsApp
          </p>
        </div>

        {tab !== "questions" && <CreateSendPanel />}

        <div className="flex flex-wrap items-center gap-1 bg-[#111] border border-[#1e1e1e] rounded-lg p-1 w-fit">
          {(["reports", "questions", "feedback", "video-feedback"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                if (t === tab || (questionsDirty && !window.confirm("The questions have unsaved changes. Leave without saving?"))) return;
                setQuestionsDirty(false);
                setTab(t);
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-md text-[12px] font-bold uppercase tracking-wider transition-all",
                tab === t ? "bg-[#dc2626] text-white shadow-sm" : "text-[#505050] hover:text-[#a0a0a0] hover:bg-[#181818]",
              )}
            >
              {t === "reports" ? "Reports" : t === "questions" ? "Weekly Questions" : t === "feedback" ? "Weekly Feedback" : "Video Feedback"}
            </button>
          ))}
        </div>

        {tab === "reports" ? (
          <ReportsTab courses={courses} />
        ) : tab === "questions" ? (
          <WeeklyQuestionsTab dirty={questionsDirty} setDirty={setQuestionsDirty} />
        ) : tab === "feedback" ? (
          <FeedbackTab courses={courses} initialOpenId={initialOpenWeeklyId} />
        ) : (
          <EpisodeFeedbackTab courses={courses} initialOpenId={initialOpenFeedbackId} />
        )}
      </div>
    </DashboardLayout>
  );
}

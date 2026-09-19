"use client";

import React, { useState } from "react";
import { Filter, Eye, EyeOff, Video, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useListCourseEpisodeFeedback, useUpdateCourseEpisodeFeedbackStatus } from "@/lib/hooks/useTbt";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Shared by both the Courses page (Courses → Feedback) and the Weekly
// Course Reports page (Video Feedback tab) — a single implementation so
// the feedback list is never duplicated across the two entry points.

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  sent: { label: "Sent", color: "#22c55e", bg: "rgba(34,197,94,0.12)", Icon: CheckCircle2 },
  failed: { label: "Failed", color: "#dc2626", bg: "rgba(220,38,38,0.12)", Icon: XCircle },
  skipped: { label: "Skipped", color: "#a0a0a0", bg: "rgba(160,160,160,0.12)", Icon: Clock },
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

export function CourseFeedbackTab({ courses, initialOpenId }: { courses: any[]; initialOpenId?: string | null }) {
  const [page, setPage] = useState(1);
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(initialOpenId ?? null);
  const LIMIT = 25;

  const { data, isLoading, isError, error } = useListCourseEpisodeFeedback({
    page,
    limit: LIMIT,
    courseId: courseFilter || undefined,
    status: statusFilter || undefined,
  });
  const rows: any[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const updateStatus = useUpdateCourseEpisodeFeedbackStatus();

  const errorMessage =
    (typeof (error as any)?.response?.data?.error === "string" && (error as any).response.data.error) ||
    (error as any)?.message ||
    "Unable to load feedback. Please try again.";

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
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 px-4 text-center">
            <XCircle size={28} className="text-[#dc2626]" />
            <p className="text-[#dc2626] text-sm">{errorMessage}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Video size={32} className="text-[#666]" />
            <p className="text-[#888] text-sm">No feedback received yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {["Member", "Course", "Video", "Feedback", "Status", "WhatsApp", "Submitted", ""].map((h) => (
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
                    <React.Fragment key={row.id}>
                      <tr key={row.id} className={cn("border-b border-[#1f1f1f] hover:bg-[#181818] transition-colors", i === rows.length - 1 && !expanded && "border-b-0")}>
                        <td className="px-4 py-3">
                          <p className="text-[#f0f0f0] font-medium text-xs">{row.member?.firstName} {row.member?.lastName ?? ""}</p>
                          <p className="text-[#888] text-[11px]">{row.member?.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-[#a0a0a0] text-xs">{row.course?.title}</td>
                        <td className="px-4 py-3 text-[#a0a0a0] text-xs">{row.episode?.title}</td>
                        <td className="px-4 py-3 max-w-xs text-[#888] text-xs truncate">{row.feedback}</td>
                        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-3"><StatusBadge status={row.whatsappStatus} /></td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-[#a0a0a0] text-xs">{format(new Date(row.submittedAt), "dd MMM yyyy")}</p>
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
                          <td colSpan={8} className="px-4 py-3 bg-[#0a0a0a]">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1.5">Full Feedback</p>
                            <p className="text-xs text-[#e0e0e0] whitespace-pre-wrap leading-relaxed">{row.feedback}</p>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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

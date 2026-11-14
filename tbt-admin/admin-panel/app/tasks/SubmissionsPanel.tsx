"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Calendar, Check, ChevronDown, ChevronRight, ClipboardList, Clock,
  FileText, Filter, GraduationCap, Link, Loader2, RefreshCw, Search, X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useListAllTaskSubmissions, useReviewTaskSubmission } from "@/lib/hooks/useTasks";
import { cn } from "@/lib/utils";

// Tasks → Submissions: every member task submission, grouped batch-wise, with
// batch / date-range / status / day / search filters and the approve-reject review flow.

const STATUSES = [
  { value: "pending", label: "Pending", cls: "text-yellow-400 bg-yellow-400/10", ring: "border-yellow-500/40" },
  { value: "approved", label: "Approved", cls: "text-green-400 bg-green-400/10", ring: "border-green-500/40" },
  { value: "rejected", label: "Rejected", cls: "text-red-400 bg-red-400/10", ring: "border-red-500/40" },
  { value: "resubmission_required", label: "Resubmission", cls: "text-orange-400 bg-orange-400/10", ring: "border-orange-500/40" },
] as const;
const STATUS_META: Record<string, (typeof STATUSES)[number]> = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

const NO_BATCH = "__none__";

const IST = "Asia/Kolkata";
const fmtDate = (v: string | Date) =>
  new Date(v).toLocaleDateString("en-IN", { timeZone: IST, day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (v: string | Date) =>
  new Date(v).toLocaleTimeString("en-IN", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: true });
/** Today's date in IST as YYYY-MM-DD */
const istToday = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: IST });
};

const memberName = (s: any) => [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || "Unknown member";

const selectCls =
  "bg-[#181818] border border-[#2a2a2a] rounded-lg h-10 pl-4 pr-9 text-sm text-white outline-none focus:border-[#dc2626] appearance-none cursor-pointer";
const inputCls =
  "bg-[#181818] border border-[#2a2a2a] rounded-lg h-10 px-3 text-sm text-white outline-none focus:border-[#dc2626] [color-scheme:dark]";
const labelCls = "block text-[10px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1";

export function SubmissionsPanel({ batches }: { batches: any[] }) {
  const [batchId, setBatchId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [day, setDay] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [rejectModal, setRejectModal] = useState<{ subId: string; name: string; feedback: string } | null>(null);

  // Debounce the free-text search so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const dateError = from && to && from > to ? "Start date is after end date" : "";

  const { data, isLoading, isFetching, isError, error, refetch } = useListAllTaskSubmissions({
    batchId: batchId === NO_BATCH ? "none" : batchId || undefined,
    status: status || undefined,
    from: dateError ? undefined : from || undefined,
    to: dateError ? undefined : to || undefined,
    dayNumber: day ? Number(day) : undefined,
    search: search || undefined,
  });
  const review = useReviewTaskSubmission();

  const rows: any[] = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;
  const counts = meta?.statusCounts ?? {};
  const allCount = Object.values(counts).reduce((a: number, b: any) => a + Number(b || 0), 0);

  // Batch-wise grouping, in the order the API returns (batch name A→Z, "No batch" last).
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; rows: any[] }>();
    for (const r of rows) {
      const key = r.batchId ?? NO_BATCH;
      if (!map.has(key)) map.set(key, { key, name: r.batchName ?? "No batch assigned", rows: [] });
      map.get(key)!.rows.push(r);
    }
    return [...map.values()];
  }, [rows]);

  const hasFilters = !!(batchId || status || from || to || day || searchInput);
  const clearFilters = () => {
    setBatchId(""); setStatus(""); setFrom(""); setTo(""); setDay(""); setSearchInput(""); setSearch("");
  };

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const approve = async (subId: string) => {
    try {
      await review.mutateAsync({ subId, action: "approve" });
      toast.success("Submission approved");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to approve");
    }
  };

  const submitReject = async () => {
    if (!rejectModal) return;
    try {
      await review.mutateAsync({ subId: rejectModal.subId, action: "reject", feedback: rejectModal.feedback.trim() || undefined });
      toast.success("Submission rejected");
      setRejectModal(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to reject");
    }
  };

  const datePresets = [
    { label: "Today", from: istToday(), to: istToday() },
    { label: "Last 7 days", from: istToday(-6), to: istToday() },
    { label: "Last 30 days", from: istToday(-29), to: istToday() },
  ];

  return (
    <>
      {/* ── Status summary (click to filter) ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button
          onClick={() => setStatus("")}
          className={cn(
            "text-left rounded-xl border bg-[#181818] px-4 py-3 transition-colors",
            status === "" ? "border-[#dc2626]" : "border-[#2a2a2a] hover:border-[#444]",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#888] font-rajdhani">All submissions</p>
          <p className="text-2xl font-bold text-[#f0f0f0] font-rajdhani">{meta ? allCount : "—"}</p>
        </button>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(status === s.value ? "" : s.value)}
            className={cn(
              "text-left rounded-xl border bg-[#181818] px-4 py-3 transition-colors",
              status === s.value ? s.ring : "border-[#2a2a2a] hover:border-[#444]",
            )}
          >
            <p className={cn("text-[10px] font-bold uppercase tracking-widest font-rajdhani", s.cls.split(" ")[0])}>{s.label}</p>
            <p className="text-2xl font-bold text-[#f0f0f0] font-rajdhani">{meta ? counts[s.value] ?? 0 : "—"}</p>
          </button>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className={labelCls}>Batch</label>
            <div className="relative">
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className={cn(selectCls, "min-w-[200px]")}>
                <option value="">All batches</option>
                {batches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                <option value={NO_BATCH}>No batch assigned</option>
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <div className="relative">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(selectCls, "min-w-[160px]")}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Submitted from</label>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Submitted to</label>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Day</label>
            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
              <input
                type="number" min={1} value={day} onChange={(e) => setDay(e.target.value)} placeholder="Day #"
                className={cn(inputCls, "pl-8 w-24")}
              />
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className={labelCls}>Search</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
              <input
                value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Member name, phone, member ID or task…"
                className={cn(inputCls, "pl-8 w-full")}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Calendar size={13} className="text-[#666]" />
          {datePresets.map((p) => (
            <button
              key={p.label}
              onClick={() => { setFrom(p.from); setTo(p.to); }}
              className={cn(
                "px-3 py-1 rounded-full text-[11px] font-bold font-rajdhani uppercase tracking-wider border transition-colors",
                from === p.from && to === p.to ? "border-[#dc2626] text-[#f0f0f0] bg-[#dc2626]/10" : "border-[#2a2a2a] text-[#888] hover:text-white",
              )}
            >
              {p.label}
            </button>
          ))}
          {dateError && <span className="text-[11px] text-red-400 font-bold">{dateError}</span>}
          <div className="ml-auto flex items-center gap-3">
            {isFetching && !isLoading && <Loader2 size={13} className="animate-spin text-[#666]" />}
            {meta && (
              <span className="text-[11px] text-[#666] font-rajdhani font-bold uppercase tracking-widest">
                {meta.returned < meta.total ? `Showing latest ${meta.returned} of ${meta.total}` : `${meta.total} submission${meta.total !== 1 ? "s" : ""}`}
              </span>
            )}
            {hasFilters && (
              <button onClick={clearFilters} className="text-[11px] text-[#dc2626] font-bold font-rajdhani uppercase tracking-widest hover:underline">
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#dc2626]" />
        </div>
      ) : isError ? (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle size={36} className="text-red-500/60" />
          <p className="text-red-400 font-rajdhani font-bold uppercase tracking-widest text-sm">Failed to load submissions</p>
          <p className="text-[#666] text-xs max-w-sm text-center">
            {(error as any)?.response?.data?.error?.message ?? (error as any)?.response?.data?.error ?? (error as any)?.message ?? "An unexpected error occurred."}
          </p>
          <button onClick={() => refetch()} className="flex items-center gap-2 bg-[#2a2a2a] hover:bg-[#333] text-white px-4 py-2 rounded-lg font-rajdhani font-bold text-[12px] tracking-[1px] uppercase transition-all">
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <ClipboardList size={36} className="text-[#333]" />
          <p className="text-[#555] font-rajdhani font-bold uppercase tracking-widest text-sm">
            {hasFilters ? "No submissions match these filters" : "No task submissions yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            const pending = g.rows.filter((r) => r.status === "pending").length;
            return (
              <section key={g.key} className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGroup(g.key)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 bg-[#1a1a1a] border-b border-[#2a2a2a] text-left hover:bg-[#1f1f1f] transition-colors"
                >
                  <ChevronRight size={14} className={cn("text-[#666] transition-transform", !isCollapsed && "rotate-90")} />
                  <GraduationCap size={15} className="text-[#dc2626]" />
                  <h3 className="font-rajdhani text-[14px] font-bold uppercase tracking-[1.5px] text-[#f0f0f0] truncate">{g.name}</h3>
                  <span className="text-[11px] text-[#888] font-rajdhani font-bold uppercase tracking-wider">
                    {g.rows.length} submission{g.rows.length !== 1 ? "s" : ""}
                  </span>
                  {pending > 0 && (
                    <span className="ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-bold font-rajdhani uppercase tracking-wider text-yellow-400 bg-yellow-400/10">
                      {pending} pending
                    </span>
                  )}
                </button>

                {!isCollapsed && (
                  <>
                    <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)] gap-4 px-5 pl-12 py-2 border-b border-[#1e1e1e] text-[10px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
                      <span>Student</span><span>Batch</span><span>Task</span><span>Submitted</span><span>Status</span>
                    </div>
                    <div className="divide-y divide-[#1e1e1e]">
                      {g.rows.map((sub) => (
                        <SubmissionRow
                          key={sub.id}
                          sub={sub}
                          expanded={expandedId === sub.id}
                          onToggle={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                          onApprove={() => approve(sub.id)}
                          onReject={() => setRejectModal({ subId: sub.id, name: memberName(sub), feedback: "" })}
                          busy={review.isPending}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── Reject modal ──────────────────────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-7 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <div>
                <h3 className="font-rajdhani text-lg font-bold uppercase tracking-widest text-red-400">Reject Submission</h3>
                <p className="text-[12px] text-[#888]">{rejectModal.name}</p>
              </div>
              <button onClick={() => setRejectModal(null)} className="text-[#888] hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-7">
              <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani">Feedback for the member (optional)</label>
              <textarea
                value={rejectModal.feedback}
                onChange={(e) => setRejectModal((m) => (m ? { ...m, feedback: e.target.value } : m))}
                rows={4}
                placeholder="Explain what needs to be revised…"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] text-sm resize-none"
              />
            </div>
            <div className="px-7 py-5 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setRejectModal(null)} className="px-5 py-2 rounded-lg border border-[#333] text-[#888] hover:text-white hover:border-[#555] text-[13px] font-bold font-rajdhani uppercase tracking-wider transition-all">Cancel</button>
              <button onClick={submitReject} disabled={review.isPending} className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-lg font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all disabled:opacity-50">
                {review.isPending && <Loader2 size={14} className="animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SubmissionRow({
  sub, expanded, onToggle, onApprove, onReject, busy,
}: {
  sub: any; expanded: boolean; onToggle: () => void; onApprove: () => void; onReject: () => void; busy: boolean;
}) {
  const st = STATUS_META[sub.status] ?? { label: sub.status, cls: "text-[#888] bg-[#888]/10" };
  const canApprove = sub.status !== "approved";
  const canReject = sub.status === "pending" || sub.status === "resubmission_required";

  return (
    <div>
      <button onClick={onToggle} className="w-full px-5 py-3.5 hover:bg-[#1f1f1f] transition-colors text-left flex items-start gap-3">
        <ChevronRight size={14} className={cn("text-[#555] mt-1 shrink-0 transition-transform", expanded && "rotate-90")} />
        {sub.profilePhotoUrl ? (
          <img src={sub.profilePhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#2a2a2a] text-[#a0a0a0] text-[12px] font-bold flex items-center justify-center shrink-0">
            {memberName(sub).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0 grid grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)] gap-x-4 gap-y-2 items-center">
          <div className="min-w-0">
            <p className="text-[13px] text-[#f0f0f0] font-medium truncate">{memberName(sub)}</p>
            <p className="text-[11px] text-[#666] truncate">{[sub.memberCode, sub.memberPhone].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[12px] text-[#a0a0a0] truncate">{sub.batchName ?? "No batch"}</p>
            {sub.dayNumber != null && <p className="text-[10px] text-[#666] uppercase font-rajdhani font-bold">Day {sub.dayNumber}</p>}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] text-[#d0d0d0] truncate">{sub.taskTitle || "—"}</p>
            <p className="text-[10px] text-[#555] uppercase font-rajdhani font-bold">{sub.proofType || sub.taskProofType || ""}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[12px] text-[#d0d0d0]">{fmtDate(sub.submittedAt)}</p>
            <p className="text-[11px] text-[#666] flex items-center gap-1"><Clock size={10} />{fmtTime(sub.submittedAt)} IST</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold font-rajdhani uppercase tracking-wider", st.cls)}>{st.label}</span>
            {sub.submittedAfterExpiry && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-rajdhani uppercase tracking-wider bg-orange-500/15 text-orange-400">⚠ Late</span>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-6 lg:pl-16 pb-5 pt-3 bg-[#141414] border-t border-[#1e1e1e] space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
            <Detail label="Submitted" value={`${fmtDate(sub.submittedAt)}, ${fmtTime(sub.submittedAt)} IST`} />
            <Detail label="Batch" value={sub.batchName ?? "No batch assigned"} />
            <Detail label="Points on approval" value={sub.basePoints != null ? `${sub.basePoints}${sub.isMilestone ? " + milestone" : ""}` : "—"} />
            <Detail
              label="Reviewed"
              value={sub.reviewedAt ? `${fmtDate(sub.reviewedAt)}, ${fmtTime(sub.reviewedAt)}${sub.reviewerName ? ` · ${sub.reviewerName}` : ""}` : "Not reviewed yet"}
            />
          </div>

          {sub.submittedAfterExpiry && (
            <div className="p-3 bg-orange-900/10 border border-orange-700/30 rounded-lg">
              <p className="text-[11px] font-bold text-orange-400 uppercase tracking-widest font-rajdhani mb-0.5">Timer violation</p>
              <p className="text-[12px] text-orange-300/80">
                Submitted after the {sub.timerSeconds ? `${Math.round(sub.timerSeconds / 60)}-minute ` : ""}focus timer expired.
                {sub.timerStartedAt && ` Timer started ${fmtDate(sub.timerStartedAt)}, ${fmtTime(sub.timerStartedAt)} IST.`}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[11px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">Submission</p>
            {sub.responseValue && (
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 flex items-start gap-2">
                <FileText size={14} className="text-[#666] mt-0.5 shrink-0" />
                <p className="text-[13px] text-[#d0d0d0] leading-relaxed whitespace-pre-wrap break-words">{sub.responseValue}</p>
              </div>
            )}
            {sub.proofUrl && (
              <a
                href={sub.proofUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[12px] text-[#3b82f6] hover:text-blue-300 hover:border-blue-800 transition-all w-fit"
              >
                <Link size={13} /> View proof file / link
              </a>
            )}
            {!sub.responseValue && !sub.proofUrl && <p className="text-[12px] text-[#555] italic">No proof submitted</p>}
          </div>

          {sub.deliverables && (
            <div className="p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest font-rajdhani mb-1">Expected deliverables</p>
              <p className="text-[12px] text-[#888] whitespace-pre-wrap">{sub.deliverables}</p>
            </div>
          )}

          {sub.feedback && (
            <div className="p-3 bg-red-900/10 border border-red-900/30 rounded-lg">
              <p className="text-[10px] font-bold text-red-400/70 uppercase tracking-widest font-rajdhani mb-1">Admin feedback</p>
              <p className="text-[12px] text-red-300 whitespace-pre-wrap">{sub.feedback}</p>
            </div>
          )}

          {(canApprove || canReject) && (
            <div className="flex flex-wrap gap-3">
              {canApprove && (
                <button
                  onClick={onApprove} disabled={busy}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-green-600 text-white text-[12px] font-bold font-rajdhani uppercase tracking-wider hover:bg-green-700 transition-all disabled:opacity-50"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {sub.status === "rejected" ? "Approve instead" : "Approve"}
                </button>
              )}
              {canReject && (
                <button
                  onClick={onReject} disabled={busy}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-red-400 text-[12px] font-bold font-rajdhani uppercase tracking-wider hover:bg-red-900/20 hover:border-red-800 transition-all disabled:opacity-50"
                >
                  <X size={13} /> Reject
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">{label}</p>
      <p className="text-[#d0d0d0] truncate" title={value}>{value}</p>
    </div>
  );
}

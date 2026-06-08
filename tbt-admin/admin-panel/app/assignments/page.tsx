"use client";

import { Fragment, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CheckCircle2, Clock, Loader2, ClipboardCheck, Check } from "lucide-react";
import { useAllAssignmentSubmissions, useReviewAssignment, useListWorkshops } from "@/lib/hooks/useTbt";
import { format, isValid } from "date-fns";
import toast from "react-hot-toast";

const safeDate = (d: any) => {
  if (!d) return "—";
  try { const p = new Date(d); return isValid(p) ? format(p, "dd MMM yyyy") : "—"; } catch { return "—"; }
};

export default function AssignmentsPage() {
  const [reviewed, setReviewed] = useState<"" | "true" | "false">("");
  const [workshopId, setWorkshopId] = useState("");
  const [page, setPage] = useState(1);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const { data: workshopsData } = useListWorkshops();
  const workshops = (workshopsData as any)?.data || [];

  const { data, isLoading } = useAllAssignmentSubmissions({
    reviewed: reviewed || undefined,
    workshopId: workshopId || undefined,
    page,
    limit: 20,
  });
  const submissions = (data as any)?.data || [];
  const total = (data as any)?.meta?.total ?? 0;

  const reviewMutation = useReviewAssignment();

  const handleReview = async (submissionId: string) => {
    try {
      await reviewMutation.mutateAsync({ submissionId, reviewNote });
      toast.success("Submission reviewed");
      setReviewingId(null);
      setReviewNote("");
    } catch {
      toast.error("Failed to review");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex gap-2.5 items-start mb-6">
          <div className="w-0.5 bg-[#e02020] rounded-sm min-h-[40px]" />
          <div>
            <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0]">Assignment Submissions</h1>
            <p className="text-[12px] text-[#606060] font-medium uppercase tracking-wider font-rajdhani">Review and respond to member assignment answers.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={workshopId}
            onChange={e => { setWorkshopId(e.target.value); setPage(1); }}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 px-4 text-white text-sm outline-none focus:border-[#dc2626] appearance-none min-w-[200px]"
          >
            <option value="">All Workshops</option>
            {workshops.map((w: any) => <option key={w.id} value={w.id}>{w.title}</option>)}
          </select>
          <div className="flex gap-1">
            {[["", "All"], ["false", "Pending"], ["true", "Reviewed"]].map(([val, label]) => (
              <button
                key={val}
                onClick={() => { setReviewed(val as any); setPage(1); }}
                className={`px-4 py-2 rounded text-[10px] font-bold font-rajdhani uppercase tracking-widest transition-all ${reviewed === val ? "bg-[#dc2626] text-white" : "bg-[#1a1a1a] text-[#606060] border border-[#2a2a2a] hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-[#444] ml-auto">{total} submissions</span>
        </div>

        {/* Table */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-[#444]" /></div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <ClipboardCheck size={32} className="mx-auto text-[#333]" />
              <p className="text-[#444] text-sm font-rajdhani font-bold uppercase tracking-widest">No submissions found</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                    <th className="px-5 py-3 text-left text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Member</th>
                    <th className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Assignment</th>
                    <th className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Answer</th>
                    <th className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Submitted</th>
                    <th className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Status</th>
                    <th className="px-4 py-3 w-[90px]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f1f]">
                  {submissions.map((s: any) => (
                    <Fragment key={s.id}>
                      <tr className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-[12px] font-bold text-[#f0f0f0]">{s.member?.firstName} {s.member?.lastName}</p>
                          <p className="text-[10px] text-[#444]">{s.member?.email}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-[12px] text-[#a0a0a0] truncate max-w-[200px]">{s.assignment?.title}</p>
                          <p className="text-[10px] text-[#444] truncate max-w-[200px]">{s.assignment?.challenge?.workshop?.title}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-[11px] text-[#606060] max-w-[220px] line-clamp-2">{s.answerText}</p>
                        </td>
                        <td className="px-4 py-3.5 text-[11px] text-[#444]">{safeDate(s.submittedAt)}</td>
                        <td className="px-4 py-3.5">
                          {s.reviewedAt ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 size={12} className="text-green-400" />
                              <span className="text-[10px] text-green-400 font-bold font-rajdhani uppercase">Reviewed</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} className="text-orange-400" />
                              <span className="text-[10px] text-orange-400 font-bold font-rajdhani uppercase">Pending</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {!s.reviewedAt && (
                            <button
                              onClick={() => { setReviewingId(reviewingId === s.id ? null : s.id); setReviewNote(s.reviewNote || ""); }}
                              className="px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[10px] font-bold font-rajdhani uppercase tracking-widest text-[#606060] hover:border-[#dc2626] hover:text-[#dc2626] transition-all"
                            >
                              Review
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* Review panel */}
                      {reviewingId === s.id && (
                        <tr>
                          <td colSpan={6} className="px-5 py-4 bg-[#141414] border-t border-[#222]">
                            <div className="flex gap-3">
                              <textarea
                                value={reviewNote}
                                onChange={e => setReviewNote(e.target.value)}
                                placeholder="Add review note (optional)..."
                                rows={2}
                                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-[#dc2626] resize-none transition-all"
                              />
                              <div className="flex flex-col gap-2 shrink-0">
                                <button
                                  onClick={() => handleReview(s.id)}
                                  disabled={reviewMutation.isPending}
                                  className="px-4 py-2 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[11px] uppercase tracking-widest transition-all flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {reviewMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Mark Reviewed
                                </button>
                                <button
                                  onClick={() => { setReviewingId(null); setReviewNote(""); }}
                                  className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] text-[#606060] hover:text-white rounded-lg font-rajdhani font-bold text-[11px] uppercase tracking-widest transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {total > 20 && (
                <div className="px-6 py-3 border-t border-[#1f1f1f] flex items-center justify-between">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-[11px] font-bold font-rajdhani uppercase tracking-widest text-[#606060] hover:text-white disabled:opacity-30 transition-colors">← Prev</button>
                  <span className="text-[10px] text-[#444]">Page {page} · {total} total</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={submissions.length < 20} className="text-[11px] font-bold font-rajdhani uppercase tracking-widest text-[#606060] hover:text-white disabled:opacity-30 transition-colors">Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

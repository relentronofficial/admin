"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FileText, Loader2, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { useMyEnrollments } from "@/lib/hooks/useCourses";
import { useSubmitWeeklyReport } from "@/lib/hooks/useCourseReports";

/** The member's Weekly Report form (one report a week covers every course). Used from
 *  Messages, the Friday/Saturday reminder popup and the locked-video screen. */
export function WeeklyReportModal({ onClose, intro }: { onClose: () => void; intro?: ReactNode }) {
  const { data: enrollments } = useMyEnrollments();
  const submit = useSubmitWeeklyReport();

  const courses: { id: string; title: string }[] = (
    ((enrollments as any)?.data ?? (Array.isArray(enrollments) ? enrollments : [])) as any[]
  ).map((c) => ({ id: c.id ?? c.courseId, title: c.title ?? c.course?.title ?? "Untitled" }));

  const [courseId, setCourseId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [remarks, setRemarks] = useState("");

  // One course → nothing to choose.
  useEffect(() => {
    if (!courseId && courses.length === 1) setCourseId(courses[0].id);
  }, [courses, courseId]);

  const canSubmit = !!courseId && feedback.trim().length >= 1;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await submit.mutateAsync({ courseId, feedback: feedback.trim(), remarks: remarks.trim() || undefined });
      toast.success("Weekly report submitted!");
      onClose();
    } catch {
      toast.error("Failed to submit report. Please try again.");
    }
  };

  const fieldStyle = {
    background: "var(--color-bg-primary)",
    borderColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      onClick={() => !submit.isPending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="weekly-report-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-5 space-y-4"
        style={{ background: "var(--color-modal-bg)", border: "1px solid var(--color-border-medium)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} style={{ color: "var(--color-accent)" }} />
            <p id="weekly-report-title" className="font-semibold text-sm text-foreground">
              Weekly Report
            </p>
          </div>
          <button onClick={onClose} disabled={submit.isPending} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {intro}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Course <span style={{ color: "var(--color-accent)" }}>*</span>
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={submit.isPending}
              className="w-full h-10 px-3 text-sm rounded-lg outline-none border text-foreground bg-transparent disabled:opacity-50"
              style={fieldStyle}
            >
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            {courses.length === 0 && <p className="text-xs text-muted-foreground mt-1">No enrolled courses found.</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Report <span style={{ color: "var(--color-accent)" }}>*</span>
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={submit.isPending}
              placeholder="Share your weekly progress, challenges, and achievements…"
              rows={5}
              maxLength={4000}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none border text-foreground resize-none disabled:opacity-50"
              style={fieldStyle}
            />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{feedback.length}/4000</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Additional notes <span className="font-normal">(optional)</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={submit.isPending}
              placeholder="Any questions or specific help you need…"
              rows={2}
              maxLength={2000}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none border text-foreground resize-none disabled:opacity-50"
              style={fieldStyle}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={submit.isPending}
            className="flex-1 h-10 rounded-lg text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            style={{ border: "1px solid var(--color-border-medium)" }}
          >
            {intro ? "Later" : "Cancel"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submit.isPending}
            className="flex-1 h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={{ background: "var(--color-accent)" }}
          >
            {submit.isPending ? (
              <><Loader2 size={13} className="animate-spin" /> Submitting…</>
            ) : (
              <><Send size={13} /> Submit Report</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Clock, Send } from "lucide-react";

import { useCourse } from "@/lib/hooks/useCourses";
import {
  useMyCourseFeedbackHistory,
  useMyCourseReportHistory,
  useMyCurrentCourseReport,
  useSubmitCourseFeedback,
} from "@/lib/hooks/useCourseReports";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="p-4 rounded-2xl"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      {children}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-overlay)" }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: "var(--color-accent)" }}
      />
    </div>
  );
}

export default function WeeklyCourseReportPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params.courseId;
  const router = useRouter();

  const { data: course } = useCourse(courseId);
  const { data: currentReport, isLoading: loadingCurrent } = useMyCurrentCourseReport(courseId);
  const { data: reportHistory = [] } = useMyCourseReportHistory(courseId);
  const { data: feedbackHistory = [] } = useMyCourseFeedbackHistory(courseId);
  const submitFeedback = useSubmitCourseFeedback(courseId);

  const currentWeekNumber = currentReport?.weekNumber;
  const feedbackAlreadySubmitted = useMemo(
    () => feedbackHistory.find((f) => f.weekNumber === currentWeekNumber) ?? null,
    [feedbackHistory, currentWeekNumber],
  );

  const [feedback, setFeedback] = useState(feedbackAlreadySubmitted?.feedback ?? "");
  const [remarks, setRemarks] = useState(feedbackAlreadySubmitted?.remarks ?? "");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => router.push(`/learning/${courseId}`)}
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Weekly Report</h1>
      </div>

      {course && <p className="text-sm text-muted-foreground mb-4">{course.title}</p>}

      {/* Current week's report */}
      {loadingCurrent ? (
        <div className="text-center py-10 text-sm text-muted-foreground">Loading…</div>
      ) : !currentReport ? (
        <SectionCard>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={16} />
            <p className="text-sm">This week&apos;s report hasn&apos;t been generated yet — check back at the end of the week.</p>
          </div>
        </SectionCard>
      ) : (
        <SectionCard>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">Week {currentReport.weekNumber}</h2>
            <span className="text-xs text-muted-foreground">{currentReport.progressPercentage}% complete</span>
          </div>
          <ProgressBar percent={currentReport.progressPercentage} />
          <p className="text-xs text-muted-foreground mt-2">
            {currentReport.completedLessons} of {currentReport.totalLessons} lessons complete
          </p>

          {!!currentReport.completedTitles?.length && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Completed</p>
              <ul className="space-y-1">
                {currentReport.completedTitles.map((t) => (
                  <li key={t} className="flex items-center gap-1.5 text-xs text-foreground">
                    <CheckCircle2 size={12} style={{ color: "var(--color-success)" }} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!!currentReport.pendingTitles?.length && (
            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Pending</p>
              <ul className="space-y-1">
                {currentReport.pendingTitles.map((t) => (
                  <li key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Circle size={12} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {currentReport.remarks && (
            <div
              className="mt-4 p-2.5 rounded-lg"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 6%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
              }}
            >
              <p className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--color-accent)" }}>
                Admin Remarks
              </p>
              <p className="text-xs text-foreground mt-1 leading-relaxed">{currentReport.remarks}</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* Feedback form */}
      <div className="mt-5">
        <h2 className="text-sm font-bold text-foreground mb-2">
          {feedbackAlreadySubmitted ? "Your Feedback This Week" : "Share This Week's Feedback"}
        </h2>
        <SectionCard>
          <div className="space-y-3">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="How is this course going for you?"
              rows={3}
              className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none text-foreground placeholder-muted-foreground"
              style={{ background: "var(--color-surface-overlay)", border: "1px solid var(--color-border-subtle)" }}
            />
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Additional remarks (optional)"
              rows={2}
              className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none text-foreground placeholder-muted-foreground"
              style={{ background: "var(--color-surface-overlay)", border: "1px solid var(--color-border-subtle)" }}
            />
            <button
              disabled={!feedback.trim() || submitFeedback.isPending}
              onClick={async () => {
                await submitFeedback.mutateAsync({ feedback: feedback.trim(), remarks: remarks.trim() || undefined });
                setSubmitted(true);
              }}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-colors"
              style={{ background: "var(--color-accent)" }}
            >
              <Send size={14} />
              {feedbackAlreadySubmitted ? "Update Feedback" : "Submit Feedback"}
            </button>
            {submitted && (
              <p className="text-xs text-center" style={{ color: "var(--color-success)" }}>
                Feedback sent to your mentor.
              </p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* History */}
      {reportHistory.length > 1 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-foreground mb-2">Past Weeks</h2>
          <div className="space-y-2">
            {reportHistory
              .filter((r) => r.weekNumber !== currentReport?.weekNumber)
              .map((r) => (
                <SectionCard key={r.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Week {r.weekNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.progressPercentage}% · {formatDate(r.createdAt)}
                    </span>
                  </div>
                </SectionCard>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

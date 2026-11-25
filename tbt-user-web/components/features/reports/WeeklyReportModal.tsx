"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FileText, Loader2, Send, X } from "lucide-react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { useCourses, useMyEnrollments } from "@/lib/hooks/useCourses";
import { useSubmitWeeklyReport, useWeeklyForm } from "@/lib/hooks/useCourseReports";
import type { WeeklyAnswer } from "@/lib/api/services/courseReports.service";
import { QuestionField } from "./QuestionField";

/** The member's Weekly Report form (one report a week covers every course): the admin's
 *  questions for this batch week, or free text when there are none. Used from
 *  Messages, the Friday/Saturday reminder popup and the locked-video screen. */
export function WeeklyReportModal({
  onClose,
  intro,
  defaultCourseId,
}: {
  onClose: () => void;
  intro?: ReactNode;
  /** Pre-selects this course (e.g. the course being watched). */
  defaultCourseId?: string;
}) {
  // On a course or lesson page, pre-select that course.
  const pathname = usePathname();
  const pageCourseId = pathname?.match(/^\/(?:learning|courses)\/([0-9a-f-]{36})/i)?.[1];
  const preselectId = defaultCourseId ?? pageCourseId;

  // Every course in the catalog, plus any enrolled course the catalog no longer lists.
  const { data: catalog, isLoading: catalogLoading, isError: catalogError, refetch } = useCourses({ limit: 200 });
  const { data: enrollments, isLoading: enrollmentsLoading } = useMyEnrollments();
  const submit = useSubmitWeeklyReport();
  const { data: form, isPending: formLoading, isLoadingError: formError, refetch: refetchForm } = useWeeklyForm();
  const loadingCourses = catalogLoading || enrollmentsLoading;

  const courses = useMemo(() => {
    const toList = (v: any): any[] => (Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : []);
    const enrolled = toList(enrollments).map((c) => ({
      // enrollment rows: `id` is the enrollment id, the course id is `courseId`
      id: String(c.courseId ?? c.course?.id ?? c.id ?? ""),
      title: String(c.title ?? c.course?.title ?? "Untitled"),
    }));
    const all = toList(catalog).map((c) => ({ id: String(c.id ?? ""), title: String(c.title ?? "Untitled").replace(/\s+/g, " ").trim() }));
    const enrolledIds = new Set(enrolled.map((c) => c.id));
    const seen = new Set<string>();
    const out: { id: string; title: string; enrolled: boolean }[] = [];
    for (const c of [...enrolled, ...all]) {
      if (!c.id || seen.has(c.id)) continue;
      seen.add(c.id);
      out.push({ ...c, enrolled: enrolledIds.has(c.id) });
    }
    return out;
  }, [catalog, enrollments]);
  const enrolledCourses = courses.filter((c) => c.enrolled);
  const otherCourses = courses.filter((c) => !c.enrolled);

  const [courseId, setCourseId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [remarks, setRemarks] = useState("");

  // Pre-select the course being watched, or the only course there is.
  useEffect(() => {
    if (courseId) return;
    if (preselectId && courses.some((c) => c.id === preselectId)) setCourseId(preselectId);
    else if (courses.length === 1) setCourseId(courses[0].id);
  }, [courses, courseId, preselectId]);

  // The member's edits over what they submitted earlier this week.
  const [edits, setEdits] = useState<Record<string, WeeklyAnswer>>({});
  const answers = { ...form?.answers, ...edits };
  const isBlank = (v: WeeklyAnswer | undefined) => v === undefined || (typeof v === "number" ? false : Array.isArray(v) ? v.length === 0 : !v.trim());
  const answered = !!form
    && form.questions.every((q) => !q.required || !isBlank(answers[q.id]))
    && form.questions.some((q) => !isBlank(answers[q.id]));

  const canSubmit = !!courseId && !formLoading && !formError && (form ? answered : feedback.trim().length >= 1);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await submit.mutateAsync(
        form
          ? {
              courseId,
              week: form.week,
              version: form.version,
              answers: Object.fromEntries(form.questions.filter((q) => !isBlank(answers[q.id])).map((q) => [q.id, answers[q.id]])),
            }
          : { courseId, feedback: feedback.trim(), remarks: remarks.trim() || undefined },
      );
      toast.success("Weekly report submitted!");
      onClose();
    } catch (err) {
      // The week may have moved on, or an admin changed the questions while the form was open.
      void refetchForm();
      toast.error((err as Error)?.message || "Failed to submit report. Please try again.");
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
              Weekly Report{form ? ` · Week ${form.week} of ${form.totalWeeks}` : ""}
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
              disabled={submit.isPending || (loadingCourses && courses.length === 0)}
              className="w-full h-10 px-3 text-sm rounded-lg outline-none border text-foreground bg-transparent disabled:opacity-50"
              style={fieldStyle}
            >
              <option value="">{loadingCourses && courses.length === 0 ? "Loading courses…" : "Select a course…"}</option>
              {enrolledCourses.length > 0 && otherCourses.length > 0 ? (
                <>
                  <optgroup label="My courses">
                    {enrolledCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </optgroup>
                  <optgroup label="All courses">
                    {otherCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </optgroup>
                </>
              ) : (
                courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)
              )}
            </select>
            {!loadingCourses && courses.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {catalogError ? (
                  <>Couldn&apos;t load courses. <button type="button" onClick={() => refetch()} className="underline">Try again</button></>
                ) : "No courses available."}
              </p>
            )}
          </div>

          {formLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading questions…</p>
          ) : formError ? (
            <p className="text-sm text-muted-foreground" role="alert">
              Couldn&apos;t load this week&apos;s questions. <button type="button" onClick={() => refetchForm()} className="underline">Try again</button>
            </p>
          ) : form ? (
            <>
              {form.submitted && <p className="text-xs text-muted-foreground">You already submitted this week. You can change your answers.</p>}
              {form.questions.map((q) => (
                <QuestionField
                  key={q.id}
                  q={q}
                  value={answers[q.id]}
                  disabled={submit.isPending}
                  style={fieldStyle}
                  onChange={(v) => setEdits((e) => ({ ...e, [q.id]: v }))}
                />
              ))}
            </>
          ) : (
          <>
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
          </>
          )}
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

"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ChevronDown, Clock } from "lucide-react";
import { usePsychometricAnswers } from "@/lib/hooks/usePsychometric";
import type { ReviewQuestion } from "@/lib/api/services/psychometric.service";

// Profile → Business Psychometric Assessment: a read-only review of the
// member's submitted Psychometric attempt — every question exactly as
// configured, its answer options, its time limit, and the member's saved
// answer. Data comes from GET /api/user/psychometric-assessment/answers.
// Questions stay hidden until the member has submitted, so the timed
// assessment can't be previewed here.

const formatSeconds = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? (r ? `${m} min ${r} sec` : `${m} min`) : `${r} sec`;
};

function QuestionReview({ q, index }: { q: ReviewQuestion; index: number }) {
  const picked = q.answer?.selectedOptionIds ?? [];
  const isRanking = q.questionType === "RANKING";
  const optionText = new Map(q.options.map((o) => [o._id, o.optionText]));
  return (
    <li className="p-4 rounded-xl border border-border space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground leading-snug" lang={q.language}>
          <span className="text-muted-foreground mr-1">{index}.</span>
          {q.text}
        </p>
        {q.timeLimitSeconds != null && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Time limit for this question">
            <Clock size={11} /> {formatSeconds(q.timeLimitSeconds)}
          </span>
        )}
      </div>
      {q.instructionText && <p className="text-xs text-muted-foreground">{q.instructionText}</p>}
      {q.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={q.imageUrl} alt="" className="max-h-48 rounded-lg" />
      )}
      <ul className="space-y-1.5">
        {q.options.map((o) => {
          const selected = picked.includes(o._id);
          return (
            <li
              key={o._id}
              data-selected={selected || undefined}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs"
              style={
                selected && !isRanking
                  ? { borderColor: "var(--color-accent)", background: "color-mix(in srgb, var(--color-accent) 8%, transparent)" }
                  : { borderColor: "var(--color-surface-overlay, rgba(255,255,255,0.1))" }
              }
            >
              {selected && !isRanking && <CheckCircle2 size={13} style={{ color: "var(--color-accent)" }} aria-label="Your answer" />}
              {o.optionImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.optionImageUrl} alt="" className="h-8 rounded" />
              )}
              <span className="text-foreground" lang={q.language}>{o.optionText}</span>
            </li>
          );
        })}
      </ul>
      {isRanking && picked.length > 0 && (
        <div className="text-xs space-y-1">
          <p className="font-semibold text-foreground">Your ranking</p>
          <ol className="list-decimal list-inside text-muted-foreground" lang={q.language}>
            {picked.map((id) => <li key={id}>{optionText.get(id) ?? "—"}</li>)}
          </ol>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        {q.answer == null || q.answer.status === "skipped"
          ? "Not answered"
          : q.answer.status === "timeout"
            ? "Time ran out — not answered"
            : q.answer.timeTakenSeconds != null
              ? `Answered in ${formatSeconds(q.answer.timeTakenSeconds)}`
              : "Answered"}
      </p>
    </li>
  );
}

export function AnswersReview() {
  const { data, isLoading, isError, refetch } = usePsychometricAnswers();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: "var(--color-surface-overlay-md, rgba(255,255,255,0.07))" }} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">Couldn&apos;t load your assessment answers.</p>
        <button
          onClick={() => refetch()}
          className="px-3 py-2 rounded-lg border text-xs font-semibold"
          style={{ borderColor: "var(--color-surface-overlay, rgba(255,255,255,0.1))", color: "var(--color-text-secondary, #a0a0a0)" }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">Your questions and answers appear here after you complete the assessment.</p>
        <Link href="/psychometric" className="shrink-0 inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "var(--color-accent)" }}>
          Take the assessment
        </Link>
      </div>
    );
  }

  const total = data.sections.reduce((n, s) => n + s.questions.length, 0);
  let index = 0;
  return (
    <div className="space-y-4">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center justify-between gap-4 text-left">
        <div>
          <p className="text-sm font-semibold text-foreground">Attempt {data.attemptNumber} · {total} questions</p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.durationMinutes != null && <>Time allowed: {data.durationMinutes} min · </>}
            {data.submittedAt && <>Submitted {new Date(data.submittedAt).toLocaleDateString()}</>}
            {data.autoSubmitted && <> (time ran out)</>}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
          {open ? "Hide answers" : "View answers"}
          <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        </span>
      </button>
      {open && data.sections.map((s) => (
        <section key={s.typeId} className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: s.typeColor || "var(--color-accent)" }}>{s.typeName}</h4>
          <ol className="space-y-3">
            {s.questions.map((q) => <QuestionReview key={q._id} q={q} index={++index} />)}
          </ol>
        </section>
      ))}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Search } from "lucide-react";
import { api, getToken } from "@/lib/psychometric/api";
import { questionTypeBadgeStyle } from "@/lib/psychometric/badges";

// Result detail → the attempt question by question: what the candidate chose,
// the options with their scores, the correct answer (where the question has
// one), and the time taken. Data: GET /admin/results/:id/answers (read-only).

type SheetOption = {
  _id: string; optionText: string; optionImageUrl: string; order: number;
  score: number | null; isCorrect: boolean; selected: boolean; rankGiven: number | null;
};
type SheetQuestion = {
  number: number; questionId: string; exists: boolean; text: string; questionType: string; language: string;
  typeName: string; dimension: string; timeLimitSeconds: number | null; options: SheetOption[]; idealOrder: string[];
  answer: {
    status: "answered" | "skipped" | "timeout" | "not-answered"; selectedOptionIds: string[];
    score: number | null; maxScore: number | null; isCorrect: boolean | null; timeTakenSeconds: number | null; answeredAt: string | null;
  };
};
type Sheet = {
  attempt: {
    attemptNumber: number; status: string; startedAt: string | null; submittedAt: string | null; expiresAt: string | null;
    autoSubmitted: boolean; durationMinutes: number | null; timeUsedSeconds: number | null;
  } | null;
  summary: { questions: number; answered: number; skipped: number; timedOut: number; notAnswered: number };
  questions: SheetQuestion[];
};

const secs = (s: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m ? `${m}m ${r}s` : `${r}s`;
};
const when = (v: string | null) => (v ? new Date(v).toLocaleString() : "—");
const STATUS_LABEL: Record<SheetQuestion["answer"]["status"], string> = {
  answered: "Answered", skipped: "Skipped", timeout: "Time ran out", "not-answered": "Not answered",
};
type Filter = "all" | "answered" | "unanswered" | "correct" | "wrong";

export default function AnswerSheet({ resultId }: { resultId: string }) {
  const token = getToken();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setState("loading");
    const { ok, data } = await api.get<{ data: Sheet; message?: string }>(`/admin/results/${resultId}/answers`, token);
    if (!ok) { setError(data?.message || "Couldn't load the answers."); setState("error"); return; }
    setSheet(data.data);
    setState("ready");
  }, [resultId, token]);

  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sheet?.questions ?? []).filter((x) => {
      if (q && !`${x.text} ${x.typeName} ${x.dimension} ${x.options.map((o) => o.optionText).join(" ")}`.toLowerCase().includes(q)) return false;
      if (filter === "answered") return x.answer.status === "answered";
      if (filter === "unanswered") return x.answer.status !== "answered";
      if (filter === "correct") return x.answer.isCorrect === true;
      if (filter === "wrong") return x.answer.isCorrect === false;
      return true;
    });
  }, [sheet, query, filter]);

  return (
    <div className="card" data-testid="answer-sheet">
      <h3 className="font-bold text-lg mb-3" style={{ color: "var(--tbt-primary)" }}>Answers</h3>

      {state === "loading" && <div className="py-8"><div className="spinner mx-auto" /></div>}

      {state === "error" && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm" style={{ color: "var(--tbt-danger)" }}>{error}</p>
          <button className="btn btn-outline btn-sm" onClick={() => void load()}>Retry</button>
        </div>
      )}

      {state === "ready" && sheet && (
        <>
          {sheet.attempt ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4" style={{ color: "var(--tbt-muted)" }}>
              <div><span className="font-semibold" style={{ color: "var(--tbt-text)" }}>Attempt</span><br />#{sheet.attempt.attemptNumber} · {sheet.attempt.status}{sheet.attempt.autoSubmitted ? " (auto-submitted)" : ""}</div>
              <div><span className="font-semibold" style={{ color: "var(--tbt-text)" }}>Started</span><br />{when(sheet.attempt.startedAt)}</div>
              <div><span className="font-semibold" style={{ color: "var(--tbt-text)" }}>Submitted</span><br />{when(sheet.attempt.submittedAt)}</div>
              <div><span className="font-semibold" style={{ color: "var(--tbt-text)" }}>Time used / allowed</span><br />{secs(sheet.attempt.timeUsedSeconds)} / {sheet.attempt.durationMinutes != null ? `${sheet.attempt.durationMinutes} min` : "—"}</div>
            </div>
          ) : (
            <p className="text-sm mb-4" style={{ color: "var(--tbt-muted)" }}>
              The attempt behind this result is no longer stored (its candidate was deleted), so its individual answers can&apos;t be shown.
            </p>
          )}

          {sheet.questions.length > 0 && (
            <>
              <p className="text-xs mb-3" style={{ color: "var(--tbt-muted)" }}>
                {sheet.summary.questions} questions · {sheet.summary.answered} answered · {sheet.summary.skipped} skipped · {sheet.summary.timedOut} timed out · {sheet.summary.notAnswered} not answered
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--tbt-muted)" }} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search questions or options"
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-sm"
                    style={{ border: "1px solid var(--tbt-border)", background: "transparent", color: "var(--tbt-text)" }}
                  />
                </div>
                <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="px-3 py-2 rounded-lg text-sm"
                  style={{ border: "1px solid var(--tbt-border)", background: "transparent", color: "var(--tbt-text)" }}>
                  <option value="all">All questions</option>
                  <option value="answered">Answered</option>
                  <option value="unanswered">Skipped / not answered</option>
                  <option value="correct">Correct</option>
                  <option value="wrong">Wrong</option>
                </select>
              </div>
            </>
          )}

          {sheet.attempt && sheet.questions.length === 0 && (
            <p className="text-sm" style={{ color: "var(--tbt-muted)" }}>No answers were recorded for this attempt.</p>
          )}
          {sheet.questions.length > 0 && shown.length === 0 && (
            <p className="text-sm" style={{ color: "var(--tbt-muted)" }}>No questions match this search.</p>
          )}

          <ol className="space-y-3">
            {shown.map((x) => (
              <li key={x.questionId} className="rounded-lg p-4" style={{ border: "1px solid var(--tbt-border)" }} data-testid="answer-row">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="text-sm font-semibold" lang={x.language} style={{ color: "var(--tbt-text)" }}>
                    <span style={{ color: "var(--tbt-muted)" }}>Q{x.number}. </span>
                    {x.exists ? x.text : <em style={{ color: "var(--tbt-muted)" }}>Question deleted after this attempt</em>}
                  </p>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--tbt-muted)" }}>
                    {x.questionType && <span className="badge" style={{ ...questionTypeBadgeStyle(x.questionType), color: "#fff" }}>{x.questionType.replace(/_/g, " ")}</span>}
                    {x.typeName && <span>{x.typeName}</span>}
                    {x.timeLimitSeconds != null && <span className="inline-flex items-center gap-1"><Clock size={11} />{secs(x.timeLimitSeconds)}</span>}
                  </div>
                </div>

                {x.options.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {x.options.map((o) => {
                      const picked = o.selected || o.rankGiven != null;
                      return (
                        <li key={o._id} data-selected={picked || undefined} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                          style={{
                            border: `1px solid ${picked ? "var(--tbt-primary)" : "var(--tbt-border)"}`,
                            background: picked ? "rgba(203,20,23,0.06)" : "transparent",
                          }}>
                          {o.rankGiven != null && <span className="font-bold" style={{ color: "var(--tbt-primary)" }}>#{o.rankGiven}</span>}
                          <span className="flex-1" lang={x.language} style={{ color: "var(--tbt-text)" }}>{o.optionText}</span>
                          {o.isCorrect && <span className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--tbt-success, #059669)" }}><CheckCircle2 size={12} />Correct</span>}
                          {o.score != null && <span style={{ color: "var(--tbt-muted)" }}>{o.score} pts</span>}
                          {o.selected && <span className="font-semibold" style={{ color: "var(--tbt-primary)" }}>Chosen</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {x.idealOrder.length > 0 && (
                  <p className="text-[11px] mt-2" style={{ color: "var(--tbt-muted)" }}>
                    Ideal order: {x.idealOrder.map((id, i) => `${i + 1}. ${x.options.find((o) => o._id === id)?.optionText ?? "—"}`).join("  ")}
                  </p>
                )}

                <p className="text-[11px] mt-2" style={{ color: "var(--tbt-muted)" }}>
                  {STATUS_LABEL[x.answer.status]}
                  {x.answer.score != null && <> · Score {x.answer.score}{x.answer.maxScore != null ? `/${x.answer.maxScore}` : ""}</>}
                  {x.answer.isCorrect != null && <> · {x.answer.isCorrect ? "Correct" : "Wrong"}</>}
                  {x.answer.timeTakenSeconds != null && <> · Time taken {secs(x.answer.timeTakenSeconds)}</>}
                  {x.answer.answeredAt && <> · {when(x.answer.answeredAt)}</>}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Loader2, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  useSaveWeeklyQuestions,
  useWeeklyQuestions,
  type QuestionType,
  type WeekForm,
  type WeeklyQuestion,
} from "@/lib/hooks/useWeeklyQuestions";

const CARD = "bg-[#181818] border border-[#2a2a2a] rounded-xl p-5";
const LABEL = "text-[11px] font-bold uppercase tracking-widest text-[#a0a0a0] font-rajdhani";
const INPUT = "bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626]";
const BTN = "h-10 px-4 inline-flex items-center gap-1.5 rounded-lg border border-[#333] text-sm text-[#f0f0f0] hover:border-[#dc2626] disabled:opacity-40";
const ICON_BTN = "h-9 w-9 grid place-items-center rounded-lg text-[#a0a0a0] hover:text-white hover:bg-[#222] disabled:opacity-30";

const TYPES: Array<[QuestionType, string]> = [
  ["short_text", "Short answer"],
  ["long_text", "Long answer"],
  ["number", "Number"],
  ["rating", "Rating 1 to 10"],
  ["yes_no", "Yes / No"],
  ["single_choice", "Choose one"],
  ["multi_choice", "Choose many"],
  ["date", "Date"],
];
const isChoice = (t: QuestionType) => t === "single_choice" || t === "multi_choice";
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const blank = (): WeeklyQuestion => ({ id: newId(), question: "", help: "", type: "short_text", required: true, options: [] });

const errorText = (e: any) => e?.response?.data?.error?.message || e?.error?.message || e?.message || "That didn't work. Please try again.";
const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" });
const weekText = (w: number) => (w < 1 ? "Not started" : w > 18 ? "18 weeks finished" : `Week ${w} of 18`);

function problem(qs: WeeklyQuestion[]): string | null {
  for (const [i, q] of qs.entries()) {
    if (!q.question.trim()) return `Question ${i + 1} has no text.`;
    if (!isChoice(q.type)) continue;
    const opts = q.options.map((o) => o.trim());
    if (opts.some((o) => !o)) return `Question ${i + 1} has an empty option.`;
    if (opts.length < 2) return `Question ${i + 1} needs at least 2 options.`;
    if (new Set(opts).size !== opts.length) return `Question ${i + 1} has the same option twice.`;
  }
  return null;
}

// ── Editor for one week ──────────────────────────────────────────────

function WeekEditor({ form, weeks, onDirty }: { form: WeekForm; weeks: WeekForm[]; onDirty: (d: boolean) => void }) {
  const [list, setList] = useState<WeeklyQuestion[]>(form.questions);
  // What the server has for this week; moves forward on save.
  const [base, setBase] = useState(form);
  const save = useSaveWeeklyQuestions();
  const dirty = JSON.stringify(list) !== JSON.stringify(base.questions);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  const patch = (i: number, p: Partial<WeeklyQuestion>) => setList((l) => l.map((q, n) => (n === i ? { ...q, ...p } : q)));
  const move = (i: number, by: number) =>
    setList((l) => {
      const next = [...l];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
  const sources = weeks.filter((w) => w.week !== form.week && w.questions.length > 0);

  const submit = async () => {
    const why = problem(list);
    if (why) return void toast.error(why);
    try {
      const clean = list.map((q) => ({ ...q, options: isChoice(q.type) ? q.options : [] }));
      const saved = await save.mutateAsync({ week: form.week, version: base.version, questions: clean });
      setBase(saved);
      setList(saved.questions);
      toast.success(`Week ${form.week} saved`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <section className={CARD} aria-label={`Week ${form.week} questions`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wide">Week {form.week} questions</h2>
        {sources.length > 0 && (
          <select
            value=""
            aria-label="Copy questions from another week"
            onChange={(e) => {
              const from = sources.find((w) => w.week === Number(e.target.value));
              if (from) setList((l) => [...l, ...from.questions.map((q) => ({ ...q, id: newId() }))].slice(0, 30));
            }}
            className={`${INPUT} h-10 text-sm`}
          >
            <option value="">Copy from a week…</option>
            {sources.map((w) => <option key={w.week} value={w.week}>Week {w.week} ({w.questions.length})</option>)}
          </select>
        )}
      </div>

      {list.length === 0 && (
        <p className="mt-4 text-sm text-[#a0a0a0]">No questions for this week. Members get the usual free-text report until you add one.</p>
      )}

      <ol className="mt-4 space-y-4">
        {list.map((q, i) => (
          <li key={q.id} className="rounded-lg border border-[#2a2a2a] bg-[#141414] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className={LABEL}>Question {i + 1}</span>
              <div className="flex">
                <button type="button" className={ICON_BTN} aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
                <button type="button" className={ICON_BTN} aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
                <button type="button" className={ICON_BTN} aria-label="Duplicate" disabled={list.length >= 30} onClick={() => setList((l) => [...l.slice(0, i + 1), { ...q, id: newId() }, ...l.slice(i + 1)])}><Copy size={16} /></button>
                <button type="button" className={ICON_BTN} aria-label="Delete question" onClick={() => setList((l) => l.filter((_, n) => n !== i))}><Trash2 size={16} /></button>
              </div>
            </div>
            <input value={q.question} maxLength={300} onChange={(e) => patch(i, { question: e.target.value })} placeholder="Type the question" aria-label={`Question ${i + 1} text`} className={`${INPUT} mt-2 w-full`} />
            <input value={q.help} maxLength={300} onChange={(e) => patch(i, { help: e.target.value })} placeholder="Hint for the member (optional)" aria-label={`Question ${i + 1} hint`} className={`${INPUT} mt-2 w-full text-sm`} />
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <select
                value={q.type}
                aria-label={`Question ${i + 1} answer type`}
                onChange={(e) => {
                  const type = e.target.value as QuestionType;
                  patch(i, { type, options: isChoice(type) && q.options.length === 0 ? ["", ""] : q.options });
                }}
                className={INPUT}
              >
                {TYPES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-[#f0f0f0]">
                <input type="checkbox" checked={q.required} onChange={(e) => patch(i, { required: e.target.checked })} className="h-4 w-4 accent-[#dc2626]" />
                Required
              </label>
            </div>
            {isChoice(q.type) && (
              <div className="mt-3 space-y-2">
                {q.options.map((o, n) => (
                  <div key={n} className="flex gap-2">
                    <input value={o} maxLength={120} placeholder={`Option ${n + 1}`} aria-label={`Question ${i + 1} option ${n + 1}`} onChange={(e) => patch(i, { options: q.options.map((x, k) => (k === n ? e.target.value : x)) })} className={`${INPUT} h-10 min-w-0 flex-1 max-w-md text-sm`} />
                    <button type="button" className={ICON_BTN} aria-label={`Remove option ${n + 1}`} onClick={() => patch(i, { options: q.options.filter((_, k) => k !== n) })}><X size={16} /></button>
                  </div>
                ))}
                {q.options.length < 20 && (
                  <button type="button" className={BTN} onClick={() => patch(i, { options: [...q.options, ""] })}><Plus size={14} /> Add option</button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className={BTN} disabled={list.length >= 30} onClick={() => setList((l) => [...l, blank()])}><Plus size={14} /> Add question</button>
        {dirty && (
          <>
            <button type="button" disabled={save.isPending} onClick={submit} className="h-10 px-5 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white font-semibold disabled:opacity-40">
              {save.isPending ? "Saving…" : `Save week ${form.week}`}
            </button>
            <button type="button" disabled={save.isPending} onClick={() => setList(base.questions)} className="h-10 px-3 text-sm text-[#a0a0a0] hover:text-white">Discard changes</button>
          </>
        )}
      </div>
    </section>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────

export function WeeklyQuestionsTab({ dirty, setDirty }: { dirty: boolean; setDirty: (d: boolean) => void }) {
  const { data, isLoading, error } = useWeeklyQuestions();
  const [week, setWeek] = useState(1);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const open = (w: number) => {
    if (w === week || (dirty && !window.confirm(`Week ${week} has unsaved changes. Leave without saving?`))) return;
    setDirty(false);
    setWeek(w);
  };

  if (isLoading) return <div className={`${CARD} flex items-center gap-2 text-[#a0a0a0]`}><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  if (!data) return <div className={`${CARD} text-[#a0a0a0]`} role="alert">{errorText(error)}</div>;

  return (
    <div className="max-w-5xl space-y-5">
      <p className="text-sm text-[#a0a0a0]">Members answer these questions in their weekly report. Their answers come to Weekly Feedback. Each batch counts its weeks from its own start date.</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-9">
        {data.weeks.map((w) => (
          <button key={w.week} type="button" aria-pressed={week === w.week} onClick={() => open(w.week)} className={`rounded-lg border px-2 py-2.5 text-center transition-colors ${week === w.week ? "border-[#dc2626] bg-[#dc2626]/10" : "border-[#2a2a2a] bg-[#181818] hover:border-[#444]"}`}>
            <span className="block text-sm font-semibold text-[#f0f0f0]">Week {w.week}</span>
            <span className={`text-xs ${w.questions.length ? "text-green-400" : "text-[#a0a0a0]"}`}>{w.questions.length ? `${w.questions.length} question${w.questions.length === 1 ? "" : "s"}` : "Empty"}</span>
          </button>
        ))}
      </div>

      <WeekEditor key={week} form={data.weeks[week - 1]} weeks={data.weeks} onDirty={setDirty} />

      <section className={CARD}>
        <h2 className={LABEL}>Batches now</h2>
        {data.batches.length === 0 ? (
          <p className="mt-3 text-sm text-[#a0a0a0]">No active batches.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.batches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-[#1a1a1a] px-4 py-2.5 text-sm">
                <span className="min-w-0 break-words text-[#f0f0f0]">{b.name}</span>
                <span className="text-[#a0a0a0]">Starts {istDate(b.startsAt)} · {b.members} active member{b.members === 1 ? "" : "s"} · <span className="text-[#f0f0f0]">{weekText(b.week)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

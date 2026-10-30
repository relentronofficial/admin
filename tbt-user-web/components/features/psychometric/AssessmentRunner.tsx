"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Bookmark, ChevronLeft, ChevronRight, Clock, Square, Volume2, Pause, RotateCcw, Loader2 } from "lucide-react";
import { psychometricService } from "@/lib/api/services/psychometric.service";
import { psychometricKeys } from "@/lib/hooks/usePsychometric";
import {
  buildAnswerPayload,
  buildRenderUnits,
  buildSideModel,
  canLeaveUnit,
  formatClock,
  isAnswered,
  isResolved,
  readAutosave,
  timerTone,
  unitQuestions,
  writeAutosave,
  type AssessmentQuestion,
  type AssessmentSection,
  type Answers,
  type RenderUnit,
} from "@/lib/psychometric/assessmentFlow";
import { useQuestionAudio, type QuestionAudio } from "./questionAudio";
import s from "./assessment.module.css";

// The Psychometric assessment, ported from the former standalone candidate
// page. All flow rules live in lib/psychometric/assessmentFlow.ts; audio in
// ./questionAudio.ts. The member signs in with their TBT login — no access
// code or Psychometric account.

type Loaded = { sections: AssessmentSection[]; sessionId: string; deadline: number };

const storage = () => (typeof window === "undefined" ? null : window.localStorage);

export function AssessmentRunner() {
  const router = useRouter();
  const qc = useQueryClient();
  const player = useQuestionAudio();

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [timedOut, setTimedOut] = useState<Record<string, boolean>>({});
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState(0);
  const [visit, setVisit] = useState(0); // bumps on every page open, so re-opening a page restarts its question timer
  const [now, setNow] = useState(() => Date.now());
  const [qDeadline, setQDeadline] = useState<{ qid: string; at: number } | null>(null);
  const [unansweredMsg, setUnansweredMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const startTimes = useRef<Record<string, number>>({});
  const submittedRef = useRef(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // ── load: questions → resume or start → (re)load the attempt's frozen questions ──
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      let q = await psychometricService.questions();
      if (!q.session) {
        const started = await psychometricService.start();
        if (!started.resumed) q = await psychometricService.questions();
        if (!q.session) q = { ...q, session: { sessionId: started.sessionId, expiresAt: started.expiresAt } };
      }
      const sessionId = q.session!.sessionId;
      const saved = readAutosave(storage(), sessionId);
      setAnswers(saved.answers ?? {});
      setTimedOut(saved.timedOut ?? {});
      setTimeSpent(saved.timeSpent ?? {});
      setMarked(new Set(saved.marked ?? []));
      const t0 = Date.now();
      setNow(t0);
      setLoaded({ sections: q.data, sessionId, deadline: t0 + q.remainingSeconds * 1000 });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "You have already completed this assessment.") { router.replace("/psychometric/result"); return; }
      setLoadError(msg || "Couldn't load your questions. Please check your connection.");
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const units = useMemo<RenderUnit[]>(() => (loaded ? buildRenderUnits(loaded.sections) : []), [loaded]);
  const all = useMemo<AssessmentQuestion[]>(() => (loaded ? loaded.sections.flatMap((x) => x.questions) : []), [loaded]);
  const cats = useMemo(() => buildSideModel(units), [units]);

  useEffect(() => { if (player) player.setQuestions(all); }, [player, all]);

  // ── autosave on every change ────────────────────────────────────────────
  useEffect(() => {
    if (loaded) writeAutosave(storage(), loaded.sessionId, { answers, timedOut, timeSpent, marked: [...marked] });
  }, [loaded, answers, timedOut, timeSpent, marked]);

  // ── clock ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const markTimeSpent = useCallback((qid: string) => {
    const start = startTimes.current[qid];
    if (start) setTimeSpent((t) => ({ ...t, [qid]: Math.round((Date.now() - start) / 1000) }));
  }, []);

  const submit = useCallback(async (auto: boolean) => {
    if (!loaded || submittedRef.current) return;
    setQDeadline(null);
    player?.stopAll();
    player?.bumpToken();
    const unresolved = all.filter((q) => !isResolved(q, answers, timedOut)).length;
    if (!auto && unresolved) {
      setUnansweredMsg(`⚠️ ${unresolved} question(s) unanswered. Please answer all questions before submitting.`);
      return;
    }
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await psychometricService.submit(loaded.sessionId, buildAnswerPayload(all, answers, timedOut, timeSpent));
      try { storage()?.removeItem(`tbt_psy_answers_${loaded.sessionId}`); } catch { /* ignore */ }
      await qc.invalidateQueries({ queryKey: psychometricKeys.result });
      router.replace("/psychometric/result");
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      toast.error((e as Error).message || "Submission failed.");
    }
  }, [loaded, player, all, answers, timedOut, timeSpent, qc, router]);

  // Global timer: auto-submit (possibly partial) when it runs out.
  const secondsLeft = loaded ? Math.max(0, Math.ceil((loaded.deadline - now) / 1000)) : 0;
  useEffect(() => { if (loaded && secondsLeft === 0) void submit(true); }, [loaded, secondsLeft, submit]);

  // ── navigation ──────────────────────────────────────────────────────────
  const showSection = useCallback((idx: number) => {
    const unit = units[idx];
    if (!unit) return;
    setCurrent(idx);
    setVisit((v) => v + 1);
    setQDeadline(null);
    setUnansweredMsg("");
    player?.stopAll();
    player?.bumpToken();
    const qs = unitQuestions(unit);
    player?.prefetch(qs);
    // Time-to-answer counts from when a question is first shown.
    for (const q of qs) if (!startTimes.current[q._id]) startTimes.current[q._id] = Date.now();
    // A ranking question starts answered with its shown order; reordering is optional.
    if (unit.kind === "ranking") setAnswers((a) => (a[unit.question._id] ? a : { ...a, [unit.question._id]: unit.question.options.map((o) => o._id) }));
    setSideOpen(false);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => sectionRef.current?.focus({ preventScroll: true }));
  }, [units, player]);

  // Open the first page once loaded.
  useEffect(() => { if (units.length) showSection(0); }, [units, showSection]);

  // Per-question timer for a timed single question that isn't answered / timed out yet.
  const unit = units[current];
  useEffect(() => {
    if (!unit || unit.kind !== "single") return;
    const q = unit.question;
    if (q.timeLimitSeconds && !answers[q._id] && !timedOut[q._id]) setQDeadline((d) => (d?.qid === q._id ? d : { qid: q._id, at: Date.now() + q.timeLimitSeconds! * 1000 }));
    // answers/timedOut intentionally read only when the page opens (showSection resets qDeadline)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, visit]);

  const qSecondsLeft = qDeadline ? Math.max(0, Math.ceil((qDeadline.at - now) / 1000)) : null;
  useEffect(() => {
    if (!qDeadline || qSecondsLeft !== 0) return;
    const qid = qDeadline.qid;
    setQDeadline(null);
    setTimedOut((t) => ({ ...t, [qid]: true }));
    markTimeSpent(qid);
    if (current < units.length - 1) showSection(current + 1);
  }, [qDeadline, qSecondsLeft, current, units.length, showSection, markTimeSpent]);

  // ── answering ───────────────────────────────────────────────────────────
  const recordAnswer = (qid: string, optId: string) => {
    setAnswers((a) => ({ ...a, [qid]: optId }));
    markTimeSpent(qid);
    if (qDeadline?.qid === qid) setQDeadline(null); // answered — the timer's job is done
  };
  const toggleMulti = (qid: string, optId: string, checked: boolean) => {
    setAnswers((a) => {
      const set = new Set((a[qid] as string[] | undefined) ?? []);
      if (checked) set.add(optId); else set.delete(optId);
      return { ...a, [qid]: [...set] };
    });
    markTimeSpent(qid);
  };
  const moveRanking = (qid: string, idx: number, dir: -1 | 1) => {
    setAnswers((a) => {
      const order = [...((a[qid] as string[] | undefined) ?? [])];
      const j = idx + dir;
      if (j < 0 || j >= order.length) return a;
      [order[idx], order[j]] = [order[j], order[idx]];
      return { ...a, [qid]: order };
    });
    markTimeSpent(qid);
  };
  const toggleReview = (ui: number) => setMarked((m) => { const n = new Set(m); if (n.has(ui)) n.delete(ui); else n.add(ui); return n; });

  const next = () => {
    if (!unit || current >= units.length - 1) return;
    if (!canLeaveUnit(unit, answers, timedOut)) { toast.error("Please select an answer before continuing."); return; }
    showSection(current + 1);
  };

  // ── render ──────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className={s.root}>
        <div className={s.center}>
          <p className="mb-4" style={{ color: "var(--color-accent)" }}>{loadError}</p>
          <div className="flex justify-center gap-3">
            <button className={`${s.fbtn} ${s.fbtnNext}`} onClick={() => void load()}>Retry</button>
            <Link href="/psychometric" className={`${s.fbtn} ${s.fbtnPrev}`}>Back</Link>
          </div>
        </div>
      </div>
    );
  }
  if (!loaded || !unit) {
    return (
      <div className={s.root}>
        <div className={s.center} role="status">
          <Loader2 className="mx-auto mb-4 animate-spin" size={32} style={{ color: "var(--color-accent)" }} />
          <p style={{ color: "var(--color-text-subtle)" }}>Loading questions…</p>
        </div>
      </div>
    );
  }

  const answeredCount = all.filter((q) => isAnswered(q, answers)).length;
  const firstQ = unitQuestions(unit)[0];
  const position = all.indexOf(firstQ) + 1;
  const last = current === units.length - 1;
  const tone = timerTone(secondsLeft);
  const curCat = cats.find((c) => c.units.includes(current));

  return (
    <div className={s.root}>
      <header className={s.head}>
        <div className={s.headIn}>
          <div>
            <div className={s.brandT}>Tamil <span>Business</span> Tribe</div>
            <div className={s.brandS}>Discover Your Business DNA</div>
          </div>
          <div className={s.hMid}>
            <div className={s.hCount}>
              <b>{position}</b><span className={s.m}> / {all.length}</span>
              <small>Questions Completed</small>
            </div>
            <div className={s.bar}><i style={{ width: `${all.length ? (answeredCount / all.length) * 100 : 0}%` }} /></div>
          </div>
          <div className={s.hTimer}>
            <Clock size={17} aria-hidden />
            <div>
              <div className={`${s.tv} ${tone === "danger" ? s.tvDanger : tone === "warning" ? s.tvWarning : ""}`} role="timer">{formatClock(secondsLeft)}</div>
              <div className={s.tl}>Time Remaining</div>
            </div>
          </div>
        </div>
      </header>

      <div className={s.body}>
        <button type="button" className={s.sideToggle} onClick={() => setSideOpen((o) => !o)} aria-expanded={sideOpen}>
          <span>Assessment Progress</span><span aria-hidden>{sideOpen ? "▴" : "▾"}</span>
        </button>
        <aside className={`${s.side} ${sideOpen ? "" : s.sideCollapsed}`} aria-label="Assessment overview">
          <div className={s.sideH}>Assessment Progress</div>
          <div className={s.sideBar}><i style={{ width: `${all.length ? (answeredCount / all.length) * 100 : 0}%` }} /></div>
          <div className={s.sideSub}>{answeredCount} of {all.length} Questions</div>
          <div className={s.sideDiv} />
          <div className={s.sideCap}>Current Section</div>
          {curCat && (
            <div className={s.sideCur}>
              <span>{curCat.icon}</span>
              <div className={s.wrapText}><div className={s.t}>{curCat.name}</div><div className={s.s}>Questions {curCat.start}–{curCat.end}</div></div>
            </div>
          )}
          <div className={s.sideCap}>Assessment Sections</div>
          {cats.map((c, ci) => {
            const active = c === curCat;
            const done = c.units.flatMap((ui) => unitQuestions(units[ui])).every((q) => isAnswered(q, answers));
            return (
              <button key={c.name} type="button" className={`${s.dim} ${active ? s.dimActive : ""} ${done && !active ? s.dimDone : ""}`} onClick={() => showSection(c.first)}>
                <span className={s.dimN}>{ci + 1}</span><span className={`${s.dimName} ${s.wrapText}`}>{c.name}</span>
              </button>
            );
          })}
        </aside>

        <main className="min-w-0" ref={sectionRef} tabIndex={-1} style={{ outline: "none" }}>
          <UnitCard
            unit={unit}
            ui={current}
            position={position}
            total={all.length}
            range={curCat ? (curCat.start === curCat.end ? `Question ${curCat.start} of ${all.length}` : `Questions ${curCat.start}–${curCat.end} of ${all.length}`) : ""}
            marked={marked.has(current)}
            onToggleReview={() => toggleReview(current)}
            answers={answers}
            timedOut={timedOut}
            qSecondsLeft={qDeadline && unit.kind === "single" && qDeadline.qid === unit.question._id ? qSecondsLeft : null}
            player={player}
            onAnswer={recordAnswer}
            onToggleMulti={toggleMulti}
            onMoveRanking={moveRanking}
          />
        </main>
      </div>

      <div className={s.foot}>
        {unansweredMsg && <p className={s.unanswered} role="alert">{unansweredMsg}</p>}
        <div className={s.footIn}>
          <button type="button" className={`${s.fbtn} ${s.fbtnPrev}`} disabled={current === 0 || submitting} onClick={() => showSection(current - 1)}>
            <ChevronLeft size={17} /><span className={s.hideSm}>Previous</span>
          </button>
          <button type="button" className={`${s.fbtn} ${s.fbtnReview} ${marked.has(current) ? s.fbtnReviewOn : ""}`} aria-pressed={marked.has(current)} onClick={() => toggleReview(current)}>
            <Bookmark size={17} fill={marked.has(current) ? "currentColor" : "none"} /><span><span className={s.hideSm}>Mark for </span>Review</span>
          </button>
          {last ? (
            <button type="button" className={`${s.fbtn} ${s.fbtnNext}`} disabled={submitting} onClick={() => void submit(false)}>
              {submitting ? "Submitting…" : "Submit Assessment"}
            </button>
          ) : (
            <button type="button" className={`${s.fbtn} ${s.fbtnNext}`} onClick={next}>
              <span>Save &amp; Continue</span><ChevronRight size={17} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── one page ─────────────────────────────────────────────────────────────

interface UnitCardProps {
  unit: RenderUnit;
  ui: number;
  position: number;
  total: number;
  range: string;
  marked: boolean;
  onToggleReview: () => void;
  answers: Answers;
  timedOut: Record<string, boolean>;
  qSecondsLeft: number | null;
  player: QuestionAudio | null;
  onAnswer: (qid: string, optId: string) => void;
  onToggleMulti: (qid: string, optId: string, checked: boolean) => void;
  onMoveRanking: (qid: string, idx: number, dir: -1 | 1) => void;
}

function UnitCard(p: UnitCardProps) {
  const { unit } = p;
  return (
    <div className={s.card}>
      <div className={s.cHead}>
        <div className={s.cHeadL}>
          <div className={s.num}>{p.position}</div>
          <div className={s.wrapText}>
            <div className={s.cat}>{unit.typeName || "Question"}</div>
            <div className={s.range}>{p.range}</div>
          </div>
        </div>
        <button type="button" className={`${s.bm} ${p.marked ? s.bmOn : ""}`} onClick={p.onToggleReview} aria-label="Mark this section for review" aria-pressed={p.marked}>
          <Bookmark size={22} fill={p.marked ? "currentColor" : "none"} />
        </button>
      </div>

      {unit.kind === "batch" ? (
        unit.questions.map((q) => (
          <div key={q._id}>
            <p className={`${s.text} ${s.wrapText}`}>{q.text}</p>
            <AudioControls q={q} player={p.player} />
            <Options q={q} {...p} />
          </div>
        ))
      ) : (
        <div>
          {p.qSecondsLeft != null && <div className={s.qTimer}>{formatClock(p.qSecondsLeft)} left</div>}
          {unit.question.instructionText && <p className={`${s.instr} ${s.wrapText}`}>{unit.question.instructionText}</p>}
          {unit.question.imageUrl && unit.kind !== "ranking" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={unit.question.imageUrl} alt="Assessment question image" className={s.img} />
          )}
          <p className={`${s.text} ${s.wrapText}`}>{unit.question.text}</p>
          {unit.kind === "multiselect" && <p className={s.hint}>Select all that apply.</p>}
          {unit.kind === "ranking" && <p className={s.hint}>Use the arrows to arrange in your preferred order (top = first).</p>}
          <AudioControls q={unit.question} player={p.player} />
          {unit.kind === "ranking" ? <Ranking q={unit.question} {...p} /> : <Options q={unit.question} {...p} multi={unit.kind === "multiselect"} />}
        </div>
      )}
    </div>
  );
}

function Options({ q, answers, timedOut, onAnswer, onToggleMulti, multi = false }: UnitCardProps & { q: AssessmentQuestion; multi?: boolean }) {
  const selected = multi ? new Set((answers[q._id] as string[] | undefined) ?? []) : null;
  const disabled = !!timedOut[q._id];
  return (
    <div>
      {q.options.map((o) => {
        const id = `opt_${o._id}`;
        const checked = multi ? selected!.has(o._id) : answers[q._id] === o._id;
        return (
          <div className={s.opt} key={o._id}>
            <input
              type={multi ? "checkbox" : "radio"}
              name={`q_${q._id}`}
              id={id}
              checked={checked}
              disabled={disabled}
              onChange={(e) => (multi ? onToggleMulti(q._id, o._id, e.target.checked) : onAnswer(q._id, o._id))}
            />
            <label htmlFor={id}><span className={`${s.ind} ${multi ? s.indSq : ""}`} /><span className={s.wrapText}>{o.optionText}</span></label>
          </div>
        );
      })}
    </div>
  );
}

function Ranking({ q, answers, onMoveRanking }: UnitCardProps & { q: AssessmentQuestion }) {
  const order = (answers[q._id] as string[] | undefined) ?? q.options.map((o) => o._id);
  const byId = Object.fromEntries(q.options.map((o) => [o._id, o]));
  return (
    <div>
      {order.map((optId, i) => (
        <div className={s.rk} key={optId}>
          <span className={s.rkN}>{i + 1}</span>
          <span className={s.wrapText} style={{ flex: 1, fontSize: 15 }}>{byId[optId]?.optionText}</span>
          <div className="flex flex-col gap-1 shrink-0">
            <button type="button" aria-label="Move up" className={s.rkBtn} disabled={i === 0} onClick={() => onMoveRanking(q._id, i, -1)}>▲</button>
            <button type="button" aria-label="Move down" className={s.rkBtn} disabled={i === order.length - 1} onClick={() => onMoveRanking(q._id, i, 1)}>▼</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const BUTTON_LABEL = { play: "Play Question", pause: "Pause", resume: "Resume", replay: "Replay", loading: "Loading…" } as const;

function AudioControls({ q, player }: { q: AssessmentQuestion; player: QuestionAudio | null }) {
  if (!player) return null;
  const state = player.buttonOf(q._id);
  const error = player.errorOf(q._id);
  const Icon = state === "pause" ? Pause : state === "replay" ? RotateCcw : state === "loading" ? Loader2 : Volume2;
  return (
    <div className={s.audio}>
      <button type="button" className={`${s.abtn} ${s.abtnPlay}`} onClick={() => player.toggle(q._id)} aria-label={`${BUTTON_LABEL[state]} — question audio`}>
        <Icon size={15} className={state === "loading" ? "animate-spin" : undefined} /><span>{BUTTON_LABEL[state]}</span>
      </button>
      <button type="button" className={`${s.abtn} ${s.abtnStop}`} onClick={() => player.stop(q._id)} aria-label="Stop audio">
        <Square size={15} /><span>Stop</span>
      </button>
      {error && <span className={s.aError} role="alert">{error}</span>}
    </div>
  );
}

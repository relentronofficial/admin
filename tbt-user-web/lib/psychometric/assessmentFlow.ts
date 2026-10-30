/**
 * Psychometric assessment flow rules, ported from the former standalone
 * candidate page (frontend/user/assessment.html). Pure — the React page
 * (components/features/psychometric/AssessmentRunner.tsx) only renders state.
 */

export type QuestionType =
  | "LIKERT_SCALE" | "SITUATIONAL" | "NUMERICAL_ABILITY" | "PERCENTAGE_TYPE" | "PUZZLE_TYPE"
  | "LOGICAL_ABILITY" | "VERBAL_ABILITY" | "IMAGE_BASED" | "MULTI_SELECT" | "RANKING";

export interface AssessmentOption {
  _id: string;
  optionText: string;
  optionImageUrl?: string;
  order: number;
}

export interface AssessmentQuestion {
  _id: string;
  text: string;
  order: number;
  language: "en" | "ta";
  questionType: QuestionType;
  dimension: string;
  difficulty?: string;
  timeLimitSeconds?: number | null;
  imageUrl?: string;
  instructionText?: string;
  explanationAudioText?: string;
  explanationIsTanglish?: boolean;
  neuralExplanationAudio?: boolean;
  hasAudio?: boolean;
  audioUrl?: string;
  neuralAudio?: boolean;
  options: AssessmentOption[];
}

export interface AssessmentSection {
  typeId: string;
  typeName: string;
  typeIcon?: string;
  typeColor?: string;
  questions: AssessmentQuestion[];
}

/** One page of the assessment: a batch of Likert questions, or one question of another type. */
export type RenderUnit =
  | { kind: "batch"; typeName: string; typeIcon?: string; questions: AssessmentQuestion[] }
  | { kind: "single" | "multiselect" | "ranking"; typeName: string; typeIcon?: string; question: AssessmentQuestion };

/** string = chosen option; string[] = multi-select picks, or a ranking order. */
export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

/** Likert questions per page (the old app settled on one per page). */
export const LIKERT_PAGE_SIZE = 1;

const isLikert = (q: AssessmentQuestion) => q.questionType === "LIKERT_SCALE" || !q.questionType;

/** Walks each section in the set's order: consecutive Likert items batch into pages; other types get their own page. */
export function buildRenderUnits(sections: AssessmentSection[], pageSize = LIKERT_PAGE_SIZE): RenderUnit[] {
  const units: RenderUnit[] = [];
  for (const section of sections) {
    const qs = section.questions;
    let i = 0;
    while (i < qs.length) {
      if (isLikert(qs[i])) {
        const batch: AssessmentQuestion[] = [];
        while (i < qs.length && isLikert(qs[i]) && batch.length < pageSize) batch.push(qs[i++]);
        units.push({ kind: "batch", typeName: section.typeName, typeIcon: section.typeIcon, questions: batch });
      } else {
        const q = qs[i++];
        const kind = q.questionType === "MULTI_SELECT" ? "multiselect" : q.questionType === "RANKING" ? "ranking" : "single";
        units.push({ kind, typeName: section.typeName, typeIcon: section.typeIcon, question: q });
      }
    }
  }
  return units;
}

export const unitQuestions = (u: RenderUnit) => (u.kind === "batch" ? u.questions : [u.question]);

export function isAnswered(q: AssessmentQuestion, answers: Answers): boolean {
  const v = answers[q._id];
  if (q.questionType === "MULTI_SELECT") return Array.isArray(v) && v.length > 0;
  if (q.questionType === "RANKING") return Array.isArray(v) && v.length === q.options.length;
  return !!v;
}

/** Answered, or explicitly timed out (a timed-out question's inputs are locked for good). */
export const isResolved = (q: AssessmentQuestion, answers: Answers, timedOut: Record<string, boolean>) =>
  isAnswered(q, answers) || !!timedOut[q._id];

/** A page may be left once every question on it is answered (a timed-out single question also passes). */
export function canLeaveUnit(u: RenderUnit, answers: Answers, timedOut: Record<string, boolean>): boolean {
  if (u.kind === "batch") return u.questions.every((q) => isAnswered(q, answers));
  return isAnswered(u.question, answers) || !!timedOut[u.question._id];
}

export interface SubmitEntry {
  questionId: string;
  answerOptionId?: string;
  answerOptionIds?: string[];
  orderedOptionIds?: string[];
  status: "answered" | "timeout" | "skipped";
  timeTakenSeconds?: number;
}

/** One entry per question, in the shape the backend expects per question type. */
export function buildAnswerPayload(
  questions: AssessmentQuestion[],
  answers: Answers,
  timedOut: Record<string, boolean>,
  timeSpent: Record<string, number>,
): SubmitEntry[] {
  return questions.map((q) => {
    const entry: SubmitEntry = { questionId: q._id, status: "skipped" };
    if (isAnswered(q, answers)) {
      const v = answers[q._id];
      if (q.questionType === "MULTI_SELECT") entry.answerOptionIds = v as string[];
      else if (q.questionType === "RANKING") entry.orderedOptionIds = v as string[];
      else entry.answerOptionId = v as string;
      entry.status = timedOut[q._id] ? "timeout" : "answered";
    } else {
      entry.status = timedOut[q._id] ? "timeout" : "skipped";
    }
    if (timeSpent[q._id] != null) entry.timeTakenSeconds = timeSpent[q._id];
    return entry;
  });
}

export interface SideCategory {
  name: string;
  icon: string;
  first: number;
  units: number[];
  start: number;
  end: number;
}

/** Sidebar model: categories in order of first appearance, each with its global question range. */
export function buildSideModel(units: RenderUnit[]): SideCategory[] {
  const unitStart: number[] = [];
  const unitEnd: number[] = [];
  let off = 0;
  units.forEach((u, ui) => {
    const n = unitQuestions(u).length;
    unitStart[ui] = off + 1;
    unitEnd[ui] = off + n;
    off += n;
  });
  const cats: SideCategory[] = [];
  const seen = new Map<string, number>();
  units.forEach((u, ui) => {
    const name = u.typeName || "Questions";
    if (!seen.has(name)) {
      seen.set(name, cats.length);
      cats.push({ name, icon: u.typeIcon || "📋", first: ui, units: [], start: Infinity, end: 0 });
    }
    const c = cats[seen.get(name)!];
    c.units.push(ui);
    c.start = Math.min(c.start, unitStart[ui]);
    c.end = Math.max(c.end, unitEnd[ui]);
  });
  return cats;
}

export const formatClock = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Timer colour thresholds: ≤1 min danger, ≤5 min warning, otherwise accent. */
export const timerTone = (secondsLeft: number): "danger" | "warning" | "normal" =>
  secondsLeft <= 60 ? "danger" : secondsLeft <= 300 ? "warning" : "normal";

// ── Autosave (per session, so a previous attempt's answers never leak into a new one) ──

export interface AutosaveState {
  answers: Answers;
  timedOut: Record<string, boolean>;
  timeSpent: Record<string, number>;
  marked: number[];
}

export const autosaveKey = (sessionId: string) => `tbt_psy_answers_${sessionId}`;

export function readAutosave(storage: Pick<Storage, "getItem"> | null, sessionId: string): Partial<AutosaveState> {
  try {
    const raw = storage?.getItem(autosaveKey(sessionId));
    if (!raw) return {};
    const v = JSON.parse(raw);
    return {
      answers: v.answers && typeof v.answers === "object" ? v.answers : undefined,
      timedOut: v.timedOut && typeof v.timedOut === "object" ? v.timedOut : undefined,
      timeSpent: v.timeSpent && typeof v.timeSpent === "object" ? v.timeSpent : undefined,
      marked: Array.isArray(v.marked) ? v.marked.filter((n: unknown) => typeof n === "number") : undefined,
    };
  } catch {
    return {};
  }
}

export function writeAutosave(storage: Pick<Storage, "setItem"> | null, sessionId: string, s: AutosaveState) {
  try {
    storage?.setItem(autosaveKey(sessionId), JSON.stringify(s));
  } catch {
    /* storage full / blocked — autosave is a convenience */
  }
}

export function clearAutosaves(storage: Storage | null) {
  try {
    if (!storage) return;
    for (let i = storage.length - 1; i >= 0; i--) {
      const k = storage.key(i);
      if (k && k.startsWith("tbt_psy_answers_")) storage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

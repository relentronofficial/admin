import { describe, expect, it } from "vitest";
import {
  buildAnswerPayload,
  buildRenderUnits,
  buildSideModel,
  canLeaveUnit,
  clearAutosaves,
  formatClock,
  isAnswered,
  isResolved,
  readAutosave,
  timerTone,
  writeAutosave,
  type AssessmentQuestion,
  type AssessmentSection,
} from "./assessmentFlow";
import { bestVoice, detectTanglish, hasTamilVoice, pickSpeech, tanglishToTamil } from "./speech";

const q = (id: string, questionType: AssessmentQuestion["questionType"] = "LIKERT_SCALE", nOpts = 3): AssessmentQuestion => ({
  _id: id, text: `Q ${id}`, order: 1, language: "en", questionType, dimension: "Leadership",
  options: Array.from({ length: nOpts }, (_, i) => ({ _id: `${id}o${i}`, optionText: `o${i}`, order: i + 1 })),
});
const sections: AssessmentSection[] = [
  { typeId: "t1", typeName: "Leadership", typeIcon: "🧭", questions: [q("a"), q("b"), q("c", "NUMERICAL_ABILITY")] },
  { typeId: "t2", typeName: "Communication", questions: [q("d", "MULTI_SELECT"), q("e", "RANKING")] },
];

describe("render units", () => {
  it("one Likert per page, every other type on its own page, set order kept", () => {
    const units = buildRenderUnits(sections);
    expect(units.map((u) => u.kind)).toEqual(["batch", "batch", "single", "multiselect", "ranking"]);
    expect(buildRenderUnits(sections, 5).map((u) => u.kind)).toEqual(["batch", "single", "multiselect", "ranking"]);
  });

  it("sidebar categories with global question ranges", () => {
    const cats = buildSideModel(buildRenderUnits(sections));
    expect(cats.map((c) => [c.name, c.first, c.start, c.end, c.icon])).toEqual([
      ["Leadership", 0, 1, 3, "🧭"],
      ["Communication", 3, 4, 5, "📋"],
    ]);
  });
});

describe("answer rules", () => {
  const [, , c, d, e] = sections.flatMap((s) => s.questions);
  it("answered per type", () => {
    expect(isAnswered(c, { c: "co1" })).toBe(true);
    expect(isAnswered(d, { d: [] })).toBe(false);
    expect(isAnswered(d, { d: ["do0"] })).toBe(true);
    expect(isAnswered(e, { e: ["eo0", "eo1"] })).toBe(false);
    expect(isAnswered(e, { e: ["eo2", "eo0", "eo1"] })).toBe(true);
  });

  it("a timed-out question is resolved and may be left", () => {
    expect(isResolved(c, {}, { c: true })).toBe(true);
    const single = buildRenderUnits(sections)[2];
    expect(canLeaveUnit(single, {}, {})).toBe(false);
    expect(canLeaveUnit(single, {}, { c: true })).toBe(true);
    const likert = buildRenderUnits(sections)[0];
    expect(canLeaveUnit(likert, {}, { a: true })).toBe(false);
  });

  it("submit payload: shape per type, statuses, time taken", () => {
    const all = sections.flatMap((s) => s.questions);
    const p = buildAnswerPayload(all, { a: "ao1", c: "co0", d: ["do0", "do2"], e: ["eo1", "eo0", "eo2"] }, { b: true, c: true }, { a: 4 });
    expect(p).toEqual([
      { questionId: "a", answerOptionId: "ao1", status: "answered", timeTakenSeconds: 4 },
      { questionId: "b", status: "timeout" },
      { questionId: "c", answerOptionId: "co0", status: "timeout" },
      { questionId: "d", answerOptionIds: ["do0", "do2"], status: "answered" },
      { questionId: "e", orderedOptionIds: ["eo1", "eo0", "eo2"], status: "answered" },
    ]);
  });
});

describe("timer + autosave", () => {
  it("clock and tone", () => {
    expect(formatClock(605)).toBe("10:05");
    expect(formatClock(-3)).toBe("00:00");
    expect([timerTone(301), timerTone(300), timerTone(60)]).toEqual(["normal", "warning", "danger"]);
  });

  it("autosave is per session, tolerant of junk, and clearable", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
      clear: () => store.clear(),
    } as Storage;
    writeAutosave(storage, "s1", { answers: { a: "x" }, timedOut: {}, timeSpent: { a: 3 }, marked: [2] });
    expect(readAutosave(storage, "s1")).toEqual({ answers: { a: "x" }, timedOut: {}, timeSpent: { a: 3 }, marked: [2] });
    expect(readAutosave(storage, "s2")).toEqual({});
    store.set("tbt_psy_answers_bad", "{not json");
    expect(readAutosave(storage, "bad")).toEqual({});
    store.set("other", "keep");
    clearAutosaves(storage);
    expect([...store.keys()]).toEqual(["other"]);
  });
});

describe("speech helpers", () => {
  const voices = [
    { name: "Microsoft David", lang: "en-US", default: true },
    { name: "Google UK English Female", lang: "en-GB", default: false },
    { name: "Microsoft Pallavi Online (Natural)", lang: "ta-IN", default: false },
  ];
  it("Tanglish → Tamil and detection (same as the backend copy)", () => {
    expect(tanglishToTamil("vanakkam")).toBe("வநக்கம்");
    expect(detectTanglish("neenga romba nalla pannunga")).toBe(true);
    expect(detectTanglish("please choose the best answer")).toBe(false);
  });
  it("picks the most natural voice for the language, falling back to English with matching lang", () => {
    expect(bestVoice(voices)!.name).toBe("Microsoft Pallavi Online (Natural)");
    expect(pickSpeech("hello", voices, "en").voice!.name).toBe("Google UK English Female");
    expect(pickSpeech("hello", voices, "ta")).toMatchObject({ lang: "ta-IN" });
    const noTamil = voices.slice(0, 2);
    expect(hasTamilVoice(noTamil)).toBe(false);
    expect(pickSpeech("வணக்கம்", noTamil)).toMatchObject({ lang: "en-GB" });
  });
});

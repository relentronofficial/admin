import { describe, it, expect } from "vitest";
import { formatMinutes, formatSeconds, sumLessonDurations } from "./courseDurations";

describe("formatMinutes", () => {
  it("formats minutes, whole hours and hours with minutes", () => {
    expect(formatMinutes(30)).toBe("30 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(135)).toBe("2 hr 15 min");
    expect(formatMinutes(120)).toBe("2 hr");
  });

  it("returns null for unknown or empty values", () => {
    expect(formatMinutes(null)).toBeNull();
    expect(formatMinutes(undefined)).toBeNull();
    expect(formatMinutes(0)).toBeNull();
    expect(formatMinutes(-5)).toBeNull();
    expect(formatMinutes(Number.NaN)).toBeNull();
  });
});

describe("formatSeconds", () => {
  it("rounds to the nearest minute", () => {
    expect(formatSeconds(8100)).toBe("2 hr 15 min");
    expect(formatSeconds(3600)).toBe("1 hr");
    expect(formatSeconds(89)).toBe("1 min");
    expect(formatSeconds(91)).toBe("2 min");
  });

  it("shows a short clip as 1 min, not 0", () => {
    expect(formatSeconds(20)).toBe("1 min");
  });

  it("returns null for unknown or empty values", () => {
    expect(formatSeconds(null)).toBeNull();
    expect(formatSeconds(0)).toBeNull();
  });
});

describe("sumLessonDurations", () => {
  // Course with two sections of different sizes (3 videos / 1 video).
  const sectionA = [
    { id: "a1", durationSeconds: 600, taskMinutes: 15 },
    { id: "a2", durationSeconds: 1500, taskMinutes: null },
    { id: "a3", durationSeconds: 2700, taskMinutes: 30 },
  ];
  const sectionB = [{ id: "b1", durationSeconds: 3300, taskMinutes: null }];

  it("sums every video and task in a section", () => {
    expect(sumLessonDurations(sectionA)).toEqual({ videoSeconds: 4800, taskMinutes: 45 });
    expect(formatSeconds(4800)).toBe("1 hr 20 min");
  });

  it("gives each section its own totals", () => {
    expect(sumLessonDurations(sectionB)).toEqual({ videoSeconds: 3300, taskMinutes: null });
  });

  it("sums the whole course across sections", () => {
    expect(sumLessonDurations([...sectionA, ...sectionB])).toEqual({ videoSeconds: 8100, taskMinutes: 45 });
  });

  it("counts a repeated lesson once", () => {
    expect(sumLessonDurations([...sectionA, sectionA[0]])).toEqual({ videoSeconds: 4800, taskMinutes: 45 });
  });

  it("ignores completion — the total is the full course either way", () => {
    const done = sectionA.map((l) => ({ ...l, isCompleted: true }));
    const partly = sectionA.map((l, i) => ({ ...l, isCompleted: i === 0 }));
    expect(sumLessonDurations(done)).toEqual(sumLessonDurations(partly));
  });

  it("returns no video total when any video's length is unknown", () => {
    const withUnknown = [...sectionA, { id: "x", durationSeconds: null }, { id: "y", durationSeconds: 0 }];
    expect(sumLessonDurations(withUnknown).videoSeconds).toBeNull();
    expect(sumLessonDurations(withUnknown).taskMinutes).toBe(45);
  });

  it("returns nulls for an empty list", () => {
    expect(sumLessonDurations([])).toEqual({ videoSeconds: null, taskMinutes: null });
  });
});

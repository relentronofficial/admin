import { describe, expect, it } from "vitest";
import { AUTO_COMPLETE_FRACTION, genuineWatchedSeconds, shouldAutoComplete } from "./lessonAutoComplete";

const base = { genuineSecs: 0, durationSecs: 600, alreadyCompleted: false, requestInFlight: false, retryNotBefore: 0, now: 1_000 };

describe("lesson auto-complete at 90% genuine watch progress", () => {
  it("uses 90%", () => expect(AUTO_COMPLETE_FRACTION).toBe(0.9));

  it("stays incomplete before 90%; completes at exactly 90% and above", () => {
    expect(shouldAutoComplete({ ...base, genuineSecs: 539 })).toBe(false);
    expect(shouldAutoComplete({ ...base, genuineSecs: 540 })).toBe(true);
    expect(shouldAutoComplete({ ...base, genuineSecs: 600 })).toBe(true);
  });

  it("genuine seconds = server seconds at open + this session's live watch time", () => {
    expect(genuineWatchedSeconds(300, 240)).toBe(540);
    expect(genuineWatchedSeconds(null, 12)).toBe(12);
    expect(genuineWatchedSeconds(undefined, -5)).toBe(0);
  });

  it("never submits twice: not when already completed or while a request is in flight", () => {
    expect(shouldAutoComplete({ ...base, genuineSecs: 600, alreadyCompleted: true })).toBe(false);
    expect(shouldAutoComplete({ ...base, genuineSecs: 600, requestInFlight: true })).toBe(false);
  });

  it("waits for the real duration from the player", () => {
    expect(shouldAutoComplete({ ...base, genuineSecs: 600, durationSecs: 0 })).toBe(false);
    expect(shouldAutoComplete({ ...base, genuineSecs: 600, durationSecs: NaN })).toBe(false);
  });

  it("after a failed save it retries only after the back-off", () => {
    expect(shouldAutoComplete({ ...base, genuineSecs: 600, retryNotBefore: 5_000, now: 4_999 })).toBe(false);
    expect(shouldAutoComplete({ ...base, genuineSecs: 600, retryNotBefore: 5_000, now: 5_000 })).toBe(true);
  });
});

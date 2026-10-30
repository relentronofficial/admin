import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// The real AssessmentRunner / ResultView against a mocked psychometric
// service (same response shapes as the backend's member routes).

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));
const svc = vi.hoisted(() => ({
  settings: vi.fn(), questions: vi.fn(), start: vi.fn(), submit: vi.fn(), result: vi.fn(),
  myRetest: vi.fn(), requestRetest: vi.fn(), audio: vi.fn(),
}));
vi.mock("@/lib/api/services/psychometric.service", () => ({ psychometricService: svc }));

import toast from "react-hot-toast";
import { AssessmentRunner } from "./AssessmentRunner";
import { ResultView } from "./ResultView";
import { ProfileAssessmentCard } from "./ProfileAssessmentCard";

const opts = (id: string, n: number) => Array.from({ length: n }, (_, i) => ({ _id: `${id}o${i}`, optionText: `${id} option ${i + 1}`, order: i + 1 }));
const Q = (id: string, questionType: string, n = 3, extra: object = {}) => ({
  _id: id, text: `Question ${id}`, order: 1, language: "en", questionType, dimension: "Leadership", options: opts(id, n), ...extra,
});
const SECTIONS = [
  { typeId: "t1", typeName: "Leadership", questions: [Q("a", "LIKERT_SCALE", 5), Q("b", "MULTI_SELECT")] },
  { typeId: "t2", typeName: "Communication", questions: [Q("c", "RANKING")] },
];
const questionsResponse = (session: object | null, remainingSeconds = 1200) => ({ success: true, data: SECTIONS, remainingSeconds, session });

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}
const next = () => fireEvent.click(screen.getByRole("button", { name: /Save & Continue/ }));

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset());
  router.replace.mockReset();
  vi.mocked(toast.error).mockReset();
  localStorage.clear();
  window.scrollTo = vi.fn();
});
afterEach(cleanup);

describe("AssessmentRunner", () => {
  it("starts a new attempt when there is none, then reloads the attempt's questions", async () => {
    svc.questions.mockResolvedValueOnce(questionsResponse(null)).mockResolvedValueOnce(questionsResponse({ sessionId: "s1", expiresAt: "x" }));
    svc.start.mockResolvedValue({ success: true, sessionId: "s1", expiresAt: "x", attemptNumber: 1 });
    wrap(<AssessmentRunner />);
    expect(await screen.findByText("Question a")).toBeTruthy();
    expect(svc.start).toHaveBeenCalledTimes(1);
    expect(svc.questions).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("timer").textContent).toBe("20:00");
  });

  it("resumes a live attempt without starting, restoring autosaved answers", async () => {
    localStorage.setItem("tbt_psy_answers_s9", JSON.stringify({ answers: { a: "ao2" }, timedOut: {}, timeSpent: {}, marked: [] }));
    svc.questions.mockResolvedValue(questionsResponse({ sessionId: "s9", expiresAt: "x" }, 90));
    wrap(<AssessmentRunner />);
    expect(await screen.findByText("Question a")).toBeTruthy();
    expect(svc.start).not.toHaveBeenCalled();
    expect((screen.getByLabelText("a option 3") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("timer").textContent).toBe("01:30");
  });

  it("sends a member who already completed it to their result", async () => {
    svc.questions.mockResolvedValue(questionsResponse(null));
    svc.start.mockRejectedValue(new Error("You have already completed this assessment."));
    wrap(<AssessmentRunner />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/psychometric/result"));
  });

  it("shows the server message (e.g. not available) with Retry", async () => {
    svc.questions.mockRejectedValue(new Error("The assessment is not available yet. Please check back later."));
    wrap(<AssessmentRunner />);
    expect(await screen.findByText(/not available yet/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("requires an answer per page, then submits the exact payload and opens the result", async () => {
    svc.questions.mockResolvedValue(questionsResponse({ sessionId: "s1", expiresAt: "x" }));
    svc.submit.mockResolvedValue({ success: true, resultId: "r1" });
    wrap(<AssessmentRunner />);
    await screen.findByText("Question a");

    next();
    expect(toast.error).toHaveBeenCalledWith("Please select an answer before continuing.");
    fireEvent.click(screen.getByLabelText("a option 4"));
    next();

    expect(screen.getByText("Select all that apply.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("b option 1"));
    fireEvent.click(screen.getByLabelText("b option 3"));
    next();

    // Ranking starts answered with the shown order; move the 3rd item up.
    expect(screen.getByText(/arrange in your preferred order/)).toBeTruthy();
    fireEvent.click(screen.getAllByLabelText("Move up")[2]);
    fireEvent.click(screen.getByRole("button", { name: "Submit Assessment" }));

    await waitFor(() => expect(svc.submit).toHaveBeenCalledTimes(1));
    const [sessionId, payload] = svc.submit.mock.calls[0];
    expect(sessionId).toBe("s1");
    expect(payload.map((p: any) => ({ ...p, timeTakenSeconds: undefined }))).toEqual([
      { questionId: "a", answerOptionId: "ao3", status: "answered", timeTakenSeconds: undefined },
      { questionId: "b", answerOptionIds: ["bo0", "bo2"], status: "answered", timeTakenSeconds: undefined },
      { questionId: "c", orderedOptionIds: ["co0", "co2", "co1"], status: "answered", timeTakenSeconds: undefined },
    ]);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/psychometric/result"));
    expect(localStorage.getItem("tbt_psy_answers_s1")).toBeNull();
  });

  it("a manual submit with unanswered questions is blocked; the timer auto-submits what there is", async () => {
    svc.questions.mockResolvedValue(questionsResponse({ sessionId: "s1", expiresAt: "x" }, 2));
    svc.submit.mockResolvedValue({ success: true, resultId: "r1" });
    wrap(<AssessmentRunner />);
    await screen.findByText("Question a");
    // jump to the last page via the sidebar
    fireEvent.click(screen.getByRole("button", { name: "2Communication" }));
    expect(await screen.findByText("Question c")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Submit Assessment" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/2 question\(s\) unanswered/);
    expect(svc.submit).not.toHaveBeenCalled();

    // the 2-second global timer runs out → auto-submit with what is answered
    await waitFor(() => expect(svc.submit).toHaveBeenCalledTimes(1), { timeout: 4000 });
    const statuses = svc.submit.mock.calls[0][1].map((p: any) => [p.questionId, p.status]);
    expect(statuses).toEqual([["a", "skipped"], ["b", "skipped"], ["c", "answered"]]);
  });
});

describe("ResultView", () => {
  const data = {
    success: true,
    attemptNumber: 2,
    data: {
      _id: "r1", userId: { _id: "c1", name: "Ravi Kumar", email: null, sharedCode: "TBT", sharedUserID: { _id: "x", label: "TBT Members" } },
      attemptNumber: 2, totalMarks: 11, maxScore: 13, percentage: 84.6, level: "Excellent" as const,
      categoryPercentages: { Leadership: 80, Communication: 100, Creativity: 50 }, dimensionPercentages: { Leadership: 80 },
      explanation: "Outstanding entrepreneurial potential!", improvementAreas: [{ category: "Creativity", score: 50, suggestion: "Practice." }],
      recommendedBusiness: ["Branding Agency"], recommendations: [{ business: "Branding Agency", explanation: "Because." }],
      strongDimensions: ["Leadership"], weakDimensions: [], correctCount: 1, wrongCount: 0, skippedCount: 0, aptitudeScore: 70, createdAt: "2026-10-30",
    },
    history: [{ _id: "r1", attemptNumber: 2, percentage: 84.6, level: "Excellent", createdAt: "2026-10-30" }, { _id: "r0", attemptNumber: 1, percentage: 40, level: "Average", createdAt: "2026-10-01" }],
    retest: { status: "none" as const, canRequest: true },
  };

  it("shows score, label, composites, radar, recommendations and history", () => {
    wrap(<ResultView data={data} />);
    expect(screen.getByText("TBT Members Results")).toBeTruthy();
    expect(screen.getAllByText("84.6%")).toHaveLength(2); // score + attempt history
    expect(screen.getByText("Total: 11 / 13")).toBeTruthy();
    expect(screen.getAllByText("Attempt 2")).toHaveLength(2); // badge + attempt history
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByRole("img", { name: /radar/ })).toBeTruthy();
    expect(screen.getByText("Branding Agency")).toBeTruthy();
    expect(screen.getByText("Previous Attempts")).toBeTruthy();
  });

  it("retest states: request, pending, rejected with note, approved", async () => {
    svc.requestRetest.mockResolvedValue({ success: true, message: "Retest request sent to the administrator for approval." });
    const { rerender } = wrap(<ResultView data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "Request Retest" }));
    await waitFor(() => expect(svc.requestRetest).toHaveBeenCalled());

    const withRetest = (retest: object) => ({ ...data, retest }) as typeof data;
    const qc = new QueryClient();
    rerender(<QueryClientProvider client={qc}><ResultView data={withRetest({ status: "pending", canRequest: false })} /></QueryClientProvider>);
    expect(screen.getByText(/Waiting for admin approval/)).toBeTruthy();
    rerender(<QueryClientProvider client={qc}><ResultView data={withRetest({ status: "rejected", rejectionNote: "Too soon", canRequest: true })} /></QueryClientProvider>);
    expect(screen.getByText(/rejected: Too soon/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Request Again" })).toBeTruthy();
    rerender(<QueryClientProvider client={qc}><ResultView data={withRetest({ status: "approved", canRequest: false })} /></QueryClientProvider>);
    expect(screen.getByRole("link", { name: "Start Retest" }).getAttribute("href")).toBe("/psychometric/assessment");
  });
});

describe("ProfileAssessmentCard", () => {
  const result = (retest: object) => ({
    success: true, attemptNumber: 1, history: [], retest,
    data: { _id: "r1", percentage: 72.5, level: "Good", attemptNumber: 1, createdAt: "2026-10-30" },
  });

  it("not taken yet: links to the start page with the set's time limit", async () => {
    svc.settings.mockResolvedValue({ success: true, data: { assessment_duration_minutes: 25 } });
    svc.result.mockRejectedValue(new Error("No result found."));
    wrap(<ProfileAssessmentCard />);
    expect((await screen.findByRole("link", { name: "Take the assessment" })).getAttribute("href")).toBe("/psychometric");
    expect(await screen.findByText(/25-minute assessment/)).toBeTruthy();
  });

  it("completed: score, level and a link to the result; an approved retest adds Start retest", async () => {
    svc.settings.mockResolvedValue({ success: true, data: { assessment_duration_minutes: 30 } });
    svc.result.mockResolvedValue(result({ status: "none", canRequest: true }));
    wrap(<ProfileAssessmentCard />);
    expect(await screen.findByText("72.5%")).toBeTruthy();
    expect(screen.getByText(/Good · Attempt 1/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "View results" }).getAttribute("href")).toBe("/psychometric/result");
    expect(screen.queryByRole("link", { name: "Start retest" })).toBeNull();

    cleanup();
    svc.result.mockResolvedValue(result({ status: "approved", canRequest: false }));
    wrap(<ProfileAssessmentCard />);
    expect((await screen.findByRole("link", { name: "Start retest" })).getAttribute("href")).toBe("/psychometric");
  });
});

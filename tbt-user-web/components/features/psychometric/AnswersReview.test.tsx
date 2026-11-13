import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// AnswersReview against a mocked psychometric service (same shape as the
// backend's GET /api/user/psychometric-assessment/answers).

const svc = vi.hoisted(() => ({ answers: vi.fn() }));
vi.mock("@/lib/api/services/psychometric.service", () => ({ psychometricService: svc }));

import { AnswersReview } from "./AnswersReview";

const opt = (id: string, text: string, order: number) => ({ _id: id, optionText: text, optionImageUrl: "", order });
const REVIEW = {
  attemptNumber: 2,
  startedAt: "2026-11-01T10:00:00Z",
  submittedAt: "2026-11-01T10:20:00Z",
  autoSubmitted: false,
  durationMinutes: 25,
  sections: [
    {
      typeId: "t1", typeName: "Leadership", typeColor: "#8b5cf6",
      questions: [
        { _id: "q1", text: "I take charge when a team is stuck.", order: 1, questionType: "LIKERT_SCALE", language: "en", timeLimitSeconds: 45,
          instructionText: "", imageUrl: "", options: [opt("a", "Strongly disagree", 1), opt("b", "Agree", 2)],
          answer: { status: "answered", selectedOptionIds: ["b"], timeTakenSeconds: 12 } },
        { _id: "q2", text: "Rank these priorities.", order: 2, questionType: "RANKING", language: "en", timeLimitSeconds: 90,
          instructionText: "", imageUrl: "", options: [opt("x", "Cash flow", 1), opt("y", "Brand", 2)],
          answer: { status: "answered", selectedOptionIds: ["y", "x"], timeTakenSeconds: null } },
        { _id: "q3", text: "Pick one.", order: 3, questionType: "SINGLE_CHOICE", language: "en", timeLimitSeconds: null,
          instructionText: "", imageUrl: "", options: [opt("p", "P", 1)], answer: { status: "timeout", selectedOptionIds: [], timeTakenSeconds: null } },
      ],
    },
  ],
};

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => { svc.answers.mockReset(); });
afterEach(cleanup);

describe("AnswersReview", () => {
  it("before submitting: shows no questions, only a link to take the assessment", async () => {
    svc.answers.mockImplementation(async () => { throw new Error("No submitted assessment found."); });
    wrap(<AnswersReview />);
    expect((await screen.findByRole("link", { name: "Take the assessment" })).getAttribute("href")).toBe("/psychometric");
    expect(screen.queryByText(/take charge/)).toBeNull();
  });

  it("shows an error with retry when the request fails", async () => {
    svc.answers.mockRejectedValueOnce(new Error("Network Error")).mockResolvedValueOnce({ success: true, data: REVIEW });
    wrap(<AnswersReview />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/Attempt 2 · 3 questions/)).toBeTruthy();
  });

  it("after submitting: lists every question, option, time limit and saved answer", async () => {
    svc.answers.mockResolvedValue({ success: true, data: REVIEW });
    wrap(<AnswersReview />);
    expect(await screen.findByText(/Time allowed: 25 min/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /View answers/ }));

    expect(screen.getByText("Leadership")).toBeTruthy();
    expect(screen.getByText("I take charge when a team is stuck.")).toBeTruthy();
    expect(screen.getByText("Strongly disagree")).toBeTruthy();
    expect(screen.getByText("45 sec")).toBeTruthy();
    expect(screen.getByText("1 min 30 sec")).toBeTruthy();
    // The saved single answer is marked; the other option is not.
    expect(screen.getByText("Agree").closest("li")?.getAttribute("data-selected")).toBe("true");
    expect(screen.getByText("Strongly disagree").closest("li")?.getAttribute("data-selected")).toBeNull();
    expect(screen.getByText("Answered in 12 sec")).toBeTruthy();
    // Ranking shows the member's order.
    const ranking = screen.getByText("Your ranking").nextElementSibling!;
    expect([...ranking.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Brand", "Cash flow"]);
    expect(screen.getByText("Time ran out — not answered")).toBeTruthy();
  });
});

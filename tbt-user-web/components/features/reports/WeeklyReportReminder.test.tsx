import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real reminder + modal against a mocked weekly-status / submit service.

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => nav.params,
  usePathname: () => "/community",
}));
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/hooks/useUser", () => ({ useMe: () => ({ data: { status: "active" } }) }));
vi.mock("@/lib/hooks/useCourses", () => ({ useCourses: () => ({ data: [] }), useMyEnrollments: () => ({ data: [{ id: "c1", title: "Service Mentorship" }] }) }));
const svc = vi.hoisted(() => ({ getWeeklyStatus: vi.fn(), submitFeedback: vi.fn(), getWeeklyForm: vi.fn(), submitWeeklyAnswers: vi.fn() }));
vi.mock("@/lib/api/services/courseReports.service", () => ({ courseReportsService: svc }));
// Saturday 21 Nov 2026, 10:00 IST (before the 18:00 deadline).
const clock = vi.hoisted(() => ({ now: Date.parse("2026-11-21T10:00:00+05:30") }));
vi.mock("@/lib/api/client", () => ({ getServerNow: () => clock.now }));

import { WeeklyReportReminder } from "./WeeklyReportReminder";

const status = (over: object = {}) => ({
  success: true,
  data: {
    required: true, submittedThisWeek: false, showReminder: true, locked: false,
    weekStart: "2026-11-15T18:30:00.000Z", deadline: "2026-11-21T12:30:00.000Z", ...over,
  },
});

function renderReminder() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><WeeklyReportReminder /></QueryClientProvider>);
}

beforeEach(() => {
  localStorage.clear();
  nav.params = new URLSearchParams();
  clock.now = Date.parse("2026-11-21T10:00:00+05:30");
  svc.getWeeklyStatus.mockReset();
  svc.submitFeedback.mockReset();
  svc.submitWeeklyAnswers.mockReset();
  svc.getWeeklyForm.mockReset().mockResolvedValue({ success: true, data: null });
});
afterEach(cleanup);

describe("WeeklyReportReminder", () => {
  it("shows the report form with the due-by note on Friday/Saturday", async () => {
    svc.getWeeklyStatus.mockResolvedValue(status());
    renderReminder();
    expect(await screen.findByText(/due by Saturday 6:00 PM/)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("stays hidden when nothing is due", async () => {
    svc.getWeeklyStatus.mockResolvedValue(status({ showReminder: false, submittedThisWeek: true }));
    renderReminder();
    await waitFor(() => expect(svc.getWeeklyStatus).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("'Later' hides it for the day, but it comes back after 6 PM Saturday", async () => {
    svc.getWeeklyStatus.mockResolvedValue(status());
    renderReminder();
    fireEvent.click(await screen.findByRole("button", { name: "Later" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();

    renderReminder();
    await waitFor(() => expect(svc.getWeeklyStatus).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();

    clock.now = Date.parse("2026-11-21T18:05:00+05:30");
    svc.getWeeklyStatus.mockResolvedValue(status({ locked: true }));
    renderReminder();
    expect(await screen.findByText(/Course videos are locked/)).toBeTruthy();
  });

  it("submits the report for the only enrolled course", async () => {
    svc.getWeeklyStatus.mockResolvedValue(status());
    svc.submitFeedback.mockResolvedValue({ success: true, data: { status: "sent", feedbackId: "f1" } });
    renderReminder();
    fireEvent.change(await screen.findByPlaceholderText(/Share your weekly progress/), { target: { value: "Closed 3 clients" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit Report/ }));
    await waitFor(() => expect(svc.submitFeedback).toHaveBeenCalledWith({ courseId: "c1", feedback: "Closed 3 clients", remarks: undefined }));
  });

  it("asks the admin's questions for the batch week and submits the answers", async () => {
    svc.getWeeklyStatus.mockResolvedValue(status());
    const q = (id: string, type: string, over: object = {}) => ({ id, type, question: `Q-${id}`, help: "", required: true, options: [], ...over });
    svc.getWeeklyForm.mockResolvedValue({ success: true, data: {
      week: 3, totalWeeks: 18, version: 2, submitted: false, answers: {},
      questions: [
        q("text", "short_text"), q("num", "number"), q("rate", "rating"), q("yn", "yes_no"),
        q("one", "single_choice", { options: ["A", "B"] }), q("many", "multi_choice", { options: ["X", "Y"] }),
        q("long", "long_text", { required: false }), q("day", "date", { required: false }),
      ],
    } });
    svc.submitWeeklyAnswers.mockRejectedValueOnce(new Error("The questions were updated."));
    svc.submitWeeklyAnswers.mockResolvedValue({ success: true, data: { status: "sent", feedbackId: "f1" } });
    renderReminder();
    expect(await screen.findByText(/Week 3 of 18/)).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Share your weekly progress/)).toBeNull();
    const submit = screen.getByRole("button", { name: /Submit Report/ }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Q-text/), { target: { value: "hi" } });
    fireEvent.change(screen.getByLabelText(/Q-num/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("radio", { name: "10" }));
    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    fireEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "X" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Y" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "X" }));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    const body = { courseId: "c1", week: 3, version: 2, answers: { text: "hi", num: "0", rate: "10", yn: "Yes", one: "B", many: ["Y"] } };
    await waitFor(() => expect(svc.submitWeeklyAnswers).toHaveBeenCalledWith(body));
    // A refused submit re-reads the questions and keeps what was typed.
    await waitFor(() => expect(svc.getWeeklyForm).toHaveBeenCalledTimes(2));
    expect((screen.getByLabelText(/Q-text/) as HTMLInputElement).value).toBe("hi");
    await waitFor(() => expect(submit.disabled).toBe(false));
    fireEvent.click(submit);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(svc.submitFeedback).not.toHaveBeenCalled();
  });

  it("the reminder notification link opens it even on other days", async () => {
    nav.params = new URLSearchParams("weeklyReport=1");
    svc.getWeeklyStatus.mockResolvedValue(status({ showReminder: false }));
    renderReminder();
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});

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
vi.mock("@/lib/hooks/useCourses", () => ({ useMyEnrollments: () => ({ data: [{ id: "c1", title: "Service Mentorship" }] }) }));
const svc = vi.hoisted(() => ({ getWeeklyStatus: vi.fn(), submitFeedback: vi.fn() }));
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

  it("the reminder notification link opens it even on other days", async () => {
    nav.params = new URLSearchParams("weeklyReport=1");
    svc.getWeeklyStatus.mockResolvedValue(status({ showReminder: false }));
    renderReminder();
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});

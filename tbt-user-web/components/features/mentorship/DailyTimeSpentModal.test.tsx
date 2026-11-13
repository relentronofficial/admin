import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DailyTimeSpentModal, { formatDuration, formatDay } from "./DailyTimeSpentModal";

// Real service → hook → component; only the HTTP client is replaced (it returns
// the backend body, as lib/api/client.ts's interceptor does).
const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ default: { get, post: vi.fn() } }));

const day = (date: string, activeMinutes: number) => ({ date, activeMinutes, mediaMinutes: 0 });
const history = (over: Record<string, unknown> = {}) => ({
  timezone: "Asia/Kolkata", memberName: "Priya K", onboardingDate: "2026-11-01", onboardingSource: "approved",
  rangeStart: "2026-11-01", trackedFrom: "2026-11-01", trackingStartDate: "2026-10-01", today: "2026-11-05",
  days: [day("2026-11-05", 0), day("2026-11-04", 110), day("2026-11-03", 45), day("2026-11-02", 130), day("2026-11-01", 85)],
  totalMinutes: 370, averageDailyMinutes: 74, activeDays: 4, trackedDays: 5, truncated: false, ...over,
});
const ok = (data: unknown) => ({ success: true, data, error: null });

const renderModal = (onClose = vi.fn()) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><DailyTimeSpentModal open onClose={onClose} /></QueryClientProvider>);
  return onClose;
};
const rows = () => screen.getAllByTestId("dts-row").map((r) => [...r.querySelectorAll("td")].map((td) => td.textContent));

beforeEach(() => get.mockReset());
afterEach(cleanup);

describe("formatDuration / formatDay", () => {
  it("formats minutes as hours and minutes", () => {
    expect([0, 45, 60, 85, 130, 61].map(formatDuration)).toEqual(["0 min", "45 min", "1 hr", "1 hr 25 min", "2 hrs 10 min", "1 hr 1 min"]);
  });
  it("shows the stored IST calendar day, whatever the viewer's timezone", () => {
    expect(formatDay("2026-11-01")).toBe("01 Nov 2026");
  });
});

describe("DailyTimeSpentModal", () => {
  it("loads the member's own history from /api/user/activity/history", async () => {
    get.mockResolvedValue(ok(history()));
    renderModal();
    await screen.findByTestId("dts-table");
    expect(get).toHaveBeenCalledWith("/api/user/activity/history");
  });

  it("header: title, member, onboarding date, total and average", async () => {
    get.mockResolvedValue(ok(history()));
    renderModal();
    await screen.findByTestId("dts-total"); // data loaded
    const dialog = screen.getByRole("dialog", { name: "Daily Time Spent" });
    expect(dialog.querySelector("h2")!.textContent).toBe("Daily Time Spent");
    expect(dialog.querySelector("h2 + p")!.textContent).toBe("Priya K · Onboarded 01 Nov 2026");
    expect(screen.getByTestId("dts-total").textContent).toBe("6 hrs 10 min");
    expect(screen.getByTestId("dts-average").textContent).toBe("1 hr 14 min");
  });

  it("table: newest first, with weekday, time spent, and zero-use days", async () => {
    get.mockResolvedValue(ok(history()));
    renderModal();
    await screen.findByTestId("dts-table");
    expect(rows()).toEqual([
      ["05 Nov 2026(today)", "Thursday", "0 min"],
      ["04 Nov 2026", "Wednesday", "1 hr 50 min"],
      ["03 Nov 2026", "Tuesday", "45 min"],
      ["02 Nov 2026", "Monday", "2 hrs 10 min"],
      ["01 Nov 2026", "Sunday", "1 hr 25 min"],
    ]);
  });

  it("date-range filter updates the rows and the period total", async () => {
    get.mockResolvedValue(ok(history()));
    renderModal();
    await screen.findByTestId("dts-table");
    expect(screen.getByTestId("dts-period-total").textContent).toContain("5 days · 6 hrs 10 min");
    await userEvent.setup().selectOptions(screen.getByLabelText("Date range"), "7");
    expect(rows()).toHaveLength(5);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Date range"), "custom");
    await user.type(screen.getByLabelText("From"), "2026-11-03");
    await user.type(screen.getByLabelText("To"), "2026-11-04");
    expect(rows().map((r) => r[0])).toEqual(["04 Nov 2026", "03 Nov 2026"]);
    expect(screen.getByTestId("dts-period-total").textContent).toContain("2 days · 2 hrs 35 min");
  });

  it("long histories page with Load more", async () => {
    const days = Array.from({ length: 70 }, (_, i) => day(new Date(Date.UTC(2026, 10, 5) - i * 86_400_000).toISOString().slice(0, 10), 10));
    get.mockResolvedValue(ok(history({ days, trackedDays: 70, rangeStart: days[69].date, trackedFrom: days[69].date })));
    renderModal();
    await screen.findByTestId("dts-table");
    expect(rows()).toHaveLength(30);
    await userEvent.setup().click(screen.getByRole("button", { name: /Load more \(40 more days\)/ }));
    expect(rows()).toHaveLength(60);
  });

  it("says when days before tracking started weren't recorded (never shows them as 0)", async () => {
    get.mockResolvedValue(ok(history({ rangeStart: "2026-10-20", trackedFrom: "2026-11-01", onboardingDate: "2026-10-20" })));
    renderModal();
    expect((await screen.findByTestId("dts-untracked")).textContent).toContain("Time tracking started on 01 Nov 2026. Days from 20 Oct 2026 to 31 Oct 2026");
    expect(rows().map((r) => r[0])).not.toContain("31 Oct 2026");
  });

  it("new member with nothing tracked: an honest empty state", async () => {
    get.mockResolvedValue(ok(history({ days: [], trackedFrom: null, totalMinutes: 0, averageDailyMinutes: 0, activeDays: 0, trackedDays: 0 })));
    renderModal();
    expect((await screen.findByTestId("dts-empty")).textContent).toContain("No time has been tracked");
  });

  it("closes with the close button and with Escape", async () => {
    get.mockResolvedValue(ok(history()));
    const onClose = renderModal();
    await screen.findByTestId("dts-table");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows a retry when the request fails", async () => {
    get.mockResolvedValue({ success: false, data: null, error: { message: "boom" } });
    renderModal();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeTruthy();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WeeklyActivityGraph from "./WeeklyActivityGraph";

// Exercises the real service → hook → component chain. Only the HTTP client is
// replaced; it returns what lib/api/client.ts's response interceptor yields
// (the backend body, `response.data`).
const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ default: { get } }));
vi.mock("@/lib/context/SiteConfigContext", () => ({ useSiteConfig: () => ({ uiStrings: null }) }));

// Captured verbatim from GET /api/user-batch/weekly-graph on the production
// backend code (commit affbff77) running against a seeded local database, for
// an authenticated member on program day 10 (task ids shortened).
const REAL_RESPONSE = {"success":true,"data":{"totalDays":21,"currentDay":10,"currentWeek":2,"hasActivities":true,"weeks":[{"weekNumber":1,"startDay":1,"endDay":7,"isCurrent":false,"activities":[{"taskId":"task-1","title":"W1 intro video","dayNumber":1,"isRequired":true,"status":"completed","completed":true},{"taskId":"task-2","title":"W1 worksheet","dayNumber":2,"isRequired":true,"status":"needs_revision","completed":false},{"taskId":"task-3","title":"W1 optional reading","dayNumber":3,"isRequired":false,"status":"not_started","completed":false},{"taskId":"task-4","title":"Program-wide task","dayNumber":5,"isRequired":true,"status":"not_started","completed":false},{"taskId":"task-5","title":"Alice private task","dayNumber":6,"isRequired":true,"status":"not_started","completed":false}],"total":5,"completed":1,"requiredTotal":4,"requiredCompleted":1,"completionPercent":20},{"weekNumber":2,"startDay":8,"endDay":14,"isCurrent":true,"activities":[{"taskId":"task-6","title":"W2 submitted task","dayNumber":9,"isRequired":true,"status":"submitted","completed":false},{"taskId":"task-7","title":"W2 today task","dayNumber":10,"isRequired":true,"status":"not_started","completed":false}],"total":2,"completed":0,"requiredTotal":2,"requiredCompleted":0,"completionPercent":0},{"weekNumber":3,"startDay":15,"endDay":21,"isCurrent":false,"activities":[{"taskId":"task-8","title":"W3 upcoming task","dayNumber":16,"isRequired":true,"status":"upcoming","completed":false}],"total":1,"completed":0,"requiredTotal":1,"requiredCompleted":0,"completionPercent":0}],"summary":{"total":8,"completed":1,"completionPercent":13}},"error":null};

const renderGraph = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <WeeklyActivityGraph />
    </QueryClientProvider>,
  );
};

beforeEach(() => get.mockReset());
afterEach(cleanup);

describe("WeeklyActivityGraph with the real API response", () => {
  it("requests the member's graph from /api/user-batch/weekly-graph", async () => {
    get.mockResolvedValue(REAL_RESPONSE);
    renderGraph();
    await screen.findByRole("img", { name: "Weekly Activity Graph" });
    expect(get).toHaveBeenCalledWith("/api/user-batch/weekly-graph");
  });

  it("draws one dot per activity with its real status, and opens on the current week", async () => {
    get.mockResolvedValue(REAL_RESPONSE);
    const { container } = renderGraph();
    await screen.findByRole("img", { name: "Weekly Activity Graph" });

    // Every activity dot carries a "<Day n> · <title> · <status>" tooltip.
    const dotTitles = [...container.querySelectorAll("circle > title")].map((t) => t.textContent);
    expect(dotTitles).toEqual([
      "Day 1 · W1 intro video · Completed",
      "Day 2 · W1 worksheet · Needs revision",
      "Day 3 · W1 optional reading · Not started",
      "Day 5 · Program-wide task · Not started",
      "Day 6 · Alice private task · Not started",
      "Day 9 · W2 submitted task · Awaiting review",
      "Day 10 · W2 today task · Not started",
      "Day 16 · W3 upcoming task · Upcoming",
    ]);

    // Current week (2) is selected by default and lists both activities in words.
    const detail = screen.getByText(/^Week 2 · 0\/2/).parentElement!;
    expect(within(detail).getByText("W2 submitted task")).toBeTruthy();
    expect(within(detail).getByText("Awaiting review")).toBeTruthy();
    expect(within(detail).getByText("W2 today task")).toBeTruthy();
  });

  it("shows the error message when the API reports a failure", async () => {
    get.mockResolvedValue({ success: false, data: null, error: "boom" });
    renderGraph();
    expect(await screen.findByText("Could not load your weekly graph.")).toBeTruthy();
  });

  it("renders nothing for a member who is not in a batch (data: null)", async () => {
    get.mockResolvedValue({ success: true, data: null, error: null });
    const { container } = renderGraph();
    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector(".animate-pulse")).toBeNull());
    expect(container.textContent).toBe("");
  });

  it("shows the empty state instead of a graph when nothing is assigned", async () => {
    get.mockResolvedValue({
      success: true, error: null,
      data: { ...REAL_RESPONSE.data, hasActivities: false, weeks: [], summary: { total: 0, completed: 0, completionPercent: null } },
    });
    renderGraph();
    expect(await screen.findByText("No activities have been assigned to your program yet.")).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Weekly Activity Graph" })).toBeNull();
  });
});

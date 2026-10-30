import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WeeklyActivityGraph from "./WeeklyActivityGraph";

// Exercises the real service → hook → component chain. Only the HTTP client is
// replaced; it returns what lib/api/client.ts's response interceptor yields
// (the backend body, `response.data`), shaped exactly like buildWeeklyGraph's
// output (backend lib/weeklyGraphLogic.ts).
const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ default: { get } }));
const siteConfig = vi.hoisted(() => ({ value: { uiStrings: null, hiddenMenuKeys: [] as string[] } }));
vi.mock("@/lib/context/SiteConfigContext", () => ({ useSiteConfig: () => siteConfig.value }));

const activity = (taskId: string, title: string, dayNumber: number, status: string, milestone: [string, string, number] | null) => ({
  taskId, title, dayNumber, isRequired: true, status, completed: status === "completed",
  milestoneId: milestone?.[0] ?? null, milestoneLabel: milestone?.[1] ?? null, level: milestone?.[2] ?? 0,
});
const week = (n: number, extra: Record<string, unknown> = {}) => ({
  weekNumber: n, startDay: (n - 1) * 7 + 1, endDay: n * 7, isCurrent: false, activities: [], total: 0, completed: 0,
  requiredTotal: 0, requiredCompleted: 0, completionPercent: null, progressLevel: null, weekId: `w${n}`, label: `W${n}`,
  revenue: null, cumulativeRevenue: null, ...extra,
});
const ms = (id: string, label: string, kind: "activity" | "revenue", extra: Record<string, unknown> = {}) => ({
  id, label, kind, reached: false, dayNumber: null, threshold: null, reachedBy: null, reachedWeek: null, ...extra,
});

/** A member on day 10 of a program the admin configured with W1–W3 and ₹1 Lakh / ₹5 Lakhs thresholds. */
const graphData = () => ({
  totalDays: 21, currentDay: 10, currentWeek: 2, hasActivities: true,
  weeks: [
    week(1, {
      activities: [
        activity("t-ads", "Ads W1", 2, "completed", ["m-ads", "Ads", 1]),
        activity("t-pixel", "Install pixel", 3, "submitted", ["m-ads", "Ads", 1]),
        activity("t-read", "Read the playbook", 4, "not_started", null),
      ],
      total: 3, completed: 1, completionPercent: 33, progressLevel: 1, revenue: 60000, cumulativeRevenue: 60000,
    }),
    week(2, {
      isCurrent: true,
      activities: [activity("t-web", "Website W2", 9, "in_progress", ["m-web", "Website", 2])],
      total: 1, completed: 0, completionPercent: 0, progressLevel: 4, revenue: 50000, cumulativeRevenue: 110000,
    }),
    week(3, { activities: [activity("t-fun", "Funnels W3", 16, "upcoming", ["m-fun", "Funnels", 3])], total: 1, completionPercent: 0 }),
  ],
  summary: { total: 5, completed: 1, completionPercent: 20 },
  config: {
    source: "program",
    milestones: [
      ms("m-ads", "Ads", "activity", { reached: true, dayNumber: 2, reachedBy: "activity", reachedWeek: 1 }),
      ms("m-web", "Website", "activity", { dayNumber: 9 }),
      ms("m-fun", "Funnels", "activity", { dayNumber: 16 }),
      ms("m-1l", "₹1 Lakh", "revenue", { threshold: 100000, reached: true, reachedBy: "revenue", reachedWeek: 2 }),
      ms("m-5l", "₹5 Lakhs", "revenue", { threshold: 500000 }),
    ],
  },
  revenue: { source: "self_reported", totalToDate: 110000 },
});
const ok = (data: unknown) => ({ success: true, data, error: null });

let lastQc: QueryClient;
const renderGraph = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  lastQc = qc;
  return render(
    <QueryClientProvider client={qc}>
      <WeeklyActivityGraph />
    </QueryClientProvider>,
  );
};
const chart = () => screen.findByRole("group", { name: "Weekly Activity Graph" });
const texts = (c: HTMLElement, testId: string) => [...c.querySelectorAll(`[data-testid="${testId}"]`)].map((t) => t.textContent);
const markerY = (el: Element) => Number(el.querySelector("circle:not([fill='transparent'])")!.getAttribute("cy"));
const axisY = (c: HTMLElement, label: string) =>
  Number([...c.querySelectorAll('[data-testid="revenue-axis-label"]')].find((t) => t.textContent === label)!.getAttribute("y")) - 4;

beforeEach(() => {
  get.mockReset();
  siteConfig.value = { uiStrings: null, hiddenMenuKeys: [] };
});
afterEach(cleanup);

describe("WeeklyActivityGraph", () => {
  it("requests the member's graph from /api/user-batch/weekly-graph", async () => {
    get.mockResolvedValue(ok(graphData()));
    renderGraph();
    await chart();
    expect(get).toHaveBeenCalledWith("/api/user-batch/weekly-graph");
  });

  it("the Y axis is Revenue Generated (₹): ₹0 and Indian-unit steps, no task-stage labels; weeks unchanged", async () => {
    get.mockResolvedValue(ok(graphData())); // best week ₹60,000 → scale up to ₹1 Lakh
    const { container } = renderGraph();
    await chart();
    expect(texts(container, "revenue-axis-label")).toEqual(["₹1 Lakh", "₹0"]);
    expect(axisY(container, "₹1 Lakh")).toBeLessThan(axisY(container, "₹0"));
    expect(texts(container, "milestone-label")).toEqual([]);
    const axisText = texts(container, "revenue-axis-label").join(" ");
    for (const stage of ["Start", "Ads", "Website", "Funnels"]) expect(axisText).not.toContain(stage);
    expect(texts(container, "week-label")).toEqual(["W1", "W2", "W3"]);
  });

  it("the scale follows the data: a ₹12 Lakhs week puts the top at ₹25 Lakhs; a ₹1.5 Crores week at ₹2 Crores", async () => {
    const data: any = graphData();
    data.weeks[1].revenue = 1200000;
    get.mockResolvedValue(ok(data));
    const { container } = renderGraph();
    await chart();
    expect(texts(container, "revenue-axis-label")).toEqual(["₹5 Lakhs", "₹10 Lakhs", "₹25 Lakhs", "₹0"]);
    cleanup();

    const big: any = graphData();
    big.weeks[1].revenue = 15000000;
    get.mockResolvedValue(ok(big));
    const r = renderGraph();
    await chart();
    expect(texts(r.container, "revenue-axis-label")).toEqual(["₹25 Lakhs", "₹50 Lakhs", "₹1 Crore", "₹2 Crores", "₹0"]);
  });

  it("puts one focusable marker per activity in its week, in a row on the ₹0 baseline; several in one week stay separate", async () => {
    get.mockResolvedValue(ok(graphData()));
    const { container } = renderGraph();
    await chart();
    const markers = screen.getAllByRole("button", { name: /^W\d/ }).filter((b) => b.getAttribute("data-testid") === "activity-marker");
    expect(markers.map((m) => m.getAttribute("aria-label"))).toEqual([
      "W1, Ads, Ads W1, Completed",
      "W1, Ads, Install pixel, Awaiting approval",
      "W1, No milestone, Read the playbook, Not started",
      "W2, Website, Website W2, In progress",
      "W3, Funnels, Funnels W3, Upcoming",
    ]);
    expect(markers.every((m) => m.getAttribute("tabindex") === "0")).toBe(true);
    expect(markers.every((m) => markerY(m) === axisY(container, "₹0"))).toBe(true);
    // The three W1 markers do not overlap.
    const xs = markers.slice(0, 3).map((m) => Number(m.querySelector("circle:not([fill='transparent'])")!.getAttribute("cx")));
    expect(Math.min(xs[1] - xs[0], xs[2] - xs[1])).toBeGreaterThanOrEqual(12);
  });

  it("clicking a marker opens a popup with Week, Milestone and Activity; Escape closes it and returns focus", async () => {
    get.mockResolvedValue(ok(graphData()));
    renderGraph();
    await chart();
    const user = userEvent.setup();
    const marker = screen.getByRole("button", { name: "W2, Website, Website W2, In progress" });
    await user.click(marker);
    const dialog = screen.getByRole("dialog", { name: "Activity details" });
    const d = within(dialog);
    expect(d.getByText("Week").nextSibling!.textContent).toBe("W2");
    expect(d.getByText("Milestone").nextSibling!.textContent).toBe("Website");
    expect(d.getByText("Activity").nextSibling!.textContent).toBe("Website W2");
    expect(d.getByText("Status").nextSibling!.textContent).toBe("In progress");
    expect(marker.getAttribute("aria-expanded")).toBe("true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(marker);
  });

  it("is keyboard operable: Tab to a marker, Enter opens, the close button closes", async () => {
    get.mockResolvedValue(ok(graphData()));
    renderGraph();
    await chart();
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("W1, Ads, Ads W1, Completed");
    await user.keyboard("{Enter}");
    expect(within(screen.getByRole("dialog")).getByText("Ads W1")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("draws no revenue-milestone diamonds; the reported revenue total is still shown", async () => {
    get.mockResolvedValue(ok(graphData()));
    renderGraph();
    await chart();
    expect(screen.queryAllByTestId("revenue-marker")).toHaveLength(0);
    expect(screen.queryByText("Revenue milestone reached")).toBeNull();
    expect(screen.getByTestId("revenue-total").textContent).toBe("Reported revenue to date: ₹1,10,000");
  });

  it("never shows an unreached revenue milestone as reached, even when an activity is linked to it", async () => {
    const data: any = graphData();
    data.config.milestones[3] = ms("m-1l", "₹1 Lakh", "revenue", { threshold: 100000 });
    data.weeks[0].activities.push(activity("t-rev", "Close first ₹1 Lakh month", 5, "completed", ["m-1l", "₹1 Lakh", 4]));
    data.revenue = { source: "self_reported", totalToDate: null };
    get.mockResolvedValue(ok(data));
    renderGraph();
    await chart();
    expect(screen.queryAllByTestId("revenue-marker")).toHaveLength(0);
    expect(screen.queryByTestId("revenue-total")).toBeNull();
    // The activity marker sits on that row; its own status is shown, nothing more.
    expect(screen.getByRole("button", { name: "W1, ₹1 Lakh, Close first ₹1 Lakh month, Completed" })).toBeTruthy();
  });

  describe("revenue line", () => {
    /**
     * Reported revenue per program week (week.revenue from the API):
     *  W1 ₹1,00,000 · W2 ₹3,00,000 (up) · W3 ₹2,00,000 (down) · W4 nothing reported · W5 ₹4,00,000
     *  → scale up to ₹5 Lakhs.
     */
    const weeksData = () => {
      const data: any = graphData();
      data.currentDay = 31;
      data.currentWeek = 5;
      data.weeks = [
        week(1, { activities: [activity("t1", "Ads W1", 2, "completed", ["m-ads", "Ads", 1])], total: 1, completed: 1, progressLevel: 1, revenue: 100000 }),
        week(2, { activities: [activity("t2", "Funnels W2", 9, "completed", ["m-fun", "Funnels", 3])], total: 1, completed: 1, progressLevel: 3, revenue: 300000 }),
        week(3, { activities: [activity("t3", "Website W3", 16, "submitted", ["m-web", "Website", 2])], total: 1, progressLevel: 0, revenue: 200000 }),
        week(4, { activities: [activity("t4", "Reel W4", 23, "completed", null)], total: 1, completed: 1, progressLevel: 0.5, revenue: null }),
        week(5, { isCurrent: true, activities: [activity("t5", "Draft W5", 30, "in_progress", null)], total: 1, revenue: 400000 }),
      ];
      return data;
    };
    const line = (container: HTMLElement) => container.querySelector('[data-testid="progress-line"]');
    const dots = (container: HTMLElement) =>
      [...container.querySelectorAll('[data-testid="progress-point"]')].map((c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))]);
    const weekX = (label: string) => Number(screen.getAllByTestId("week-label").find((el) => el.textContent === label)!.getAttribute("x"));
    // ₹ → y on the drawn scale, from the ₹0 and top labels (linear)
    const yOf = (container: HTMLElement, v: number, top = 500000, topLabel = "₹5 Lakhs") => {
      const y0 = axisY(container, "₹0");
      return y0 - (v / top) * (y0 - axisY(container, topLabel));
    };

    it("one point per week at its actual revenue, proportional to the amount; up and down week to week", async () => {
      get.mockResolvedValue(ok(weeksData()));
      const { container } = renderGraph();
      await chart();
      expect(texts(container, "revenue-axis-label")).toEqual(["₹1 Lakh", "₹5 Lakhs", "₹0"]);
      const d = dots(container);
      expect(d.map(([x]) => x)).toEqual(["W1", "W2", "W3", "W5"].map(weekX)); // W4: nothing reported → no point
      [100000, 300000, 200000, 400000].forEach((v, i) => expect(d[i][1]).toBeCloseTo(yOf(container, v), 6));
      expect(d[0][1]).toBeCloseTo(axisY(container, "₹1 Lakh"), 6); // ₹1,00,000 sits on the ₹1 Lakh gridline
      expect(d[1][1]).toBeLessThan(d[0][1]); // up
      expect(d[2][1]).toBeGreaterThan(d[1][1]); // down
    });

    it("joins consecutive weeks with the red line and breaks it at a week with nothing reported (never ₹0)", async () => {
      get.mockResolvedValue(ok(weeksData()));
      const { container } = renderGraph();
      await chart();
      const d = dots(container);
      expect(line(container)!.getAttribute("d")).toBe(
        `M ${d[0][0]},${d[0][1]} L ${d[1][0]},${d[1][1]} L ${d[2][0]},${d[2][1]} M ${d[3][0]},${d[3][1]}`,
      );
      expect(container.querySelectorAll('[data-testid="progress-point"] title')[1].textContent).toBe("W2: ₹3,00,000 revenue generated");
    });

    it("task stages and statuses never move the line — only revenue does", async () => {
      get.mockResolvedValue(ok(weeksData()));
      const { container } = renderGraph();
      await chart();
      const before = dots(container);
      const other = weeksData();
      other.weeks = other.weeks.map((w: any) => ({
        ...w, progressLevel: 6, completed: 0,
        activities: w.activities.map((a: any) => ({ ...a, status: "not_started", completed: false })),
      }));
      lastQc.setQueryData(["my-batch", "weekly-graph"], other);
      await waitFor(() => expect(screen.getByRole("button", { name: "W1, Ads, Ads W1, Not started" })).toBeTruthy());
      expect(dots(container)).toEqual(before);
    });

    it("follows refreshed revenue: a newly reported week appears and the scale grows", async () => {
      get.mockResolvedValue(ok(weeksData()));
      const { container } = renderGraph();
      await chart();
      const later = weeksData();
      later.weeks[3].revenue = 800000; // W4 now reported → top ₹10 Lakhs
      lastQc.setQueryData(["my-batch", "weekly-graph"], later);
      await waitFor(() => expect(dots(container)).toHaveLength(5));
      expect(texts(container, "revenue-axis-label")).toEqual(["₹1 Lakh", "₹5 Lakhs", "₹10 Lakhs", "₹0"]);
      expect(dots(container)[3][1]).toBeCloseTo(yOf(container, 800000, 1000000, "₹10 Lakhs"), 6);
      expect(line(container)!.getAttribute("d")!.match(/M /g)).toHaveLength(1); // no gap any more
    });

    it("no reported revenue: no line and no points (nothing fabricated); the axis still shows ₹0 – ₹1 Lakh", async () => {
      const data = weeksData();
      data.weeks = data.weeks.map((w: any) => ({ ...w, revenue: null }));
      get.mockResolvedValue(ok(data));
      const { container } = renderGraph();
      await chart();
      expect(line(container)).toBeNull();
      expect(dots(container)).toEqual([]);
      expect(texts(container, "revenue-axis-label")).toEqual(["₹1 Lakh", "₹0"]);
      expect(screen.getAllByTestId("activity-marker")).toHaveLength(5);
    });

    it("is drawn red and under the markers, so marker borders stay visible", async () => {
      get.mockResolvedValue(ok(weeksData()));
      const { container } = renderGraph();
      await chart();
      const l = line(container)!;
      expect(l.getAttribute("stroke")).toBe("var(--color-accent, #dc2626)");
      expect(Number(l.getAttribute("stroke-width"))).toBe(2);
      expect(l.getAttribute("d")).toMatch(/^M [\d.]+,[\d.]+( [ML] [\d.]+,[\d.]+)+$/); // straight segments, no curves
      for (const dot of container.querySelectorAll('[data-testid="progress-point"]')) expect(dot.getAttribute("r")).toBe("2.5");
      const firstMarker = container.querySelector('[data-testid="activity-marker"]')!;
      expect(l.compareDocumentPosition(firstMarker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("keeps the status legend unchanged", async () => {
      get.mockResolvedValue(ok(weeksData()));
      renderGraph();
      await chart();
      for (const label of ["Completed", "Awaiting approval", "Not started"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  });

  it("does not crash on missing values (no activities, no summary, no revenue, no levels)", async () => {
    get.mockResolvedValue(ok({
      totalDays: 7, currentDay: 1, currentWeek: 1, hasActivities: false,
      weeks: [{ weekNumber: 1, startDay: 1, endDay: 7, isCurrent: true, progressLevel: 0, activities: [{ taskId: "x", title: "Old payload", dayNumber: 1, isRequired: true, status: "not_started", completed: false }] }],
    }));
    renderGraph();
    await chart();
    expect(screen.getByRole("button", { name: "W1, No milestone, Old payload, Not started" })).toBeTruthy();
  });

  it("shows a message when no weeks are configured", async () => {
    get.mockResolvedValue(ok({ ...graphData(), weeks: [] }));
    renderGraph();
    expect(await screen.findByText("No weeks have been set up for your program yet.")).toBeTruthy();
  });

  it("shows the error message when the API reports a failure", async () => {
    get.mockResolvedValue({ success: false, data: null, error: { message: "boom" } });
    renderGraph();
    expect(await screen.findByText("Could not load your weekly graph.")).toBeTruthy();
  });

  it("renders nothing for a member who is not in a batch (data: null)", async () => {
    get.mockResolvedValue(ok(null));
    const { container } = renderGraph();
    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector(".animate-pulse")).toBeNull());
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing and makes no request when the admin hides it (weekly_graph)", async () => {
    siteConfig.value = { uiStrings: null, hiddenMenuKeys: ["weekly_graph"] };
    const { container } = renderGraph();
    expect(container.innerHTML).toBe("");
    expect(get).not.toHaveBeenCalled();
  });
});

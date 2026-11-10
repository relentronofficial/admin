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
// A fake socket: tests emit the backend's events to it to check the live refresh.
const fakeSocket = vi.hoisted(() => {
  const handlers = new Map<string, Set<(...a: unknown[]) => void>>();
  return {
    handlers,
    on: (e: string, fn: (...a: unknown[]) => void) => { if (!handlers.has(e)) handlers.set(e, new Set()); handlers.get(e)!.add(fn); },
    off: (e: string, fn: (...a: unknown[]) => void) => { handlers.get(e)?.delete(fn); },
    emit: (e: string, payload?: unknown) => { for (const fn of handlers.get(e) ?? []) fn(payload); },
  };
});
vi.mock("@/lib/socket/client", () => ({ getSocket: async () => fakeSocket }));

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
const labelY = (c: HTMLElement, label: string) =>
  Number([...c.querySelectorAll('[data-testid="milestone-label"]')].find((t) => t.textContent === label)!.getAttribute("y")) - 4;

const points = (c: HTMLElement) => [...c.querySelectorAll('[data-testid="milestone-point"]')];
const pointXY = (el: Element) => {
  const dot = el.querySelector("circle[fill='var(--color-accent, #dc2626)']")!;
  return [Number(dot.getAttribute("cx")), Number(dot.getAttribute("cy"))];
};
const lineD = (c: HTMLElement) => c.querySelector('[data-testid="progress-line"]')?.getAttribute("d") ?? null;
/** Every [x, y] the straight line reaches: the origin, then each segment's end point. */
const linePts = (c: HTMLElement) =>
  lineD(c)!.trim().split(/(?=[ML])/).map((seg) => seg.slice(1).trim().split(",").map(Number));
const weekX = (c: HTMLElement, label: string) =>
  Number([...c.querySelectorAll('[data-testid="week-label"]')].find((t) => t.textContent === label)!.getAttribute("x"));

/** 13-week program; approved progress: W1 Ads, W2 Website, W3 nothing new, W4 Funnels; W5 current with only pending work. */
const growthData = () => {
  const data: any = graphData();
  data.totalDays = 91;
  data.currentWeek = 5;
  data.weeks = Array.from({ length: 13 }, (_, i) => week(i + 1));
  data.weeks[0] = week(1, { activities: [activity("a1", "Launch ad", 2, "completed", ["m-ads", "Ads", 1])], total: 1, completed: 1, progressLevel: 1 });
  data.weeks[1] = week(2, { activities: [activity("a2", "Build site", 9, "completed", ["m-web", "Website", 2])], total: 1, completed: 1, progressLevel: 2 });
  data.weeks[2] = week(3, { activities: [activity("a3", "Polish site", 16, "completed", ["m-web", "Website", 2])], total: 1, completed: 1, progressLevel: 2 });
  data.weeks[3] = week(4, { activities: [activity("a4", "Funnel", 23, "completed", ["m-fun", "Funnels", 3])], total: 1, completed: 1, progressLevel: 3, revenue: 40000, cumulativeRevenue: 40000 });
  data.weeks[4] = week(5, {
    isCurrent: true,
    activities: [activity("a5", "Big launch", 30, "submitted", ["m-1l", "₹1 Lakh", 4]), activity("a6", "Retarget", 31, "in_progress", ["m-5l", "₹5 Lakhs", 5])],
    total: 2, completed: 0, progressLevel: 0,
  });
  data.config.milestones = [
    ms("m-ads", "Ads", "activity", { reached: true, reachedBy: "activity", reachedWeek: 1 }),
    ms("m-web", "Website", "activity", { reached: true, reachedBy: "activity", reachedWeek: 2 }),
    ms("m-fun", "Funnels", "activity", { reached: true, reachedBy: "activity", reachedWeek: 4 }),
    ms("m-1l", "₹1 Lakh", "revenue", { threshold: 100000 }),
    ms("m-5l", "₹5 Lakhs", "revenue", { threshold: 500000 }),
  ];
  data.summary = { total: 6, completed: 4, completionPercent: 67 };
  data.revenue = { source: "self_reported", totalToDate: 40000 };
  return data;
};

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

  it("Y axis: exactly the configured milestones, bottom → top, each with its own guide line", async () => {
    get.mockResolvedValue(ok(growthData()));
    const { container } = renderGraph();
    await chart();
    const labels = ["Ads", "Website", "Funnels", "₹1 Lakh", "₹5 Lakhs"];
    expect(texts(container, "milestone-label")).toEqual(labels);
    const ys = labels.map((l) => labelY(container, l));
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1]); // higher milestone = higher on screen
    const guides = [...container.querySelectorAll("line[stroke-dasharray]")].map((l) => Number(l.getAttribute("y1")));
    expect(guides).toEqual(ys);
  });

  it("X axis: the program's weeks W1 → W13, left to right along the bottom", async () => {
    get.mockResolvedValue(ok(growthData()));
    const { container } = renderGraph();
    await chart();
    const labels = Array.from({ length: 13 }, (_, i) => `W${i + 1}`);
    expect(texts(container, "week-label")).toEqual(labels);
    const xs = labels.map((l) => weekX(container, l));
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    expect(container.querySelectorAll('[data-testid="axes"] line')).toHaveLength(2); // vertical Y axis + horizontal X axis
  });

  it("hardcodes no milestone labels: an older response without config draws none", async () => {
    const data: any = graphData();
    delete data.config;
    get.mockResolvedValue(ok(data));
    const { container } = renderGraph();
    await chart();
    expect(texts(container, "milestone-label")).toEqual([]);
  });

  describe("growth line", () => {
    it("starts at the bottom-left origin and joins the achievement points with straight segments", async () => {
      get.mockResolvedValue(ok(growthData()));
      const { container } = renderGraph();
      await chart();
      expect(lineD(container)).toMatch(/^M [\d.]+,[\d.]+( L [\d.]+,[\d.]+)+$/);
      const [origin, ...rest] = linePts(container);
      const axes = container.querySelectorAll('[data-testid="axes"] line');
      const axisX = Number(axes[0].getAttribute("x1"));
      const axisY = Number(axes[1].getAttribute("y1"));
      expect(origin).toEqual([axisX, axisY]); // where the axes meet: week 0, below Ads
      expect(origin[0]).toBeLessThan(weekX(container, "W1"));
      expect(origin[1]).toBeGreaterThan(labelY(container, "Ads"));
      expect(rest).toEqual(points(container).map(pointXY)); // a circle at every corner of the line
    });

    it("rises with the milestones actually achieved: W1 Ads, W2 Website, W4 Funnels", async () => {
      get.mockResolvedValue(ok(growthData()));
      const { container } = renderGraph();
      await chart();
      expect(points(container).map(pointXY)).toEqual([
        [weekX(container, "W1"), labelY(container, "Ads")],
        [weekX(container, "W2"), labelY(container, "Website")],
        [weekX(container, "W4"), labelY(container, "Funnels")],
      ]);
      const ys = linePts(container).map(([, y]) => y);
      for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1]); // only ever up
    });

    it("never counts pending work: W5's awaiting-approval / in-progress tasks add no point", async () => {
      get.mockResolvedValue(ok(growthData()));
      const { container } = renderGraph();
      await chart();
      expect(points(container).map(pointXY).map(([x]) => x)).not.toContain(weekX(container, "W5"));
      expect(Math.min(...linePts(container).map(([, y]) => y))).toBe(labelY(container, "Funnels"));
      expect(screen.queryByRole("button", { name: /Big launch|Retarget/ })).toBeNull();
    });

    it("a week that falls back (less progress than before) gets no point and never pulls the line down", async () => {
      const data = growthData();
      data.weeks[2].progressLevel = 1; // W3 less than W2's Website
      get.mockResolvedValue(ok(data));
      const { container } = renderGraph();
      await chart();
      expect(points(container).map(pointXY).map(([x]) => x)).toEqual(["W1", "W2", "W4"].map((l) => weekX(container, l)));
    });

    it("revenue progress lifts the line to the revenue rows (from the backend's progressLevel)", async () => {
      const data = growthData();
      data.weeks[5] = week(6, { progressLevel: 4, revenue: 70000, cumulativeRevenue: 110000 });
      data.weeks[6] = week(7, { progressLevel: 4.5, revenue: 190000, cumulativeRevenue: 300000 });
      data.config.milestones[3] = ms("m-1l", "₹1 Lakh", "revenue", { threshold: 100000, reached: true, reachedBy: "revenue", reachedWeek: 6 });
      get.mockResolvedValue(ok(data));
      const { container } = renderGraph();
      await chart();
      const last = points(container).slice(-2).map(pointXY);
      expect(last[0]).toEqual([weekX(container, "W6"), labelY(container, "₹1 Lakh")]);
      expect(last[1][1]).toBeLessThan(labelY(container, "₹1 Lakh"));
      expect(last[1][1]).toBeGreaterThan(labelY(container, "₹5 Lakhs"));
    });

    it("updates when the admin approves a milestone (refetched data adds the point)", async () => {
      get.mockResolvedValue(ok(growthData()));
      const { container } = renderGraph();
      await chart();
      expect(points(container)).toHaveLength(3);
      const later = growthData();
      later.weeks[4].activities[0] = activity("a5", "Big launch", 30, "completed", ["m-1l", "₹1 Lakh", 4]);
      later.weeks[4].completed = 1;
      later.weeks[4].progressLevel = 4;
      lastQc.setQueryData(["my-batch", "weekly-graph"], later);
      await waitFor(() => expect(points(container)).toHaveLength(4));
      expect(pointXY(points(container)[3])).toEqual([weekX(container, "W5"), labelY(container, "₹1 Lakh")]);
    });

    it("nothing approved yet: no line, no points, and a short note (nothing fabricated)", async () => {
      const data = growthData();
      data.weeks = data.weeks.map((w: any) => ({ ...w, progressLevel: w.progressLevel === null ? null : 0 }));
      get.mockResolvedValue(ok(data));
      const { container } = renderGraph();
      await chart();
      expect(lineD(container)).toBeNull();
      expect(points(container)).toHaveLength(0);
      expect(screen.getByTestId("no-progress")).toBeTruthy();
    });

    it("is red, 3px and never blocks clicks on the markers", async () => {
      get.mockResolvedValue(ok(growthData()));
      const { container } = renderGraph();
      await chart();
      const l = container.querySelector('[data-testid="progress-line"]')!;
      expect(l.getAttribute("stroke")).toBe("var(--color-accent, #dc2626)");
      expect(Number(l.getAttribute("stroke-width"))).toBe(3);
      expect(l.getAttribute("pointer-events")).toBe("none");
    });
  });

  describe("admin-configured milestones not approved yet (planned)", () => {
    const planned = (c: HTMLElement) => [...c.querySelectorAll('[data-testid="planned-milestone"]')];
    const plannedXY = (el: Element) => {
      const dot = el.querySelector("circle[fill='var(--color-bg-surface)']")!;
      return [Number(dot.getAttribute("cx")), Number(dot.getAttribute("cy"))];
    };

    it("shows each on its week and milestone row, hollow and off the line", async () => {
      get.mockResolvedValue(ok(growthData())); // W3: approved Website task (no new high); W5: awaiting 1 Lakh, in-progress 5 Lakhs
      const { container } = renderGraph();
      await chart();
      const xy = (el: Element) => {
        const dot = el.querySelector("circle[stroke-width='2']:not([fill='none'])")!;
        return [Number(dot.getAttribute("cx")), Number(dot.getAttribute("cy"))];
      };
      expect(planned(container).map(xy)).toEqual([
        [weekX(container, "W3"), labelY(container, "Website")],
        [weekX(container, "W5"), labelY(container, "₹1 Lakh")],
        [weekX(container, "W5"), labelY(container, "₹5 Lakhs")],
      ]);
      // The approved W3 activity is shown filled; the pending W5 ones hollow.
      expect(screen.getByRole("button", { name: "W3, Website, Approved" })).toBeTruthy();
      // Never on the line and never counted: the line still tops out at Funnels (W4).
      expect(linePts(container).map(([x]) => x)).not.toContain(weekX(container, "W5"));
      expect(points(container)).toHaveLength(3);
    });

    it("a member with configured milestones but nothing approved sees them (no line, nothing counted)", async () => {
      const data = growthData();
      data.weeks = data.weeks.map((w: any) => ({
        ...w,
        progressLevel: w.progressLevel === null ? null : 0,
        completed: 0,
        activities: w.activities.map((a: any) => ({ ...a, status: "not_started", completed: false })),
      }));
      get.mockResolvedValue(ok(data));
      const { container } = renderGraph();
      await chart();
      expect(lineD(container)).toBeNull();
      expect(points(container)).toHaveLength(0);
      expect(planned(container).map(plannedXY)).toEqual([
        [weekX(container, "W1"), labelY(container, "Ads")],
        [weekX(container, "W2"), labelY(container, "Website")],
        [weekX(container, "W3"), labelY(container, "Website")],
        [weekX(container, "W4"), labelY(container, "Funnels")],
        [weekX(container, "W5"), labelY(container, "₹1 Lakh")],
        [weekX(container, "W5"), labelY(container, "₹5 Lakhs")],
      ]);
    });

    it("its popup names the milestone, the week, the activities and their real status", async () => {
      get.mockResolvedValue(ok(growthData()));
      renderGraph();
      await chart();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "W5, ₹1 Lakh, Awaiting approval — not counted yet" }));
      const d = within(screen.getByRole("dialog"));
      expect(d.getByText("Week").nextSibling!.textContent).toBe("W5");
      expect(d.getByText("Milestone").nextSibling!.textContent).toBe("₹1 Lakh");
      expect(d.getByText("Status").nextSibling!.textContent).toBe("Awaiting approval — not counted yet");
      expect(d.getByText("Activity").nextSibling!.textContent).toBe("Big launch · Awaiting approval");
    });

    it("once approved it becomes a point on the line and the planned marker goes away", async () => {
      get.mockResolvedValue(ok(growthData()));
      const { container } = renderGraph();
      await chart();
      const later = growthData();
      later.weeks[4].activities[0] = activity("a5", "Big launch", 30, "completed", ["m-1l", "₹1 Lakh", 4]);
      later.weeks[4].completed = 1;
      later.weeks[4].progressLevel = 4;
      lastQc.setQueryData(["my-batch", "weekly-graph"], later);
      await waitFor(() => expect(points(container)).toHaveLength(4));
      expect(screen.queryByRole("button", { name: /^W5, ₹1 Lakh, Awaiting/ })).toBeNull();
      expect(screen.getByRole("button", { name: /^W5, ₹5 Lakhs, Awaiting/ })).toBeTruthy();
    });

    it("an activity with no milestone is shown on its week, on the baseline (never on the line)", async () => {
      const data = graphData(); // W1 has an unlinked, not-started "Read the playbook"
      get.mockResolvedValue(ok(data));
      const { container } = renderGraph();
      await chart();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "W1, No milestone, Planned — not completed yet" }));
      const d = within(screen.getByRole("dialog"));
      expect(d.getByText("Activity").nextSibling!.textContent).toBe("Read the playbook · Not started");
      const marker = planned(container).find((el) => el.getAttribute("aria-label")!.includes("No milestone"))!;
      const axisY = Number(container.querySelectorAll('[data-testid="axes"] line')[1].getAttribute("y1"));
      expect(plannedXY(marker)).toEqual([weekX(container, "W1"), axisY]);
    });

    it("a line point's popup lists that week's activities with their real status", async () => {
      get.mockResolvedValue(ok(growthData()));
      renderGraph();
      await chart();
      await userEvent.setup().click(screen.getByRole("button", { name: /^W4, Funnels/ }));
      expect(within(screen.getByRole("dialog")).getByText("Activity").nextSibling!.textContent).toBe("Funnel · Completed");
    });
  });

  it("highlights no week: no column background, every week label styled the same", async () => {
    get.mockResolvedValue(ok(growthData())); // W5 is the current week
    const { container } = renderGraph();
    await chart();
    expect(container.querySelectorAll("svg rect")).toHaveLength(0);
    const labels = screen.getAllByTestId("week-label");
    expect(new Set(labels.map((l) => `${l.getAttribute("fill")}|${l.getAttribute("font-weight")}`)).size).toBe(1);
  });

  describe("popup", () => {
    it("clicking a point shows its week, milestone, status and progress; Escape closes it and returns focus", async () => {
      get.mockResolvedValue(ok(growthData()));
      renderGraph();
      await chart();
      const user = userEvent.setup();
      const p = screen.getByRole("button", { name: "W4, Funnels, Completed — approved" });
      await user.click(p);
      const d = within(screen.getByRole("dialog", { name: "Milestone details" }));
      expect(d.getByText("Week").nextSibling!.textContent).toBe("W4");
      expect(d.getByText("Milestone").nextSibling!.textContent).toBe("Funnels");
      expect(d.getByText("Status").nextSibling!.textContent).toBe("Completed — approved");
      expect(d.getByText("Week progress").nextSibling!.textContent).toBe("1 of 1 tasks approved");
      expect(d.getByText("Revenue this week").nextSibling!.textContent).toBe("₹40,000");
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(p);
    });

    it("a mouse hover previews it; a click pins it", async () => {
      get.mockResolvedValue(ok(growthData()));
      renderGraph();
      await chart();
      const user = userEvent.setup();
      const p = screen.getByRole("button", { name: /^W2, Website/ });
      await user.hover(p);
      expect(within(screen.getByRole("dialog")).getByText("Week").nextSibling!.textContent).toBe("W2");
      await user.unhover(p);
      expect(screen.queryByRole("dialog")).toBeNull();
      await user.click(p);
      await user.unhover(p);
      expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("says how a revenue or mentor-recorded milestone was reached", async () => {
      const data = growthData();
      data.weeks[5] = week(6, { progressLevel: 4, revenue: 70000, cumulativeRevenue: 110000 });
      data.config.milestones[3] = ms("m-1l", "₹1 Lakh", "revenue", { threshold: 100000, reached: true, reachedBy: "revenue", reachedWeek: 6 });
      data.weeks[6] = week(7, { progressLevel: 5 });
      data.config.milestones[4] = ms("m-5l", "₹5 Lakhs", "revenue", { threshold: 500000, reached: true, reachedBy: "record", reachedWeek: 7 });
      get.mockResolvedValue(ok(data));
      renderGraph();
      await chart();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "W6, ₹1 Lakh, From your reported revenue" }));
      expect(within(screen.getByRole("dialog")).getByText("Revenue by then").nextSibling!.textContent).toContain("₹1,10,000");
      await user.click(screen.getByRole("button", { name: "W7, ₹5 Lakhs, Recorded by your mentor" }));
      expect(within(screen.getByRole("dialog")).getByText("Status").nextSibling!.textContent).toBe("Recorded by your mentor");
    });

    it("is keyboard operable: Tab to a point, Enter opens, the close button closes", async () => {
      get.mockResolvedValue(ok(growthData()));
      renderGraph();
      await chart();
      const user = userEvent.setup();
      await user.tab();
      expect(document.activeElement?.getAttribute("aria-label")).toBe("W1, Ads, Completed — approved");
      await user.keyboard("{Enter}");
      expect(within(screen.getByRole("dialog")).getByText("Ads")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("live sync with the admin (same API, refetched on the backend's events)", () => {
    for (const event of ["batch:graph_updated", "batch:day_approved", "batch:day_rejected"]) {
      it(`refetches the graph and the revenue figures on ${event}`, async () => {
        get.mockResolvedValue(ok(graphData()));
        renderGraph();
        await chart();
        await waitFor(() => expect(fakeSocket.handlers.get(event)?.size ?? 0).toBeGreaterThan(0));
        const spy = vi.spyOn(lastQc, "invalidateQueries");
        fakeSocket.emit(event, { reason: "test" });
        expect(spy).toHaveBeenCalledWith({ queryKey: ["my-batch", "weekly-graph"] });
        expect(spy).toHaveBeenCalledWith({ queryKey: ["user", "mentorship-revenue"] });
      });
    }

    it("an approval pushed by the admin shows on the graph after the refresh (same endpoint)", async () => {
      get.mockResolvedValue(ok(growthData()));
      const { container } = renderGraph();
      await chart();
      await waitFor(() => expect(fakeSocket.handlers.get("batch:day_approved")?.size ?? 0).toBeGreaterThan(0));
      const calls = get.mock.calls.length;
      const updated = growthData();
      updated.weeks[4].progressLevel = 4;
      get.mockResolvedValue(ok(updated));
      fakeSocket.emit("batch:day_approved", { dayNumber: 30 });
      await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(calls));
      expect(get).toHaveBeenLastCalledWith("/api/user-batch/weekly-graph");
      await waitFor(() => expect(points(container)).toHaveLength(4));
    });

    it("stops listening when the graph unmounts", async () => {
      get.mockResolvedValue(ok(graphData()));
      const { unmount } = renderGraph();
      await chart();
      await waitFor(() => expect(fakeSocket.handlers.get("batch:graph_updated")?.size ?? 0).toBeGreaterThan(0));
      unmount();
      expect(fakeSocket.handlers.get("batch:graph_updated")?.size ?? 0).toBe(0);
    });
  });

  it("shows the approved-tasks and reported-revenue summary", async () => {
    get.mockResolvedValue(ok(growthData()));
    renderGraph();
    await chart();
    expect(screen.getByText("4 of 6 tasks approved")).toBeTruthy();
    expect(screen.getByTestId("revenue-total").textContent).toContain("₹40,000");
  });

  it("does not crash on missing values (no activities, no summary, no revenue, no levels)", async () => {
    get.mockResolvedValue(ok({
      totalDays: 7, currentDay: 1, currentWeek: 1, hasActivities: false,
      weeks: [{ weekNumber: 1, startDay: 1, endDay: 7, isCurrent: true, progressLevel: 0, activities: [{ taskId: "x", title: "Old payload", dayNumber: 1, isRequired: true, status: "not_started", completed: false }] }],
    }));
    const { container } = renderGraph();
    await chart();
    expect(texts(container, "week-label")).toEqual(["W1"]);
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

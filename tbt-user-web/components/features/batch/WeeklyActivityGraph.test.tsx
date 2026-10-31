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
const markerY = (el: Element) => Number(el.querySelector("circle:not([fill='transparent'])")!.getAttribute("cy"));
const labelY = (c: HTMLElement, label: string) =>
  Number([...c.querySelectorAll('[data-testid="milestone-label"]')].find((t) => t.textContent === label)!.getAttribute("y")) - 4;

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

  it("draws exactly the configured milestones (bottom → top) and weeks", async () => {
    get.mockResolvedValue(ok(graphData()));
    const { container } = renderGraph();
    await chart();
    const labels = ["Ads", "Website", "Funnels", "₹1 Lakh", "₹5 Lakhs"];
    expect(texts(container, "milestone-label")).toEqual(labels);
    const ys = labels.map((l) => labelY(container, l));
    expect([...ys].sort((a, b) => b - a)).toEqual(ys); // Ads lowest, ₹5 Lakhs highest
    expect(texts(container, "week-label")).toEqual(["W1", "W2", "W3"]);
  });

  it("hardcodes no milestone labels: an older response without config draws none", async () => {
    const data: any = graphData();
    delete data.config;
    get.mockResolvedValue(ok(data));
    const { container } = renderGraph();
    await chart();
    expect(texts(container, "milestone-label")).toEqual([]);
    // Only the ₹ revenue scale (from the data) mentions Lakh/Crore — no milestone label is invented.
    expect([...container.querySelectorAll('[data-testid="milestone-label"]')].some((t) => /lakh|crore/i.test(t.textContent ?? ""))).toBe(false);
  });

  it("puts one focusable marker per activity on its week and milestone row; several in one week stay separate", async () => {
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
    // On their milestone rows (unlinked on the baseline, below Ads).
    expect(markerY(markers[0])).toBe(labelY(container, "Ads"));
    expect(markerY(markers[3])).toBe(labelY(container, "Website"));
    expect(markerY(markers[2])).toBeGreaterThan(labelY(container, "Ads"));
    // The two W1 Ads markers do not overlap.
    const xs = markers.slice(0, 2).map((m) => Number(m.querySelector("circle:not([fill='transparent'])")!.getAttribute("cx")));
    expect(Math.abs(xs[0] - xs[1])).toBeGreaterThanOrEqual(12);
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

  it("marks a reached revenue milestone with a diamond whose popup shows the target and the reported revenue", async () => {
    get.mockResolvedValue(ok(graphData()));
    renderGraph();
    await chart();
    const diamonds = screen.getAllByRole("button").filter((b) => b.getAttribute("data-testid") === "revenue-marker");
    expect(diamonds.map((m) => m.getAttribute("aria-label"))).toEqual(["W2, ₹1 Lakh, revenue milestone reached"]);
    await userEvent.setup().click(diamonds[0]);
    const d = within(screen.getByRole("dialog"));
    expect(d.getByText("Milestone").nextSibling!.textContent).toBe("₹1 Lakh");
    expect(d.getByText("Target").nextSibling!.textContent).toBe("₹1,00,000");
    expect(d.getByText("Revenue by then").nextSibling!.textContent).toBe("₹1,10,000 (self-reported)");
    expect(d.getByText("Reached").nextSibling!.textContent).toBe("From your reported revenue");
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

  describe("progression line", () => {
    /**
     * Admin-configured program, member on W4:
     *  W1 1/1 approved (Ads)           → level 1
     *  W2 2/2 approved incl. Funnels   → level 3   (up)
     *  W3 0/2 — one awaiting approval, one missed → level 0 (down: nothing approved)
     *  W4 current, 1/2 approved        → level 1.5 (up again)
     *  W5 not started                  → no point
     */
    const weeksData = () => {
      const data: any = graphData();
      data.currentDay = 24;
      data.currentWeek = 4;
      data.weeks = [
        week(1, { activities: [activity("t1", "Ads W1", 2, "completed", ["m-ads", "Ads", 1])], total: 1, completed: 1, progressLevel: 1 }),
        week(2, {
          activities: [
            activity("t2", "Funnels W2", 9, "completed", ["m-fun", "Funnels", 3]),
            activity("t2b", "Post daily W2", 10, "completed", null),
          ],
          total: 2, completed: 2, progressLevel: 3,
        }),
        week(3, {
          activities: [
            activity("t3", "Website W3", 16, "submitted", ["m-web", "Website", 2]),
            activity("t3b", "Missed W3", 17, "not_started", null),
          ],
          total: 2, completed: 0, progressLevel: 0,
        }),
        week(4, {
          isCurrent: true,
          activities: [
            activity("t4", "Reel W4", 23, "completed", null),
            activity("t4b", "Draft W4", 24, "in_progress", null),
          ],
          total: 2, completed: 1, progressLevel: 1.5,
        }),
        week(5, { activities: [activity("t5", "Later W5", 30, "upcoming", null)], total: 1 }),
      ];
      return data;
    };
    const line = (container: HTMLElement) => container.querySelector('[data-testid="progress-line"]');
    // The line is a <path d="M origin L p1 L p2 …"> of straight segments: it starts at the
    // chart origin, then passes through each weekly point — the end point of every segment.
    const onCurve = (container: HTMLElement) => {
      const d = line(container)!.getAttribute("d")!;
      const segs = d.trim().split(/(?=[MLC])/).map((x) => x.trim());
      return segs.map((seg) => {
        const nums = seg.slice(1).trim().split(/[\s,]+/).map(Number);
        return nums.slice(-2); // M x,y | L x,y | C c1x,c1y c2x,c2y x,y → the point it reaches
      });
    };
    const origin = (container: HTMLElement) => onCurve(container)[0];
    const pts = (container: HTMLElement) => onCurve(container).slice(1);
    const dots = (container: HTMLElement) =>
      [...container.querySelectorAll('[data-testid="progress-point"]')].map((c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))]);
    const weekX = (label: string) => {
      const t = screen.getAllByTestId("week-label").find((el) => el.textContent === label)!;
      return Number(t.getAttribute("x"));
    };
    const rowY = (label: string) => {
      const t = screen.getAllByTestId("milestone-label").find((el) => el.textContent === label)!;
      return Number(t.getAttribute("y")) - 4;
    };

    it("runs through each started week's highest visible dot (or its progress when higher), never along the baseline", async () => {
      get.mockResolvedValue(ok(weeksData()));
      const { container } = renderGraph();
      await chart();
      const p = pts(container);
      // W5 has not started: no point. W3's awaiting-approval Website dot is on the line.
      expect(p.map(([x]) => x)).toEqual(["W1", "W2", "W3", "W4"].map(weekX));
      expect(p[0][1]).toBe(rowY("Ads"));
      expect(p[1][1]).toBe(rowY("Funnels"));
      expect(p[2][1]).toBe(rowY("Website"));
      const ys = p.map(([, y]) => y);
      expect(ys[1]).toBeLessThan(ys[0]); // up
      expect(ys[2]).toBeGreaterThan(ys[1]); // down
      expect(ys[3]).toBeGreaterThan(rowY("Website")); // W4 progress 1.5 sits between Ads and Website
      expect(ys[3]).toBeLessThan(rowY("Ads"));
      // Nothing on the baseline: no segment duplicates the X axis.
      expect(ys.every((y) => y <= rowY("Ads"))).toBe(true);
      // The approved-progress dots keep their places, each one on the line.
      expect(dots(container)).toEqual([p[0], p[1], p[3]]);
    });

    it("the line passes through an awaiting-approval dot; the progress dot still counts approved work only", async () => {
      get.mockResolvedValue(ok(weeksData()));
      const { container } = renderGraph();
      await chart();
      const marker = screen.getByRole("button", { name: "W3, Website, Website W3, Awaiting approval" }).querySelector("circle")!;
      expect(Number(marker.getAttribute("cy"))).toBe(rowY("Website"));
      expect(pts(container)).toContainEqual([weekX("W3"), rowY("Website")]);
      expect(dots(container).map(([x]) => x)).not.toContain(weekX("W3"));
    });

    it("shows revenue progression through the ₹1 lakh, ₹5 lakhs and ₹1 crore rows from reported revenue", async () => {
      const data = weeksData();
      data.config.milestones = [
        ms("m-ads", "Ads", "activity"), ms("m-web", "Website", "activity"), ms("m-fun", "Funnels", "activity"),
        ms("m-1l", "₹1 lakh", "revenue", { threshold: 100000, reached: true, reachedBy: "revenue", reachedWeek: 2 }),
        ms("m-5l", "₹5 lakhs", "revenue", { threshold: 500000 }),
        ms("m-1c", "₹1 crore", "revenue", { threshold: 10000000 }),
      ];
      // Backend levels: W1 Funnels (3), W2 ₹1 lakh reached (4), W3 ₹3 lakhs (4.5), W4 ₹1 crore (6).
      data.weeks[0].progressLevel = 3;
      data.weeks[1].progressLevel = 4;
      data.weeks[2].progressLevel = 4.5;
      data.weeks[3].progressLevel = 6;
      get.mockResolvedValue(ok(data));
      const { container } = renderGraph();
      await chart();
      const ys = pts(container).map(([, y]) => y);
      expect(ys).toHaveLength(4);
      expect(ys[0]).toBe(rowY("Funnels"));
      expect(ys[1]).toBe(rowY("₹1 lakh"));
      expect(ys[2]).toBeLessThan(rowY("₹1 lakh"));
      expect(ys[2]).toBeGreaterThan(rowY("₹5 lakhs"));
      expect(ys[3]).toBe(rowY("₹1 crore"));
    });

    it("an activity approved later adds its week's progress dot, on the line", async () => {
      get.mockResolvedValue(ok(weeksData()));
      const { container } = renderGraph();
      await chart();
      expect(dots(container).map(([x]) => x)).not.toContain(weekX("W3"));
      const later = weeksData();
      later.weeks[2].activities[0] = activity("t3", "Website W3", 16, "completed", ["m-web", "Website", 2]);
      later.weeks[2].completed = 1;
      later.weeks[2].progressLevel = 2; // backend: Website link approved
      lastQc.setQueryData(["my-batch", "weekly-graph"], later);
      await waitFor(() => expect(dots(container)).toContainEqual([weekX("W3"), rowY("Website")]));
      expect(pts(container)[2]).toEqual([weekX("W3"), rowY("Website")]);
    });

    it("a week with nothing assigned is skipped, never a false dip to the baseline", async () => {
      const data = weeksData();
      data.weeks[2] = week(3, { total: 0, completed: 0, progressLevel: 0 });
      get.mockResolvedValue(ok(data));
      const { container } = renderGraph();
      await chart();
      expect(pts(container).map(([x]) => x)).toEqual(["W1", "W2", "W4"].map(weekX));
    });

    it("extends to a newly added week's dot (W6), then to W7 when its data arrives", async () => {
      // W4 is the current week; W5 has not started and has only a baseline dot.
      const data = weeksData();
      data.weeks.push(week(6, { activities: [activity("t6", "Website W6", 38, "upcoming", ["m-web", "Website", 2])], total: 1 }));
      get.mockResolvedValue(ok(data));
      const { container } = renderGraph();
      await chart();
      expect(pts(container).at(-1)).toEqual([weekX("W6"), rowY("Website")]);
      expect(pts(container).map(([x]) => x)).toEqual(["W1", "W2", "W3", "W4", "W6"].map(weekX));

      const later = weeksData();
      later.weeks.push(
        week(6, { activities: [activity("t6", "Website W6", 38, "upcoming", ["m-web", "Website", 2])], total: 1 }),
        week(7, { activities: [activity("t7", "Funnels W7", 45, "upcoming", ["m-fun", "Funnels", 3])], total: 1 }),
      );
      lastQc.setQueryData(["my-batch", "weekly-graph"], later);
      await waitFor(() => expect(pts(container).at(-1)).toEqual([weekX("W7"), rowY("Funnels")]));
      expect(pts(container).map(([x]) => x)).toEqual(["W1", "W2", "W3", "W4", "W6", "W7"].map(weekX));
    });

    it("is drawn red, 3px, under the task markers (their look is unchanged) and never blocks clicks", async () => {
      get.mockResolvedValue(ok(weeksData()));
      const { container } = renderGraph();
      await chart();
      const l = line(container)!;
      expect(l.getAttribute("stroke")).toBe("var(--color-accent, #dc2626)");
      expect(Number(l.getAttribute("stroke-width"))).toBe(3);
      expect(l.getAttribute("d")).toMatch(/^M [\d.]+,[\d.]+( L [\d.]+,[\d.]+)+$/); // straight segments through each week's dot
      for (const dot of container.querySelectorAll('[data-testid="progress-point"]')) expect(dot.getAttribute("r")).toBe("2.5");
      const firstMarker = container.querySelector('[data-testid="activity-marker"]')!;
      expect(l.compareDocumentPosition(firstMarker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      for (const dot of container.querySelectorAll('[data-testid="progress-point"]')) {
        expect(dot.compareDocumentPosition(firstMarker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
      expect(l.getAttribute("pointer-events")).toBe("none");
    });

    it("one week with a dot: a line from the chart origin to it; nothing above the baseline: no line", async () => {
      const data = weeksData();
      data.weeks = [data.weeks[0], ...data.weeks.slice(1).map((w: any) => ({
        ...w, progressLevel: null,
        activities: w.activities.map((a: any) => ({ ...a, milestoneId: null, milestoneLabel: null, level: 0 })),
      }))];
      get.mockResolvedValue(ok(data));
      const { container } = renderGraph();
      await chart();
      expect(pts(container)).toEqual([[weekX("W1"), rowY("Ads")]]);
      expect(dots(container)).toEqual(pts(container));
      expect(screen.getAllByTestId("activity-marker")).toHaveLength(8);
      cleanup();

      const none = weeksData();
      none.weeks = none.weeks.map((w: any) => ({
        ...w,
        progressLevel: w.progressLevel === null ? null : 0,
        activities: w.activities.map((a: any) => ({ ...a, milestoneId: null, milestoneLabel: null, level: 0 })),
      }));
      get.mockResolvedValue(ok(none));
      const r = renderGraph();
      await chart();
      expect(line(r.container)).toBeNull(); // nothing fabricated
      expect(r.container.querySelectorAll('[data-testid="progress-point"]')).toHaveLength(0);
    });

    it("the line starts at the chart origin (Start, on the baseline left of W1)", async () => {
      get.mockResolvedValue(ok(weeksData()));
      const { container } = renderGraph();
      await chart();
      const [ox, oy] = origin(container);
      expect(ox).toBeLessThan(weekX("W1"));
      expect(oy).toBeGreaterThan(rowY("Ads")); // the baseline is below the first milestone row
    });

    it("keeps the status legend unchanged", async () => {
      get.mockResolvedValue(ok(weeksData()));
      renderGraph();
      await chart();
      for (const label of ["Completed", "Awaiting approval", "Not started"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  });

  describe("revenue points (red ring, white centre — not a line)", () => {
    /**
     * Admin-configured rows (Ads, Website, Funnels, ₹1 Lakh [₹1,00,000], ₹5 Lakhs [₹5,00,000]) and the member's
     * saved revenue per program week (week.revenue): W1 ₹1,00,000 · W2 ₹3,00,000 · W3 nothing · W4 ₹2,00,000.
     */
    const revData = () => {
      const data: any = graphData();
      data.currentDay = 24;
      data.currentWeek = 4;
      data.weeks = [
        week(1, { activities: [activity("t1", "Ads W1", 2, "completed", ["m-ads", "Ads", 1])], total: 1, completed: 1, progressLevel: 1, revenue: 100000 }),
        week(2, { activities: [activity("t2", "Funnels W2", 9, "completed", ["m-fun", "Funnels", 3])], total: 1, completed: 1, progressLevel: 3, revenue: 300000 }),
        week(3, { activities: [activity("t3", "Website W3", 16, "completed", ["m-web", "Website", 2])], total: 1, completed: 1, progressLevel: 2, revenue: null }),
        week(4, { isCurrent: true, activities: [activity("t4", "Reel W4", 23, "in_progress", null)], total: 1, progressLevel: 0, revenue: 200000 }),
      ];
      return data;
    };
    const rev = (container: HTMLElement) =>
      [...container.querySelectorAll('[data-testid="revenue-point"]')].map((c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))]);
    const wx = (label: string) => Number(screen.getAllByTestId("week-label").find((el) => el.textContent === label)!.getAttribute("x"));

    it("one ring per week with saved revenue, at its actual amount on the stage axis; no point for a week without revenue", async () => {
      get.mockResolvedValue(ok(revData()));
      const { container } = renderGraph();
      await chart();
      const start = labelY(container, "Ads") + 36, l1 = labelY(container, "₹1 Lakh"), l5 = labelY(container, "₹5 Lakhs");
      expect(rev(container)).toEqual([
        [wx("W1"), l1],                               // ₹1,00,000 → the ₹1 Lakh row
        [wx("W2"), l1 + 0.5 * (l5 - l1)],             // ₹3,00,000 → halfway to ₹5 Lakhs
        [wx("W4"), l1 + 0.25 * (l5 - l1)],            // ₹2,00,000
      ]);
      expect(start).toBeGreaterThan(l1);
      expect(container.querySelectorAll('[data-testid="revenue-point"] title')[1].textContent).toBe("W2: ₹3,00,000 revenue generated");
    });

    it("revenue points are a white centre with a solid red ring, drawn on top; there is no revenue line", async () => {
      get.mockResolvedValue(ok(revData()));
      const { container } = renderGraph();
      await chart();
      const points = [...container.querySelectorAll('[data-testid="revenue-point"]')];
      for (const p of points) {
        expect(p.getAttribute("fill")).toBe("#ffffff");
        expect(p.getAttribute("stroke")).toBe("var(--color-accent, #dc2626)");
        expect(p.getAttribute("stroke-width")).toBe("2.5");
        for (const m of container.querySelectorAll('[data-testid="activity-marker"], [data-testid="revenue-marker"]')) {
          expect(m.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        }
      }
      // Exactly one red line on the chart: the task-progress line.
      expect(container.querySelectorAll('path[stroke="var(--color-accent, #dc2626)"]')).toHaveLength(1);
      const line = container.querySelector('[data-testid="progress-line"]')!.getAttribute("d")!;
      for (const [x, y] of rev(container).filter(([x]) => x !== wx("W1"))) expect(line).not.toContain(`${x},${y}`);
    });

    it("the one red line follows task progress, not revenue", async () => {
      get.mockResolvedValue(ok(revData()));
      const { container } = renderGraph();
      await chart();
      const before = container.querySelector('[data-testid="progress-line"]')!.getAttribute("d");
      const more = revData();
      more.weeks = more.weeks.map((w: any) => ({ ...w, revenue: w.revenue == null ? null : w.revenue * 4 })); // revenue changes only
      lastQc.setQueryData(["my-batch", "weekly-graph"], more);
      await waitFor(() => expect(rev(container)[0][1]).toBeLessThan(labelY(container, "₹1 Lakh"))); // points moved up
      expect(container.querySelector('[data-testid="progress-line"]')!.getAttribute("d")).toBe(before); // line did not
    });

    it("built-in default rows (no thresholds), only W5 at ₹1,00,00,000: a ring on the '1 crore' row at W5", async () => {
      const data: any = graphData();
      data.currentDay = 31; data.currentWeek = 5;
      data.config = {
        source: "default",
        milestones: [ms(null as any, "Ads", "activity"), ms(null as any, "Website", "activity"), ms(null as any, "Funnels", "activity"),
          ms(null as any, "1 lakh", "revenue"), ms(null as any, "5 Lakhs", "revenue"), ms(null as any, "1 crore", "revenue")],
      };
      data.weeks = [1, 2, 3, 4].map((n) => week(n)).concat([week(5, { isCurrent: true, revenue: 10000000 })]);
      get.mockResolvedValue(ok(data));
      const { container } = renderGraph();
      await chart();
      expect(rev(container)).toEqual([[wx("W5"), labelY(container, "1 crore")]]);
    });

    it("no saved revenue: no revenue points (nothing invented)", async () => {
      const data = revData();
      data.weeks = data.weeks.map((w: any) => ({ ...w, revenue: null }));
      get.mockResolvedValue(ok(data));
      const { container } = renderGraph();
      await chart();
      expect(rev(container)).toEqual([]);
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

    it("an admin revenue change shows on the graph after the refresh (same endpoint, no separate data)", async () => {
      get.mockResolvedValue(ok(graphData()));
      const { container } = renderGraph();
      await chart();
      await waitFor(() => expect(fakeSocket.handlers.get("batch:graph_updated")?.size ?? 0).toBeGreaterThan(0));
      const calls = get.mock.calls.length;
      const updated: any = graphData();
      updated.weeks[1].revenue = 400000; // admin saved W2 revenue
      get.mockResolvedValue(ok(updated));
      fakeSocket.emit("batch:graph_updated", { reason: "revenue_updated" });
      await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(calls));
      expect(get).toHaveBeenLastCalledWith("/api/user-batch/weekly-graph");
      await waitFor(() => expect(container.querySelectorAll('[data-testid="revenue-point"]')).toHaveLength(2));
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

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
    expect(container.textContent).not.toMatch(/lakh|crore/i);
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
    /** W1 Ads ✓, W2 Funnels ✓, W3 Website ✓ (+ an awaiting one), W4 ₹1 Lakh-linked not started. */
    const zigzag = () => {
      const data: any = graphData();
      data.weeks = [
        week(1, { activities: [activity("t1", "Ads W1", 2, "completed", ["m-ads", "Ads", 1])], progressLevel: 1 }),
        week(2, { activities: [activity("t2", "Funnels W2", 9, "completed", ["m-fun", "Funnels", 3])], progressLevel: 3 }),
        week(3, {
          isCurrent: true,
          activities: [
            activity("t3", "Website W3", 16, "completed", ["m-web", "Website", 2]),
            activity("t3b", "Pending W3", 17, "submitted", ["m-1l", "₹1 Lakh", 4]),
          ],
          progressLevel: 2,
        }),
        week(4, { activities: [activity("t4", "Later W4", 23, "not_started", ["m-fun", "Funnels", 3])] }),
      ];
      return data;
    };
    const markerCenter = (name: string) => {
      const c = screen.getByRole("button", { name }).querySelector("circle:not([fill='transparent'])")!;
      return `${c.getAttribute("cx")},${c.getAttribute("cy")}`;
    };
    const line = (container: HTMLElement) => container.querySelector('[data-testid="progress-line"]');

    it("rises and falls through exactly the approved activities' marker coordinates", async () => {
      get.mockResolvedValue(ok(zigzag()));
      const { container } = renderGraph();
      await chart();
      const pts = line(container)!.getAttribute("points")!.split(" ");
      expect(pts).toEqual([
        markerCenter("W1, Ads, Ads W1, Completed"),
        markerCenter("W2, Funnels, Funnels W2, Completed"),
        markerCenter("W3, Website, Website W3, Completed"),
      ]);
      const ys = pts.map((p) => Number(p.split(",")[1]));
      expect(ys[1]).toBeLessThan(ys[0]); // up to Funnels
      expect(ys[2]).toBeGreaterThan(ys[1]); // down to Website
      // Awaiting approval and not started stay markers only.
      expect(pts).not.toContain(markerCenter("W3, ₹1 Lakh, Pending W3, Awaiting approval"));
      expect(pts).not.toContain(markerCenter("W4, Funnels, Later W4, Not started"));
    });

    it("is drawn red and under the markers, so marker borders stay visible", async () => {
      get.mockResolvedValue(ok(zigzag()));
      const { container } = renderGraph();
      await chart();
      const l = line(container)!;
      expect(l.getAttribute("stroke")).toBe("var(--color-accent, #dc2626)");
      expect(Number(l.getAttribute("stroke-width"))).toBeGreaterThanOrEqual(2);
      expect(l.getAttribute("opacity")).toBeNull();
      const firstMarker = container.querySelector('[data-testid="activity-marker"]')!;
      expect(l.compareDocumentPosition(firstMarker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("recalculates when the data refreshes (an activity approved, edited or removed)", async () => {
      get.mockResolvedValue(ok(zigzag()));
      const { container } = renderGraph();
      await chart();
      expect(line(container)!.getAttribute("points")!.split(" ")).toHaveLength(3);

      // The pending W3 activity is approved → the line now ends on it.
      const approved = zigzag();
      approved.weeks[2].activities[1] = activity("t3b", "Pending W3", 17, "completed", ["m-1l", "₹1 Lakh", 4]);
      lastQc.setQueryData(["my-batch", "weekly-graph"], approved);
      await waitFor(() => expect(line(container)!.getAttribute("points")!.split(" ")).toHaveLength(4));
      expect(line(container)!.getAttribute("points")!.split(" ").at(-1)).toBe(markerCenter("W3, ₹1 Lakh, Pending W3, Completed"));

      // W2's activity is removed → the line goes straight from W1 to W3.
      const removed = zigzag();
      removed.weeks[1].activities = [];
      lastQc.setQueryData(["my-batch", "weekly-graph"], removed);
      await waitFor(() => expect(line(container)!.getAttribute("points")!.split(" ")).toEqual([
        markerCenter("W1, Ads, Ads W1, Completed"),
        markerCenter("W3, Website, Website W3, Completed"),
      ]));
    });

    it("draws no line when fewer than two activities are approved (nothing fabricated)", async () => {
      get.mockResolvedValue(ok(graphData())); // only "Ads W1" is approved
      const { container } = renderGraph();
      await chart();
      expect(line(container)).toBeNull();
      expect(screen.getAllByTestId("activity-marker")).toHaveLength(5); // every marker still drawn
    });

    it("keeps the status legend unchanged", async () => {
      get.mockResolvedValue(ok(zigzag()));
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

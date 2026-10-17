import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WeeklyActivityGraph from "./WeeklyActivityGraph";

// Exercises the real service → hook → component chain. Only the HTTP client is
// replaced; it returns what lib/api/client.ts's response interceptor yields
// (the backend body, `response.data`).
const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ default: { get } }));
const siteConfig = vi.hoisted(() => ({ value: { uiStrings: null, hiddenMenuKeys: [] as string[] } }));
vi.mock("@/lib/context/SiteConfigContext", () => ({ useSiteConfig: () => siteConfig.value }));

// Captured from GET /api/user-batch/weekly-graph (commit affbff77) against a
// seeded local database for a member on program day 10 (task ids shortened),
// with progressLevel as buildWeeklyGraph now derives it: W1 1/5 approved →
// 0.6, W2 (current) nothing approved → 0, W3 not started → null.
const REAL_RESPONSE = {"success":true,"data":{"totalDays":21,"currentDay":10,"currentWeek":2,"hasActivities":true,"weeks":[{"weekNumber":1,"startDay":1,"endDay":7,"isCurrent":false,"activities":[{"taskId":"task-1","title":"W1 intro video","dayNumber":1,"isRequired":true,"status":"completed","completed":true},{"taskId":"task-2","title":"W1 worksheet","dayNumber":2,"isRequired":true,"status":"needs_revision","completed":false},{"taskId":"task-3","title":"W1 optional reading","dayNumber":3,"isRequired":false,"status":"not_started","completed":false},{"taskId":"task-4","title":"Program-wide task","dayNumber":5,"isRequired":true,"status":"not_started","completed":false},{"taskId":"task-5","title":"Alice private task","dayNumber":6,"isRequired":true,"status":"not_started","completed":false}],"total":5,"completed":1,"requiredTotal":4,"requiredCompleted":1,"completionPercent":20,"progressLevel":0.6},{"weekNumber":2,"startDay":8,"endDay":14,"isCurrent":true,"activities":[{"taskId":"task-6","title":"W2 submitted task","dayNumber":9,"isRequired":true,"status":"submitted","completed":false},{"taskId":"task-7","title":"W2 today task","dayNumber":10,"isRequired":true,"status":"not_started","completed":false}],"total":2,"completed":0,"requiredTotal":2,"requiredCompleted":0,"completionPercent":0,"progressLevel":0},{"weekNumber":3,"startDay":15,"endDay":21,"isCurrent":false,"activities":[{"taskId":"task-8","title":"W3 upcoming task","dayNumber":16,"isRequired":true,"status":"upcoming","completed":false}],"total":1,"completed":0,"requiredTotal":1,"requiredCompleted":0,"completionPercent":0,"progressLevel":null}],"summary":{"total":8,"completed":1,"completionPercent":13}},"error":null};

const MILESTONES = ["Ads", "Website", "Funnels", "1 lakh", "1 crore"];

const renderGraph = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <WeeklyActivityGraph />
    </QueryClientProvider>,
  );
};

const svgTexts = (c: HTMLElement) => [...c.querySelectorAll("svg > text, svg > g > text")].map((t) => t.textContent);
const yOf = (c: HTMLElement, label: string) =>
  Number([...c.querySelectorAll("svg text")].find((t) => t.textContent === label)!.getAttribute("y")) - 4;
const points = (c: HTMLElement) => [...c.querySelectorAll("circle")].map((p) => ({
  week: p.querySelector("title")!.textContent,
  y: Number(p.getAttribute("cy")),
}));

beforeEach(() => {
  get.mockReset();
  siteConfig.value = { uiStrings: null, hiddenMenuKeys: [] };
});
afterEach(cleanup);

describe("WeeklyActivityGraph with the real API response", () => {
  it("requests the member's graph from /api/user-batch/weekly-graph", async () => {
    get.mockResolvedValue(REAL_RESPONSE);
    renderGraph();
    await screen.findByRole("img", { name: "Weekly Activity Graph" });
    expect(get).toHaveBeenCalledWith("/api/user-batch/weekly-graph");
  });

  it("shows only milestone labels on Y and week labels on X", async () => {
    get.mockResolvedValue(REAL_RESPONSE);
    const { container } = renderGraph();
    await screen.findByRole("img", { name: "Weekly Activity Graph" });
    expect(svgTexts(container)).toEqual([...MILESTONES, "W1", "W2", "W3"]);
    // Milestones run bottom → top: Ads lowest, 1 crore highest.
    const ys = MILESTONES.map((m) => yOf(container, m));
    expect([...ys].sort((a, b) => b - a)).toEqual(ys);
  });

  it("removes the summary, task list, legend, dots and percentage axis", async () => {
    get.mockResolvedValue(REAL_RESPONSE);
    const { container } = renderGraph();
    await screen.findByRole("img", { name: "Weekly Activity Graph" });
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Week \d+ ·/);
    expect(text).not.toMatch(/%/);
    expect(text).not.toContain("W1 intro video");
    expect(text).not.toContain("Awaiting review");
    expect(text).not.toContain("Each dot is an assigned activity");
    // Only the weekly progress points remain — no per-activity dots.
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
  });

  it("plots started weeks from progressLevel, in order, and nothing for future weeks", async () => {
    get.mockResolvedValue(REAL_RESPONSE);
    const { container } = renderGraph();
    await screen.findByRole("img", { name: "Weekly Activity Graph" });
    const ads = yOf(container, "Ads");
    const website = yOf(container, "Website");
    const gap = ads - website;
    const baseline = ads + gap;

    const [w1, w2] = points(container);
    expect(w1.week).toBe("W1");
    expect(w1.y).toBeCloseTo(baseline - 0.6 * gap); // 1 of 5 approved
    expect(w2.week).toBe("W2");
    expect(w2.y).toBeCloseTo(baseline); // nothing approved — stays at the baseline
    expect(points(container).map((p) => p.week)).not.toContain("W3");

    const line = container.querySelector("polyline")!.getAttribute("points")!.split(" ");
    expect(line).toHaveLength(2);
    expect(Number(line[0].split(",")[0])).toBeLessThan(Number(line[1].split(",")[0]));
  });

  it("raises a point for a fully completed week (Funnels) and follows the program length", async () => {
    const weeks = Array.from({ length: 13 }, (_, i) => ({
      ...REAL_RESPONSE.data.weeks[0],
      weekNumber: i + 1,
      progressLevel: i === 0 ? 3 : i < 4 ? 0 : null,
    }));
    get.mockResolvedValue({ ...REAL_RESPONSE, data: { ...REAL_RESPONSE.data, totalDays: 90, weeks } });
    const { container } = renderGraph();
    await screen.findByRole("img", { name: "Weekly Activity Graph" });

    expect(svgTexts(container).slice(MILESTONES.length)).toEqual(weeks.map((w) => `W${w.weekNumber}`));
    const pts = points(container);
    expect(pts.map((p) => p.week)).toEqual(["W1", "W2", "W3", "W4"]);
    expect(pts[0].y).toBeCloseTo(yOf(container, "Funnels"));
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

  it("keeps every started week at the baseline when nothing is assigned", async () => {
    const weeks = REAL_RESPONSE.data.weeks.map((w) => ({
      ...w, activities: [], total: 0, completed: 0, completionPercent: null,
      progressLevel: w.weekNumber <= 2 ? 0 : null,
    }));
    get.mockResolvedValue({ ...REAL_RESPONSE, data: { ...REAL_RESPONSE.data, hasActivities: false, weeks } });
    const { container } = renderGraph();
    await screen.findByRole("img", { name: "Weekly Activity Graph" });
    const baseline = 2 * yOf(container, "Ads") - yOf(container, "Website");
    expect(points(container).map((p) => p.y)).toEqual([baseline, baseline]);
  });

  it("renders nothing and makes no request when the admin hides it (weekly_graph)", async () => {
    siteConfig.value = { uiStrings: null, hiddenMenuKeys: ["weekly_graph"] };
    get.mockResolvedValue(REAL_RESPONSE);
    const { container } = renderGraph();
    await new Promise((r) => setTimeout(r, 50));
    expect(container.textContent).toBe("");
    expect(get).not.toHaveBeenCalled();
  });

  it("still shows when the admin hides other sections only", async () => {
    siteConfig.value = { uiStrings: null, hiddenMenuKeys: ["streak", "ebooks"] };
    get.mockResolvedValue(REAL_RESPONSE);
    renderGraph();
    expect(await screen.findByRole("img", { name: "Weekly Activity Graph" })).toBeTruthy();
  });
});

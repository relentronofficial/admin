import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import MentorshipDashboard from "./MentorshipDashboard";

// ── Hook mocks: each test sets the data the real APIs would return ──
const state: Record<string, any> = {};

vi.mock("@/lib/hooks/useMentorship", () => ({
  useMentorshipStats: () => state.stats,
  useMentorshipRevenue: () => state.revenue,
  useUpsertMentorshipRevenue: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMentorshipSocial: () => ({ data: null }),
  useUpsertMentorshipSocial: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const toastMock = vi.hoisted(() => {
  const info = vi.fn();
  return { info, success: vi.fn(), error: vi.fn() };
});
vi.mock("react-hot-toast", () => ({
  toast: Object.assign((...a: unknown[]) => toastMock.info(...a), { success: toastMock.success, error: toastMock.error }),
}));
vi.mock("@/lib/hooks/useBatchProgram", async (importOriginal) => ({
  // the real message mapper; only the data/purchase hooks are mocked
  extraLifelineMessage: (await importOriginal<typeof import("@/lib/hooks/useBatchProgram")>()).extraLifelineMessage,
  useMyBatchProgram: () => state.batch,
  useMyWeeklyGraph: () => state.graph,
  useBuyExtraLifeline: () => state.buy,
}));
vi.mock("@/lib/hooks/useDashboard", () => ({ useContinueLearning: () => ({ data: [], isLoading: false }) }));
vi.mock("@/lib/context/SiteConfigContext", () => ({ useSiteConfig: () => ({ uiStrings: null }) }));
vi.mock("@/lib/hooks/useUser", () => ({ useUserSupportQuota: () => state.quota, useCreditPricing: () => ({ data: state.pricing }) }));
vi.mock("@/lib/hooks/useSupportCalls", () => ({ useSupportCallsSummary: () => state.callSummary }));

const bucket = (allocated: number, used: number) => ({ allocated, used, remaining: Math.max(0, allocated - used) });

function baseData() {
  return {
    stats: {
      data: {
        dailyTimeSpentHrs: 3.15, dailyTimeGoalHrs: 4, weeklyReportSubmitted: true, streakDays: 37,
        totalEpisodes: 12, completedEpisodes: 2, tasksCompleted: 32, tasksTotal: 75,
        leaderboardRank: 45, daysElapsed: 126, totalDays: 174, programName: "TBT – eComm Mastery",
      },
      isLoading: false, isError: false, refetch: vi.fn(),
    },
    quota: {
      data: {
        salesSupport: bucket(7, 2), techSupport: bucket(7, 2), contentSupport: bucket(5, 4),
        adSupport: bucket(7, 4), callCredits: bucket(4, 3), groupCall: bucket(12, 3),
        oneToOne: true, lifelines: { total: 3, used: 1, remaining: 2 },
      },
      isLoading: false, isError: false, refetch: vi.fn(),
    },
    batch: { data: { lifelinesTotal: 3, lifelinesUsed: 1 }, isLoading: false },
    buy: { buy: vi.fn(async () => ({ outcome: "success" })), busy: false },
    pricing: [{ credit_type: "lifeline", price_inr: 199 }],
    // No summary yet → cards show counts only (the summary is an optional overlay).
    callSummary: { data: undefined },
    // Member with a batch whose graph has one completed and one upcoming activity.
    graph: {
      data: {
        totalDays: 14, currentDay: 3, currentWeek: 1, hasActivities: true,
        weeks: [
          { weekNumber: 1, startDay: 1, endDay: 7, isCurrent: true, total: 1, completed: 1, requiredTotal: 1, requiredCompleted: 1, completionPercent: 100, progressLevel: 3,
            activities: [{ taskId: "t1", title: "Set up store", dayNumber: 2, isRequired: true, status: "completed", completed: true }] },
          { weekNumber: 2, startDay: 8, endDay: 14, isCurrent: false, total: 1, completed: 0, requiredTotal: 1, requiredCompleted: 0, completionPercent: 0, progressLevel: null,
            activities: [{ taskId: "t2", title: "First ad", dayNumber: 9, isRequired: true, status: "upcoming", completed: false }] },
        ],
        summary: { total: 2, completed: 1, completionPercent: 50 },
        // The Y axis always comes from the API (program config or the backend's defaults).
        config: {
          source: "default",
          milestones: ["Ads", "Website", "Funnels", "1 lakh", "1 crore"].map((label, i) => ({
            id: null, label, kind: i < 3 ? "activity" : "revenue", reached: false, dayNumber: null, threshold: null, reachedBy: null, reachedWeek: null,
          })),
        },
      },
      isLoading: false, isError: false,
    },
    revenue: {
      data: {
        weekNumber: 42, year: 2026, // ISO week 42 of 2026 = Mon 12 Oct – Sun 18 Oct
        revenueGenerated: 457856, revenuePrev: 400000, numberOfOrders: 575, ordersPrev: 500,
        adBudgetSpent: 45856, roas: 9.98, customerAcqCost: 80, organicLeads: 128, leadsPrev: 100,
        avgOrderValue: null, rtoReturnsPercent: 4, conversionRate: 12, platformBadge: null,
        dailyRevenue: [50000, 60000, null, 70000, 90000, 100000, 87856],
        dailyOrders: [60, 70, null, 85, 110, 130, 120],
        updatedAt: null,
      },
    },
  };
}

const headings = () => screen.getAllByRole("heading").map((h) => h.textContent?.trim());
const tile = (label: string) => screen.getByText(label).closest("div")!.parentElement!.textContent!.replace(/\s+/g, "");

beforeEach(() => {
  Object.assign(state, baseData());
  toastMock.info.mockClear();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
});
afterEach(cleanup);

describe("MentorshipDashboard", () => {
  it("renders the six sections in order and no extra dashboard sections", () => {
    render(<MentorshipDashboard />);
    expect(headings()).toEqual([
      "TBT – eComm Mastery",
      "Customer Journey",
      "Expert Support Calls",
      "Your Revenue Stats",
      "Weekly Revenue & Order Trajectory",
    ]);
    // Summary KPI strip sits between the header and Customer Journey
    const html = document.body.innerHTML;
    expect(html.indexOf("Daily Time Spent")).toBeLessThan(html.indexOf("Customer Journey"));
    expect(screen.queryByText(/Social Media/i)).toBeNull();
    // Entry form is collapsed by default
    expect(screen.queryByText("Daily Inputs")).toBeNull();
  });

  it("shows the member's Weekly Activity Graph right after Customer Journey", () => {
    render(<MentorshipDashboard />);
    const h = headings();
    expect(h.indexOf("Weekly Activity Graph")).toBe(h.indexOf("Customer Journey") + 1);
    // Milestone axis and week labels from the API, one accessible marker per activity.
    const graph = screen.getByRole("group", { name: "Weekly Activity Graph" });
    for (const label of ["Ads", "Website", "Funnels", "1 lakh", "1 crore", "W1", "W2"]) {
      expect(graph.textContent).toContain(label);
    }
    expect(within(graph).getAllByRole("button").map((b) => b.getAttribute("aria-label")))
      .toEqual(["W1, No milestone, Set up store, Completed", "W2, No milestone, First ad, Upcoming"]);
    // One approved activity, not linked to a milestone: no progression line is fabricated.
    expect(graph.querySelector('[data-testid="progress-line"]')).toBeNull();
  });

  it("shows no graph for a member without a batch", () => {
    state.graph = { data: null, isLoading: false, isError: false };
    render(<MentorshipDashboard />);
    expect(headings()).not.toContain("Weekly Activity Graph");
  });

  it("shows API values in the header, journey and support-call cards", () => {
    render(<MentorshipDashboard />);
    expect(screen.getByText("Weekly Report Submitted")).toBeTruthy();
    expect(screen.getByText(/37 Days/)).toBeTruthy();
    expect(tile("Modules")).toContain("2/12");
    expect(tile("Tasks")).toContain("32/75");
    expect(tile("Daily Usage")).toContain("3.15h");
    expect(tile("Support Days")).toContain("48dleft");     // 174 - 126
    expect(tile("Tier Access")).toContain("126/174d");
    expect(tile("Leaderboard")).toContain("#45");
    expect(tile("Sales Calls")).toContain("2/7");
    expect(tile("Content Calls")).toContain("4/5");
    expect(tile("Marketing Calls")).toContain("4/7");
    expect(tile("Mentor 1-On-1")).toContain("3/4");
    expect(tile("Live Group Q&A")).toContain("3/12");
    // Totals include all six call types (sales + content were previously omitted)
    expect(screen.getByText("42 Total Calls")).toBeTruthy();          // 7+7+5+7+4+12
    expect(screen.getByText("24/42 Quota Remaining")).toBeTruthy();   // 42 - 18 used
  });

  it("renders saved revenue numbers and derived metrics", () => {
    render(<MentorshipDashboard />);
    expect(screen.getByText("₹4,57,856")).toBeTruthy();
    expect(screen.getByText("575 Orders")).toBeTruthy();
    expect(screen.getByText("₹45,856")).toBeTruthy();
    expect(screen.getByText("128 Leads")).toBeTruthy();
    expect(screen.getByText("Avg Order Value: ₹796")).toBeTruthy(); // derived 457856 / 575
    expect(screen.getByText("ROAS 9.98×")).toBeTruthy();
  });

  it("plots the saved daily series with week labels from the report's ISO week", () => {
    render(<MentorshipDashboard />);
    expect(screen.getByText("Mon(12)")).toBeTruthy();
    expect(screen.getByText("Sun(18)")).toBeTruthy();
    const peak = screen.getByTestId("peak-callout").textContent!;
    expect(peak).toContain("PEAK DAY (SAT)");
    expect(peak).toContain("₹1,00,000");
    expect(peak).toContain("130 Orders");
    // Missing Wednesday is a gap, not a ₹0 point: 6 data points for 7 days
    expect(document.querySelectorAll('svg[aria-label="Weekly revenue and order trajectory"] circle').length).toBe(6);
  });

  it("demo-mode revenue payload: cards, derived metrics and the trajectory chart agree", () => {
    // Exactly what the backend's demoRevenue({ isoWeek: 42, isoYear: 2026 })
    // returns (tbt-admin/backend/src/lib/mentorshipDemo.ts).
    state.revenue = {
      data: {
        weekNumber: 42, year: 2026,
        revenueGenerated: 499900, revenuePrev: 412000, numberOfOrders: 610, ordersPrev: 528,
        adBudgetSpent: 48500, roas: 10.31, customerAcqCost: 80, organicLeads: 142, leadsPrev: 118,
        avgOrderValue: 820, rtoReturnsPercent: 4.2, conversionRate: 3.8, platformBadge: null,
        dailyRevenue: [52000, 61500, 48800, 70200, 88400, 96300, 82700],
        dailyOrders: [64, 75, 59, 86, 108, 117, 101],
        updatedAt: null,
      },
    };
    render(<MentorshipDashboard />);

    // Cards
    expect(screen.getByText("₹4,99,900")).toBeTruthy();
    expect(screen.getByText("610 Orders")).toBeTruthy();
    expect(screen.getByText("Avg Order Value: ₹820")).toBeTruthy(); // 499900 / 610
    expect(screen.getByText("ROAS 10.31×")).toBeTruthy();           // 499900 / 48500

    // Daily chart: all 7 days plotted, peak = best day (Sat ₹96,300 / 117 orders)
    const chart = 'svg[aria-label="Weekly revenue and order trajectory"]';
    expect(document.querySelectorAll(`${chart} circle`).length).toBe(7);
    expect(screen.getByTestId("peak-callout").textContent).toContain("₹96,300");
    expect(screen.getByTestId("peak-callout").textContent).toContain("117 Orders");

    // Cumulative chart ends at the weekly total shown on the revenue card (₹499,900 → "₹500K" top tick)
    fireEvent.click(screen.getByText("Cumulative"));
    const ticks = [...document.querySelectorAll(`${chart} text`)].map((t) => t.textContent);
    expect(ticks).toContain("₹500K");
  });

  it("keeps the peak on the best daily value in cumulative mode", () => {
    render(<MentorshipDashboard />);
    fireEvent.click(screen.getByText("Cumulative"));
    const peak = screen.getByTestId("peak-callout").textContent!;
    expect(peak).toContain("PEAK DAY (SAT)");
    expect(peak).toContain("₹1,00,000");
  });

  it("updates the displayed metrics when the underlying data changes", () => {
    const { rerender } = render(<MentorshipDashboard />);
    expect(tile("Tasks")).toContain("32/75");
    state.stats = { ...state.stats, data: { ...state.stats.data, tasksCompleted: 40, leaderboardRank: 12 } };
    state.quota = { ...state.quota, data: { ...state.quota.data, salesSupport: bucket(7, 5) } };
    state.revenue = { data: { ...state.revenue.data, numberOfOrders: 600, dailyRevenue: [50000, 60000, null, 70000, 150000, 100000, 87856] } };
    rerender(<MentorshipDashboard />);
    expect(tile("Tasks")).toContain("40/75");
    expect(tile("Leaderboard")).toContain("#12");
    expect(tile("Sales Calls")).toContain("5/7");
    expect(screen.getByText("600 Orders")).toBeTruthy();
    expect(screen.getByTestId("peak-callout").textContent).toContain("PEAK DAY (FRI)");
  });

  it("shows empty states — not zeros or sample values — when no revenue is saved", () => {
    state.revenue = { data: null };
    render(<MentorshipDashboard />);
    expect(screen.getByText("No revenue numbers saved for this week yet.")).toBeTruthy();
    expect(screen.getByText("No daily revenue saved for this week yet")).toBeTruthy();
    expect(screen.queryByTestId("peak-callout")).toBeNull();
  });

  it("draws no hearts when the member has no lifeline settings (no assumed default)", () => {
    state.batch = { data: null, isLoading: false };
    render(<MentorshipDashboard />);
    expect(document.querySelectorAll("svg.lucide-heart").length).toBe(0);
  });

  it("shows an error state instead of zero-filled cards when stats fail to load", () => {
    state.stats = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    render(<MentorshipDashboard />);
    expect(screen.getByText("Couldn't load your mentorship stats.")).toBeTruthy();
    expect(screen.queryByText("Customer Journey")).toBeNull();
  });

  it("each call card shows its next action from the server: Book Call, Unlock with TBT Coins, Purchase TBT Coins or locked", () => {
    const q = (allocated: number, used: number, reserved = 0) => ({ allocated, used, reserved, remaining: Math.max(0, allocated - used - reserved), included: allocated, unlocked: 0 });
    state.callSummary = {
      data: {
        coinBalance: 80,
        coinPurchaseAvailable: true,
        categories: [
          { category: "sales_support", quota: q(7, 2), coinCost: 100, action: "book", lockedReason: null },
          { category: "tech_support", quota: q(7, 7), coinCost: 50, action: "unlock_with_coins", lockedReason: null },
          { category: "content_support", quota: q(5, 4, 1), coinCost: 100, action: "purchase_coins", lockedReason: null },
          { category: "ad_support", quota: q(7, 7), coinCost: null, action: "locked", lockedReason: "quota_exhausted" },
          { category: "one_to_one", quota: q(0, 0), coinCost: 100, action: "locked", lockedReason: "not_included" },
          { category: "group_call", quota: q(12, 3), coinCost: null, action: "book", lockedReason: null },
        ],
      },
    };
    render(<MentorshipDashboard />);
    const card = (name: RegExp) => screen.getByRole("button", { name });
    expect(card(/^☎ Sales Calls/).textContent).toContain("5 free · Book Call");
    expect(card(/^⚙ Tech Calls/).textContent).toContain("Unlock with TBT Coins · 50");
    expect(card(/^▶ Content Calls/).textContent).toContain("Purchase TBT Coins");
    expect(card(/^📢 Marketing Calls/).textContent).toContain("All calls used");
    expect(card(/^♟ Mentor 1-On-1/).textContent).toContain("Not in your plan");
    expect(card(/^♟ Mentor 1-On-1/).getAttribute("data-call-action")).toBe("locked");
    expect(card(/^👥 Live Group Q&A/).textContent).toContain("9 free · Book Call");
  });
});

describe("MentorshipDashboard — lifeline hearts", () => {
  /** The red lifeline pill: filled ❤️ = remaining, faded 🤍 = used, and the + buy button. */
  const pill = () => {
    const el = [...document.querySelectorAll("span")].find((s) => /❤️|🤍/.test(s.textContent ?? "") && s.style.background !== "")!;
    return {
      el,
      filled: (el.textContent!.match(/❤️/g) ?? []).length,
      used: (el.textContent!.match(/🤍/g) ?? []).length,
      plus: [...el.querySelectorAll<HTMLButtonElement>("button[data-lifeline-buy]")],
    };
  };
  const plusCount = () => document.querySelectorAll("button[data-lifeline-buy]").length;
  const withLifelines = (total: number, used: number) => {
    state.batch = { data: { lifelinesTotal: total, lifelinesUsed: used }, isLoading: false };
  };
  /** Backend stats.programVideos — the single source of truth for the "+". */
  const withVideos = (pv: { total: number; completed: number } | null | undefined) => {
    state.stats = { ...state.stats, data: { ...state.stats.data, programVideos: pv } };
    if (pv === undefined) delete state.stats.data.programVideos;
  };
  const ALL_DONE = { total: 10, completed: 10 };

  it("hearts keep showing the lifeline balance (filled = remaining, faded = used)", () => {
    for (const used of [0, 1, 2, 3]) {
      withLifelines(3, used);
      render(<MentorshipDashboard />);
      expect(pill()).toMatchObject({ filled: 3 - used, used });
      cleanup();
    }
  });

  it("no required videos completed: no +", () => {
    withVideos({ total: 10, completed: 0 });
    render(<MentorshipDashboard />);
    expect(plusCount()).toBe(0);
  });

  it("some required videos completed: no +", () => {
    withVideos({ total: 10, completed: 9 });
    render(<MentorshipDashboard />);
    expect(plusCount()).toBe(0);
  });

  it("all required videos completed: exactly ONE +", () => {
    withVideos(ALL_DONE);
    render(<MentorshipDashboard />);
    expect(pill().plus).toHaveLength(1);
    expect(plusCount()).toBe(1);
  });

  it("missing / null completion data keeps the + hidden", () => {
    for (const pv of [undefined, null]) {
      withVideos(pv);
      render(<MentorshipDashboard />);
      expect(plusCount()).toBe(0);
      cleanup();
    }
  });

  it("zero eligible required videos keeps the + hidden", () => {
    withVideos({ total: 0, completed: 0 });
    render(<MentorshipDashboard />);
    expect(plusCount()).toBe(0);
  });

  it("the + follows video completion, not the lifeline balance", () => {
    // all three hearts used, videos not finished → no +
    withLifelines(3, 3);
    withVideos({ total: 10, completed: 4 });
    render(<MentorshipDashboard />);
    expect(pill()).toMatchObject({ filled: 0, used: 3 });
    expect(plusCount()).toBe(0);
    cleanup();
    // videos finished with hearts still unused → one +
    withLifelines(3, 0);
    withVideos(ALL_DONE);
    render(<MentorshipDashboard />);
    expect(pill()).toMatchObject({ filled: 3, used: 0 });
    expect(plusCount()).toBe(1);
  });

  it("repeated renders never add more + buttons", () => {
    withVideos(ALL_DONE);
    const { rerender } = render(<MentorshipDashboard />);
    for (let i = 0; i < 4; i++) rerender(<MentorshipDashboard />);
    expect(plusCount()).toBe(1);
  });

  it("no lifeline data (not in a batch): no hearts and no +, even with all videos done", () => {
    withVideos(ALL_DONE);
    state.batch = { data: null, isLoading: false };
    render(<MentorshipDashboard />);
    expect(plusCount()).toBe(0);
    expect(document.body.textContent).not.toMatch(/❤️|🤍/);
  });

  it("labels the + with the admin-configured Extra Lifeline price", () => {
    withVideos(ALL_DONE);
    state.pricing = [{ credit_type: "tech_support", price_inr: 999 }, { credit_type: "lifeline", price_inr: "249.00" }];
    render(<MentorshipDashboard />);
    expect(screen.getByRole("button", { name: "Buy an extra lifeline for ₹249" })).toBeTruthy();
  });

  it("clicking + starts one purchase and shows its message (purchase flow unchanged)", async () => {
    withVideos(ALL_DONE);
    state.buy = { buy: vi.fn(async () => ({ outcome: "error", stage: "order", code: "PRICE_NOT_CONFIGURED" })), busy: false };
    render(<MentorshipDashboard />);
    fireEvent.click(pill().plus[0]);
    expect(state.buy.buy).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(toastMock.error.mock.calls[0][0]).toContain("ref: PRICE_NOT_CONFIGURED");
  });

  it("a successful purchase shows the success message", async () => {
    withVideos(ALL_DONE);
    state.buy = { buy: vi.fn(async () => ({ outcome: "success" })), busy: false };
    render(<MentorshipDashboard />);
    fireEvent.click(pill().plus[0]);
    await vi.waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Extra lifeline added!", expect.anything()));
  });

  it("a cancelled checkout shows the cancel message and nothing else", async () => {
    withVideos(ALL_DONE);
    state.buy = { buy: vi.fn(async () => ({ outcome: "cancelled" })), busy: false };
    render(<MentorshipDashboard />);
    fireEvent.click(pill().plus[0]);
    await vi.waitFor(() => expect(toastMock.info).toHaveBeenCalledWith("Payment cancelled — no lifeline added.", expect.anything()));
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("while a purchase is in progress the + is disabled, busy and shows a spinner", () => {
    withVideos(ALL_DONE);
    state.buy = { buy: vi.fn(), busy: true };
    render(<MentorshipDashboard />);
    const btn = pill().plus[0];
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.querySelector(".animate-spin")).toBeTruthy();
    fireEvent.click(btn);
    expect(state.buy.buy).not.toHaveBeenCalled();
  });
});

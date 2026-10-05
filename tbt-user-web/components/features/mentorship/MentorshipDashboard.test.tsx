import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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
vi.mock("@/lib/hooks/useBatchProgram", () => ({ useMyBatchProgram: () => state.batch }));
vi.mock("@/lib/hooks/useUser", () => ({ useUserSupportQuota: () => state.quota }));

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

beforeEach(() => Object.assign(state, baseData()));
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
});

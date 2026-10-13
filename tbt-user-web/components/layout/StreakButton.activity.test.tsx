import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { StreakButton } from "./StreakButton";
import MentorshipDashboard from "@/components/features/mentorship/MentorshipDashboard";

// Navbar flame = daily streak (GET /api/user/streak). Dashboard Tier Access tile =
// active program days / configured duration (GET /api/user/mentorship/stats). Both
// come from the same backend activity-day ledger; here each hook is a shared mutable
// fixture so the test can check what each place renders and that they update together.
const state = vi.hoisted(() => ({ stats: {} as any, streak: {} as any }));

vi.mock("@/lib/hooks/useMentorship", () => ({
  useMentorshipStats: () => state.stats,
  useMentorshipRevenue: () => ({ data: null }),
  useUpsertMentorshipRevenue: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMentorshipSocial: () => ({ data: null }),
  useUpsertMentorshipSocial: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/hooks/useDashboard", () => ({
  useMyStreak: () => state.streak,
  useContinueLearning: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/lib/hooks/useBatchProgram", () => ({ useMyBatchProgram: () => ({ data: null, isLoading: false }) }));
// The dashboard renders its error view without quota data, so give it a real shape.
const bucket = (allocated: number, used: number) => ({ allocated, used, remaining: allocated - used });
vi.mock("@/lib/hooks/useUser", () => ({
  useUserSupportQuota: () => ({
    data: {
      salesSupport: bucket(1, 0), techSupport: bucket(1, 0), contentSupport: bucket(1, 0),
      adSupport: bucket(1, 0), callCredits: bucket(1, 0), groupCall: bucket(1, 0),
      oneToOne: false, lifelines: { total: 3, used: 0, remaining: 3 },
    },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
}));

const stats = (activeDays: number, totalDays: number, daysElapsed = 30) => ({
  data: {
    dailyTimeSpentHrs: 1, dailyTimeGoalHrs: 2, weeklyReportSubmitted: false, streakDays: 0,
    totalEpisodes: 4, completedEpisodes: 1, tasksCompleted: 0, tasksTotal: 0,
    leaderboardRank: null, daysElapsed, activeDays, totalDays, programName: "TBT Program",
  },
  isLoading: false, isError: false, refetch: vi.fn(),
});
const streak = (currentStreak: number, activeToday = true) => ({
  data: { currentStreak, longestStreak: currentStreak, activeToday, totalActiveDays: currentStreak, pointsToday: 0, last7Days: [] },
  isLoading: false,
});

const flame = () => screen.getByRole("button", { name: /Learning Streak:/ });
const flameValue = () => flame().textContent!.replace(/\s+/g, "");
const tierTile = () =>
  screen.getByText("Tier Access").closest("div")!.parentElement!.textContent!.replace(/\s+/g, "").replace("TierAccess", "");

beforeEach(() => {
  state.stats = stats(12, 90);
  state.streak = streak(3);
});
afterEach(cleanup);

describe("Navbar streak + dashboard Tier Access", () => {
  it("navbar shows the daily streak; Tier Access shows active days / program duration", () => {
    render(<><StreakButton /><MentorshipDashboard /></>);
    expect(flameValue()).toBe("3");
    expect(flame().getAttribute("aria-label")).toBe("Learning Streak: 3 days");
    expect(tierTile()).toBe("12/90d");
  });

  it("Tier Access uses active days, not calendar days since the batch started", () => {
    state.stats = stats(5, 90, 40); // 40 calendar days in, active on 5 of them
    render(<MentorshipDashboard />);
    expect(tierTile()).toBe("5/90d");
  });

  it("uses the configured duration (extended program)", () => {
    state.stats = stats(12, 104);
    render(<MentorshipDashboard />);
    expect(tierTile()).toBe("12/104d");
  });

  it("both update after a new active day", () => {
    const { rerender } = render(<><StreakButton /><MentorshipDashboard /></>);
    state.streak = streak(4);
    state.stats = stats(13, 90);
    rerender(<><StreakButton /><MentorshipDashboard /></>);
    expect(flameValue()).toBe("4");
    expect(tierTile()).toBe("13/90d");
  });

  it("after a missed day the streak drops but Tier Access keeps its total", () => {
    state.streak = streak(1);
    state.stats = stats(13, 90);
    render(<><StreakButton /><MentorshipDashboard /></>);
    expect(flameValue()).toBe("1");
    expect(tierTile()).toBe("13/90d");
  });

  it("older API responses without activeDays show 0, never calendar days", () => {
    state.stats = stats(0, 90, 45);
    delete state.stats.data.activeDays;
    render(<MentorshipDashboard />);
    expect(tierTile()).toBe("0/90d");
  });

  it("keeps the streak dropdown", () => {
    state.streak = streak(5);
    render(<StreakButton />);
    fireEvent.click(flame());
    expect(screen.getByRole("dialog").textContent!.replace(/\s+/g, "")).toContain("5days");
  });
});

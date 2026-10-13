import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { StreakButton } from "./StreakButton";
import MentorshipDashboard from "@/components/features/mentorship/MentorshipDashboard";

// Navbar flame label and the dashboard "Tier Access" tile both read
// activeDays/totalDays from the same useMentorshipStats() query
// (GET /api/user/mentorship/stats). Each hook is a shared mutable fixture here so
// the test checks both places render the same value and change together.
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
const streak = (currentStreak: number, activeToday = false) => ({
  data: { currentStreak, longestStreak: currentStreak, activeToday, totalActiveDays: currentStreak, pointsToday: 0, last7Days: [] },
  isLoading: false,
});

const flame = () => screen.getByRole("button", { name: /^Tier Access:/ });
const flameValue = () => flame().textContent!.replace(/\s+/g, "");
const tierTile = () =>
  screen.getByText("Tier Access").closest("div")!.parentElement!.textContent!.replace(/\s+/g, "").replace("TierAccess", "");
const both = () => <><StreakButton /><MentorshipDashboard /></>;

beforeEach(() => {
  state.stats = stats(0, 90);
  state.streak = streak(2);
});
afterEach(cleanup);

describe("Navbar flame shows Tier Access, same as the dashboard tile", () => {
  it("0/90d in both places", () => {
    render(both());
    expect(flameValue()).toBe("0/90d");
    expect(tierTile()).toBe("0/90d");
  });

  it("changes to 15/90d in both places", () => {
    const { rerender } = render(both());
    state.stats = stats(15, 90);
    rerender(both());
    expect(flameValue()).toBe("15/90d");
    expect(tierTile()).toBe("15/90d");
  });

  it("matches again after a refresh (fresh mount from the same data)", () => {
    state.stats = stats(15, 90);
    render(both());
    const before = [flameValue(), tierTile()];
    cleanup();
    render(both());
    expect([flameValue(), tierTile()]).toEqual(before);
    expect(before).toEqual(["15/90d", "15/90d"]);
  });

  it("is active days, not calendar days, and follows the configured duration", () => {
    state.stats = stats(5, 104, 60);
    render(both());
    expect(flameValue()).toBe("5/104d");
    expect(tierTile()).toBe("5/104d");
  });

  it("shows a placeholder while loading", () => {
    state.stats = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    render(<StreakButton />);
    expect(flameValue()).toBe("–");
  });

  it("keeps the daily streak in the dropdown and accessible name", () => {
    state.streak = streak(5);
    render(<StreakButton />);
    expect(flame().getAttribute("aria-label")).toBe("Tier Access: 0/90d. Learning Streak: 5 days");
    fireEvent.click(flame());
    expect(screen.getByRole("dialog").textContent!.replace(/\s+/g, "")).toContain("5days");
  });
});

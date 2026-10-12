import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { StreakButton } from "./StreakButton";
import MentorshipDashboard from "@/components/features/mentorship/MentorshipDashboard";

// One shared stats object stands in for the ["user","mentorship-stats"] query both
// components read, so the test checks they render the same Tier Access value from
// the same source — and that the navbar never shows the daily streak there.
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

const stats = (daysElapsed: number, totalDays: number) => ({
  data: {
    dailyTimeSpentHrs: 1, dailyTimeGoalHrs: 2, weeklyReportSubmitted: false, streakDays: 0,
    totalEpisodes: 4, completedEpisodes: 1, tasksCompleted: 0, tasksTotal: 0,
    leaderboardRank: null, daysElapsed, totalDays, programName: "TBT Program",
  },
  isLoading: false, isError: false, refetch: vi.fn(),
});
const streak = (currentStreak: number) => ({
  data: { currentStreak, longestStreak: currentStreak, activeToday: false, totalActiveDays: currentStreak, pointsToday: 0, last7Days: [] },
  isLoading: false,
});

const navbarValue = () =>
  screen.getByRole("button", { name: /Tier Access:/ }).textContent!.replace(/\s+/g, "");
const tierTile = () =>
  screen.getByText("Tier Access").closest("div")!.parentElement!.textContent!.replace(/\s+/g, "").replace("TierAccess", "");

beforeEach(() => {
  state.stats = stats(12, 90);
  state.streak = streak(0);
});
afterEach(cleanup);

describe("Navbar Tier Access beside the flame", () => {
  it("shows the dashboard's Tier Access value (12/90d), not the daily streak", () => {
    render(<><StreakButton /><MentorshipDashboard /></>);
    expect(navbarValue()).toBe("12/90d");
    expect(tierTile()).toBe("12/90d");
  });

  it("stays in sync when the Tier Access value changes", () => {
    const { rerender } = render(<><StreakButton /><MentorshipDashboard /></>);
    state.stats = stats(45, 174); // e.g. admin extended the program
    rerender(<><StreakButton /><MentorshipDashboard /></>);
    expect(navbarValue()).toBe("45/174d");
    expect(tierTile()).toContain("45/174d");
  });

  it("keeps the daily streak in the dropdown and accessible name", () => {
    state.streak = streak(5);
    render(<StreakButton />);
    const btn = screen.getByRole("button", { name: /Tier Access:/ });
    expect(btn.getAttribute("aria-label")).toMatch(/: 5 days\. Tier Access: 12\/90d$/);
    fireEvent.click(btn);
    // Dropdown hero still shows the streak count ("5 days"), not the Tier value.
    expect(screen.getByRole("dialog").textContent!.replace(/\s+/g, "")).toContain("5days");
  });

  it("shows a placeholder while Tier Access loads and never hardcodes a total", () => {
    state.stats = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    render(<StreakButton />);
    expect(navbarValue()).toBe("–");
    cleanup();
    state.stats = stats(3, 0); // no total from the API → same "d" fallback as the tile
    render(<StreakButton />);
    expect(navbarValue()).toBe("3d");
  });
});

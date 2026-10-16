import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { StreakButton } from "./StreakButton";
import { TierAccessIndicator } from "./TierAccessIndicator";
import MentorshipDashboard from "@/components/features/mentorship/MentorshipDashboard";

// Two independent navbar indicators:
//   StreakButton        → useMyStreak()        (GET /api/user/streak)
//   TierAccessIndicator → useMentorshipStats() (GET /api/user/mentorship/stats)
// The dashboard's Tier Access tile reads the same stats as TierAccessIndicator.
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
vi.mock("@/lib/hooks/useBatchProgram", () => ({
  useMyBatchProgram: () => ({ data: null, isLoading: false }),
  useMyWeeklyGraph: () => ({ data: null, isLoading: false, isError: false }),
}));
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

const stats = (activeDays: number, totalDays: number) => ({
  data: {
    dailyTimeSpentHrs: 1, dailyTimeGoalHrs: 2, weeklyReportSubmitted: false, streakDays: 0,
    totalEpisodes: 4, completedEpisodes: 1, tasksCompleted: 0, tasksTotal: 0,
    leaderboardRank: null, daysElapsed: 30, activeDays, totalDays, programName: "TBT Program",
  },
  isLoading: false, isError: false, refetch: vi.fn(),
});
const streak = (currentStreak: number) => ({
  data: { currentStreak, longestStreak: currentStreak, activeToday: true, totalActiveDays: currentStreak, pointsToday: 0, last7Days: [] },
  isLoading: false,
});

// Visual spacing comes from CSS gap between spans, so compare without whitespace.
const flat = (el: Element) => el.textContent!.replace(/\s+/g, "");
const streakEl = () => screen.getByRole("button", { name: /^Learning Streak:/ });
const tierEl = () => screen.getByRole("status", { name: /^Tier Access:/ });
const tierTile = () =>
  screen.getByText("Tier Access", { selector: "span.truncate" }).closest("div")!.parentElement!.textContent!.replace(/\s+/g, "").replace("TierAccess", "");
const navbar = () => <><StreakButton /><TierAccessIndicator /></>;

beforeEach(() => {
  state.stats = stats(12, 90);
  state.streak = streak(5);
});
afterEach(cleanup);

describe("Navbar: Streak and Tier Access are separate indicators", () => {
  it("renders two independent elements with their own label and value", () => {
    render(navbar());
    expect(flat(streakEl())).toBe("5");
    expect(flat(tierEl())).toBe("12/90d");
    // Neither sits inside the other's container.
    expect(streakEl().contains(tierEl())).toBe(false);
    expect(tierEl().contains(streakEl())).toBe(false);
    // Values only: the streak count, and Tier Access as active/total days. No labels shown.
    expect(streakEl().textContent).not.toMatch(/streak|Tier|\d+d/i);
    expect(tierEl().textContent).not.toMatch(/streak|Tier/i);
    // Full context stays available to screen readers / tooltip.
    expect(tierEl().getAttribute("aria-label")).toBe("Tier Access: 12/90d");
    expect(streakEl().getAttribute("aria-label")).toBe("Learning Streak: 5 days");
  });

  it("changing the streak does not change Tier Access", () => {
    const { rerender } = render(navbar());
    state.streak = streak(9);
    rerender(navbar());
    expect(flat(streakEl())).toBe("9");
    expect(flat(tierEl())).toBe("12/90d");
  });

  it("changing Tier Access does not change the streak", () => {
    const { rerender } = render(navbar());
    state.stats = stats(15, 90);
    rerender(navbar());
    expect(flat(tierEl())).toBe("15/90d");
    expect(flat(streakEl())).toBe("5");
  });

  it("Tier Access matches the dashboard tile", () => {
    state.stats = stats(15, 104);
    render(<>{navbar()}<MentorshipDashboard /></>);
    expect(tierEl().getAttribute("aria-label")).toBe("Tier Access: 15/104d");
    expect(flat(tierEl())).toBe("15/104d");
    expect(tierTile()).toBe("15/104d");
  });

  it("each shows its own placeholder while loading", () => {
    state.streak = { data: undefined, isLoading: true };
    state.stats = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    render(navbar());
    expect(flat(streakEl())).toBe("–");
    expect(flat(tierEl())).toBe("–");
  });

  it("both counters share one layout so the numbers line up on every width", () => {
    render(navbar());
    for (const el of [streakEl(), tierEl()]) {
      expect(el.className).toContain("items-center");
      expect(el.className).toContain("h-8");
      // No icon on either counter (no fire icon, no calendar icon) — value only.
      expect(el.querySelector("svg")).toBeNull();
    }
    // Same height + padding classes on both.
    const sizing = (el: HTMLElement) => el.className.split(" ").filter((c) => /^(h|px|gap)-/.test(c)).sort();
    expect(sizing(streakEl())).toEqual(sizing(tierEl()));
  });

  it("no decorative glow or pulsing badge, even when the streak is at risk", () => {
    state.streak = {
      data: { currentStreak: 4, longestStreak: 4, activeToday: false, totalActiveDays: 4, pointsToday: 0, last7Days: [] },
      isLoading: false,
    };
    const { container } = render(navbar());
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(container.innerHTML).not.toMatch(/drop-shadow/);
    expect(flat(streakEl())).toBe("4");
    // The at-risk explanation is still available in the dropdown.
    fireEvent.click(streakEl());
    expect(screen.getByRole("dialog").textContent).toMatch(/keep your streak alive/i);
  });

  it("each member's own numbers are shown (no shared or hardcoded values)", () => {
    const { rerender } = render(navbar());
    expect([flat(streakEl()), flat(tierEl())]).toEqual(["5", "12/90d"]);
    state.streak = streak(0);
    state.stats = stats(3, 104);
    rerender(navbar());
    expect([flat(streakEl()), flat(tierEl())]).toEqual(["0", "3/104d"]);
  });

  it("Tier Access falls back to the day count when the program has no duration", () => {
    state.stats = stats(7, 0);
    render(navbar());
    expect(flat(tierEl())).toBe("7d");
  });

  it("streak dropdown still works", () => {
    render(navbar());
    fireEvent.click(streakEl());
    expect(screen.getByRole("dialog").textContent!.replace(/\s+/g, "")).toContain("5days");
  });
});

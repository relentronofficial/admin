import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunitySidebar } from "./CommunitySidebar";

const lb = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/lib/hooks/useGamification", () => ({ useLeaderboard: () => lb.current }));

const row = (rank: number, first: string, pts: number, isMe = false) => ({
  rank,
  memberId: `m${rank}`,
  totalPoints: pts,
  member: { id: `m${rank}`, firstName: first, lastName: null, profilePhotoUrl: null },
  isMe,
});

describe("CommunitySidebar leaderboard", () => {
  it("lists the 30-day leaders with points and marks the current member", () => {
    lb.current = { data: [row(1, "Asha", 120), row(2, "Ravi", 80, true)], isLoading: false, isError: false };
    render(<CommunitySidebar onCompose={() => {}} />);
    expect(screen.getByText("Last 30 days")).toBeTruthy();
    expect(screen.getByText("+120")).toBeTruthy();
    expect(screen.getByText("(you)")).toBeTruthy();
  });

  it("shows an empty state when nobody earned points", () => {
    lb.current = { data: [], isLoading: false, isError: false };
    render(<CommunitySidebar onCompose={() => {}} />);
    expect(screen.getByText("No points earned in the last 30 days yet.")).toBeTruthy();
  });

  it("shows a non-blocking message when the leaderboard fails", () => {
    lb.current = { data: undefined, isLoading: false, isError: true };
    render(<CommunitySidebar onCompose={() => {}} />);
    expect(screen.getByText("Leaderboard is unavailable right now.")).toBeTruthy();
  });
});

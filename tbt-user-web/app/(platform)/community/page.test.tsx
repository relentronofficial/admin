import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CommunityPost } from "@/types";
import CommunityPage from "./page";

// Page-level layout + state test. The feed hook, child sheets and the sidebar's data
// hook are mocked — this checks what the page renders for each feed state, not the
// network layer (covered by the backend).
const feed = vi.hoisted(() => ({ current: {} as Record<string, unknown>, filters: [] as string[] }));
vi.mock("@/lib/hooks/useCommunity", () => ({
  useFeed: (filter: string) => {
    feed.filters.push(filter);
    return feed.current;
  },
  memberDisplayName: (m?: { firstName?: string | null; lastName?: string | null } | null) =>
    m ? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || "Member" : "Member",
}));
vi.mock("@/lib/hooks/useGamification", () => ({
  useLeaderboard: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock("@/components/features/community/PostCard", () => ({
  PostCard: ({ post }: { post: CommunityPost }) => <article data-testid="post">{post.content}</article>,
}));
vi.mock("@/components/features/community/Composer", () => ({
  InlineComposerRow: () => <div>Write something</div>,
  ComposerModal: () => null,
}));
vi.mock("@/components/features/community/CommentSheet", () => ({ CommentSheet: () => null }));
vi.mock("@/components/features/community/AuthorProfileSheet", () => ({ AuthorProfileSheet: () => null }));
vi.mock("@/components/features/community/LikersSheet", () => ({ LikersSheet: () => null }));
vi.mock("@/components/features/community/ReportSheet", () => ({ ReportSheet: () => null }));

const refetch = vi.fn();
function setFeed(over: Record<string, unknown>) {
  feed.current = {
    data: undefined,
    isLoading: false,
    isError: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch,
    isRefetching: false,
    ...over,
  };
}

const post = (id: string, content: string) => ({ id, content }) as unknown as CommunityPost;

describe("Community page", () => {
  beforeEach(() => {
    refetch.mockReset();
    feed.filters = [];
  });

  it("renders the banner, composer, filter pills, feed and desktop sidebar", () => {
    setFeed({ data: { pages: [[post("1", "First win"), post("2", "A question")]] } });
    render(<CommunityPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Community" })).toBeTruthy();
    expect(screen.getByText("Write something")).toBeTruthy();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["For You", "Following", "Mentors", "My Posts"]);
    expect(screen.getAllByTestId("post").map((p) => p.textContent)).toEqual(["First win", "A question"]);
    expect(screen.getByText("Leaderboard")).toBeTruthy();
  });

  it("switches the feed filter from the pills", () => {
    setFeed({ data: { pages: [[]] } });
    render(<CommunityPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Mentors" }));
    expect(screen.getByRole("tab", { name: "Mentors" }).getAttribute("aria-selected")).toBe("true");
    expect(feed.filters.at(-1)).toBe("mentors");
  });

  it("shows a loading skeleton while the feed loads", () => {
    setFeed({ isLoading: true });
    render(<CommunityPage />);
    expect(screen.getByLabelText("Loading feed")).toBeTruthy();
    expect(screen.queryAllByTestId("post")).toHaveLength(0);
  });

  it("shows an error with a working retry button", () => {
    setFeed({ isError: true });
    render(<CommunityPage />);
    expect(screen.getByText("Could not load the community feed.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the filter-specific empty state", () => {
    setFeed({ data: { pages: [[]] } });
    render(<CommunityPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Following" }));
    expect(screen.getByText("Follow other members to see their posts here.")).toBeTruthy();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CommunityPost } from "@/types";
import { PostCard } from "./PostCard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/hooks/useUser", () => ({ useMe: () => ({ data: { id: "me" } }) }));
vi.mock("@/lib/hooks/useCommunity", () => ({
  useToggleLike: () => ({ mutate: vi.fn() }),
  useToggleBookmark: () => ({ mutate: vi.fn() }),
  useDeleteOwnPost: () => ({ mutate: vi.fn() }),
  memberDisplayName: () => "Asha K",
}));

const handlers = { onOpenComments: vi.fn(), onOpenAuthor: vi.fn(), onOpenLikers: vi.fn(), onReport: vi.fn() };

function makePost(content: string): CommunityPost {
  return {
    id: "p1",
    memberId: "m1",
    content,
    mediaUrls: [],
    likesCount: 3,
    commentsCount: 2,
    isMentor: false,
    isPinned: false,
    isLikedByMe: false,
    isBookmarkedByMe: false,
    createdAt: new Date().toISOString(),
    member: { id: "m1", firstName: "Asha", lastName: "K" },
  };
}

describe("PostCard", () => {
  it("collapses a long post behind See more / See less", () => {
    render(<PostCard post={makePost("word ".repeat(120))} handlers={handlers} />);
    const toggle = screen.getByRole("button", { name: "See more" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "See less" })).toBeTruthy();
  });

  it("shows short posts in full with no toggle", () => {
    render(<PostCard post={makePost("Closed my first deal today!")} handlers={handlers} />);
    expect(screen.queryByRole("button", { name: "See more" })).toBeNull();
  });

  it("keeps every existing action", () => {
    render(<PostCard post={makePost("Hi")} handlers={handlers} />);
    for (const label of ["3", "2", "Save", "Share"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "More options" })).toBeTruthy();
  });
});

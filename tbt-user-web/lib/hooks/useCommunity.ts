"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { communityService } from "@/lib/api/services/community.service";
import type {
  ApiResponse,
  CommunityComment,
  CommunityFilter,
  CommunityMemberRef,
  CommunityPost,
  ReportReason,
} from "@/types";

const PAGE_SIZE = 20;

export const communityKeys = {
  feed: (filter: CommunityFilter) => ["community", "feed", filter] as const,
  bookmarks: ["community", "bookmarks"] as const,
  comments: (postId: string) => ["community", "comments", postId] as const,
  likers: (postId: string) => ["community", "likers", postId] as const,
  profile: (memberId: string) => ["community", "profile", memberId] as const,
  followers: (memberId: string) => ["community", "followers", memberId] as const,
  following: ["community", "following", "me"] as const,
  hashtag: (tag: string) => ["community", "hashtag", tag] as const,
  search: (q: string) => ["community", "search", q] as const,
};

// ── Feed (paginated) ────────────────────────────────────────────────────────

export function useFeed(filter: CommunityFilter) {
  return useInfiniteQuery({
    queryKey: communityKeys.feed(filter),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await communityService.listFeed({
        page: pageParam as number,
        limit: PAGE_SIZE,
        filter,
      });
      return res.data ?? [];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= PAGE_SIZE ? allPages.length + 1 : undefined,
    staleTime: 30 * 1000,
  });
}

// ── Post mutations ──────────────────────────────────────────────────────────

export function useSubmitPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { content: string; mediaUrls?: string[] }) =>
      communityService.submitPost(body),
    onSuccess: () => {
      // Refetch the currently visible tab; posts start as isApproved=false
      // and won't appear until an admin approves, so just invalidate.
      qc.invalidateQueries({ queryKey: ["community", "feed"] });
    },
  });
}

export function useDeleteOwnPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => communityService.deleteOwnPost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community", "feed"] });
      qc.invalidateQueries({ queryKey: communityKeys.bookmarks });
    },
  });
}

// ── Optimistic like/bookmark helpers ────────────────────────────────────────

type FeedInfinite = { pages: CommunityPost[][]; pageParams: unknown[] };

function patchPostInEveryFeedCache(
  qc: ReturnType<typeof useQueryClient>,
  postId: string,
  patch: (p: CommunityPost) => CommunityPost,
) {
  // Every infinite feed cache we know about (feed by filter, bookmarks, hashtag).
  const roots: unknown[][] = [
    ["community", "feed"],
    communityKeys.bookmarks as unknown as unknown[],
    ["community", "hashtag"],
  ];
  for (const root of roots) {
    qc.getQueriesData<FeedInfinite | CommunityPost[]>({ queryKey: root }).forEach(
      ([key, data]) => {
        if (!data) return;
        // Handle both infinite (`{ pages }`) and flat array shapes
        if ("pages" in (data as FeedInfinite)) {
          const next: FeedInfinite = {
            ...(data as FeedInfinite),
            pages: (data as FeedInfinite).pages.map((page) =>
              page.map((p) => (p.id === postId ? patch(p) : p)),
            ),
          };
          qc.setQueryData(key, next);
        } else {
          const arr = data as CommunityPost[];
          qc.setQueryData(
            key,
            arr.map((p) => (p.id === postId ? patch(p) : p)),
          );
        }
      },
    );
  }
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => communityService.toggleLike(postId),
    onMutate: async (postId) => {
      // Optimistically flip liked + adjust count.
      await qc.cancelQueries({ queryKey: ["community"] });
      patchPostInEveryFeedCache(qc, postId, (p) => ({
        ...p,
        isLikedByMe: !p.isLikedByMe,
        likesCount: Math.max(0, p.likesCount + (p.isLikedByMe ? -1 : 1)),
      }));
    },
    onSuccess: (res, postId) => {
      const d = res.data;
      if (!d) return;
      patchPostInEveryFeedCache(qc, postId, (p) => ({
        ...p,
        isLikedByMe: d.liked,
        likesCount: d.likesCount,
      }));
    },
    onError: (_e, postId) => {
      // Rollback by flipping again.
      patchPostInEveryFeedCache(qc, postId, (p) => ({
        ...p,
        isLikedByMe: !p.isLikedByMe,
        likesCount: Math.max(0, p.likesCount + (p.isLikedByMe ? -1 : 1)),
      }));
    },
  });
}

export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => communityService.toggleBookmark(postId),
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: ["community"] });
      patchPostInEveryFeedCache(qc, postId, (p) => ({
        ...p,
        isBookmarkedByMe: !p.isBookmarkedByMe,
      }));
    },
    onSuccess: (res, postId) => {
      const d = res.data;
      if (!d) return;
      patchPostInEveryFeedCache(qc, postId, (p) => ({
        ...p,
        isBookmarkedByMe: d.bookmarked,
      }));
      qc.invalidateQueries({ queryKey: communityKeys.bookmarks });
    },
    onError: (_e, postId) => {
      patchPostInEveryFeedCache(qc, postId, (p) => ({
        ...p,
        isBookmarkedByMe: !p.isBookmarkedByMe,
      }));
    },
  });
}

// ── Comments ────────────────────────────────────────────────────────────────

export function useComments(postId: string, enabled = true) {
  return useQuery({
    queryKey: communityKeys.comments(postId),
    queryFn: async () => (await communityService.listComments(postId)).data ?? [],
    enabled: enabled && !!postId,
    staleTime: 15 * 1000,
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { content: string; parentCommentId?: string }) =>
      communityService.addComment(postId, payload.content, payload.parentCommentId),
    onSuccess: (res) => {
      const newComment = res.data;
      if (newComment) {
        qc.setQueryData<CommunityComment[]>(
          communityKeys.comments(postId),
          (prev) => [...(prev ?? []), newComment],
        );
      }
      // bump commentsCount in every visible feed cache
      patchPostInEveryFeedCache(qc, postId, (p) => ({
        ...p,
        commentsCount: p.commentsCount + 1,
      }));
    },
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      communityService.deleteComment(postId, commentId),
    onSuccess: (_r, commentId) => {
      qc.setQueryData<CommunityComment[]>(
        communityKeys.comments(postId),
        (prev) => prev?.filter((c) => c.id !== commentId) ?? [],
      );
      patchPostInEveryFeedCache(qc, postId, (p) => ({
        ...p,
        commentsCount: Math.max(0, p.commentsCount - 1),
      }));
    },
  });
}

export function useToggleCommentLike(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => communityService.toggleCommentLike(commentId),
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: communityKeys.comments(postId) });
      qc.setQueryData<CommunityComment[]>(
        communityKeys.comments(postId),
        (prev) =>
          prev?.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  isLikedByMe: !c.isLikedByMe,
                  likesCount: Math.max(0, c.likesCount + (c.isLikedByMe ? -1 : 1)),
                }
              : c,
          ) ?? [],
      );
    },
    onSuccess: (res, commentId) => {
      const d = res.data;
      if (!d) return;
      qc.setQueryData<CommunityComment[]>(
        communityKeys.comments(postId),
        (prev) =>
          prev?.map((c) =>
            c.id === commentId
              ? { ...c, isLikedByMe: d.liked, likesCount: d.likesCount }
              : c,
          ) ?? [],
      );
    },
    onError: (_e, commentId) => {
      qc.setQueryData<CommunityComment[]>(
        communityKeys.comments(postId),
        (prev) =>
          prev?.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  isLikedByMe: !c.isLikedByMe,
                  likesCount: Math.max(0, c.likesCount + (c.isLikedByMe ? -1 : 1)),
                }
              : c,
          ) ?? [],
      );
    },
  });
}

// ── Likers ──────────────────────────────────────────────────────────────────

export function useLikers(postId: string, enabled = true) {
  return useQuery({
    queryKey: communityKeys.likers(postId),
    queryFn: async () =>
      (await communityService.listLikers(postId, { limit: 100 })).data ?? [],
    enabled: enabled && !!postId,
  });
}

// ── Bookmarks page ──────────────────────────────────────────────────────────

export function useBookmarks() {
  return useInfiniteQuery({
    queryKey: communityKeys.bookmarks,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (await communityService.listBookmarks({ page: pageParam as number, limit: 20 }))
        .data ?? [],
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= 20 ? allPages.length + 1 : undefined,
    staleTime: 30 * 1000,
  });
}

// ── Member profile / follow ────────────────────────────────────────────────

export function useMemberProfile(memberId: string, enabled = true) {
  return useQuery({
    queryKey: communityKeys.profile(memberId),
    queryFn: async () => (await communityService.getMemberProfile(memberId)).data,
    enabled: enabled && !!memberId,
    staleTime: 60 * 1000,
  });
}

export function useToggleFollow(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => communityService.toggleFollow(memberId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: communityKeys.profile(memberId) });
      const prev = qc.getQueryData<ApiResponse<never> | undefined>(
        communityKeys.profile(memberId),
      );
      qc.setQueryData(communityKeys.profile(memberId), (p: unknown) => {
        if (!p || typeof p !== "object") return p;
        const prof = p as { isFollowing: boolean; followersCount: number };
        return {
          ...prof,
          isFollowing: !prof.isFollowing,
          followersCount: Math.max(0, prof.followersCount + (prof.isFollowing ? -1 : 1)),
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(communityKeys.profile(memberId), ctx.prev);
      }
    },
    onSuccess: (res) => {
      const d = res.data;
      if (!d) return;
      qc.setQueryData(communityKeys.profile(memberId), (p: unknown) => {
        if (!p || typeof p !== "object") return p;
        const prof = p as { followersCount: number; isFollowing: boolean };
        return {
          ...prof,
          isFollowing: d.following,
          followersCount: Math.max(
            0,
            prof.followersCount + (d.following !== prof.isFollowing
              ? (d.following ? 1 : -1)
              : 0),
          ),
        };
      });
    },
  });
}

// ── Search / hashtag ────────────────────────────────────────────────────────

export function useMemberSearch(q: string) {
  return useQuery<CommunityMemberRef[]>({
    queryKey: communityKeys.search(q),
    queryFn: async () => (await communityService.searchMembers(q, 10)).data ?? [],
    enabled: q.trim().length >= 2,
    staleTime: 30 * 1000,
  });
}

export function useHashtagFeed(tag: string) {
  return useInfiniteQuery({
    queryKey: communityKeys.hashtag(tag),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      (await communityService.hashtagFeed(tag, { page: pageParam as number, limit: 20 }))
        .data ?? [],
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= 20 ? allPages.length + 1 : undefined,
    enabled: !!tag,
    staleTime: 30 * 1000,
  });
}

// ── Report ──────────────────────────────────────────────────────────────────

export function useReportPost() {
  return useMutation({
    mutationFn: (payload: { postId: string; reason: ReportReason; detail?: string }) =>
      communityService.reportPost(payload.postId, payload.reason, payload.detail),
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function memberDisplayName(m: {
  firstName?: string | null;
  lastName?: string | null;
} | null | undefined): string {
  if (!m) return "Member";
  const first = m.firstName ?? "";
  const last = m.lastName ?? "";
  const joined = `${first} ${last}`.trim();
  return joined.length > 0 ? joined : "Member";
}

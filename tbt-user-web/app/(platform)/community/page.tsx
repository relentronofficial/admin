"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, RefreshCw } from "lucide-react";

import { useFeed } from "@/lib/hooks/useCommunity";
import type { CommunityFilter, CommunityPost } from "@/types";

import { PostCard } from "@/components/features/community/PostCard";
import {
  InlineComposerRow,
  ComposerModal,
} from "@/components/features/community/Composer";
import { CommentSheet } from "@/components/features/community/CommentSheet";
import { AuthorProfileSheet } from "@/components/features/community/AuthorProfileSheet";
import { LikersSheet } from "@/components/features/community/LikersSheet";
import { ReportSheet } from "@/components/features/community/ReportSheet";
import { CommunityBanner } from "@/components/features/community/CommunityBanner";
import { CommunitySidebar } from "@/components/features/community/CommunitySidebar";

const TABS: Array<{ id: CommunityFilter; label: string }> = [
  { id: "all", label: "For You" },
  { id: "following", label: "Following" },
  { id: "mentors", label: "Mentors" },
  { id: "mine", label: "My Posts" },
];

export default function CommunityPage() {
  const [filter, setFilter] = useState<CommunityFilter>("all");
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useFeed(filter);

  // Modal state
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentsFor, setCommentsFor] = useState<CommunityPost | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [likersFor, setLikersFor] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<CommunityPost | null>(null);

  // Infinite scroll — load next page when near bottom
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.innerHeight + window.scrollY;
      const total = document.documentElement.offsetHeight;
      if (total - scrolled < 400 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const posts: CommunityPost[] = data?.pages.flat() ?? [];

  return (
    <div className="max-w-[1120px] mx-auto pb-24 space-y-5">
      <CommunityBanner onRefresh={() => refetch()} refreshing={isRefetching} />

      {/* Feed column + sidebar (sidebar only on desktop, like Skool) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="min-w-0 space-y-4">
          {/* Inline composer */}
          <InlineComposerRow onOpen={() => setComposerOpen(true)} />

          {/* Filter pills */}
          <div
            className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
            role="tablist"
            aria-label="Feed filter"
          >
            {TABS.map((t) => {
              const active = filter === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(t.id)}
                  className="shrink-0 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors"
                  style={
                    active
                      ? {
                          color: "#fff",
                          background: "var(--color-accent)",
                          border: "1px solid var(--color-accent)",
                        }
                      : {
                          color: "var(--color-text-secondary)",
                          background: "var(--color-bg-surface)",
                          border: "1px solid var(--color-border-subtle)",
                        }
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Feed */}
          {isLoading ? (
            <div
              className="space-y-3"
              aria-busy="true"
              aria-label="Loading feed"
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl p-5 space-y-3 animate-pulse"
                  style={{
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full"
                      style={{ background: "var(--color-surface-overlay-md)" }}
                    />
                    <div className="space-y-1.5 flex-1">
                      <div
                        className="h-3 w-32 rounded"
                        style={{
                          background: "var(--color-surface-overlay-md)",
                        }}
                      />
                      <div
                        className="h-2.5 w-16 rounded"
                        style={{ background: "var(--color-surface-overlay)" }}
                      />
                    </div>
                  </div>
                  <div
                    className="h-3 w-full rounded"
                    style={{ background: "var(--color-surface-overlay)" }}
                  />
                  <div
                    className="h-3 w-4/5 rounded"
                    style={{ background: "var(--color-surface-overlay)" }}
                  />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div
              className="p-8 rounded-2xl text-center space-y-3"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <p className="text-sm text-muted-foreground">
                Could not load the community feed.
              </p>
              <button
                onClick={() => refetch()}
                disabled={isRefetching}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-foreground disabled:opacity-50 hover:bg-[var(--color-surface-overlay)]"
                style={{ border: "1px solid var(--color-border-medium)" }}
              >
                <RefreshCw
                  size={13}
                  className={isRefetching ? "animate-spin" : ""}
                />{" "}
                Try again
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div
              className="p-8 rounded-2xl text-center space-y-3"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <p className="text-sm text-muted-foreground">
                {filter === "mine"
                  ? "You haven't posted yet — share your first win."
                  : filter === "following"
                    ? "Follow other members to see their posts here."
                    : "No posts yet — be the first to share."}
              </p>
              <button
                onClick={() => setComposerOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wider text-white"
                style={{ background: "var(--color-accent)" }}
              >
                <Pencil size={13} /> COMPOSE A POST
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    handlers={{
                      onOpenComments: (p) => setCommentsFor(p),
                      onOpenAuthor: (id) => setAuthorId(id),
                      onOpenLikers: (p) => setLikersFor(p.id),
                      onReport: (p) => setReportFor(p),
                    }}
                  />
                ))}
              </div>
              {isFetchingNextPage && (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  <Loader2 size={16} className="animate-spin mr-2" /> Loading
                  more…
                </div>
              )}
              {!hasNextPage && posts.length > 5 && (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  You&apos;re all caught up.
                </div>
              )}
            </>
          )}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-24">
          <CommunitySidebar onCompose={() => setComposerOpen(true)} />
        </div>
      </div>

      {/* Floating compose button — mobile/tablet only; desktop has the sidebar button */}
      <button
        onClick={() => setComposerOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl"
        style={{
          background: "var(--color-accent)",
          boxShadow:
            "0 10px 30px color-mix(in srgb, var(--color-accent) 40%, transparent)",
        }}
        aria-label="Compose post"
      >
        <Pencil size={20} />
      </button>

      {/* Modals */}
      <ComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmitted={() => refetch()}
      />
      <CommentSheet
        post={commentsFor}
        open={!!commentsFor}
        onClose={() => setCommentsFor(null)}
        onOpenAuthor={(id) => {
          setCommentsFor(null);
          setAuthorId(id);
        }}
      />
      <AuthorProfileSheet
        memberId={authorId}
        open={!!authorId}
        onClose={() => setAuthorId(null)}
      />
      <LikersSheet
        postId={likersFor}
        open={!!likersFor}
        onClose={() => setLikersFor(null)}
        onOpenAuthor={(id) => {
          setLikersFor(null);
          setAuthorId(id);
        }}
      />
      <ReportSheet
        post={reportFor}
        open={!!reportFor}
        onClose={() => setReportFor(null)}
      />
    </div>
  );
}

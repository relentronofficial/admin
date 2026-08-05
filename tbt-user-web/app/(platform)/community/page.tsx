"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Loader2, Pencil, RefreshCw } from "lucide-react";

import { useFeed } from "@/lib/hooks/useCommunity";
import type { CommunityFilter, CommunityPost } from "@/types";

import { PostCard } from "@/components/features/community/PostCard";
import { InlineComposerRow, ComposerModal } from "@/components/features/community/Composer";
import { CommentSheet } from "@/components/features/community/CommentSheet";
import { AuthorProfileSheet } from "@/components/features/community/AuthorProfileSheet";
import { LikersSheet } from "@/components/features/community/LikersSheet";
import { ReportSheet } from "@/components/features/community/ReportSheet";

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
    <div className="max-w-2xl mx-auto pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Community</h1>
        <div className="flex items-center gap-1">
          <Link
            href="/community/saved"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
            aria-label="Saved posts"
          >
            <Bookmark size={18} />
          </Link>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw size={18} className={isRefetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div
        className="flex gap-1 p-1 rounded-2xl overflow-x-auto"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        {TABS.map((t) => {
          const active = filter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className="flex-1 min-w-[76px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors"
              style={{
                color: active ? "#fff" : "var(--color-text-secondary)",
                background: active ? "var(--color-accent)" : "transparent",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Inline composer */}
      <InlineComposerRow onOpen={() => setComposerOpen(true)} />

      {/* Feed */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> Loading feed…
        </div>
      ) : isError ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Could not load community. Pull to refresh.
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
              <Loader2 size={16} className="animate-spin mr-2" /> Loading more…
            </div>
          )}
          {!hasNextPage && posts.length > 5 && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              You&apos;re all caught up.
            </div>
          )}
        </>
      )}

      {/* Floating compose button (mobile-friendly) */}
      <button
        onClick={() => setComposerOpen(true)}
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl"
        style={{
          background: "var(--color-accent)",
          boxShadow: "0 10px 30px color-mix(in srgb, var(--color-accent) 40%, transparent)",
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

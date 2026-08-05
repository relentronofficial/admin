"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";

import { useBookmarks } from "@/lib/hooks/useCommunity";
import type { CommunityPost } from "@/types";

import { PostCard } from "@/components/features/community/PostCard";
import { CommentSheet } from "@/components/features/community/CommentSheet";
import { AuthorProfileSheet } from "@/components/features/community/AuthorProfileSheet";
import { LikersSheet } from "@/components/features/community/LikersSheet";
import { ReportSheet } from "@/components/features/community/ReportSheet";

export default function SavedPostsPage() {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useBookmarks();

  const [commentsFor, setCommentsFor] = useState<CommunityPost | null>(null);
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [likersFor, setLikersFor] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<CommunityPost | null>(null);

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
    <div className="max-w-2xl mx-auto pb-16 space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/community"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Saved posts</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> Loading…
        </div>
      ) : isError ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Could not load saved posts.
        </div>
      ) : posts.length === 0 ? (
        <div
          className="p-8 rounded-2xl text-center space-y-2"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <Bookmark size={26} className="mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No saved posts yet — tap the bookmark icon on any post.
          </p>
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
        </>
      )}

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

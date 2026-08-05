"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  Bookmark,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pin,
  Share2,
  Trash2,
} from "lucide-react";

import { useMe } from "@/lib/hooks/useUser";
import { useDeleteOwnPost, useToggleBookmark, useToggleLike, memberDisplayName } from "@/lib/hooks/useCommunity";
import type { CommunityPost } from "@/types";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

import { MemberAvatar } from "./MemberAvatar";
import { RichText } from "./RichText";
import { MediaViewer } from "./MediaViewer";

export interface PostCardHandlers {
  onOpenComments: (post: CommunityPost) => void;
  onOpenAuthor: (memberId: string) => void;
  onOpenLikers: (post: CommunityPost) => void;
  onReport: (post: CommunityPost) => void;
}

export function PostCard({
  post,
  handlers,
}: {
  post: CommunityPost;
  handlers: PostCardHandlers;
}) {
  const { data: me } = useMe();
  const toggleLike = useToggleLike();
  const toggleBookmark = useToggleBookmark();
  const deletePost = useDeleteOwnPost();

  const [menuOpen, setMenuOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  const isMine = me?.id === post.memberId;
  const authorName = memberDisplayName(post.member);
  const isPending = post.isApproved === false;

  const media = post.mediaUrls.filter(Boolean);

  const gridClass = useMemo(() => {
    if (media.length === 1) return "grid-cols-1";
    if (media.length === 2) return "grid-cols-2";
    if (media.length === 3) return "grid-cols-3";
    return "grid-cols-2";
  }, [media.length]);

  async function handleShare() {
    const url = `${window.location.origin}/community?post=${post.id}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as unknown as { share: (d: { url: string; text: string }) => Promise<void> }).share({
          url,
          text: post.content.slice(0, 140),
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }

  return (
    <article
      className="rounded-2xl p-4 sm:p-5 space-y-3"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <MemberAvatar
          member={post.member}
          size={44}
          onClick={() => handlers.onOpenAuthor(post.memberId)}
          ringColor={post.isMentor ? "var(--color-accent)" : undefined}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handlers.onOpenAuthor(post.memberId)}
              className="text-sm font-bold text-foreground hover:underline text-left"
            >
              {authorName}
            </button>
            {post.isMentor && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                style={{
                  color: "var(--color-accent)",
                  background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
                }}
              >
                <Award size={10} /> Mentor
              </span>
            )}
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Pin size={11} /> Pinned
              </span>
            )}
            {isPending && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                style={{
                  color: "#facc15",
                  background: "rgba(250,204,21,0.08)",
                  border: "1px solid rgba(250,204,21,0.3)",
                }}
              >
                Pending approval
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {timeAgo(post.createdAt)}
          </div>
        </div>

        {/* Kebab menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
            aria-label="More options"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="absolute right-0 top-full mt-1 w-44 rounded-xl z-50 py-1 overflow-hidden"
                style={{
                  background: "var(--color-modal-bg)",
                  border: "1px solid var(--color-border-medium)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}
              >
                {isMine ? (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      if (confirm("Delete this post? This cannot be undone.")) {
                        deletePost.mutate(post.id);
                      }
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-[var(--color-surface-overlay)]"
                  >
                    <Trash2 size={14} /> Delete post
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handlers.onReport(post);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
                  >
                    <Flag size={14} /> Report post
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      {post.content && (
        <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
          <RichText text={post.content} />
        </div>
      )}

      {/* Media grid */}
      {media.length > 0 && (
        <div className={cn("grid gap-1 rounded-xl overflow-hidden", gridClass)}>
          {media.slice(0, 4).map((url, i) => {
            const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
            const overflow = i === 3 && media.length > 4;
            return (
              <button
                key={`${url}-${i}`}
                onClick={() => setViewerIdx(i)}
                className="relative aspect-square bg-black overflow-hidden focus:outline-none"
              >
                {isVideo ? (
                  <video
                    src={url}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                {overflow && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xl font-bold">
                    +{media.length - 4}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Engagement summary (first liker line) */}
      {post.firstLiker && post.likesCount > 0 && (
        <button
          onClick={() => handlers.onOpenLikers(post)}
          className="text-xs text-muted-foreground hover:text-foreground text-left"
        >
          Liked by{" "}
          <span className="font-semibold text-foreground">
            {memberDisplayName(post.firstLiker)}
          </span>
          {post.likesCount > 1 && (
            <>
              {" "}and <span className="font-semibold text-foreground">{post.likesCount - 1} {post.likesCount - 1 === 1 ? "other" : "others"}</span>
            </>
          )}
        </button>
      )}

      {/* Action bar */}
      <div
        className="flex items-center gap-1 pt-2"
        style={{ borderTop: "1px solid var(--color-border-subtle)" }}
      >
        <ActionBtn
          onClick={() => toggleLike.mutate(post.id)}
          active={post.isLikedByMe}
          activeColor="#ef4444"
          Icon={Heart}
          label={post.likesCount > 0 ? String(post.likesCount) : "Like"}
          filled={post.isLikedByMe}
        />
        <ActionBtn
          onClick={() => handlers.onOpenComments(post)}
          active={false}
          Icon={MessageCircle}
          label={post.commentsCount > 0 ? String(post.commentsCount) : "Comment"}
        />
        <ActionBtn
          onClick={() => toggleBookmark.mutate(post.id)}
          active={post.isBookmarkedByMe}
          activeColor="var(--color-accent)"
          Icon={Bookmark}
          label={post.isBookmarkedByMe ? "Saved" : "Save"}
          filled={post.isBookmarkedByMe}
        />
        <ActionBtn
          onClick={handleShare}
          active={false}
          Icon={Share2}
          label="Share"
        />
      </div>

      {/* Top comment preview */}
      {post.topComment && (
        <button
          onClick={() => handlers.onOpenComments(post)}
          className="w-full text-left text-xs text-muted-foreground hover:text-foreground pt-1"
        >
          <span className="font-semibold text-foreground">
            {memberDisplayName(post.topComment.member)}:
          </span>{" "}
          {post.topComment.content.length > 90
            ? `${post.topComment.content.slice(0, 90)}…`
            : post.topComment.content}
          {post.commentsCount > 1 && (
            <span className="ml-1 opacity-70">
              · View all {post.commentsCount} comments
            </span>
          )}
        </button>
      )}

      {/* Fullscreen viewer */}
      {viewerIdx !== null && (
        <MediaViewer
          urls={media}
          initialIndex={viewerIdx}
          onClose={() => setViewerIdx(null)}
        />
      )}
    </article>
  );
}

// ── Action button ───────────────────────────────────────────────────────────

function ActionBtn({
  onClick,
  active,
  activeColor,
  Icon,
  label,
  filled,
}: {
  onClick: () => void;
  active: boolean;
  activeColor?: string;
  Icon: React.ComponentType<{ size?: number; className?: string; fill?: string }>;
  label: string;
  filled?: boolean;
}) {
  const color = active && activeColor ? activeColor : "var(--color-text-secondary)";
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium hover:bg-[var(--color-surface-overlay)]"
      style={{ color }}
    >
      <Icon size={16} fill={filled ? (activeColor ?? "currentColor") : "none"} />
      <span>{label}</span>
    </button>
  );
}

// ── Static link for standalone / SSR contexts ───────────────────────────────

export function PostLink({ postId, children }: { postId: string; children: React.ReactNode }) {
  return <Link href={`/community?post=${postId}`}>{children}</Link>;
}

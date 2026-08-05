"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Loader2, Send, Trash2, X } from "lucide-react";

import { useMe } from "@/lib/hooks/useUser";
import {
  useAddComment,
  useComments,
  useDeleteComment,
  useToggleCommentLike,
  memberDisplayName,
} from "@/lib/hooks/useCommunity";
import type { CommunityComment, CommunityPost } from "@/types";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

import { MemberAvatar } from "./MemberAvatar";
import { RichText } from "./RichText";

interface CommentSheetProps {
  post: CommunityPost | null;
  open: boolean;
  onClose: () => void;
  onOpenAuthor: (memberId: string) => void;
}

export function CommentSheet({
  post,
  open,
  onClose,
  onOpenAuthor,
}: CommentSheetProps) {
  const postId = post?.id ?? "";
  const { data: comments = [], isLoading } = useComments(postId, open && !!postId);
  const addComment = useAddComment(postId);
  const deleteComment = useDeleteComment(postId);
  const toggleCommentLike = useToggleCommentLike(postId);
  const { data: me } = useMe();

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setDraft("");
      setReplyTo(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Group into top-level + replies
  const grouped = useMemo(() => {
    const top: Array<{ comment: CommunityComment; replies: CommunityComment[] }> = [];
    const byParent = new Map<string, CommunityComment[]>();
    for (const c of comments) {
      if (c.parentCommentId) {
        const arr = byParent.get(c.parentCommentId) ?? [];
        arr.push(c);
        byParent.set(c.parentCommentId, arr);
      }
    }
    for (const c of comments) {
      if (!c.parentCommentId) {
        top.push({ comment: c, replies: byParent.get(c.id) ?? [] });
      }
    }
    return top;
  }, [comments]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending || !postId) return;
    setSending(true);
    try {
      await addComment.mutateAsync({
        content: body,
        parentCommentId: replyTo?.id,
      });
      setDraft("");
      setReplyTo(null);
    } catch {
      /* noop — user can retry */
    } finally {
      setSending(false);
    }
  }

  if (!open || !post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full sm:max-w-lg h-[85vh] sm:h-[80vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-medium)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <h3 className="text-base font-bold text-foreground">
            Comments ({post.commentsCount})
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--color-surface-overlay)]"
            aria-label="Close"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Loading comments…
            </div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No comments yet — be the first to reply.
            </div>
          ) : (
            grouped.map(({ comment, replies }) => (
              <div key={comment.id} className="space-y-3">
                <CommentRow
                  comment={comment}
                  isMine={me?.id === comment.memberId}
                  onLike={() => toggleCommentLike.mutate(comment.id)}
                  onDelete={() => {
                    if (confirm("Delete this comment?")) {
                      deleteComment.mutate(comment.id);
                    }
                  }}
                  onReply={() => {
                    setReplyTo(comment);
                    inputRef.current?.focus();
                  }}
                  onOpenAuthor={() => onOpenAuthor(comment.memberId)}
                />
                {replies.length > 0 && (
                  <div className="pl-11 space-y-3">
                    {replies.map((r) => (
                      <CommentRow
                        key={r.id}
                        comment={r}
                        isMine={me?.id === r.memberId}
                        onLike={() => toggleCommentLike.mutate(r.id)}
                        onDelete={() => {
                          if (confirm("Delete this reply?")) {
                            deleteComment.mutate(r.id);
                          }
                        }}
                        onReply={undefined}
                        onOpenAuthor={() => onOpenAuthor(r.memberId)}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Composer */}
        <div
          className="p-3 flex-shrink-0"
          style={{
            borderTop: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-surface)",
          }}
        >
          {replyTo && (
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Replying to{" "}
                <span className="font-semibold text-foreground">
                  {memberDisplayName(replyTo.member)}
                </span>
              </span>
              <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim().length > 0) handleSend();
                }
              }}
              placeholder={replyTo ? "Write a reply…" : "Write a comment…"}
              className="flex-1 px-4 py-2.5 rounded-full text-sm text-foreground outline-none"
              style={{
                background: "var(--color-bg-primary)",
                border: "1px solid var(--color-border-subtle)",
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || draft.trim().length === 0}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-60"
              style={{ background: "var(--color-accent)" }}
              aria-label="Send"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── One comment row ─────────────────────────────────────────────────────────

function CommentRow({
  comment,
  isMine,
  onLike,
  onDelete,
  onReply,
  onOpenAuthor,
  compact = false,
}: {
  comment: CommunityComment;
  isMine: boolean;
  onLike: () => void;
  onDelete: () => void;
  onReply?: () => void;
  onOpenAuthor: () => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <MemberAvatar
        member={comment.member}
        size={compact ? 28 : 36}
        onClick={onOpenAuthor}
      />
      <div className="flex-1 min-w-0">
        <div
          className="rounded-2xl px-3 py-2 inline-block max-w-full"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <button
            onClick={onOpenAuthor}
            className="text-xs font-bold text-foreground hover:underline"
          >
            {memberDisplayName(comment.member)}
          </button>
          <div className="mt-0.5 text-sm text-foreground whitespace-pre-wrap break-words">
            <RichText text={comment.content} />
          </div>
        </div>
        <div className="mt-1 pl-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{timeAgo(comment.createdAt)}</span>
          <button
            onClick={onLike}
            className={cn(
              "flex items-center gap-1 font-semibold hover:text-foreground",
              comment.isLikedByMe && "text-[#ef4444]",
            )}
          >
            <Heart
              size={11}
              fill={comment.isLikedByMe ? "#ef4444" : "none"}
            />
            {comment.likesCount > 0 ? comment.likesCount : "Like"}
          </button>
          {onReply && (
            <button
              onClick={onReply}
              className="font-semibold hover:text-foreground"
            >
              Reply
            </button>
          )}
          {isMine && (
            <button
              onClick={onDelete}
              className="ml-auto text-red-400 hover:text-red-300"
              aria-label="Delete"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

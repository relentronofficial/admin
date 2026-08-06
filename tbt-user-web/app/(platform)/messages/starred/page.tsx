"use client";

import Link from "next/link";
import { ArrowLeft, FileText, Loader2, Star, Users } from "lucide-react";
import { useStarredMessages } from "@/lib/hooks/useChatGroups";
import type { StarredMessage } from "@/lib/api/services/chatGroups.service";

export default function StarredMessagesPage() {
  const { data: starred = [], isLoading } = useStarredMessages();

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 sm:px-0">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/messages"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <div className="flex items-center gap-2">
          <Star size={18} className="fill-current" style={{ color: "#f59e0b" }} />
          <h1 className="text-xl font-bold text-foreground">Starred messages</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin mr-2" /> Loading starred messages…
        </div>
      ) : starred.length === 0 ? (
        <div
          className="text-center py-16 px-6 rounded-2xl"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <Star size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground">No starred messages yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Star a message in any group chat to save it for later.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {starred.map((m) => (
            <StarredRow key={m.id} message={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function StarredRow({ message }: { message: StarredMessage }) {
  const senderName =
    [message.sender?.firstName, message.sender?.lastName].filter(Boolean).join(" ") || "Member";
  const when = new Date(message.starredAt || message.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const preview = message.body || (message.mediaType ? `📎 ${message.mediaType}` : "…");

  // Deep link: opens the group page. The group chat page itself handles
  // an optional URL fragment #msg-<id> to auto-scroll and highlight —
  // that behaviour lives in the jumpToMessage helper. For now we just
  // route to the group; scrolling to the exact message is future work.
  return (
    <Link
      href={`/messages/group/${message.groupId}#msg-${message.id}`}
      className="block rounded-xl p-3 transition-colors hover:bg-[var(--color-surface-overlay)]"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ background: "var(--color-surface-overlay)" }}
        >
          {message.groupAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={message.groupAvatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Users size={11} className="text-muted-foreground" />
          )}
        </div>
        <span className="text-[11px] font-semibold text-foreground truncate">
          {message.groupName ?? "Group"}
        </span>
        <span className="text-[10px] text-muted-foreground">· {when}</span>
        <Star size={11} className="fill-current ml-auto" style={{ color: "#f59e0b" }} />
      </div>
      <div className="flex items-start gap-2 pl-8">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold" style={{ color: "var(--color-accent)" }}>
            {senderName}
          </div>
          {message.mediaUrl && message.mediaType === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.mediaUrl}
              alt=""
              className="mt-1 max-w-[240px] max-h-[180px] rounded-lg object-cover"
            />
          ) : message.mediaUrl && message.mediaType === "document" ? (
            <div
              className="mt-1 inline-flex items-center gap-2 px-2 py-1.5 rounded-lg"
              style={{
                background: "var(--color-bg-primary)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              <FileText size={12} className="text-muted-foreground" />
              <span className="text-xs text-foreground">Attachment</span>
            </div>
          ) : null}
          <p className="text-sm text-foreground mt-0.5 line-clamp-3 break-words">{preview}</p>
        </div>
      </div>
    </Link>
  );
}

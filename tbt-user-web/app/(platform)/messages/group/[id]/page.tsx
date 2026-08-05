"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  FileText,
  Loader2,
  MoreVertical,
  Paperclip,
  Reply,
  Send,
  Smile,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { getSocket } from "@/lib/socket/client";
import { useMe } from "@/lib/hooks/useUser";
import {
  chatGroupKeys,
  useChatGroup,
  useChatGroupMessages,
  useDeleteChatGroupMessage,
  useEditChatGroupMessage,
  useLeaveChatGroup,
  useMarkChatGroupRead,
  useSendChatGroupMessage,
  useToggleChatGroupReaction,
} from "@/lib/hooks/useChatGroups";
import type { ChatGroupMessage } from "@/lib/api/services/chatGroups.service";
import { cn } from "@/lib/utils/cn";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function GroupChatPage() {
  const params = useParams<{ id: string }>();
  const groupId = params?.id ?? "";
  const { data: me } = useMe();
  const qc = useQueryClient();

  const { data: group, isLoading: groupLoading } = useChatGroup(groupId);
  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useChatGroupMessages(groupId);

  const send = useSendChatGroupMessage(groupId);
  const editMsg = useEditChatGroupMessage(groupId);
  const deleteMsg = useDeleteChatGroupMessage(groupId);
  const toggleReaction = useToggleChatGroupReaction(groupId);
  const markRead = useMarkChatGroupRead(groupId);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ messageId: string; body: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatGroupMessage | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{
    file: File;
    previewUrl: string;
    uploading: boolean;
    uploadedUrl: string | null;
    mediaType: "image" | "video" | "document" | "audio";
  } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [typingMembers, setTypingMembers] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messages: ChatGroupMessage[] = useMemo(
    () => (messagesData?.pages ?? []).flat(),
    [messagesData],
  );

  // ── Socket subscription ─────────────────────────────────────────────
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    getSocket().then((socket) => {
      if (cancelled) return;
      socket.emit("join:chat_group", { groupId });

      const onNew = (msg: ChatGroupMessage) => {
        if (msg.groupId !== groupId) return;
        qc.setQueryData(chatGroupKeys.messages(groupId), (prev: any) => {
          if (!prev) return prev;
          const pages = [...(prev.pages ?? [])];
          if (pages.length === 0) pages.push([]);
          const lastIdx = pages.length - 1;
          const already = pages[lastIdx].some((m: ChatGroupMessage) => m.id === msg.id);
          if (!already) pages[lastIdx] = [...pages[lastIdx], msg];
          return { ...prev, pages };
        });
        // Auto-mark this message read since we're inside the chat.
        markRead.mutate(msg.id);
      };

      const onEdited = (msg: ChatGroupMessage) => {
        if (msg.groupId !== groupId) return;
        qc.setQueryData(chatGroupKeys.messages(groupId), (prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            pages: prev.pages.map((page: ChatGroupMessage[]) =>
              page.map((m) => (m.id === msg.id ? msg : m)),
            ),
          };
        });
      };

      const onDeleted = ({ messageId, forEveryone }: { messageId: string; forEveryone: boolean }) => {
        qc.setQueryData(chatGroupKeys.messages(groupId), (prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            pages: prev.pages.map((page: ChatGroupMessage[]) =>
              page.map((m) =>
                m.id === messageId
                  ? { ...m, deletedAt: new Date().toISOString(), deletedForEveryone: forEveryone, body: forEveryone ? null : m.body }
                  : m,
              ),
            ),
          };
        });
      };

      const onReaction = ({
        messageId,
        memberId,
        emoji,
        added,
      }: { messageId: string; memberId: string; emoji: string; added: boolean }) => {
        qc.setQueryData(chatGroupKeys.messages(groupId), (prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            pages: prev.pages.map((page: ChatGroupMessage[]) =>
              page.map((m) => {
                if (m.id !== messageId) return m;
                const next = added
                  ? [...m.reactions, { emoji, memberId }]
                  : m.reactions.filter((r) => !(r.emoji === emoji && r.memberId === memberId));
                return { ...m, reactions: next };
              }),
            ),
          };
        });
      };

      const onTyping = ({ memberId, isTyping }: { memberId: string | null; isTyping: boolean }) => {
        if (!memberId || memberId === (me?.id ?? "")) return;
        setTypingMembers((prev) => {
          const next = new Set(prev);
          if (isTyping) next.add(memberId);
          else next.delete(memberId);
          return next;
        });
      };

      // WhatsApp-style read receipt fan-in: the backend emits every
      // freshly-marked messageId when a member opens the chat, so the
      // sender's tick state can flip from grey → blue in real time.
      const onRead = ({
        memberId,
        messageIds,
      }: { groupId: string; memberId: string; messageIds: string[]; upToMessageId?: string }) => {
        if (!memberId || !messageIds?.length) return;
        const idSet = new Set(messageIds);
        qc.setQueryData(chatGroupKeys.messages(groupId), (prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            pages: prev.pages.map((page: ChatGroupMessage[]) =>
              page.map((m) => {
                if (!idSet.has(m.id)) return m;
                if (m.readByMemberIds.includes(memberId)) return m;
                return {
                  ...m,
                  readByMemberIds: [...m.readByMemberIds, memberId],
                  readByCount: m.readByCount + 1,
                };
              }),
            ),
          };
        });
      };

      socket.on("group:message:new", onNew);
      socket.on("group:message:edited", onEdited);
      socket.on("group:message:deleted", onDeleted);
      socket.on("group:reaction", onReaction);
      socket.on("group:typing", onTyping);
      socket.on("group:read", onRead);

      cleanup = () => {
        socket.emit("leave:chat_group", { groupId });
        socket.off("group:message:new", onNew);
        socket.off("group:message:edited", onEdited);
        socket.off("group:message:deleted", onDeleted);
        socket.off("group:reaction", onReaction);
        socket.off("group:typing", onTyping);
        socket.off("group:read", onRead);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [groupId, me?.id, markRead, qc]);

  // Typing indicator — emit debounced. 2s window with reset on new keystrokes.
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onDraftChange(v: string) {
    setDraft(v);
    if (!groupId) return;
    getSocket().then((socket) => {
      socket.emit("chat_group:typing", { groupId, isTyping: true });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("chat_group:typing", { groupId, isTyping: false });
      }, 2000);
    });
  }

  // Mark the latest message read on mount / when new tail arrives.
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    markRead.mutate(last.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Auto-scroll to bottom on new tail messages.
  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (el) el.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length]);

  // Infinite scroll — load older when user scrolls near the top.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop < 60 && hasNextPage && !isFetchingNextPage) {
        const prevHeight = el.scrollHeight;
        fetchNextPage().then(() => {
          // Preserve scroll offset when older messages are prepended.
          requestAnimationFrame(() => {
            const nowHeight = el.scrollHeight;
            el.scrollTop = nowHeight - prevHeight;
          });
        });
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  async function handleSend() {
    const body = draft.trim();
    const hasReadyMedia = pendingMedia?.uploadedUrl && !pendingMedia.uploading;
    if (!body && !hasReadyMedia) return;
    if (sending || pendingMedia?.uploading) return;

    setSending(true);
    try {
      if (editing) {
        // Edit path only touches body — media is never edited in-place.
        await editMsg.mutateAsync({ messageId: editing.messageId, body });
        setEditing(null);
      } else {
        await send.mutateAsync({
          body: body || undefined,
          mediaUrl: pendingMedia?.uploadedUrl ?? undefined,
          mediaType: hasReadyMedia ? pendingMedia?.mediaType : undefined,
          replyToId: replyingTo?.id,
        });
      }
      setDraft("");
      setReplyingTo(null);
      if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
      setPendingMedia(null);
    } finally {
      setSending(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      // 20 MB cap — matches Community composer.
      alert("File too large (max 20 MB).");
      return;
    }
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");
    const mediaType: "image" | "video" | "document" | "audio" = isImage
      ? "image"
      : isVideo
        ? "video"
        : isAudio
          ? "audio"
          : "document";
    setPendingMedia({ file, previewUrl, uploading: true, uploadedUrl: null, mediaType });
    const { uploadChatMedia } = await import("@/lib/api/services/chatGroups.service");
    const uploaded = await uploadChatMedia(file);
    setPendingMedia((prev) => {
      if (!prev || prev.file !== file) return prev;
      return {
        ...prev,
        uploading: false,
        uploadedUrl: uploaded?.publicUrl ?? null,
        mediaType: uploaded?.mediaType ?? prev.mediaType,
      };
    });
  }

  if (groupLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading group…
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-3">
        <p className="text-sm text-muted-foreground">You aren&apos;t in this group anymore.</p>
        <Link
          href="/messages"
          className="inline-block px-4 py-2 rounded-xl text-xs font-bold text-foreground"
          style={{ border: "1px solid var(--color-border-subtle)" }}
        >
          Back to messages
        </Link>
      </div>
    );
  }

  const meId = me?.id;

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 rounded-t-2xl flex-shrink-0"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <Link
          href="/messages"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <div
          className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ background: "var(--color-surface-overlay)" }}
        >
          {group.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Users size={16} className="text-muted-foreground" />
          )}
        </div>
        <button
          onClick={() => setInfoOpen(true)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="text-sm font-bold text-foreground truncate">{group.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {typingMembers.size > 0 ? "typing…" : `${group.members.length} members`}
          </div>
        </button>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 py-3 space-y-1"
        style={{
          background: "var(--color-bg-primary)",
          borderLeft: "1px solid var(--color-border-subtle)",
          borderRight: "1px solid var(--color-border-subtle)",
        }}
      >
        {isFetchingNextPage && (
          <div className="text-center py-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="inline animate-spin mr-1" /> loading older…
          </div>
        )}
        {messagesLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            <Loader2 size={16} className="animate-spin mr-2" /> Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-14 text-sm text-muted-foreground">
            No messages yet — say hi.
          </div>
        ) : (
          (() => {
            const otherMemberIds = group.members
              .map((mem) => mem.id)
              .filter((mid) => mid !== meId);
            return messages.map((m, i) => {
              const prev = messages[i - 1];
              const showSender =
                !m.deletedForEveryone &&
                (!prev || prev.senderMemberId !== m.senderMemberId || m.isSystem);
              const isMine = !!meId && m.senderMemberId === meId;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isMine={isMine}
                  showSender={showSender}
                  otherMemberIds={otherMemberIds}
                  onEdit={() => {
                    if (m.body) {
                      setEditing({ messageId: m.id, body: m.body });
                      setDraft(m.body);
                    }
                  }}
                  onDelete={(forEveryone) =>
                    deleteMsg.mutate({ messageId: m.id, forEveryone })
                  }
                  onReact={(emoji) => toggleReaction.mutate({ messageId: m.id, emoji })}
                  onReply={() => {
                    setReplyingTo(m);
                    setEditing(null);
                  }}
                />
              );
            });
          })()
        )}
        <div ref={anchorRef} />
      </div>

      {/* Composer */}
      <div
        className="flex-shrink-0 rounded-b-2xl"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
          borderTop: "none",
        }}
      >
        {editing && (
          <div
            className="mx-3 mt-2 px-3 py-1.5 rounded-lg text-[11px] flex items-center justify-between"
            style={{
              background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)",
              color: "var(--color-accent)",
            }}
          >
            <span>Editing message · 15-min window</span>
            <button
              onClick={() => {
                setEditing(null);
                setDraft("");
              }}
              className="hover:opacity-80"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {replyingTo && (
          <div
            className="mx-3 mt-2 px-3 py-2 rounded-lg text-[11px] flex items-center justify-between gap-2"
            style={{
              background: "var(--color-bg-primary)",
              borderLeft: "3px solid var(--color-accent)",
            }}
          >
            <div className="flex-1 min-w-0">
              <div
                className="font-bold"
                style={{ color: "var(--color-accent)" }}
              >
                Replying to{" "}
                {[replyingTo.sender?.firstName, replyingTo.sender?.lastName].filter(Boolean).join(" ") || "Member"}
              </div>
              <div className="text-muted-foreground truncate">
                {replyingTo.body
                  ? replyingTo.body.slice(0, 100)
                  : replyingTo.mediaType
                    ? `📎 ${replyingTo.mediaType}`
                    : "…"}
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {pendingMedia && (
          <div
            className="mx-3 mt-2 px-3 py-2 rounded-lg flex items-center gap-3"
            style={{
              background: "var(--color-bg-primary)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            <div
              className="w-12 h-12 rounded overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{ background: "var(--color-surface-overlay)" }}
            >
              {pendingMedia.mediaType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pendingMedia.previewUrl} alt="" className="w-full h-full object-cover" />
              ) : pendingMedia.mediaType === "video" ? (
                <video src={pendingMedia.previewUrl} className="w-full h-full object-cover" muted />
              ) : (
                <FileText size={18} className="text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">
                {pendingMedia.file.name}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {pendingMedia.uploading
                  ? "Uploading…"
                  : pendingMedia.uploadedUrl
                    ? "Ready to send"
                    : "Upload failed"}
              </div>
            </div>
            {pendingMedia.uploading ? (
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            ) : (
              <button
                onClick={() => {
                  if (pendingMedia.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
                  setPendingMedia(null);
                }}
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <div className="flex items-end gap-2 p-3">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            onChange={onPickFile}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || !!pendingMedia}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] disabled:opacity-40 flex-shrink-0"
            aria-label="Attach file"
            title="Attach file"
          >
            <Paperclip size={16} />
          </button>
          <textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const canSend =
                  draft.trim().length > 0 || (pendingMedia?.uploadedUrl && !pendingMedia.uploading);
                if (canSend) handleSend();
              }
            }}
            placeholder={pendingMedia ? "Add a caption…" : "Type a message…"}
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-full text-sm text-foreground outline-none resize-none max-h-32"
            style={{
              background: "var(--color-bg-primary)",
              border: "1px solid var(--color-border-subtle)",
            }}
          />
          <button
            onClick={handleSend}
            disabled={
              sending ||
              pendingMedia?.uploading ||
              (draft.trim().length === 0 && !pendingMedia?.uploadedUrl)
            }
            className="w-11 h-11 rounded-full flex items-center justify-center text-white disabled:opacity-60 flex-shrink-0"
            style={{ background: "var(--color-accent)" }}
            aria-label="Send"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>

      {infoOpen && (
        <GroupInfoSheet
          group={group}
          onClose={() => setInfoOpen(false)}
          onLeave={async () => {
            if (!confirm("Leave this group?")) return;
            await useLeaveChatGroupOnce(groupId);
            window.location.href = "/messages";
          }}
        />
      )}
    </div>
  );
}

// One-shot leave helper — avoids needing a mutation instance on the top level
async function useLeaveChatGroupOnce(id: string) {
  const { chatGroupsService } = await import("@/lib/api/services/chatGroups.service");
  await chatGroupsService.leave(id);
}

// ── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isMine,
  showSender,
  otherMemberIds,
  onEdit,
  onDelete,
  onReact,
  onReply,
}: {
  message: ChatGroupMessage;
  isMine: boolean;
  showSender: boolean;
  otherMemberIds: string[];
  onEdit: () => void;
  onDelete: (forEveryone: boolean) => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactPickerOpen, setReactPickerOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const senderName =
    [message.sender?.firstName, message.sender?.lastName].filter(Boolean).join(" ") || "Member";
  const time = new Date(message.createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const reactionGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of message.reactions) {
      const arr = map.get(r.emoji) ?? [];
      arr.push(r.memberId);
      map.set(r.emoji, arr);
    }
    return Array.from(map.entries());
  }, [message.reactions]);

  const deleted = message.deletedForEveryone || !!message.deletedAt;

  // WhatsApp-style tick state (only on own messages):
  //   sent      — always true once persisted (single grey ✓)
  //   readByAll — every other group member has a chat_group_message_reads row
  //               (double blue ✓✓); otherwise double grey after at least one read.
  const readCountOthers = useMemo(() => {
    if (!isMine) return 0;
    const readSet = new Set(message.readByMemberIds);
    return otherMemberIds.filter((id) => readSet.has(id)).length;
  }, [isMine, message.readByMemberIds, otherMemberIds]);
  const readByAll = isMine && otherMemberIds.length > 0 && readCountOthers >= otherMemberIds.length;
  const readByAny = isMine && readCountOthers > 0;

  return (
    <div className={cn("flex px-3", isMine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[80%] group relative", isMine && "items-end")}>
        {showSender && !isMine && !deleted && (
          <div
            className="text-[10px] font-bold ml-1 mb-0.5"
            style={{ color: "var(--color-accent)" }}
          >
            {senderName}
          </div>
        )}
        <div className="relative">
          <div
            className={cn("rounded-2xl overflow-hidden relative")}
            style={{
              background: isMine
                ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
                : "var(--color-bg-surface)",
              border: `1px solid ${isMine
                ? "color-mix(in srgb, var(--color-accent) 30%, transparent)"
                : "var(--color-border-subtle)"}`,
              borderBottomLeftRadius: isMine ? undefined : 4,
              borderBottomRightRadius: isMine ? 4 : undefined,
            }}
          >
            {/* Reply quote strip */}
            {!deleted && message.replyTo && (
              <div
                className="mx-1.5 mt-1.5 px-2.5 py-1.5 rounded-md text-[11px]"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                  borderLeft: "3px solid var(--color-accent)",
                }}
              >
                <div className="font-bold" style={{ color: "var(--color-accent)" }}>
                  {message.replyTo.senderName ?? "Member"}
                </div>
                <div className="text-muted-foreground truncate">
                  {message.replyTo.deletedForEveryone
                    ? "message deleted"
                    : message.replyTo.body ||
                      (message.replyTo.mediaType ? `📎 ${message.replyTo.mediaType}` : "…")}
                </div>
              </div>
            )}

            {/* Media */}
            {!deleted && message.mediaUrl && message.mediaType && (
              <MediaBlock
                url={message.mediaUrl}
                type={message.mediaType}
                onImageClick={() => setLightboxOpen(true)}
              />
            )}

            {/* Body + meta */}
            <div className="px-3.5 py-2">
              {deleted ? (
                <p className="text-xs text-muted-foreground italic">
                  {message.deletedForEveryone ? "This message was deleted" : "You deleted this message"}
                </p>
              ) : message.body ? (
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {message.body}
                </p>
              ) : null}
              <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                {message.editedAt && !deleted && <span>edited</span>}
                <span>{time}</span>
                {isMine && !deleted && (
                  <span className="ml-0.5" title={readByAll ? "Read by all" : readByAny ? "Read" : "Sent"}>
                    {readByAll ? (
                      <CheckCheck size={12} style={{ color: "#3b82f6" }} />
                    ) : readByAny ? (
                      <CheckCheck size={12} />
                    ) : (
                      <Check size={12} />
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
          {!deleted && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              style={{
                background: "var(--color-modal-bg)",
                border: "1px solid var(--color-border-medium)",
                color: "var(--color-text-secondary)",
              }}
              aria-label="Message options"
            >
              <ChevronDown size={12} />
            </button>
          )}
          {menuOpen && !deleted && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div
                className={cn(
                  "absolute z-50 mt-1 w-40 rounded-xl overflow-hidden py-1",
                  isMine ? "right-0" : "left-0",
                )}
                style={{
                  background: "var(--color-modal-bg)",
                  border: "1px solid var(--color-border-medium)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setReactPickerOpen(true);
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
                >
                  <Smile size={13} /> React
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onReply();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
                >
                  <Reply size={13} /> Reply
                </button>
                {isMine && !message.mediaUrl && message.body && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
                  >
                    <MoreVertical size={13} /> Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(false);
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
                >
                  <Trash2 size={13} /> Delete for me
                </button>
                {isMine && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(true);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-[var(--color-surface-overlay)]"
                  >
                    <Trash2 size={13} /> Delete for everyone
                  </button>
                )}
              </div>
            </>
          )}
          {reactPickerOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setReactPickerOpen(false)} />
              <div
                className={cn(
                  "absolute z-50 -top-10 flex gap-1 px-2 py-1 rounded-full",
                  isMine ? "right-0" : "left-0",
                )}
                style={{
                  background: "var(--color-modal-bg)",
                  border: "1px solid var(--color-border-medium)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                }}
              >
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReact(emoji);
                      setReactPickerOpen(false);
                    }}
                    className="text-lg hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {reactionGroups.length > 0 && (
          <div className={cn("flex gap-1 mt-1 flex-wrap", isMine ? "justify-end" : "justify-start")}>
            {reactionGroups.map(([emoji, mIds]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]"
                style={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                <span>{emoji}</span>
                <span className="text-muted-foreground">{mIds.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxOpen && message.mediaUrl && message.mediaType === "image" && (
        <div
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.mediaUrl}
            alt=""
            className="max-w-[95vw] max-h-[95vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ── Inline media block (image / video / audio / document) ───────────────────

function MediaBlock({
  url,
  type,
  onImageClick,
}: {
  url: string;
  type: string;
  onImageClick: () => void;
}) {
  const filename = useMemo(() => {
    try {
      return decodeURIComponent(url.split("/").pop() ?? "file");
    } catch {
      return "file";
    }
  }, [url]);

  if (type === "image") {
    return (
      <button
        onClick={onImageClick}
        className="block w-full max-w-[320px]"
        style={{ background: "#000" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          className="w-full h-auto max-h-[360px] object-cover"
          loading="lazy"
        />
      </button>
    );
  }
  if (type === "video") {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="w-full max-w-[320px] max-h-[360px]"
        style={{ background: "#000" }}
      />
    );
  }
  if (type === "audio") {
    return (
      <audio
        src={url}
        controls
        preload="metadata"
        className="w-full max-w-[320px]"
      />
    );
  }
  // document
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 m-1.5 p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
      style={{
        background: "var(--color-bg-primary)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--color-surface-overlay)" }}
      >
        <FileText size={18} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground truncate">{filename}</div>
        <div className="text-[10px] text-muted-foreground">Download</div>
      </div>
    </a>
  );
}

// ── Group info bottom sheet ─────────────────────────────────────────────────

function GroupInfoSheet({
  group,
  onClose,
  onLeave,
}: {
  group: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    description?: string | null;
    members: Array<{ id: string; firstName?: string | null; lastName?: string | null; profilePhotoUrl?: string | null; role?: string }>;
  };
  onClose: () => void;
  onLeave: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-medium)",
        }}
      >
        <div
          className="flex items-center justify-between p-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <h3 className="text-base font-bold text-foreground">Group info</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="text-center">
            <div
              className="mx-auto w-20 h-20 rounded-full overflow-hidden flex items-center justify-center mb-3"
              style={{ background: "var(--color-surface-overlay)" }}
            >
              {group.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users size={28} className="text-muted-foreground" />
              )}
            </div>
            <h4 className="text-lg font-bold text-foreground">{group.name}</h4>
            {group.description && (
              <p className="text-xs text-muted-foreground mt-1">{group.description}</p>
            )}
          </div>

          <div>
            <div
              className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2"
            >
              {group.members.length} member{group.members.length === 1 ? "" : "s"}
            </div>
            <div className="space-y-1.5">
              {group.members.map((m) => {
                const name = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || "Member";
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-2 rounded-xl"
                    style={{ background: "var(--color-bg-surface)" }}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[var(--color-surface-overlay)] flex items-center justify-center">
                      {m.profilePhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-white">
                          {name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={onLeave}
            className="w-full py-3 rounded-xl text-sm font-bold"
            style={{
              color: "#ef4444",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.35)",
            }}
          >
            Leave group
          </button>
        </div>
      </div>
    </div>
  );
}

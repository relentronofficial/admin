"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  FileText,
  Forward,
  Loader2,
  MoreVertical,
  Paperclip,
  Pause,
  Play,
  Reply,
  Search,
  Send,
  Smile,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { getSocket } from "@/lib/socket/client";
import { useMe } from "@/lib/hooks/useUser";
import {
  chatGroupKeys,
  getLocalMuteState,
  isLocallyMuted,
  setLocalMuteState,
  useChatGroup,
  useChatGroupMessages,
  useChatGroupPresence,
  useChatGroupSearch,
  useDeleteChatGroupMessage,
  useEditChatGroupMessage,
  useForwardChatGroupMessage,
  useMarkChatGroupRead,
  useMuteChatGroup,
  usePinnedMessages,
  useSendChatGroupMessage,
  useStarredMessages,
  useToggleChatGroupReaction,
  useToggleChatGroupStar,
} from "@/lib/hooks/useChatGroups";
import type { ChatGroupMessage } from "@/lib/api/services/chatGroups.service";
import { cn } from "@/lib/utils/cn";
import { VoiceRecorder } from "@/components/features/chat/VoiceRecorder";
import { ForwardPickerSheet } from "@/components/features/chat/ForwardPickerSheet";
import { PinStrip } from "@/components/features/chat/PinStrip";
import { ReactorsSheet } from "@/components/features/chat/ReactorsSheet";
import { senderColor } from "@/components/features/chat/senderColor";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Two messages from the same sender within 60s of each other are
// visually collapsed into a single cluster (hide the name + timestamp
// on the newer one).
const CLUSTER_WINDOW_MS = 60_000;

// Split a message body on @-mention tokens and highlight each. Purely
// visual — tokens don't need to correspond to any stored member; the
// server-side mentionedMemberIds list is what drives the actual ping.
function renderMentionText(text: string): React.ReactNode {
  const parts = text.split(/(@[A-Za-z0-9_]+)/g);
  return parts.map((chunk, i) => {
    if (chunk.startsWith("@") && chunk.length > 1) {
      return (
        <span
          key={i}
          className="font-semibold"
          style={{ color: "var(--color-accent)" }}
        >
          {chunk}
        </span>
      );
    }
    return <span key={i}>{chunk}</span>;
  });
}

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
  const forwardMsg = useForwardChatGroupMessage(groupId);
  const toggleStar = useToggleChatGroupStar(groupId);
  const muteGroup = useMuteChatGroup(groupId);
  const { data: pinned = [] } = usePinnedMessages(groupId);
  const { data: starred = [] } = useStarredMessages();

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [forwardingMsg, setForwardingMsg] = useState<ChatGroupMessage | null>(null);
  const [reactorsMsg, setReactorsMsg] = useState<{ msg: ChatGroupMessage; emoji: string | null } | null>(null);
  const [typingMembers, setTypingMembers] = useState<Set<string>>(new Set());
  // Mention autocomplete state — driven off cursor position in the composer.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState<number>(0);
  // memberId → firstName as it was inserted, so we can compute the
  // mentionedMemberIds payload from the final draft on send.
  const mentionsRef = useRef<Map<string, string>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: presenceList = [] } = useChatGroupPresence(groupId);
  const [presenceMap, setPresenceMap] = useState<Map<string, boolean>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local mute state, re-hydrated whenever the group id changes so the
  // info sheet can render the chip. Backend also has an authoritative
  // record via `POST /:id/mute`; we mirror to localStorage so the
  // sidebar tile chip renders without another fetch.
  const [localMute, setLocalMuteStateStr] = useState<string | "always" | null>(null);
  useEffect(() => {
    if (!groupId) return;
    setLocalMuteStateStr(getLocalMuteState()[groupId] ?? null);
  }, [groupId]);

  const messages: ChatGroupMessage[] = useMemo(
    () => (messagesData?.pages ?? []).flat(),
    [messagesData],
  );

  const starredIdSet = useMemo(() => new Set(starred.map((s) => s.id)), [starred]);

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

      // Pin-strip live update. The backend emits this whenever an admin
      // pins/unpins a message in this group.
      const onPinned = ({ groupId: gid }: { groupId: string; messageId: string; pinned: boolean }) => {
        if (gid !== groupId) return;
        qc.invalidateQueries({ queryKey: chatGroupKeys.pinned(groupId) });
      };

      socket.on("group:message:new", onNew);
      socket.on("group:message:edited", onEdited);
      socket.on("group:message:deleted", onDeleted);
      socket.on("group:reaction", onReaction);
      socket.on("group:typing", onTyping);
      socket.on("group:read", onRead);
      socket.on("group:pinned", onPinned);

      const onPresence = ({ memberId, online }: { memberId: string; online: boolean }) => {
        setPresenceMap((prev) => {
          const next = new Map(prev);
          next.set(memberId, online);
          return next;
        });
      };
      socket.on("presence:update", onPresence);

      cleanup = () => {
        socket.emit("leave:chat_group", { groupId });
        socket.off("group:message:new", onNew);
        socket.off("group:message:edited", onEdited);
        socket.off("group:message:deleted", onDeleted);
        socket.off("group:reaction", onReaction);
        socket.off("group:typing", onTyping);
        socket.off("group:read", onRead);
        socket.off("group:pinned", onPinned);
        socket.off("presence:update", onPresence);
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
    // Detect an in-progress @mention token at the caret. We look at the
    // slice up to the caret, match the trailing @word (letters + digits
    // + underscore), and offer autocomplete.
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? v.length;
    const upToCaret = v.slice(0, caret);
    const m = upToCaret.match(/(?:^|\s)@([A-Za-z0-9_]*)$/);
    if (m) {
      setMentionQuery(m[1]);
      setMentionAnchor(caret - m[1].length - 1); // position of the '@'
    } else if (mentionQuery !== null) {
      setMentionQuery(null);
    }
    if (!groupId) return;
    getSocket().then((socket) => {
      socket.emit("chat_group:typing", { groupId, isTyping: true });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("chat_group:typing", { groupId, isTyping: false });
      }, 2000);
    });
  }

  function insertMention(member: { id: string; firstName?: string | null }) {
    const firstName = (member.firstName ?? "Member").replace(/\s+/g, "");
    // Replace everything between mentionAnchor and the current draft
    // caret with `@FirstName `.
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? draft.length;
    const before = draft.slice(0, mentionAnchor);
    const after = draft.slice(caret);
    const inserted = `@${firstName} `;
    const nextDraft = `${before}${inserted}${after}`;
    setDraft(nextDraft);
    setMentionQuery(null);
    mentionsRef.current.set(member.id, firstName);
    // Restore caret position just after the inserted token.
    requestAnimationFrame(() => {
      if (el) {
        const pos = before.length + inserted.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  }

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    if (!group) return [];
    const q = mentionQuery.toLowerCase();
    return group.members
      .filter((m) => m.id !== (me?.id ?? ""))
      .filter((m) => (m.firstName ?? "").toLowerCase().startsWith(q))
      .slice(0, 6);
  }, [mentionQuery, group, me?.id]);

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

  // Seed the presence map from the REST snapshot (socket updates layer on top).
  useEffect(() => {
    if (presenceList.length === 0) return;
    setPresenceMap((prev) => {
      const next = new Map(prev);
      for (const p of presenceList) next.set(p.memberId, p.online);
      return next;
    });
  }, [presenceList]);

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

  const jumpToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("chat-msg-highlight");
      setTimeout(() => el.classList.remove("chat-msg-highlight"), 1600);
    }
  }, []);

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
        // Extract only the mentions that actually survived in the final
        // body (user may have deleted a token after inserting).
        const finalBody = body || "";
        const finalMentionIds: string[] = [];
        mentionsRef.current.forEach((firstName, memberId) => {
          const re = new RegExp(`(^|\\s)@${firstName}(\\s|$|[^A-Za-z0-9_])`);
          if (re.test(finalBody)) finalMentionIds.push(memberId);
        });
        await send.mutateAsync({
          body: body || undefined,
          mediaUrl: pendingMedia?.uploadedUrl ?? undefined,
          mediaType: hasReadyMedia ? pendingMedia?.mediaType : undefined,
          replyToId: replyingTo?.id,
          mentionedMemberIds: finalMentionIds.length > 0 ? finalMentionIds : undefined,
        });
      }
      setDraft("");
      setReplyingTo(null);
      mentionsRef.current.clear();
      setMentionQuery(null);
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

  // Voice-note recording → upload → send immediately (no caption UX for now).
  async function onVoiceRecorded(blob: Blob, durationSec: number) {
    if (blob.size === 0 || uploadingAudio) return;
    setUploadingAudio(true);
    try {
      const { uploadChatMedia } = await import("@/lib/api/services/chatGroups.service");
      // Prefer .webm since that's what MediaRecorder gives us on Chromium;
      // Safari would give .mp4, and the server just stores the raw bytes
      // with the R2 filename we send.
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("mpeg") ? "mp3" : "webm";
      const filename = `voice-${Date.now()}.${ext}`;
      const uploaded = await uploadChatMedia(blob, { pathPrefix: "chat-audio", filename });
      if (!uploaded?.publicUrl) {
        toast.error("Voice note upload failed");
        return;
      }
      await send.mutateAsync({
        mediaUrl: uploaded.publicUrl,
        mediaType: "audio",
      });
      // Duration is passed for future use (e.g. adding it as message
      // metadata) — currently the audio element derives its own duration
      // from the file so we don't need to send it.
      void durationSec;
    } finally {
      setUploadingAudio(false);
    }
  }

  async function handleForward(msg: ChatGroupMessage, toGroupIds: string[]) {
    try {
      await forwardMsg.mutateAsync({ messageId: msg.id, toGroupIds });
      toast.success(`Forwarded to ${toGroupIds.length} group${toGroupIds.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Failed to forward message");
    }
  }

  function handleCopy(msg: ChatGroupMessage) {
    const text = msg.body ?? "";
    if (!text) {
      toast.error("Nothing to copy");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => toast.success("Copied"),
        () => toast.error("Copy failed"),
      );
    }
  }

  function handleToggleStar(msg: ChatGroupMessage) {
    const isStarred = starredIdSet.has(msg.id);
    toggleStar.mutate(
      { messageId: msg.id, starred: isStarred },
      {
        onSuccess: () => {
          toast.success(isStarred ? "Unstarred" : "Starred");
        },
        onError: () => toast.error("Failed to update star"),
      },
    );
  }

  async function handleMute(preset: "8h" | "1w" | "always" | "off") {
    let until: string | null = null;
    let stored: string | "always" | null = null;
    if (preset === "8h") {
      const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
      until = d.toISOString();
      stored = until;
    } else if (preset === "1w") {
      const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      until = d.toISOString();
      stored = until;
    } else if (preset === "always") {
      until = null;
      stored = "always";
    } else {
      until = null;
      stored = null;
    }
    try {
      await muteGroup.mutateAsync(until);
      setLocalMuteState(groupId, stored);
      setLocalMuteStateStr(stored);
      toast.success(preset === "off" ? "Unmuted" : "Muted");
    } catch {
      toast.error("Failed to update mute");
    }
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
  const isMuted = isLocallyMuted(groupId);

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
          <div className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
            {group.name}
            {isMuted && <BellOff size={12} className="text-muted-foreground" />}
          </div>
          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-2">
            {typingMembers.size > 0 ? (
              <span>typing…</span>
            ) : (
              <>
                <span>{group.members.length} members</span>
                {(() => {
                  const onlineOthers = group.members.filter(
                    (m) => m.id !== (me?.id ?? "") && presenceMap.get(m.id) === true,
                  ).length;
                  if (onlineOthers === 0) return null;
                  return (
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
                      {onlineOthers} online
                    </span>
                  );
                })()}
              </>
            )}
          </div>
        </button>
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className={cn(
            "p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]",
            searchOpen && "text-foreground bg-[var(--color-surface-overlay)]",
          )}
          aria-label="Search messages"
        >
          <Search size={16} />
        </button>
      </div>

      {searchOpen && (
        <SearchPanel
          groupId={groupId}
          onClose={() => setSearchOpen(false)}
          onJumpToMessage={(messageId) => {
            jumpToMessage(messageId);
            setSearchOpen(false);
          }}
        />
      )}

      {/* Pin strip — sits between the header and message list. */}
      <PinStrip pinned={pinned} onJumpTo={jumpToMessage} />

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
              // Compute two flags:
              //   showSender = show sender name row (first-in-cluster)
              //   showMeta   = show timestamp / ticks row (last-in-cluster within 60s)
              // A "cluster" is a run of consecutive messages from the same
              // sender where each pair is within CLUSTER_WINDOW_MS.
              const isSameSenderAsPrev =
                prev &&
                prev.senderMemberId === m.senderMemberId &&
                !m.isSystem &&
                !prev.isSystem;
              const withinWindow = prev
                ? new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < CLUSTER_WINDOW_MS
                : false;
              const isClustered = !!(isSameSenderAsPrev && withinWindow);
              const showSender =
                !m.deletedForEveryone &&
                (!prev || !isClustered || m.isSystem);
              const next = messages[i + 1];
              const isSameSenderAsNext =
                next &&
                next.senderMemberId === m.senderMemberId &&
                !next.isSystem &&
                !m.isSystem;
              const nextWithinWindow = next
                ? new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() < CLUSTER_WINDOW_MS
                : false;
              const isMidCluster = !!(isSameSenderAsNext && nextWithinWindow);
              const showMeta = !isMidCluster;
              const isMine = !!meId && m.senderMemberId === meId;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isMine={isMine}
                  showSender={showSender}
                  showMeta={showMeta}
                  clustered={isClustered}
                  isStarred={starredIdSet.has(m.id)}
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
                  onForward={() => setForwardingMsg(m)}
                  onCopy={() => handleCopy(m)}
                  onStar={() => handleToggleStar(m)}
                  onShowReactors={(emoji) => setReactorsMsg({ msg: m, emoji })}
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
          <VoiceRecorder
            disabled={sending || !!pendingMedia || !!editing}
            uploading={uploadingAudio}
            onRecorded={onVoiceRecorded}
          />
          <div className="flex-1 relative">
            {mentionQuery !== null && mentionSuggestions.length > 0 && (
              <div
                className="absolute bottom-full mb-1 left-0 right-0 sm:right-auto sm:min-w-[220px] max-h-56 overflow-y-auto rounded-xl overflow-hidden py-1 z-30"
                style={{
                  background: "var(--color-modal-bg)",
                  border: "1px solid var(--color-border-medium)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
                }}
              >
                {mentionSuggestions.map((m) => {
                  const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || "Member";
                  const online = presenceMap.get(m.id) === true;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault() /* keep textarea focused */}
                      onClick={() => insertMention(m)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-surface-overlay)]"
                    >
                      <div
                        className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center relative"
                        style={{ background: "var(--color-accent)" }}
                      >
                        {m.profilePhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-white">
                            {name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        {online && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
                            style={{ background: "#22c55e", border: "1px solid var(--color-modal-bg)" }}
                          />
                        )}
                      </div>
                      <span className="text-xs text-foreground truncate">{name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (
                  mentionQuery !== null &&
                  mentionSuggestions.length > 0 &&
                  (e.key === "Enter" || e.key === "Tab")
                ) {
                  e.preventDefault();
                  insertMention(mentionSuggestions[0]);
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const canSend =
                    draft.trim().length > 0 || (pendingMedia?.uploadedUrl && !pendingMedia.uploading);
                  if (canSend) handleSend();
                }
              }}
              placeholder={pendingMedia ? "Add a caption…" : "Type a message… (@ to mention)"}
              rows={1}
              className="w-full px-4 py-2.5 rounded-full text-sm text-foreground outline-none resize-none max-h-32"
              style={{
                background: "var(--color-bg-primary)",
                border: "1px solid var(--color-border-subtle)",
              }}
            />
          </div>
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
          presenceMap={presenceMap}
          localMute={localMute}
          onMute={handleMute}
          onClose={() => setInfoOpen(false)}
          onLeave={async () => {
            if (!confirm("Leave this group?")) return;
            await useLeaveChatGroupOnce(groupId);
            window.location.href = "/messages";
          }}
        />
      )}

      {forwardingMsg && (
        <ForwardPickerSheet
          fromGroupId={groupId}
          previewText={forwardingMsg.body}
          previewMediaType={forwardingMsg.mediaType}
          onClose={() => setForwardingMsg(null)}
          onSubmit={(toIds) => handleForward(forwardingMsg, toIds)}
        />
      )}

      {reactorsMsg && (
        <ReactorsSheet
          reactions={reactorsMsg.msg.reactions}
          members={group.members}
          initialEmoji={reactorsMsg.emoji}
          onClose={() => setReactorsMsg(null)}
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
  showMeta,
  clustered,
  isStarred,
  otherMemberIds,
  onEdit,
  onDelete,
  onReact,
  onReply,
  onForward,
  onCopy,
  onStar,
  onShowReactors,
}: {
  message: ChatGroupMessage;
  isMine: boolean;
  showSender: boolean;
  showMeta: boolean;
  clustered: boolean;
  isStarred: boolean;
  otherMemberIds: string[];
  onEdit: () => void;
  onDelete: (forEveryone: boolean) => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onForward: () => void;
  onCopy: () => void;
  onStar: () => void;
  onShowReactors: (emoji: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactPickerOpen, setReactPickerOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Long-press support for touch devices. `pointerdown` starts a 500ms
  // timer; if the user hasn't lifted their finger by then we open the
  // menu. If they do lift (or move too far), we cancel.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);

  function startLongPress(e: React.PointerEvent<HTMLDivElement>) {
    // Only trigger for touch/pen — mouse users have the hover menu.
    if (e.pointerType === "mouse") return;
    longPressStartRef.current = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = setTimeout(() => {
      setMenuOpen(true);
    }, 500);
  }
  function cancelLongPress(e?: React.PointerEvent<HTMLDivElement>) {
    if (e && longPressStartRef.current) {
      const dx = Math.abs(e.clientX - longPressStartRef.current.x);
      const dy = Math.abs(e.clientY - longPressStartRef.current.y);
      if (dx < 10 && dy < 10 && e.type === "pointerup") {
        // A tap — cancel timer but don't open the menu.
      }
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }

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

  const senderNameColor = senderColor(message.senderMemberId);

  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        "flex px-3 chat-msg",
        isMine ? "justify-end" : "justify-start",
        clustered ? "mt-0.5" : "mt-2",
      )}
    >
      <div className={cn("max-w-[80%] group relative", isMine && "items-end")}>
        {showSender && !isMine && !deleted && (
          <div
            className="text-[10px] font-bold ml-1 mb-0.5"
            style={{ color: senderNameColor }}
          >
            {senderName}
          </div>
        )}
        <div
          className="relative"
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerMove={(e) => {
            // Cancel long-press if the user drags — matches OS behaviour.
            if (!longPressStartRef.current) return;
            const dx = Math.abs(e.clientX - longPressStartRef.current.x);
            const dy = Math.abs(e.clientY - longPressStartRef.current.y);
            if (dx > 10 || dy > 10) cancelLongPress();
          }}
          onPointerCancel={() => cancelLongPress()}
        >
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
                  {renderMentionText(message.body)}
                </p>
              ) : null}
              {showMeta && (
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                  {isStarred && !deleted && (
                    <Star size={10} className="fill-current" style={{ color: "#f59e0b" }} />
                  )}
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
              )}
            </div>
          </div>
          {!deleted && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={cn(
                "absolute -top-2 w-6 h-6 rounded-full flex items-center justify-center transition-opacity",
                isMine ? "-right-2" : "-right-2",
                "opacity-0 group-hover:opacity-100 focus:opacity-100",
              )}
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
                  "absolute z-50 mt-1 w-44 rounded-xl overflow-hidden py-1",
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
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onForward();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
                >
                  <Forward size={13} /> Forward
                </button>
                {message.body && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onCopy();
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
                  >
                    <Copy size={13} /> Copy
                  </button>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onStar();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)]"
                >
                  <Star size={13} /> {isStarred ? "Unstar" : "Star"}
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
                onClick={() => onShowReactors(emoji)}
                onDoubleClick={() => onReact(emoji)}
                title="Tap to see who reacted · double-tap to toggle"
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
    return <VoiceNotePlayer url={url} />;
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

// ── Voice note player (inline audio with a decorative waveform) ─────────────

function VoiceNotePlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.preload = "metadata";
    const onLoaded = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onTime = () => setCurrent(audio.currentTime);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, [url]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play();
      setPlaying(true);
    }
  }

  // Decorative sine-bar waveform. Real waveform decoding is P2; for now
  // we render 32 bars with heights derived from a stable sine function
  // so they don't look random or shift on re-render.
  const bars = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < 32; i++) {
      const h = 4 + Math.abs(Math.sin(i * 0.7)) * 14;
      arr.push(h);
    }
    return arr;
  }, []);

  const progress = duration ? Math.min(1, current / duration) : 0;
  const activeBars = Math.floor(progress * bars.length);

  const displayTime = (() => {
    const t = duration ?? 0;
    const remaining = playing ? t - current : t;
    const s = Math.max(0, Math.round(remaining));
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  })();

  return (
    <div className="flex items-center gap-2 m-1.5 px-2.5 py-2 rounded-lg min-w-[220px]" style={{ background: "var(--color-bg-primary)" }}>
      <button
        type="button"
        onClick={toggle}
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white"
        style={{ background: "var(--color-accent)" }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div className="flex-1 flex items-center gap-[2px] h-6">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full"
            style={{
              height: `${h}px`,
              background: i < activeBars ? "var(--color-accent)" : "var(--color-border-medium)",
            }}
          />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
        {displayTime}
      </span>
    </div>
  );
}

// ── In-group search panel ───────────────────────────────────────────────────

function SearchPanel({
  groupId,
  onClose,
  onJumpToMessage,
}: {
  groupId: string;
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const debouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { data: results = [], isFetching } = useChatGroupSearch(groupId, debouncedQuery);

  useEffect(() => {
    if (debouncedRef.current) clearTimeout(debouncedRef.current);
    debouncedRef.current = setTimeout(() => setDebouncedQuery(query), 250);
    return () => {
      if (debouncedRef.current) clearTimeout(debouncedRef.current);
    };
  }, [query]);

  const trimmed = query.trim();

  return (
    <div
      className="flex-shrink-0 p-3 border-b space-y-2"
      style={{
        background: "var(--color-bg-surface)",
        borderColor: "var(--color-border-subtle)",
      }}
    >
      <div className="flex items-center gap-2">
        <Search size={14} className="text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages in this group…"
          className="flex-1 px-2 py-1.5 rounded-lg text-sm text-foreground outline-none bg-transparent"
        />
        <button
          onClick={onClose}
          className="p-1 rounded text-muted-foreground hover:text-foreground"
          aria-label="Close search"
        >
          <X size={14} />
        </button>
      </div>

      {trimmed.length < 2 ? (
        <div className="text-[11px] text-muted-foreground italic">
          Type at least 2 characters.
        </div>
      ) : isFetching ? (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Loader2 size={11} className="animate-spin" /> searching…
        </div>
      ) : results.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">No matches.</div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1">
          {results.map((m: ChatGroupMessage) => {
            const senderName =
              [m.sender?.firstName, m.sender?.lastName].filter(Boolean).join(" ") || "Member";
            const when = new Date(m.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <button
                key={m.id}
                onClick={() => onJumpToMessage(m.id)}
                className="w-full text-left p-2 rounded-lg hover:bg-[var(--color-surface-overlay)] transition-colors"
              >
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-bold" style={{ color: "var(--color-accent)" }}>
                    {senderName}
                  </span>
                  <span className="text-muted-foreground">· {when}</span>
                </div>
                <div className="text-xs text-foreground mt-0.5 line-clamp-2">
                  {m.body ?? (m.mediaType ? `📎 ${m.mediaType}` : "…")}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Group info bottom sheet ─────────────────────────────────────────────────

function GroupInfoSheet({
  group,
  presenceMap,
  localMute,
  onMute,
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
  presenceMap: Map<string, boolean>;
  localMute: string | "always" | null;
  onMute: (preset: "8h" | "1w" | "always" | "off") => Promise<void> | void;
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

  const isMuted = (() => {
    if (!localMute) return false;
    if (localMute === "always") return true;
    try {
      return new Date(localMute).getTime() > Date.now();
    } catch {
      return false;
    }
  })();

  const muteLabel = (() => {
    if (!localMute) return "Not muted";
    if (localMute === "always") return "Muted · always";
    try {
      const d = new Date(localMute);
      return `Muted until ${d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
    } catch {
      return "Muted";
    }
  })();

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

          {/* Mute controls */}
          <div
            className="rounded-xl p-3 space-y-2.5"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellOff size={14} className="text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Notifications</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{muteLabel}</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(
                [
                  { key: "8h", label: "8 hours" },
                  { key: "1w", label: "1 week" },
                  { key: "always", label: "Always" },
                ] as const
              ).map((p) => (
                <button
                  key={p.key}
                  onClick={() => onMute(p.key)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: "var(--color-bg-primary)",
                    border: "1px solid var(--color-border-subtle)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {p.label}
                </button>
              ))}
              {isMuted && (
                <button
                  onClick={() => onMute("off")}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                  style={{ background: "var(--color-accent)" }}
                >
                  Unmute
                </button>
              )}
            </div>
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
                const online = presenceMap.get(m.id) === true;
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-2 rounded-xl"
                    style={{ background: "var(--color-bg-surface)" }}
                  >
                    <div className="relative w-8 h-8 flex-shrink-0">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--color-surface-overlay)] flex items-center justify-center">
                        {m.profilePhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-white">
                            {name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {online && (
                        <span
                          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
                          style={{
                            background: "#22c55e",
                            border: "1.5px solid var(--color-bg-surface)",
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {online ? "Online" : "Offline"}
                      </div>
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

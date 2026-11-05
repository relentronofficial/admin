"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Edit3,
  Info,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Pin,
  PinOff,
  Reply,
  Search,
  Send,
  Smile,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useAdminConversations,
  useAdminConversationMessages,
  useSendAdminChatMessage,
  useCloseConversation,
  useEditAdminChatMessage,
  useDeleteAdminChatMessage,
  useRaiseTicketFromDm,
  useToggleDmReaction,
  useForwardDmMessage,
  useToggleDmPin,
  useToggleDmStar,
  useMe,
} from "@/lib/hooks/useAdmin";
import { getAdminSocket } from "@/lib/socket/client";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

const TYPING_DEBOUNCE_MS = 2000;
const EMOJI_SET = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
type FilterTab = "all" | "open" | "closed";

// ── defaultDeadline ───────────────────────────────────────────────────────────

function defaultDeadline() {
  const d = new Date(Date.now() + 24 * 3_600_000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

// ── AdminBubble ───────────────────────────────────────────────────────────────

function AdminBubble({
  message,
  messages,
  conversationId,
  conversations,
  myAdminId,
  onReply,
}: {
  message: any;
  messages: any[];
  conversationId: string;
  conversations: any[];
  myAdminId: string | null;
  onReply: (msg: any) => void;
}) {
  // ── dropdown state
  const [menuOpen, setMenuOpen]         = useState(false);
  const [menuPos, setMenuPos]           = useState<{ top: number; left: number } | null>(null);
  const triggerRef                      = useRef<HTMLButtonElement>(null);
  const MENU_W                          = 184;

  // ── editing / delete
  const [editing, setEditing]           = useState(false);
  const [editText, setEditText]         = useState("");
  const [confirmDel, setConfirmDel]     = useState(false);

  // ── ticket modal
  const [ticketModal, setTicketModal]   = useState(false);
  const [tkSubject, setTkSubject]       = useState("");
  const [tkMessage, setTkMessage]       = useState("");
  const [tkPriority, setTkPriority]     = useState("medium");
  const [tkDeadline, setTkDeadline]     = useState("");

  // ── message info modal
  const [infoOpen, setInfoOpen]         = useState(false);

  // ── emoji picker
  const [emojiPos, setEmojiPos]         = useState<{ top: number; left: number } | null>(null);
  const emojiTriggerRef                 = useRef<{ top: number; right: number } | null>(null);

  // ── forward modal
  const [forwardOpen, setForwardOpen]   = useState(false);
  const [fwdSearch, setFwdSearch]       = useState("");
  const [fwdSelected, setFwdSelected]   = useState<Set<string>>(new Set());

  // ── mutations
  const editMsg      = useEditAdminChatMessage();
  const deleteMsg    = useDeleteAdminChatMessage();
  const raiseTicket  = useRaiseTicketFromDm();
  const toggleRx     = useToggleDmReaction();
  const forwardMsg   = useForwardDmMessage();
  const togglePin    = useToggleDmPin();
  const toggleStar   = useToggleDmStar();

  const isAdmin  = message.senderType === "admin";
  const deleted  = !!message.deletedForEveryone;

  const replyTo = message.replyToId
    ? messages.find((m: any) => m.id === message.replyToId)
    : null;

  // ── dropdown positioning
  function openMenu() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuH = 340;
    let top  = r.bottom + 4;
    let left = r.right - MENU_W;
    if (top + menuH > window.innerHeight - 8) top = r.top - menuH - 4;
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_W - 8));
    setMenuPos({ top, left });
    setMenuOpen(true);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, true);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // ── emoji picker positioning
  function openEmojiPicker() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pickerW = 264;
    const pickerH = 60;
    let top  = r.bottom + 4;
    let left = r.right - pickerW;
    if (top + pickerH > window.innerHeight - 8) top = r.top - pickerH - 4;
    left = Math.max(8, Math.min(left, window.innerWidth - pickerW - 8));
    emojiTriggerRef.current = { top: r.top, right: r.right };
    setEmojiPos({ top, left });
  }

  // ── editing handlers
  function startEdit() {
    setMenuOpen(false);
    setEditText(message.body ?? "");
    setEditing(true);
  }

  function saveEdit() {
    const body = editText.trim();
    if (!body) { toast.error("Message cannot be empty"); return; }
    if (body === message.body) { setEditing(false); return; }
    editMsg.mutate({ conversationId, messageId: message.id, body }, {
      onSuccess: () => { setEditing(false); toast.success("Message edited"); },
      onError: () => toast.error("Could not edit message"),
    });
  }

  async function handleCopy() {
    setMenuOpen(false);
    if (!message.body) { toast("No text to copy", { icon: "ℹ️" }); return; }
    try {
      await navigator.clipboard.writeText(message.body);
      toast.success("Copied");
    } catch {
      toast.error("Clipboard blocked by browser");
    }
  }

  function doDelete() {
    deleteMsg.mutate({ conversationId, messageId: message.id }, {
      onSuccess: () => { setConfirmDel(false); toast.success("Message deleted"); },
      onError: () => toast.error("Could not delete message"),
    });
  }

  function handleToggleReaction(emoji: string) {
    setEmojiPos(null);
    toggleRx.mutate({ conversationId, messageId: message.id, emoji }, {
      onError: () => toast.error("Could not add reaction"),
    });
  }

  function handleTogglePin() {
    setMenuOpen(false);
    togglePin.mutate({ conversationId, messageId: message.id }, {
      onSuccess: (data: any) => toast.success(data?.pinned ? "Message pinned" : "Message unpinned"),
      onError: () => toast.error("Could not pin message"),
    });
  }

  function handleToggleStar() {
    setMenuOpen(false);
    toggleStar.mutate({ conversationId, messageId: message.id }, {
      onSuccess: (data: any) => toast.success(data?.starred ? "Message starred" : "Message unstarred"),
      onError: () => toast.error("Could not star message"),
    });
  }

  async function handleForward() {
    if (fwdSelected.size === 0) return;
    try {
      const result: any = await forwardMsg.mutateAsync({
        conversationId,
        messageId: message.id,
        conversationIds: [...fwdSelected],
      });
      setForwardOpen(false);
      setFwdSelected(new Set());
      toast.success(`Forwarded to ${result?.forwarded ?? fwdSelected.size} conversation(s)`);
    } catch {
      toast.error("Could not forward message");
    }
  }

  const fwdConversations = conversations.filter((c: any) => {
    if (c.id === conversationId) return false;
    if (c.status !== "open") return false;
    if (!fwdSearch.trim()) return true;
    const q = fwdSearch.toLowerCase();
    return c.member?.name?.toLowerCase().includes(q) || c.subject?.toLowerCase().includes(q);
  });

  // ── derived
  const reactions: { emoji: string; count: number; senderIds: string[] }[] = message.reactions ?? [];
  const isPinned: boolean  = message.isPinned ?? false;
  const isStarred: boolean = message.isStarredByAdmin ?? false;

  return (
    <div
      id={`msg-${message.id}`}
      className={`flex gap-2.5 ${isAdmin ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white self-end"
        style={{ background: isAdmin ? "#dc2626" : "#333" }}
      >
        {isAdmin ? "A" : (message.senderName?.[0]?.toUpperCase() ?? "M")}
      </div>

      {/* Bubble wrapper */}
      <div className={`max-w-[65%] flex flex-col relative group ${isAdmin ? "items-end" : ""}`}>

        {/* Pin / Star indicators */}
        {(isPinned || isStarred) && (
          <div className={`flex gap-1.5 mb-0.5 ${isAdmin ? "justify-end" : "justify-start"}`}>
            {isPinned  && <span title="Pinned"><Pin  size={10} className="text-[#facc15]" /></span>}
            {isStarred && <span title="Starred"><Star size={10} className="text-[#facc15] fill-current" /></span>}
          </div>
        )}

        <div
          className={`rounded-2xl overflow-hidden ${isAdmin ? "rounded-tr-sm" : "rounded-tl-sm"}`}
          style={{ background: isAdmin ? "rgba(220,38,38,0.15)" : "#1f1f1f" }}
        >
          {/* Forwarded label */}
          {message.isForwarded && !deleted && (
            <div className="flex items-center gap-1 px-3.5 pt-2 text-[10px] text-[#888]">
              <ArrowUpRight size={10} /> Forwarded
            </div>
          )}

          {/* Reply quote */}
          {replyTo && !deleted && (
            <div
              className="mx-1.5 mt-1.5 px-2.5 py-1.5 rounded-md text-[11px]"
              style={{ background: "rgba(220,38,38,0.08)", borderLeft: "3px solid #dc2626" }}
            >
              <div className="font-bold text-[#dc2626]">
                {replyTo.senderType === "admin" ? "You" : replyTo.senderName}
              </div>
              <div className="text-[#888] truncate">
                {replyTo.deletedForEveryone ? "This message was deleted" : (replyTo.body || "📎 attachment")}
              </div>
            </div>
          )}

          {deleted && (
            <p className="text-sm italic text-[#666] px-3.5 py-2">This message was deleted</p>
          )}

          {editing ? (
            <div className="px-2 pt-2 pb-1 space-y-1.5">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                maxLength={5000}
                autoFocus
                className="w-full min-w-[220px] rounded-lg px-2.5 py-2 text-sm outline-none border text-[#f0f0f0] resize-none bg-[#0f0f0f] border-[#dc2626]/40"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  disabled={editMsg.isPending}
                  className="px-3 h-7 rounded-md text-xs text-[#888] hover:text-[#a0a0a0] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={editMsg.isPending}
                  className="px-3 h-7 rounded-md text-xs font-semibold text-white bg-[#dc2626] hover:bg-red-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {editMsg.isPending && <Loader2 size={11} className="animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            !deleted && message.body && (
              <p className="text-sm text-[#f0f0f0] leading-relaxed px-3.5 py-2 whitespace-pre-wrap break-words">
                {message.body}
              </p>
            )
          )}

          <p className="text-[10px] text-[#777] mt-0 px-3.5 pb-1.5 text-right">
            {message.editedAt && !deleted ? "edited · " : ""}
            {format(new Date(message.createdAt), "HH:mm")}
          </p>
        </div>

        {/* Reactions row */}
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isAdmin ? "justify-end" : "justify-start"}`}>
            {reactions.map((r) => {
              const iMine = myAdminId ? r.senderIds.includes(myAdminId) : false;
              return (
                <button
                  key={r.emoji}
                  onClick={() => handleToggleReaction(r.emoji)}
                  title={iMine ? "Remove reaction" : "Add reaction"}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-colors"
                  style={{
                    background: iMine ? "rgba(220,38,38,0.2)" : "#1f1f1f",
                    border: iMine ? "1px solid rgba(220,38,38,0.4)" : "1px solid #2a2a2a",
                    color: iMine ? "#dc2626" : "#a0a0a0",
                  }}
                >
                  {r.emoji}{r.count > 1 && <span className="ml-0.5">{r.count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Hover action button */}
        {!deleted && !editing && (
          <button
            ref={triggerRef}
            onClick={openMenu}
            className="absolute top-0 right-0 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
            style={{ background: "#141414", border: "1px solid #2a2a2a", color: "#888" }}
            aria-label="Message options"
          >
            <ChevronDown size={12} />
          </button>
        )}

        {/* ── Dropdown menu (portal) ─────────────────────────────────── */}
        {menuOpen && menuPos && createPortal(
          <>
            <div className="fixed inset-0 z-[200]" onClick={() => setMenuOpen(false)} />
            <div
              className="fixed z-[201] rounded-xl overflow-hidden py-1"
              style={{
                top: menuPos.top, left: menuPos.left, width: MENU_W,
                background: "#141414", border: "1px solid #2a2a2a",
                boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
                animation: "fadeInScale 0.1s ease",
              }}
            >
              {/* 1. Message Info */}
              <button
                onClick={() => { setMenuOpen(false); setInfoOpen(true); }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-[#a0a0a0] hover:text-[#f0f0f0] hover:bg-white/[0.04]"
              >
                <Info size={13} /> Message Info
              </button>

              <div className="my-1 border-t border-[#2a2a2a]" />

              {/* 2. Reply */}
              <button
                onClick={() => { setMenuOpen(false); onReply(message); }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-[#a0a0a0] hover:text-[#f0f0f0] hover:bg-white/[0.04]"
              >
                <Reply size={13} /> Reply
              </button>

              {/* 3. Copy */}
              {!deleted && message.body && (
                <button
                  onClick={handleCopy}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-[#a0a0a0] hover:text-[#f0f0f0] hover:bg-white/[0.04]"
                >
                  <Copy size={13} /> Copy
                </button>
              )}

              {/* 4. React */}
              {!deleted && (
                <button
                  onClick={() => { setMenuOpen(false); openEmojiPicker(); }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-[#a0a0a0] hover:text-[#f0f0f0] hover:bg-white/[0.04]"
                >
                  <Smile size={13} /> React
                </button>
              )}

              <div className="my-1 border-t border-[#2a2a2a]" />

              {/* 5. Forward */}
              {!deleted && (
                <button
                  onClick={() => { setMenuOpen(false); setFwdSearch(""); setFwdSelected(new Set()); setForwardOpen(true); }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-[#a0a0a0] hover:text-[#f0f0f0] hover:bg-white/[0.04]"
                >
                  <ArrowUpRight size={13} /> Forward
                </button>
              )}

              {/* 6. Pin / Unpin */}
              {!deleted && (
                <button
                  onClick={handleTogglePin}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-[#a0a0a0] hover:text-[#f0f0f0] hover:bg-white/[0.04]"
                >
                  {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                  {isPinned ? "Unpin" : "Pin"}
                </button>
              )}

              {/* 7. Star / Unstar */}
              <button
                onClick={handleToggleStar}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-[#a0a0a0] hover:text-[#f0f0f0] hover:bg-white/[0.04]"
              >
                <Star size={13} className={isStarred ? "fill-[#facc15] text-[#facc15]" : ""} />
                {isStarred ? "Unstar" : "Star"}
              </button>

              <div className="my-1 border-t border-[#2a2a2a]" />

              {/* 8. Raise Ticket */}
              {!deleted && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    const preview = (message.body ?? "").slice(0, 100);
                    setTkSubject(preview || "Support ticket");
                    setTkMessage(message.body ?? "");
                    setTkPriority("medium");
                    setTkDeadline(defaultDeadline());
                    setTicketModal(true);
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-orange-400 hover:text-orange-300 hover:bg-white/[0.04]"
                >
                  <LifeBuoy size={13} /> Raise Ticket
                </button>
              )}

              {/* 9. Edit (admin own messages only) */}
              {isAdmin && !deleted && (
                <>
                  <div className="my-1 border-t border-[#2a2a2a]" />
                  <button
                    onClick={startEdit}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-[#a0a0a0] hover:text-[#f0f0f0] hover:bg-white/[0.04]"
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                </>
              )}

              {/* 10. Delete (admin own messages only) */}
              {isAdmin && (
                <button
                  onClick={() => { setMenuOpen(false); setConfirmDel(true); }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-white/[0.04]"
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </div>
          </>,
          document.body,
        )}

        {/* ── Emoji picker (portal) ──────────────────────────────────── */}
        {emojiPos && createPortal(
          <>
            <div className="fixed inset-0 z-[200]" onClick={() => setEmojiPos(null)} />
            <div
              className="fixed z-[201] flex items-center gap-1 p-2 rounded-2xl"
              style={{
                top: emojiPos.top, left: emojiPos.left,
                background: "#141414", border: "1px solid #2a2a2a",
                boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
                animation: "fadeInScale 0.1s ease",
              }}
            >
              {EMOJI_SET.map((emoji) => {
                const iMine = myAdminId
                  ? (reactions.find((r) => r.emoji === emoji)?.senderIds ?? []).includes(myAdminId)
                  : false;
                return (
                  <button
                    key={emoji}
                    onClick={() => handleToggleReaction(emoji)}
                    title={iMine ? "Remove" : "React"}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-xl hover:bg-white/10 transition-colors"
                    style={iMine ? { background: "rgba(220,38,38,0.2)", outline: "1px solid rgba(220,38,38,0.4)" } : {}}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </>,
          document.body,
        )}

        {/* ── Message Info modal ─────────────────────────────────────── */}
        {infoOpen && createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setInfoOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{ background: "#141414", border: "1px solid #2a2a2a" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
                <span className="text-sm font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider flex items-center gap-2">
                  <Info size={14} className="text-[#dc2626]" /> Message Info
                </span>
                <button onClick={() => setInfoOpen(false)} className="text-[#777] hover:text-[#a0a0a0]">
                  <X size={15} />
                </button>
              </div>
              <div className="p-5 space-y-3 text-xs text-[#a0a0a0]">
                <Row label="Sender"   value={message.senderType === "admin" ? "You (Admin)" : message.senderName} />
                <Row label="Sent"     value={format(new Date(message.createdAt), "PPpp")} />
                {message.editedAt && <Row label="Edited"   value={format(new Date(message.editedAt), "PPpp")} />}
                <Row
                  label="Read by admin"
                  value={message.readByAdminAt ? format(new Date(message.readByAdminAt), "PPpp") : "—"}
                />
                <Row
                  label="Read by member"
                  value={message.readByMemberAt ? format(new Date(message.readByMemberAt), "PPpp") : "—"}
                />
                {message.isForwarded && <Row label="Type" value="Forwarded message" />}
                {message.isPinned && (
                  <Row label="Pinned" value={message.pinnedAt ? format(new Date(message.pinnedAt), "PPpp") : "Yes"} />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

        {/* ── Forward modal ──────────────────────────────────────────── */}
        {forwardOpen && createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
            onClick={() => !forwardMsg.isPending && setForwardOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col max-h-[80vh]"
              style={{ background: "#141414", border: "1px solid #2a2a2a" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] flex-shrink-0">
                <span className="text-sm font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider flex items-center gap-2">
                  <ArrowUpRight size={14} className="text-[#dc2626]" /> Forward Message
                </span>
                <button
                  onClick={() => setForwardOpen(false)}
                  disabled={forwardMsg.isPending}
                  className="text-[#777] hover:text-[#a0a0a0]"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Source preview */}
              {message.body && (
                <div className="mx-5 mt-4 px-3 py-2 rounded-lg text-xs text-[#888] flex-shrink-0" style={{ background: "#1a1a1a", borderLeft: "3px solid #555" }}>
                  <div className="line-clamp-2 whitespace-pre-wrap text-[#a0a0a0]">{message.body}</div>
                </div>
              )}

              {/* Search */}
              <div className="px-5 mt-4 flex-shrink-0">
                <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 focus-within:border-[#dc2626]">
                  <Search size={12} className="text-[#777] shrink-0" />
                  <input
                    value={fwdSearch}
                    onChange={(e) => setFwdSearch(e.target.value)}
                    placeholder="Search conversations..."
                    className="flex-1 bg-transparent text-sm text-[#f0f0f0] outline-none placeholder:text-[#777]"
                  />
                </div>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto px-5 mt-3 space-y-1 pb-3 min-h-0">
                {fwdConversations.length === 0 ? (
                  <p className="text-center text-xs text-[#666] py-6">No open conversations</p>
                ) : (
                  fwdConversations.map((c: any) => {
                    const sel = fwdSelected.has(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          const next = new Set(fwdSelected);
                          sel ? next.delete(c.id) : next.add(c.id);
                          setFwdSelected(next);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                        style={{
                          background: sel ? "rgba(220,38,38,0.1)" : "#1a1a1a",
                          border: sel ? "1px solid rgba(220,38,38,0.4)" : "1px solid #2a2a2a",
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                          style={{ background: sel ? "#dc2626" : "#333" }}
                        >
                          {c.member?.name?.[0]?.toUpperCase() ?? "M"}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-semibold text-[#f0f0f0] truncate">{c.member?.name ?? "Member"}</p>
                          <p className="text-[10px] text-[#777] truncate">{c.subject}</p>
                        </div>
                        {sel && <Check size={13} className="text-[#dc2626] flex-shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-[#2a2a2a] flex-shrink-0">
                <span className="text-xs text-[#888]">
                  {fwdSelected.size > 0 ? `${fwdSelected.size} selected` : "Select conversations"}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setForwardOpen(false)}
                    disabled={forwardMsg.isPending}
                    className="px-4 h-9 rounded-lg text-sm text-[#888] hover:text-[#f0f0f0] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleForward}
                    disabled={forwardMsg.isPending || fwdSelected.size === 0}
                    className="px-4 h-9 rounded-lg text-sm font-semibold text-white bg-[#dc2626] hover:bg-red-700 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {forwardMsg.isPending && <Loader2 size={13} className="animate-spin" />}
                    <ArrowUpRight size={13} /> Forward
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

        {/* ── Delete confirm ─────────────────────────────────────────── */}
        {confirmDel && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
            onClick={() => !deleteMsg.isPending && setConfirmDel(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ background: "#141414", border: "1px solid #2a2a2a" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-semibold text-sm text-[#f0f0f0]">Delete this message?</p>
              <p className="text-xs text-[#888]">This will remove it for you and the member. This cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDel(false)}
                  disabled={deleteMsg.isPending}
                  className="px-4 h-9 rounded-lg text-sm text-[#888] hover:text-[#f0f0f0] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={doDelete}
                  disabled={deleteMsg.isPending}
                  className="px-4 h-9 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {deleteMsg.isPending && <Loader2 size={13} className="animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Raise Ticket modal ─────────────────────────────────────── */}
        {ticketModal && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
            onClick={() => !raiseTicket.isPending && setTicketModal(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{ background: "#141414", border: "1px solid #2a2a2a" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
                <div className="flex items-center gap-2">
                  <LifeBuoy size={15} className="text-orange-400" />
                  <span className="text-sm font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">
                    Raise Support Ticket
                  </span>
                </div>
                <button
                  onClick={() => setTicketModal(false)}
                  disabled={raiseTicket.isPending}
                  className="p-1 rounded text-[#777] hover:text-[#a0a0a0]"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {message.body && (
                  <div className="rounded-lg px-3 py-2 text-xs text-[#888]" style={{ background: "#1a1a1a", borderLeft: "3px solid #555" }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#666] font-rajdhani mb-1">Source message</div>
                    <div className="text-[#a0a0a0] line-clamp-3 whitespace-pre-wrap">{message.body}</div>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1.5 font-rajdhani">Subject *</label>
                  <input
                    value={tkSubject}
                    onChange={(e) => setTkSubject(e.target.value)}
                    maxLength={255}
                    placeholder="Describe the issue..."
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 px-3 text-sm text-white outline-none focus:border-[#dc2626] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1.5 font-rajdhani">Description *</label>
                  <textarea
                    value={tkMessage}
                    onChange={(e) => setTkMessage(e.target.value)}
                    rows={3}
                    placeholder="Add more context for this ticket..."
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#dc2626] transition-all resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1.5 font-rajdhani">Priority</label>
                    <select
                      value={tkPriority}
                      onChange={(e) => setTkPriority(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 px-3 text-sm text-white outline-none focus:border-[#dc2626]"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-1.5 font-rajdhani">Resolve By</label>
                    <input
                      type="datetime-local"
                      value={tkDeadline}
                      onChange={(e) => setTkDeadline(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 px-3 text-sm text-white outline-none focus:border-[#dc2626]"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setTicketModal(false)}
                    disabled={raiseTicket.isPending}
                    className="px-4 h-9 rounded-lg text-sm text-[#888] hover:text-[#f0f0f0] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={raiseTicket.isPending || !tkSubject.trim() || !tkMessage.trim()}
                    onClick={async () => {
                      try {
                        await raiseTicket.mutateAsync({
                          conversationId,
                          messageId: message.id,
                          subject: tkSubject.trim(),
                          message: tkMessage.trim(),
                          priority: tkPriority,
                          resolveDeadline: tkDeadline || undefined,
                        });
                        setTicketModal(false);
                        toast.success("Ticket raised successfully");
                      } catch (err: any) {
                        toast.error(err?.response?.data?.error ?? "Failed to raise ticket");
                      }
                    }}
                    className="px-4 h-9 rounded-lg text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {raiseTicket.isPending && <Loader2 size={13} className="animate-spin" />}
                    <LifeBuoy size={13} /> Raise Ticket
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper: info row ──────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#666] flex-shrink-0">{label}</span>
      <span className="text-[#f0f0f0] text-right">{value}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminMessagesPage() {
  const queryClient = useQueryClient();

  const [activeId, setActiveId]     = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState<FilterTab>("all");
  const [input, setInput]           = useState("");
  const [isTyping, setIsTyping]     = useState(false);
  const [typingName, setTypingName] = useState("");
  const [replyTo, setReplyTo]       = useState<any | null>(null);

  const typingTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  const { data: meData } = useMe();
  const myAdminId: string | null = (meData as any)?.id ?? null;

  // Deep-link from notification: ?conversation=<id>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convoId = params.get("conversation");
    if (convoId) {
      setActiveId(convoId);
      window.history.replaceState({}, "", "/messages");
    }
  }, []);

  const { data: convoData, isLoading: convoLoading } = useAdminConversations();
  const { data: msgData }  = useAdminConversationMessages(activeId);
  const sendMessage        = useSendAdminChatMessage();
  const closeConvo         = useCloseConversation();

  const allConversations: any[] = (convoData as any)?.data ?? [];
  const messages: any[]         = (msgData as any)?.data ?? [];
  const activeMeta              = (msgData as any)?.meta ?? null;
  const activeConvo             = allConversations.find((c: any) => c.id === activeId) ?? null;

  const filtered = allConversations
    .filter((c: any) => {
      if (filter === "open")   return c.status === "open";
      if (filter === "closed") return c.status === "closed";
      return true;
    })
    .filter((c: any) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.member?.name?.toLowerCase().includes(q) ||
        c.subject?.toLowerCase().includes(q)
      );
    });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Clear reply when switching conversation
  useEffect(() => { setReplyTo(null); }, [activeId]);

  // Global socket
  useEffect(() => {
    let mounted = true;
    getAdminSocket().then((s) => {
      if (!mounted) return;
      s.on("chat:conversation_new", ({ memberName, subject }: any) => {
        queryClient.invalidateQueries({ queryKey: ["admin", "conversations"] });
        toast(`New chat from ${memberName}: ${subject}`, { icon: "💬" });
      });
    });
    return () => {
      mounted = false;
      getAdminSocket().then((s) => s.off("chat:conversation_new"));
    };
  }, [queryClient]);

  // Per-conversation socket
  useEffect(() => {
    if (!activeId) return;
    let mounted = true;

    getAdminSocket().then((s) => {
      if (!mounted) return;
      s.emit("chat:join", { conversationId: activeId });

      s.on("chat:message", ({ conversationId }: any) => {
        if (conversationId !== activeId) return;
        queryClient.invalidateQueries({ queryKey: ["admin", "conversations", activeId, "messages"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "conversations"] });
      });

      s.on("chat:reaction", ({ conversationId }: any) => {
        if (conversationId !== activeId) return;
        queryClient.invalidateQueries({ queryKey: ["admin", "conversations", activeId, "messages"] });
      });

      s.on("chat:typing", ({ senderType, isTyping: t }: any) => {
        if (senderType !== "member") return;
        setIsTyping(t);
        if (t) setTypingName(activeConvo?.member?.name ?? "Member");
      });

      s.on("chat:conversation_closed", ({ conversationId: cid }: any) => {
        if (cid !== activeId) return;
        queryClient.invalidateQueries({ queryKey: ["admin", "conversations"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "conversations", activeId, "messages"] });
      });
    });

    return () => {
      mounted = false;
      getAdminSocket().then((s) => {
        s.emit("chat:leave", { conversationId: activeId });
        s.off("chat:message");
        s.off("chat:reaction");
        s.off("chat:typing");
        s.off("chat:conversation_closed");
      });
    };
  }, [activeId, queryClient, activeConvo?.member?.name]);

  const handleInputChange = useCallback(async (value: string) => {
    setInput(value);
    if (!activeId) return;
    const s = await getAdminSocket();
    s.emit("chat:typing", { conversationId: activeId, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(async () => {
      const s2 = await getAdminSocket();
      s2.emit("chat:typing", { conversationId: activeId, isTyping: false });
    }, TYPING_DEBOUNCE_MS);
  }, [activeId]);

  const handleSend = async () => {
    if (!activeId || !input.trim()) return;
    const body = input.trim();
    setInput("");
    const capturedReplyTo = replyTo;
    setReplyTo(null);

    // Optimistic update — append a temporary message immediately so the UI
    // feels instant. The socket's chat:message event will trigger an
    // invalidateQueries that replaces it with the real server row.
    const optimisticId = `optimistic-${Date.now()}`;
    const msgKey = ["admin", "conversations", activeId, "messages"];
    queryClient.setQueryData(msgKey, (old: any) => {
      if (!old) return old;
      const existing: any[] = Array.isArray(old?.data) ? old.data : [];
      const optimisticMsg = {
        id:               optimisticId,
        body,
        mediaUrl:         null,
        mediaType:        null,
        senderType:       "admin",
        senderId:         myAdminId,
        senderName:       "You",
        senderAvatarUrl:  null,
        replyToId:        capturedReplyTo?.id ?? null,
        editedAt:         null,
        deletedAt:        null,
        deletedForEveryone: false,
        readByAdminAt:    null,
        readByMemberAt:   null,
        createdAt:        new Date().toISOString(),
        isForwarded:      false,
        isPinned:         false,
        pinnedAt:         null,
        isStarredByAdmin: false,
        reactions:        [],
        _optimistic:      true,
      };
      return { ...old, data: [...existing, optimisticMsg] };
    });

    try {
      await sendMessage.mutateAsync({
        conversationId: activeId,
        body,
        ...(capturedReplyTo ? { replyToId: capturedReplyTo.id } : {}),
      } as any);
      // The socket's chat:message event (fired by the backend after save)
      // will invalidate both keys — no need to do it again here.
      // If the socket is temporarily disconnected, fall back to a single
      // invalidation so the real message replaces the optimistic one.
      queryClient.invalidateQueries({ queryKey: msgKey });
    } catch {
      // Roll back optimistic update on failure
      queryClient.setQueryData(msgKey, (old: any) => {
        if (!old) return old;
        return { ...old, data: (old.data as any[]).filter((m: any) => m.id !== optimisticId) };
      });
      setInput(body);
      setReplyTo(capturedReplyTo);
      toast.error("Failed to send message");
    }
  };

  const handleClose = async () => {
    if (!activeId) return;
    try {
      await closeConvo.mutateAsync(activeId);
      queryClient.invalidateQueries({ queryKey: ["admin", "conversations", activeId, "messages"] });
      toast.success("Conversation closed");
    } catch {
      toast.error("Failed to close conversation");
    }
  };

  function handleReply(msg: any) {
    setReplyTo(msg);
    inputRef.current?.focus();
  }

  const TAB_CLS = (t: FilterTab) =>
    `px-3 py-1 rounded text-[11px] font-bold uppercase tracking-widest font-rajdhani transition-colors ${
      filter === t
        ? "bg-[#dc2626] text-white"
        : "text-[#888] hover:text-[#a0a0a0]"
    }`;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-80px)]">

        {/* Page header */}
        <div className="flex gap-3 items-start mb-4">
          <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
          <div>
            <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">
              Direct Messages
            </h1>
            <p className="text-[12px] text-[#888] font-medium uppercase tracking-[1px] font-rajdhani">
              Live chat with members
            </p>
          </div>
        </div>

        {/* Two-pane layout */}
        <div className="flex flex-1 min-h-0 border border-[#2a2a2a] rounded-xl overflow-hidden bg-[#181818]">

          {/* ── Left pane ──────────────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 border-r border-[#2a2a2a] flex flex-col bg-[#141414]">
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 focus-within:border-[#dc2626] transition-all">
                <Search size={12} className="text-[#777] shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or subject..."
                  className="flex-1 bg-transparent text-[#f0f0f0] text-xs outline-none placeholder:text-[#777]"
                />
                {search && (
                  <button onClick={() => setSearch("")}>
                    <X size={11} className="text-[#777] hover:text-[#a0a0a0]" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-1 px-3 pb-2">
              <button className={TAB_CLS("all")}    onClick={() => setFilter("all")}>All</button>
              <button className={TAB_CLS("open")}   onClick={() => setFilter("open")}>Open</button>
              <button className={TAB_CLS("closed")} onClick={() => setFilter("closed")}>Closed</button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#222]">
              {convoLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin text-[#777]" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center">
                  <MessageSquare size={24} className="mx-auto mb-2 text-[#666]" />
                  <p className="text-[11px] text-[#888]">No conversations</p>
                </div>
              ) : (
                filtered.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-white/[0.03] ${
                      activeId === c.id ? "bg-[#dc2626]/10 border-l-2 border-[#dc2626]" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[#f0f0f0] truncate leading-tight">
                        {c.member?.name ?? "Member"}
                      </p>
                      {c.adminUnreadCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-[#dc2626] flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#a0a0a0] truncate mt-0.5">{c.subject}</p>
                    {c.lastMessage && (
                      <p className="text-[11px] text-[#888] truncate mt-0.5">
                        {c.lastMessage.senderType === "admin" ? "You: " : ""}
                        {c.lastMessage.body}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-[#777]">
                        {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true })}
                      </p>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-widest font-rajdhani px-1.5 py-0.5 rounded ${
                          c.status === "open"
                            ? "text-[#dc2626] bg-[#dc2626]/10"
                            : "text-[#777] bg-[#222]"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Right pane ─────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0">
            {activeId && activeMeta ? (
              <>
                {/* Thread header */}
                <div className="px-5 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#f0f0f0] truncate">{activeConvo?.member?.name ?? "Member"}</p>
                    <p className="text-[11px] text-[#888] truncate">{activeMeta.subject}</p>
                  </div>
                  {activeMeta.status === "open" && (
                    <button
                      onClick={handleClose}
                      disabled={closeConvo.isPending}
                      className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest font-rajdhani text-[#888] hover:text-[#dc2626] disabled:opacity-40 transition-colors"
                    >
                      {closeConvo.isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                      Close Chat
                    </button>
                  )}
                  {activeMeta.status === "closed" && (
                    <span className="flex-shrink-0 text-[11px] font-bold uppercase tracking-widest font-rajdhani text-[#777]">
                      Closed
                    </span>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-[#0f0f0f]">
                  {messages.map((m: any) => (
                    <AdminBubble
                      key={m.id}
                      message={m}
                      messages={messages}
                      conversationId={activeId}
                      conversations={allConversations}
                      myAdminId={myAdminId}
                      onReply={handleReply}
                    />
                  ))}

                  {isTyping && (
                    <p className="text-xs text-[#888] pl-10 italic animate-pulse">
                      {typingName} is typing...
                    </p>
                  )}

                  {activeMeta.status === "closed" && (
                    <div className="flex items-center justify-center gap-2 py-3">
                      <AlertCircle size={13} className="text-[#777]" />
                      <p className="text-[11px] text-[#777] italic">This conversation is closed</p>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                {activeMeta.status === "open" ? (
                  <div className="border-t border-[#2a2a2a] bg-[#1a1a1a]">
                    {/* Reply strip */}
                    {replyTo && (
                      <div
                        className="flex items-center gap-2 px-4 pt-2.5 pb-1"
                        style={{ borderBottom: "1px solid #2a2a2a" }}
                      >
                        <Reply size={12} className="text-[#dc2626] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold text-[#dc2626]">
                            {replyTo.senderType === "admin" ? "You" : replyTo.senderName}
                          </span>
                          <span className="text-[10px] text-[#888] truncate block">
                            {replyTo.body || "📎 attachment"}
                          </span>
                        </div>
                        <button
                          onClick={() => setReplyTo(null)}
                          className="text-[#666] hover:text-[#a0a0a0] flex-shrink-0"
                          aria-label="Cancel reply"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-end gap-2 px-4 py-3">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        rows={1}
                        placeholder="Type a reply..."
                        className="flex-1 resize-none bg-transparent text-sm text-[#f0f0f0] outline-none placeholder:text-[#777] leading-relaxed"
                      />
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() || sendMessage.isPending}
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[#dc2626] hover:bg-red-700 disabled:opacity-40 transition-colors"
                      >
                        {sendMessage.isPending
                          ? <Loader2 size={13} className="animate-spin text-white" />
                          : <Send size={13} className="text-white" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 border-t border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-center">
                    <p className="text-[11px] text-[#777] font-rajdhani uppercase tracking-widest font-bold">
                      Conversation closed — read only
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-[#0f0f0f]">
                <MessageSquare size={36} className="mb-3 text-[#666]" />
                <p className="text-sm text-[#888]">Select a conversation to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

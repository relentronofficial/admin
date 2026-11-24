"use client";

// Admin — group chat viewer for one group: read the latest messages, post
// as an admin (text and/or an attachment, optionally as a reply), and act on
// a message from its hover menu (reply, copy, forward, pin, info, edit own
// message, raise a ticket, delete for everyone). Admin posts reach members exactly like a
// member's message (live socket event, unread count, push notification)
// and show under the admin's name.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Copy,
  CornerUpLeft,
  FileText,
  Forward,
  Info,
  Loader2,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Send,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";

import {
  useAdminDeleteGroupMessage,
  useAdminEditGroupMessage,
  useAdminForwardGroupMessage,
  useAdminGroupMessageInfo,
  useAdminListGroupMessages,
  useAdminListGroups,
  useAdminPinGroupMessage,
  useAdminRaiseTicketFromMessage,
  useAdminSendGroupMessage,
  useAdminUnpinGroupMessage,
  type AdminChatGroup,
  type AdminChatGroupMessage,
} from "@/lib/hooks/useChatGroups";
import { useUploadImage } from "@/lib/hooks/useAdmin";
import { FormattedText } from "@/components/chat/FormattedText";
import { handleFormatShortcut, stripFormatting } from "@/lib/utils/chatFormatting";

interface Props {
  group: AdminChatGroup;
  onClose: () => void;
}

type MediaKind = "image" | "video" | "audio" | "document";

function mediaKindOf(file: File): MediaKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

function senderNameOf(m: AdminChatGroupMessage): string {
  if (m.sender) return `${m.sender.firstName ?? ""} ${m.sender.lastName ?? ""}`.trim() || "Member";
  return m.senderAdminId ? "Admin" : "System";
}

function previewText(m: { body: string | null; mediaType: string | null; deletedForEveryone: boolean }): string {
  if (m.deletedForEveryone) return "message deleted";
  return stripFormatting(m.body) ?? (m.mediaType ? `[${m.mediaType}]` : "");
}

const EDIT_WINDOW_MS = 5 * 60 * 1000;

function canEdit(m: AdminChatGroupMessage): boolean {
  return (
    !!m.sentByMe &&
    !!m.body &&
    !m.mediaUrl &&
    !m.deletedForEveryone &&
    Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS
  );
}

function groupReactions(reactions: AdminChatGroupMessage["reactions"]) {
  const map = new Map<string, string[]>();
  for (const r of reactions ?? []) {
    const names = map.get(r.emoji) ?? [];
    names.push(r.memberName ?? "Member");
    map.set(r.emoji, names);
  }
  return [...map.entries()];
}

export function GroupMessagesModal({ group, onClose }: Props) {
  const { data: messages = [], isLoading } = useAdminListGroupMessages(group.id);
  const sendMessage = useAdminSendGroupMessage();
  const editMessage = useAdminEditGroupMessage();
  const upload = useUploadImage();
  const [ticketFor, setTicketFor] = useState<AdminChatGroupMessage | null>(null);
  const [forwardFor, setForwardFor] = useState<AdminChatGroupMessage | null>(null);
  const [infoFor, setInfoFor] = useState<AdminChatGroupMessage | null>(null);
  const [deleteFor, setDeleteFor] = useState<AdminChatGroupMessage | null>(null);
  const [editing, setEditing] = useState<AdminChatGroupMessage | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<AdminChatGroupMessage | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const lastMessageId = messages.length ? messages[messages.length - 1].id : null;

  // Keep the newest message in view as messages arrive.
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId]);

  const busy = sendMessage.isPending || upload.isPending || editMessage.isPending;
  const canSend = !busy && (text.trim().length > 0 || (!editing && !!file));

  function startReply(m: AdminChatGroupMessage) {
    setEditing(null);
    setReplyTo(m);
    textInput.current?.focus();
  }

  function startEdit(m: AdminChatGroupMessage) {
    setReplyTo(null);
    setFile(null);
    setEditing(m);
    setText(m.body ?? "");
    textInput.current?.focus();
  }

  function cancelEdit() {
    setEditing(null);
    setText("");
  }

  async function copyText(m: AdminChatGroupMessage) {
    try {
      await navigator.clipboard.writeText(m.body ?? m.mediaUrl ?? "");
      toast.success("Copied");
    } catch {
      toast.error("Could not copy.");
    }
  }

  async function send() {
    if (!canSend) return;
    try {
      if (editing) {
        await editMessage.mutateAsync({ groupId: group.id, messageId: editing.id, body: text.trim() });
        cancelEdit();
        return;
      }
      let media: { mediaUrl: string; mediaType: MediaKind } | null = null;
      if (file) {
        const { publicUrl } = await upload.mutateAsync({ file, pathPrefix: "chat" });
        if (!publicUrl) throw new Error("Upload failed");
        media = { mediaUrl: publicUrl, mediaType: mediaKindOf(file) };
      }
      await sendMessage.mutateAsync({
        groupId: group.id,
        body: text.trim() || undefined,
        ...(media ?? {}),
        replyToId: replyTo?.id,
      });
      setText("");
      setFile(null);
      setReplyTo(null);
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error?.message ?? err?.error?.message;
      toast.error(apiMsg ?? (editing ? "Could not edit the message." : "Could not send the message."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden bg-[#141414] border border-[#2a2a2a]">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#f0f0f0] uppercase tracking-widest font-rajdhani truncate">
              Messages
            </h3>
            <p className="text-xs text-[#606060] mt-0.5 truncate">{group.name}</p>
          </div>
          <button onClick={onClose} className="text-[#606060] hover:text-[#f0f0f0]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[200px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-14 text-[#606060] text-sm">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <div className="py-14 text-center text-[#606060] text-sm">No messages yet. Say hello below.</div>
          ) : (
            messages.map((m) => {
              const fromAdmin = !m.senderMemberId && !!m.senderAdminId;
              const actionable = !m.isSystem && !m.deletedForEveryone;
              const reactions = groupReactions(m.reactions);
              return (
                <div
                  key={m.id}
                  className={`group relative rounded-lg border p-3 flex items-start justify-between gap-3 ${
                    editing?.id === m.id
                      ? "border-[#dc2626] bg-[#dc2626]/10"
                      : fromAdmin
                        ? "border-[#dc2626]/30 bg-[#dc2626]/5"
                        : "border-[#2a2a2a] bg-[#181818]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#f0f0f0]">{senderNameOf(m)}</span>
                      {fromAdmin && (
                        <span className="text-[9px] font-bold uppercase tracking-widest font-rajdhani text-[#dc2626] border border-[#dc2626]/40 rounded px-1.5 py-px">
                          Admin
                        </span>
                      )}
                      <span className="text-[10px] text-[#606060]">
                        {format(new Date(m.createdAt), "d MMM yyyy, HH:mm")}
                      </span>
                      {m.editedAt && !m.deletedForEveryone && <span className="text-[10px] text-[#606060] italic">(edited)</span>}
                      {m.isPinned && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-[#facc15]" title="Pinned">
                          <Pin size={10} /> Pinned
                        </span>
                      )}
                    </div>
                    {m.replyTo && (
                      <div className="mt-1.5 border-l-2 border-[#444] pl-2 text-[11px] text-[#808080] line-clamp-2">
                        <span className="font-semibold text-[#a0a0a0]">{m.replyTo.senderName ?? "Someone"}: </span>
                        {previewText(m.replyTo)}
                      </div>
                    )}
                    {!m.deletedForEveryone && m.mediaUrl && (
                      m.mediaType === "image" ? (
                        <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="block mt-2">
                          <img src={m.mediaUrl} alt="" className="max-h-48 max-w-full rounded-md border border-[#2a2a2a] object-contain" />
                        </a>
                      ) : (
                        <a
                          href={m.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#a0a0a0] hover:text-white underline"
                        >
                          <FileText size={13} /> Open {m.mediaType ?? "attachment"}
                        </a>
                      )
                    )}
                    {(m.body || m.deletedForEveryone || !m.mediaUrl) && (
                      <p
                        className={`text-sm mt-1 whitespace-pre-wrap break-words ${
                          m.deletedForEveryone ? "italic text-[#606060]" : "text-[#a0a0a0]"
                        }`}
                      >
                        {m.deletedForEveryone ? "This message was deleted" : m.body ? <FormattedText text={m.body} /> : ""}
                      </p>
                    )}
                    {reactions.length > 0 && !m.deletedForEveryone && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {reactions.map(([emoji, names]) => (
                          <span
                            key={emoji}
                            title={names.join(", ")}
                            className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[11px] bg-[#222] border border-[#2a2a2a] text-[#a0a0a0]"
                          >
                            {emoji} {names.length > 1 ? names.length : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {actionable && (
                    <MessageMenu
                      message={m}
                      canEdit={canEdit(m)}
                      onReply={() => startReply(m)}
                      onCopy={() => void copyText(m)}
                      onForward={() => setForwardFor(m)}
                      onInfo={() => setInfoFor(m)}
                      onEdit={() => startEdit(m)}
                      onRaiseTicket={fromAdmin ? undefined : () => setTicketFor(m)}
                      onDelete={() => setDeleteFor(m)}
                      groupId={group.id}
                    />
                  )}
                </div>
              );
            })
          )}
          <div ref={listEnd} />
        </div>

        {/* Composer — posts as the signed-in admin */}
        <div className="border-t border-[#2a2a2a] bg-[#181818] p-3 space-y-2">
          {editing && (
            <div className="flex items-start justify-between gap-2 rounded-md bg-[#141414] border border-[#dc2626]/40 px-3 py-2">
              <div className="min-w-0 text-[11px] text-[#808080]">
                <span className="font-bold text-[#f0f0f0] inline-flex items-center gap-1">
                  <Pencil size={11} /> Editing message
                </span>
                <span className="line-clamp-1">{previewText(editing)}</span>
              </div>
              <button onClick={cancelEdit} className="text-[#606060] hover:text-white" aria-label="Cancel edit">
                <X size={14} />
              </button>
            </div>
          )}
          {replyTo && !editing && (
            <div className="flex items-start justify-between gap-2 rounded-md bg-[#141414] border border-[#2a2a2a] px-3 py-2">
              <div className="min-w-0 text-[11px] text-[#808080]">
                <span className="font-bold text-[#a0a0a0]">Replying to {senderNameOf(replyTo)}: </span>
                <span className="line-clamp-1">{previewText(replyTo)}</span>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-[#606060] hover:text-white" aria-label="Cancel reply">
                <X size={14} />
              </button>
            </div>
          )}
          {file && !editing && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-[#141414] border border-[#2a2a2a] px-3 py-2 text-xs text-[#a0a0a0]">
              <span className="truncate inline-flex items-center gap-1.5"><Paperclip size={12} /> {file.name}</span>
              <button onClick={() => setFile(null)} className="text-[#606060] hover:text-white" aria-label="Remove attachment">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > 100 * 1024 * 1024) toast.error("Files must be 100 MB or smaller.");
                else setFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy || !!editing}
              className="h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-lg border border-[#2a2a2a] text-[#a0a0a0] hover:text-white hover:bg-[#2a2a2a] disabled:opacity-50"
              aria-label="Attach a file"
              title="Attach a file"
            >
              <Paperclip size={16} />
            </button>
            <textarea
              ref={textInput}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (handleFormatShortcut(e, setText)) return;
                if (e.key === "Escape" && editing) {
                  e.preventDefault();
                  cancelEdit();
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              maxLength={5000}
              placeholder={editing ? "Edit your message…" : `Message ${group.name} as admin…`}
              title="Ctrl+B bold · Ctrl+I italic · Ctrl+U underline · Ctrl+Shift+X strikethrough"
              className="flex-1 min-w-0 max-h-32 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#dc2626] resize-none"
            />
            <button
              onClick={() => void send()}
              disabled={!canSend}
              className="h-11 px-4 flex-shrink-0 inline-flex items-center gap-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : editing ? <Check size={14} /> : <Send size={14} />}
              <span className="hidden sm:inline">{editing ? "Save" : "Send"}</span>
            </button>
          </div>
          <p className="text-[10px] text-[#606060]">
            {editing
              ? "Enter to save · Esc to cancel."
              : "Enter to send · Shift+Enter for a new line. Members are notified like any group message."}
          </p>
        </div>
      </div>

      {ticketFor && (
        <RaiseTicketDialog
          group={group}
          message={ticketFor}
          onClose={() => setTicketFor(null)}
        />
      )}
      {forwardFor && (
        <ForwardDialog group={group} message={forwardFor} onClose={() => setForwardFor(null)} />
      )}
      {infoFor && <MessageInfoDialog group={group} message={infoFor} onClose={() => setInfoFor(null)} />}
      {deleteFor && (
        <DeleteDialog
          group={group}
          message={deleteFor}
          onClose={() => setDeleteFor(null)}
          onDeleted={() => {
            if (editing?.id === deleteFor.id) cancelEdit();
            if (replyTo?.id === deleteFor.id) setReplyTo(null);
          }}
        />
      )}
    </div>
  );
}

// ── Hover menu ──────────────────────────────────────────────────────────────
// Same actions and order as the member site's group chat menu. Portalled with
// fixed positioning so the scrolling message list and the composer can't clip
// it; it opens upward when there isn't room below.

function MessageMenu({
  message,
  groupId,
  canEdit,
  onReply,
  onCopy,
  onForward,
  onInfo,
  onEdit,
  onRaiseTicket,
  onDelete,
}: {
  message: AdminChatGroupMessage;
  groupId: string;
  canEdit: boolean;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onInfo: () => void;
  onEdit: () => void;
  onRaiseTicket?: () => void;
  onDelete: () => void;
}) {
  const pin = useAdminPinGroupMessage();
  const unpin = useAdminUnpinGroupMessage();
  const trigger = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  function open() {
    const MENU_WIDTH = 184;
    const MENU_HEIGHT = 330;
    const GAP = 4;
    const SAFE = 8;
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - GAP - SAFE;
    const above = rect.top - GAP - SAFE;
    let top: number;
    let maxHeight: number;
    if (below >= MENU_HEIGHT || below >= above) {
      top = rect.bottom + GAP;
      maxHeight = Math.max(Math.min(below, MENU_HEIGHT), 120);
    } else {
      maxHeight = Math.max(Math.min(above, MENU_HEIGHT), 120);
      top = Math.max(SAFE, rect.top - GAP - maxHeight);
    }
    const left = Math.max(SAFE, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - SAFE));
    setPos({ top, left, maxHeight });
  }

  const close = () => setPos(null);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  function togglePin() {
    close();
    const vars = { id: groupId, messageId: message.id };
    const action = message.isPinned ? unpin : pin;
    action.mutate(vars, {
      onSuccess: () => toast.success(message.isPinned ? "Message unpinned" : "Message pinned"),
      onError: () => toast.error("Could not update the pin."),
    });
  }

  const item =
    "w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs text-[#d0d0d0] hover:bg-[#2a2a2a] hover:text-white";

  return (
    <>
      <button
        ref={trigger}
        onClick={() => (pos ? close() : open())}
        aria-label="Message options"
        aria-haspopup="menu"
        aria-expanded={!!pos}
        className={`flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-[#a0a0a0] hover:text-white hover:bg-[#2a2a2a] transition-opacity ${
          pos ? "opacity-100 bg-[#2a2a2a]" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
        }`}
      >
        <ChevronDown size={16} />
      </button>
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[200]" onClick={close} />
            <div
              role="menu"
              className="fixed z-[201] w-[184px] rounded-xl overflow-y-auto py-1 bg-[#1c1c1c] border border-[#333] shadow-2xl"
              style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
            >
              <button role="menuitem" className={item} onClick={run(onReply)}>
                <CornerUpLeft size={13} /> Reply
              </button>
              {(message.body || message.mediaUrl) && (
                <button role="menuitem" className={item} onClick={run(onCopy)}>
                  <Copy size={13} /> Copy
                </button>
              )}
              {(message.body || message.mediaUrl) && (
                <button role="menuitem" className={item} onClick={run(onForward)}>
                  <Forward size={13} /> Forward
                </button>
              )}
              <button role="menuitem" className={item} onClick={togglePin}>
                {message.isPinned ? <PinOff size={13} /> : <Pin size={13} />} {message.isPinned ? "Unpin" : "Pin"}
              </button>
              <button role="menuitem" className={item} onClick={run(onInfo)}>
                <Info size={13} /> Info
              </button>
              {canEdit && (
                <button role="menuitem" className={item} onClick={run(onEdit)}>
                  <Pencil size={13} /> Edit
                </button>
              )}
              {onRaiseTicket && (
                <button role="menuitem" className={item} onClick={run(onRaiseTicket)}>
                  <Ticket size={13} /> Raise ticket
                </button>
              )}
              <div className="my-1 border-t border-[#2a2a2a]" />
              <button role="menuitem" className={`${item} !text-[#f87171]`} onClick={run(onDelete)}>
                <Trash2 size={13} /> Delete for everyone
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

function ForwardDialog({
  group,
  message,
  onClose,
}: {
  group: AdminChatGroup;
  message: AdminChatGroupMessage;
  onClose: () => void;
}) {
  const { data: groups = [], isLoading } = useAdminListGroups();
  const forward = useAdminForwardGroupMessage();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const targets = groups
    .filter((g) => g.id !== group.id)
    .filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) return;
    try {
      const res = await forward.mutateAsync({ groupId: group.id, messageId: message.id, toGroupIds: [...selected] });
      toast.success(`Forwarded to ${res?.count ?? selected.size} group${(res?.count ?? selected.size) === 1 ? "" : "s"}.`);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Could not forward the message.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-xl overflow-hidden bg-[#141414] border border-[#2a2a2a]">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="text-sm font-bold text-[#f0f0f0] uppercase tracking-widest font-rajdhani">Forward to</h3>
          <button onClick={onClose} className="text-[#606060] hover:text-[#f0f0f0]" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="rounded-lg border-l-[3px] border-[#555] bg-[#1a1a1a] px-3 py-2 text-xs text-[#a0a0a0] line-clamp-2">
            {previewText(message)}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search groups…"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 px-3 text-sm text-white outline-none focus:border-[#dc2626]"
          />
          {isLoading ? (
            <div className="py-6 text-center text-xs text-[#606060]">Loading groups…</div>
          ) : targets.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#606060]">No other groups.</div>
          ) : (
            <div className="space-y-1">
              {targets.map((g) => (
                <label
                  key={g.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1a1a1a] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(g.id)}
                    onChange={() => toggle(g.id)}
                    className="accent-[#dc2626]"
                  />
                  <span className="flex-1 min-w-0 text-sm text-[#f0f0f0] truncate">{g.name}</span>
                  {typeof g.memberCount === "number" && (
                    <span className="text-[10px] text-[#606060]">{g.memberCount} members</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 p-4 border-t border-[#2a2a2a] bg-[#181818]">
          <span className="text-[11px] text-[#606060]">Members of each group are notified.</span>
          <button
            onClick={() => void submit()}
            disabled={selected.size === 0 || forward.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani disabled:opacity-50"
          >
            {forward.isPending ? <Loader2 size={14} className="animate-spin" /> : <Forward size={14} />}
            Forward{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageInfoDialog({
  group,
  message,
  onClose,
}: {
  group: AdminChatGroup;
  message: AdminChatGroupMessage;
  onClose: () => void;
}) {
  const { data, isLoading } = useAdminGroupMessageInfo(group.id, message.id);
  const readBy = data?.readBy ?? [];
  const notReadBy = data?.notReadBy ?? [];
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[80vh] flex flex-col rounded-xl overflow-hidden bg-[#141414] border border-[#2a2a2a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="text-sm font-bold text-[#f0f0f0] uppercase tracking-widest font-rajdhani">Message info</h3>
          <button onClick={onClose} className="text-[#606060] hover:text-[#f0f0f0]" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="text-[11px] text-[#808080]">
            Sent by <span className="text-[#f0f0f0] font-semibold">{senderNameOf(message)}</span> ·{" "}
            {format(new Date(message.createdAt), "d MMM yyyy, HH:mm")}
            {data?.editedAt && <> · Edited {format(new Date(data.editedAt), "d MMM, HH:mm")}</>}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
            Read by {isLoading ? "" : readBy.length}
          </div>
          {isLoading ? (
            <div className="py-4 text-center text-xs text-[#606060]">
              <Loader2 size={14} className="animate-spin inline mr-1" /> Loading…
            </div>
          ) : readBy.length === 0 ? (
            <div className="py-4 text-center text-xs text-[#606060]">No one has read this yet.</div>
          ) : (
            <ul className="space-y-2">
              {readBy.map((r) => (
                <li key={r.memberId} className="flex items-center gap-2.5">
                  {r.profilePhotoUrl ? (
                    <img src={r.profilePhotoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[11px] text-[#a0a0a0]">
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 min-w-0 text-sm text-[#f0f0f0] truncate">{r.name}</span>
                  <span className="text-[10px] text-[#606060]">{format(new Date(r.readAt), "d MMM, HH:mm")}</span>
                </li>
              ))}
            </ul>
          )}
          {notReadBy.length > 0 && (
            <>
              <div className="pt-2 text-[10px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
                Not seen yet {notReadBy.length}
              </div>
              <ul className="space-y-2">
                {notReadBy.map((r) => (
                  <li key={r.memberId} className="flex items-center gap-2.5">
                    {r.profilePhotoUrl ? (
                      <img src={r.profilePhotoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[11px] text-[#a0a0a0]">
                        {r.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 min-w-0 text-sm text-[#a0a0a0] truncate">{r.name}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteDialog({
  group,
  message,
  onClose,
  onDeleted,
}: {
  group: AdminChatGroup;
  message: AdminChatGroupMessage;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const del = useAdminDeleteGroupMessage();
  async function confirm() {
    try {
      await del.mutateAsync({ groupId: group.id, messageId: message.id });
      toast.success("Message deleted for everyone.");
      onDeleted();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Could not delete the message.");
    }
  }
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div role="alertdialog" className="w-full max-w-sm rounded-xl overflow-hidden bg-[#141414] border border-[#2a2a2a]">
        <div className="p-5 space-y-2">
          <h3 className="text-sm font-bold text-[#f0f0f0] uppercase tracking-widest font-rajdhani">Delete for everyone?</h3>
          <p className="text-xs text-[#a0a0a0]">
            This removes the message from {group.name} for every member. It can&apos;t be undone.
          </p>
          <div className="rounded-lg border-l-[3px] border-[#555] bg-[#1a1a1a] px-3 py-2 text-xs text-[#808080] line-clamp-2">
            {senderNameOf(message)}: {previewText(message)}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#2a2a2a] bg-[#181818]">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#a0a0a0] hover:text-[#f0f0f0]">
            Cancel
          </button>
          <button
            onClick={() => void confirm()}
            disabled={del.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani disabled:opacity-60"
          >
            {del.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function RaiseTicketDialog({
  group,
  message,
  onClose,
}: {
  group: AdminChatGroup;
  message: AdminChatGroupMessage;
  onClose: () => void;
}) {
  const raiseTicket = useAdminRaiseTicketFromMessage();
  const [subject, setSubject] = useState(`Message flagged in ${group.name}`);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  const senderName = message.sender
    ? `${message.sender.firstName ?? ""} ${message.sender.lastName ?? ""}`.trim() || "Member"
    : "Unknown sender";

  async function submit() {
    if (!subject.trim() || !description.trim()) {
      toast.error("Subject and description are required.");
      return;
    }
    try {
      await raiseTicket.mutateAsync({
        groupId: group.id,
        messageId: message.id,
        subject: subject.trim(),
        message: description.trim(),
        priority,
      });
      toast.success("Ticket raised.");
      onClose();
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error?.message;
      toast.error(apiMsg ?? "Could not raise ticket.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl overflow-hidden bg-[#141414] border border-[#2a2a2a]">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="text-sm font-bold text-[#f0f0f0] uppercase tracking-widest font-rajdhani">
            Raise Ticket
          </h3>
          <button onClick={onClose} className="text-[#606060] hover:text-[#f0f0f0]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg border border-[#2a2a2a] bg-[#181818] p-3">
            <div className="text-[10px] font-bold text-[#606060] uppercase tracking-widest font-rajdhani mb-1">
              Original message — {senderName}
            </div>
            <p className="text-xs text-[#a0a0a0] whitespace-pre-wrap break-words line-clamp-4">
              {message.body ? <FormattedText text={message.body} /> : message.mediaType ? `[${message.mediaType}]` : ""}
            </p>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
              Subject
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1.5 w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the issue with this message…"
              className="mt-1.5 w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
              Priority
            </label>
            <div className="mt-1.5 flex gap-2">
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest font-rajdhani border ${
                    priority === p
                      ? "bg-[#dc2626]/15 border-[#dc2626] text-[#dc2626]"
                      : "border-[#2a2a2a] text-[#a0a0a0] hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#2a2a2a] bg-[#181818]">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#a0a0a0] hover:text-[#f0f0f0]">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={raiseTicket.isPending}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani disabled:opacity-60"
          >
            {raiseTicket.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

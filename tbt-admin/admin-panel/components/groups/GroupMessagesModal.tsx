"use client";

// Admin — group chat viewer for one group: read the latest messages, post
// as an admin (text and/or an attachment, optionally as a reply) and raise a
// support ticket from a message. Admin posts reach members exactly like a
// member's message (live socket event, unread count, push notification)
// and show under the admin's name.

import { useEffect, useRef, useState } from "react";
import { CornerUpLeft, FileText, Loader2, Paperclip, Send, Ticket, X } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";

import {
  useAdminListGroupMessages,
  useAdminRaiseTicketFromMessage,
  useAdminSendGroupMessage,
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

export function GroupMessagesModal({ group, onClose }: Props) {
  const { data: messages = [], isLoading } = useAdminListGroupMessages(group.id);
  const sendMessage = useAdminSendGroupMessage();
  const upload = useUploadImage();
  const [ticketFor, setTicketFor] = useState<AdminChatGroupMessage | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<AdminChatGroupMessage | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const lastMessageId = messages.length ? messages[messages.length - 1].id : null;

  // Keep the newest message in view as messages arrive.
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId]);

  const busy = sendMessage.isPending || upload.isPending;
  const canSend = !busy && (text.trim().length > 0 || !!file);

  async function send() {
    if (!canSend) return;
    try {
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
      toast.error(apiMsg ?? "Could not send the message.");
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
              return (
                <div
                  key={m.id}
                  className={`rounded-lg border p-3 flex items-start justify-between gap-3 ${
                    fromAdmin ? "border-[#dc2626]/30 bg-[#dc2626]/5" : "border-[#2a2a2a] bg-[#181818]"
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
                      {m.editedAt && <span className="text-[10px] text-[#606060] italic">(edited)</span>}
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
                      <p className="text-sm text-[#a0a0a0] mt-1 whitespace-pre-wrap break-words">
                        {m.deletedForEveryone ? "message deleted" : m.body ? <FormattedText text={m.body} /> : ""}
                      </p>
                    )}
                  </div>
                  {!m.isSystem && !m.deletedForEveryone && (
                    <div className="flex-shrink-0 flex flex-col sm:flex-row gap-1.5">
                      <button
                        onClick={() => setReplyTo(m)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] hover:text-white hover:bg-[#2a2a2a] border border-[#2a2a2a]"
                      >
                        <CornerUpLeft size={12} /> Reply
                      </button>
                      {!fromAdmin && (
                        <button
                          onClick={() => setTicketFor(m)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] hover:text-white hover:bg-[#dc2626]/15 border border-[#2a2a2a] hover:border-[#dc2626]/40"
                        >
                          <Ticket size={12} /> Raise Ticket
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={listEnd} />
        </div>

        {/* Composer — posts as the signed-in admin */}
        <div className="border-t border-[#2a2a2a] bg-[#181818] p-3 space-y-2">
          {replyTo && (
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
          {file && (
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
              disabled={busy}
              className="h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-lg border border-[#2a2a2a] text-[#a0a0a0] hover:text-white hover:bg-[#2a2a2a] disabled:opacity-50"
              aria-label="Attach a file"
              title="Attach a file"
            >
              <Paperclip size={16} />
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (handleFormatShortcut(e, setText)) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              maxLength={5000}
              placeholder={`Message ${group.name} as admin…`}
              title="Ctrl+B bold · Ctrl+I italic · Ctrl+U underline · Ctrl+Shift+X strikethrough"
              className="flex-1 min-w-0 max-h-32 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#dc2626] resize-none"
            />
            <button
              onClick={() => void send()}
              disabled={!canSend}
              className="h-11 px-4 flex-shrink-0 inline-flex items-center gap-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <p className="text-[10px] text-[#606060]">Enter to send · Shift+Enter for a new line. Members are notified like any group message.</p>
        </div>
      </div>

      {ticketFor && (
        <RaiseTicketDialog
          group={group}
          message={ticketFor}
          onClose={() => setTicketFor(null)}
        />
      )}
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

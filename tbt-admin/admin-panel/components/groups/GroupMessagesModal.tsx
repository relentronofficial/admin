"use client";

// Admin — minimal read-only recent-messages viewer for a group, used to
// raise a support ticket from a specific message. Not a full chat viewer
// (no send/react/pin/media preview) — the admin panel has no live group
// chat UI today; this is the smallest surface that satisfies "Admin can
// view + raise a ticket from an accessible group-chat message."

import { useState } from "react";
import { Loader2, Send, Ticket, X } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";

import {
  useAdminListGroupMessages,
  useAdminRaiseTicketFromMessage,
  type AdminChatGroup,
  type AdminChatGroupMessage,
} from "@/lib/hooks/useChatGroups";

interface Props {
  group: AdminChatGroup;
  onClose: () => void;
}

export function GroupMessagesModal({ group, onClose }: Props) {
  const { data: messages = [], isLoading } = useAdminListGroupMessages(group.id);
  const [ticketFor, setTicketFor] = useState<AdminChatGroupMessage | null>(null);

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

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-14 text-[#606060] text-sm">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <div className="py-14 text-center text-[#606060] text-sm">No messages yet.</div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-[#2a2a2a] bg-[#181818] p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#f0f0f0]">
                      {m.sender
                        ? `${m.sender.firstName ?? ""} ${m.sender.lastName ?? ""}`.trim() || "Member"
                        : m.senderAdminId
                          ? "Admin"
                          : "System"}
                    </span>
                    <span className="text-[10px] text-[#606060]">
                      {format(new Date(m.createdAt), "d MMM yyyy, HH:mm")}
                    </span>
                    {m.editedAt && (
                      <span className="text-[10px] text-[#606060] italic">(edited)</span>
                    )}
                  </div>
                  <p className="text-sm text-[#a0a0a0] mt-1 whitespace-pre-wrap break-words">
                    {m.deletedForEveryone
                      ? "message deleted"
                      : m.body ?? (m.mediaType ? `[${m.mediaType}]` : "")}
                  </p>
                </div>
                {!m.isSystem && !m.deletedForEveryone && (
                  <button
                    onClick={() => setTicketFor(m)}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] hover:text-white hover:bg-[#dc2626]/15 border border-[#2a2a2a] hover:border-[#dc2626]/40"
                  >
                    <Ticket size={12} /> Raise Ticket
                  </button>
                )}
              </div>
            ))
          )}
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
              {message.body ?? (message.mediaType ? `[${message.mediaType}]` : "")}
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

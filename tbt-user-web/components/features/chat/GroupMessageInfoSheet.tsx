"use client";

import { Loader2, X } from "lucide-react";
import { useChatGroupMessageInfo } from "@/lib/hooks/useChatGroups";

// Group message info sheet (sent time + who has read it). Shared by the
// full group page and the group chat shown inside /messages.

export function GroupMessageInfoSheet({
  groupId,
  messageId,
  onClose,
}: {
  groupId: string;
  messageId: string;
  onClose: () => void;
}) {
  const { data: info, isLoading } = useChatGroupMessageInfo(groupId, messageId);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Message info"
        className="w-full max-w-md rounded-t-2xl p-5 space-y-4"
        style={{ background: "var(--color-modal-bg)", border: "1px solid var(--color-border-medium)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm text-foreground">Message info</p>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={16} className="animate-spin text-muted-foreground" />
          </div>
        ) : info ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
              <span className="text-muted-foreground">Sent</span>
              <span className="text-foreground font-medium">{fmt(info.sentAt)}</span>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pt-1">
              Read by {info.readByCount}
            </p>
            {info.readByCount === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">No one has read this message yet.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {info.readBy.map((r) => (
                  <div key={r.memberId} className="flex items-center justify-between py-1.5">
                    <span className="text-foreground text-xs">
                      {[r.firstName, r.lastName].filter(Boolean).join(" ") || "Member"}
                    </span>
                    <span className="text-muted-foreground text-[10px]">{fmt(r.readAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Could not load message info.</p>
        )}
      </div>
    </div>
  );
}

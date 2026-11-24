"use client";

import type { ReactNode } from "react";
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
          <div className="space-y-2 text-sm max-h-[60vh] overflow-y-auto overscroll-contain">
            <Row label="Sender" value={info.senderName} />
            <Row label="Sent" value={fmt(info.sentAt)} />
            {info.editedAt && <Row label="Edited" value={fmt(info.editedAt)} />}
            <SectionTitle>Read by {info.readByCount}</SectionTitle>
            {info.readBy.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">No one has read this message yet.</p>
            ) : (
              info.readBy.map((r) => <Person key={r.memberId} person={r} time={fmt(r.readAt)} />)
            )}
            {info.notReadBy.length > 0 && (
              <>
                <SectionTitle>Not seen yet {info.notReadByCount}</SectionTitle>
                {info.notReadBy.map((r) => <Person key={r.memberId} person={r} />)}
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Could not load message info.</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pt-2">{children}</p>;
}

function Person({ person, time }: { person: { name: string; profilePhotoUrl: string | null }; time?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      {person.profilePhotoUrl ? (
        <img src={person.profilePhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
      ) : (
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0"
          style={{ background: "var(--color-surface-overlay-md)" }}
        >
          {person.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="flex-1 min-w-0 truncate text-foreground text-sm">{person.name}</span>
      {time && <span className="text-muted-foreground text-[11px] flex-shrink-0">{time}</span>}
    </div>
  );
}

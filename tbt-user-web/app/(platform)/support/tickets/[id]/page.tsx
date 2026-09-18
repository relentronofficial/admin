"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Paperclip, Send } from "lucide-react";

import {
  usePostTicketReply,
  useTicketDetail,
  ticketDisplayId,
} from "@/lib/hooks/useSupport";
import type { SupportReply, SupportTicket, SupportTicketStatus } from "@/types";
import { SUPPORT_STATUS_MAP } from "@/lib/constants/supportStatus";
import { cn } from "@/lib/utils/cn";

// ── Status pill ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: SupportTicketStatus }) {
  const { color, label } = SUPPORT_STATUS_MAP[status] ?? SUPPORT_STATUS_MAP.new;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

// ── Activity timeline ───────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<string, string> = {
  created: "Ticket created",
  acknowledged: "Support team acknowledged your ticket",
  assigned: "Assigned to a team member",
  status_changed: "Status updated",
  priority_changed: "Priority updated",
  replied: "Support replied",
  escalated: "Escalated for faster attention",
  resolved: "Marked resolved",
  closed: "Ticket closed",
};

function ActivityTimeline({ activity }: { activity: SupportTicket["activityLog"] }) {
  if (!activity || activity.length === 0) return null;
  return (
    <div
      className="p-3 rounded-2xl flex flex-wrap gap-x-4 gap-y-2"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      {activity.map((a, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "var(--color-accent)" }}
          />
          {ACTIVITY_LABELS[a.action] ?? a.action}
          <span className="opacity-60">
            ·{" "}
            {new Date(a.createdAt).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Priority chip ───────────────────────────────────────────────────────────

function priorityColor(priority: string): string {
  if (priority === "urgent") return "#dc2626";
  if (priority === "high") return "#ef4444";
  if (priority === "low") return "#60a5fa";
  return "#facc15";
}

function MetaChip({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded text-[9.5px] font-bold tracking-wider"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

// ── Ticket header card ──────────────────────────────────────────────────────

function TicketHeaderCard({ ticket }: { ticket: SupportTicket }) {
  const created = new Date(ticket.createdAt).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div
      className="p-4 rounded-2xl"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <h2 className="text-sm font-bold text-foreground leading-snug">{ticket.subject}</h2>
      <div className="flex flex-wrap gap-2 mt-2.5">
        <MetaChip color={priorityColor(ticket.priority)} label={`${ticket.priority.toUpperCase()} PRIORITY`} />
        <MetaChip color="var(--color-text-secondary)" label={created} />
        {ticket.preferredContact && (
          <MetaChip color="#25D366" label={`REPLY VIA ${ticket.preferredContact.toUpperCase()}`} />
        )}
      </div>
    </div>
  );
}

// ── Chat bubbles ────────────────────────────────────────────────────────────

function ChatBubble({
  isMine,
  author,
  body,
  timestamp,
  attachments = [],
}: {
  isMine: boolean;
  author: string;
  body: string;
  timestamp: string;
  attachments?: string[];
}) {
  const time = new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const date = new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div
        className="max-w-[84%] px-3.5 py-3 rounded-2xl"
        style={{
          background: isMine
            ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
            : "var(--color-bg-surface)",
          border: `1px solid ${
            isMine
              ? "color-mix(in srgb, var(--color-accent) 35%, transparent)"
              : "var(--color-border-subtle)"
          }`,
          borderBottomLeftRadius: isMine ? undefined : 4,
          borderBottomRightRadius: isMine ? 4 : undefined,
        }}
      >
        <div
          className="text-[10px] font-bold tracking-wider"
          style={{ color: isMine ? "var(--color-accent)" : "var(--color-text-secondary)" }}
        >
          {author.toUpperCase()}
        </div>
        <p className="mt-1.5 text-sm text-foreground whitespace-pre-wrap leading-relaxed">{body}</p>
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {attachments.map((url, idx) => (
              <a
                key={`${url}-${idx}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px]"
                style={{
                  color: "var(--color-text-secondary)",
                  background: "var(--color-surface-overlay)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                <Paperclip size={11} />
                Attachment {idx + 1}
              </a>
            ))}
          </div>
        )}
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          {time} · {date}
        </div>
      </div>
    </div>
  );
}

// ── Compose bar ─────────────────────────────────────────────────────────────

function ComposeBar({
  disabled,
  sending,
  value,
  onChange,
  onSend,
}: {
  disabled: boolean;
  sending: boolean;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
}) {
  if (disabled) {
    return (
      <div
        className="p-4 text-center text-xs text-muted-foreground"
        style={{
          background: "var(--color-bg-surface)",
          borderTop: "1px solid var(--color-border-subtle)",
        }}
      >
        This ticket is closed — raise a new one to follow up.
      </div>
    );
  }
  return (
    <div
      className="p-3 flex items-end gap-2"
      style={{
        background: "var(--color-bg-surface)",
        borderTop: "1px solid var(--color-border-subtle)",
      }}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Reply to Support…"
        rows={1}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim().length > 0) onSend();
          }
        }}
        className="flex-1 px-4 py-2.5 rounded-full text-sm text-foreground outline-none resize-none max-h-32"
        style={{
          background: "var(--color-bg-primary)",
          border: "1px solid var(--color-border-subtle)",
        }}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={sending || value.trim().length === 0}
        className="w-11 h-11 rounded-full flex items-center justify-center text-white disabled:opacity-60"
        style={{ background: "var(--color-accent)" }}
        aria-label="Send"
      >
        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
      </button>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;
  const { data: ticket, isLoading, isError } = useTicketDetail(ticketId);
  const postReply = usePostTicketReply(ticketId);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom whenever new content lands.
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [ticket?.replies?.length, ticket?.id]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await postReply.mutateAsync(body);
      setDraft("");
    } catch {
      // Non-fatal — user can retry from the composer.
    } finally {
      setSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (isError || !ticket) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center text-sm text-muted-foreground">
        This ticket is no longer available.
        <div className="mt-3">
          <Link
            href="/support/tickets"
            className="inline-block px-4 py-2 rounded-xl text-xs font-bold text-foreground"
            style={{ border: "1px solid var(--color-border-subtle)" }}
          >
            Back to My Tickets
          </Link>
        </div>
      </div>
    );
  }

  const originalAttachments: string[] = [
    ...(ticket.attachmentUrls ?? []),
    ...(ticket.attachmentUrl && !(ticket.attachmentUrls ?? []).includes(ticket.attachmentUrl)
      ? [ticket.attachmentUrl]
      : []),
  ];
  const isClosed = ticket.status === "closed";

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <Link
          href="/support/tickets"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">
            {ticketDisplayId(ticket)}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {ticket.category?.name ?? "Support"}
          </div>
        </div>
        <StatusPill status={ticket.status} />
      </div>

      {/* Message stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl p-3 space-y-3 min-h-0"
        style={{
          background: "var(--color-bg-primary)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <TicketHeaderCard ticket={ticket} />
        <ActivityTimeline activity={ticket.activityLog} />
        <ChatBubble
          isMine
          author="You"
          body={ticket.message}
          timestamp={ticket.createdAt}
          attachments={originalAttachments}
        />
        {(ticket.replies ?? []).map((r: SupportReply) => (
          <ChatBubble
            key={r.id}
            isMine={!r.isFromAdmin}
            author={r.authorName || (r.isFromAdmin ? "Support" : "You")}
            body={r.body}
            timestamp={r.createdAt}
          />
        ))}
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 rounded-2xl overflow-hidden mt-2">
        <ComposeBar
          disabled={isClosed}
          sending={sending}
          value={draft}
          onChange={setDraft}
          onSend={handleSend}
        />
      </div>
    </div>
  );
}

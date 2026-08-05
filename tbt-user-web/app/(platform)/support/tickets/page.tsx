"use client";

import Link from "next/link";
import { ArrowLeft, Reply, Inbox } from "lucide-react";

import { useMyTickets, ticketDisplayId } from "@/lib/hooks/useSupport";
import type { SupportTicket, SupportTicketStatus } from "@/types";

const STATUS_MAP: Record<SupportTicketStatus, { color: string; label: string }> = {
  new: { color: "#60a5fa", label: "New" },
  in_progress: { color: "#facc15", label: "In Progress" },
  resolved: { color: "#4ade80", label: "Resolved" },
  closed: { color: "#a0a0a0", label: "Closed" },
};

function StatusBadge({ status }: { status: SupportTicketStatus }) {
  const { color, label } = STATUS_MAP[status] ?? STATUS_MAP.new;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const hasAdminReply = !!ticket.adminReply && ticket.adminReply.trim().length > 0;
  return (
    <Link
      href={`/support/tickets/${ticket.id}`}
      className="block p-4 rounded-2xl transition-colors hover:bg-[var(--color-surface-overlay)]"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">
            {ticketDisplayId(ticket)} · {ticket.subject}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {formatDateTime(ticket.createdAt)}
          </div>
        </div>
        <StatusBadge status={ticket.status} />
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed line-clamp-3">
        {ticket.message}
      </p>

      {hasAdminReply && (
        <div
          className="mt-3 p-2.5 rounded-lg"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 6%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <Reply size={11} style={{ color: "var(--color-accent)" }} />
            <span
              className="text-[9px] font-bold tracking-wider"
              style={{ color: "var(--color-accent)" }}
            >
              ADMIN REPLIED
            </span>
            {ticket.adminRepliedAt && (
              <span className="ml-auto text-[10px] text-muted-foreground">
                {formatDateTime(ticket.adminRepliedAt)}
              </span>
            )}
          </div>
          <p className="text-xs text-foreground mt-1.5 leading-relaxed line-clamp-3">
            {ticket.adminReply}
          </p>
        </div>
      )}
    </Link>
  );
}

export default function MyTicketsPage() {
  const { data: tickets = [], isLoading, isError } = useMyTickets();

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/support"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">My Tickets</h1>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-sm text-muted-foreground">Loading…</div>
      ) : isError ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Could not load tickets.
        </div>
      ) : tickets.length === 0 ? (
        <div
          className="p-8 rounded-2xl text-center"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <Inbox size={30} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            You haven&apos;t submitted any tickets yet.
          </p>
          <Link
            href="/support/new"
            className="inline-block mt-4 px-4 py-2 rounded-xl text-xs font-bold tracking-wider text-white"
            style={{ background: "var(--color-accent)" }}
          >
            RAISE A TICKET
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} />
          ))}
        </div>
      )}
    </div>
  );
}

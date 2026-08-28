"use client";

/**
 * Support / Help center — five-tab CRUD.
 *
 * Fills the existing sidebar "/support" link that pointed at a
 * non-existent page. Same monolith pattern as podcasts/ebooks — shared
 * Modal + form primitives, R2 presigned upload, slug auto-gen.
 *
 * Tabs:
 *   * Tickets     — inbound member submissions with status workflow
 *   * Feedback    — 1-5 star ratings + message
 *   * FAQs        — question / answer library
 *   * Categories  — taxonomy for FAQs + tickets
 *   * Settings    — singleton contact-channels form
 */

import React, { useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useHelpdeskDashboard,
  useListHelpdeskCategories,
  useCreateHelpdeskCategory,
  useUpdateHelpdeskCategory,
  useDeleteHelpdeskCategory,
  useListHelpdeskFaqs,
  useCreateHelpdeskFaq,
  useUpdateHelpdeskFaq,
  useDeleteHelpdeskFaq,
  useGetHelpdeskSettings,
  useUpdateHelpdeskSettings,
  useListHelpdeskTickets,
  useGetHelpdeskTicket,
  useUpdateTicketStatus,
  useReplyHelpdeskTicket,
  useDeleteHelpdeskTicket,
  useListHelpdeskFeedback,
  useUpdateFeedbackStatus,
  useDeleteHelpdeskFeedback,
  type HelpdeskCategory,
  type HelpdeskFaq,
  type HelpdeskTicket,
  type HelpdeskFeedback,
} from "@/lib/hooks/useHelpdesk";
import { useGetPresignedUrl } from "@/lib/hooks/useAdmin";
import { toast } from "react-hot-toast";
import {
  MessageSquare,
  Star,
  Book,
  Folder,
  Settings as SettingsIcon,
  Plus,
  X,
  Loader2,
  Edit2,
  Trash2,
  Upload,
  Search,
  Mail,
  Phone,
  MessageCircle,
} from "lucide-react";
import { format } from "date-fns";

const labelCls =
  "block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani";
const inputCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm";
const textareaCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] transition-all text-sm min-h-[90px]";

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function StatChip({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2">
      <div className="text-[9px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">
        {label}
      </div>
      <div className={"text-lg font-bold tracking-tight " + (accent ?? "text-white")}>{value}</div>
    </div>
  );
}

const STATUS_LABELS: Record<HelpdeskTicket["status"], string> = {
  new: "New",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const statusPill = (s: HelpdeskTicket["status"]) => {
  const map: Record<HelpdeskTicket["status"], string> = {
    new: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    in_progress: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    resolved: "text-green-400 bg-green-500/10 border-green-500/30",
    closed: "text-[#a0a0a0] bg-white/5 border-white/10",
  };
  return map[s];
};

type Tab = "tickets" | "feedback" | "faqs" | "categories" | "settings";

export default function SupportPage() {
  const [tab, setTab] = useState<Tab>("tickets");
  const [initialTicketId, setInitialTicketId] = useState<string | null>(null);
  const [initialFeedbackId, setInitialFeedbackId] = useState<string | null>(null);
  const { data: stats } = useHelpdeskDashboard();

  // Read ?tab= + ?id= injected by the topbar notification bell so a
  // click on a helpdesk_ticket / helpdesk_feedback notification lands
  // on the right tab with the row auto-selected. Clear the query
  // string afterwards so back-navigation doesn't re-fire.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    const idParam = params.get("id");
    if (tabParam === "tickets" || tabParam === "feedback") {
      setTab(tabParam as Tab);
      if (idParam) {
        if (tabParam === "tickets") setInitialTicketId(idParam);
        else setInitialFeedbackId(idParam);
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white font-rajdhani uppercase tracking-wider flex items-center gap-3">
              <MessageSquare className="text-[#dc2626]" size={24} /> Support Center
            </h1>
            <p className="text-[12px] text-[#888] mt-1">
              Manage help-center content and respond to member inquiries.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-5">
          <StatChip label="New" value={stats?.tickets.new ?? "—"} accent="text-blue-400" />
          <StatChip
            label="In Progress"
            value={stats?.tickets.inProgress ?? "—"}
            accent="text-yellow-400"
          />
          <StatChip label="Resolved" value={stats?.tickets.resolved ?? "—"} accent="text-green-400" />
          <StatChip label="Feedback" value={stats?.feedback.total ?? "—"} />
          <StatChip
            label="Avg Rating"
            value={stats?.feedback.averageRating != null ? stats.feedback.averageRating.toFixed(2) : "—"}
          />
          <StatChip label="FAQs" value={stats?.faqs ?? "—"} />
        </div>

        <div className="flex items-center gap-1 border-b border-[#2a2a2a] mb-5 overflow-x-auto">
          {(
            [
              { id: "tickets", label: "Tickets", icon: MessageSquare },
              { id: "feedback", label: "Feedback", icon: Star },
              { id: "faqs", label: "FAQs", icon: Book },
              { id: "categories", label: "Categories", icon: Folder },
              { id: "settings", label: "Settings", icon: SettingsIcon },
            ] as { id: Tab; label: string; icon: any }[]
          ).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "flex items-center gap-2 px-4 py-2.5 text-[12px] font-bold uppercase tracking-widest font-rajdhani border-b-2 transition-colors whitespace-nowrap " +
                  (active
                    ? "border-[#dc2626] text-white"
                    : "border-transparent text-[#888] hover:text-white")
                }
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "tickets" && <TicketsTab initialSelectedId={initialTicketId} />}
        {tab === "feedback" && <FeedbackTab initialSelectedId={initialFeedbackId} />}
        {tab === "faqs" && <FaqsTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </DashboardLayout>
  );
}

// ────────────────────────────────────────────────────────────────
// TICKETS
// ────────────────────────────────────────────────────────────────

function TicketsTab({ initialSelectedId }: { initialSelectedId?: string | null }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  React.useEffect(() => {
    if (initialSelectedId) setSelectedId(initialSelectedId);
  }, [initialSelectedId]);
  const { data, isLoading } = useListHelpdeskTickets({
    page,
    limit: 25,
    status: statusFilter,
    search,
  });

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search subject / name / email…"
              className={`${inputCls} pl-9`}
            />
          </div>
          <select
            className={inputCls + " w-40"}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1.5fr_120px_100px] px-4 py-3 border-b border-[#2a2a2a] text-[10px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">
            <span>Subject / Name</span>
            <span>Email</span>
            <span>Status</span>
            <span>Date</span>
          </div>
          {isLoading && (
            <div className="p-8 text-center text-[#666]">
              <Loader2 className="inline animate-spin" size={16} />
            </div>
          )}
          {!isLoading && rows.length === 0 && (
            <div className="p-8 text-center text-[#666] text-[12px]">No tickets found.</div>
          )}
          {rows.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={
                "grid grid-cols-[2fr_1.5fr_120px_100px] px-4 py-3 border-b border-[#2a2a2a]/50 last:border-b-0 items-center text-left w-full transition-colors " +
                (selectedId === t.id ? "bg-[#dc2626]/10" : "hover:bg-white/[0.02]")
              }
            >
              <div className="min-w-0">
                <div className="text-[13px] text-white font-medium truncate">{t.subject}</div>
                <div className="text-[11px] text-[#888] truncate">{t.name}</div>
              </div>
              <span className="text-[12px] text-[#a0a0a0] truncate">{t.email}</span>
              <span
                className={
                  "text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold w-fit border " +
                  statusPill(t.status)
                }
              >
                {STATUS_LABELS[t.status]}
              </span>
              <span className="text-[11px] text-[#666]">
                {format(new Date(t.createdAt), "d MMM")}
              </span>
            </button>
          ))}
          {totalPages > 1 && (
            <div className="border-t border-[#2a2a2a] px-4 py-2 flex items-center justify-between">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] disabled:opacity-40 hover:text-white"
              >
                ← Prev
              </button>
              <span className="text-[10px] text-[#666]">
                Page {page} of {totalPages} · {total} total
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] disabled:opacity-40 hover:text-white"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      <TicketDetailPanel ticketId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function TicketDetailPanel({
  ticketId,
  onClose,
}: {
  ticketId: string | null;
  onClose: () => void;
}) {
  const { data: ticket, isLoading } = useGetHelpdeskTicket(ticketId);
  const updateStatus = useUpdateTicketStatus();
  const postReply = useReplyHelpdeskTicket();
  const del = useDeleteHelpdeskTicket();
  const [notes, setNotes] = useState("");
  const [reply, setReply] = useState("");

  React.useEffect(() => {
    setNotes(ticket?.adminNotes ?? "");
    setReply(ticket?.adminReply ?? "");
  }, [ticket?.id, ticket?.adminNotes, ticket?.adminReply]);

  if (!ticketId) {
    return (
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-8 text-center text-[#666] text-[12px]">
        Select a ticket to view details.
      </div>
    );
  }
  if (isLoading || !ticket) {
    return (
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-8 text-center">
        <Loader2 className="inline animate-spin text-[#666]" size={16} />
      </div>
    );
  }

  const onStatusChange = async (status: HelpdeskTicket["status"]) => {
    try {
      await updateStatus.mutateAsync({ id: ticket.id, status, adminNotes: notes });
      toast.success("Status updated");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Update failed");
    }
  };

  const onSaveNotes = async () => {
    try {
      await updateStatus.mutateAsync({ id: ticket.id, status: ticket.status, adminNotes: notes });
      toast.success("Notes saved");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  const onSendReply = async () => {
    try {
      await postReply.mutateAsync({ id: ticket.id, reply });
      toast.success(reply.trim() ? "Reply sent" : "Reply cleared");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Reply failed");
    }
  };

  const onDelete = async () => {
    if (!confirm("Delete this ticket permanently?")) return;
    try {
      await del.mutateAsync(ticket.id);
      toast.success("Ticket deleted");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Delete failed");
    }
  };

  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-white truncate">{ticket.subject}</div>
          <div className="text-[11px] text-[#888]">
            {ticket.name} · {ticket.email}
            {ticket.phone && ` · ${ticket.phone}`}
          </div>
          <div className="text-[10px] text-[#666] mt-0.5">
            {format(new Date(ticket.createdAt), "d MMM yyyy, HH:mm")}
            {ticket.category && ` · ${ticket.category.name}`}
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-[#a0a0a0]">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {(ticket.chatGroupId || ticket.chatContext) && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-rajdhani">
                Raised from Group Chat
              </span>
              {ticket.raisedByAdminId && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[#a0a0a0] uppercase tracking-widest font-rajdhani">
                  Raised by admin
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#a0a0a0] space-y-1">
              <div>
                Group: <span className="text-[#f0f0f0]">{ticket.chatContext?.groupName ?? "—"}</span>
              </div>
              <div>
                Original sender:{" "}
                <span className="text-[#f0f0f0]">{ticket.chatContext?.senderName ?? "—"}</span>
              </div>
              {ticket.chatMessageSnapshot && (
                <div className="mt-2 rounded bg-black/30 border border-white/10 p-2">
                  <div className="text-[9px] font-bold text-[#666] uppercase tracking-widest font-rajdhani mb-1">
                    Original message
                  </div>
                  <div className="text-[12px] text-[#f0f0f0] whitespace-pre-wrap break-words">
                    {ticket.chatMessageSnapshot}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <div className="text-[10px] font-bold text-[#666] uppercase tracking-widest font-rajdhani mb-2">
            Message
          </div>
          <div className="text-[13px] text-[#f0f0f0] whitespace-pre-wrap leading-relaxed">
            {ticket.message}
          </div>
        </div>

        {ticket.attachmentUrl && (
          <div>
            <div className="text-[10px] font-bold text-[#666] uppercase tracking-widest font-rajdhani mb-2">
              Attachment
            </div>
            <a
              href={ticket.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-[#dc2626] hover:underline"
            >
              View attachment ↗
            </a>
          </div>
        )}

        <div>
          <label className={labelCls}>Status</label>
          <div className="flex flex-wrap gap-1.5">
            {(["new", "in_progress", "resolved", "closed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                disabled={updateStatus.isPending}
                className={
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest font-rajdhani border transition-colors " +
                  (ticket.status === s
                    ? statusPill(s) + " ring-2 ring-white/10"
                    : "border-[#2a2a2a] text-[#a0a0a0] hover:border-[#dc2626] hover:text-white")
                }
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>
            Reply to Member{ticket.adminRepliedAt && (
              <span className="ml-2 text-[9px] font-normal text-[#888] normal-case tracking-normal">
                sent {format(new Date(ticket.adminRepliedAt), "d MMM yyyy, HH:mm")}
              </span>
            )}
          </label>
          <textarea
            className={textareaCls}
            value={reply}
            placeholder="Type a reply the member will see in their My Tickets…"
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              onClick={onSendReply}
              disabled={postReply.isPending}
              className="px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40"
            >
              {postReply.isPending ? "Sending…" : ticket.adminReply ? "Update Reply" : "Send Reply"}
            </button>
          </div>
        </div>

        <div>
          <label className={labelCls}>Admin Notes (internal)</label>
          <textarea
            className={textareaCls}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              onClick={onDelete}
              className="text-[11px] font-bold uppercase tracking-widest font-rajdhani text-red-400 hover:text-red-300 px-3 py-1.5"
            >
              <Trash2 size={12} className="inline mr-1" /> Delete
            </button>
            <button
              onClick={onSaveNotes}
              disabled={updateStatus.isPending}
              className="px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40"
            >
              {updateStatus.isPending ? "Saving…" : "Save Notes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// FEEDBACK
// ────────────────────────────────────────────────────────────────

function FeedbackTab({ initialSelectedId }: { initialSelectedId?: string | null }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // FeedbackTab shows a flat list — highlight the row matching the
  // initialSelectedId (from a notification tap) so admins can find it.
  const highlightedId = initialSelectedId ?? null;
  const { data, isLoading } = useListHelpdeskFeedback({ page, limit: 25, status: statusFilter });
  const updateStatus = useUpdateFeedbackStatus();
  const del = useDeleteHelpdeskFeedback();

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  const onStatusChange = async (id: string, status: HelpdeskFeedback["status"]) => {
    try {
      await updateStatus.mutateAsync({ id, status });
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Update failed");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this feedback?")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Feedback deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Delete failed");
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <select
          className={inputCls + " w-48"}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading && (
          <div className="col-span-full p-8 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={16} />
          </div>
        )}
        {!isLoading && rows.length === 0 && (
          <div className="col-span-full p-8 text-center text-[#666] text-[12px]">
            No feedback yet.
          </div>
        )}
        {rows.map((f) => (
          <div
            key={f.id}
            className={
              "bg-[#181818] border rounded-xl p-4 " +
              (highlightedId === f.id
                ? "border-[#dc2626] ring-2 ring-[#dc2626]/30"
                : "border-[#2a2a2a]")
            }
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-white truncate">
                  {f.name ?? "Anonymous"}
                </div>
                <div className="text-[11px] text-[#888] truncate">
                  {f.email ?? "—"} · {format(new Date(f.createdAt), "d MMM yyyy")}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {f.rating !== null &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      className={
                        i < (f.rating ?? 0)
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-[#333]"
                      }
                    />
                  ))}
              </div>
            </div>
            <p className="text-[12px] text-[#f0f0f0] whitespace-pre-wrap leading-relaxed mb-3">
              {f.message}
            </p>
            <div className="flex items-center justify-between gap-2">
              <select
                value={f.status}
                onChange={(e) => onStatusChange(f.id, e.target.value as any)}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[10px] px-2 py-1 text-white font-bold uppercase tracking-widest font-rajdhani"
              >
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <button
                onClick={() => onDelete(f.id)}
                className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between px-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] disabled:opacity-40 hover:text-white"
          >
            ← Prev
          </button>
          <span className="text-[10px] text-[#666]">
            Page {page} of {totalPages} · {total} total
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] disabled:opacity-40 hover:text-white"
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// FAQs
// ────────────────────────────────────────────────────────────────

function FaqsTab() {
  const { data: rows, isLoading } = useListHelpdeskFaqs();
  const { data: cats } = useListHelpdeskCategories();
  const [editing, setEditing] = useState<HelpdeskFaq | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteHelpdeskFaq();

  const onDelete = async (id: string) => {
    if (!confirm("Delete this FAQ?")) return;
    try {
      await del.mutateAsync(id);
      toast.success("FAQ deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Delete failed");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#888]">{rows?.length ?? 0} FAQs</span>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg"
        >
          <Plus size={12} /> New FAQ
        </button>
      </div>

      <div className="space-y-2">
        {isLoading && (
          <div className="p-8 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={16} />
          </div>
        )}
        {!isLoading && (rows?.length ?? 0) === 0 && (
          <div className="p-8 text-center text-[#666] text-[12px]">No FAQs yet.</div>
        )}
        {rows?.map((f) => (
          <details
            key={f.id}
            className="bg-[#181818] border border-[#2a2a2a] rounded-lg group"
          >
            <summary className="px-4 py-3 cursor-pointer flex items-center gap-3 hover:bg-white/[0.02] list-none">
              <span className="flex-1 text-[13px] text-white font-medium">{f.question}</span>
              {f.category && (
                <span className="text-[10px] text-[#888] bg-white/5 rounded px-2 py-0.5">
                  {f.category.name}
                </span>
              )}
              <span
                className={
                  "text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold " +
                  (f.status === "active"
                    ? "bg-green-500/10 text-green-400"
                    : "bg-white/5 text-[#888]")
                }
              >
                {f.status}
              </span>
            </summary>
            <div className="px-4 pb-4 pt-1 border-t border-[#2a2a2a]/50">
              <p className="text-[12px] text-[#a0a0a0] whitespace-pre-wrap leading-relaxed mb-3">
                {f.answer}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(f)}
                  className="flex items-center gap-1 text-[10px] text-[#a0a0a0] hover:text-white px-2 py-1"
                >
                  <Edit2 size={11} /> Edit
                </button>
                <button
                  onClick={() => onDelete(f.id)}
                  className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 px-2 py-1"
                >
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>

      {(creating || editing) && (
        <FaqForm
          initial={editing ?? undefined}
          categories={cats ?? []}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function FaqForm({
  initial,
  categories,
  onClose,
}: {
  initial?: HelpdeskFaq;
  categories: HelpdeskCategory[];
  onClose: () => void;
}) {
  const create = useCreateHelpdeskFaq();
  const update = useUpdateHelpdeskFaq();
  const isEdit = !!initial;
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);

  const submit = async () => {
    if (!question.trim() || !answer.trim()) {
      toast.error("Question and answer required.");
      return;
    }
    const data = {
      question,
      answer,
      categoryId: categoryId || null,
      status,
      sortOrder,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: initial!.id, data });
        toast.success("FAQ updated");
      } else {
        await create.mutateAsync(data);
        toast.success("FAQ created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit FAQ" : "New FAQ"} wide>
      <label className={labelCls}>Question</label>
      <input className={inputCls} value={question} onChange={(e) => setQuestion(e.target.value)} />
      <div className="h-3" />
      <label className={labelCls}>Answer</label>
      <textarea className={textareaCls} value={answer} onChange={(e) => setAnswer(e.target.value)} />
      <div className="grid grid-cols-3 gap-3 mt-3">
        <div>
          <label className={labelCls}>Category</label>
          <select
            className={inputCls}
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Sort Order</label>
          <input
            type="number"
            className={inputCls}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <ModalActions
        onClose={onClose}
        onSubmit={submit}
        busy={create.isPending || update.isPending}
        isEdit={isEdit}
      />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────
// CATEGORIES
// ────────────────────────────────────────────────────────────────

function CategoriesTab() {
  const { data: rows, isLoading } = useListHelpdeskCategories();
  const [editing, setEditing] = useState<HelpdeskCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteHelpdeskCategory();

  const onDelete = async (id: string) => {
    if (!confirm("Delete this category? FAQs and tickets in it keep working but lose the label.")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Category deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Delete failed");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#888]">
          {rows?.length ?? 0} categor{(rows?.length ?? 0) === 1 ? "y" : "ies"}
        </span>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg"
        >
          <Plus size={12} /> New Category
        </button>
      </div>

      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_120px_80px_120px] px-4 py-3 border-b border-[#2a2a2a] text-[10px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">
          <span>Name</span>
          <span>Slug</span>
          <span>Status</span>
          <span>Sort</span>
          <span className="text-right">Actions</span>
        </div>
        {isLoading && (
          <div className="p-8 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={16} />
          </div>
        )}
        {!isLoading && (rows?.length ?? 0) === 0 && (
          <div className="p-8 text-center text-[#666] text-[12px]">No categories yet.</div>
        )}
        {rows?.map((c) => (
          <div
            key={c.id}
            className="grid grid-cols-[1fr_1fr_120px_80px_120px] px-4 py-3 border-b border-[#2a2a2a]/50 last:border-b-0 items-center hover:bg-white/[0.02]"
          >
            <span className="text-[13px] text-white font-medium">{c.name}</span>
            <span className="text-[12px] text-[#888] font-mono">{c.slug}</span>
            <span
              className={
                "text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold w-fit " +
                (c.status === "active"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-white/5 text-[#888]")
              }
            >
              {c.status}
            </span>
            <span className="text-[12px] text-[#888]">{c.sortOrder}</span>
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => setEditing(c)}
                className="p-1.5 rounded hover:bg-white/5 text-[#a0a0a0]"
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={() => onDelete(c.id)}
                className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <CategoryForm
          initial={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function CategoryForm({
  initial,
  onClose,
}: {
  initial?: HelpdeskCategory;
  onClose: () => void;
}) {
  const create = useCreateHelpdeskCategory();
  const update = useUpdateHelpdeskCategory();
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const slugTouchedRef = useRef(isEdit);

  const submit = async () => {
    if (!name.trim() || !slug.trim()) {
      toast.error("Name and slug required.");
      return;
    }
    try {
      if (isEdit) {
        await update.mutateAsync({
          id: initial!.id,
          data: { name, slug, description: description || null, status, sortOrder },
        });
        toast.success("Category updated");
      } else {
        await create.mutateAsync({
          name,
          slug,
          description: description || null,
          status,
          sortOrder,
        });
        toast.success("Category created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit Category" : "New Category"}>
      <label className={labelCls}>Name</label>
      <input
        className={inputCls}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugTouchedRef.current) setSlug(toSlug(e.target.value));
        }}
      />
      <div className="h-3" />
      <label className={labelCls}>Slug</label>
      <input
        className={inputCls}
        value={slug}
        onChange={(e) => {
          slugTouchedRef.current = true;
          setSlug(toSlug(e.target.value));
        }}
      />
      <div className="h-3" />
      <label className={labelCls}>Description</label>
      <textarea
        className={textareaCls}
        value={description ?? ""}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Sort Order</label>
          <input
            type="number"
            className={inputCls}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <ModalActions
        onClose={onClose}
        onSubmit={submit}
        busy={create.isPending || update.isPending}
        isEdit={isEdit}
      />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────
// SETTINGS
// ────────────────────────────────────────────────────────────────

function SettingsTab() {
  const { data: settings, isLoading } = useGetHelpdeskSettings();
  const update = useUpdateHelpdeskSettings();

  const [form, setForm] = useState<any>(null);
  const bannerUpload = useCoverUploader((url) => setForm((f: any) => ({ ...f, bannerImage: url })));

  React.useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  if (isLoading || !form) {
    return (
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-8 text-center">
        <Loader2 className="inline animate-spin text-[#666]" size={16} />
      </div>
    );
  }

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    try {
      await update.mutateAsync(form);
      toast.success("Settings saved");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Page Title</label>
          <input className={inputCls} value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Button Text</label>
          <input
            className={inputCls}
            value={form.buttonText ?? ""}
            onChange={(e) => set("buttonText", e.target.value)}
          />
        </div>
      </div>
      <div className="mt-4">
        <label className={labelCls}>Subtitle</label>
        <textarea
          className={textareaCls}
          value={form.subtitle ?? ""}
          onChange={(e) => set("subtitle", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div>
          <label className={labelCls}>
            <MessageCircle size={11} className="inline mr-1" /> WhatsApp
          </label>
          <input
            className={inputCls}
            value={form.whatsappNumber ?? ""}
            onChange={(e) => set("whatsappNumber", e.target.value)}
            placeholder="+91…"
          />
        </div>
        <div>
          <label className={labelCls}>
            <Phone size={11} className="inline mr-1" /> Phone
          </label>
          <input
            className={inputCls}
            value={form.phoneNumber ?? ""}
            onChange={(e) => set("phoneNumber", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>
            <Mail size={11} className="inline mr-1" /> Email
          </label>
          <input
            className={inputCls}
            value={form.email ?? ""}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label className={labelCls}>Website URL</label>
          <input
            className={inputCls}
            value={form.websiteUrl ?? ""}
            onChange={(e) => set("websiteUrl", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Support Timing</label>
          <input
            className={inputCls}
            value={form.supportTiming ?? ""}
            onChange={(e) => set("supportTiming", e.target.value)}
            placeholder="Mon–Fri, 10am–7pm"
          />
        </div>
      </div>
      <div className="mt-4">
        <label className={labelCls}>Address</label>
        <textarea
          className={textareaCls}
          value={form.address ?? ""}
          onChange={(e) => set("address", e.target.value)}
        />
      </div>
      <div className="mt-4">
        <label className={labelCls}>Banner Image</label>
        {form.bannerImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.bannerImage} alt="" className="w-full max-h-40 object-cover rounded mb-2" />
        )}
        {bannerUpload.render}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <label className={labelCls}>Status</label>
          <select
            className={inputCls}
            value={form.status ?? "active"}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={save}
          disabled={update.isPending}
          className="px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40 flex items-center gap-1.5"
        >
          {update.isPending && <Loader2 size={12} className="animate-spin" />} Save Settings
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────────

function Modal({
  onClose,
  title,
  children,
  wide,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-6 overflow-y-auto">
      <div
        className={
          "bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-2xl w-full " +
          (wide ? "max-w-2xl" : "max-w-md")
        }
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h3 className="text-[14px] font-bold uppercase tracking-widest font-rajdhani text-white">
            {title}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-[#a0a0a0]">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onClose,
  onSubmit,
  busy,
  isEdit,
}: {
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  isEdit: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[#2a2a2a]">
      <button
        onClick={onClose}
        disabled={busy}
        className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] hover:text-white disabled:opacity-40"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={busy}
        className="px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40 flex items-center gap-1.5"
      >
        {busy && <Loader2 size={12} className="animate-spin" />}
        {isEdit ? "Save" : "Create"}
      </button>
    </div>
  );
}

function useCoverUploader(onSet: (url: string) => void) {
  const [busy, setBusy] = useState(false);
  const presign = useGetPresignedUrl();
  const inputRef = useRef<HTMLInputElement>(null);
  const onFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      const { uploadUrl, publicUrl } = await presign.mutateAsync({
        filename: f.name,
        contentType: f.type,
        bucket: "site-assets",
        pathPrefix: "helpdesk",
      });
      await fetch(uploadUrl, {
        method: "PUT",
        body: f,
        headers: { "Content-Type": f.type },
      });
      onSet(publicUrl);
      toast.success("Uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return {
    render: (
      <label className="flex items-center gap-2 cursor-pointer bg-[#1a1a1a] border border-dashed border-[#2a2a2a] hover:border-[#dc2626] rounded-lg px-4 py-3 text-[12px] text-[#a0a0a0]">
        {busy ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
        <span>{busy ? "Uploading…" : "Upload image (JPG/PNG/WebP)"}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
    ),
  };
}

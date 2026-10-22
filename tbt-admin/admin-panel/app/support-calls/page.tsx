"use client";

// Expert Support Call sessions (SUPPORT_CALLS_SPECKIT.md). Admins/super admins
// manage every session; mentor accounts see and manage only the sessions they
// host (enforced by the backend — the UI just hides the host picker).
// Availability: the admin publishes the exact dates/times they are free
// (Assign Slots); each time is one bookable slot on the member calendar.
import { useMemo, useState } from "react";
import { PhoneCall, Plus, Loader2, X, Users, Edit2, Ban, Link2, CheckCircle2, UserX, Trash2, CalendarDays, List } from "lucide-react";
import { toast } from "react-hot-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useMe } from "@/lib/hooks/useAdmin";
import {
  useListSupportSessions,
  useCreateSupportSession,
  useUpdateSupportSession,
  useCancelSupportSession,
  useDeleteSupportSession,
  useSupportSessionBookings,
  useMarkSupportBooking,
  useSupportCallHosts,
  SUPPORT_CALLS_DEMO,
  type SupportCallCategory,
  type SupportSession,
  type SupportSessionInput,
} from "@/lib/hooks/useTbt";
import { cn } from "@/lib/utils";
import { SLOT_STATUS_BADGE, slotStatusLabel } from "@/lib/utils/supportSlots";
import {
  AvailabilityCalendar,
  CATEGORY_LABEL,
  PublishAvailabilityModal,
  SUPPORT_CALL_CATEGORIES as CATEGORIES,
  matchesCallType,
  type CallTypeFilter,
} from "@/components/support-calls/SlotAvailability";

const BOOKING_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  booked: { label: "Booked", color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  attended: { label: "Attended", color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  no_show: { label: "No-show", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  cancelled: { label: "Cancelled", color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
};

const LABEL = "block text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-2";
const INPUT =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white text-sm outline-none focus:border-[#dc2626]";

// Times are entered and shown in IST regardless of the admin's browser timezone.
const IST = "Asia/Kolkata";
function toIstInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function fromIstInput(v: string): string {
  return new Date(`${v}:00+05:30`).toISOString();
}
function fmtIst(iso: string): string {
  return `${new Date(iso).toLocaleString("en-IN", {
    timeZone: IST, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  })} IST`;
}

function SessionFormModal({
  initial,
  canPickHost,
  onClose,
}: {
  initial: SupportSession | null;
  canPickHost: boolean;
  onClose: () => void;
}) {
  const create = useCreateSupportSession();
  const update = useUpdateSupportSession();
  const { data: hosts = [] } = useSupportCallHosts(canPickHost);
  const [form, setForm] = useState({
    category: (initial?.category ?? "group_call") as SupportCallCategory,
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    hostAdminId: initial?.hostAdminId ?? "",
    hostName: initial?.hostName ?? "",
    startsAt: initial ? toIstInput(initial.startsAt) : "",
    durationMinutes: initial?.durationMinutes ?? 45,
    capacity: initial?.capacity ?? 1,
    meetingUrl: initial?.meetingUrl ?? "",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const busy = create.isPending || update.isPending;
  const isOneToOne = form.category === "one_to_one";
  // A booked slot never moves under its members: cancel and republish instead.
  const timeLocked = !!initial && initial.activeBookings > 0;

  const submit = async () => {
    if (busy) return;
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.startsAt) return toast.error("Start date and time are required");
    const data: SupportSessionInput = {
      category: form.category,
      title: form.title.trim(),
      description: form.description.trim() || null,
      hostName: form.hostName.trim() || null,
      // Only send the time when it changed, so other edits never touch it.
      ...(!initial || form.startsAt !== toIstInput(initial.startsAt) ? { startsAt: fromIstInput(form.startsAt) } : {}),
      ...(!initial || Number(form.durationMinutes) !== initial.durationMinutes ? { durationMinutes: Number(form.durationMinutes) } : {}),
      capacity: isOneToOne ? 1 : Number(form.capacity),
      meetingUrl: form.meetingUrl.trim() || null,
      ...(canPickHost ? { hostAdminId: form.hostAdminId || null } : {}),
    };
    try {
      if (initial) await update.mutateAsync({ id: initial.id, data });
      else await create.mutateAsync(data);
      toast.success(initial ? "Session updated" : "Session published");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Could not save the session");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#141414] border border-[#2a2a2a] rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
          <h2 className="font-rajdhani text-lg font-bold uppercase tracking-wide text-[#f0f0f0]">
            {initial ? "Edit Session" : "New Support Session"}
          </h2>
          <button onClick={onClose} className="text-[#606060] hover:text-white" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={LABEL}>Category</label>
            <select
              className={INPUT}
              value={form.category}
              disabled={!!initial && initial.activeBookings > 0}
              onChange={(e) => {
                const c = e.target.value as SupportCallCategory;
                setForm((f) => ({ ...f, category: c, capacity: c === "one_to_one" ? 1 : f.capacity }));
              }}
            >
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
            {!!initial && initial.activeBookings > 0 && (
              <p className="text-[11px] text-[#606060] mt-1">Category is locked once members have booked.</p>
            )}
          </div>
          <div>
            <label className={LABEL}>Title</label>
            <input className={INPUT} value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <textarea
              className={cn(INPUT, "h-24 py-3 resize-none")}
              value={form.description}
              maxLength={2000}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {canPickHost && (
              <div>
                <label className={LABEL}>Host account</label>
                <select className={INPUT} value={form.hostAdminId} onChange={(e) => set("hostAdminId", e.target.value)}>
                  <option value="">— None —</option>
                  {hosts.map((h) => (
                    <option key={h.id} value={h.id}>{h.fullName} ({h.role.replace(/_/g, " ")})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={LABEL}>Host name shown to members</label>
              <input
                className={INPUT}
                value={form.hostName}
                maxLength={120}
                placeholder={canPickHost ? "Defaults to the host account" : "Defaults to your name"}
                onChange={(e) => set("hostName", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className={LABEL}>Starts (IST)</label>
              <input type="datetime-local" className={INPUT} value={form.startsAt} disabled={timeLocked}
                onChange={(e) => set("startsAt", e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Duration (min)</label>
              <input type="number" min={5} max={480} className={INPUT} value={form.durationMinutes} disabled={timeLocked}
                onChange={(e) => set("durationMinutes", Number(e.target.value))} />
            </div>
            <div>
              <label className={LABEL}>Seats</label>
              <input type="number" min={1} max={500} className={INPUT} value={isOneToOne ? 1 : form.capacity}
                disabled={isOneToOne} onChange={(e) => set("capacity", Number(e.target.value))} />
            </div>
          </div>
          {timeLocked && (
            <p className="text-[11px] text-[#f59e0b] -mt-2">
              Members have booked this slot, so its time and length are locked. To reschedule, cancel the slot (booked members are notified and get their call back) and publish a new time.
            </p>
          )}
          <div>
            <label className={LABEL}>Meeting link (private)</label>
            <input className={INPUT} value={form.meetingUrl} placeholder="https://…" onChange={(e) => set("meetingUrl", e.target.value)} />
            <p className="text-[11px] text-[#606060] mt-1">
              Only booked members can open it, from 10 minutes before the start until the call ends.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#1f1f1f]">
          <button onClick={onClose} className="px-5 py-2.5 text-[13px] font-bold uppercase tracking-wider text-[#888] hover:text-white">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="bg-[#dc2626] hover:bg-red-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-[13px] font-bold uppercase tracking-wider flex items-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {initial ? "Save" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingsModal({ session, onClose }: { session: SupportSession; onClose: () => void }) {
  const { data: bookings = [], isLoading, isError, refetch } = useSupportSessionBookings(session.id);
  const mark = useMarkSupportBooking();
  const started = new Date(session.startsAt).getTime() <= Date.now();

  const doMark = async (id: string, status: "attended" | "no_show") => {
    try {
      await mark.mutateAsync({ id, status });
      toast.success(status === "attended" ? "Marked attended" : "Marked no-show");
    } catch (err: any) {
      toast.error(err?.message || "Could not update the booking");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#141414] border border-[#2a2a2a] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[#1f1f1f]">
          <div>
            <h2 className="font-rajdhani text-lg font-bold uppercase tracking-wide text-[#f0f0f0]">{session.title}</h2>
            <p className="text-[12px] text-[#888]">{CATEGORY_LABEL[session.category]} · {fmtIst(session.startsAt)}</p>
          </div>
          <button onClick={onClose} className="text-[#606060] hover:text-white" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-3">
          {!started && (
            <p className="text-[12px] text-[#888]">Attendance can be marked once the call has started. Attended and no-show both use one of the member&apos;s calls.</p>
          )}
          {isLoading ? (
            <div className="flex items-center gap-2 text-[#888] text-sm py-6 justify-center"><Loader2 size={16} className="animate-spin" /> Loading bookings…</div>
          ) : isError ? (
            <div className="text-sm text-[#ef4444] py-6 text-center">
              Could not load bookings. <button className="underline" onClick={() => refetch()}>Retry</button>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-sm text-[#606060] py-6 text-center">No bookings yet.</div>
          ) : (
            bookings.map((b) => {
              const badge = BOOKING_BADGE[b.status] ?? BOOKING_BADGE.booked;
              return (
                <div key={b.id} className="flex items-center justify-between gap-3 flex-wrap bg-[#181818] border border-[#2a2a2a] rounded-lg px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#f0f0f0] truncate">{b.memberName || "Member"}</div>
                    <div className="text-[11px] text-[#888]">{[b.phone, b.email].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.coinCost != null && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-[#eab308] bg-[rgba(234,179,8,0.15)]">
                        {b.coinCost} coins{b.status === "cancelled" ? " · refunded" : ""}
                      </span>
                    )}
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: badge.color, background: badge.bg }}>
                      {badge.label}
                    </span>
                    {b.status === "booked" && started && (
                      <>
                        <button
                          disabled={mark.isPending}
                          onClick={() => doMark(b.id, "attended")}
                          className="flex items-center gap-1 text-[11px] font-bold uppercase px-2.5 py-1.5 rounded-md bg-[#22c55e]/15 text-[#22c55e] hover:bg-[#22c55e]/25 disabled:opacity-50"
                        >
                          <CheckCircle2 size={13} /> Attended
                        </button>
                        <button
                          disabled={mark.isPending}
                          onClick={() => doMark(b.id, "no_show")}
                          className="flex items-center gap-1 text-[11px] font-bold uppercase px-2.5 py-1.5 rounded-md bg-[#f59e0b]/15 text-[#f59e0b] hover:bg-[#f59e0b]/25 disabled:opacity-50"
                        >
                          <UserX size={13} /> No-show
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function SupportCallsPage() {
  const { data: me } = useMe();
  const canPickHost = me?.role === "admin" || me?.role === "super_admin";
  const [category, setCategory] = useState<string>("");
  const [scope, setScope] = useState<"upcoming" | "past" | "all">("upcoming");
  const [callType, setCallType] = useState<CallTypeFilter>("all");
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [editing, setEditing] = useState<SupportSession | null | "new">(null);
  const [viewing, setViewing] = useState<SupportSession | null>(null);
  // null = closed; "" = open with today; a date = open on that IST date.
  const [publishDate, setPublishDate] = useState<string | null>(null);
  const params = useMemo(() => ({ ...(category ? { category } : {}), scope }), [category, scope]);
  const { data: sessions = [], isLoading, isError, error, refetch } = useListSupportSessions(params);
  const cancel = useCancelSupportSession();
  const remove = useDeleteSupportSession();
  const filteredSessions = useMemo(() => sessions.filter((s) => matchesCallType(s, callType)), [sessions, callType]);

  const doDelete = async (s: SupportSession) => {
    if (!window.confirm(`Remove the ${fmtIst(s.startsAt)} slot? Nobody has booked it, so it is deleted.`)) return;
    try {
      await remove.mutateAsync(s.id);
      toast.success("Slot removed");
    } catch (err: any) {
      toast.error(err?.message || "Could not remove the slot");
    }
  };

  const doCancel = async (s: SupportSession) => {
    const msg = s.activeBookings > 0
      ? `Cancel "${s.title}"? ${s.pendingAttendance} booked member(s) will be notified and get the call back.`
      : `Cancel "${s.title}"?`;
    if (!window.confirm(msg)) return;
    try {
      const r = await cancel.mutateAsync(s.id);
      toast.success(r?.cancelledBookings ? `Session cancelled · ${r.cancelledBookings} member(s) notified` : "Session cancelled");
    } catch (err: any) {
      toast.error(err?.message || "Could not cancel the session");
    }
  };

  const forbidden = (error as any)?.response?.status === 403;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase flex items-center gap-2">
                <PhoneCall size={20} /> Support Calls
              </h1>
              <p className="text-[12px] text-[#888] font-medium uppercase tracking-[1px] font-rajdhani">
                Publish the dates and times you are available. Members book them from their calendar.
              </p>
            </div>
          </div>
          {!forbidden && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setEditing("new")}
                className="bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#333] text-white px-4 py-2.5 rounded-lg text-[13px] font-bold uppercase tracking-wider flex items-center gap-2"
              >
                <Plus size={15} /> New Session
              </button>
              <button
                onClick={() => setPublishDate("")}
                className="bg-[#dc2626] hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-[13px] font-bold uppercase tracking-wider flex items-center gap-2"
              >
                <CalendarDays size={15} /> Assign Slots
              </button>
            </div>
          )}
        </div>

        {SUPPORT_CALLS_DEMO && (
          <div className="rounded-lg border border-[rgba(234,179,8,0.35)] bg-[rgba(234,179,8,0.08)] px-4 py-2.5 text-[12px] text-[#eab308]">
            Showing sample data (NEXT_PUBLIC_SUPPORT_CALLS_DEMO=1). Names and contacts are fictional and nothing is saved.
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1 bg-[#141414] border border-[#1f1f1f] rounded-xl p-1" role="tablist" aria-label="View">
            {([["calendar", CalendarDays, "Calendar"], ["list", List, "List"]] as const).map(([id, Icon, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all flex items-center gap-1.5",
                  view === id ? "bg-[#dc2626] text-white" : "text-[#606060] hover:text-[#a0a0a0] hover:bg-[#1f1f1f]",
                )}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          {view === "list" && (
          <div className="flex gap-1 bg-[#141414] border border-[#1f1f1f] rounded-xl p-1">
            {(["upcoming", "past", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={cn(
                  "px-4 py-2 rounded-lg text-[13px] font-semibold capitalize transition-all",
                  scope === s ? "bg-[#dc2626] text-white" : "text-[#606060] hover:text-[#a0a0a0] hover:bg-[#1f1f1f]",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          )}
          <select className={cn(INPUT, "w-auto h-10")} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
          <select className={cn(INPUT, "w-auto h-10")} value={callType} onChange={(e) => setCallType(e.target.value as typeof callType)}>
            <option value="all">All call types</option>
            <option value="one_to_one">1:1 only</option>
            <option value="group">Group only</option>
          </select>
        </div>

        {forbidden ? (
          <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-10 text-center text-sm text-[#888]">
            Support call sessions are available to Admin, Super Admin and Mentor accounts.
          </div>
        ) : view === "calendar" ? (
          <AvailabilityCalendar
            category={category}
            callType={callType}
            onPublishForDate={(d) => setPublishDate(d)}
            onEdit={(s) => setEditing(s)}
            onViewBookings={(s) => setViewing(s)}
            onCancel={doCancel}
            onDelete={doDelete}
            busy={cancel.isPending || remove.isPending}
          />
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 text-[#888] text-sm py-16"><Loader2 size={18} className="animate-spin" /> Loading sessions…</div>
        ) : isError ? (
          <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-10 text-center text-sm text-[#ef4444]">
            Could not load sessions. <button className="underline" onClick={() => refetch()}>Retry</button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-10 text-center text-sm text-[#606060]">
            No {scope === "all" ? "" : scope} sessions{category ? ` for ${CATEGORY_LABEL[category]}` : ""}{callType !== "all" ? ` (${callType === "one_to_one" ? "1:1" : "group"} filter active)` : ""}.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((s) => {
              const cancelled = s.status === "cancelled";
              const upcoming = new Date(s.startsAt).getTime() > Date.now();
              const isOneToOne = s.capacity === 1;
              return (
                <div key={s.id} className={cn("bg-[#181818] border border-[#2a2a2a] rounded-xl p-5", cancelled && "opacity-60")}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#1f1f1f] text-[#a0a0a0]">{CATEGORY_LABEL[s.category]}</span>
                        {isOneToOne && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: "#818cf8", background: "rgba(129,140,248,0.15)" }}>1:1</span>
                        )}
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: SLOT_STATUS_BADGE[s.slotStatus]?.color, background: SLOT_STATUS_BADGE[s.slotStatus]?.bg }}
                        >
                          {slotStatusLabel(s)}
                        </span>
                        {!s.hasMeetingUrl && !cancelled && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: "#f59e0b", background: "rgba(245,158,11,0.15)" }}>No meeting link</span>
                        )}
                      </div>
                      <h3 className="text-[15px] font-semibold text-[#f0f0f0]">{s.title}</h3>
                      <p className="text-[12px] text-[#888]">
                        {fmtIst(s.startsAt)} · {s.durationMinutes} min{s.hostName ? ` · Host: ${s.hostName}` : ""}
                      </p>
                      {s.description && <p className="text-[12px] text-[#a0a0a0] line-clamp-2">{s.description}</p>}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-bold text-[#f0f0f0]">{s.activeBookings}/{s.capacity}</div>
                        <div className="text-[10px] uppercase tracking-widest text-[#606060] font-rajdhani">booked</div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <button onClick={() => setViewing(s)} className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#a0a0a0] hover:text-white">
                          <Users size={13} /> Bookings
                        </button>
                        {!cancelled && upcoming && (
                          <button onClick={() => setEditing(s)} className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#a0a0a0] hover:text-white">
                            <Edit2 size={13} /> Edit
                          </button>
                        )}
                        {!cancelled && s.slotStatus !== "completed" && (
                          <button onClick={() => doCancel(s)} disabled={cancel.isPending} className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#ef4444] hover:text-red-400 disabled:opacity-50">
                            <Ban size={13} /> Cancel
                          </button>
                        )}
                        {s.canDelete && (
                          <button onClick={() => doDelete(s)} disabled={remove.isPending} className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#ef4444] hover:text-red-400 disabled:opacity-50">
                            <Trash2 size={13} /> Remove
                          </button>
                        )}
                        {s.meetingUrl && (
                          <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#a0a0a0] hover:text-white">
                            <Link2 size={13} /> Link
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <SessionFormModal
          initial={editing === "new" ? null : editing}
          canPickHost={canPickHost}
          onClose={() => setEditing(null)}
        />
      )}
      {viewing && <BookingsModal session={viewing} onClose={() => setViewing(null)} />}
      {publishDate !== null && (
        <PublishAvailabilityModal
          initialDate={publishDate || null}
          canPickHost={canPickHost}
          onClose={() => setPublishDate(null)}
        />
      )}
    </DashboardLayout>
  );
}

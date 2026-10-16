"use client";

// Category booking panel for the Expert Support Calls tiles (SUPPORT_CALLS_SPECKIT.md).
// Slot-booking flow: pick a date (IST) → pick a time slot → confirm. Slots are the
// real sessions published by the TBT team (GET /api/user/support-calls); the server
// re-checks availability, seats, quota and duplicates when a booking is confirmed,
// and controls cancellation cutoffs and the join window. Nothing is generated here.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Users, Video, Check, ChevronLeft, ChevronRight, CalendarDays, Clock } from "lucide-react";
import { toast } from "react-hot-toast";
import { getServerNow } from "@/lib/api/client";
import {
  useBookSupportCall,
  useCancelSupportCallBooking,
  useJoinSupportCall,
  useSupportCalls,
} from "@/lib/hooks/useSupportCalls";
import type {
  SupportCallCategory,
  SupportCallHistoryItem,
  SupportCallSession,
} from "@/lib/api/services/supportCalls.service";
import {
  datesWithOpenSlots,
  dayState,
  formatDateLong,
  formatMonth,
  formatSlotRange,
  groupByDate,
  istDateKey,
  monthGrid,
  monthOf,
  shiftMonth,
  slotState,
  type SlotState,
} from "@/lib/supportCallSlots";

// Same dark palette as the Expert Support Calls tiles.
const SURFACE = "#1a1a1d";
const CARD = "#242428";
const CHIP = "#202024";
const TEXT = "#f5f5f7";
const MUTED = "#93939b";
const SOFT = "#d0cfd4";
const BLUE = "#809ed5";
const RED = "#ff313b";
const GREEN = "#22c55e";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const HISTORY_LABEL: Record<SupportCallHistoryItem["status"], { label: string; color: string }> = {
  booked: { label: "Booked", color: BLUE },
  attended: { label: "Completed", color: GREEN },
  no_show: { label: "Missed", color: "#f59e0b" },
  cancelled: { label: "Cancelled", color: MUTED },
  session_cancelled: { label: "Cancelled by TBT", color: MUTED },
};

const SLOT_LABEL: Record<SlotState, string> = {
  available: "Available",
  mine: "Booked by you",
  full: "Full",
  started: "Started",
  blocked: "Unavailable",
};

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
}

/** Server-synced clock, refreshed every 30 s so slot states roll over without a reload. */
function useServerNow() {
  const [now, setNow] = useState(() => getServerNow());
  useEffect(() => {
    const id = window.setInterval(() => setNow(getServerNow()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold inline-flex items-center gap-1.5" style={{ color: SOFT }}>
      {icon}
      {children}
    </h3>
  );
}

function BookingCalendar({
  byDate,
  nowMs,
  member,
  selectedKey,
  onSelect,
  lastOpenKey,
}: {
  byDate: Map<string, SupportCallSession[]>;
  nowMs: number;
  member: { notIncluded: boolean; canBookMore: boolean };
  selectedKey: string | null;
  onSelect: (key: string) => void;
  lastOpenKey: string | null;
}) {
  const todayKey = istDateKey(nowMs);
  const start = monthOf(selectedKey ?? todayKey);
  const [view, setView] = useState(start);
  // Follow the selection when it jumps to another month (e.g. auto-select).
  useEffect(() => {
    if (selectedKey) setView(monthOf(selectedKey));
  }, [selectedKey]);

  const today = monthOf(todayKey);
  const last = monthOf(lastOpenKey ?? todayKey);
  const atFirst = view.year === today.year && view.monthIndex === today.monthIndex;
  const atLast = view.year > last.year || (view.year === last.year && view.monthIndex >= last.monthIndex);
  const cells = monthGrid(view.year, view.monthIndex);

  return (
    <div className="rounded-[10px] p-3" style={{ background: CARD }}>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setView(shiftMonth(view.year, view.monthIndex, -1))}
          disabled={atFirst}
          aria-label="Previous month"
          className="p-1 rounded-md disabled:opacity-30"
          style={{ background: CHIP, color: SOFT }}
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-semibold" style={{ color: TEXT }} aria-live="polite">
          {formatMonth(view.year, view.monthIndex)}
        </span>
        <button
          type="button"
          onClick={() => setView(shiftMonth(view.year, view.monthIndex, 1))}
          disabled={atLast}
          aria-label="Next month"
          className="p-1 rounded-md disabled:opacity-30"
          style={{ background: CHIP, color: SOFT }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Choose a date">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-[10px] font-semibold py-1" style={{ color: MUTED }} aria-hidden="true">
            {w}
          </span>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <span key={`b${i}`} />;
          const state = dayState(cell.key, todayKey, byDate, nowMs, member);
          const selected = cell.key === selectedKey;
          const isToday = cell.key === todayKey;
          const bookable = state === "available";
          return (
            <button
              key={cell.key}
              type="button"
              disabled={!bookable}
              onClick={() => onSelect(cell.key)}
              aria-pressed={selected}
              aria-label={`${formatDateLong(cell.key)}${bookable ? ", slots available" : state === "past" ? ", past" : ", no slots"}`}
              data-day-state={selected ? "selected" : state}
              className="relative h-8 rounded-md text-xs font-semibold transition-colors disabled:cursor-not-allowed"
              style={{
                background: selected ? "var(--color-accent)" : bookable ? CHIP : "transparent",
                color: selected ? "#fff" : bookable ? TEXT : MUTED,
                opacity: state === "past" ? 0.35 : bookable || selected ? 1 : 0.55,
                textDecoration: state === "past" ? "line-through" : undefined,
                outline: isToday && !selected ? `1px solid ${MUTED}` : undefined,
              }}
            >
              {cell.day}
              {bookable && !selected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: GREEN }} />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] flex-wrap" style={{ color: MUTED }}>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN }} /> Slots available</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--color-accent)" }} /> Selected</span>
        <span>All times IST</span>
      </div>
    </div>
  );
}

function SlotButton({
  session,
  state,
  selected,
  onSelect,
}: {
  session: SupportCallSession;
  state: SlotState;
  selected: boolean;
  onSelect: () => void;
}) {
  const selectable = state === "available";
  const isGroup = session.capacity > 1;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!selectable}
      aria-pressed={selected}
      data-slot-state={selected ? "selected" : state}
      className="text-left rounded-[10px] px-3 py-2.5 transition-colors disabled:cursor-not-allowed"
      style={{
        background: selected ? "color-mix(in srgb, var(--color-accent) 22%, #242428)" : CARD,
        border: `1px solid ${selected ? "var(--color-accent)" : "transparent"}`,
        opacity: selectable || selected ? 1 : 0.55,
      }}
    >
      <span className="block text-sm font-semibold whitespace-nowrap" style={{ color: TEXT }}>{formatSlotRange(session)}</span>
      <span className="block text-[11px] mt-0.5" style={{ color: state === "available" ? SOFT : MUTED }}>
        {state === "available"
          ? isGroup
            ? `${session.seatsLeft} of ${session.capacity} seats left`
            : "1 seat"
          : SLOT_LABEL[state]}
      </span>
    </button>
  );
}

function ConfirmCard({
  session,
  categoryLabel,
  dateKey,
  onConfirmed,
  onClear,
}: {
  session: SupportCallSession;
  categoryLabel: string;
  dateKey: string;
  onConfirmed: (session: SupportCallSession) => void;
  onClear: () => void;
}) {
  const book = useBookSupportCall();
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (book.isPending) return;
    setError(null);
    try {
      await book.mutateAsync(session.id);
      onConfirmed(session);
    } catch (err: any) {
      // The server re-validates availability; its message says what changed.
      setError(err?.message || "This slot could not be booked. Please pick another time.");
    }
  };

  return (
    <div className="rounded-[10px] p-3.5 space-y-2.5" style={{ background: CARD, border: "1px solid var(--color-accent)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Booking summary</p>
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
        <dt style={{ color: MUTED }}>Call</dt>
        <dd style={{ color: TEXT }}>{categoryLabel}</dd>
        <dt style={{ color: MUTED }}>Date</dt>
        <dd style={{ color: TEXT }}>{formatDateLong(dateKey)}</dd>
        <dt style={{ color: MUTED }}>Time</dt>
        <dd style={{ color: TEXT }}>{formatSlotRange(session)} IST ({session.durationMinutes} min)</dd>
        <dt style={{ color: MUTED }}>Session</dt>
        <dd style={{ color: TEXT }}>{session.title}</dd>
        {session.hostName && (
          <>
            <dt style={{ color: MUTED }}>Host</dt>
            <dd style={{ color: TEXT }}>{session.hostName}</dd>
          </>
        )}
      </dl>
      {session.description && <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{session.description}</p>}
      {error && (
        <p role="alert" className="text-xs rounded-md px-2.5 py-2" style={{ background: "rgba(255,49,59,0.12)", color: "#ff8a90" }}>
          {error}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap pt-0.5">
        <button
          type="button"
          onClick={confirm}
          disabled={book.isPending}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          {book.isPending && <Loader2 size={13} className="animate-spin" />} Confirm Booking
        </button>
        <button type="button" onClick={onClear} disabled={book.isPending} className="text-xs px-2 py-2" style={{ color: MUTED }}>
          Change time
        </button>
      </div>
    </div>
  );
}

function MyBookingCard({ session, nowMs }: { session: SupportCallSession; nowMs: number }) {
  const cancel = useCancelSupportCallBooking();
  const join = useJoinSupportCall();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const mine = session.myBooking!;
  const live = new Date(session.startsAt).getTime() <= nowMs;

  const onCancel = async () => {
    if (cancel.isPending) return;
    try {
      await cancel.mutateAsync(mine.id);
      toast.success("Booking cancelled — the call is back in your quota");
      setConfirmCancel(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not cancel this booking");
    }
  };

  const onJoin = async () => {
    if (join.isPending) return;
    // Open the tab synchronously so pop-up blockers allow it, then point it at the link.
    const tab = window.open("", "_blank");
    try {
      const url = await join.mutateAsync(mine.id);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err: any) {
      tab?.close();
      toast.error(err?.message || "The meeting link is not available yet");
    }
  };

  return (
    <div className="rounded-[10px] p-3.5 space-y-2" style={{ background: CARD }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug" style={{ color: TEXT }}>{session.title}</p>
          <p className="text-[11px] mt-0.5" style={{ color: SOFT }}>
            {formatShortDate(session.startsAt)} · {formatSlotRange(session)} IST
            {session.hostName ? ` · with ${session.hostName}` : ""}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {live && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: CHIP, color: RED }}>● Live now</span>
          )}
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: CHIP, color: BLUE }}>
            <Check size={11} /> Booked
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {mine.canJoin ? (
          <button
            type="button"
            onClick={onJoin}
            disabled={join.isPending}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg disabled:opacity-50"
            style={{ background: GREEN, color: "#fff" }}
          >
            {join.isPending ? <Loader2 size={13} className="animate-spin" /> : <Video size={13} />} Join call
          </button>
        ) : (
          mine.joinMessage && <span className="text-[11px]" style={{ color: MUTED }}>{mine.joinMessage}</span>
        )}
        {mine.canCancel && !confirmCancel && (
          <button type="button" onClick={() => setConfirmCancel(true)} className="text-xs font-semibold px-3 py-2 rounded-lg" style={{ background: CHIP, color: SOFT }}>
            Cancel booking
          </button>
        )}
        {mine.canCancel && confirmCancel && (
          <span className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={cancel.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
              style={{ background: RED, color: "#fff" }}
            >
              {cancel.isPending && <Loader2 size={13} className="animate-spin" />} Yes, cancel
            </button>
            <button type="button" onClick={() => setConfirmCancel(false)} className="text-xs px-2 py-2" style={{ color: MUTED }}>
              Keep
            </button>
          </span>
        )}
        {!mine.canCancel && mine.status === "booked" && !mine.canJoin && (
          <span className="text-[11px]" style={{ color: MUTED }}>Cancellation closes 2 hours before the call.</span>
        )}
      </div>
    </div>
  );
}

export default function SupportCallPanel({
  category,
  label,
  onClose,
}: {
  category: SupportCallCategory;
  label: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError, refetch, isFetching } = useSupportCalls(category);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const nowMs = useServerNow();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [justBooked, setJustBooked] = useState<SupportCallSession | null>(null);

  useEffect(() => {
    setMounted(true);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const quota = data?.quota;
  const member = useMemo(
    () => ({ notIncluded: !!quota && quota.allocated <= 0, canBookMore: !!quota && quota.remaining > 0 }),
    [quota],
  );
  const byDate = useMemo(() => groupByDate(data?.sessions ?? []), [data?.sessions]);
  const openDates = useMemo(() => datesWithOpenSlots(byDate, nowMs), [byDate, nowMs]);
  const myBookings = useMemo(() => (data?.sessions ?? []).filter((s) => s.myBooking), [data?.sessions]);
  const todayKey = istDateKey(nowMs);
  const bookableDates = useMemo(
    () => openDates.filter((k) => dayState(k, todayKey, byDate, nowMs, member) === "available"),
    [openDates, todayKey, byDate, nowMs, member],
  );

  // Default to the first date with a bookable slot; drop a selection that is no longer bookable.
  useEffect(() => {
    if (!data) return;
    if (!selectedDate || !bookableDates.includes(selectedDate)) setSelectedDate(bookableDates[0] ?? null);
  }, [data, bookableDates, selectedDate]);

  const daySlots = selectedDate ? byDate.get(selectedDate) ?? [] : [];
  const selectedSlot = daySlots.find((s) => s.id === selectedSlotId) ?? null;
  // A selected slot that the refreshed data no longer offers is cleared (e.g. it just filled up).
  useEffect(() => {
    if (selectedSlotId && (!selectedSlot || slotState(selectedSlot, nowMs, member) !== "available")) setSelectedSlotId(null);
  }, [selectedSlotId, selectedSlot, nowMs, member]);

  if (!mounted) return null;

  const nothingPublished = !!data && openDates.length === 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-start sm:justify-center bg-black/60 sm:p-4"
      onClick={onClose}
    >
      {/* Mobile sheet is pinned to the left edge and capped at the screen width so
          the close button stays visible even if the page behind is wider than the screen. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-call-panel-title"
        className="w-full max-w-[100vw] sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: SURFACE, border: "1px solid #2a2a2e" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Expert Support Calls · Book a slot</p>
            <h2 id="support-call-panel-title" className="text-base font-bold mt-0.5" style={{ color: TEXT }}>{label}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg" style={{ background: CHIP, color: SOFT }}>
            <X size={16} />
          </button>
        </div>

        {quota && (
          <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
            {member.notIncluded ? (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: CHIP, color: SOFT }}>
                Not included in your plan
              </span>
            ) : (
              <>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: CHIP, color: TEXT }}>
                  🔴 {quota.used}/{quota.allocated} Completed
                </span>
                {quota.reserved > 0 && (
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: CHIP, color: TEXT }}>
                    📅 {quota.reserved} Booked
                  </span>
                )}
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: CHIP, color: TEXT }}>
                  🟣 {quota.remaining} Left to book
                </span>
              </>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
          {isLoading ? (
            <div className="grid sm:grid-cols-2 gap-3" aria-busy="true">
              <div className="h-64 rounded-[10px] animate-pulse" style={{ background: CARD }} />
              <div className="h-64 rounded-[10px] animate-pulse" style={{ background: CARD }} />
            </div>
          ) : isError || !data ? (
            <div className="rounded-[10px] p-4 text-center space-y-2" style={{ background: CARD }}>
              <p className="text-xs" style={{ color: SOFT }}>Couldn&apos;t load available slots.</p>
              <button type="button" onClick={() => refetch()} disabled={isFetching} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: CHIP, color: TEXT }}>
                {isFetching ? "Retrying…" : "Retry"}
              </button>
            </div>
          ) : (
            <>
              {justBooked && (
                <div role="status" className="rounded-[10px] px-3.5 py-3 flex items-start justify-between gap-3" style={{ background: "rgba(34,197,94,0.12)", border: `1px solid ${GREEN}` }}>
                  <p className="text-xs" style={{ color: TEXT }}>
                    <strong>Booked!</strong> {justBooked.title} on {formatShortDate(justBooked.startsAt)}, {formatSlotRange(justBooked)} IST. It&apos;s listed under My bookings.
                  </p>
                  <button type="button" onClick={() => setJustBooked(null)} aria-label="Dismiss" style={{ color: SOFT }}><X size={14} /></button>
                </div>
              )}

              <section className="space-y-2">
                <div className="grid sm:grid-cols-2 gap-3 items-start">
                  <div className="space-y-2">
                    <SectionTitle icon={<CalendarDays size={13} />}>1. Choose a date</SectionTitle>
                    <BookingCalendar
                      byDate={byDate}
                      nowMs={nowMs}
                      member={member}
                      selectedKey={selectedDate}
                      onSelect={(key) => {
                        setSelectedDate(key);
                        setSelectedSlotId(null);
                      }}
                      lastOpenKey={openDates[openDates.length - 1] ?? null}
                    />
                  </div>
                  <div className="space-y-2">
                    <SectionTitle icon={<Clock size={13} />}>
                      2. Choose a time{selectedDate ? ` · ${formatShortDate(`${selectedDate}T12:00:00+05:30`)}` : ""}
                    </SectionTitle>
                    {nothingPublished && !member.notIncluded ? (
                      <div className="rounded-[10px] p-4" style={{ background: CARD }}>
                        <p className="text-xs font-semibold" style={{ color: TEXT }}>No available slots right now. Please check again later.</p>
                        <p className="text-[11px] mt-1" style={{ color: MUTED }}>
                          The TBT team publishes {label.replace(/^\S+\s/, "")} slots here. As soon as they do, the dates light up on the calendar and you can book a time.
                        </p>
                      </div>
                    ) : member.notIncluded || !member.canBookMore ? (
                      <div className="rounded-[10px] p-4" style={{ background: CARD }}>
                        <p className="text-xs font-semibold" style={{ color: TEXT }}>
                          {member.notIncluded ? "This call type isn't included in your plan." : "You have no calls left to book in this category."}
                        </p>
                        <p className="text-[11px] mt-1" style={{ color: MUTED }}>
                          {member.notIncluded
                            ? "Your plan doesn't include this call type, so its slots can't be booked."
                            : "A call becomes available again if you cancel an upcoming booking."}
                        </p>
                      </div>
                    ) : !selectedDate ? (
                      <div className="rounded-[10px] p-4" style={{ background: CARD }}>
                        <p className="text-xs" style={{ color: SOFT }}>All published slots are booked. Please check again later.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-1 gap-2" role="group" aria-label="Available time slots">
                        {daySlots.map((s) => (
                          <SlotButton
                            key={s.id}
                            session={s}
                            state={slotState(s, nowMs, member)}
                            selected={s.id === selectedSlotId}
                            onSelect={() => {
                              setSelectedSlotId(s.id);
                              setJustBooked(null);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {selectedSlot && selectedDate && (
                <section className="space-y-2">
                  <SectionTitle icon={<Check size={13} />}>3. Confirm</SectionTitle>
                  <ConfirmCard
                    key={selectedSlot.id}
                    session={selectedSlot}
                    categoryLabel={label}
                    dateKey={selectedDate}
                    onConfirmed={(s) => {
                      setSelectedSlotId(null);
                      setJustBooked(s);
                      toast.success("Call booked");
                    }}
                    onClear={() => setSelectedSlotId(null)}
                  />
                </section>
              )}

              <section className="space-y-2">
                <SectionTitle icon={<Users size={13} />}>My bookings</SectionTitle>
                {myBookings.length === 0 ? (
                  <p className="text-[11px]" style={{ color: MUTED }}>You have no upcoming bookings in this category.</p>
                ) : (
                  myBookings.map((s) => <MyBookingCard key={s.id} session={s} nowMs={nowMs} />)
                )}
              </section>

              {data.history.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-bold" style={{ color: SOFT }}>My calls</h3>
                  <ul className="space-y-1.5">
                    {data.history.map((h) => {
                      const st = HISTORY_LABEL[h.status] ?? HISTORY_LABEL.booked;
                      return (
                        <li key={h.bookingId} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: CARD }}>
                          <div className="min-w-0">
                            <p className="text-xs truncate" style={{ color: TEXT }}>{h.title}</p>
                            <p className="text-[10px]" style={{ color: MUTED }}>{formatShortDate(h.startsAt)} · {formatSlotRange(h)} IST</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-semibold" style={{ color: st.color }}>{st.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

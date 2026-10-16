"use client";

// Category detail for the Expert Support Calls tiles (SUPPORT_CALLS_SPECKIT.md):
// real sessions published by the TBT team, booking/cancel/join through the
// backend (which enforces quota, seats, cutoffs and the join window), and the
// member's own call history. Nothing here is generated client-side.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, CalendarClock, Users, Video, Check } from "lucide-react";
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

// Same dark palette as the Expert Support Calls tiles.
const SURFACE = "#1a1a1d";
const CARD = "#242428";
const CHIP = "#202024";
const TEXT = "#f5f5f7";
const MUTED = "#93939b";
const SOFT = "#d0cfd4";
const BLUE = "#809ed5";
const RED = "#ff313b";

const HISTORY_LABEL: Record<SupportCallHistoryItem["status"], { label: string; color: string }> = {
  booked: { label: "Booked", color: BLUE },
  attended: { label: "Completed", color: "#22c55e" },
  no_show: { label: "Missed", color: "#f59e0b" },
  cancelled: { label: "Cancelled", color: MUTED },
  session_cancelled: { label: "Cancelled by TBT", color: MUTED },
};

function formatSlot(iso: string, durationMinutes: number) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
  return `${day} · ${time} IST · ${durationMinutes} min`;
}

function SessionCard({
  session,
  canBookMore,
  notIncluded,
}: {
  session: SupportCallSession;
  canBookMore: boolean;
  notIncluded: boolean;
}) {
  const book = useBookSupportCall();
  const cancel = useCancelSupportCallBooking();
  const join = useJoinSupportCall();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const mine = session.myBooking;
  const isGroup = session.capacity > 1;
  const full = session.seatsLeft <= 0;

  const onBook = async () => {
    if (book.isPending) return;
    try {
      await book.mutateAsync(session.id);
      toast.success("Call booked");
    } catch (err: any) {
      toast.error(err?.message || "Could not book this call");
    }
  };

  const onCancel = async () => {
    if (!mine || cancel.isPending) return;
    try {
      await cancel.mutateAsync(mine.id);
      toast.success("Booking cancelled — the call is back in your quota");
      setConfirmCancel(false);
    } catch (err: any) {
      toast.error(err?.message || "Could not cancel this booking");
    }
  };

  const onJoin = async () => {
    if (!mine || join.isPending) return;
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

  // The list includes sessions still in progress (so booked members can join);
  // once a session has started it can no longer be booked (server rule too).
  const live = new Date(session.startsAt).getTime() <= getServerNow();

  let blockedReason: string | null = null;
  if (!mine) {
    if (live) blockedReason = "Booking closed — this session has started";
    else if (notIncluded) blockedReason = "Not included in your plan";
    else if (full) blockedReason = "Session full";
    else if (!canBookMore) blockedReason = "No calls left in this category";
  }

  return (
    <div className="rounded-[10px] p-3.5 space-y-2" style={{ background: CARD }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug" style={{ color: TEXT }}>{session.title}</p>
          {session.hostName && <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>with {session.hostName}</p>}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {live && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: CHIP, color: RED }}>
              ● Live now
            </span>
          )}
          {mine && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: CHIP, color: BLUE }}>
              <Check size={11} /> Booked
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap text-[11px]" style={{ color: SOFT }}>
        <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> {formatSlot(session.startsAt, session.durationMinutes)}</span>
        {isGroup && (
          <span className="inline-flex items-center gap-1"><Users size={12} /> {session.seatsLeft} of {session.capacity} seats left</span>
        )}
      </div>
      {session.description && <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{session.description}</p>}

      <div className="flex items-center gap-2 flex-wrap pt-1">
        {!mine && (
          <>
            <button
              type="button"
              onClick={onBook}
              disabled={!!blockedReason || book.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              {book.isPending && <Loader2 size={13} className="animate-spin" />} Book call
            </button>
            {blockedReason && <span className="text-[11px]" style={{ color: MUTED }}>{blockedReason}</span>}
          </>
        )}
        {mine && (
          <>
            {mine.canJoin ? (
              <button
                type="button"
                onClick={onJoin}
                disabled={join.isPending}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg disabled:opacity-50"
                style={{ background: "#22c55e", color: "#fff" }}
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
          </>
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

  if (!mounted) return null;

  const quota = data?.quota;
  const notIncluded = !!quota && quota.allocated <= 0;
  const canBookMore = !!quota && quota.remaining > 0;

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
        className="w-full max-w-[100vw] sm:max-w-lg max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: SURFACE, border: "1px solid #2a2a2e" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Expert Support Calls</p>
            <h2 id="support-call-panel-title" className="text-base font-bold mt-0.5" style={{ color: TEXT }}>{label}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg" style={{ background: CHIP, color: SOFT }}>
            <X size={16} />
          </button>
        </div>

        {quota && (
          <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
            {notIncluded ? (
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
            <div className="space-y-2" aria-busy="true">
              {[0, 1].map((i) => <div key={i} className="h-24 rounded-[10px] animate-pulse" style={{ background: CARD }} />)}
            </div>
          ) : isError || !data ? (
            <div className="rounded-[10px] p-4 text-center space-y-2" style={{ background: CARD }}>
              <p className="text-xs" style={{ color: SOFT }}>Couldn&apos;t load support calls.</p>
              <button type="button" onClick={() => refetch()} disabled={isFetching} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: CHIP, color: TEXT }}>
                {isFetching ? "Retrying…" : "Retry"}
              </button>
            </div>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-xs font-bold" style={{ color: SOFT }}>Upcoming sessions</h3>
                {data.sessions.length === 0 ? (
                  <div className="rounded-[10px] p-4 text-center" style={{ background: CARD }}>
                    <p className="text-xs font-semibold" style={{ color: TEXT }}>No sessions scheduled yet</p>
                    <p className="text-[11px] mt-1" style={{ color: MUTED }}>
                      New sessions appear here as soon as the TBT team publishes them.
                    </p>
                  </div>
                ) : (
                  data.sessions.map((s) => (
                    <SessionCard key={s.id} session={s} canBookMore={canBookMore} notIncluded={notIncluded} />
                  ))
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
                            <p className="text-[10px]" style={{ color: MUTED }}>{formatSlot(h.startsAt, h.durationMinutes)}</p>
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

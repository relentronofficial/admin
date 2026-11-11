"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { useActivityHistory } from "@/lib/hooks/useActivityHistory";

// Daily Time Spent → date-wise history popup. Data: GET /api/user/activity/history
// (the member's own active minutes per day — the same source as the card, one
// bit per active minute, so sessions on several devices never double-count).
// Dates are the server's program-timezone (IST) days, shown as they come.

const PAGE = 30;

/** "0 min", "45 min", "1 hr", "1 hr 25 min", "2 hrs 10 min". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return `${h} ${h === 1 ? "hr" : "hrs"}${m ? ` ${m} min` : ""}`;
}

// A YYYY-MM-DD string is already the IST calendar day; format it as a plain
// calendar date (UTC midnight) so the viewer's own timezone can't shift it.
const asDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
export const formatDay = (ymd: string) =>
  asDate(ymd).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const weekday = (ymd: string) => asDate(ymd).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
const addDays = (ymd: string, n: number) => new Date(asDate(ymd).getTime() + n * 86_400_000).toISOString().slice(0, 10);

type Range = "all" | "7" | "30" | "month" | "custom";
const ONBOARDING_SOURCE: Record<string, string> = {
  approved: "Onboarded",
  submitted: "Onboarding submitted",
  joined: "Joined",
};

export default function DailyTimeSpentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading, isError, refetch } = useActivityHistory(open);
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shown, setShown] = useState(PAGE);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => { setShown(PAGE); }, [range, from, to]);

  const filtered = useMemo(() => {
    const days = data?.days ?? [];
    if (!data) return days;
    const today = data.today;
    let lo: string | null = null;
    let hi: string | null = null;
    if (range === "7") lo = addDays(today, -6);
    else if (range === "30") lo = addDays(today, -29);
    else if (range === "month") lo = `${today.slice(0, 8)}01`;
    else if (range === "custom") { lo = from || null; hi = to || null; }
    return days.filter((d) => (!lo || d.date >= lo) && (!hi || d.date <= hi));
  }, [data, range, from, to]);

  const periodTotal = filtered.reduce((s, d) => s + d.activeMinutes, 0);
  const periodAvg = filtered.length ? periodTotal / filtered.length : 0;

  if (!open) return null;

  const box = { background: "#18181b", border: "1px solid rgba(255,255,255,0.08)" } as const;
  const muted = { color: "#a1a1aa" } as const;
  const stat = (label: string, value: string, testId?: string) => (
    <div className="rounded-xl px-3 py-2" style={{ background: "#242428" }}>
      <p className="text-[10px] font-medium" style={muted}>{label}</p>
      <p className="text-base font-bold" style={{ color: "#f5f5f7" }} data-testid={testId}>{value}</p>
    </div>
  );
  const untrackedBefore = data && data.trackedFrom && data.rangeStart < data.trackedFrom ? data.trackedFrom : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.65)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="dts-title"
        className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden" style={box}>
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="dts-title" className="text-lg font-bold" style={{ color: "#f5f5f7" }}>Daily Time Spent</h2>
              {data && (
                <p className="text-xs mt-0.5 truncate" style={muted}>
                  {data.memberName ?? ""}
                  {data.onboardingDate && <> · {ONBOARDING_SOURCE[data.onboardingSource] ?? "Onboarded"} {formatDay(data.onboardingDate)}</>}
                </p>
              )}
            </div>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close"
              className="p-1.5 rounded-lg hover:bg-white/10 focus-visible:outline focus-visible:outline-2" style={{ color: "#d4d4d8" }}>
              <X size={18} />
            </button>
          </div>
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
              {stat("Total time spent", formatDuration(data.totalMinutes), "dts-total")}
              {stat("Average per day", formatDuration(data.averageDailyMinutes), "dts-average")}
              {stat("Active days", `${data.activeDays} of ${data.trackedDays}`)}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && <div className="py-10 flex justify-center"><div className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white animate-spin" /></div>}
          {isError && (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm" style={muted}>Couldn&apos;t load your time spent history.</p>
              <button onClick={() => void refetch()} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: "var(--color-accent)" }}>Retry</button>
            </div>
          )}
          {data && !data.trackedFrom && (
            <p className="py-8 text-center text-sm" style={muted} data-testid="dts-empty">No time has been tracked for you yet. It starts counting as you use the app.</p>
          )}
          {data && data.trackedFrom && (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <select value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Date range"
                  className="h-9 px-3 rounded-lg text-xs" style={{ background: "#242428", color: "#f5f5f7", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <option value="all">Since onboarding</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="month">This month</option>
                  <option value="custom">Custom range</option>
                </select>
                {range === "custom" && (
                  <>
                    <input type="date" aria-label="From" value={from} min={data.trackedFrom} max={data.today} onChange={(e) => setFrom(e.target.value)}
                      className="h-9 px-2 rounded-lg text-xs" style={{ background: "#242428", color: "#f5f5f7", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }} />
                    <input type="date" aria-label="To" value={to} min={data.trackedFrom} max={data.today} onChange={(e) => setTo(e.target.value)}
                      className="h-9 px-2 rounded-lg text-xs" style={{ background: "#242428", color: "#f5f5f7", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }} />
                  </>
                )}
                <span className="ml-auto text-xs" style={muted} data-testid="dts-period-total">
                  {filtered.length} {filtered.length === 1 ? "day" : "days"} · <b style={{ color: "#f5f5f7" }}>{formatDuration(periodTotal)}</b>
                  {filtered.length > 0 && <> · avg {formatDuration(periodAvg)}/day</>}
                </span>
              </div>

              {filtered.length === 0 ? (
                <p className="py-6 text-center text-sm" style={muted}>No days in this range.</p>
              ) : (
                <table className="w-full text-sm" data-testid="dts-table">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider" style={muted}>
                      <th className="py-2 font-semibold">Date</th>
                      <th className="py-2 font-semibold">Day</th>
                      <th className="py-2 font-semibold text-right">Time Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, shown).map((d) => (
                      <tr key={d.date} className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }} data-testid="dts-row">
                        <td className="py-2.5" style={{ color: "#f5f5f7" }}>{formatDay(d.date)}{d.date === data.today && <span className="ml-1.5 text-[10px]" style={muted}>(today)</span>}</td>
                        <td className="py-2.5" style={muted}>{weekday(d.date)}</td>
                        <td className="py-2.5 text-right font-semibold" style={{ color: d.activeMinutes ? "#f5f5f7" : "#71717a" }}>{formatDuration(d.activeMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {filtered.length > shown && (
                <button onClick={() => setShown((n) => n + PAGE)} className="mt-3 w-full h-10 rounded-xl text-xs font-semibold"
                  style={{ background: "#242428", color: "#f5f5f7" }}>
                  Load more ({filtered.length - shown} more {filtered.length - shown === 1 ? "day" : "days"})
                </button>
              )}
              {untrackedBefore && (
                <p className="mt-3 text-[11px]" style={muted} data-testid="dts-untracked">
                  Time tracking started on {formatDay(untrackedBefore)}. Days from {formatDay(data.rangeStart)} to {formatDay(addDays(untrackedBefore, -1))} weren&apos;t recorded, so they aren&apos;t shown or counted.
                </p>
              )}
              <p className="mt-2 text-[10px]" style={{ color: "#71717a" }}>
                Active time only (the app open and in use, or a video playing), in India Standard Time.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

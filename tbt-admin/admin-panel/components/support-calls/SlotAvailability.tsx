"use client";

// Admin-managed support call availability (Support Calls page). The admin picks
// the exact dates and times they are available; nothing is generated from
// office hours. Each published time is one support_call_sessions row, which is
// what members see and book on their calendar. All times are IST.
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, Plus, Trash2, X, Users, Edit2, Ban, Link2 } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  useListSupportSessions,
  usePublishSupportSlots,
  useSupportCallHosts,
  type SupportCallCategory,
  type SupportSession,
} from "@/lib/hooks/useTbt";
import {
  SLOT_STATUS_BADGE,
  formatDateKey,
  formatMonth,
  formatSlotRange,
  groupByIstDate,
  istDateKey,
  istToIso,
  monthGrid,
  monthOf,
  monthRange,
  shiftMonth,
  slotStatusLabel,
  type Month,
} from "@/lib/utils/supportSlots";
import { cn } from "@/lib/utils";

export const SUPPORT_CALL_CATEGORIES: { id: SupportCallCategory; label: string; icon: string }[] = [
  { id: "sales_support", label: "Sales Calls", icon: "☎" },
  { id: "tech_support", label: "Tech Calls", icon: "⚙" },
  { id: "content_support", label: "Content Calls", icon: "▶" },
  { id: "ad_support", label: "Marketing Calls", icon: "📢" },
  { id: "one_to_one", label: "Mentor 1-On-1", icon: "♟" },
  { id: "group_call", label: "Live Group Q&A", icon: "👥" },
];
export const CATEGORY_LABEL = Object.fromEntries(
  SUPPORT_CALL_CATEGORIES.map((c) => [c.id, `${c.icon} ${c.label}`]),
) as Record<string, string>;

const LABEL = "block text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-2";
const INPUT =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white text-sm outline-none focus:border-[#dc2626]";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CallTypeFilter = "all" | "one_to_one" | "group";

export function matchesCallType(s: SupportSession, callType: CallTypeFilter) {
  return callType === "all" || (callType === "one_to_one" ? s.capacity === 1 : s.capacity > 1);
}

function StatusBadge({ session }: { session: SupportSession }) {
  const b = SLOT_STATUS_BADGE[session.slotStatus] ?? SLOT_STATUS_BADGE.available;
  return (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: b.color, background: b.bg }}>
      {slotStatusLabel(session)}
    </span>
  );
}

function MonthNav({ month, onChange, minMonth }: { month: Month; onChange: (m: Month) => void; minMonth?: Month }) {
  const atMin = !!minMonth && month.year === minMonth.year && month.monthIndex === minMonth.monthIndex;
  return (
    <div className="flex items-center justify-between mb-3">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        disabled={atMin}
        aria-label="Previous month"
        className="p-1.5 rounded-md bg-[#1f1f1f] text-[#a0a0a0] hover:text-white disabled:opacity-30"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="font-rajdhani text-[15px] font-bold uppercase tracking-wider text-[#f0f0f0]" aria-live="polite">
        {formatMonth(month)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label="Next month"
        className="p-1.5 rounded-md bg-[#1f1f1f] text-[#a0a0a0] hover:text-white"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

// ── Publish availability ─────────────────────────────────────────────────────

type Staged = Record<string, string[]>; // IST date → sorted HH:MM list

export function PublishAvailabilityModal({
  initialDate,
  canPickHost,
  onClose,
}: {
  initialDate: string | null;
  canPickHost: boolean;
  onClose: () => void;
}) {
  const todayKey = istDateKey(Date.now());
  const publish = usePublishSupportSlots();
  const { data: hosts = [] } = useSupportCallHosts(canPickHost);
  const [month, setMonth] = useState<Month>(monthOf(initialDate ?? todayKey));
  const [date, setDate] = useState<string>(initialDate && initialDate >= todayKey ? initialDate : todayKey);
  const [time, setTime] = useState("10:00");
  const [staged, setStaged] = useState<Staged>({});
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState({
    category: "one_to_one" as SupportCallCategory,
    title: "Mentor 1-On-1",
    titleTouched: false,
    description: "",
    hostAdminId: "",
    hostName: "",
    durationMinutes: 30,
    capacity: 1,
    meetingUrl: "",
  });
  const set = <K extends keyof typeof details>(k: K, v: (typeof details)[K]) => setDetails((d) => ({ ...d, [k]: v }));
  const isOneToOne = details.category === "one_to_one";

  // What is already published this month, so the admin can see the date before adding to it.
  const range = monthRange(month);
  const { data: existing = [], isFetching } = useListSupportSessions(range);
  const existingByDate = useMemo(() => groupByIstDate(existing.filter((s) => s.status === "scheduled")), [existing]);
  const dayExisting = existingByDate.get(date) ?? [];

  const stagedCount = Object.values(staged).reduce((n, t) => n + t.length, 0);
  const stagedDates = Object.keys(staged).filter((k) => staged[k].length).sort();

  const addTime = () => {
    setError(null);
    if (!/^\d{2}:\d{2}$/.test(time)) return setError("Enter a time.");
    const iso = istToIso(date, time);
    if (new Date(iso).getTime() <= Date.now()) return setError("That time has already passed. Pick a later time.");
    const list = staged[date] ?? [];
    if (list.includes(time)) return setError("That time is already added for this date.");
    setStaged({ ...staged, [date]: [...list, time].sort() });
  };

  const removeTime = (k: string, t: string) => {
    const list = (staged[k] ?? []).filter((x) => x !== t);
    const next = { ...staged };
    if (list.length) next[k] = list;
    else delete next[k];
    setStaged(next);
  };

  /** Staged times closer together than one slot's length (the server re-checks everything). */
  const overlapping = useMemo(() => {
    const starts = stagedDates.flatMap((k) => staged[k].map((t) => new Date(istToIso(k, t)).getTime())).sort((a, b) => a - b);
    return starts.some((s, i) => i > 0 && s - starts[i - 1] < details.durationMinutes * 60_000);
  }, [staged, stagedDates, details.durationMinutes]);

  const submit = async () => {
    if (publish.isPending) return;
    setError(null);
    if (!details.title.trim()) return setError("Title is required.");
    if (!stagedCount) return setError("Add at least one time slot.");
    if (overlapping) return setError(`Some times are less than ${details.durationMinutes} minutes apart. Remove the overlap first.`);
    try {
      const created = await publish.mutateAsync({
        category: details.category,
        title: details.title.trim(),
        description: details.description.trim() || null,
        hostName: details.hostName.trim() || null,
        durationMinutes: Number(details.durationMinutes),
        capacity: isOneToOne ? 1 : Number(details.capacity),
        meetingUrl: details.meetingUrl.trim() || null,
        ...(canPickHost ? { hostAdminId: details.hostAdminId || null } : {}),
        startsAt: stagedDates.flatMap((k) => staged[k].map((t) => istToIso(k, t))),
      });
      toast.success(`${created.length} slot${created.length === 1 ? "" : "s"} published. Members can book them now.`);
      onClose();
    } catch (err: any) {
      // Nothing is saved when the server refuses: it says which time is the problem.
      setError(err?.message || "Could not publish these slots.");
    }
  };

  const cells = monthGrid(month);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-availability-title"
        className="bg-[#141414] border border-[#2a2a2a] rounded-xl w-full max-w-4xl max-h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#1f1f1f]">
          <div>
            <h2 id="publish-availability-title" className="font-rajdhani text-lg font-bold uppercase tracking-wide text-[#f0f0f0]">
              Assign Slots
            </h2>
            <p className="text-[12px] text-[#888]">Pick a date, add the times you are available, repeat for other dates, then save. All times IST.</p>
          </div>
          <button onClick={onClose} className="text-[#606060] hover:text-white" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Date picker */}
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4">
              <p className={LABEL}><CalendarDays size={12} className="inline mr-1 -mt-0.5" /> 1. Choose a date</p>
              <MonthNav month={month} onChange={setMonth} minMonth={monthOf(todayKey)} />
              <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Choose a date">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="text-[10px] font-bold uppercase text-[#606060] py-1" aria-hidden="true">{w.slice(0, 2)}</span>
                ))}
                {cells.map((c, i) => {
                  if (!c) return <span key={`b${i}`} />;
                  const past = c.key < todayKey;
                  const selected = c.key === date;
                  const hasStaged = (staged[c.key]?.length ?? 0) > 0;
                  const hasExisting = (existingByDate.get(c.key)?.length ?? 0) > 0;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      disabled={past}
                      onClick={() => { setDate(c.key); setError(null); }}
                      aria-pressed={selected}
                      aria-label={`${formatDateKey(c.key)}${hasExisting ? ", has published slots" : ""}${hasStaged ? ", has new times" : ""}`}
                      className={cn(
                        "relative h-9 rounded-md text-[13px] font-semibold transition-colors",
                        selected ? "bg-[#dc2626] text-white" : past ? "text-[#3a3a3a] cursor-not-allowed" : "text-[#f0f0f0] bg-[#1f1f1f] hover:bg-[#2a2a2a]",
                        c.key === todayKey && !selected && "ring-1 ring-[#606060]",
                      )}
                    >
                      {c.day}
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {hasExisting && <span className="w-1 h-1 rounded-full bg-[#22c55e]" />}
                        {hasStaged && <span className={cn("w-1 h-1 rounded-full", selected ? "bg-white" : "bg-[#dc2626]")} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-3 text-[10px] text-[#888] flex-wrap">
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" /> Already published</span>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]" /> New times (not yet published)</span>
              </div>
            </div>

            {/* Times for the chosen date */}
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4 space-y-4">
              <div>
                <p className={LABEL}><Clock size={12} className="inline mr-1 -mt-0.5" /> 2. Add times · {formatDateKey(date, { weekday: "short", day: "numeric", month: "short" })}</p>
                <div className="flex gap-2">
                  <input
                    type="time"
                    aria-label="Start time (IST)"
                    className={cn(INPUT, "flex-1")}
                    value={time}
                    step={300}
                    onChange={(e) => setTime(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTime()}
                  />
                  <button
                    type="button"
                    onClick={addTime}
                    className="shrink-0 bg-[#1f1f1f] hover:bg-[#2a2a2a] border border-[#333] text-white px-4 rounded-lg text-[12px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Add Time Slot
                  </button>
                </div>
                <p className="text-[11px] text-[#606060] mt-1.5">Each time becomes one {details.durationMinutes}-minute slot.</p>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1.5">New on this date</p>
                {(staged[date] ?? []).length === 0 ? (
                  <p className="text-[12px] text-[#606060]">No new times added for this date yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {staged[date].map((t) => (
                      <span key={t} className="inline-flex items-center gap-1.5 bg-[rgba(220,38,38,0.12)] border border-[rgba(220,38,38,0.4)] text-[#f0f0f0] text-[12px] font-semibold pl-3 pr-1.5 py-1 rounded-full">
                        {formatSlotRange({ startsAt: istToIso(date, t), durationMinutes: details.durationMinutes })}
                        <button type="button" onClick={() => removeTime(date, t)} aria-label={`Remove ${t}`} className="p-0.5 rounded-full hover:bg-black/30 text-[#a0a0a0] hover:text-white">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1.5">
                  Already published on this date {isFetching && <Loader2 size={11} className="inline animate-spin ml-1" />}
                </p>
                {dayExisting.length === 0 ? (
                  <p className="text-[12px] text-[#606060]">None.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {dayExisting.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2 text-[12px] bg-[#1a1a1a] rounded-lg px-3 py-1.5">
                        <span className="text-[#f0f0f0] font-semibold whitespace-nowrap">{formatSlotRange(s)}</span>
                        <span className="text-[#888] truncate">{CATEGORY_LABEL[s.category]}{s.hostName ? ` · ${s.hostName}` : ""}</span>
                        <StatusBadge session={s} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Shared details for every slot in this publish */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4 space-y-4">
            <p className={LABEL}>3. Slot details (applied to every new time)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL} htmlFor="pa-category">Call type</label>
                <select
                  id="pa-category"
                  className={INPUT}
                  value={details.category}
                  onChange={(e) => {
                    const c = e.target.value as SupportCallCategory;
                    const label = SUPPORT_CALL_CATEGORIES.find((x) => x.id === c)?.label ?? "";
                    setDetails((d) => ({
                      ...d,
                      category: c,
                      capacity: c === "one_to_one" ? 1 : d.capacity,
                      title: d.titleTouched ? d.title : label,
                    }));
                  }}
                >
                  {SUPPORT_CALL_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="pa-title">Title shown to members</label>
                <input
                  id="pa-title"
                  className={INPUT}
                  value={details.title}
                  maxLength={200}
                  onChange={(e) => setDetails((d) => ({ ...d, title: e.target.value, titleTouched: true }))}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="pa-duration">Duration (min)</label>
                <input id="pa-duration" type="number" min={5} max={480} className={INPUT} value={details.durationMinutes}
                  onChange={(e) => set("durationMinutes", Number(e.target.value))} />
              </div>
              <div>
                <label className={LABEL} htmlFor="pa-seats">Seats per slot</label>
                <input id="pa-seats" type="number" min={1} max={500} className={INPUT} value={isOneToOne ? 1 : details.capacity}
                  disabled={isOneToOne} onChange={(e) => set("capacity", Number(e.target.value))} />
                {isOneToOne && <p className="text-[11px] text-[#606060] mt-1">Mentor 1-On-1 slots always have exactly 1 seat.</p>}
              </div>
              {canPickHost && (
                <div>
                  <label className={LABEL} htmlFor="pa-host">Host account</label>
                  <select id="pa-host" className={INPUT} value={details.hostAdminId} onChange={(e) => set("hostAdminId", e.target.value)}>
                    <option value="">— None —</option>
                    {hosts.map((h) => <option key={h.id} value={h.id}>{h.fullName} ({h.role.replace(/_/g, " ")})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={LABEL} htmlFor="pa-hostname">Host name shown to members</label>
                <input id="pa-hostname" className={INPUT} value={details.hostName} maxLength={120}
                  placeholder={canPickHost ? "Defaults to the host account" : "Defaults to your name"}
                  onChange={(e) => set("hostName", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL} htmlFor="pa-link">Meeting link (private)</label>
                <input id="pa-link" className={INPUT} value={details.meetingUrl} placeholder="https://…" onChange={(e) => set("meetingUrl", e.target.value)} />
                <p className="text-[11px] text-[#606060] mt-1">Only booked members can open it, from 10 minutes before the start. You can add it later.</p>
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL} htmlFor="pa-desc">Description</label>
                <textarea id="pa-desc" className={cn(INPUT, "h-20 py-3 resize-none")} value={details.description} maxLength={2000}
                  onChange={(e) => set("description", e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-[#1f1f1f] space-y-3">
          {stagedCount > 0 && (
            <div className="text-[12px] text-[#a0a0a0]">
              <span className="font-bold text-[#f0f0f0]">Ready to publish:</span>{" "}
              {stagedDates.map((k) => `${formatDateKey(k, { day: "numeric", month: "short" })} (${staged[k].length})`).join(" · ")}
            </div>
          )}
          {error && (
            <p role="alert" className="text-[12px] rounded-md px-3 py-2 bg-[rgba(239,68,68,0.12)] text-[#fca5a5]">{error}</p>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-[13px] font-bold uppercase tracking-wider text-[#888] hover:text-white">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={publish.isPending || stagedCount === 0}
              className="bg-[#dc2626] hover:bg-red-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-[13px] font-bold uppercase tracking-wider flex items-center gap-2"
            >
              {publish.isPending && <Loader2 size={14} className="animate-spin" />}
              Save {stagedCount || ""} slot{stagedCount === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Availability calendar (all published slots) ──────────────────────────────

export function AvailabilityCalendar({
  category,
  callType,
  onPublishForDate,
  onEdit,
  onViewBookings,
  onCancel,
  onDelete,
  busy,
}: {
  category: string;
  callType: CallTypeFilter;
  onPublishForDate: (date: string) => void;
  onEdit: (s: SupportSession) => void;
  onViewBookings: (s: SupportSession) => void;
  onCancel: (s: SupportSession) => void;
  onDelete: (s: SupportSession) => void;
  busy: boolean;
}) {
  const todayKey = istDateKey(Date.now());
  const [month, setMonth] = useState<Month>(monthOf(todayKey));
  const [selected, setSelected] = useState<string>(todayKey);
  const params = useMemo(() => ({ ...monthRange(month), ...(category ? { category } : {}) }), [month, category]);
  const { data = [], isLoading, isError, refetch } = useListSupportSessions(params);
  const sessions = useMemo(() => data.filter((s) => matchesCallType(s, callType)), [data, callType]);
  const byDate = useMemo(() => groupByIstDate(sessions), [sessions]);
  const daySlots = byDate.get(selected) ?? [];
  const cells = monthGrid(month);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4">
        <MonthNav month={month} onChange={setMonth} />
        {isError ? (
          <div className="text-sm text-[#ef4444] py-10 text-center">
            Could not load slots. <button className="underline" onClick={() => refetch()}>Retry</button>
          </div>
        ) : (
          <div className={cn("grid grid-cols-7 gap-1", isLoading && "opacity-50")} role="grid" aria-label="Published slots by date">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[10px] font-bold uppercase text-[#606060] py-1 text-center" aria-hidden="true">{w}</span>
            ))}
            {cells.map((c, i) => {
              if (!c) return <span key={`b${i}`} />;
              const list = byDate.get(c.key) ?? [];
              const count = (st: SupportSession["slotStatus"]) => list.filter((s) => s.slotStatus === st).length;
              const avail = count("available");
              const booked = count("booked") + count("in_progress");
              const cancelled = count("cancelled");
              const done = count("completed");
              const isSel = c.key === selected;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSelected(c.key)}
                  aria-pressed={isSel}
                  aria-label={`${formatDateKey(c.key)}: ${list.length} slot${list.length === 1 ? "" : "s"}`}
                  className={cn(
                    "min-h-[64px] sm:min-h-[76px] rounded-lg p-1.5 text-left border transition-colors flex flex-col",
                    isSel ? "border-[#dc2626] bg-[rgba(220,38,38,0.08)]" : "border-[#222] bg-[#141414] hover:border-[#333]",
                    c.key < todayKey && "opacity-60",
                  )}
                >
                  <span className={cn("text-[12px] font-bold", c.key === todayKey ? "text-[#dc2626]" : "text-[#f0f0f0]")}>{c.day}</span>
                  <span className="mt-auto flex flex-wrap gap-0.5">
                    {avail > 0 && <span className="text-[9px] sm:text-[10px] font-bold px-1 rounded bg-[rgba(34,197,94,0.15)] text-[#22c55e]">{avail}</span>}
                    {booked > 0 && <span className="text-[9px] sm:text-[10px] font-bold px-1 rounded bg-[rgba(167,139,250,0.15)] text-[#a78bfa]">{booked}</span>}
                    {done > 0 && <span className="text-[9px] sm:text-[10px] font-bold px-1 rounded bg-[rgba(160,160,160,0.12)] text-[#a0a0a0]">{done}</span>}
                    {cancelled > 0 && <span className="text-[9px] sm:text-[10px] font-bold px-1 rounded bg-[rgba(239,68,68,0.15)] text-[#ef4444]">{cancelled}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-3 mt-3 text-[11px] text-[#888] flex-wrap">
          {(["available", "booked", "completed", "cancelled"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ background: SLOT_STATUS_BADGE[k].color }} /> {SLOT_STATUS_BADGE[k].label}
            </span>
          ))}
          <span>All times IST</span>
        </div>
      </div>

      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-rajdhani text-[15px] font-bold uppercase tracking-wider text-[#f0f0f0]">
              {formatDateKey(selected, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <p className="text-[11px] text-[#888]">{daySlots.length} slot{daySlots.length === 1 ? "" : "s"}</p>
          </div>
          {selected >= todayKey && (
            <button
              onClick={() => onPublishForDate(selected)}
              className="shrink-0 bg-[#dc2626] hover:bg-red-700 text-white px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            >
              <Plus size={13} /> Add slots
            </button>
          )}
        </div>
        {daySlots.length === 0 ? (
          <p className="text-[12px] text-[#606060] py-6 text-center">
            No slots on this date.{selected >= todayKey ? " Use Add slots to publish your available times." : ""}
          </p>
        ) : (
          <ul className="space-y-2">
            {daySlots.map((s) => {
              const editable = s.slotStatus === "available" || s.slotStatus === "booked";
              const cancellable = s.status === "scheduled" && s.slotStatus !== "completed";
              return (
                <li key={s.id} className={cn("bg-[#141414] border border-[#2a2a2a] rounded-lg p-3 space-y-2", s.slotStatus === "cancelled" && "opacity-70")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#f0f0f0]">{formatSlotRange(s)}</p>
                      <p className="text-[11px] text-[#888] truncate">
                        {CATEGORY_LABEL[s.category]}{s.capacity === 1 ? " · 1:1" : ` · ${s.activeBookings}/${s.capacity} seats`}
                        {s.hostName ? ` · ${s.hostName}` : ""}
                      </p>
                      <p className="text-[11px] text-[#606060] truncate">{s.title}</p>
                    </div>
                    <StatusBadge session={s} />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={() => onViewBookings(s)} className="flex items-center gap-1 text-[11px] font-bold uppercase text-[#a0a0a0] hover:text-white">
                      <Users size={12} /> Bookings{s.totalBookings ? ` (${s.totalBookings})` : ""}
                    </button>
                    {editable && (
                      <button onClick={() => onEdit(s)} className="flex items-center gap-1 text-[11px] font-bold uppercase text-[#a0a0a0] hover:text-white">
                        <Edit2 size={12} /> Edit
                      </button>
                    )}
                    {cancellable && (
                      <button onClick={() => onCancel(s)} disabled={busy} className="flex items-center gap-1 text-[11px] font-bold uppercase text-[#ef4444] hover:text-red-400 disabled:opacity-50">
                        <Ban size={12} /> Cancel
                      </button>
                    )}
                    {s.canDelete && (
                      <button onClick={() => onDelete(s)} disabled={busy} className="flex items-center gap-1 text-[11px] font-bold uppercase text-[#ef4444] hover:text-red-400 disabled:opacity-50">
                        <Trash2 size={12} /> Remove
                      </button>
                    )}
                    {s.meetingUrl && (
                      <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-bold uppercase text-[#a0a0a0] hover:text-white">
                        <Link2 size={12} /> Link
                      </a>
                    )}
                  </div>
                  {!s.hasMeetingUrl && s.status === "scheduled" && s.slotStatus !== "completed" && (
                    <p className="text-[11px] text-[#f59e0b]">No meeting link yet.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

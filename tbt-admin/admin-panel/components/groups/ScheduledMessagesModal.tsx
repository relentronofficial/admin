"use client";

// Admin — schedule messages for a group chat: once (a date + time), or
// repeating daily / weekly (start date's weekday) / monthly (start date's day
// of the month; last day in shorter months), from a start date and
// optionally until an end date; or on days counted from the group's start date
// (a linked batch's start date or a custom one; Day 1 = that date). All dates and times are IST. The backend posts them as the admin who created
// them (jobs/chatScheduledMessages.ts).

import { FormattedText } from "@/components/chat/FormattedText";
import { handleFormatShortcut } from "@/lib/utils/chatFormatting";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  useAdminBulkScheduleRelative,
  useAdminDeleteScheduledMessage,
  useAdminSaveScheduledMessage,
  useAdminScheduledMessages,
  useAdminScheduleStart,
  useAdminSetScheduledStatus,
  useAdminSetScheduleStart,
  type AdminChatGroup,
  type ScheduleFrequency,
  type ScheduledGroupMessage,
} from "@/lib/hooks/useChatGroups";
import { useListBatches } from "@/lib/hooks/useTbt";

const TZ = "Asia/Kolkata";
const LABEL = "text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani";
const INPUT =
  "mt-1.5 w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] [color-scheme:dark]";

function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function istNextHour(): string {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date()),
  );
  return `${String((h + 1) % 24).padStart(2, "0")}:00`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtTime(t: string | null): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

function fmtInstant(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: "once", label: "One time" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "relative", label: "Day from start date (Day 10, -1 …)" },
];

/** The date of a day counted from the start date: Day 1 = start, -1 = the day before. */
function relativeDate(start: string | null | undefined, day: number): string | null {
  if (!start || !Number.isInteger(day) || day === 0) return null;
  const [y, m, d] = start.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + (day > 0 ? day - 1 : day))).toISOString().slice(0, 10);
}

function dayLabel(day: number): string {
  if (day === 1) return "Day 1 (start date)";
  if (day > 0) return `Day ${day}`;
  return `Day ${day} (${-day} day${day === -1 ? "" : "s"} before start)`;
}

function weekdayOf(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function dayOfMonth(d: string | null): number {
  return d ? Number(d.split("-")[2]) : 0;
}

/** "Every Monday", "Every month on the 15th", … for a repeating schedule. */
function cadence(type: ScheduleFrequency, date: string | null): string {
  if (type === "daily") return "Every day";
  if (type === "weekly") return `Every ${weekdayOf(date)}`;
  const d = dayOfMonth(date);
  return `Every month on the ${ordinal(d)}${d > 28 ? " (last day in shorter months)" : ""}`;
}

function describe(s: ScheduledGroupMessage, start: string | null | undefined): string {
  if (s.scheduleType === "relative" && s.day != null) {
    // A finished message keeps the day it was set for; its send time is shown below.
    const date = s.status === "completed" ? null : relativeDate(start, s.day);
    return `${dayLabel(s.day)}${date ? ` · ${fmtDate(date)}` : ""} at ${fmtTime(s.time)} IST`;
  }
  if (s.scheduleType === "once") return `Once · ${fmtDate(s.date)} at ${fmtTime(s.time)} IST`;
  const until = s.endDate ? ` until ${fmtDate(s.endDate)}` : "";
  return `${cadence(s.scheduleType, s.date)} at ${fmtTime(s.time)} IST · from ${fmtDate(s.date)}${until}`;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  completed: "bg-[#2a2a2a] text-[#a0a0a0] border-[#333]",
  missed: "bg-red-500/15 text-red-400 border-red-500/30",
  cancelled: "bg-[#2a2a2a] text-[#606060] border-[#333]",
};

interface Props {
  group: AdminChatGroup;
  onClose: () => void;
}

export function ScheduledMessagesModal({ group, onClose }: Props) {
  const { data: items = [], isLoading, isError, refetch } = useAdminScheduledMessages(group.id);
  const [editing, setEditing] = useState<ScheduledGroupMessage | "new" | null>(null);
  const setStatus = useAdminSetScheduledStatus(group.id);
  const del = useAdminDeleteScheduledMessage(group.id);
  const { data: start } = useAdminScheduleStart(group.id);

  const counts = useMemo(
    () => ({ active: items.filter((i) => i.status === "active").length }),
    [items],
  );

  function toggle(s: ScheduledGroupMessage) {
    const status = s.status === "active" ? "paused" : "active";
    setStatus.mutate(
      { id: s.id, status },
      {
        onSuccess: () => toast.success(status === "paused" ? "Schedule paused" : "Schedule resumed"),
        onError: (e) => toast.error(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Failed"),
      },
    );
  }

  function remove(s: ScheduledGroupMessage) {
    if (!confirm("Delete this scheduled message? Messages already sent stay in the group.")) return;
    del.mutate(s.id, {
      onSuccess: () => toast.success("Scheduled message deleted"),
      onError: () => toast.error("Delete failed"),
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden bg-[#141414] border border-[#2a2a2a]">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#f0f0f0] uppercase tracking-widest font-rajdhani truncate">
              Scheduled messages
            </h3>
            <p className="text-xs text-[#606060] mt-0.5 truncate">
              {group.name} · {counts.active} active · times are IST
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editing === null && (
              <button
                onClick={() => setEditing("new")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest font-rajdhani"
              >
                <Plus size={14} /> Schedule
              </button>
            )}
            <button onClick={onClose} className="text-[#606060] hover:text-[#f0f0f0]" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <StartDatePanel
            groupId={group.id}
            pendingRelative={items.filter((i) => i.scheduleType === "relative" && (i.status === "active" || i.status === "paused")).length}
          />

          {editing === "new" && (
            <ScheduleForm startDate={start?.startDate ?? null} groupId={group.id} initial={null} onDone={() => setEditing(null)} />
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-[#606060] text-sm">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading…
            </div>
          ) : isError ? (
            <div className="py-10 text-center text-sm text-[#a0a0a0]">
              Couldn&apos;t load scheduled messages.{" "}
              <button onClick={() => refetch()} className="text-[#dc2626] underline">
                Retry
              </button>
            </div>
          ) : items.length === 0 && editing === null ? (
            <div className="py-10 text-center">
              <CalendarClock size={26} className="mx-auto text-[#606060] mb-3" />
              <p className="text-sm text-[#a0a0a0]">No scheduled messages for this group yet.</p>
              <p className="text-xs text-[#606060] mt-1">
                Schedule a one-time message, one that repeats daily, weekly or monthly, or messages for days
                counted from a start date (Day 10, Day 15, -1 …).
              </p>
            </div>
          ) : (
            items.map((s) => editing !== null && editing !== "new" && editing.id === s.id ? (
              // Edited where it is in the list.
              <ScheduleForm
                key={s.id}
                startDate={start?.startDate ?? null}
                groupId={group.id}
                initial={editing}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div key={s.id} className="rounded-lg border border-[#2a2a2a] bg-[#181818] p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-[#a0a0a0]">
                    {s.scheduleType === "once" || s.scheduleType === "relative" ? <CalendarClock size={16} /> : <Repeat size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#f0f0f0]">{describe(s, start?.startDate)}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest font-rajdhani ${STATUS_STYLE[s.status] ?? STATUS_STYLE.completed}`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <p className="text-sm text-[#d0d0d0] mt-1.5 whitespace-pre-wrap break-words line-clamp-4">
                      <FormattedText text={s.body} />
                    </p>
                    <div className="text-[11px] text-[#606060] mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                      {s.nextRunAt && s.status === "active" && <span>Next: {fmtInstant(s.nextRunAt)}</span>}
                      <span>Sent {s.sentCount}×</span>
                      {s.lastSentAt && <span>Last sent: {fmtInstant(s.lastSentAt)}</span>}
                      {s.createdBy && <span>By {s.createdBy}</span>}
                    </div>
                    {s.lastError && (
                      <p className="text-[11px] text-amber-400 mt-1.5 flex items-start gap-1">
                        <AlertTriangle size={12} className="mt-px flex-shrink-0" /> {s.lastError}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(s.status === "active" || s.status === "paused") && (
                      <button
                        onClick={() => toggle(s)}
                        disabled={setStatus.isPending}
                        title={s.status === "active" ? "Pause" : "Resume"}
                        aria-label={s.status === "active" ? "Pause" : "Resume"}
                        className="p-2 rounded-lg text-[#a0a0a0] hover:text-[#f0f0f0] hover:bg-[#1a1a1a] disabled:opacity-40"
                      >
                        {s.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                    )}
                    {s.status !== "cancelled" && (
                      <button
                        onClick={() => setEditing(s)}
                        title="Edit"
                        aria-label="Edit"
                        className="p-2 rounded-lg text-[#a0a0a0] hover:text-[#f0f0f0] hover:bg-[#1a1a1a]"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => remove(s)}
                      disabled={del.isPending}
                      title="Delete"
                      aria-label="Delete"
                      className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-[#1a1a1a] disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface RelativeRow {
  key: number;
  day: string;
  time: string;
  body: string;
}

function RelativeRows({
  rows,
  setRows,
  patchRow,
  startDate,
  single,
}: {
  rows: RelativeRow[];
  setRows: React.Dispatch<React.SetStateAction<RelativeRow[]>>;
  patchRow: (key: number, patch: Partial<RelativeRow>) => void;
  startDate: string | null;
  single: boolean;
}) {
  if (!startDate) {
    return (
      <p className="text-sm text-amber-400 flex items-start gap-1.5">
        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> Set this group&apos;s start date above first.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-[#a0a0a0]">
        Day 1 is the start date ({fmtDate(startDate)}), Day 10 is nine days later, -1 is the day before. Each message is
        sent once, posted under your name, and members get a notification.
      </p>
      {rows.map((r, i) => {
        const date = r.day.trim() === "" ? null : relativeDate(startDate, Number(r.day));
        return (
          <div key={r.key} className="rounded-lg border border-[#2a2a2a] bg-[#141414] p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL} htmlFor={`rel-day-${r.key}`}>
                  Day (e.g. 10 or -2)
                </label>
                <input
                  id={`rel-day-${r.key}`}
                  type="number"
                  step={1}
                  min={-365}
                  max={1000}
                  value={r.day}
                  onChange={(e) => patchRow(r.key, { day: e.target.value })}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor={`rel-time-${r.key}`}>
                  Time (IST)
                </label>
                <input
                  id={`rel-time-${r.key}`}
                  type="time"
                  value={r.time}
                  onChange={(e) => patchRow(r.key, { time: e.target.value })}
                  className={INPUT}
                />
              </div>
            </div>
            <textarea
              aria-label={`Message ${i + 1}`}
              value={r.body}
              onChange={(e) => patchRow(r.key, { body: e.target.value })}
              onKeyDown={(e) => { handleFormatShortcut(e, (body) => patchRow(r.key, { body })); }}
              rows={3}
              maxLength={5000}
              placeholder="Message to post on this day"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#dc2626] resize-y"
            />
            <div className="flex items-center justify-between text-xs">
              <span className={date ? "text-[#a0a0a0]" : "text-amber-400"}>
                {date
                  ? `Sends ${weekdayOf(date)}, ${fmtDate(date)} at ${fmtTime(r.time || null)} IST`
                  : r.day.trim() === "" ? "Enter a day" : "Use 1, 2, 3… or -1, -2… (no Day 0)"}
              </span>
              {rows.length > 1 && (
                <button
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  className="inline-flex items-center gap-1 text-red-400 hover:text-red-300"
                >
                  <Trash2 size={12} /> Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
      {!single && rows.length < 100 && (
        <button
          onClick={() =>
            setRows((rs) => [
              ...rs,
              { key: Math.max(...rs.map((x) => x.key)) + 1, day: "", time: rs[rs.length - 1].time, body: "" },
            ])
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#333] text-xs text-[#f0f0f0] hover:bg-[#1a1a1a]"
        >
          <Plus size={14} /> Add another day
        </button>
      )}
    </div>
  );
}

/** The group's start date: a linked batch's start date, or a custom one. */
function StartDatePanel({ groupId, pendingRelative }: { groupId: string; pendingRelative: number }) {
  const { data: start, isLoading, isError, refetch } = useAdminScheduleStart(groupId);
  const { data: batchesRes } = useListBatches();
  const batches = ((batchesRes as any)?.data ?? []) as Array<{ id: string; name: string; startsAt: string }>;
  const save = useAdminSetScheduleStart(groupId);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [date, setDate] = useState("");

  function edit() {
    setSource(start?.batchId && !start.batchMissing ? start.batchId : start?.customDate ? "custom" : "");
    setDate(start?.customDate ?? istToday());
    setOpen(true);
  }

  async function submit() {
    if (source === "custom" && !date) return toast.error("Pick a start date.");
    if (
      pendingRelative > 0 &&
      !confirm(
        `${pendingRelative} unsent message${pendingRelative === 1 ? "" : "s"} will move to the new start date. Any whose day has already passed won't be sent. Continue?`,
      )
    )
      return;
    try {
      await save.mutateAsync(
        source === "custom" ? { startDate: date } : source ? { batchId: source } : { batchId: null, startDate: null },
      );
      toast.success(source ? "Start date saved" : "Start date cleared");
      setOpen(false);
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Save failed");
    }
  }

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#181818] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className={LABEL}>Start date (Day 1)</div>
          <p className="text-sm text-[#f0f0f0] mt-0.5 break-words">
            {isLoading ? (
              "Loading…"
            ) : isError ? (
              <>
                Couldn&apos;t load.{" "}
                <button onClick={() => refetch()} className="text-[#dc2626] underline">Retry</button>
              </>
            ) : start?.batchMissing ? (
              <span className="text-amber-400">The linked batch was deleted — choose another start date.</span>
            ) : start?.startDate ? (
              `${fmtDate(start.startDate)} · ${start.batchName ? `Batch: ${start.batchName}` : "Custom date"}`
            ) : (
              <span className="text-[#a0a0a0]">Not set. Needed for messages sent by day (Day 10, -1 …).</span>
            )}
          </p>
        </div>
        {!open && !isLoading && !isError && (
          <button
            onClick={edit}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-[#333] text-xs text-[#f0f0f0] hover:bg-[#1a1a1a]"
          >
            {start?.startDate ? "Change" : "Set"}
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="start-source">
                Count days from
              </label>
              <select id="start-source" value={source} onChange={(e) => setSource(e.target.value)} className={INPUT}>
                <option value="">Not set</option>
                <option value="custom">A custom date</option>
                <optgroup label="Batch start date">
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {fmtDate(new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(b.startsAt)))}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            {source === "custom" && (
              <div>
                <label className={LABEL} htmlFor="start-custom">
                  Start date
                </label>
                <input id="start-custom" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
              </div>
            )}
          </div>
          <p className="text-xs text-[#a0a0a0]">
            With a batch, unsent messages follow the batch if its start date is changed in Batches.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-[#a0a0a0] hover:text-[#f0f0f0]">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={save.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani disabled:opacity-60"
            >
              {save.isPending && <Loader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleForm({
  groupId,
  startDate,
  initial,
  onDone,
}: {
  groupId: string;
  startDate: string | null;
  initial: ScheduledGroupMessage | null;
  onDone: () => void;
}) {
  const save = useAdminSaveScheduledMessage(groupId);
  const [scheduleType, setScheduleType] = useState<ScheduleFrequency>(initial?.scheduleType ?? "once");
  const relative = scheduleType === "relative";
  const repeating = scheduleType !== "once" && !relative;
  const bulk = useAdminBulkScheduleRelative(groupId);
  const busy = save.isPending || bulk.isPending;
  const [rows, setRows] = useState<RelativeRow[]>([
    {
      key: 0,
      day: initial?.day != null ? String(initial.day) : "",
      time: (initial?.scheduleType === "relative" && initial.time) || "09:00",
      body: initial?.body ?? "",
    },
  ]);

  function patchRow(key: number, patch: Partial<RelativeRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function submitRelative() {
    if (!startDate) return toast.error("Set the start date for this group first.");
    const items = [];
    for (const r of rows) {
      const day = Number(r.day);
      if (r.day.trim() === "" || !Number.isInteger(day) || day === 0) {
        return toast.error("Enter a day for every message — 1 is the start date, -1 is the day before. There is no Day 0.");
      }
      if (!r.time) return toast.error(`Pick a time for Day ${day}.`);
      if (!r.body.trim()) return toast.error(`Write the message for Day ${day}.`);
      items.push({ day, time: r.time, body: r.body.trim() });
    }
    try {
      if (initial) await save.mutateAsync({ id: initial.id, scheduleType: "relative", ...items[0] });
      else await bulk.mutateAsync(items);
      toast.success(initial ? "Schedule updated" : items.length === 1 ? "Message scheduled" : `${items.length} messages scheduled`);
      onDone();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Save failed");
    }
  }

  const [body, setBody] = useState(initial?.body ?? "");
  const [date, setDate] = useState(initial?.date ?? istToday());
  const [time, setTime] = useState(initial?.time ?? istNextHour());
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");

  async function submit() {
    if (relative) return submitRelative();
    if (!body.trim()) return toast.error("Write the message first.");
    if (!date || !time) return toast.error("Pick a date and time.");
    try {
      await save.mutateAsync({
        id: initial?.id,
        scheduleType,
        body: body.trim(),
        date,
        time,
        endDate: repeating && endDate ? endDate : null,
      });
      toast.success(initial ? "Schedule updated" : "Message scheduled");
      onDone();
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Save failed");
    }
  }

  return (
    <div className="rounded-lg border border-[#dc2626]/40 bg-[#181818] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#f0f0f0] uppercase tracking-widest font-rajdhani">
          {initial ? "Edit scheduled message" : "New scheduled message"}
        </span>
      </div>

      <div>
        <label className={LABEL} htmlFor="sched-frequency">
          Frequency
        </label>
        <select
          id="sched-frequency"
          value={scheduleType}
          onChange={(e) => setScheduleType(e.target.value as ScheduleFrequency)}
          className={INPUT}
        >
          {FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {relative ? (
        <RelativeRows rows={rows} setRows={setRows} patchRow={patchRow} startDate={startDate} single={!!initial} />
      ) : (
      <>
      <div>
        <label className={LABEL} htmlFor="sched-body">
          Message
        </label>
        <textarea
          id="sched-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { handleFormatShortcut(e, setBody); }}
          rows={4}
          maxLength={5000}
          placeholder="e.g. Good morning, tribe! Share today's top priority in this group."
          className="mt-1.5 w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#dc2626] resize-y"
        />
        <div className="text-[10px] text-[#606060] text-right">{body.length}/5000</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={LABEL} htmlFor="sched-date">
            {scheduleType === "once" ? "Date" : "Start date"}
          </label>
          <input id="sched-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
        </div>
        <div>
          <label className={LABEL} htmlFor="sched-time">
            Time (IST)
          </label>
          <input id="sched-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT} />
        </div>
        {repeating && (
          <div>
            <label className={LABEL} htmlFor="sched-end">
              End date (optional)
            </label>
            <input
              id="sched-end"
              type="date"
              value={endDate}
              min={date}
              onChange={(e) => setEndDate(e.target.value)}
              className={INPUT}
            />
          </div>
        )}
      </div>

      <p className="text-xs text-[#a0a0a0]">
        {scheduleType === "once"
          ? `Sends once on ${fmtDate(date)} at ${fmtTime(time)} IST.`
          : `Sends ${cadence(scheduleType, date).replace(/^Every/, "every")} at ${fmtTime(time)} IST, starting ${fmtDate(date)}${
              endDate ? ` until ${fmtDate(endDate)}` : " until you pause or delete it"
            }.`}{" "}
        It is posted under your name and members get a notification.
      </p>
      </>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onDone}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-sm text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy || (relative && !startDate)}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
          {initial ? "Save" : relative && rows.length > 1 ? `Schedule ${rows.length} messages` : "Schedule"}
        </button>
      </div>
    </div>
  );
}

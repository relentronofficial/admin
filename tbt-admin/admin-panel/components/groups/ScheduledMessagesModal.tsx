"use client";

// Admin — schedule messages for a group chat: once (a date + time), or
// repeating daily / weekly (start date's weekday) / monthly (start date's day
// of the month; last day in shorter months), from a start date and
// optionally until an end date. All dates and times are IST. The backend posts them as the admin who created
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
  useAdminDeleteScheduledMessage,
  useAdminSaveScheduledMessage,
  useAdminScheduledMessages,
  useAdminSetScheduledStatus,
  type AdminChatGroup,
  type ScheduleFrequency,
  type ScheduledGroupMessage,
} from "@/lib/hooks/useChatGroups";

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
];

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

function describe(s: ScheduledGroupMessage): string {
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
          {editing !== null && (
            <ScheduleForm
              groupId={group.id}
              initial={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
            />
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
                Schedule a one-time message, or one that repeats daily, weekly or monthly.
              </p>
            </div>
          ) : (
            items.map((s) => (
              <div key={s.id} className="rounded-lg border border-[#2a2a2a] bg-[#181818] p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-[#a0a0a0]">
                    {s.scheduleType === "once" ? <CalendarClock size={16} /> : <Repeat size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#f0f0f0]">{describe(s)}</span>
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

function ScheduleForm({
  groupId,
  initial,
  onDone,
}: {
  groupId: string;
  initial: ScheduledGroupMessage | null;
  onDone: () => void;
}) {
  const save = useAdminSaveScheduledMessage(groupId);
  const [scheduleType, setScheduleType] = useState<ScheduleFrequency>(initial?.scheduleType ?? "once");
  const repeating = scheduleType !== "once";
  const [body, setBody] = useState(initial?.body ?? "");
  const [date, setDate] = useState(initial?.date ?? istToday());
  const [time, setTime] = useState(initial?.time ?? istNextHour());
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");

  async function submit() {
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

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onDone}
          disabled={save.isPending}
          className="px-4 py-2 rounded-lg text-sm text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={save.isPending}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold uppercase tracking-widest font-rajdhani disabled:opacity-60"
        >
          {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
          {initial ? "Save" : "Schedule"}
        </button>
      </div>
    </div>
  );
}

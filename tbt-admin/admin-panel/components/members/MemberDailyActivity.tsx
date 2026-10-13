"use client";

import { useState } from "react";
import { Clock, CalendarDays, PlayCircle, Activity, Loader2, AlertCircle, RefreshCw, Info } from "lucide-react";
import { useMemberDailyActivity } from "@/lib/hooks/useTbt";

// Daily Time Spent — read-only. Values are calculated on the server from
// recorded activity minutes (see backend lib/memberActivity.ts); admins cannot
// edit them.

const RANGES = [30, 90, 180] as const;

const fmtMinutes = (m: number) => {
  if (!m) return "0m";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h ? `${h}h ${String(min).padStart(2, "0")}m` : `${min}m`;
};

const labelCls = "text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani";
const cardCls = "bg-[#181818] border border-[#2a2a2a] rounded-xl";

export function MemberDailyActivity({ memberId }: { memberId: string }) {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, isError, refetch, isFetching } = useMemberDailyActivity(memberId, days);

  const tz: string = data?.timezone ?? "Asia/Kolkata";
  const fmtDateTime = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("en-IN", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
      : "—";
  const fmtTime = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("en-IN", { timeZone: tz, timeStyle: "short" }).format(new Date(iso)) : "—";
  const fmtDay = (date: string) =>
    new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00Z`));

  if (isLoading) {
    return (
      <div className={`${cardCls} flex items-center justify-center py-16`}>
        <Loader2 size={22} className="animate-spin text-[#dc2626]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={`${cardCls} flex flex-col items-center justify-center py-12 gap-3`}>
        <AlertCircle size={22} className="text-[#dc2626]" />
        <p className="text-[13px] text-[#a0a0a0]">Couldn&apos;t load activity data.</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest font-rajdhani text-[#f0f0f0] bg-[#1a1a1a] border border-[#333] px-3 py-1.5 rounded-md hover:border-[#dc2626]"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  const daysList: any[] = data.days ?? [];
  const chronological = [...daysList].reverse();
  const maxMinutes = Math.max(60, ...daysList.map((d) => d.activeMinutes));
  const trackingStart: string | null = data.trackingStartDate;
  const hasAnyActivity = daysList.some((d) => d.activeMinutes > 0);
  const untrackedInRange = daysList.some((d) => !d.tracked);

  const stats = [
    { label: "Today", value: data.today?.tracked ? fmtMinutes(data.today.activeMinutes) : "Not tracked", sub: data.today?.mediaMinutes ? `${fmtMinutes(data.today.mediaMinutes)} watching/listening` : "Active time", icon: <Clock size={16} /> },
    { label: "Last 7 days", value: fmtMinutes(data.last7Days?.activeMinutes ?? 0), sub: `${data.last7Days?.activeDays ?? 0} active of ${data.last7Days?.trackedDays ?? 0} tracked days`, icon: <CalendarDays size={16} /> },
    { label: "Last 30 days", value: fmtMinutes(data.last30Days?.activeMinutes ?? 0), sub: `${data.last30Days?.activeDays ?? 0} active of ${data.last30Days?.trackedDays ?? 0} tracked days`, icon: <Activity size={16} /> },
    { label: "Last active", value: data.lastActiveAt ? fmtDateTime(data.lastActiveAt) : "—", sub: data.lastSeenAt ? `Last connected ${fmtDateTime(data.lastSeenAt)}` : "From recorded activity", icon: <PlayCircle size={16} /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header + range */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-rajdhani text-[15px] font-bold uppercase tracking-widest text-[#f0f0f0]">Daily Time Spent</h2>
          <p className="text-[11px] text-[#777] mt-0.5">
            Active time on the website, per day ({tz === "Asia/Kolkata" ? "IST" : tz}).
            {trackingStart ? ` Tracking since ${fmtDay(trackingStart)}.` : " Tracking has not recorded any activity yet."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 size={13} className="animate-spin text-[#777]" />}
          <div className="flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest font-rajdhani transition-all ${days === r ? "bg-[#dc2626] text-white" : "text-[#888] hover:text-[#f0f0f0]"}`}
              >
                {r} days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`${cardCls} p-4`}>
            <div className="flex items-center gap-2 text-[#dc2626] mb-2">{s.icon}<span className={labelCls}>{s.label}</span></div>
            <p className="text-lg font-bold text-[#f0f0f0] font-rajdhani leading-tight">{s.value}</p>
            <p className="text-[10px] text-[#777] mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Day-by-day chart */}
      <div className={`${cardCls} p-5`}>
        <p className={`${labelCls} mb-3`}>Active minutes per day</p>
        {!hasAnyActivity ? (
          <p className="text-[12px] text-[#777] py-6 text-center">
            {trackingStart ? "No activity recorded in this period." : "No activity has been recorded yet."}
          </p>
        ) : (
          <div className="flex items-end gap-[2px] h-32" role="img" aria-label="Active minutes per day">
            {chronological.map((d) => (
              <div
                key={d.date}
                className="flex-1 min-w-[2px] rounded-t-sm"
                title={d.tracked ? `${fmtDay(d.date)} — ${fmtMinutes(d.activeMinutes)}` : `${fmtDay(d.date)} — not tracked`}
                style={{
                  height: d.tracked ? `${Math.max(d.activeMinutes > 0 ? 4 : 1, (d.activeMinutes / maxMinutes) * 100)}%` : "100%",
                  background: !d.tracked
                    ? "repeating-linear-gradient(45deg, #1f1f1f 0 3px, #262626 3px 6px)"
                    : d.activeMinutes > 0 ? "#dc2626" : "#2a2a2a",
                }}
              />
            ))}
          </div>
        )}
        {untrackedInRange && (
          <p className="text-[10px] text-[#777] mt-2 flex items-center gap-1">
            <Info size={11} /> Striped days are before tracking started — usage on those days is unknown, not zero.
          </p>
        )}
      </div>

      {/* Weekly + monthly */}
      <div className="grid md:grid-cols-2 gap-3">
        {[{ title: "Weekly (Mon–Sun)", rows: data.weekly ?? [] }, { title: "Monthly", rows: data.monthly ?? [] }].map((block) => (
          <div key={block.title} className={`${cardCls} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-[#2a2a2a]"><p className={labelCls}>{block.title}</p></div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[#606060] text-[10px] uppercase tracking-wider">
                  <th className="px-5 py-2 font-bold">Period</th>
                  <th className="px-3 py-2 font-bold">Active time</th>
                  <th className="px-3 py-2 font-bold">Active days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f]">
                {block.rows.map((p: any) => (
                  <tr key={p.label}>
                    <td className="px-5 py-2 text-[#a0a0a0]">
                      {fmtDay(p.startDate)} – {fmtDay(p.endDate)}
                      {p.totalDays < (p.label.includes("-W") ? 7 : 28) && <span className="text-[#606060]"> (partial)</span>}
                    </td>
                    <td className="px-3 py-2 text-[#f0f0f0] font-bold">{p.trackedDays === 0 ? "Not tracked" : fmtMinutes(p.activeMinutes)}</td>
                    <td className="px-3 py-2 text-[#a0a0a0]">{p.activeDays} / {p.trackedDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Daily table */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-[#2a2a2a]"><p className={labelCls}>Daily detail</p></div>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[#181818]">
              <tr className="text-left text-[#606060] text-[10px] uppercase tracking-wider">
                <th className="px-5 py-2 font-bold">Date</th>
                <th className="px-3 py-2 font-bold">Active time</th>
                <th className="px-3 py-2 font-bold">Watching / listening</th>
                <th className="px-3 py-2 font-bold">First active</th>
                <th className="px-3 py-2 font-bold">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f1f]">
              {daysList.map((d) => (
                <tr key={d.date} className={d.tracked ? "" : "opacity-50"}>
                  <td className="px-5 py-2 text-[#a0a0a0]">{fmtDay(d.date)}</td>
                  {d.tracked ? (
                    <>
                      <td className="px-3 py-2 text-[#f0f0f0] font-bold">{fmtMinutes(d.activeMinutes)}</td>
                      <td className="px-3 py-2 text-[#a0a0a0]">{fmtMinutes(d.mediaMinutes)}</td>
                      <td className="px-3 py-2 text-[#777]">{fmtTime(d.firstActiveAt)}</td>
                      <td className="px-3 py-2 text-[#777]">{fmtTime(d.lastActiveAt)}</td>
                    </>
                  ) : (
                    <td colSpan={4} className="px-3 py-2 text-[#606060] italic">Not tracked (before tracking started)</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-[#606060] leading-relaxed">
        How this is measured: a minute counts when the member has the website open in a visible tab and clicked, typed,
        scrolled or touched within the last 5 minutes, or while a video/audio is playing (course and workshop video progress
        also counts). Hidden tabs, idle tabs and closed browsers are not counted. Several tabs or devices in the same minute
        count once. Mobile-app time is only counted while a course or workshop video is playing.
      </p>
    </div>
  );
}

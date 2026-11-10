"use client";

import { useState } from "react";
import { Loader2, AlertCircle, RefreshCw, CalendarDays, Flame, Coins, BookOpen } from "lucide-react";
import { useMemberTbtActivityLog } from "@/lib/hooks/useTbt";
import type { ActivityPeriodRow, ActivitySourceBreakdown } from "@/lib/hooks/useTbt";

const cardCls = "bg-[#181818] border border-[#2a2a2a] rounded-xl";
const labelCls = "text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani";

function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}
function daysAgoIST(n: number): string {
  const d = new Date(Date.parse(`${todayIST()}T00:00:00Z`) - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}
function fmtPts(n: number) {
  return n.toLocaleString("en-IN");
}

const SOURCE_LABELS: Record<string, string> = {
  course_xp: "Course XP",
  course_task: "Course Task",
  task_submission: "Task Submission",
  batch_day: "Batch Day",
  workshop_episode: "Workshop Episode",
  workshop_challenge: "Workshop Challenge",
  workshop_assignment: "Workshop Assignment",
  task_completion: "Task Completion",
  coin_purchase: "Coin Purchase",
  admin_grant: "Admin Grant",
  early_completion: "Early Completion",
  lifeline_spend: "Lifeline Spend",
  support_call_unlock: "Support Call Unlock",
  support_call_purchase: "Support Call Purchase",
};

export function MemberActivityLog({ memberId }: { memberId: string }) {
  const [view, setView] = useState<"daily" | "weekly" | "monthly">("daily");
  const [from, setFrom] = useState(() => daysAgoIST(29));
  const [to, setTo] = useState(() => todayIST());
  const [sourceGroup, setSourceGroup] = useState<"all" | "learning" | "coins">("all");

  const { data, isLoading, isError, refetch, isFetching } = useMemberTbtActivityLog(memberId, { view, from, to, sourceGroup });

  const handleFromChange = (v: string) => {
    if (!v) return;
    const maxFrom = new Date(Date.parse(`${to}T00:00:00Z`) - 366 * 86_400_000).toISOString().slice(0, 10);
    setFrom(v < maxFrom ? maxFrom : v);
  };
  const handleToChange = (v: string) => {
    if (!v) return;
    const cap = todayIST();
    setTo(v > cap ? cap : v);
  };

  if (isLoading) {
    return (
      <div className={`${cardCls} flex items-center justify-center py-16`}>
        <Loader2 size={22} className="animate-spin text-[#dc2626]" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className={`${cardCls} flex flex-col items-center justify-center py-12 gap-3`}>
        <AlertCircle size={22} className="text-[#dc2626]" />
        <p className="text-[13px] text-[#a0a0a0]">Couldn&apos;t load activity log.</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest font-rajdhani text-[#f0f0f0] bg-[#1a1a1a] border border-[#333] px-3 py-1.5 rounded-md hover:border-[#dc2626]"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  const summary = data?.summary;
  const rows: ActivityPeriodRow[] = data?.rows ?? [];
  const sources: ActivitySourceBreakdown[] = data?.sources ?? [];
  const isEmpty = rows.length === 0;

  const maxEarned = Math.max(1, ...rows.map((r) => r.earned));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-rajdhani text-[15px] font-bold uppercase tracking-widest text-[#f0f0f0]">Points &amp; Activity Log</h2>
          {summary && <p className="text-[11px] text-[#777] mt-0.5">{summary.rangeLabel}</p>}
        </div>
        {isFetching && <Loader2 size={13} className="animate-spin text-[#777]" />}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="flex bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-0.5">
          {(["daily", "weekly", "monthly"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest font-rajdhani transition-all ${view === v ? "bg-[#dc2626] text-white" : "text-[#888] hover:text-[#f0f0f0]"}`}
            >
              {v}
            </button>
          ))}
        </div>
        {/* Date range */}
        <div className="flex items-center gap-2 text-[11px] text-[#a0a0a0]">
          <span className={labelCls}>From</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => handleFromChange(e.target.value)}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1 text-[12px] text-white outline-none focus:border-[#dc2626]"
          />
          <span className={labelCls}>To</span>
          <input
            type="date"
            value={to}
            max={todayIST()}
            onChange={(e) => handleToChange(e.target.value)}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1 text-[12px] text-white outline-none focus:border-[#dc2626]"
          />
        </div>
        {/* Source filter */}
        <select
          value={sourceGroup}
          onChange={(e) => setSourceGroup(e.target.value as "all" | "learning" | "coins")}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-3 py-1.5 text-[12px] text-white outline-none focus:border-[#dc2626]"
        >
          <option value="all">All Activity</option>
          <option value="learning">Learning Only</option>
          <option value="coins">Coins Only</option>
        </select>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={`${cardCls} p-4`}>
            <div className="flex items-center gap-2 text-[#22c55e] mb-2"><Coins size={15} /><span className={labelCls}>Total Earned</span></div>
            <p className="text-lg font-bold text-[#f0f0f0] font-rajdhani">{fmtPts(summary.totalEarned)} pts</p>
          </div>
          <div className={`${cardCls} p-4`}>
            <div className="flex items-center gap-2 text-[#dc2626] mb-2"><Coins size={15} /><span className={labelCls}>Total Spent</span></div>
            <p className="text-lg font-bold text-[#f0f0f0] font-rajdhani">−{fmtPts(summary.totalSpent)} pts</p>
          </div>
          <div className={`${cardCls} p-4`}>
            <div className="flex items-center gap-2 text-[#3b82f6] mb-2"><CalendarDays size={15} /><span className={labelCls}>Active Days</span></div>
            <p className="text-lg font-bold text-[#f0f0f0] font-rajdhani">{summary.activeDays} days</p>
          </div>
          <div className={`${cardCls} p-4`}>
            <div className="flex items-center gap-2 text-[#f97316] mb-2"><Flame size={15} /><span className={labelCls}>Current Streak</span></div>
            <p className="text-lg font-bold text-[#f0f0f0] font-rajdhani">{summary.currentStreak} days 🔥</p>
          </div>
        </div>
      )}

      {/* Bar chart */}
      {!isEmpty && (
        <div className={`${cardCls} p-5`}>
          <p className={`${labelCls} mb-3`}>Earned pts per {view === "daily" ? "day" : view === "weekly" ? "week" : "month"}</p>
          <div className="flex items-end gap-[3px] h-28" role="img" aria-label="Points earned per period">
            {[...rows].reverse().map((r) => (
              <div key={r.periodKey} className="flex-1 flex flex-col items-center gap-[1px] min-w-[3px]">
                <div
                  className="w-full rounded-t-sm bg-[#dc2626] transition-all"
                  style={{ height: `${Math.max(r.earned > 0 ? 4 : 1, (r.earned / maxEarned) * 100)}%` }}
                  title={`${r.label}\nEarned: ${fmtPts(r.earned)} | Spent: −${fmtPts(r.spent)} | Events: ${r.activeLearningEvents}`}
                />
                {r.spent > 0 && (
                  <div
                    className="w-full rounded-b-sm bg-[#7f1d1d] opacity-60"
                    style={{ height: `${Math.max(2, (r.spent / maxEarned) * 30)}%` }}
                    title={`Spent: −${fmtPts(r.spent)}`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className={`${cardCls} flex flex-col items-center justify-center py-12 gap-3`}>
          <BookOpen size={28} className="text-[#444]" />
          <p className="text-[13px] text-[#777]">No activity recorded in this period.</p>
        </div>
      )}

      {/* Periods table */}
      {!isEmpty && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="px-5 py-3 border-b border-[#2a2a2a]"><p className={labelCls}>Period breakdown</p></div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-[#181818]">
                <tr className="text-left text-[#606060] text-[10px] uppercase tracking-wider">
                  <th className="px-5 py-2 font-bold">Period</th>
                  <th className="px-3 py-2 font-bold text-right">Earned</th>
                  <th className="px-3 py-2 font-bold text-right">Spent</th>
                  <th className="px-3 py-2 font-bold text-right">Net</th>
                  <th className="px-3 py-2 font-bold text-right">Events</th>
                  <th className="px-5 py-2 font-bold">Top Sources</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f]">
                {rows.map((r) => (
                  <tr key={r.periodKey} className="hover:bg-[#1a1a1a]">
                    <td className="px-5 py-2.5 text-[#a0a0a0] whitespace-nowrap">{r.label}</td>
                    <td className="px-3 py-2.5 text-[#22c55e] text-right font-bold">+{fmtPts(r.earned)}</td>
                    <td className="px-3 py-2.5 text-[#dc2626] text-right">{r.spent > 0 ? `−${fmtPts(r.spent)}` : "—"}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${r.net >= 0 ? "text-[#f0f0f0]" : "text-[#dc2626]"}`}>
                      {r.net >= 0 ? `+${fmtPts(r.net)}` : `−${fmtPts(Math.abs(r.net))}`}
                    </td>
                    <td className="px-3 py-2.5 text-[#a0a0a0] text-right">{r.activeLearningEvents}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {r.topSources.map((s) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[#a0a0a0]">
                            {SOURCE_LABELS[s] ?? s}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Source breakdown */}
      {sources.length > 0 && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="px-5 py-3 border-b border-[#2a2a2a]"><p className={labelCls}>Source breakdown</p></div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[#606060] text-[10px] uppercase tracking-wider">
                <th className="px-5 py-2 font-bold">Source</th>
                <th className="px-3 py-2 font-bold">Type</th>
                <th className="px-3 py-2 font-bold text-right">Events</th>
                <th className="px-3 py-2 font-bold text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f1f]">
              {sources.map((s) => (
                <tr key={s.source} className="hover:bg-[#1a1a1a]">
                  <td className="px-5 py-2.5 text-[#f0f0f0]">{SOURCE_LABELS[s.source] ?? s.source}</td>
                  <td className="px-3 py-2.5">
                    {s.isLearning ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#14532d] text-[#22c55e]">Learning</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2a2a] text-[#a0a0a0]">Coins</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[#a0a0a0] text-right">{s.events}</td>
                  <td className={`px-3 py-2.5 text-right font-bold ${s.points >= 0 ? "text-[#22c55e]" : "text-[#dc2626]"}`}>
                    {s.points >= 0 ? `+${fmtPts(s.points)}` : `−${fmtPts(Math.abs(s.points))}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

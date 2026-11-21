"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Clock } from "lucide-react";
import { useMe } from "@/lib/hooks/useUser";
import { useWeeklyReportStatus } from "@/lib/hooks/useCourseReports";
import { getServerNow } from "@/lib/api/client";
import { WeeklyReportModal } from "./WeeklyReportModal";

const DISMISS_KEY = "tbt_weekly_report_dismissed";

/** IST calendar date, e.g. "2026-11-21". */
const istDay = (ms: number) => new Date(ms + 330 * 60_000).toISOString().slice(0, 10);

function readDismissed(): string | null {
  try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
}
function writeDismissed(v: string) {
  try { localStorage.setItem(DISMISS_KEY, v); } catch { /* private mode — popup just shows again */ }
}

/**
 * Mandatory weekly report reminder, mounted in both platform layouts.
 * - Friday and Saturday: popup with the report form until this week's report is in.
 *   "Later" hides it for the rest of the day; on Saturday it comes back at 6:00 PM.
 * - From Saturday 6:00 PM, while videos are locked: popup once a day until submitted.
 * - `?weeklyReport=1` (the reminder notification's link) always opens it.
 * The lesson page shows its own locked-video screen; this is the app-wide nudge.
 */
export function WeeklyReportReminder() {
  const { data: me } = useMe();
  const isActive = (me as any)?.status === "active";
  const { data: status } = useWeeklyReportStatus(isActive);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const forced = params?.get("weeklyReport") === "1";

  // Re-evaluate every minute so Saturday 6:00 PM flips the popup on without a reload.
  const [now, setNow] = useState(() => getServerNow());
  useEffect(() => {
    const id = setInterval(() => setNow(getServerNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [open, setOpen] = useState(false);
  const pastDeadline = !!status && now >= new Date(status.deadline).getTime();
  const slot = status ? `${istDay(now)}:${pastDeadline ? "late" : "early"}` : "";

  useEffect(() => {
    if (!status || open) return;
    if (forced && status.required) { setOpen(true); return; }
    if ((status.showReminder || status.locked) && readDismissed() !== slot) setOpen(true);
  }, [status, slot, forced, open]);

  if (!open || !status) return null;

  const close = () => {
    writeDismissed(slot);
    setOpen(false);
    if (forced) {
      const next = new URLSearchParams(params?.toString());
      next.delete("weeklyReport");
      router.replace(next.size ? `${pathname}?${next}` : pathname);
    }
  };

  const locked = status.locked;
  const intro = (
    <div
      className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed"
      style={{
        background: `color-mix(in srgb, var(${locked ? "--color-alert" : "--color-accent"}) 12%, transparent)`,
        color: "var(--color-text-normal)",
      }}
    >
      {locked
        ? <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "var(--color-alert)" }} />
        : <Clock size={14} className="shrink-0 mt-0.5" style={{ color: "var(--color-accent)" }} />}
      <span>
        {locked
          ? "Course videos are locked until you submit your weekly report. Submit it now to keep learning."
          : "Your weekly report is due by Saturday 6:00 PM. Submitting it is required — course videos lock at 6:00 PM on Saturday until it's in."}
      </span>
    </div>
  );

  return <WeeklyReportModal onClose={close} intro={intro} />;
}

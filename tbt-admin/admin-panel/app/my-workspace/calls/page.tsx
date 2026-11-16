"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useMyWorkspaceCalls } from "@/lib/hooks/useTbt";
import { Card, EmptyState, ErrorState, FilterTabs, LoadingRow, Pill, WorkspaceHeader, humanize, useQueryState } from "@/components/my-workspace/WorkspaceUi";

const WHENS = ["today", "upcoming", "past"];

const STATUS_TONE: Record<string, "red" | "green" | "gray" | "blue"> = {
  live: "red", scheduled: "blue", ended: "gray", completed: "green", cancelled: "gray",
};

export default function MyCallsPage() {
  const [when, setWhen] = useQueryState("when", "today", WHENS);
  const { data, isLoading, isError, refetch } = useMyWorkspaceCalls({ when });
  const rows: any[] = data?.data ?? [];

  // Group by calendar day so upcoming/past lists read like an agenda.
  const days: { day: string; calls: any[] }[] = [];
  for (const c of rows) {
    const day = format(new Date(c.startsAt), "EEE, d MMM yyyy");
    const last = days[days.length - 1];
    if (last?.day === day) last.calls.push(c);
    else days.push({ day, calls: [c] });
  }

  return (
    <DashboardLayout>
      <WorkspaceHeader icon={CalendarClock} title="My Calls" subtitle="Support-call slots and onboarding verification calls you host." />

      <div className="mb-4">
        <FilterTabs
          value={when}
          onChange={setWhen}
          options={[
            { key: "today", label: "Today" },
            { key: "upcoming", label: "Upcoming" },
            { key: "past", label: "Past 30 days" },
          ]}
        />
      </div>

      <Card>
        {isLoading ? (
          <LoadingRow />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState text={when === "today" ? "No calls to host today." : when === "upcoming" ? "No upcoming calls." : "No calls in the last 30 days."} />
        ) : (
          days.map((d) => (
            <div key={d.day}>
              <p className="px-4 pt-4 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">{d.day}</p>
              <ul>
                {d.calls.map((c) => (
                  <li key={`${c.kind}-${c.id}`} className="border-b border-[#222] last:border-0">
                    <Link
                      href={c.kind === "onboarding" ? "/onboarding" : "/support-calls"}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-[#1f1f1f]"
                    >
                      <div className="w-20 flex-shrink-0">
                        <p className="text-[13px] font-semibold tabular-nums text-[#f0f0f0]">{format(new Date(c.startsAt), "h:mm a")}</p>
                        <p className="text-[11px] text-[#808080]">{c.durationMinutes} min</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-[#f0f0f0] truncate">{c.title}</p>
                        <p className="text-[11px] text-[#808080] truncate">
                          {c.kind === "onboarding"
                            ? `Onboarding verification · ${c.memberName || "member"}`
                            : `${humanize(c.category)} · ${c.booked ?? 0}/${c.capacity ?? 0} booked`}
                        </p>
                      </div>
                      <Pill tone={STATUS_TONE[c.status] ?? "gray"}>{humanize(c.status)}</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Card>
    </DashboardLayout>
  );
}

"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Briefcase, ChevronRight, CheckCircle2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useMyWorkspaceCalls, useMyWorkspaceSummary } from "@/lib/hooks/useTbt";
import { Card, EmptyState, ErrorState, LoadingRow, Pill, StatTile, WorkspaceHeader, humanize } from "@/components/my-workspace/WorkspaceUi";
import { cn } from "@/lib/utils";

// One line per kind of pending work computed by the backend (buildPendingWork).
const PENDING_LABEL: Record<string, (n: number, days: number) => string> = {
  tickets_new: (n) => `${n} new ticket${n === 1 ? "" : "s"} to acknowledge`,
  tickets_overdue: (n) => `${n} ticket${n === 1 ? " is" : "s are"} past the resolve deadline`,
  calls_today: (n) => `${n} call${n === 1 ? "" : "s"} to host today`,
  members_under_review: (n) => `${n} member${n === 1 ? "" : "s"} waiting for KYC review`,
  member_tickets_unassigned: (n) => `${n} ticket${n === 1 ? "" : "s"} from your members with no one assigned`,
  tickets_open: (n) => `${n} other open ticket${n === 1 ? "" : "s"} assigned to you`,
  members_inactive: (n, days) => `${n} member${n === 1 ? " has" : "s have"} been inactive ${days}+ days — follow up`,
};

const SEVERITY_DOT: Record<string, string> = { urgent: "bg-[#dc2626]", high: "bg-[#f59e0b]", normal: "bg-[#606060]" };

export default function MyWorkspacePage() {
  const { data: summary, isLoading, isError, refetch } = useMyWorkspaceSummary();
  const { data: todayCalls } = useMyWorkspaceCalls({ when: "today" });
  const c = summary?.counts ?? {};
  const pending: any[] = summary?.pending ?? [];
  const firstName = (summary?.admin?.fullName ?? "").split(" ")[0];

  return (
    <DashboardLayout>
      <WorkspaceHeader
        icon={Briefcase}
        title={firstName ? `${firstName}'s Workspace` : "My Workspace"}
        subtitle="Only the members, tickets, calls and team mapped to you. The rest of the menu still shows everything."
      />

      {isLoading ? (
        <LoadingRow />
      ) : isError || !summary ? (
        <Card><ErrorState onRetry={() => refetch()} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
            <StatTile label="My members" value={c.membersTotal ?? 0} href="/my-workspace/members" />
            <StatTile label="Active" value={c.membersActive ?? 0} href="/my-workspace/members?filter=active" />
            <StatTile label="Open tickets" value={c.ticketsOpen ?? 0} href="/my-workspace/tickets?scope=assigned" />
            <StatTile label="Overdue" value={c.ticketsOverdue ?? 0} tone={c.ticketsOverdue ? "alert" : "default"} href="/my-workspace/tickets?status=overdue" />
            <StatTile label="Calls today" value={c.callsToday ?? 0} href="/my-workspace/calls?when=today" />
            <StatTile label="Upcoming calls" value={c.callsUpcoming ?? 0} href="/my-workspace/calls?when=upcoming" />
          </div>

          <div className="grid lg:grid-cols-[3fr_2fr] gap-4">
            <Card>
              <div className="px-5 py-4 border-b border-[#2a2a2a]">
                <h2 className="text-[13px] font-bold uppercase tracking-widest font-rajdhani text-[#f0f0f0]">My pending work</h2>
              </div>
              {pending.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-2 text-[#a0a0a0]">
                  <CheckCircle2 size={22} className="text-[#4ade80]" />
                  <p className="text-[13px]">Nothing waiting on you right now.</p>
                </div>
              ) : (
                <ul>
                  {pending.map((p) => (
                    <li key={p.key} className="border-b border-[#222] last:border-0">
                      <Link href={p.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#1f1f1f] transition-colors">
                        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", SEVERITY_DOT[p.severity])} aria-hidden="true" />
                        <span className="text-[13px] text-[#f0f0f0] flex-1">
                          {(PENDING_LABEL[p.key] ?? ((n: number) => `${n} × ${humanize(p.key)}`))(p.count, summary.inactiveDays ?? 14)}
                        </span>
                        <ChevronRight size={14} className="text-[#606060]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
                <h2 className="text-[13px] font-bold uppercase tracking-widest font-rajdhani text-[#f0f0f0]">Today&apos;s calls</h2>
                <Link href="/my-workspace/calls" className="text-[12px] text-[#a0a0a0] hover:text-[#f0f0f0]">All calls</Link>
              </div>
              {(todayCalls?.data ?? []).length === 0 ? (
                <EmptyState text="No calls to host today." />
              ) : (
                <ul>
                  {(todayCalls?.data ?? []).map((call: any) => (
                    <li key={`${call.kind}-${call.id}`} className="px-5 py-3 border-b border-[#222] last:border-0 flex items-center gap-3">
                      <span className="text-[13px] font-semibold tabular-nums text-[#f0f0f0] w-14">{format(new Date(call.startsAt), "h:mm a")}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-[#f0f0f0] truncate">{call.title}</p>
                        <p className="text-[11px] text-[#808080] truncate">
                          {call.kind === "onboarding" ? `Onboarding · ${call.memberName ?? "member"}` : `${humanize(call.category)} · ${call.booked ?? 0}/${call.capacity ?? 0} booked`}
                        </p>
                      </div>
                      {call.status === "live" && <Pill tone="red">Live</Pill>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {(c.team ?? 0) > 0 && (
            <p className="mt-4 text-[12px] text-[#808080]">
              {c.team} admin{c.team === 1 ? " reports" : "s report"} to you — see <Link href="/my-workspace/team" className="text-[#f0f0f0] underline-offset-2 hover:underline">My Team</Link>.
            </p>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

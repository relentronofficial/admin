"use client";

import Link from "next/link";
import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useMyWorkspaceTickets } from "@/lib/hooks/useTbt";
import {
  Card, EmptyState, ErrorState, FilterTabs, LoadingRow, Pager, Pill, WorkspaceHeader,
  ago, humanize, memberName, useQueryState,
} from "@/components/my-workspace/WorkspaceUi";

const SCOPES = ["all", "assigned", "my_members"];
const STATUSES = ["open", "new", "overdue", "unassigned", "closed", "all"];
const LIMIT = 25;

const STATUS_TONE: Record<string, "red" | "amber" | "blue" | "green" | "gray"> = {
  new: "red", acknowledged: "blue", in_progress: "blue", waiting_for_user: "amber", resolved: "green", closed: "gray",
};
const PRIORITY_TONE: Record<string, "red" | "amber" | "gray"> = { urgent: "red", high: "amber" };

export default function MyTicketsPage() {
  const [scope, setScopeRaw] = useQueryState("scope", "all", SCOPES);
  const [status, setStatusRaw] = useQueryState("status", "open", STATUSES);
  const [page, setPage] = useState(1);
  const setScope = (v: string) => { setScopeRaw(v); setPage(1); };
  const setStatus = (v: string) => { setStatusRaw(v); setPage(1); };

  const { data, isLoading, isError, refetch, isFetching } = useMyWorkspaceTickets({ scope, status, page, limit: LIMIT });
  const rows: any[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;

  return (
    <DashboardLayout>
      <WorkspaceHeader
        icon={LifeBuoy}
        title="My Tickets"
        subtitle="Helpdesk tickets assigned to you, and tickets raised by members you manage."
      />

      <div className="flex flex-col gap-3 mb-4">
        <FilterTabs
          value={scope}
          onChange={setScope}
          options={[
            { key: "all", label: "All mine" },
            { key: "assigned", label: "Assigned to me" },
            { key: "my_members", label: "From my members" },
          ]}
        />
        <FilterTabs
          value={status}
          onChange={setStatus}
          options={[
            { key: "open", label: "Open" },
            { key: "new", label: "New" },
            { key: "overdue", label: "Overdue" },
            { key: "unassigned", label: "Unassigned" },
            { key: "closed", label: "Resolved / closed" },
            { key: "all", label: "Everything" },
          ]}
        />
      </div>

      <Card className={isFetching && !isLoading ? "opacity-70 transition-opacity" : undefined}>
        {isLoading ? (
          <LoadingRow />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState text="No tickets here." />
        ) : (
          <>
            <ul>
              {rows.map((t) => (
                <li key={t.id} className="border-b border-[#222] last:border-0">
                  <Link href={`/support?tab=tickets&id=${t.id}`} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-4 py-3 hover:bg-[#1f1f1f]">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[#f0f0f0] font-medium truncate">
                        {t.displayNumber ? <span className="text-[#808080] font-normal">#{t.displayNumber} </span> : null}
                        {t.subject}
                      </p>
                      <p className="text-[11px] text-[#808080] truncate">
                        {t.member ? memberName(t.member) : t.name}
                        {t.category?.name ? ` · ${t.category.name}` : ""}
                        {` · opened ${ago(t.createdAt)}`}
                        {" · "}
                        {t.assignedToMe ? "assigned to you" : t.assignedToAdmin ? `assigned to ${t.assignedToAdmin.fullName}` : "unassigned"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {t.fromMyMember && <Pill tone="gray">My member</Pill>}
                      {t.overdue && <Pill tone="red">Overdue</Pill>}
                      {PRIORITY_TONE[t.priority] && <Pill tone={PRIORITY_TONE[t.priority]}>{humanize(t.priority)}</Pill>}
                      <Pill tone={STATUS_TONE[t.status] ?? "gray"}>{humanize(t.status)}</Pill>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Pager page={page} limit={LIMIT} total={total} onPage={setPage} />
          </>
        )}
      </Card>
    </DashboardLayout>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useMyWorkspaceMembers, useMyWorkspaceSummary } from "@/lib/hooks/useTbt";
import {
  Card, EmptyState, ErrorState, FilterTabs, LoadingRow, Pager, Pill, WorkspaceHeader,
  ago, humanize, memberName, useQueryState,
} from "@/components/my-workspace/WorkspaceUi";

const FILTERS = ["all", "active", "inactive", "under_review", "pending"];
const LIMIT = 25;

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "gray"> = {
  active: "green", pending: "amber", paused: "amber", inactive: "gray", suspended: "red",
};
const KYC_TONE: Record<string, "green" | "amber" | "red" | "blue" | "gray"> = {
  verified: "green", under_review: "blue", changes_requested: "amber", rejected: "red", awaiting_kyc: "gray",
};

export default function MyMembersPage() {
  const [filter, setFilter] = useQueryState("filter", "all", FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data: summary } = useMyWorkspaceSummary();
  const inactiveDays = summary?.inactiveDays ?? 14;

  // Debounce typing so each keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, refetch, isFetching } = useMyWorkspaceMembers({ filter, search: search || undefined, page, limit: LIMIT });
  const rows: any[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;

  return (
    <DashboardLayout>
      <WorkspaceHeader icon={Users} title="My Members" subtitle="Members whose Account Manager is you." />

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <FilterTabs
          value={filter}
          onChange={(k) => { setFilter(k); setPage(1); }}
          options={[
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "inactive", label: `Inactive ${inactiveDays}d+` },
            { key: "under_review", label: "KYC review" },
            { key: "pending", label: "Pending approval" },
          ]}
        />
        <div className="relative md:ml-auto md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, phone, email, business"
            aria-label="Search my members"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 pl-9 pr-3 text-[13px] text-white outline-none focus:border-[#dc2626]"
          />
        </div>
      </div>

      <Card className={isFetching && !isLoading ? "opacity-70 transition-opacity" : undefined}>
        {isLoading ? (
          <LoadingRow />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState text={search || filter !== "all" ? "No members match this filter." : "No members are assigned to you yet. An admin sets the Account Manager on a member's profile."} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani border-b border-[#2a2a2a]">
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">KYC</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Last active</th>
                    <th className="px-4 py-3 text-right">Open tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id} className="border-b border-[#222] last:border-0 hover:bg-[#1f1f1f]">
                      <td className="px-4 py-3">
                        <Link href={`/members/${m.id}`} className="block min-w-[180px]">
                          <span className="text-[#f0f0f0] font-medium hover:underline underline-offset-2">{memberName(m)}</span>
                          <span className="block text-[11px] text-[#808080]">{[m.memberId, m.businessName, m.phone].filter(Boolean).join(" · ")}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3"><Pill tone={STATUS_TONE[m.status] ?? "gray"}>{humanize(m.status)}</Pill></td>
                      <td className="px-4 py-3"><Pill tone={KYC_TONE[m.verificationStatus] ?? "gray"}>{humanize(m.verificationStatus)}</Pill></td>
                      <td className="px-4 py-3 text-[#a0a0a0]">{humanize(m.membershipPlan)}</td>
                      <td className="px-4 py-3 text-[#a0a0a0]">{m.batch?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-[#a0a0a0] whitespace-nowrap">{ago(m.lastActiveAt)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {m.openTickets > 0 ? (
                          <Link href="/my-workspace/tickets?scope=my_members" className="text-[#f87171] font-semibold hover:underline">{m.openTickets}</Link>
                        ) : (
                          <span className="text-[#606060]">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} limit={LIMIT} total={total} onPage={setPage} />
          </>
        )}
      </Card>
    </DashboardLayout>
  );
}

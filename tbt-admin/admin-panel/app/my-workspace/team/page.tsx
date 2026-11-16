"use client";

import Link from "next/link";
import { Network } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useMyWorkspaceTeam } from "@/lib/hooks/useTbt";
import { Card, EmptyState, ErrorState, LoadingRow, Pill, WorkspaceHeader, ago, humanize } from "@/components/my-workspace/WorkspaceUi";

export default function MyTeamPage() {
  const { data, isLoading, isError, refetch } = useMyWorkspaceTeam();
  const rows: any[] = data?.data ?? [];

  return (
    <DashboardLayout>
      <WorkspaceHeader icon={Network} title="My Team" subtitle="Admins whose Reporting Manager is you, with the members and open tickets they handle." />

      <Card>
        {isLoading ? (
          <LoadingRow />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState text="No admins report to you. Set the Reporting Manager on an admin's profile to build your team." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani border-b border-[#2a2a2a]">
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Members</th>
                  <th className="px-4 py-3 text-right">Open tickets</th>
                  <th className="px-4 py-3">Last login</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-[#222] last:border-0 hover:bg-[#1f1f1f]">
                    <td className="px-4 py-3">
                      <Link href={`/admins/${a.id}`} className="block min-w-[180px]">
                        <span className="text-[#f0f0f0] font-medium hover:underline underline-offset-2">{a.fullName}</span>
                        <span className="block text-[11px] text-[#808080]">{[a.designation, a.department, a.email].filter(Boolean).join(" · ")}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#a0a0a0]">{humanize(a.role)}</td>
                    <td className="px-4 py-3"><Pill tone={a.status === "active" ? "green" : "gray"}>{humanize(a.status)}</Pill></td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#f0f0f0]">{a.members}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={a.openTickets > 0 ? "text-[#f87171] font-semibold" : "text-[#606060]"}>{a.openTickets}</span>
                    </td>
                    <td className="px-4 py-3 text-[#a0a0a0] whitespace-nowrap">{ago(a.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, Loader2, RefreshCcw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useMarkMemberActivitySeen, useMemberActivity, useMemberActivityUnread, type MemberActivityItem } from "@/lib/hooks/useMemberActivity";
import { useMyWorkspaceMembers } from "@/lib/hooks/useTbt";
import { Card, EmptyState, ErrorState, FilterTabs, LoadingRow, Pill, WorkspaceHeader, ago, memberName, useQueryState } from "@/components/my-workspace/WorkspaceUi";

const GROUPS = [
  { key: "all", label: "All" },
  { key: "tasks", label: "Tasks" },
  { key: "learning", label: "Learning" },
  { key: "reports", label: "Reports & feedback" },
  { key: "support", label: "Tickets & calls" },
  { key: "payments", label: "Payments" },
  { key: "community", label: "Community" },
  { key: "notices", label: "Notifications sent" },
];

const ACTION: Record<string, string> = {
  task_submitted: "submitted a task",
  day_submitted: "submitted the daily checklist",
  assignment_submitted: "submitted an assignment",
  form_submitted: "submitted a form",
  break_requested: "requested a break",
  lesson_completed: "completed a lesson",
  quiz_attempted: "took a quiz",
  weekly_report: "submitted the weekly report",
  video_feedback: "gave video feedback",
  revenue_updated: "updated revenue",
  onboarding_submitted: "submitted onboarding",
  ticket_raised: "raised a ticket",
  ticket_reply: "replied on a ticket",
  call_booked: "booked a call",
  call_cancelled: "had a call booking cancelled",
  course_payment: "made a course payment / access request",
  credit_requested: "requested credits",
  product_inquiry: "asked about a product",
  community_post: "posted in the community",
  community_comment: "commented in the community",
  notification_sent: "was sent a notification",
};

const hrefFor = (a: MemberActivityItem) =>
  a.kind === "ticket_raised" || a.kind === "ticket_reply" ? `/support?tab=tickets&id=${a.ref}`
    : a.kind === "weekly_report" ? `/course-weekly-reports?tab=feedback&open=${a.ref}`
      : `/members/${a.memberId}`;

const IST = "Asia/Kolkata";
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });

export default function MemberActivityPage() {
  const [group, setGroup] = useQueryState("group", "all", GROUPS.map((g) => g.key));
  const [member, setMember] = useState("");
  const { data, isLoading, isError, refetch, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage } = useMemberActivity({
    group: group === "all" ? undefined : group,
    memberId: member || undefined,
  });
  const { data: membersRes } = useMyWorkspaceMembers({ limit: 100 });
  const members: any[] = membersRes?.data ?? [];
  const { data: unread = 0 } = useMemberActivityUnread();
  const { mutate: markSeen } = useMarkMemberActivitySeen();

  // Seen once the full (unfiltered) list has been shown.
  const asOf = group === "all" && !member ? data?.pages[0]?.meta.asOf : undefined;
  useEffect(() => {
    if (asOf) markSeen(asOf);
  }, [asOf, markSeen]);

  const rows = data?.pages.flatMap((p) => p.data) ?? [];
  const days: { day: string; items: MemberActivityItem[] }[] = [];
  for (const a of rows) {
    const day = dayOf(a.at);
    const last = days[days.length - 1];
    if (last?.day === day) last.items.push(a);
    else days.push({ day, items: [a] });
  }

  return (
    <DashboardLayout>
      <WorkspaceHeader icon={Activity} title="Member Activity" subtitle="Everything your assigned members do, newest first. Only you see your members' activity. Times are IST." />

      <div className="flex flex-col gap-3 mb-4">
        <FilterTabs value={group} onChange={setGroup} options={GROUPS} />
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Member"
            value={member}
            onChange={(e) => setMember(e.target.value)}
            className="h-9 px-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-[12px] text-[#f0f0f0] outline-none focus:border-[#dc2626] max-w-full"
          >
            <option value="">All my members</option>
            {members.map((m) => <option key={m.id} value={m.id}>{memberName(m)}</option>)}
          </select>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#2a2a2a] text-[12px] text-[#a0a0a0] hover:text-[#f0f0f0] hover:border-[#444]"
          >
            <RefreshCcw size={13} className={isFetching ? "animate-spin" : undefined} />
            {unread > 0 && !isFetching ? `${unread} new — refresh` : "Refresh"}
          </button>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <LoadingRow />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState text={members.length === 0 ? "No members are assigned to you. Set yourself as a member's account manager in Members to see their activity here." : "No activity here yet."} />
        ) : (
          <>
            {days.map((d) => (
              <div key={d.day}>
                <p className="px-4 pt-4 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">{d.day}</p>
                <ul>
                  {d.items.map((a) => (
                    <li key={`${a.kind}-${a.ref}-${a.at}`} className="border-b border-[#222] last:border-0">
                      <Link href={hrefFor(a)} className="flex items-start gap-4 px-4 py-3 hover:bg-[#1f1f1f]">
                        <span className="w-16 flex-shrink-0 text-[12px] tabular-nums text-[#a0a0a0] mt-px" title={ago(a.at)}>{timeOf(a.at)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-[#a0a0a0] break-words">
                            <span className="font-semibold text-[#f0f0f0]">{a.memberName || "Member"}</span> {ACTION[a.kind] ?? a.kind}
                            {": "}
                            <span className="text-[#f0f0f0]">{a.title}</span>
                          </p>
                          {a.detail && <p className="text-[12px] text-[#808080] mt-0.5 line-clamp-2 break-words">{a.detail}</p>}
                          {a.batchName && <p className="text-[11px] text-[#606060] mt-0.5">{a.batchName}</p>}
                        </div>
                        {a.isNew && <Pill tone="red">New</Pill>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {hasNextPage && (
              <div className="p-4 text-center border-t border-[#2a2a2a]">
                <button
                  type="button"
                  disabled={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-[#2a2a2a] text-[12px] text-[#f0f0f0] hover:border-[#444] disabled:opacity-50"
                >
                  {isFetchingNextPage && <Loader2 size={13} className="animate-spin" />} Load older
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </DashboardLayout>
  );
}

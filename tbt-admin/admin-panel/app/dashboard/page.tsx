"use client";

import { useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Users,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Loader2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getAdminSocket } from "@/lib/socket/client";
import { cn } from "@/lib/utils";
import { useAnalyticsOverview, useAtRiskMembers } from "@/lib/hooks/useTbt";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: overviewData, isLoading: overviewLoading } = useAnalyticsOverview();
  const { data: atRiskData, isLoading: atRiskLoading } = useAtRiskMembers({ limit: 5 });
  const overview = (overviewData as any)?.data;
  const atRisk = (atRiskData as any)?.data || [];

  useEffect(() => {
    let mounted = true;
    getAdminSocket().then((socket) => {
      if (!mounted) return;
      socket.on('admin:member_joined', (data: { memberId: string; fullName: string; createdAt: string }) => {
        queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
        toast.success(`New member joined: ${data.fullName}`);
      });
    });
    return () => {
      mounted = false;
      getAdminSocket().then((s) => s.off('admin:member_joined'));
    };
  }, [queryClient]);

  const stats = overview ? [
    { label: "Total Members", value: overview.totalMembers?.toLocaleString() ?? "—", sub: `+${overview.newMembersThisMonth ?? 0} this week`, icon: Users, color: "text-[#e02020]" },
    { label: "Active (30d)", value: overview.activeMembers30d?.toLocaleString() ?? "—", sub: "Last 30 days", icon: Activity, color: "text-blue-500" },
    { label: "Avg Health Score", value: overview.avgHealthScore != null ? `${overview.avgHealthScore}%` : "—", sub: "Engagement score", icon: TrendingUp, color: "text-purple-500" },
    { label: "Completed Episodes", value: overview.completedEpisodes?.toLocaleString() ?? "—", sub: `${overview.completedChallenges ?? 0} challenges`, icon: CheckCircle2, color: "text-green-500" },
  ] : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex gap-2.5 items-start mb-8">
          <div className="w-0.5 bg-[#e02020] rounded-sm min-h-[40px]" />
          <div>
            <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0]">Dashboard Overview</h1>
            <p className="text-[12px] text-[#606060] font-medium uppercase tracking-wider font-rajdhani">Platform stats and at-risk member tracking.</p>
          </div>
        </div>

        {/* Stats Grid */}
        {overviewLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5 h-[120px] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5 shadow-lg hover:border-[#333] transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div className={cn("p-2 rounded-lg bg-[#1f1f1f] border border-[#333]", stat.color)}>
                    <stat.icon size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-[#606060] bg-[#1a1a1a] px-2 py-0.5 rounded-full uppercase tracking-tighter">{stat.sub}</span>
                </div>
                <p className="text-[11px] uppercase tracking-widest text-[#606060] font-bold mb-1">{stat.label}</p>
                <h3 className="font-rajdhani text-3xl font-bold text-[#f0f0f0] tracking-tight">{stat.value}</h3>
              </div>
            ))}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* At-Risk Members */}
          <section className="lg:col-span-2 bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl">
            <div className="px-6 pt-[18px] pb-[14px] border-b border-[#2a2a2a] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-0.5 bg-[#e02020] h-5 flex-shrink-0" />
                <h3 className="font-rajdhani text-lg font-semibold tracking-wide uppercase">At-Risk Members</h3>
                <span className="text-[9px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Inactive 7+ days</span>
              </div>
              <Link href="/analytics" className="text-[10px] font-bold text-[#606060] hover:text-[#e02020] font-rajdhani uppercase tracking-widest transition-colors">View All →</Link>
            </div>
            {atRiskLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-[#444]" /></div>
            ) : atRisk.length === 0 ? (
              <div className="text-center py-16 text-[#444] text-sm italic">No at-risk members found.</div>
            ) : (
              <div className="divide-y divide-[#1f1f1f]">
                {atRisk.map((m: any) => (
                  <Link key={m.id} href={`/members/${m.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-[#1f1f1f] border border-[#333] flex items-center justify-center text-xs font-bold text-[#e02020] uppercase shrink-0">
                      {(m.firstName?.[0] || m.email?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#f0f0f0] truncate group-hover:text-white">{m.firstName} {m.lastName}</p>
                      <p className="text-[11px] text-[#606060] truncate">{m.email}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 justify-end">
                        <AlertTriangle size={10} className="text-orange-400" />
                        <span className="text-[11px] text-orange-400 font-bold font-rajdhani">{m.healthScore ?? 0}% health</span>
                      </div>
                      <p className="text-[10px] text-[#444]">
                        {m.lastActiveAt ? `Active ${formatDistanceToNow(new Date(m.lastActiveAt), { addSuffix: true })}` : "Never active"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Quick Stats */}
          <section className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl">
            <div className="px-6 pt-[18px] pb-[14px] border-b border-[#2a2a2a] flex items-center gap-3">
              <div className="w-0.5 bg-[#e02020] h-5 flex-shrink-0" />
              <h3 className="font-rajdhani text-lg font-semibold tracking-wide uppercase">Engagement</h3>
            </div>
            <div className="p-6 space-y-4">
              {overviewLoading ? (
                <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-[#1f1f1f] rounded-lg animate-pulse" />)}</div>
              ) : overview && [
                { label: "Enrollments", value: overview.totalEnrollments?.toLocaleString() ?? "—", icon: BookOpen },
                { label: "Completed Challenges", value: overview.completedChallenges?.toLocaleString() ?? "—", icon: CheckCircle2 },
                { label: "Assignment Submissions", value: overview.submittedAssignments?.toLocaleString() ?? "—", icon: CheckCircle2 },
                { label: "New Members (7d)", value: overview.newMembersThisMonth?.toLocaleString() ?? "—", icon: Users },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between bg-[#1f1f1f] border border-[#2a2a2a] p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon size={14} className="text-[#606060]" />
                    <span className="text-[12px] font-medium text-[#a0a0a0]">{label}</span>
                  </div>
                  <span className="font-rajdhani font-bold text-[#f0f0f0] text-[15px]">{value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

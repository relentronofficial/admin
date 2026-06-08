"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Users, Activity, CheckCircle2, Target, TrendingUp,
  AlertTriangle, BarChart2, Loader2,
} from "lucide-react";
import { useAnalyticsOverview, useAtRiskMembers } from "@/lib/hooks/useTbt";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

export default function AnalyticsPage() {
  const { data: overviewData, isLoading: overviewLoading, isError: overviewError } = useAnalyticsOverview();
  const overview = (overviewData as any)?.data;

  const [inactiveDays, setInactiveDays] = useState(7);
  const [atRiskPage, setAtRiskPage] = useState(1);
  const { data: atRiskData, isLoading: atRiskLoading, isError: atRiskError } = useAtRiskMembers({
    inactiveDays,
    completionThreshold: 50,
    page: atRiskPage,
    limit: 20,
  });
  const atRisk = (atRiskData as any)?.data || [];
  const atRiskTotal = (atRiskData as any)?.meta?.total ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex gap-2.5 items-start mb-6">
          <div className="w-0.5 bg-[#e02020] rounded-sm min-h-[40px]" />
          <div>
            <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0]">Platform Analytics</h1>
            <p className="text-[12px] text-[#606060] font-medium uppercase tracking-wider font-rajdhani">Member engagement, completion rates, and health scores.</p>
          </div>
        </div>

        {/* Overview Stats */}
        {overviewLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => <div key={i} className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5 h-[100px] animate-pulse" />)}
          </div>
        ) : overviewError ? (
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 text-center text-[#606060] text-sm font-rajdhani uppercase tracking-widest">Failed to load overview stats.</div>
        ) : overview ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { label: "Total Members", value: overview.totalMembers?.toLocaleString(), icon: Users, color: "text-[#e02020]" },
                { label: "Active (30d)", value: overview.activeMembers30d?.toLocaleString(), icon: Activity, color: "text-blue-400" },
                { label: "Avg Health Score", value: `${overview.avgHealthScore ?? 0}%`, icon: TrendingUp, color: "text-purple-400" },
                { label: "New Members (7d)", value: overview.newMembersLast7d?.toLocaleString(), icon: Users, color: "text-green-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
                  <div className={`mb-3 ${color}`}><Icon size={18} /></div>
                  <p className="text-[10px] uppercase tracking-widest text-[#606060] font-bold font-rajdhani mb-1">{label}</p>
                  <p className="font-rajdhani text-2xl font-bold text-[#f0f0f0]">{value ?? "—"}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { label: "Total Enrollments", value: overview.totalEnrollments?.toLocaleString(), icon: BarChart2, color: "text-yellow-400" },
                { label: "Episodes Completed", value: overview.completedEpisodes?.toLocaleString(), icon: CheckCircle2, color: "text-green-400" },
                { label: "Challenges Completed", value: overview.completedChallenges?.toLocaleString(), icon: Target, color: "text-orange-400" },
                { label: "Assignments Submitted", value: overview.submittedAssignments?.toLocaleString(), icon: CheckCircle2, color: "text-blue-400" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
                  <div className={`mb-3 ${color}`}><Icon size={18} /></div>
                  <p className="text-[10px] uppercase tracking-widest text-[#606060] font-bold font-rajdhani mb-1">{label}</p>
                  <p className="font-rajdhani text-2xl font-bold text-[#f0f0f0]">{value ?? "—"}</p>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* At-Risk Members */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="px-6 pt-[18px] pb-[14px] border-b border-[#2a2a2a] flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle size={16} className="text-orange-400" />
              <h3 className="font-rajdhani text-lg font-semibold tracking-wide uppercase">At-Risk Members</h3>
              {atRiskTotal > 0 && (
                <span className="text-[9px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {atRiskTotal} members
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#606060] font-rajdhani uppercase tracking-widest">Inactive for:</span>
              {[3, 7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => { setInactiveDays(d); setAtRiskPage(1); }}
                  className={`px-3 py-1 rounded text-[10px] font-bold font-rajdhani uppercase tracking-widest transition-all ${inactiveDays === d ? "bg-[#dc2626] text-white" : "bg-[#1a1a1a] text-[#606060] hover:text-white border border-[#2a2a2a]"}`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {atRiskLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-[#444]" /></div>
          ) : atRiskError ? (
            <div className="text-center py-16 text-[#606060] text-sm font-rajdhani uppercase tracking-widest">Failed to load at-risk members.</div>
          ) : atRisk.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 size={32} className="mx-auto text-green-500 mb-3" />
              <p className="text-[#a0a0a0] font-rajdhani font-bold uppercase tracking-widest text-sm">No at-risk members in this window.</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                    <th className="px-5 py-3 text-left text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Member</th>
                    <th className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Health</th>
                    <th className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Points</th>
                    <th className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Streak</th>
                    <th className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Enrollments</th>
                    <th className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f1f]">
                  {atRisk.map((m: any) => (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/members/${m.id}`} className="hover:text-[#e02020] transition-colors">
                          <p className="text-[13px] font-bold text-[#f0f0f0]">{m.firstName} {m.lastName}</p>
                          <p className="text-[11px] text-[#606060]">{m.email}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[#111] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${m.healthScore ?? 0}%`, backgroundColor: (m.healthScore ?? 0) >= 60 ? "#22c55e" : (m.healthScore ?? 0) >= 30 ? "#eab308" : "#dc2626" }} />
                          </div>
                          <span className="text-[11px] font-bold font-rajdhani text-[#a0a0a0]">{m.healthScore ?? 0}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[12px] font-bold font-rajdhani text-[#a0a0a0]">{(m.totalPoints ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-[12px] text-[#606060]">{m.currentStreak ?? 0}d</td>
                      <td className="px-4 py-3.5 text-[12px] text-[#606060]">{m._count?.workshopEnrollments ?? 0}</td>
                      <td className="px-4 py-3.5 text-[11px] text-[#444]">
                        {m.lastActiveAt ? formatDistanceToNow(new Date(m.lastActiveAt), { addSuffix: true }) : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {atRiskTotal > 20 && (
                <div className="px-6 py-3 border-t border-[#1f1f1f] flex items-center justify-between">
                  <button onClick={() => setAtRiskPage(p => Math.max(1, p - 1))} disabled={atRiskPage === 1} className="text-[11px] font-bold font-rajdhani uppercase tracking-widest text-[#606060] hover:text-white disabled:opacity-30 transition-colors">← Prev</button>
                  <span className="text-[10px] text-[#444]">Page {atRiskPage} · {atRiskTotal} total</span>
                  <button onClick={() => setAtRiskPage(p => p + 1)} disabled={atRisk.length < 20} className="text-[11px] font-bold font-rajdhani uppercase tracking-widest text-[#606060] hover:text-white disabled:opacity-30 transition-colors">Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

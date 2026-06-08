"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CheckCircle2, Loader2, Target } from "lucide-react";
import { useCompletionMatrix, useListWorkshops } from "@/lib/hooks/useTbt";

export default function ChallengesAnalyticsPage() {
  const { data: workshopsData } = useListWorkshops({ limit: 100 });
  const workshops = (workshopsData as any)?.data || [];
  const [selectedWorkshopId, setSelectedWorkshopId] = useState("");
  const [matrixPage, setMatrixPage] = useState(1);

  const { data: matrixData, isLoading: matrixLoading } = useCompletionMatrix(selectedWorkshopId, matrixPage);
  const matrix = (matrixData as any)?.data;
  const enrollmentTotal = (matrixData as any)?.meta?.total ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex gap-2.5 items-start mb-6">
          <div className="w-0.5 bg-[#e02020] rounded-sm min-h-[40px]" />
          <div>
            <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0]">Challenge Completion Matrix</h1>
            <p className="text-[12px] text-[#606060] font-medium uppercase tracking-wider font-rajdhani">Per-workshop, per-member challenge completion grid.</p>
          </div>
        </div>

        {/* Workshop selector */}
        <div className="flex items-center gap-3">
          <select
            value={selectedWorkshopId}
            onChange={e => { setSelectedWorkshopId(e.target.value); setMatrixPage(1); }}
            className="w-full max-w-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white text-sm outline-none focus:border-[#dc2626] transition-all appearance-none"
          >
            <option value="">Select a workshop...</option>
            {workshops.map((w: any) => (
              <option key={w.id} value={w.id}>{w.title}</option>
            ))}
          </select>
          {matrixLoading && <Loader2 size={16} className="animate-spin text-[#606060]" />}
        </div>

        {!selectedWorkshopId ? (
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl text-center py-20 space-y-3">
            <Target size={36} className="mx-auto text-[#333]" />
            <p className="text-[#444] text-sm font-rajdhani font-bold uppercase tracking-widest">Select a workshop to view the matrix</p>
          </div>
        ) : matrixLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-[#444]" /></div>
        ) : !matrix ? (
          <div className="text-center py-16 text-[#444] italic">No data found.</div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Enrolled Members", value: matrix.rows?.length ?? 0 },
                { label: "Challenges", value: matrix.challenges?.length ?? 0 },
                { label: "Avg Completion", value: matrix.rows?.length > 0 ? `${Math.round(matrix.rows.reduce((s: number, r: any) => s + (r.totalCount > 0 ? (r.completedCount / r.totalCount) * 100 : 0), 0) / matrix.rows.length)}%` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-widest text-[#606060] font-bold font-rajdhani mb-1">{label}</p>
                  <p className="font-rajdhani text-2xl font-bold text-[#f0f0f0]">{value}</p>
                </div>
              ))}
            </div>

            {/* Matrix table */}
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#2a2a2a]">
                <h3 className="font-rajdhani text-[13px] font-bold uppercase tracking-[2px] text-[#a0a0a0]">{matrix.workshopTitle}</h3>
              </div>
              {(matrix.rows ?? []).length === 0 ? (
                <div className="text-center py-12 text-[#444] italic">No enrollments yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                        <th className="px-5 py-3 text-left text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani min-w-[180px]">Member</th>
                        <th className="px-4 py-3 text-center text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Done</th>
                        {(matrix.challenges ?? []).map((c: any) => (
                          <th key={c.id} className="px-3 py-3 text-center text-[9px] uppercase tracking-widest text-[#444] font-bold font-rajdhani max-w-[80px]" title={c.title}>
                            {c.numberLabel?.replace(":", "") || c.title?.slice(0, 8)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f1f1f]">
                      {(matrix.rows ?? []).map((row: any) => (
                        <tr key={row.member.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3">
                            <p className="text-[12px] font-bold text-[#f0f0f0]">{row.member.firstName} {row.member.lastName}</p>
                            <p className="text-[10px] text-[#444]">{row.member.email}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[11px] font-bold font-rajdhani text-[#a0a0a0]">{row.completedCount}/{row.totalCount}</span>
                          </td>
                          {(row.challenges ?? []).map((ch: any) => (
                            <td key={ch.challengeId} className="px-3 py-3 text-center">
                              {ch.completed
                                ? <CheckCircle2 size={14} className="mx-auto text-green-400" />
                                : <div className="w-3.5 h-3.5 rounded-full border border-[#333] mx-auto" />}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {enrollmentTotal > 50 && (
                <div className="px-6 py-3 border-t border-[#1f1f1f] flex items-center justify-between">
                  <button onClick={() => setMatrixPage(p => Math.max(1, p - 1))} disabled={matrixPage === 1} className="text-[11px] font-bold font-rajdhani uppercase tracking-widest text-[#606060] hover:text-white disabled:opacity-30 transition-colors">← Prev</button>
                  <span className="text-[10px] text-[#444]">Page {matrixPage} · {enrollmentTotal} enrolled</span>
                  <button onClick={() => setMatrixPage(p => p + 1)} disabled={(matrix?.rows ?? []).length < 50} className="text-[11px] font-bold font-rajdhani uppercase tracking-widest text-[#606060] hover:text-white disabled:opacity-30 transition-colors">Next →</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

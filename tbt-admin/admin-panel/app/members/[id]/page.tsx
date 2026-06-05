"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft, User, Mail, Phone, Calendar, MapPin, Briefcase,
  Trophy, Target, Loader2, Plus, X, Trash2, CheckCircle2,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useGetMember } from "@/lib/hooks/useMembers";
import {
  useMemberProgress, useListMemberBadges, useListAllBadges,
  useAssignBadge, useRemoveBadge,
  useMemberEnrollments, useEnrollMemberInWorkshop, useRemoveMemberEnrollment,
  useListWorkshops,
} from "@/lib/hooks/useTbt";
import { toast } from "react-hot-toast";
import { format, isValid } from "date-fns";

const safeDate = (d: any) => {
  if (!d) return "—";
  try { const p = new Date(d); return isValid(p) ? format(p, "dd MMM yyyy") : "—"; } catch { return "—"; }
};

const statusCls = (s: string) => {
  const m: Record<string, string> = {
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    paused: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    expired: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return m[s] || "bg-[#222] text-[#606060] border-[#333]";
};

const TABS = ["Info", "Enrollments", "Progress"] as const;
type Tab = typeof TABS[number];

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Info");

  const { data: memberData, isLoading: memberLoading } = useGetMember(id);
  const member = (memberData as any)?.data;

  const { data: progressData, isLoading: progressLoading } = useMemberProgress(id);
  const progress = (progressData as any)?.data;

  const { data: badgesData, refetch: refetchBadges } = useListMemberBadges(id);
  const memberBadges = (badgesData as any)?.data || [];
  const { data: allBadgesData } = useListAllBadges();
  const allBadges = (allBadgesData as any)?.data || [];
  const assignBadge = useAssignBadge(id);
  const removeBadge = useRemoveBadge(id);
  const [selectedBadgeId, setSelectedBadgeId] = useState("");

  const { data: enrollmentsData, refetch: refetchEnrollments } = useMemberEnrollments(id);
  const enrollments = (enrollmentsData as any)?.data || [];
  const { data: workshopsData } = useListWorkshops();
  const allWorkshops = (workshopsData as any)?.data || [];
  const enrollInWorkshop = useEnrollMemberInWorkshop(id);
  const removeEnrollment = useRemoveMemberEnrollment(id);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [expandedWorkshop, setExpandedWorkshop] = useState<string | null>(null);

  const enrolledWorkshopIds = new Set(enrollments.map((e: any) => e.workshopId));
  const unenrolled = allWorkshops.filter((w: any) => !enrolledWorkshopIds.has(w.id));

  const handleAssignBadge = async () => {
    if (!selectedBadgeId) return;
    try { await assignBadge.mutateAsync(selectedBadgeId); toast.success("Badge assigned"); setSelectedBadgeId(""); refetchBadges(); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleRemoveBadge = async (badgeId: string) => {
    try { await removeBadge.mutateAsync(badgeId); toast.success("Badge removed"); refetchBadges(); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleEnroll = async () => {
    if (!selectedWorkshopId) return;
    try { await enrollInWorkshop.mutateAsync(selectedWorkshopId); toast.success("Enrolled"); setSelectedWorkshopId(""); refetchEnrollments(); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleRemoveEnrollment = async (workshopId: string) => {
    try { await removeEnrollment.mutateAsync(workshopId); toast.success("Removed"); setRemovingId(null); refetchEnrollments(); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const labelCls = "text-[10px] font-bold text-[#444] uppercase tracking-widest font-rajdhani";
  const valueCls = "text-sm text-[#f0f0f0] font-medium mt-0.5";

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back + header */}
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push("/members")}
            className="flex items-center gap-1.5 text-[#606060] hover:text-white text-[12px] font-bold uppercase tracking-widest font-rajdhani transition-colors mt-1"
          >
            <ChevronLeft size={15} /> Members
          </button>
          <div className="flex-1">
            {memberLoading ? (
              <div className="h-7 w-48 rounded bg-[#1a1a1a] animate-pulse" />
            ) : (
              <>
                <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">
                  {member ? `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email : "Member"}
                </h1>
                <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani mt-0.5">
                  {member?.email}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#2a2a2a]">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-rajdhani font-bold text-[11px] uppercase tracking-[2px] border-b-2 transition-all ${activeTab === tab ? "border-[#dc2626] text-[#f0f0f0]" : "border-transparent text-[#606060] hover:text-[#a0a0a0]"}`}
            >
              {tab === "Enrollments" && enrollments.length > 0 ? `${tab} (${enrollments.length})` : tab}
            </button>
          ))}
        </div>

        {/* ── INFO TAB ── */}
        {activeTab === "Info" && (
          <div className="space-y-6">
            {memberLoading ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 animate-pulse h-48" />
            ) : member && (
              <>
                {/* Personal details card */}
                <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-5">
                  <p className="text-[11px] font-bold text-[#dc2626] uppercase tracking-[2px] font-rajdhani flex items-center gap-2"><User size={13} /> Personal Details</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                    {[
                      { label: "First Name", value: member.firstName },
                      { label: "Last Name", value: member.lastName },
                      { label: "Email", value: member.email, icon: <Mail size={11} className="inline mr-1" /> },
                      { label: "Phone", value: member.phone || member.contactNumber, icon: <Phone size={11} className="inline mr-1" /> },
                      { label: "Date of Birth", value: safeDate(member.dob || member.dateOfBirth), icon: <Calendar size={11} className="inline mr-1" /> },
                      { label: "Gender", value: member.gender },
                      { label: "City", value: member.city, icon: <MapPin size={11} className="inline mr-1" /> },
                      { label: "State", value: member.state },
                      { label: "Tier", value: member.tier ? `Tier ${member.tier}` : null },
                    ].map(({ label, value, icon }) => (
                      <div key={label}>
                        <p className={labelCls}>{label}</p>
                        <p className={valueCls}>{icon}{value || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Business details */}
                {(member.businessName || member.productServiceType) && (
                  <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-5">
                    <p className="text-[11px] font-bold text-[#dc2626] uppercase tracking-[2px] font-rajdhani flex items-center gap-2"><Briefcase size={13} /> Business Details</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                      {[
                        { label: "Business Name", value: member.businessName },
                        { label: "Product / Service", value: member.productServiceType },
                        { label: "Annual Turnover", value: member.annualTurnover },
                        { label: "GST Number", value: member.gstNumber },
                        { label: "Goal (90 Days)", value: member.goalAfter90Days },
                        { label: "Established", value: safeDate(member.businessEstablishedOn) },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className={labelCls}>{label}</p>
                          <p className={valueCls}>{value || "—"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subscription */}
                {(member.subscriptionStart || member.subscriptionEnd) && (
                  <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
                    <p className="text-[11px] font-bold text-[#dc2626] uppercase tracking-[2px] font-rajdhani">Subscription</p>
                    <div className="grid grid-cols-2 gap-5">
                      <div><p className={labelCls}>Start</p><p className={valueCls}>{safeDate(member.subscriptionStart)}</p></div>
                      <div><p className={labelCls}>End</p><p className={valueCls}>{safeDate(member.subscriptionEnd)}</p></div>
                    </div>
                  </div>
                )}

                {/* Badges */}
                <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
                  <p className="text-[11px] font-bold text-[#dc2626] uppercase tracking-[2px] font-rajdhani flex items-center gap-2"><Trophy size={13} /> Badges</p>
                  <div className="flex flex-wrap gap-2 min-h-[28px]">
                    {memberBadges.length === 0
                      ? <p className="text-[#444] text-sm italic">No badges assigned.</p>
                      : memberBadges.map((mb: any) => (
                        <div key={mb.id} className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-lg">
                          {mb.badge?.iconUrl && <img src={mb.badge.iconUrl} alt="" className="w-4 h-4 object-contain" />}
                          <span className="text-[12px] font-bold text-[#f0f0f0]">{mb.badge?.label || mb.badge?.name}</span>
                          <button onClick={() => handleRemoveBadge(mb.badgeId)} className="text-[#444] hover:text-red-400"><X size={12} /></button>
                        </div>
                      ))}
                  </div>
                  {allBadges.length > 0 && (
                    <div className="flex gap-2">
                      <select value={selectedBadgeId} onChange={e => setSelectedBadgeId(e.target.value)} className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 px-4 text-white text-sm outline-none focus:border-[#dc2626] transition-all appearance-none">
                        <option value="">Select a badge to assign...</option>
                        {allBadges.map((b: any) => <option key={b.id} value={b.id}>{b.label || b.name}</option>)}
                      </select>
                      <button onClick={handleAssignBadge} disabled={!selectedBadgeId || assignBadge.isPending} className="px-5 py-2 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50">
                        {assignBadge.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Assign
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ENROLLMENTS TAB ── */}
        {activeTab === "Enrollments" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <select value={selectedWorkshopId} onChange={e => setSelectedWorkshopId(e.target.value)} className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white text-sm outline-none focus:border-[#dc2626] transition-all appearance-none">
                <option value="">Select workshop to enroll...</option>
                {unenrolled.map((w: any) => <option key={w.id} value={w.id}>{w.title}</option>)}
              </select>
              <button onClick={handleEnroll} disabled={!selectedWorkshopId || enrollInWorkshop.isPending} className="px-5 py-2 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 disabled:opacity-50">
                {enrollInWorkshop.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Enroll
              </button>
            </div>

            {enrollments.length === 0 ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl text-center py-16 space-y-3">
                <Briefcase size={32} className="mx-auto text-[#333]" />
                <p className="text-[#444] text-sm font-rajdhani font-bold uppercase tracking-widest">Not enrolled in any workshops</p>
              </div>
            ) : (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                      <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Workshop</th>
                      <th className="px-4 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Status</th>
                      <th className="px-4 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Enrolled</th>
                      <th className="px-4 py-4 w-[48px]" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222]">
                    {enrollments.map((e: any) => (
                      <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5 font-bold text-[#f0f0f0] text-[13px]">{e.workshop?.title || "—"}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-widest font-rajdhani ${statusCls(e.status)}`}>{e.status}</span>
                        </td>
                        <td className="px-4 py-3.5 text-[#606060] text-[12px]">{safeDate(e.enrolledAt)}</td>
                        <td className="px-4 py-3.5">
                          {removingId === e.workshopId ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleRemoveEnrollment(e.workshopId)} className="text-[10px] text-red-400 font-bold font-rajdhani uppercase">Yes</button>
                              <span className="text-[#333]">/</span>
                              <button onClick={() => setRemovingId(null)} className="text-[10px] text-[#606060] font-bold font-rajdhani uppercase">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setRemovingId(e.workshopId)} className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-400/10 rounded transition-all"><Trash2 size={13} /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── PROGRESS TAB ── */}
        {activeTab === "Progress" && (
          <div className="space-y-4">
            {progressLoading ? (
              <div className="flex items-center gap-2 text-[#606060] py-16 justify-center"><Loader2 size={22} className="animate-spin" /> Loading progress...</div>
            ) : !progress?.workshops?.length ? (
              <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl text-center py-16 space-y-3">
                <Target size={32} className="mx-auto text-[#333]" />
                <p className="text-[#444] text-sm font-rajdhani font-bold uppercase tracking-widest">No progress data available</p>
              </div>
            ) : (
              progress.workshops.map((w: any) => {
                const isExp = expandedWorkshop === w.workshopId;
                const pct = w.overallPercent ?? 0;
                const pctColor = pct >= 100 ? "#22c55e" : pct > 50 ? "#eab308" : "#dc2626";

                return (
                  <div key={w.workshopId} className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
                    {/* Header row */}
                    <button
                      className="w-full px-6 py-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors text-left"
                      onClick={() => setExpandedWorkshop(isExp ? null : w.workshopId)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2.5">
                          <p className="font-bold text-[#f0f0f0] text-sm truncate">{w.workshopTitle}</p>
                          {w.status && (
                            <span className={`inline-flex px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-widest font-rajdhani ${statusCls(w.status)}`}>{w.status}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-[#111] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pctColor }} />
                          </div>
                          <span className="text-[12px] font-bold font-rajdhani shrink-0" style={{ color: pctColor }}>{pct}%</span>
                          <span className="text-[11px] text-[#606060] shrink-0">{w.completedCount}/{w.totalCount} eps</span>
                        </div>
                      </div>
                      <ChevronLeft size={15} className={`shrink-0 text-[#444] transition-transform ${isExp ? "-rotate-90" : "rotate-180"}`} />
                    </button>

                    {/* Expanded details */}
                    {isExp && (
                      <div className="border-t border-[#2a2a2a] px-6 py-5 space-y-6">
                        {w.lastActiveAt && (
                          <p className="text-[10px] text-[#606060] font-rajdhani uppercase tracking-widest">
                            Last active: <span className="text-[#a0a0a0]">{safeDate(w.lastActiveAt)}</span>
                          </p>
                        )}

                        {/* Challenge breakdown */}
                        {w.challenges?.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-[#606060] uppercase tracking-[2px] font-rajdhani mb-3">Challenge Breakdown</p>
                            <div className="bg-[#111] rounded-xl overflow-hidden">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-[#1f1f1f]">
                                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Challenge</th>
                                    <th className="px-4 py-3 text-center text-[10px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Episodes</th>
                                    <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-[#444] font-bold font-rajdhani">Progress</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1a1a1a]">
                                  {w.challenges.map((ch: any, i: number) => {
                                    const cp = ch.percent ?? (ch.totalCount ? Math.round((ch.completedCount / ch.totalCount) * 100) : 0);
                                    const cpColor = cp >= 100 ? "#22c55e" : cp > 50 ? "#eab308" : "#dc2626";
                                    return (
                                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-3 text-[#a0a0a0] text-[12px]">
                                          {cp >= 100 && <CheckCircle2 size={12} className="inline mr-1.5 text-green-400" />}
                                          {ch.title}
                                        </td>
                                        <td className="px-4 py-3 text-center text-[#606060] text-[11px]">{ch.completedCount}/{ch.totalCount}</td>
                                        <td className="px-4 py-3 text-right">
                                          <span className="text-[12px] font-bold font-rajdhani" style={{ color: cpColor }}>{cp}%</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Assignment submissions */}
                        {w.assignments?.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-[#606060] uppercase tracking-[2px] font-rajdhani mb-3">Assignment Submissions</p>
                            <div className="space-y-2">
                              {w.assignments.map((a: any, i: number) => (
                                <div key={i} className="flex items-start gap-3 bg-[#111] rounded-lg px-4 py-3">
                                  <CheckCircle2 size={14} className={`shrink-0 mt-0.5 ${a.isSubmitted ? "text-green-400" : "text-[#333]"}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-medium text-[#a0a0a0] truncate">{a.title}</p>
                                    {a.submittedAt && <p className="text-[10px] text-[#444] mt-0.5">{safeDate(a.submittedAt)}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

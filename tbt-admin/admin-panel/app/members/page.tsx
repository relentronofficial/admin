"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Filter, 
  Download,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  Mail,
  Phone,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Users,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  Building2,
  Briefcase,
  Target,
  Trophy,
  MessageSquare,
  UploadCloud
} from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListMembers, useUpdateMember, useDeleteMember, useGetManagers } from "@/lib/hooks/useMembers";
import { useUploadImage } from "@/lib/hooks/useAdmin";
import { useMemberProgress, useListMemberBadges, useListAllBadges, useAssignBadge, useRemoveBadge, useListTiers, useListWorkshops, useMemberEnrollments, useEnrollMemberInWorkshop, useRemoveMemberEnrollment } from "@/lib/hooks/useTbt";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const MARKETING_CHANNELS = ["SEO", "Paid Ads", "Social Media", "Email", "Referral", "Offline"];

const safeFormatDate = (dateStr: any) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return isValid(d) ? format(d, 'dd MMM yyyy') : 'N/A';
  } catch (e) {
    return 'N/A';
  }
};

const memberUpdateSchema = z.object({
  firstName: z.string().min(1, "First Name is required"),
  lastName: z.string().optional().or(z.literal("")),
  dob: z.string().optional().or(z.literal("")).nullable(),
  gender: z.string().optional().or(z.literal("")),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  pincode: z.string().optional().or(z.literal("")),
  businessName: z.string().optional().or(z.literal("")),
  businessEstablishedOn: z.string().optional().or(z.literal("")).nullable(),
  productServiceType: z.string().optional().or(z.literal("")),
  instagramLink: z.string().optional().or(z.literal("")),
  annualTurnover: z.string().optional().or(z.literal("")),
  goalAfter90Days: z.string().optional().or(z.literal("")),
  preferredSessionMode: z.string().optional().or(z.literal("")),
  gstNumber: z.string().optional().or(z.literal("")),
  marketingChannels: z.array(z.string()).default([]),
  marketingChannelName: z.string().optional().or(z.literal("")),
  domainHostingDetails: z.string().optional().or(z.literal("")),
  businessAddress: z.string().optional().or(z.literal("")),
  challenge1: z.string().optional().or(z.literal("")),
  challenge2: z.string().optional().or(z.literal("")),
  challenge3: z.string().optional().or(z.literal("")),
  hasMarketingTeam: z.boolean().default(false),
  marketingTeamDetails: z.string().optional().or(z.literal("")),
  hasVideoEditing: z.boolean().default(false),
  videoEditingDetails: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  membershipPlan: z.string().default("free"),
  status: z.string().default("active"),
  verificationStatus: z.string().default("awaiting_kyc"),
  accountManagerId: z.string().optional().or(z.literal("")),
  currentTier: z.number().int().min(1).default(1),
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
});

type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;

export default function MembersListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 10;

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [viewingMember, setViewingMember] = useState<any | null>(null);
  const [progressMemberId, setProgressMemberId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editKycDoc, setEditKycDoc] = useState<File | null>(null);
  const [editIsUploading, setEditIsUploading] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const editKycRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useListMembers({ page, limit, search });
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();
  const { data: managers } = useGetManagers();
  const uploadImage = useUploadImage();
  const { data: tiersData } = useListTiers();
  const tiers = (tiersData as any)?.data || [];
  const { data: workshopsData } = useListWorkshops();
  const allWorkshops = (workshopsData as any)?.data || [];

  const members = data?.data || [];
  const total = data?.meta?.total || 0;
  const totalPages = Math.ceil(total / (limit || 10));

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting: isUpdating }
  } = useForm<MemberUpdateInput>({
    resolver: zodResolver(memberUpdateSchema)
  });

  const watchChannels = watch("marketingChannels") || [];
  const watchHasSMM = watch("hasMarketingTeam");
  const watchHasVideo = watch("hasVideoEditing");

  const toggleChannel = (channel: string) => {
    if (watchChannels.includes(channel)) {
      setValue("marketingChannels", watchChannels.filter(c => c !== channel), { shouldDirty: true });
    } else {
      setValue("marketingChannels", [...watchChannels, channel], { shouldDirty: true });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingMember) {
      reset({
        firstName: editingMember.firstName || "",
        lastName: editingMember.lastName || "",
        dob: editingMember.dob ? new Date(editingMember.dob).toISOString().split('T')[0] : "",
        gender: editingMember.gender || "",
        email: editingMember.email || "",
        phone: editingMember.phone || "",
        city: editingMember.city || "",
        state: editingMember.state || "",
        pincode: editingMember.pincode || "",
        businessName: editingMember.businessName || "",
        businessEstablishedOn: editingMember.businessEstablishedOn ? new Date(editingMember.businessEstablishedOn).toISOString().split('T')[0] : "",
        productServiceType: editingMember.productServiceType || "",
        instagramLink: editingMember.instagramLink || "",
        annualTurnover: editingMember.annualTurnover || "",
        goalAfter90Days: editingMember.goalAfter90Days || "",
        preferredSessionMode: editingMember.preferredSessionMode || "",
        gstNumber: editingMember.gstNumber || "",
        marketingChannels: editingMember.marketingChannels || [],
        marketingChannelName: editingMember.marketingChannelName || "",
        domainHostingDetails: editingMember.domainHostingDetails || "",
        businessAddress: editingMember.businessAddress || "",
        challenge1: editingMember.currentChallenges?.[0] || "",
        challenge2: editingMember.currentChallenges?.[1] || "",
        challenge3: editingMember.currentChallenges?.[2] || "",
        hasMarketingTeam: editingMember.hasMarketingTeam || false,
        marketingTeamDetails: editingMember.marketingTeamDetails || "",
        hasVideoEditing: editingMember.hasVideoEditing || false,
        videoEditingDetails: editingMember.videoEditingDetails || "",
        notes: editingMember.notes || "",
        status: editingMember.status || "active",
        membershipPlan: editingMember.membershipPlan || "free",
        verificationStatus: editingMember.verificationStatus || "awaiting_kyc",
        accountManagerId: editingMember.accountManagerId || "",
        currentTier: editingMember.currentTier ?? 1,
      });
    }
  }, [editingMember, reset]);

  if (isLoading && page === 1 && !search) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-40">
          <Loader2 size={40} className="animate-spin text-[#dc2626]" />
        </div>
      </DashboardLayout>
    );
  }

  const formatLabel = (value: string) =>
    value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'inactive': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'suspended': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'paused': return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'premium': return 'text-purple-500 border-purple-500/30 bg-purple-500/5';
      case 'vip': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5';
      case 'enterprise': return 'text-orange-500 border-orange-500/30 bg-orange-500/5';
      case 'starter': return 'text-blue-500 border-blue-500/30 bg-blue-500/5';
      default: return 'text-gray-400 border-gray-400/30 bg-gray-400/5';
    }
  };

  const onUpdateSubmit = async (formData: MemberUpdateInput) => {
    try {
      setEditIsUploading(true);
      const { challenge1, challenge2, challenge3, password, ...rest } = formData;
      const payload: any = {
        ...rest,
        currentChallenges: [challenge1, challenge2, challenge3].filter(Boolean),
      };
      if (password && password.trim() !== "") {
        payload.password = password;
      }
      if (editKycDoc) {
        const { publicUrl } = await uploadImage.mutateAsync({ file: editKycDoc, pathPrefix: "members/kyc" });
        payload.kycDocumentUrl = publicUrl;
      }
      await updateMember.mutateAsync({ id: editingMember.id, data: payload });
      toast.success("Member updated successfully");
      setEditingMember(null);
      setShowEditPassword(false);
      setEditKycDoc(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to update member");
    } finally {
      setEditIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMember.mutateAsync(id);
      toast.success("Member record purged");
      setDeletingMemberId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to purge record");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 font-sans">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Community Members</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">Manage TBT member profiles and business records.</p>
            </div>
          </div>

          <button 
            onClick={() => router.push("/members/add")}
            className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2.5 rounded-md font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-95 shrink-0"
          >
            <Plus size={16} strokeWidth={3} />
            Add New Member
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           {[
             { label: 'Total Members', value: total, icon: Users, color: 'text-[#dc2626]' },
             { label: 'Active Now', value: members.filter((m:any) => m.status === 'active').length, icon: Clock, color: 'text-green-500' },
             { label: 'Premium Plans', value: members.filter((m:any) => ['premium', 'vip', 'enterprise'].includes(m.membershipPlan)).length, icon: Shield, color: 'text-purple-500' },
             { label: 'Pending KYC', value: members.filter((m:any) => m.verificationStatus === 'awaiting_kyc').length, icon: Filter, color: 'text-amber-500' }
           ].map((stat, i) => (
             <div key={i} className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-xl flex items-center gap-4">
               <div className={cn("p-2.5 rounded-lg bg-[#1a1a1a] border border-[#333]", stat.color)}>
                 <stat.icon size={20} />
               </div>
               <div>
                 <p className="text-[10px] text-[#606060] uppercase font-bold tracking-wider font-rajdhani">{stat.label}</p>
                 <p className="text-xl font-bold text-[#f0f0f0] font-rajdhani">{stat.value}</p>
               </div>
             </div>
           ))}
        </div>

        {/* Table Section */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-2xl relative">
          
          <div className="p-4 border-b border-[#2a2a2a] flex flex-col md:flex-row gap-4 items-center justify-between bg-[#1a1a1a]/50">
            <div className="relative w-full md:w-[400px]">
              <input 
                type="text" 
                placeholder="SEARCH MEMBERS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#141414] border border-[#333] rounded-md py-2.5 pl-10 pr-4 text-[12px] font-rajdhani font-bold tracking-wider outline-none focus:border-[#dc2626] transition-all text-[#f0f0f0] placeholder:text-[#444]"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#141414] border border-[#333] rounded-md text-[11px] font-bold text-[#a0a0a0] font-rajdhani uppercase tracking-widest hover:border-[#606060] transition-all">
                <Filter size={14} /> Filter
              </button>
              <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#141414] border border-[#333] rounded-md text-[11px] font-bold text-[#a0a0a0] font-rajdhani uppercase tracking-widest hover:border-[#606060] transition-all">
                <Download size={14} /> Export
              </button>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            {isError ? (
              <div className="text-center py-20 space-y-4">
                <XCircle size={40} className="mx-auto text-[#dc2626] opacity-50" />
                <p className="text-[#dc2626] font-rajdhani font-bold uppercase tracking-widest">Connection Error</p>
              </div>
            ) : members.length === 0 ? (
               <div className="text-center py-20 space-y-4">
                <Users size={40} className="mx-auto text-[#333]" />
                <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest">No Members Found</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Member Profile</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Member ID</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani text-center">Status</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Plan</th>
                    <th className="px-6 py-4 text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani text-right">Joined Date</th>
                    <th className="px-6 py-4 w-[50px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a]">
                  {members.map((member: any) => (
                    <tr key={member.id} className="group hover:bg-white/[0.02] transition-colors relative">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#1f1f1f] border border-[#333] flex-shrink-0 overflow-hidden relative group-hover:border-[#dc2626]/30 transition-colors">
                            {member.profilePhotoUrl ? (
                              <img src={member.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#333]">
                                <User size={20} />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-[13.5px] font-bold text-[#f0f0f0] group-hover:text-[#dc2626] transition-colors">
                              {member.firstName} {member.lastName}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                               <Mail size={10} className="text-[#444]" />
                               <p className="text-[11px] text-[#606060] truncate max-w-[150px]">{member.email}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-rajdhani font-bold text-[12px] tracking-[1px] text-[#a0a0a0] bg-[#1a1a1a] px-2 py-1 rounded border border-[#333]">
                          {member.memberId}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider font-rajdhani",
                          getStatusColor(member.status || 'active')
                        )}>
                          {member.status === 'active' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                          {formatLabel(member.status || 'active')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded border text-[11px] font-bold font-rajdhani tracking-wider uppercase",
                          getPlanColor(member.membershipPlan || '')
                        )}>
                          {formatLabel(member.membershipPlan || 'free')}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-[11px] text-[#f0f0f0] font-medium font-rajdhani">
                          {safeFormatDate(member.createdAt)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === member.id ? null : member.id);
                            }}
                            className="text-[#444] hover:text-white p-1 rounded hover:bg-[#2a2a2a] transition-all"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeMenuId === member.id && (
                            <div 
                              ref={menuRef}
                              className="absolute right-0 mt-2 w-48 bg-[#141414] border border-[#2a2a2a] rounded-lg shadow-2xl z-[100] py-1 overflow-hidden"
                            >
                              <button
                                onClick={() => { router.push(`/members/${member.id}`); setActiveMenuId(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-[#a0a0a0] hover:text-white hover:bg-[#2a2a2a] transition-colors font-bold uppercase tracking-wider font-rajdhani"
                              >
                                <Eye size={14} className="text-blue-500" /> View Details
                              </button>
                              <button
                                onClick={() => {
                                    setViewingMember(member);
                                    setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-[#a0a0a0] hover:text-white hover:bg-[#2a2a2a] transition-colors font-bold uppercase tracking-wider font-rajdhani"
                              >
                                <Eye size={14} className="text-blue-500" /> View Member
                              </button>
                              <button
                                onClick={() => { setProgressMemberId(member.id); setActiveMenuId(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-[#a0a0a0] hover:text-white hover:bg-[#2a2a2a] transition-colors font-bold uppercase tracking-wider font-rajdhani"
                              >
                                <Trophy size={14} className="text-yellow-500" /> View Progress
                              </button>
                              <button 
                                onClick={() => {
                                    setEditingMember(member);
                                    setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-[#a0a0a0] hover:text-white hover:bg-[#2a2a2a] transition-colors font-bold uppercase tracking-wider font-rajdhani"
                              >
                                <Pencil size={14} className="text-green-500" /> Edit Member
                              </button>
                              <button 
                                onClick={() => {
                                    setDeletingMemberId(member.id);
                                    setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-[#a0a0a0] hover:text-red-500 hover:bg-red-500/10 transition-colors font-bold uppercase tracking-wider font-rajdhani"
                              >
                                <Trash2 size={14} className="text-red-500" /> Delete Member
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!isLoading && members.length > 0 && (
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a]/30 flex items-center justify-between">
              <p className="text-[11px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">
                Showing <span className="text-[#a0a0a0] font-bold">{(page-1)*limit + 1}</span> to <span className="text-[#a0a0a0] font-bold">{Math.min(page*limit, total)}</span> of <span className="text-[#a0a0a0] font-bold">{total}</span> members
              </p>
              
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setPage(p => Math.max(1, p-1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center bg-[#141414] border border-[#333] rounded text-[#606060] hover:text-white disabled:opacity-20 transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p+1))}
                  disabled={page === totalPages || totalPages === 0}
                  className="w-8 h-8 flex items-center justify-center bg-[#141414] border border-[#333] rounded text-[#606060] hover:text-white disabled:opacity-20 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VIEW MODAL - ALL FIELDS */}
      {viewingMember && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <Eye className="text-blue-500" size={20} />
                <h3 className="font-rajdhani text-xl font-bold uppercase tracking-widest">Complete Member Dossier</h3>
              </div>
              <button onClick={() => setViewingMember(null)} className="text-[#606060] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 max-h-[80vh] overflow-y-auto font-sans">
              <div className="space-y-10">
                
                <div className="flex items-center gap-8 bg-[#1a1a1a] p-6 rounded-2xl border border-[#2a2a2a]">
                  <div className="w-28 h-28 rounded-2xl bg-[#0a0a0a] border border-[#333] overflow-hidden shadow-xl">
                    {viewingMember.profilePhotoUrl ? (
                      <img src={viewingMember.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#222]">
                        <User size={50} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight leading-none mb-3">
                      {viewingMember.firstName} {viewingMember.lastName}
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      <span className="font-rajdhani font-bold text-[12px] tracking-[1.5px] text-[#a0a0a0] bg-[#0a0a0a] px-3 py-1 rounded border border-[#333] uppercase">
                        {viewingMember.memberId}
                      </span>
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider font-rajdhani",
                        getStatusColor(viewingMember.status)
                      )}>
                        {formatLabel(viewingMember.status || '')}
                      </div>
                      <div className={cn(
                        "inline-flex items-center px-3 py-1 rounded border text-[11px] font-bold font-rajdhani tracking-wider uppercase",
                        getPlanColor(viewingMember.membershipPlan)
                      )}>
                        {formatLabel(viewingMember.membershipPlan || 'free')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <section>
                    <h4 className="flex items-center gap-2 text-[#dc2626] font-rajdhani font-bold text-[13px] uppercase tracking-[2px] mb-5">
                      <User size={16} /> Identity & Context
                    </h4>
                    <div className="space-y-4 bg-[#0a0a0a]/30 p-5 rounded-xl border border-[#1f1f1f]">
                      <InfoItem label="Email Address" value={viewingMember.email} />
                      <InfoItem label="Phone Contact" value={viewingMember.phone || 'N/A'} />
                      <InfoItem label="Date of Birth" value={safeFormatDate(viewingMember.dob)} />
                      <InfoItem label="Gender" value={viewingMember.gender || 'N/A'} />
                      <InfoItem label="Location" value={`${viewingMember.city || ''}${viewingMember.state ? `, ${viewingMember.state}` : ''} ${viewingMember.pincode || ''}` || 'N/A'} />
                      <InfoItem label="Address" value={viewingMember.businessAddress || 'N/A'} />
                    </div>
                  </section>

                  <section>
                    <h4 className="flex items-center gap-2 text-[#dc2626] font-rajdhani font-bold text-[13px] uppercase tracking-[2px] mb-5">
                      <Building2 size={16} /> Business Profile
                    </h4>
                    <div className="space-y-4 bg-[#0a0a0a]/30 p-5 rounded-xl border border-[#1f1f1f]">
                      <InfoItem label="Enterprise Name" value={viewingMember.businessName || 'N/A'} />
                      <InfoItem label="Industry Segment" value={viewingMember.productServiceType || 'N/A'} />
                      <InfoItem label="Established" value={safeFormatDate(viewingMember.businessEstablishedOn)} />
                      <InfoItem label="Annual Turnover" value={viewingMember.annualTurnover || 'N/A'} />
                      <InfoItem label="GST Identifier" value={viewingMember.gstNumber || 'N/A'} />
                      <InfoItem label="Instagram" value={viewingMember.instagramLink ? `@${viewingMember.instagramLink}` : 'N/A'} />
                    </div>
                  </section>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <section>
                    <h4 className="flex items-center gap-2 text-[#dc2626] font-rajdhani font-bold text-[13px] uppercase tracking-[2px] mb-5">
                      <AlertCircle size={16} /> Challenges & Strategy
                    </h4>
                    <div className="space-y-4 bg-[#0a0a0a]/30 p-5 rounded-xl border border-[#1f1f1f]">
                      <InfoItem label="Challenge 1" value={viewingMember.currentChallenges?.[0] || 'None'} />
                      <InfoItem label="Challenge 2" value={viewingMember.currentChallenges?.[1] || 'None'} />
                      <InfoItem label="Challenge 3" value={viewingMember.currentChallenges?.[2] || 'None'} />
                      <InfoItem label="90-Day Goal" value={viewingMember.goalAfter90Days || 'N/A'} />
                      <InfoItem label="Preferred Session" value={viewingMember.preferredSessionMode || 'N/A'} />
                    </div>
                  </section>

                  <section>
                    <h4 className="flex items-center gap-2 text-[#dc2626] font-rajdhani font-bold text-[13px] uppercase tracking-[2px] mb-5">
                      <Target size={16} /> Marketing & Assets
                    </h4>
                    <div className="space-y-4 bg-[#0a0a0a]/30 p-5 rounded-xl border border-[#1f1f1f]">
                      <InfoItem label="Marketing Channels" value={viewingMember.marketingChannels?.join(", ") || 'None'} />
                      <InfoItem label="Secondary Channel" value={viewingMember.marketingChannelName || 'N/A'} />
                      <InfoItem label="Domain/Hosting" value={viewingMember.domainHostingDetails || 'N/A'} />
                      <InfoItem label="SMM Support" value={viewingMember.hasMarketingTeam ? 'Yes' : 'No'} />
                      <InfoItem label="Video Editing" value={viewingMember.hasVideoEditing ? 'Yes' : 'No'} />
                    </div>
                  </section>
                </div>

                <section>
                   <h4 className="flex items-center gap-2 text-[#dc2626] font-rajdhani font-bold text-[13px] uppercase tracking-[2px] mb-5">
                      <Shield size={16} /> System Control
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-[#0a0a0a]/30 p-5 rounded-xl border border-[#1f1f1f]">
                       <InfoItem label="Verification" value={formatLabel(viewingMember.verificationStatus || '')} />
                       <InfoItem label="Account Manager" value={viewingMember.accountManager?.fullName || 'Unassigned'} />
                       <InfoItem label="Active Task" value={viewingMember.task || 'None'} />
                    </div>
                </section>

                {viewingMember.notes && (
                  <section className="pt-4 border-t border-[#2a2a2a]">
                    <label className="block text-[10px] text-[#555] font-bold uppercase tracking-widest mb-2 font-rajdhani">Administrative Observations</label>
                    <p className="text-[13px] text-[#a0a0a0] leading-relaxed italic">&quot;{viewingMember.notes}&quot;</p>
                  </section>
                )}
              </div>
            </div>
            <div className="px-8 py-6 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end">
              <button 
                onClick={() => setViewingMember(null)}
                className="bg-[#333] hover:bg-[#444] text-white px-8 py-2.5 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all"
              >
                Close Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <Pencil className="text-green-500" size={20} />
                <h3 className="font-rajdhani text-xl font-bold uppercase tracking-widest">Edit Member</h3>
              </div>
              <button onClick={() => setEditingMember(null)} className="text-[#606060] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onUpdateSubmit)}>
              <div className="p-8 max-h-[75vh] overflow-y-auto font-sans space-y-10">

                {/* ── 01. Basic Info ─────────────────────────────────────── */}
                <section>
                  <h4 className="text-[11px] font-bold text-[#444] uppercase tracking-[3px] mb-6 border-b border-[#1f1f1f] pb-2">01. Basic Info</h4>
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">First Name</label>
                        <input {...register("firstName")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                        {errors.firstName && <p className="text-[12px] text-red-500 mt-1">{errors.firstName.message}</p>}
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Last Name</label>
                        <input {...register("lastName")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">DOB</label>
                        <input type="date" {...register("dob")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm color-scheme-dark" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Gender</label>
                        <select {...register("gender")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none">
                          <option value="">Select...</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="prefer_not_to_say">Prefer not to say</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Email</label>
                        <input {...register("email")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                        {errors.email && <p className="text-[12px] text-red-500 mt-1">{errors.email.message}</p>}
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Phone</label>
                        <div className="flex items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 overflow-hidden focus-within:border-[#dc2626]">
                          <span className="px-4 text-[#888] font-bold text-sm border-r border-[#2a2a2a]">+91</span>
                          <input {...register("phone")} className="w-full h-full bg-transparent px-4 text-white text-sm outline-none" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">City</label>
                        <input {...register("city")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">State</label>
                        <input {...register("state")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Pincode</label>
                        <input {...register("pincode")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                      </div>
                    </div>
                  </div>
                </section>

                {/* ── 02. Business Info ──────────────────────────────────── */}
                <section>
                  <h4 className="text-[11px] font-bold text-[#444] uppercase tracking-[3px] mb-6 border-b border-[#1f1f1f] pb-2">02. Business Info</h4>
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Business Name</label>
                        <input {...register("businessName")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Business Established On</label>
                        <input type="date" {...register("businessEstablishedOn")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm color-scheme-dark" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Product/Service Type</label>
                        <select {...register("productServiceType")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none">
                          <option value="">Select...</option>
                          <option value="Product-based">Product-based</option>
                          <option value="Service-based">Service-based</option>
                          <option value="Both">Both</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Instagram Link</label>
                        <div className="flex items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 overflow-hidden focus-within:border-[#dc2626]">
                          <span className="px-4 text-[#888] font-bold text-sm">@</span>
                          <input {...register("instagramLink")} className="w-full h-full bg-transparent pr-4 text-white text-sm outline-none" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Annual Turnover</label>
                        <select {...register("annualTurnover")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none">
                          <option value="">Select...</option>
                          <option value="Under 10L">Under 10L</option>
                          <option value="10L - 25L">10L - 25L</option>
                          <option value="25L - 50L">25L - 50L</option>
                          <option value="50L - 1Cr">50L - 1Cr</option>
                          <option value="1Cr - 5Cr">1Cr - 5Cr</option>
                          <option value="5Cr+">5Cr+</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Goal after 90 Days</label>
                        <input {...register("goalAfter90Days")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Preferred Session Mode</label>
                        <select {...register("preferredSessionMode")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none">
                          <option value="">Select...</option>
                          <option value="online">Online</option>
                          <option value="offline">Offline</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">GST Number</label>
                        <input {...register("gstNumber")} placeholder="22AAAAA0000A1Z5" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-3 font-rajdhani">Existing Marketing Channel</label>
                      <div className="flex flex-wrap gap-3">
                        {MARKETING_CHANNELS.map(ch => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => toggleChannel(ch)}
                            className={cn(
                              "px-5 py-2 rounded-full text-[13px] font-medium transition-all border",
                              watchChannels.includes(ch)
                                ? "bg-[#dc2626] text-white border-[#dc2626]"
                                : "bg-[#2a2a2a] text-[#aaa] border-transparent hover:bg-[#333]"
                            )}
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Name of the Marketing Channel</label>
                      <input {...register("marketingChannelName")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Domain & Hosting Details</label>
                      <input {...register("domainHostingDetails")} placeholder="Provider, expiry dates, etc." className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Business Address</label>
                      <textarea {...register("businessAddress")} rows={3} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" />
                    </div>
                  </div>
                </section>

                {/* ── 03. Key Challenges & Support ──────────────────────── */}
                <section>
                  <h4 className="text-[11px] font-bold text-[#444] uppercase tracking-[3px] mb-6 border-b border-[#1f1f1f] pb-2">03. Key Challenges & Support</h4>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Challenge 1</label>
                      <input {...register("challenge1")} placeholder="Primary business obstacle" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Challenge 2</label>
                      <input {...register("challenge2")} placeholder="Secondary concern" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Challenge 3</label>
                      <input {...register("challenge3")} placeholder="Other support needed" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-[14px] text-white font-bold">Social Media Manager</h4>
                            <p className="text-[12px] text-[#888] mt-0.5">Existing support available?</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setValue("hasMarketingTeam", !watchHasSMM, { shouldDirty: true })}
                            className={cn("w-[44px] h-[24px] rounded-full relative transition-colors duration-300", watchHasSMM ? "bg-[#dc2626]" : "bg-[#444]")}
                          >
                            <div className={cn("w-[18px] h-[18px] bg-white rounded-full absolute top-[3px] transition-all duration-300", watchHasSMM ? "right-[3px]" : "left-[3px]")} />
                          </button>
                        </div>
                        <input {...register("marketingTeamDetails")} placeholder="Details..." className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md h-9 px-3 text-white text-[13px] outline-none focus:border-[#dc2626]" />
                      </div>
                      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-[14px] text-white font-bold">Video Editing</h4>
                            <p className="text-[12px] text-[#888] mt-0.5">In-house or outsourced?</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setValue("hasVideoEditing", !watchHasVideo, { shouldDirty: true })}
                            className={cn("w-[44px] h-[24px] rounded-full relative transition-colors duration-300", watchHasVideo ? "bg-[#dc2626]" : "bg-[#444]")}
                          >
                            <div className={cn("w-[18px] h-[18px] bg-white rounded-full absolute top-[3px] transition-all duration-300", watchHasVideo ? "right-[3px]" : "left-[3px]")} />
                          </button>
                        </div>
                        <input {...register("videoEditingDetails")} placeholder="Details..." className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md h-9 px-3 text-white text-[13px] outline-none focus:border-[#dc2626]" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Notes</label>
                      <textarea {...register("notes")} rows={3} placeholder="Administrative observations..." className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" />
                    </div>
                  </div>
                </section>

                {/* ── 04. Account Management ─────────────────────────────── */}
                <section>
                  <h4 className="text-[11px] font-bold text-[#444] uppercase tracking-[3px] mb-6 border-b border-[#1f1f1f] pb-2">04. Account Management</h4>
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Membership Plan</label>
                        <select {...register("membershipPlan")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none">
                          <option value="free">Free</option>
                          <option value="starter">Starter</option>
                          <option value="premium">Premium</option>
                          <option value="vip">VIP</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Status</label>
                        <select {...register("status")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none">
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="paused">Paused</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Verification Status</label>
                        <select {...register("verificationStatus")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none">
                          <option value="awaiting_kyc">Awaiting KYC</option>
                          <option value="under_review">Under Review</option>
                          <option value="verified">Verified</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">Account Manager</label>
                        <select {...register("accountManagerId")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none">
                          <option value="">Unassigned</option>
                          {managers?.map((m: any) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">
                        Access Tier <span className="normal-case text-[#444] font-normal">(controls locked content)</span>
                      </label>
                      <select {...register("currentTier", { valueAsNumber: true })} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none">
                        {tiers.length === 0
                          ? <option value={1}>Tier 1 (Default)</option>
                          : tiers.map((t: any) => (
                            <option key={t.id} value={t.tierNumber}>{t.label} (Tier {t.tierNumber})</option>
                          ))
                        }
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">
                        Password <span className="normal-case text-[#444] font-normal">(leave blank to keep unchanged)</span>
                      </label>
                      <div className="flex items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 overflow-hidden focus-within:border-[#dc2626]">
                        <input
                          type={showEditPassword ? "text" : "password"}
                          {...register("password")}
                          placeholder="Enter new password..."
                          className="w-full h-full bg-transparent px-4 text-white text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditPassword(p => !p)}
                          className="px-3 text-[#555] hover:text-white transition-colors"
                        >
                          {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {errors.password && <p className="text-[12px] text-red-500 mt-1">{errors.password.message}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">KYC Document</label>
                      <div
                        onClick={() => editKycRef.current?.click()}
                        className="border-2 border-dashed border-[#333] hover:border-[#dc2626]/50 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[#1a1a1a]"
                      >
                        <UploadCloud size={24} className="text-[#666] mb-2" />
                        <p className="text-[13px] text-white font-medium mb-1">
                          {editKycDoc ? editKycDoc.name : editingMember?.kycDocumentUrl ? "Replace existing document" : "Click to upload Aadhaar / GST Certificate"}
                        </p>
                        <p className="text-[11px] text-[#555] uppercase tracking-wider">PDF, JPG up to 10MB</p>
                        <input
                          type="file"
                          ref={editKycRef}
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && file.size <= 10 * 1024 * 1024) {
                              setEditKycDoc(file);
                            } else if (file) {
                              toast.error("File exceeds 10MB limit");
                            }
                          }}
                        />
                      </div>
                      {editKycDoc && (
                        <button
                          type="button"
                          onClick={() => setEditKycDoc(null)}
                          className="mt-2 text-[12px] text-red-500 hover:underline flex items-center gap-1"
                        >
                          <X size={12} /> Remove file
                        </button>
                      )}
                      {!editKycDoc && editingMember?.kycDocumentUrl && (
                        <a
                          href={editingMember.kycDocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 text-[12px] text-blue-400 hover:underline flex items-center gap-1"
                        >
                          View current document
                        </a>
                      )}
                    </div>
                  </div>
                </section>

              </div>
              <div className="px-8 py-6 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-8 py-2.5 rounded-md font-rajdhani font-bold text-[12px] text-[#606060] hover:text-white uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating || editIsUploading}
                  className="bg-[#dc2626] hover:bg-red-700 text-white px-10 py-2.5 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-[2px] transition-all shadow-xl flex items-center gap-2 active:scale-95"
                >
                  {(isUpdating || editIsUploading) && <Loader2 size={16} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROGRESS MODAL */}
      {progressMemberId && <MemberProgressModal memberId={progressMemberId} allWorkshops={allWorkshops} onClose={() => setProgressMemberId(null)} />}

      {/* DELETE CONFIRMATION */}
      {deletingMemberId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="text-red-500" size={32} />
              </div>
              <h3 className="font-rajdhani text-xl font-bold uppercase tracking-widest mb-2 text-[#f0f0f0]">Authorize Deletion?</h3>
              <p className="text-[#606060] text-sm leading-relaxed mb-8">
                This action is permanent. All member data will be purged from the system.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleDelete(deletingMemberId)}
                  className="w-full bg-[#dc2626] hover:bg-red-700 text-white py-3 rounded-lg font-rajdhani font-bold text-[13px] uppercase tracking-[2px] transition-all shadow-lg active:scale-95"
                >
                  Confirm Purge
                </button>
                <button 
                  onClick={() => setDeletingMemberId(null)}
                  className="w-full bg-[#1a1a1a] border border-[#333] hover:border-[#444] text-[#a0a0a0] hover:text-white py-3 rounded-lg font-rajdhani font-bold text-[13px] uppercase tracking-[2px] transition-all"
                >
                  Abort Action
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function InfoItem({ label, value, valueClassName = "text-white" }: { label: string; value: string | React.ReactNode; valueClassName?: string }) {
  return (
    <div>
      <label className="block text-[10px] text-[#555] font-bold uppercase tracking-widest mb-1 font-rajdhani">{label}</label>
      <div className={cn("text-[14px] font-medium tracking-tight", valueClassName)}>{value}</div>
    </div>
  );
}

function MemberProgressModal({ memberId, allWorkshops, onClose }: { memberId: string; allWorkshops: any[]; onClose: () => void }) {
  const { data, isLoading } = useMemberProgress(memberId);
  const progress = (data as any)?.data;
  const allBadges = (useListAllBadges().data as any)?.data || [];
  const { data: badgesData, refetch: refetchBadges } = useListMemberBadges(memberId);
  const memberBadges = (badgesData as any)?.data || [];
  const assignBadge = useAssignBadge(memberId);
  const removeBadge = useRemoveBadge(memberId);
  const { data: enrollmentsData, refetch: refetchEnrollments } = useMemberEnrollments(memberId);
  const memberEnrollments = (enrollmentsData as any)?.data || [];
  const enrollInWorkshop = useEnrollMemberInWorkshop(memberId);
  const removeEnrollment = useRemoveMemberEnrollment(memberId);
  const [selectedBadgeId, setSelectedBadgeId] = useState("");
  const [selectedWorkshopId, setSelectedWorkshopId] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "enrollments" | "progress">("info");
  const [expandedWorkshop, setExpandedWorkshop] = useState<string | null>(null);
  const [removingEnrollmentId, setRemovingEnrollmentId] = useState<string | null>(null);

  const handleAssign = async () => {
    if (!selectedBadgeId) return;
    try { await assignBadge.mutateAsync(selectedBadgeId); toast.success("Badge assigned"); setSelectedBadgeId(""); refetchBadges(); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleRemove = async (badgeId: string) => {
    try { await removeBadge.mutateAsync(badgeId); toast.success("Badge removed"); refetchBadges(); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleEnroll = async () => {
    if (!selectedWorkshopId) return;
    try { await enrollInWorkshop.mutateAsync(selectedWorkshopId); toast.success("Enrolled"); setSelectedWorkshopId(""); refetchEnrollments(); }
    catch (e: any) { toast.error(e.message || "Failed to enroll"); }
  };

  const handleRemoveEnrollment = async (workshopId: string) => {
    try { await removeEnrollment.mutateAsync(workshopId); toast.success("Enrollment removed"); setRemovingEnrollmentId(null); refetchEnrollments(); }
    catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const enrolledWorkshopIds = new Set(memberEnrollments.map((e: any) => e.workshopId));
  const unenrolledWorkshops = allWorkshops.filter((w: any) => !enrolledWorkshopIds.has(w.id));

  const getStatusChip = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-green-500/10 text-green-400 border-green-500/20",
      completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      paused: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      expired: "bg-red-500/10 text-red-400 border-red-500/20",
    };
    return map[status] || "bg-[#222] text-[#606060] border-[#333]";
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-8 py-6 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <Trophy className="text-yellow-500" size={20} />
            <h3 className="font-rajdhani text-xl font-bold uppercase tracking-widest">Member Progress & Badges</h3>
          </div>
          <button onClick={onClose} className="text-[#606060] hover:text-white transition-colors"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2a2a] bg-[#1a1a1a]">
          {([
            { key: "info", label: "Info & Badges" },
            { key: "enrollments", label: `Enrollments${memberEnrollments.length ? ` (${memberEnrollments.length})` : ""}` },
            { key: "progress", label: "Progress" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3.5 font-rajdhani font-bold text-[11px] uppercase tracking-[2px] border-b-2 transition-all ${activeTab === tab.key ? "border-[#dc2626] text-[#f0f0f0]" : "border-transparent text-[#606060] hover:text-[#a0a0a0]"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-8 max-h-[65vh] overflow-y-auto">
          {/* INFO TAB */}
          {activeTab === "info" && (
            <div className="space-y-6">
              <div>
                <h4 className="flex items-center gap-2 text-[#dc2626] font-rajdhani font-bold text-[13px] uppercase tracking-[2px] mb-4"><Trophy size={16} /> Assigned Badges</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                  {memberBadges.length === 0
                    ? <p className="text-[#444] text-sm italic">No badges assigned yet.</p>
                    : memberBadges.map((mb: any) => (
                      <div key={mb.id} className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-lg">
                        {mb.badge?.iconUrl && <img src={mb.badge.iconUrl} alt="" className="w-4 h-4 object-contain" />}
                        <span className="text-[12px] font-bold text-[#f0f0f0]">{mb.badge?.label || mb.badge?.name}</span>
                        <button onClick={() => handleRemove(mb.badgeId)} className="text-[#444] hover:text-red-400 transition-colors"><X size={12} /></button>
                      </div>
                    ))}
                </div>
                {allBadges.length > 0 && (
                  <div className="flex gap-2">
                    <select value={selectedBadgeId} onChange={e => setSelectedBadgeId(e.target.value)} className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 px-4 text-white text-sm outline-none focus:border-[#dc2626] transition-all appearance-none">
                      <option value="">Select a badge to assign...</option>
                      {allBadges.map((b: any) => <option key={b.id} value={b.id}>{b.label || b.name}</option>)}
                    </select>
                    <button onClick={handleAssign} disabled={!selectedBadgeId || assignBadge.isPending} className="px-5 py-2 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2">
                      {assignBadge.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Assign
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ENROLLMENTS TAB */}
          {activeTab === "enrollments" && (
            <div className="space-y-4">
              {/* Enroll in workshop */}
              <div className="flex gap-2">
                <select
                  value={selectedWorkshopId}
                  onChange={e => setSelectedWorkshopId(e.target.value)}
                  className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 px-4 text-white text-sm outline-none focus:border-[#dc2626] transition-all appearance-none"
                >
                  <option value="">Select workshop to enroll...</option>
                  {unenrolledWorkshops.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.title}</option>
                  ))}
                </select>
                <button
                  onClick={handleEnroll}
                  disabled={!selectedWorkshopId || enrollInWorkshop.isPending}
                  className="px-5 py-2 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  {enrollInWorkshop.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Enroll
                </button>
              </div>

              {/* Enrolled workshops list */}
              {memberEnrollments.length === 0 ? (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-center py-10 space-y-2">
                  <Briefcase size={28} className="mx-auto text-[#333]" />
                  <p className="text-[#444] text-sm font-rajdhani font-bold uppercase tracking-widest">Not enrolled in any workshops</p>
                </div>
              ) : (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#2a2a2a]">
                        <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Workshop</th>
                        <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Status</th>
                        <th className="px-4 py-3 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Enrolled</th>
                        <th className="px-4 py-3 w-[48px]" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                      {memberEnrollments.map((e: any) => (
                        <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 font-bold text-[#f0f0f0] text-[13px]">{e.workshop?.title || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-widest font-rajdhani ${getStatusChip(e.status)}`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#606060] text-[12px]">{safeFormatDate(e.enrolledAt)}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setRemovingEnrollmentId(e.workshopId)}
                              className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PROGRESS TAB */}
          {activeTab === "progress" && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex items-center gap-2 text-[#606060] py-10 justify-center"><Loader2 size={20} className="animate-spin" /> Loading progress...</div>
              ) : !progress?.workshops?.length ? (
                <div className="text-center py-12 space-y-3">
                  <Target size={32} className="mx-auto text-[#333]" />
                  <p className="text-[#444] text-sm font-rajdhani font-bold uppercase tracking-widest">Not enrolled in any workshops yet.</p>
                </div>
              ) : (
                progress.workshops.map((w: any) => {
                  const isExpanded = expandedWorkshop === w.workshopId;
                  const pct = w.overallPercent ?? 0;
                  const pctColor = pct >= 100 ? "#22c55e" : pct > 50 ? "#eab308" : "#dc2626";
                  return (
                    <div key={w.workshopId} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                      {/* Workshop header row */}
                      <button
                        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors text-left"
                        onClick={() => setExpandedWorkshop(isExpanded ? null : w.workshopId)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-bold text-[#f0f0f0] text-sm truncate">{w.workshopTitle}</p>
                            {w.status && (
                              <span className={`inline-flex px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-widest font-rajdhani ${getStatusChip(w.status)}`}>
                                {w.status}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-[#111] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pctColor }} />
                            </div>
                            <span className="text-[11px] font-bold font-rajdhani shrink-0" style={{ color: pctColor }}>{pct}%</span>
                            <span className="text-[10px] text-[#606060] shrink-0">{w.completedCount}/{w.totalCount} eps</span>
                          </div>
                        </div>
                        <MessageSquare size={14} className={`shrink-0 transition-transform ${isExpanded ? "rotate-180 text-[#dc2626]" : "text-[#444]"}`} />
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-[#2a2a2a] px-5 py-4 space-y-5">
                          {/* Last active */}
                          {w.lastActiveAt && (
                            <p className="text-[10px] text-[#606060] font-rajdhani uppercase tracking-widest">
                              Last active: <span className="text-[#a0a0a0]">{safeFormatDate(w.lastActiveAt)}</span>
                            </p>
                          )}

                          {/* Challenge breakdown */}
                          {w.challenges?.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold text-[#606060] uppercase tracking-[2px] font-rajdhani mb-2">Challenge Breakdown</p>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left">
                                    <th className="py-1.5 pr-4 text-[10px] text-[#444] font-bold uppercase tracking-widest font-rajdhani">Challenge</th>
                                    <th className="py-1.5 pr-4 text-[10px] text-[#444] font-bold uppercase tracking-widest font-rajdhani text-center">Episodes</th>
                                    <th className="py-1.5 text-[10px] text-[#444] font-bold uppercase tracking-widest font-rajdhani text-right">%</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1f1f1f]">
                                  {w.challenges.map((ch: any, i: number) => {
                                    const cp = ch.percent ?? (ch.totalCount ? Math.round((ch.completedCount / ch.totalCount) * 100) : 0);
                                    return (
                                      <tr key={i}>
                                        <td className="py-2 pr-4 text-[#a0a0a0] text-[12px] truncate max-w-[200px]">{ch.title}</td>
                                        <td className="py-2 pr-4 text-center">
                                          <span className="text-[11px] text-[#606060]">{ch.completedCount}/{ch.totalCount}</span>
                                        </td>
                                        <td className="py-2 text-right">
                                          <span className="text-[11px] font-bold font-rajdhani" style={{ color: cp >= 100 ? "#22c55e" : cp > 50 ? "#eab308" : "#dc2626" }}>{cp}%</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Assignment submissions */}
                          {w.assignments?.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold text-[#606060] uppercase tracking-[2px] font-rajdhani mb-2">Assignment Submissions</p>
                              <div className="space-y-1.5">
                                {w.assignments.map((a: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between bg-[#141414] border border-[#222] rounded-lg px-3 py-2">
                                    <span className="text-[12px] text-[#a0a0a0] truncate max-w-[250px]">{a.title}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {a.isSubmitted ? (
                                        <>
                                          <CheckCircle2 size={13} className="text-green-400" />
                                          <span className="text-[10px] text-[#606060]">{a.submittedAt ? safeFormatDate(a.submittedAt) : "Submitted"}</span>
                                        </>
                                      ) : (
                                        <span className="text-[10px] text-[#444] font-rajdhani uppercase tracking-widest">Pending</span>
                                      )}
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

        <div className="px-8 py-5 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end">
          <button onClick={onClose} className="bg-[#333] hover:bg-[#444] text-white px-8 py-2.5 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Close</button>
        </div>
      </div>

      {/* Remove enrollment confirm */}
      {removingEnrollmentId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl">
            <AlertCircle className="text-red-500 mx-auto mb-4" size={32} />
            <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">Remove Enrollment?</h3>
            <p className="text-[#606060] text-sm mb-6">The member will lose access to this workshop.</p>
            <div className="flex gap-3">
              <button onClick={() => setRemovingEnrollmentId(null)} className="flex-1 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[#a0a0a0] font-rajdhani font-bold text-[12px] uppercase tracking-widest hover:text-white transition-all">Cancel</button>
              <button onClick={() => handleRemoveEnrollment(removingEnrollmentId)} disabled={removeEnrollment.isPending} className="flex-1 py-2.5 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                {removeEnrollment.isPending && <Loader2 size={13} className="animate-spin" />} Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

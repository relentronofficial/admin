"use client";

import { useState, useRef, useEffect } from "react";
import {
  Camera,
  UploadCloud,
  X,
  UserPlus,
  Loader2,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";
import { useUploadImage } from "@/lib/hooks/useAdmin";
import { useCreateMember, useGetManagers } from "@/lib/hooks/useMembers";
import { AccountManagerSelect } from "@/components/members/AccountManagerSelect";
import { useClerk } from "@clerk/nextjs";

const MARKETING_CHANNELS = ["SEO", "Paid Ads", "Social Media", "Email", "Referral", "Offline"];

const memberSchema = z.object({
  memberId: z.string(),
  firstName: z.string().min(1, "First Name is required"),
  lastName: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Must be 10 digits").max(10, "Must be 10 digits"),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().length(6, "Must be 6 digits").optional().or(z.literal("")),
  businessName: z.string().optional(),
  businessEstablishedOn: z.string().optional(),
  productServiceType: z.string().optional(),
  instagramLink: z.string().optional(),
  annualTurnover: z.string().optional(),
  goalAfter90Days: z.string().optional(),
  preferredSessionMode: z.string().optional(),
  gstNumber: z.string().optional(),
  marketingChannels: z.array(z.string()).default([]),
  marketingChannelName: z.string().optional(),
  domainHostingDetails: z.string().optional(),
  businessAddress: z.string().optional(),
  challenge1: z.string().optional(),
  challenge2: z.string().optional(),
  challenge3: z.string().optional(),
  hasMarketingTeam: z.boolean().default(false),
  marketingTeamDetails: z.string().optional(),
  hasVideoEditing: z.boolean().default(false),
  videoEditingDetails: z.string().optional(),
  notes: z.string().optional(),
  membershipPlan: z.string().default("free"),
  status: z.string().default("active"),
  verificationStatus: z.string().default("awaiting_kyc"),
  accountManagerId: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type MemberInput = z.infer<typeof memberSchema>;

export default function AddMemberPage() {
  const router = useRouter();
  const { signOut } = useClerk();
  
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [kycDoc, setKycDoc] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const profileRef = useRef<HTMLInputElement>(null);
  const kycRef = useRef<HTMLInputElement>(null);

  const { data: managers, isLoading: isLoadingManagers } = useGetManagers();
  const createMember = useCreateMember();
  const uploadImage = useUploadImage();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting }
  } = useForm<MemberInput>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      memberId: `TBT-${Math.floor(1000 + Math.random() * 9000)}`,
      status: "active",
      verificationStatus: "awaiting_kyc",
      membershipPlan: "free",
      marketingChannels: [],
      hasMarketingTeam: false,
      hasVideoEditing: false,
    }
  });

  const watchChannels = watch("marketingChannels") || [];
  const watchHasSMM = watch("hasMarketingTeam");
  const watchHasVideo = watch("hasVideoEditing");
  const watchMemberId = watch("memberId");
  const watchAccountManagerId = watch("accountManagerId");

  const toggleChannel = (channel: string) => {
    if (watchChannels.includes(channel)) {
      setValue("marketingChannels", watchChannels.filter(c => c !== channel), { shouldDirty: true });
    } else {
      setValue("marketingChannels", [...watchChannels, channel], { shouldDirty: true });
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      setProfilePreview(URL.createObjectURL(file));
    }
  };

  const handleKycChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size <= 10 * 1024 * 1024) {
      setKycDoc(file);
    } else if (file) {
      toast.error("File exceeds 10MB limit");
    }
  };

  const onSubmit = async (data: MemberInput) => {
    try {
      setIsUploading(true);
      let profilePhotoUrl = "";
      let kycDocumentUrl = "";

      if (profileImage) {
        const { publicUrl } = await uploadImage.mutateAsync({ file: profileImage, pathPrefix: "members/photos" });
        profilePhotoUrl = publicUrl;
      }

      if (kycDoc) {
        const { publicUrl } = await uploadImage.mutateAsync({ file: kycDoc, pathPrefix: "members/kyc" });
        kycDocumentUrl = publicUrl;
      }

      const { challenge1, challenge2, challenge3, ...rest } = data;
      const payload = {
        ...rest,
        profilePhotoUrl,
        kycDocumentUrl,
        currentChallenges: [challenge1, challenge2, challenge3].filter(Boolean),
      };

      await createMember.mutateAsync(payload);
      toast.success("Member added successfully!");
      router.push("/members");
    } catch (err: any) {
      toast.error(err.message || "Failed to add member");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-[900px] mx-auto pb-24 font-sans bg-[#0a0a0a] min-h-screen pt-8 px-4 md:px-8">
        
        {/* Breadcrumb */}
        <div className="text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-6">
          DASHBOARD <span className="mx-2">/</span> MEMBERS <span className="mx-2">/</span> <span className="text-white">ADD MEMBER</span>
        </div>

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-8">
          <UserPlus size={24} className="text-white" />
          <h1 className="text-[28px] font-bold text-white tracking-tight">Add New Member</h1>
        </div>

        {/* Form Container */}
        <div className="space-y-[32px]">
          
          {/* SECTION 1: BASIC INFO */}
          <section className="bg-[#141414] border border-[#1f1f1f] rounded-[12px] overflow-hidden">
            <div className="px-8 pt-8 pb-4">
              <h2 className="text-[20px] font-bold text-white uppercase">BASIC INFO</h2>
              <p className="text-[13px] text-[#666] mt-1">Personal details and identity verification.</p>
            </div>
            
            <div className="p-8 pt-4 space-y-6">
              {/* Row 1 */}
              <div className="flex items-start justify-between gap-6">
                <div 
                  onClick={() => profileRef.current?.click()}
                  className="w-[80px] h-[80px] rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center cursor-pointer overflow-hidden relative group"
                >
                  {profilePreview ? (
                    <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={24} className="text-[#555] group-hover:text-white transition-colors" />
                  )}
                  <input type="file" ref={profileRef} onChange={handleProfileChange} accept="image/*" className="hidden" />
                </div>

                <div className="w-[300px]">
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Member ID</label>
                  <input 
                    {...register("memberId")}
                    readOnly
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none cursor-default font-mono" 
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">First Name</label>
                  <input {...register("firstName")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
                  {errors.firstName && <p className="text-[12px] text-red-500 mt-1">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Last Name</label>
                  <input {...register("lastName")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">DOB</label>
                  <input type="date" {...register("dob")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] color-scheme-dark" />
                </div>
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Gender</label>
                  <select {...register("gender")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] appearance-none cursor-pointer">
                    <option value="" disabled>Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              {/* Row 4 */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Email</label>
                  <input {...register("email")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
                  {errors.email && <p className="text-[12px] text-red-500 mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Phone <span className="text-[#dc2626]">*</span></label>
                  <div className="flex items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] overflow-hidden focus-within:border-[#dc2626]">
                    <span className="px-4 text-[#888] font-bold text-[14px] border-r border-[#2a2a2a]">+91</span>
                    <input {...register("phone")} className="w-full h-full bg-transparent px-4 text-white placeholder-[#555] text-[14px] outline-none" />
                  </div>
                  {errors.phone && <p className="text-[12px] text-red-500 mt-1">{errors.phone.message}</p>}
                </div>
              </div>

              {/* Row 5 */}
              <div className="flex gap-6">
                <div className="w-[35%]">
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">City</label>
                  <input {...register("city")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
                </div>
                <div className="w-[35%]">
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">State</label>
                  <input {...register("state")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
                </div>
                <div className="w-[30%]">
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Pincode</label>
                  <input {...register("pincode")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
                  {errors.pincode && <p className="text-[12px] text-red-500 mt-1">{errors.pincode.message}</p>}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: BUSINESS INFO */}
          <section className="bg-[#141414] border border-[#1f1f1f] rounded-[12px] overflow-hidden">
            <div className="px-8 pt-8 pb-4">
              <h2 className="text-[20px] font-bold text-white uppercase">BUSINESS INFO</h2>
              <p className="text-[13px] text-[#666] mt-1">Corporate information and scale indicators.</p>
            </div>
            
            <div className="p-8 pt-4 space-y-6">
              {/* Row 1 */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Business Name</label>
                  <input {...register("businessName")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
                </div>
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Business Established On</label>
                  <input type="date" {...register("businessEstablishedOn")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] color-scheme-dark" />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Product/Service Type</label>
                  <select {...register("productServiceType")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] appearance-none cursor-pointer">
                    <option value="" disabled>Select...</option>
                    <option value="Product-based">Product-based</option>
                    <option value="Service-based">Service-based</option>
                    <option value="Both">Both</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Instagram Link</label>
                  <div className="flex items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] overflow-hidden focus-within:border-[#dc2626]">
                    <span className="px-4 text-[#888] font-bold text-[14px]">@</span>
                    <input {...register("instagramLink")} className="w-full h-full bg-transparent pr-4 text-white placeholder-[#555] text-[14px] outline-none" />
                  </div>
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Turnover (Annual)</label>
                  <select {...register("annualTurnover")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] appearance-none cursor-pointer">
                    <option value="" disabled>Select...</option>
                    <option value="Under 10L">Under 10L</option>
                    <option value="10L - 25L">10L - 25L</option>
                    <option value="25L - 50L">25L - 50L</option>
                    <option value="50L - 1Cr">50L - 1Cr</option>
                    <option value="1Cr - 5Cr">1Cr - 5Cr</option>
                    <option value="5Cr+">5Cr+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Goal after 90 days</label>
                  <input {...register("goalAfter90Days")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
                </div>
              </div>

              {/* Row 4 */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Preferred Session Mode</label>
                  <select {...register("preferredSessionMode")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] appearance-none cursor-pointer">
                    <option value="" disabled>Select...</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">GST Number</label>
                  <input {...register("gstNumber")} placeholder="22AAAAA0000A1Z5" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
                </div>
              </div>

              {/* Row 5 - Marketing Channels */}
              <div>
                <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-3">Existing Marketing Channel</label>
                <div className="flex flex-wrap gap-3">
                  {MARKETING_CHANNELS.map(channel => (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => toggleChannel(channel)}
                      className={cn(
                        "px-5 py-2.5 rounded-full text-[13px] font-medium transition-all duration-200 border",
                        watchChannels.includes(channel) 
                          ? "bg-[#dc2626] text-white border-[#dc2626]" 
                          : "bg-[#2a2a2a] text-[#aaa] border-transparent hover:bg-[#333]"
                      )}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 6 */}
              <div>
                <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Name of the Marketing Channel</label>
                <input {...register("marketingChannelName")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
              </div>

              {/* Row 7 */}
              <div>
                <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Domain & Hosting Details</label>
                <input {...register("domainHostingDetails")} placeholder="Provider, expiry dates, etc." className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
              </div>

              {/* Row 8 */}
              <div>
                <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Business Address</label>
                <textarea {...register("businessAddress")} rows={3} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] p-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] resize-none" />
              </div>
            </div>
          </section>

          {/* SECTION 3: KEY CHALLENGES & SUPPORT */}
          <section className="bg-[#141414] border border-[#1f1f1f] rounded-[12px] overflow-hidden">
            <div className="px-8 pt-8 pb-4">
              <h2 className="text-[20px] font-bold text-white uppercase">KEY CHALLENGES & SUPPORT</h2>
              <p className="text-[13px] text-[#666] mt-1">Identifying pain points and resources.</p>
            </div>
            
            <div className="p-8 pt-4 space-y-6">
              <div>
                <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Challenge 1</label>
                <input {...register("challenge1")} placeholder="Primary business obstacle" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
              </div>
              <div>
                <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Challenge 2</label>
                <input {...register("challenge2")} placeholder="Secondary concern" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
              </div>
              <div>
                <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Challenge 3</label>
                <input {...register("challenge3")} placeholder="Other support needed" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626]" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-[15px] text-white font-bold">Social Media Manager</h4>
                      <p className="text-[12px] text-[#888] mt-1">Existing support available?</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setValue("hasMarketingTeam", !watchHasSMM, { shouldDirty: true })}
                      className={cn("w-[44px] h-[24px] rounded-full relative transition-colors duration-300", watchHasSMM ? "bg-[#dc2626]" : "bg-[#444]")}
                    >
                      <div className={cn("w-[18px] h-[18px] bg-white rounded-full absolute top-[3px] transition-all duration-300", watchHasSMM ? "right-[3px]" : "left-[3px]")} />
                    </button>
                  </div>
                  <input {...register("marketingTeamDetails")} placeholder="..." className="w-full bg-[#141414] border border-[#2a2a2a] rounded-[6px] h-[38px] px-3 text-white placeholder-[#555] text-[13px] outline-none focus:border-[#dc2626]" />
                </div>

                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-[15px] text-white font-bold">Video Editing</h4>
                      <p className="text-[12px] text-[#888] mt-1">In-house or outsourced?</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setValue("hasVideoEditing", !watchHasVideo, { shouldDirty: true })}
                      className={cn("w-[44px] h-[24px] rounded-full relative transition-colors duration-300", watchHasVideo ? "bg-[#dc2626]" : "bg-[#444]")}
                    >
                      <div className={cn("w-[18px] h-[18px] bg-white rounded-full absolute top-[3px] transition-all duration-300", watchHasVideo ? "right-[3px]" : "left-[3px]")} />
                    </button>
                  </div>
                  <input {...register("videoEditingDetails")} placeholder="..." className="w-full bg-[#141414] border border-[#2a2a2a] rounded-[6px] h-[38px] px-3 text-white placeholder-[#555] text-[13px] outline-none focus:border-[#dc2626]" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Notes</label>
                <textarea {...register("notes")} placeholder="Specific notes regarding Instagram presence or strategy..." rows={3} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] p-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] resize-none" />
              </div>
            </div>
          </section>

          {/* SECTION 4: ACCOUNT MANAGEMENT */}
          <section className="bg-[#141414] border border-[#1f1f1f] rounded-[12px] overflow-hidden mb-12">
            <div className="px-8 pt-8 pb-4">
              <h2 className="text-[20px] font-bold text-white uppercase">ACCOUNT MANAGEMENT</h2>
              <p className="text-[13px] text-[#666] mt-1">Administrative controls and verification status.</p>
            </div>

            <div className="p-8 pt-4 space-y-6">
              {/* Row 1: Membership Plan | Password */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Membership Plan</label>
                  <select {...register("membershipPlan")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] appearance-none cursor-pointer">
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="premium">Premium</option>
                    <option value="vip">VIP</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Password <span className="text-[#dc2626]">*</span></label>
                  <div className="relative flex items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] overflow-hidden focus-within:border-[#dc2626]">
                    <input
                      {...register("password")}
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      className="w-full h-full bg-transparent px-4 pr-11 text-white placeholder-[#555] text-[14px] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 text-[#555] hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-[12px] text-red-500 mt-1">{errors.password.message}</p>}
                </div>
              </div>

              {/* Row 2: Status | Verification Status */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Status</label>
                  <select {...register("status")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-green-500 font-medium placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] appearance-none cursor-pointer">
                    <option value="" disabled className="text-white">Select...</option>
                    <option value="active" className="text-green-500">Active</option>
                    <option value="inactive" className="text-yellow-500">Inactive</option>
                    <option value="paused" className="text-blue-400">Paused</option>
                    <option value="suspended" className="text-red-500">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Verification Status</label>
                  <select {...register("verificationStatus")} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-[8px] h-[44px] px-4 text-white placeholder-[#555] text-[14px] outline-none focus:border-[#dc2626] appearance-none cursor-pointer">
                    <option value="awaiting_kyc">Awaiting KYC</option>
                    <option value="under_review">Under Review</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Assign Account Manager */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-2">Assign Account Manager</label>
                  <AccountManagerSelect
                    managers={Array.isArray(managers) ? managers : []}
                    isLoading={isLoadingManagers}
                    value={watchAccountManagerId || ""}
                    onChange={(id) => setValue("accountManagerId", id, { shouldDirty: true })}
                  />
                </div>
              </div>

              <div className="pt-4">
                <label className="block text-[11px] font-[600] text-[#888] tracking-[0.05em] uppercase mb-4 text-center">KYC Document Upload</label>
                <div 
                  onClick={() => kycRef.current?.click()}
                  className="max-w-[400px] mx-auto border-2 border-dashed border-[#333] hover:border-[#dc2626]/50 rounded-[12px] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[#1a1a1a]"
                >
                  <UploadCloud size={32} className="text-[#666] mb-3" />
                  <p className="text-[14px] text-white font-medium mb-1">
                    {kycDoc ? kycDoc.name : "Click to upload Aadhaar / GST Certificate"}
                  </p>
                  <p className="text-[11px] text-[#666] uppercase tracking-wider">PDF, JPG UP TO 10MB</p>
                  <input type="file" ref={kycRef} onChange={handleKycChange} accept=".pdf,.jpg,.jpeg,.png" className="hidden" />
                </div>
                {kycDoc && (
                  <div className="max-w-[400px] mx-auto mt-3 flex justify-center">
                    <button type="button" onClick={() => setKycDoc(null)} className="text-[12px] text-red-500 hover:underline flex items-center gap-1">
                      <X size={12} /> Remove file
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Sticky Footer */}
        <div className="fixed bottom-0 right-0 left-[220px] bg-[#0a0a0a]/90 backdrop-blur-md border-t border-[#1f1f1f] px-8 py-4 flex items-center justify-between z-50">
          <button onClick={() => signOut()} type="button" className="flex items-center gap-2 text-[#888] hover:text-white transition-colors text-[13px] font-semibold">
            <LogOut size={16} /> Logout
          </button>
          
          <div className="flex items-center gap-4">
            <button 
              type="button"
              onClick={() => router.push("/members")}
              className="px-6 py-[12px] text-[#888] hover:text-white text-[13px] font-bold uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting || isUploading}
              className="bg-[#dc2626] text-white px-[32px] py-[12px] rounded-[8px] text-[13px] font-bold uppercase tracking-wider hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {(isSubmitting || isUploading) && <Loader2 size={16} className="animate-spin" />}
              Save Member
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

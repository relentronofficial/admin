"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  User,
  Shield,
  Loader2,
  Camera,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useGetAdmin, useUpdateAdmin, useUploadImage } from "@/lib/hooks/useAdmin";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

const ROLES = ["super_admin", "admin", "account_manager", "mentor", "moderator"] as const;
const DEPARTMENTS = ["Engineering", "Marketing", "Operations", "Finance", "HR", "Sales", "Support", "General"];
const STATUS_OPTIONS = ["active", "inactive", "suspended", "pending_approval"] as const;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1.5">
      {children}
    </label>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white text-[13px] outline-none focus:border-[#dc2626] transition-colors placeholder:text-[#444]",
        className
      )}
    />
  );
}

function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white text-[13px] outline-none focus:border-[#dc2626] transition-colors",
        className
      )}
    >
      {children}
    </select>
  );
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white text-[13px] outline-none focus:border-[#dc2626] transition-colors placeholder:text-[#444] resize-none",
        className
      )}
    />
  );
}

const formatLabel = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function EditAdminPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: admin, isLoading } = useGetAdmin(id);
  const updateAdmin = useUpdateAdmin();
  const uploadImage = useUploadImage();

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    alternatePhone: "",
    role: "",
    department: "",
    designation: "",
    country: "",
    state: "",
    city: "",
    address: "",
    notes: "",
    status: "",
    profilePhotoUrl: "",
  });

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Populate form when admin data loads
  useEffect(() => {
    if (admin) {
      setForm({
        fullName:       admin.fullName       ?? "",
        phone:          admin.phone          ?? "",
        alternatePhone: admin.alternatePhone ?? "",
        role:           admin.role           ?? "",
        department:     admin.department     ?? "",
        designation:    admin.designation    ?? "",
        country:        admin.country        ?? "",
        state:          admin.state          ?? "",
        city:           admin.city           ?? "",
        address:        admin.address        ?? "",
        notes:          admin.notes          ?? "",
        status:         admin.status         ?? "active",
        profilePhotoUrl: admin.profilePhotoUrl ?? "",
      });
    }
  }, [admin]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const result = await uploadImage.mutateAsync({ file, pathPrefix: "admins/avatars" });
      set("profilePhotoUrl", result.publicUrl);
      toast.success("Photo updated.");
    } catch {
      toast.error("Photo upload failed.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!form.fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }
    try {
      await updateAdmin.mutateAsync({ id, data: form });
      toast.success("Admin updated successfully.");
      router.push("/admins");
    } catch {
      toast.error("Failed to update admin.");
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-40">
          <Loader2 size={40} className="animate-spin text-[#dc2626]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!admin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Shield size={40} className="text-[#333]" />
          <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest">Admin not found</p>
          <button onClick={() => router.push("/admins")} className="text-[#dc2626] text-[13px] font-bold font-rajdhani uppercase tracking-widest hover:underline">
            Back to list
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/admins")}
              className="p-2 rounded-lg border border-[#2a2a2a] text-[#606060] hover:text-white hover:border-[#444] transition-all">
              <ArrowLeft size={16} />
            </button>
            <div className="flex gap-3 items-start">
              <div className="w-1 bg-[#dc2626] rounded-full min-h-[40px]" />
              <div>
                <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Edit Admin</h1>
                <p className="text-[11px] text-[#606060] font-rajdhani font-bold uppercase tracking-widest">{admin.employeeId} · {admin.email}</p>
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={updateAdmin.isPending}
            className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2.5 rounded-md font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-95 disabled:opacity-50">
            {updateAdmin.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Changes
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left — Photo + Identity */}
          <div className="space-y-5">
            {/* Profile photo */}
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-4">Profile Photo</p>
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-24 h-24">
                  <div className="w-24 h-24 rounded-xl bg-[#1a1a1a] border border-[#333] overflow-hidden flex items-center justify-center">
                    {form.profilePhotoUrl ? (
                      <img src={form.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={36} className="text-[#333]" />
                    )}
                  </div>
                  {form.profilePhotoUrl && (
                    <button onClick={() => set("profilePhotoUrl", "")}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white hover:bg-red-700 transition-colors">
                      <X size={10} />
                    </button>
                  )}
                </div>
                <label className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border border-[#333] text-[11px] font-bold font-rajdhani uppercase tracking-widest cursor-pointer transition-all",
                  isUploadingPhoto ? "text-[#444] pointer-events-none" : "text-[#a0a0a0] hover:border-[#606060] hover:text-white"
                )}>
                  {isUploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                  {isUploadingPhoto ? "Uploading..." : "Change Photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={isUploadingPhoto} />
                </label>
              </div>
            </div>

            {/* Status */}
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-4">Account Status</p>
              <div className="grid grid-cols-1 gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button key={s} onClick={() => set("status", s)}
                    className={cn(
                      "py-2.5 px-3 rounded-lg border text-[11px] font-bold font-rajdhani uppercase tracking-wider transition-all text-left",
                      form.status === s
                        ? "border-[#dc2626] bg-[#dc2626]/10 text-[#dc2626]"
                        : "border-[#2a2a2a] text-[#606060] hover:border-[#444] hover:text-[#a0a0a0]"
                    )}>
                    {formatLabel(s)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Form fields */}
          <div className="lg:col-span-2 space-y-5">

            {/* Personal Info */}
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-4">Personal Information</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Full Name *</Label>
                  <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Full name" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <Label>Alternate Phone</Label>
                  <Input value={form.alternatePhone} onChange={(e) => set("alternatePhone", e.target.value)} placeholder="+91 98765 43210" />
                </div>
              </div>
            </div>

            {/* Role & Department */}
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-4">Role & Department</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Role</Label>
                  <Select value={form.role} onChange={(e) => set("role", e.target.value)}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{formatLabel(r)}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Department</Label>
                  <Select value={form.department} onChange={(e) => set("department", e.target.value)}>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Designation</Label>
                  <Input value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Senior Manager" />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-4">Location</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Country</Label>
                  <Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="India" />
                </div>
                <div>
                  <Label>State</Label>
                  <Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="Tamil Nadu" />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Chennai" />
                </div>
                <div className="md:col-span-3">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street address" />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-4">Notes</p>
              <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Internal notes about this admin..." />
            </div>

          </div>
        </div>

        {/* Bottom save bar */}
        <div className="flex justify-end gap-3 pb-8">
          <button onClick={() => router.push("/admins")}
            className="px-6 py-2.5 rounded-md border border-[#333] text-[12px] font-bold font-rajdhani uppercase tracking-widest text-[#a0a0a0] hover:border-[#606060] transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={updateAdmin.isPending}
            className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2.5 rounded-md font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-95 disabled:opacity-50">
            {updateAdmin.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Changes
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

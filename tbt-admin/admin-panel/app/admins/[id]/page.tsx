"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  User,
  Shield,
  ShieldCheck,
  Settings,
  Mail,
  Loader2,
  Camera,
  X,
  Plus,
  Search,
  ChevronDown,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useGetAdmin,
  useUpdateAdmin,
  useUploadImage,
  useSearchManagers,
  useGetCountries,
  useGetStates,
  useGetDistricts,
  useGetCities,
} from "@/lib/hooks/useAdmin";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

const ROLES = ["super_admin", "admin", "account_manager", "mentor", "moderator"] as const;
const DEPARTMENTS = ["Sales", "Engineering", "HR", "Finance", "Operations"];
const BLOOD_GROUPS = ["A+ve", "A-ve", "B+ve", "B-ve", "O+ve", "O-ve", "AB+ve", "AB-ve"];
const MODULES = ["Dashboard Metrics", "Members Management", "Course Curriculum", "Financial Audit"];
const STATUS_OPTIONS = ["active", "inactive", "suspended", "pending_approval"] as const;

type RbacRow = { module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean };

const formatLabel = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function parsePermissions(perms: any): RbacRow[] {
  const empty = MODULES.map((m) => ({ module: m, canView: false, canCreate: false, canEdit: false, canDelete: false }));
  if (!perms) return empty;
  if (Array.isArray(perms)) {
    const map = Object.fromEntries(perms.map((r: any) => [r.module, r]));
    return MODULES.map((m) => map[m] ?? { module: m, canView: false, canCreate: false, canEdit: false, canDelete: false });
  }
  // object format: { "Dashboard Metrics": { canView: true, ... } }
  return MODULES.map((m) => ({
    module: m,
    canView: !!perms[m]?.canView,
    canCreate: !!perms[m]?.canCreate,
    canEdit: !!perms[m]?.canEdit,
    canDelete: !!perms[m]?.canDelete,
  }));
}

function SectionHeader({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-rajdhani text-[13px] font-bold tracking-[1.5px] uppercase text-[#f0f0f0]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1.5">
      {children}
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="w-full bg-[#141414] border border-[#333] rounded-lg h-11 px-4 flex items-center text-[#606060] text-[13px] font-mono">
        {value || "—"}
      </div>
    </div>
  );
}

const inputCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white text-[13px] outline-none focus:border-[#dc2626] transition-colors placeholder:text-[#444]";
const selectCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white text-[13px] outline-none focus:border-[#dc2626] transition-colors appearance-none cursor-pointer";

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
    dob: "",
    bloodGroup: "B+ve",
    role: "account_manager",
    department: "Operations",
    designation: "",
    country: "India",
    state: "Tamil Nadu",
    district: "",
    city: "",
    address: "",
    notes: "",
    status: "active",
    profilePhotoUrl: "",
    reportingManagerId: "",
  });

  const [rbac, setRbac] = useState<RbacRow[]>(parsePermissions(null));
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [managerSearch, setManagerSearch] = useState("");
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);
  const managerRef = useRef<HTMLDivElement>(null);

  const { data: managers, isLoading: isLoadingManagers } = useSearchManagers(managerSearch);

  const { data: countries } = useGetCountries();
  const selectedCountry = countries?.find((c: any) => c.name === form.country || c.isoCode === form.country);
  const countryCode = selectedCountry?.isoCode ?? "";
  const { data: states } = useGetStates(countryCode);
  const selectedState = states?.find((s: any) => s.name === form.state || s.isoCode === form.state);
  const stateCode = selectedState?.isoCode ?? "";
  const { data: districts } = useGetDistricts(countryCode, stateCode);
  const { data: cities } = useGetCities(countryCode, stateCode);

  useEffect(() => {
    if (admin) {
      setForm({
        fullName: admin.fullName ?? "",
        phone: admin.phone ?? "",
        alternatePhone: admin.alternatePhone ?? "",
        dob: admin.dob ? String(admin.dob).split("T")[0] : "",
        bloodGroup: admin.bloodGroup ?? "B+ve",
        role: admin.role ?? "account_manager",
        department: admin.department ?? "Operations",
        designation: admin.designation ?? "",
        country: admin.country ?? "India",
        state: admin.state ?? "Tamil Nadu",
        district: admin.district ?? "",
        city: admin.city ?? "",
        address: admin.address ?? "",
        notes: admin.notes ?? "",
        status: admin.status ?? "active",
        profilePhotoUrl: admin.profilePhotoUrl ?? "",
        reportingManagerId: admin.reportingManagerId ?? "",
      });
      setTags(admin.tags ?? []);
      setRbac(parsePermissions(admin.permissions));
      if (admin.reportingManager?.fullName) {
        setManagerSearch(admin.reportingManager.fullName);
      }
    }
  }, [admin]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (managerRef.current && !managerRef.current.contains(e.target as Node)) {
        setShowManagerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleRbac(index: number, key: keyof Omit<RbacRow, "module">) {
    setRbac((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: !r[key] } : r)));
  }

  function setPreset(type: "super" | "manager") {
    setRbac(
      MODULES.map((m) => ({
        module: m,
        canView: true,
        canCreate: true,
        canEdit: type === "super",
        canDelete: type === "super",
      }))
    );
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
      await updateAdmin.mutateAsync({ id, data: { ...form, tags, rbac } });
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
          <button
            onClick={() => router.push("/admins")}
            className="text-[#dc2626] text-[13px] font-bold font-rajdhani uppercase tracking-widest hover:underline"
          >
            Back to list
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admins")}
              className="p-2 rounded-lg border border-[#2a2a2a] text-[#606060] hover:text-white hover:border-[#444] transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex gap-3 items-start">
              <div className="w-1 bg-[#dc2626] rounded-full min-h-[40px]" />
              <div>
                <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Edit Admin</h1>
                <p className="text-[11px] text-[#606060] font-rajdhani font-bold uppercase tracking-widest">
                  {admin.employeeId} · {admin.email}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={updateAdmin.isPending}
            className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2.5 rounded-md font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-95 disabled:opacity-50"
          >
            {updateAdmin.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Changes
          </button>
        </div>

        {/* Section 1: Basic Profile */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <SectionHeader icon={<User size={16} className="text-[#dc2626]" />} title="Basic Profile" />
          <div className="p-6 space-y-5">
            {/* Read-only identity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ReadOnlyField label="Employee ID" value={admin.employeeId} />
              <ReadOnlyField label="Email" value={admin.email} />
              <ReadOnlyField label="Username" value={admin.username} />
            </div>

            {/* Photo */}
            <div className="flex items-start gap-5">
              <div className="relative w-20 h-20 shrink-0">
                <div className="w-20 h-20 rounded-xl bg-[#1a1a1a] border border-[#333] overflow-hidden flex items-center justify-center">
                  {form.profilePhotoUrl ? (
                    <img src={form.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={28} className="text-[#333]" />
                  )}
                </div>
                {form.profilePhotoUrl && (
                  <button
                    onClick={() => set("profilePhotoUrl", "")}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white hover:bg-red-700"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
              <div className="space-y-2 pt-1">
                <label
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border border-[#333] text-[11px] font-bold font-rajdhani uppercase tracking-widest cursor-pointer transition-all",
                    isUploadingPhoto
                      ? "text-[#444] pointer-events-none"
                      : "text-[#a0a0a0] hover:border-[#606060] hover:text-white"
                  )}
                >
                  {isUploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                  {isUploadingPhoto ? "Uploading..." : "Change Photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={isUploadingPhoto} />
                </label>
                <p className="text-[10px] text-[#444] uppercase tracking-wider font-rajdhani font-bold">JPG, PNG, WEBP · Max 2MB</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Full Name *</Label>
                <input
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  className={inputCls}
                  placeholder="Full name"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className={inputCls}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <Label>Alternate Phone</Label>
                <input
                  value={form.alternatePhone}
                  onChange={(e) => set("alternatePhone", e.target.value)}
                  className={inputCls}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => set("dob", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <Label>Blood Group</Label>
                <div className="relative">
                  <select
                    value={form.bloodGroup}
                    onChange={(e) => set("bloodGroup", e.target.value)}
                    className={selectCls}
                  >
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Operational Role */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <SectionHeader icon={<Shield size={16} className="text-[#dc2626]" />} title="Operational Role" />
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Role</Label>
                <div className="relative">
                  <select
                    value={form.role}
                    onChange={(e) => set("role", e.target.value)}
                    className={cn(selectCls, "uppercase font-bold tracking-wider")}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {formatLabel(r)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                </div>
              </div>
              <div>
                <Label>Department</Label>
                <div className="relative">
                  <select
                    value={form.department}
                    onChange={(e) => set("department", e.target.value)}
                    className={selectCls}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                </div>
              </div>
              <div>
                <Label>Designation</Label>
                <input
                  value={form.designation}
                  onChange={(e) => set("designation", e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Senior Manager"
                />
              </div>
              <div ref={managerRef}>
                <Label>Reporting Manager</Label>
                <div className="relative">
                  <input
                    value={managerSearch}
                    onChange={(e) => {
                      setManagerSearch(e.target.value);
                      setShowManagerDropdown(true);
                    }}
                    onFocus={() => setShowManagerDropdown(true)}
                    className={cn(inputCls, "pl-10")}
                    placeholder="Search managers..."
                  />
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                  {showManagerDropdown && managerSearch.length > 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl z-50 overflow-hidden">
                      {isLoadingManagers ? (
                        <div className="p-4 flex items-center justify-center gap-2 text-[#606060] text-[12px]">
                          <Loader2 size={14} className="animate-spin" /> Searching...
                        </div>
                      ) : managers?.length > 0 ? (
                        <div className="max-h-[200px] overflow-y-auto">
                          {managers.map((m: any) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setManagerSearch(m.fullName);
                                set("reportingManagerId", m.id);
                                setShowManagerDropdown(false);
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-[#dc2626]/10 border-b border-[#333]/30 last:border-0 transition-colors"
                            >
                              <p className="text-[13px] text-[#f0f0f0] font-medium">{m.fullName}</p>
                              <p className="text-[11px] text-[#606060]">
                                {m.designation} · {m.employeeId}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-[#606060] text-[12px]">No managers found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Location Matrix */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <SectionHeader icon={<Mail size={16} className="text-[#dc2626]" />} title="Location Matrix" />
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Country</Label>
                <div className="relative">
                  <select
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                    className={selectCls}
                  >
                    {countries?.map((c: any) => (
                      <option key={c.isoCode} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                </div>
              </div>
              <div>
                <Label>State</Label>
                <div className="relative">
                  <select
                    value={form.state}
                    onChange={(e) => set("state", e.target.value)}
                    className={selectCls}
                  >
                    {states?.map((s: any) => (
                      <option key={s.isoCode} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                </div>
              </div>
              <div>
                <Label>District</Label>
                <div className="relative">
                  <select
                    value={form.district}
                    onChange={(e) => set("district", e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select district</option>
                    {(districts as string[] | undefined)?.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                </div>
              </div>
              <div>
                <Label>City</Label>
                <div className="relative">
                  <select
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select city</option>
                    {(cities as string[] | undefined)?.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Address</Label>
                <textarea
                  rows={3}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white text-[13px] outline-none focus:border-[#dc2626] transition-colors placeholder:text-[#444] resize-none"
                  placeholder="Street address"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Security Matrix RBAC */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <SectionHeader icon={<ShieldCheck size={16} className="text-[#dc2626]" />} title="Security Matrix (RBAC)">
            <div className="flex gap-2">
              <button
                onClick={() => setPreset("super")}
                className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded text-[9px] font-bold text-[#a0a0a0] uppercase tracking-wider hover:text-white transition-colors font-rajdhani"
              >
                Preset: Super
              </button>
              <button
                onClick={() => setPreset("manager")}
                className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded text-[9px] font-bold text-[#a0a0a0] uppercase tracking-wider hover:text-white transition-colors font-rajdhani"
              >
                Preset: Manager
              </button>
            </div>
          </SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#141414] border-b border-[#2a2a2a]">
                  <th className="px-6 py-4 text-[10px] uppercase tracking-[1.5px] text-[#606060] font-bold font-rajdhani w-[40%]">
                    System Module
                  </th>
                  {(["View", "Create", "Edit", "Delete"] as const).map((col) => (
                    <th key={col} className="px-4 py-4 text-[10px] uppercase tracking-[1.5px] text-[#606060] font-bold text-center font-rajdhani">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {rbac.map((row, idx) => (
                  <tr key={row.module} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4 text-[13px] text-[#f0f0f0] font-medium font-rajdhani">{row.module}</td>
                    {(["canView", "canCreate", "canEdit", "canDelete"] as const).map((key) => (
                      <td key={key} className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={row[key]}
                          onChange={() => toggleRbac(idx, key)}
                          className="w-4 h-4 rounded border-[#333] bg-[#141414] text-[#dc2626] cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 5: Account Status */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <SectionHeader icon={<Shield size={16} className="text-[#dc2626]" />} title="Account Status" />
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => set("status", s)}
                  className={cn(
                    "py-2.5 px-3 rounded-lg border text-[11px] font-bold font-rajdhani uppercase tracking-wider transition-all",
                    form.status === s
                      ? "border-[#dc2626] bg-[#dc2626]/10 text-[#dc2626]"
                      : "border-[#2a2a2a] text-[#606060] hover:border-[#444] hover:text-[#a0a0a0]"
                  )}
                >
                  {formatLabel(s)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 6: Operational Metadata */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <SectionHeader icon={<Settings size={16} className="text-[#dc2626]" />} title="Operational Metadata" />
          <div className="p-6 space-y-4">
            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 min-h-[48px] p-3 bg-[#141414] border border-[#2a2a2a] rounded-lg">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1.5 px-3 py-1 bg-[#dc2626]/10 border border-[#dc2626]/30 rounded text-[11px] font-bold text-[#dc2626] uppercase font-rajdhani"
                  >
                    {tag}
                    <button type="button" onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {showTagInput ? (
                  <input
                    autoFocus
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = tagInput.trim();
                        if (v && !tags.includes(v) && tags.length < 10) {
                          setTags((prev) => [...prev, v]);
                          setTagInput("");
                          setShowTagInput(false);
                        }
                      }
                      if (e.key === "Escape") setShowTagInput(false);
                    }}
                    onBlur={() => {
                      const v = tagInput.trim();
                      if (v && !tags.includes(v) && tags.length < 10) setTags((prev) => [...prev, v]);
                      setTagInput("");
                      setShowTagInput(false);
                    }}
                    className="bg-transparent border-none outline-none text-[12px] font-bold font-rajdhani text-[#f0f0f0] w-24"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTagInput(true)}
                    className="text-[#444] hover:text-[#666] flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider font-rajdhani"
                  >
                    <Plus size={12} /> Add Tag
                  </button>
                )}
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white text-[13px] outline-none focus:border-[#dc2626] transition-colors placeholder:text-[#444] resize-none"
                placeholder="Internal notes about this admin..."
              />
            </div>
          </div>
        </div>

        {/* Bottom save bar */}
        <div className="flex justify-end gap-3 pb-8">
          <button
            onClick={() => router.push("/admins")}
            className="px-6 py-2.5 rounded-md border border-[#333] text-[12px] font-bold font-rajdhani uppercase tracking-widest text-[#a0a0a0] hover:border-[#606060] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateAdmin.isPending}
            className="flex items-center gap-2 bg-[#dc2626] text-white px-6 py-2.5 rounded-md font-rajdhani font-bold text-[13px] tracking-[1.5px] uppercase hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-95 disabled:opacity-50"
          >
            {updateAdmin.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Changes
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

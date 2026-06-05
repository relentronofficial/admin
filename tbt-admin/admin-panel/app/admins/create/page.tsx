"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Shield, 
  User, 
  Lock, 
  RefreshCw, 
  Plus, 
  Upload,
  Camera,
  Bell,
  Settings,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  ChevronDown,
  X,
  Search,
  CheckCircle2,
  Loader2
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { cn } from "@/lib/utils";
import { createAdminSchema, type CreateAdminInput } from "@/lib/validators/admin";
import { 
  useMe,
  useGenerateAdminId, 
  useCheckUsername, 
  useCheckEmail, 
  useSearchManagers, 
  useGetCountries,
  useGetStates, 
  useGetDistricts,
  useGetCities, 
  useGeneratePassword, 
  useCreateAdmin,
  useUploadImage
} from "@/lib/hooks/useAdmin";
import { toast } from "react-hot-toast";

const modules = ["Dashboard Metrics", "Members Management", "Course Curriculum", "Financial Audit"];

export default function CreateAdminPage() {
  const router = useRouter();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const managerRef = useRef<HTMLDivElement>(null);

  const { data: me, isLoading: isLoadingMe } = useMe();
  const { data: generatedAdminId, isLoading: isLoadingId } = useGenerateAdminId();
  const { data: countries, isLoading: isLoadingCountries } = useGetCountries();
  const checkUsername = useCheckUsername();
  const checkEmail = useCheckEmail();
  const generatePassword = useGeneratePassword();
  const createAdmin = useCreateAdmin();
  const uploadImage = useUploadImage();

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    control,
    setError,
    clearErrors,
    formState: { errors, isDirty, isSubmitting }
  } = useForm<CreateAdminInput>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      employeeId: "",
      fullName: "",
      email: "",
      phone: "",
      alternatePhone: "",
      dob: "",
      bloodGroup: "B+ve",
      role: "account_manager",
      department: "Operations",
      country: "India",
      state: "Tamil Nadu",
      district: "Chennai",
      city: "Chennai",
      address: "",
      username: "",
      status: "active",
      password: "",
      confirmPassword: "",
      twoFactorEnabled: true,
      notes: "",
      tags: ["Senior"],
      rbac: modules.map(m => ({
        module: m,
        canView: m !== "Financial Audit",
        canCreate: m === "Members Management" || m === "Course Curriculum",
        canEdit: m === "Members Management" || m === "Course Curriculum",
        canDelete: m === "Course Curriculum",
      }))
    }
  });

  const { fields: rbacFields, update: updateRbac } = useFieldArray({
    control,
    name: "rbac"
  });

  const watchCountry = watch("country");
  const watchState = watch("state");
  const watchDistrict = watch("district");
  const watchUsername = watch("username");
  const watchEmail = watch("email");
  const watchTags = watch("tags") || [];

  // Find the codes for the library
  const selectedCountry = countries?.find((c: any) => c.name === watchCountry || c.isoCode === watchCountry);
  const countryCode = selectedCountry?.isoCode || "";

  const { data: states, isLoading: isLoadingStates } = useGetStates(countryCode);
  const selectedState = states?.find((s: any) => s.name === watchState || s.isoCode === watchState);
  const stateCode = selectedState?.isoCode || "";

  const { data: districts, isLoading: isLoadingDistricts } = useGetDistricts(countryCode, stateCode);
  const { data: cities, isLoading: isLoadingCities } = useGetCities(countryCode, stateCode);
  const { data: managers, isLoading: isLoadingManagers } = useSearchManagers(managerSearch);

  useEffect(() => {
    if (!isLoadingMe && me && me.role !== "SuperAdmin") {
      router.push("/dashboard");
    }
  }, [me, isLoadingMe, router]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (generatedAdminId) {
      setValue("employeeId", generatedAdminId);
    }
  }, [generatedAdminId, setValue]);

  // Sync locations with default values once loaded
  useEffect(() => {
    if (countries?.length && !watchCountry) {
      const india = countries.find((c: any) => c.name === "India");
      if (india) setValue("country", india.name);
    }
  }, [countries, setValue, watchCountry]);

  useEffect(() => {
    if (states?.length && !watchState && watchCountry === "India") {
      const tn = states.find((s: any) => s.name === "Tamil Nadu");
      if (tn) setValue("state", tn.name);
    }
  }, [states, setValue, watchState, watchCountry]);

  useEffect(() => {
    if (cities?.length && !getValues("city") && watchState === "Tamil Nadu") {
      const chennai = cities.find((c: string) => c === "Chennai");
      if (chennai) {
        setValue("district", "Chennai");
        setValue("city", "Chennai");
      }
    }
  }, [cities, setValue, watchState, getValues]);

  if (isLoadingMe || (me && me.role !== "SuperAdmin")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 size={40} className="animate-spin text-[#e02020]" />
        </div>
      </DashboardLayout>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Invalid file type. Please upload a JPG, PNG, or WEBP image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size exceeds 2MB limit.");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const triggerUpload = () => fileInputRef.current?.click();

  const removePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setProfileImage(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onAutoGeneratePassword = async () => {
    try {
      const pass = await generatePassword.mutateAsync();
      setValue("password", pass);
      setValue("confirmPassword", pass);
      setShowPassword(true);
      toast.success("Password generated and copied to clipboard!");
      navigator.clipboard.writeText(pass);
      setTimeout(() => setShowPassword(false), 3000);
    } catch (err) {
      toast.error("Failed to generate password");
    }
  };

  const addTag = () => {
    if (tagInput && !watchTags.includes(tagInput) && watchTags.length < 10) {
      setValue("tags", [...watchTags, tagInput], { shouldDirty: true });
      setTagInput("");
      setShowTagInput(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setValue("tags", watchTags.filter(tag => tag !== tagToRemove), { shouldDirty: true });
  };

  const toggleRbac = (index: number, key: 'canView' | 'canCreate' | 'canEdit' | 'canDelete') => {
    const current = rbacFields[index];
    updateRbac(index, { ...current, [key]: !current[key] });
  };

  const setPreset = (type: 'super' | 'manager') => {
    const newRbac = modules.map(m => ({
      module: m,
      canView: true,
      canCreate: true,
      canEdit: type === 'super',
      canDelete: type === 'super',
    }));
    setValue("rbac", newRbac, { shouldDirty: true });
  };

  const onSubmit = async (data: CreateAdminInput) => {
    try {
      setIsUploading(true);
      let profilePhotoUrl = "";

      if (selectedFile) {
        const { publicUrl } = await uploadImage.mutateAsync({ file: selectedFile, pathPrefix: "admins/photos" });
        profilePhotoUrl = publicUrl;
      }

      await createAdmin.mutateAsync({ ...data, profilePhotoUrl });
      toast.success("Admin created successfully!");
      setTimeout(() => router.push("/admins"), 1500);
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.error?.fields) {
        const fields = err.response.data.error.fields;
        Object.keys(fields).forEach((key: any) => {
          setError(key as any, { message: fields[key][0] });
        });
      } else {
        toast.error(err.message || "Failed to create admin");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-20 font-sans">
        
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1 bg-[#e02020] rounded-full h-10" />
          <div>
            <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Create Admin Account</h1>
            <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">Register a new system operator and define security protocols.</p>
          </div>
        </div>

        {/* Section 1: Basic Profile */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50 flex items-center gap-2">
            <User size={16} className="text-[#e02020]" />
            <h3 className="font-rajdhani text-[13px] font-bold tracking-[1.5px] uppercase text-[#f0f0f0]">Basic Profile</h3>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="field">
              <label>Admin System ID</label>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input 
                    {...register("employeeId")}
                    type="text" 
                    readOnly
                    className="w-full bg-[#141414] border border-[#333] rounded-md py-3 px-4 text-[14px] font-mono font-bold text-[#e02020] outline-none cursor-default" 
                  />
                  {isLoadingId && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] animate-spin" />}
                </div>
                <div className="text-[10px] text-[#444] uppercase font-bold tracking-wider font-rajdhani">Immutable Protocol</div>
              </div>
            </div>

            <div className="flex items-start gap-8 mb-10">
              <div 
                onClick={triggerUpload}
                className="w-24 h-24 rounded-lg bg-[#1f1f1f] border border-[#333] relative group cursor-pointer overflow-hidden flex items-center justify-center transition-all hover:border-[#e02020]/40"
              >
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={32} className="text-[#333]" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={20} className="text-white" />
                </div>
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 size={20} className="text-[#e02020] animate-spin" />
                  </div>
                )}
              </div>
              <div className="space-y-3 pt-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/jpeg,image/png,image/webp" className="hidden" />
                <button type="button" onClick={triggerUpload} className="px-4 py-2 bg-[#1f1f1f] border border-[#333] rounded text-[11px] font-bold text-[#a0a0a0] hover:text-[#f0f0f0] transition-colors uppercase tracking-wider font-rajdhani">Choose Identity Image</button>
                {profileImage && <button type="button" onClick={removePhoto} className="ml-3 text-[10px] text-red-500 uppercase font-bold tracking-wider hover:underline">Remove</button>}
                <p className="text-[10px] text-[#444] uppercase font-medium tracking-[0.5px]">Allowed: JPG, PNG, WEBP (Max 2MB)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="field">
                <label>Full Name</label>
                <input 
                  {...register("fullName")}
                  className={cn("w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0]", errors.fullName && "border-red-500/50")} 
                  placeholder="Enter full name" 
                />
                {errors.fullName && <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.fullName.message}</p>}
              </div>

              <div className="field">
                <label>System Email</label>
                <div className="relative">
                  <input 
                    {...register("email", {
                      onBlur: async (e) => {
                        if (!errors.email && e.target.value) {
                          const available = await checkEmail.mutateAsync(e.target.value);
                          if (!available) setError("email", { message: "Email already registered" });
                        }
                      }
                    })}
                    className={cn("w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0] pr-10", errors.email && "border-red-500/50")} 
                    placeholder="admin@tamilbusinesstribe.com" 
                  />
                  {checkEmail.isPending && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] animate-spin" />}
                  {!checkEmail.isPending && watchEmail && !errors.email && <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />}
                </div>
                {errors.email && <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.email.message}</p>}
              </div>
              
              <div className="field">
                <label>Contact Number</label>
                <div className="flex">
                  <span className="bg-[#1a1a1a] border border-[#333] border-r-0 rounded-l-md px-3 flex items-center text-[#666] text-[12px]">+91</span>
                  <input 
                    {...register("phone")}
                    className={cn("w-full bg-[#1f1f1f] border border-[#333] rounded-r-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0]", errors.contactNumber && "border-red-500/50")} 
                    placeholder="Enter mobile number" 
                  />
                </div>
                {errors.contactNumber && <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.contactNumber.message}</p>}
              </div>

              <div className="field">
                <label>Alternate Contact</label>
                <input {...register("alternatePhone")} className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0]" placeholder="Optional" />
              </div>

              <div className="field">
                <label>Date of Birth</label>
                <input 
                  {...register("dob")}
                  type="date"
                  className={cn("w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0] color-scheme-dark", errors.dateOfBirth && "border-red-500/50")} 
                />
                {errors.dateOfBirth && <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.dateOfBirth.message}</p>}
              </div>

              <div className="field">
                <label>Blood Group</label>
                <div className="relative">
                  <select {...register("bloodGroup")} className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] appearance-none transition-all text-[#f0f0f0] cursor-pointer">
                    {['A+ve', 'A-ve', 'B+ve', 'B-ve', 'O+ve', 'O-ve', 'AB+ve', 'AB-ve'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Role & Deployment */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50 flex items-center gap-2">
            <Shield size={16} className="text-[#e02020]" />
            <h3 className="font-rajdhani text-[13px] font-bold tracking-[1.5px] uppercase text-[#f0f0f0]">Operational Role</h3>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="field">
                <label>Access Privilege</label>
                <div className="relative">
                  <select {...register("role")} className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] appearance-none transition-all text-[#f0f0f0] cursor-pointer uppercase font-bold tracking-wider">
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="account_manager">Account Manager</option>
                    <option value="mentor">Mentor</option>
                    <option value="moderator">Moderator</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                </div>
              </div>

              <div className="field">
                <label>System Department</label>
                <div className="relative">
                  <select {...register("department")} className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] appearance-none transition-all text-[#f0f0f0] cursor-pointer">
                    <option>Sales</option>
                    <option>Engineering</option>
                    <option>HR</option>
                    <option>Finance</option>
                    <option>Operations</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                </div>
              </div>

              <div className="field">
                <label>Designation</label>
                <input {...register("designation")} className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0]" placeholder="E.g. Senior Manager" />
              </div>

              <div className="field" ref={managerRef}>
                <label>Reporting Manager</label>
                <div className="relative">
                  <input 
                    value={managerSearch}
                    onChange={(e) => {
                      setManagerSearch(e.target.value);
                      setShowManagerDropdown(true);
                    }}
                    onFocus={() => setShowManagerDropdown(true)}
                    className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 pl-10 pr-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0] placeholder:text-[#444]" 
                    placeholder="Search managers..." 
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060] opacity-40">
                    <Search size={14} />
                  </div>

                  {showManagerDropdown && (managerSearch.length > 2 || isLoadingManagers) && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#333] rounded-md shadow-2xl z-[110] overflow-hidden">
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
                                setValue("reportingManagerId", m.id, { shouldDirty: true });
                                setShowManagerDropdown(false);
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-[#e02020]/10 border-b border-[#333]/30 last:border-0 group transition-colors"
                            >
                              <p className="text-[13px] text-[#f0f0f0] font-medium group-hover:text-[#e02020]">{m.fullName}</p>
                              <p className="text-[11px] text-[#606060]">{m.designation} &middot; {m.employeeId}</p>
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

              <div className="field">
                <label>Employee ID</label>
                <input {...register("employeeId")} className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0]" placeholder="TBT-XXXX" />
                {errors.employeeId && <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.employeeId.message}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Location */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50 flex items-center gap-2">
            <Mail size={16} className="text-[#e02020]" />
            <h3 className="font-rajdhani text-[13px] font-bold tracking-[1.5px] uppercase text-[#f0f0f0]">Location Matrix</h3>
          </div>

          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div className="field">
              <label>Country</label>
              <div className="relative">
                <select 
                  {...register("country")} 
                  className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none appearance-none text-[#f0f0f0] cursor-pointer"
                >
                  {isLoadingCountries ? <option>Loading...</option> : countries?.map((c: any) => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
              </div>
            </div>

            <div className="field">
              <label>State</label>
              <div className="relative">
                <select 
                  {...register("state")} 
                  className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none appearance-none text-[#f0f0f0] cursor-pointer"
                >
                  {isLoadingStates ? <option>Loading...</option> : states?.map((s: any) => <option key={s.isoCode} value={s.name}>{s.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
              </div>
            </div>

            <div className="field">
              <label>District</label>
              <div className="relative">
                <select {...register("district")} className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none appearance-none text-[#f0f0f0] cursor-pointer">
                  {isLoadingDistricts ? <option>Loading...</option> : districts?.map((d: string) => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
              </div>
            </div>

            <div className="field">
              <label>City</label>
              <div className="relative">
                <select {...register("city")} className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none appearance-none text-[#f0f0f0] cursor-pointer">
                   {isLoadingCities ? <option>Loading...</option> : cities?.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
              </div>
            </div>

            <div className="field md:col-span-2">
              <label>Full Address</label>
              <textarea 
                {...register("address")}
                rows={3}
                className={cn("w-full bg-[#1f1f1f] border border-[#333] rounded-md py-3 px-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0] resize-none", errors.address && "border-red-500/50")} 
                placeholder="Enter complete workplace address" 
              />
              {errors.address && <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.address.message}</p>}
            </div>
          </div>
        </div>

        {/* Section 4: Security Matrix (RBAC) */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#e02020]" />
              <h3 className="font-rajdhani text-[13px] font-bold tracking-[1.5px] uppercase text-[#f0f0f0]">Security Matrix (RBAC)</h3>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setPreset('super')} className="px-3 py-1.5 bg-[#1f1f1f] border border-[#333] rounded text-[9px] font-bold text-[#a0a0a0] uppercase tracking-wider hover:text-white transition-colors font-rajdhani">Preset: Super</button>
              <button type="button" onClick={() => setPreset('manager')} className="px-3 py-1.5 bg-[#1f1f1f] border border-[#333] rounded text-[9px] font-bold text-[#a0a0a0] uppercase tracking-wider hover:text-white transition-colors font-rajdhani">Preset: Manager</button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#141414] border-b border-[#2a2a2a]">
                  <th className="px-6 py-4 text-[10px] uppercase tracking-[1.5px] text-[#606060] font-bold font-rajdhani w-[40%]">System Module</th>
                  <th className="px-4 py-4 text-[10px] uppercase tracking-[1.5px] text-[#606060] font-bold text-center font-rajdhani">View</th>
                  <th className="px-4 py-4 text-[10px] uppercase tracking-[1.5px] text-[#606060] font-bold text-center font-rajdhani">Create</th>
                  <th className="px-4 py-4 text-[10px] uppercase tracking-[1.5px] text-[#606060] font-bold text-center font-rajdhani">Edit</th>
                  <th className="px-4 py-4 text-[10px] uppercase tracking-[1.5px] text-[#606060] font-bold text-center font-rajdhani">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {rbacFields.map((field, idx) => (
                  <tr key={field.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-5 text-[13px] text-[#f0f0f0] font-medium font-rajdhani tracking-wide">{field.module}</td>
                    <td className="px-4 py-5 text-center">
                      <input type="checkbox" checked={field.canView} onChange={() => toggleRbac(idx, 'canView')} className="w-4 h-4 rounded border-[#333] bg-[#141414] text-[#e02020] focus:ring-offset-[#181818] cursor-pointer" />
                    </td>
                    <td className="px-4 py-5 text-center">
                      <input type="checkbox" checked={field.canCreate} onChange={() => toggleRbac(idx, 'canCreate')} className="w-4 h-4 rounded border-[#333] bg-[#141414] text-[#e02020] focus:ring-offset-[#181818] cursor-pointer" />
                    </td>
                    <td className="px-4 py-5 text-center">
                      <input type="checkbox" checked={field.canEdit} onChange={() => toggleRbac(idx, 'canEdit')} className="w-4 h-4 rounded border-[#333] bg-[#141414] text-[#e02020] focus:ring-offset-[#181818] cursor-pointer" />
                    </td>
                    <td className="px-4 py-5 text-center">
                      <input type="checkbox" checked={field.canDelete} onChange={() => toggleRbac(idx, 'canDelete')} className="w-4 h-4 rounded border-[#333] bg-[#141414] text-[#e02020] focus:ring-offset-[#181818] cursor-pointer" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.rbac && <p className="px-6 py-4 text-[10px] text-red-500 font-bold uppercase tracking-wider bg-red-500/5">{errors.rbac.message || (errors.rbac as any).root?.message}</p>}
        </div>

        {/* Section 5: Access Credentials */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50 flex items-center gap-2">
            <Lock size={16} className="text-[#e02020]" />
            <h3 className="font-rajdhani text-[13px] font-bold tracking-[1.5px] uppercase text-[#f0f0f0]">Access Credentials</h3>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="field">
                <label>Access Username</label>
                <div className="relative">
                  <input 
                    {...register("username", {
                      onBlur: async (e) => {
                        if (!errors.username && e.target.value) {
                          const available = await checkUsername.mutateAsync(e.target.value);
                          if (!available) setError("username", { message: "Username not available" });
                        }
                      }
                    })}
                    className={cn("w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0] pr-10", errors.username && "border-red-500/50")} 
                    placeholder="Enter unique username" 
                  />
                  {checkUsername.isPending && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] animate-spin" />}
                  {!checkUsername.isPending && watchUsername && !errors.username && <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />}
                </div>
                {errors.username && <p className="text-[10px] text-red-500 mt-1 font-medium">{errors.username.message}</p>}
              </div>

              <div className="field">
                <label>Account Status</label>
                <div className="relative">
                  <select {...register("status")} className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] appearance-none transition-all text-[#f0f0f0] cursor-pointer">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending_approval">Pending Approval</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="field flex-1 w-full">
                <label>Initial Access Cipher (Password)</label>
                <input {...register("password")} className={cn("w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0] font-mono", errors.password && "border-red-500/50")} type={showPassword ? "text" : "password"} placeholder="Minimum 8 characters" />
              </div>
              <div className="field flex-1 w-full">
                <label>Confirm Cipher</label>
                <input {...register("confirmPassword")} className={cn("w-full bg-[#1f1f1f] border border-[#333] rounded-md py-2.5 px-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0] font-mono", errors.confirmPassword && "border-red-500/50")} type={showPassword ? "text" : "password"} placeholder="Repeat cipher" />
              </div>
              <button 
                type="button"
                onClick={onAutoGeneratePassword}
                disabled={generatePassword.isPending}
                className="mb-6 h-[42px] flex items-center justify-center gap-2 px-6 bg-[#1f1f1f] border border-[#333] rounded text-[11px] font-bold text-[#e02020] hover:bg-[#e02020]/10 transition-all uppercase tracking-widest font-rajdhani disabled:opacity-50"
              >
                {generatePassword.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Auto Gen
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 -mt-4">
              {errors.password && <p className="text-[10px] text-red-500 font-medium">{errors.password.message}</p>}
              {errors.confirmPassword && <p className="text-[10px] text-red-500 font-medium">{errors.confirmPassword.message}</p>}
            </div>

            <div className="flex items-center justify-between p-4 bg-[#141414] border border-[#2a2a2a] rounded-lg">
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-[#e02020]/60" />
                <div>
                  <p className="text-[13px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wider">Multi-Factor Authentication (2FA)</p>
                  <p className="text-[10px] text-[#444] uppercase font-bold tracking-tight">Enable biometric or OTP verification for this entity.</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setValue("twoFactorEnabled", !watch("twoFactorEnabled"), { shouldDirty: true })}
                className={cn(
                  "w-12 h-6 rounded-full relative transition-all",
                  watch("twoFactorEnabled") ? "bg-[#e02020]" : "bg-[#222]"
                )}
              >
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                  watch("twoFactorEnabled") ? "right-1" : "left-1"
                )} />
              </button>
            </div>
          </div>
        </div>

        {/* Section 6: Protocol Notes & Tags */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-xl">
           <div className="px-6 py-4 border-b border-[#2a2a2a] bg-[#1a1a1a]/50 flex items-center gap-2">
            <Settings size={16} className="text-[#e02020]" />
            <h3 className="font-rajdhani text-[13px] font-bold tracking-[1.5px] uppercase text-[#f0f0f0]">Operational Metadata</h3>
          </div>
          <div className="p-8 space-y-6">
            <div className="field">
              <label>System Tags</label>
              <div className="flex flex-wrap gap-2 mb-3 min-h-[40px] p-4 bg-[#141414] border border-[#333] rounded-md">
                {watchTags.map(tag => (
                  <span key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-[#e02020]/10 border border-[#e02020]/30 rounded text-[11px] font-bold text-[#e02020] uppercase font-rajdhani">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}><X size={12} /></button>
                  </span>
                ))}
                {showTagInput ? (
                  <input 
                    autoFocus
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addTag(); }
                      if (e.key === 'Escape') setShowTagInput(false);
                    }}
                    onBlur={addTag}
                    className="bg-transparent border-none outline-none text-[12px] font-bold font-rajdhani text-[#f0f0f0] w-24"
                  />
                ) : (
                  <button type="button" onClick={() => setShowTagInput(true)} className="text-[#444] hover:text-[#666] flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider font-rajdhani">
                    <Plus size={12} /> Add Tag
                  </button>
                )}
              </div>
            </div>

            <div className="field">
              <label>Protocol Notes</label>
              <textarea 
                {...register("notes")}
                rows={4}
                className="w-full bg-[#1f1f1f] border border-[#333] rounded-md py-3 px-4 text-[13.5px] outline-none focus:border-[#e02020] transition-all text-[#f0f0f0] resize-none" 
                placeholder="Additional operational parameters or background info..." 
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-4 pt-6 border-t border-[#2a2a2a]">
          <button 
            type="button"
            onClick={() => {
              if (isDirty) {
                if (confirm("Discard unsaved data?")) {
                  router.push("/admins");
                }
              } else {
                router.push("/admins");
              }
            }}
            className="px-8 py-2.5 bg-transparent border border-[#333] rounded text-[13px] font-bold font-rajdhani tracking-[2px] uppercase text-[#606060] hover:text-[#f0f0f0] hover:border-[#606060] transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-[#e02020] text-white px-10 py-2.5 rounded font-rajdhani font-black text-[14px] tracking-[3px] uppercase hover:bg-[#ff3a3a] transition-all shadow-[0_0_20px_rgba(224,32,32,0.2)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> PROVISIONING...
              </>
            ) : (
              "Initialize Operator"
            )}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

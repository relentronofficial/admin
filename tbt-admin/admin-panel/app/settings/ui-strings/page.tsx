"use client";

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useGetUiStrings, useUpdateUiStrings } from "@/lib/hooks/useTbt";
import { toast } from "react-hot-toast";

const GROUPS = [
  {
    title: "Empty States",
    fields: [
      { key: "loading", label: "Loading Message" },
      { key: "noWorkshops", label: "No Workshops Message" },
      { key: "noResources", label: "No Resources Message" },
      { key: "qaLoadingLabel", label: "Q&A Loading Label" },
      { key: "errorGeneric", label: "Generic Error Message" },
      { key: "lockedContentMessage", label: "Locked Content Message" },
    ],
  },
  {
    title: "Countdown Labels",
    fields: [
      { key: "countdownDays", label: "Days Label" },
      { key: "countdownHours", label: "Hours Label" },
      { key: "countdownMins", label: "Minutes Label" },
      { key: "countdownSecs", label: "Seconds Label" },
    ],
  },
  {
    title: "Login Page",
    fields: [
      { key: "loginHeading", label: "Heading" },
      { key: "loginSubheading", label: "Subheading" },
      { key: "emailLabel", label: "Email Label" },
      { key: "emailPlaceholder", label: "Email Placeholder" },
      { key: "passwordLabel", label: "Password Label" },
      { key: "passwordPlaceholder", label: "Password Placeholder" },
      { key: "submitLabel", label: "Submit Button Label" },
    ],
  },
];

const DEFAULTS: Record<string, string> = {
  loading: "Loading...", noWorkshops: "No workshops enrolled yet.", noResources: "No resources found.",
  qaLoadingLabel: "Loading questions...", errorGeneric: "Something went wrong. Please try again.",
  lockedContentMessage: "Upgrade your tier to unlock this content.",
  countdownDays: "DAYS", countdownHours: "HOURS", countdownMins: "MINS", countdownSecs: "SECS",
  loginHeading: "Welcome Back", loginSubheading: "Sign in to continue your journey",
  emailLabel: "Email", emailPlaceholder: "Enter your email",
  passwordLabel: "Password", passwordPlaceholder: "Enter your password", submitLabel: "Sign In",
};

export default function UiStringsPage() {
  const { data, isLoading } = useGetUiStrings();
  const updateStrings = useUpdateUiStrings();
  const strings = (data as any)?.data;

  const [form, setForm] = useState<Record<string, string>>(DEFAULTS);

  useEffect(() => {
    if (strings) setForm({ ...DEFAULTS, ...strings });
  }, [strings]);

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    try {
      await updateStrings.mutateAsync(form);
      toast.success("UI strings saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
  };

  if (isLoading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-[#dc2626]" /></div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">UI Strings</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">All user-facing text labels and messages.</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={updateStrings.isPending}
            className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all">
            {updateStrings.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save All
          </button>
        </div>

        {GROUPS.map(group => (
          <div key={group.title} className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
            <p className="text-[10px] text-[#606060] uppercase font-bold tracking-widest font-rajdhani border-b border-[#2a2a2a] pb-3">{group.title}</p>
            {group.fields.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani">{label}</label>
                <input value={form[key] || ""} onChange={e => set(key, e.target.value)}
                  placeholder={DEFAULTS[key]}
                  className="w-full bg-[#141414] border border-[#333] rounded-lg h-10 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

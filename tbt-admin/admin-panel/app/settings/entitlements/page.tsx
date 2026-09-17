"use client";

import { useState, useEffect } from "react";
import { Loader2, Save, Shield, Users, Phone, Headphones, Star, CheckCircle2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useGetPlanEntitlements,
  useUpdatePlanEntitlement,
  useListSupportUsage,
  useRecordSupportUsage,
  useDeleteSupportUsage,
} from "@/lib/hooks/useTbt";
import toast from "react-hot-toast";

const PLANS = ["free", "starter", "premium", "vip", "enterprise"] as const;
type Plan = typeof PLANS[number];

const PLAN_COLORS: Record<Plan, string> = {
  free:       "#9ca3af",
  starter:    "#3b82f6",
  premium:    "#8b5cf6",
  vip:        "#eab308",
  enterprise: "#dc2626",
};

const USAGE_TYPES = [
  { value: "tech_support", label: "Tech Support" },
  { value: "ad_support",   label: "Ad Support" },
  { value: "group_call",   label: "Group Call" },
  { value: "one_to_one",   label: "One-to-One" },
] as const;

type EntitlementRow = {
  plan: string;
  tech_support_days: number;
  ad_support_days: number;
  group_call_count: number;
  call_credit_count: number;
  one_to_one_enabled: boolean;
};

function EntitlementCard({ row, onSave }: { row: EntitlementRow; onSave: (plan: string, data: any) => Promise<void> }) {
  const [form, setForm] = useState({
    techSupportDays:  row.tech_support_days,
    adSupportDays:    row.ad_support_days,
    groupCallCount:   row.group_call_count,
    callCreditCount:  row.call_credit_count,
    oneToOneEnabled:  row.one_to_one_enabled,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      techSupportDays:  row.tech_support_days,
      adSupportDays:    row.ad_support_days,
      groupCallCount:   row.group_call_count,
      callCreditCount:  row.call_credit_count,
      oneToOneEnabled:  row.one_to_one_enabled,
    });
  }, [row]);

  const color = PLAN_COLORS[row.plan as Plan] ?? "#9ca3af";

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(row.plan, form); toast.success(`${row.plan} entitlements saved`); }
    catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const numInput = (label: string, field: keyof typeof form) => (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[#606060]">{label}</label>
      <input
        type="number"
        min={0}
        value={form[field] as number}
        onChange={(e) => setForm((f) => ({ ...f, [field]: parseInt(e.target.value, 10) || 0 }))}
        className="w-full h-9 px-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-white text-sm outline-none focus:border-[#dc2626]"
      />
    </div>
  );

  return (
    <div className="bg-[#181818] rounded-xl border border-[#2a2a2a] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
          style={{ color, background: `${color}22` }}
        >
          {row.plan}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {numInput("Tech Support Days", "techSupportDays")}
        {numInput("Ad Support Days", "adSupportDays")}
        {numInput("Group Call Count", "groupCallCount")}
        {numInput("Extra Call Credits", "callCreditCount")}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setForm((f) => ({ ...f, oneToOneEnabled: !f.oneToOneEnabled }))}
          className="relative w-9 h-5 rounded-full transition-colors"
          style={{ background: form.oneToOneEnabled ? "#dc2626" : "#333" }}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.oneToOneEnabled ? "left-[18px]" : "left-0.5"}`} />
        </button>
        <span className="text-sm text-[#a0a0a0]">One-to-One with Shakthi included</span>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#dc2626] hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        Save
      </button>
    </div>
  );
}

export default function EntitlementsPage() {
  const { data: entData, isLoading } = useGetPlanEntitlements();
  const updateEntitlement = useUpdatePlanEntitlement();
  const { data: usageData } = useListSupportUsage({ limit: 20 });
  const recordUsage = useRecordSupportUsage();
  const deleteUsage = useDeleteSupportUsage();

  const [tab, setTab] = useState<"plans" | "usage">("plans");
  const [recordForm, setRecordForm] = useState({ memberId: "", type: "tech_support", notes: "" });
  const [recording, setRecording] = useState(false);

  const rows: EntitlementRow[] = (entData as any)?.data ?? [];
  const usageRows: any[] = (usageData as any)?.data ?? [];

  const handleSave = async (plan: string, data: any) => {
    await updateEntitlement.mutateAsync({ plan, data });
  };

  const handleRecord = async () => {
    if (!recordForm.memberId.trim()) return toast.error("Member ID required");
    setRecording(true);
    try {
      await recordUsage.mutateAsync({ memberId: recordForm.memberId, type: recordForm.type, notes: recordForm.notes || undefined });
      toast.success("Session recorded");
      setRecordForm({ memberId: "", type: "tech_support", notes: "" });
    } catch {
      toast.error("Failed to record session");
    } finally {
      setRecording(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield size={22} className="text-[#dc2626]" />
          <div>
            <h1 className="text-xl font-bold text-[#f0f0f0]">Plan Entitlements</h1>
            <p className="text-xs text-[#606060] mt-0.5">Define what each membership plan includes</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#2a2a2a]">
          {(["plans", "usage"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize ${
                tab === t ? "border-[#dc2626] text-[#f0f0f0]" : "border-transparent text-[#606060] hover:text-[#a0a0a0]"
              }`}
            >
              {t === "plans" ? "Plan Definitions" : "Usage Log"}
            </button>
          ))}
        </div>

        {tab === "plans" && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-[#606060]">
                <Loader2 size={16} className="animate-spin" /> Loading...
              </div>
            ) : rows.length === 0 ? (
              <p className="text-[#606060] text-sm">No entitlement rows found — they will be seeded on next backend restart.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {rows.map((row) => (
                  <EntitlementCard key={row.plan} row={row} onSave={handleSave} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "usage" && (
          <div className="space-y-5">
            {/* Record new session */}
            <div className="bg-[#181818] rounded-xl border border-[#2a2a2a] p-5 space-y-4">
              <h2 className="text-sm font-bold text-[#f0f0f0]">Record Support Session</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#606060]">Member ID</label>
                  <input
                    value={recordForm.memberId}
                    onChange={(e) => setRecordForm((f) => ({ ...f, memberId: e.target.value }))}
                    placeholder="UUID"
                    className="w-full h-9 px-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-white text-sm outline-none focus:border-[#dc2626]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#606060]">Type</label>
                  <select
                    value={recordForm.type}
                    onChange={(e) => setRecordForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-white text-sm outline-none focus:border-[#dc2626]"
                  >
                    {USAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#606060]">Notes (optional)</label>
                  <input
                    value={recordForm.notes}
                    onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-white text-sm outline-none focus:border-[#dc2626]"
                  />
                </div>
              </div>
              <button
                onClick={handleRecord}
                disabled={recording}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#dc2626] hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {recording ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Record Session
              </button>
            </div>

            {/* Usage log */}
            <div className="bg-[#181818] rounded-xl border border-[#2a2a2a] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    {["Member", "Type", "Notes", "Recorded By", "Date", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#606060]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usageRows.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-[#606060] text-sm">No sessions recorded yet.</td></tr>
                  ) : usageRows.map((row) => (
                    <tr key={row.id} className="border-b border-[#2a2a2a] hover:bg-[#1f1f1f]">
                      <td className="px-4 py-3 text-[#f0f0f0]">{row.first_name} {row.last_name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2a2a2a] text-[#a0a0a0] uppercase">{row.type.replace(/_/g, " ")}</span>
                      </td>
                      <td className="px-4 py-3 text-[#a0a0a0] max-w-[180px] truncate">{row.notes ?? "—"}</td>
                      <td className="px-4 py-3 text-[#a0a0a0] text-xs">{row.recorded_by?.slice(0, 16) ?? "—"}</td>
                      <td className="px-4 py-3 text-[#a0a0a0] text-xs">{new Date(row.used_at).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { if (confirm("Delete this record?")) deleteUsage.mutate(row.id); }}
                          className="text-[#606060] hover:text-red-400 text-xs transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

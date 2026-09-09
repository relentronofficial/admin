"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useGrantCoins, useListBatches } from "@/lib/hooks/useTbt";
import { Coins, Users, GraduationCap, User, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

type Mode = "bulk" | "batch" | "individual";

const MODE_CONFIG: { mode: Mode; label: string; desc: string; icon: React.ElementType }[] = [
  { mode: "bulk",       label: "All Members",   desc: "Grant coins to every active member",                icon: Users },
  { mode: "batch",      label: "By Batch",       desc: "Grant coins to all active members in one batch",   icon: GraduationCap },
  { mode: "individual", label: "Individual",     desc: "Go to a member's page to add coins individually",  icon: User },
];

export default function GrantCoinsPage() {
  const [mode, setMode]               = useState<Mode>("bulk");
  const [amount, setAmount]           = useState("");
  const [reason, setReason]           = useState("");
  const [batchId, setBatchId]         = useState("");
  const [skipExisting, setSkipExisting] = useState(true);
  const [result, setResult]           = useState<{ granted: number; skipped: number } | null>(null);

  const grantCoins  = useGrantCoins();
  const { data: batchData } = useListBatches();
  const batches: any[] = (batchData as any)?.data ?? [];

  const labelCls = "text-[10px] font-bold uppercase tracking-widest text-[#777] font-rajdhani";
  const inputCls = "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-[#f0f0f0] text-sm outline-none focus:border-[#dc2626] transition-all";

  const canSubmit =
    mode !== "individual" &&
    !!amount &&
    parseInt(amount, 10) > 0 &&
    (mode === "bulk" || !!batchId);

  const handleGrant = async () => {
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0 || amt > 100_000) { toast.error("Enter a valid amount (1–100,000)"); return; }
    if (mode === "batch" && !batchId) { toast.error("Select a batch"); return; }

    const batchLabel = mode === "batch" ? batches.find(b => b.id === batchId)?.name ?? "selected batch" : "all active members";
    const confirmed  = window.confirm(
      `Grant ${amt.toLocaleString()} coins to ${batchLabel}${skipExisting ? " (skipping those who already have coins)" : ""}?\n\nThis cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      const res = await grantCoins.mutateAsync({
        amount: amt,
        reason: reason.trim() || undefined,
        scope: mode as "bulk" | "batch",
        batchId: mode === "batch" ? batchId : undefined,
        skipExisting,
      });
      setResult({ granted: res.granted, skipped: res.skipped });
      toast.success(`Granted ${res.granted.toLocaleString()} coins to ${res.granted} member(s)!`);
      setAmount("");
      setReason("");
    } catch (e: any) {
      toast.error(e.message || "Failed to grant coins");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-rajdhani text-2xl font-bold uppercase tracking-tight text-[#f0f0f0] flex items-center gap-2">
            <Coins size={22} className="text-amber-400" /> Grant TBT Coins
          </h1>
          <p className="text-sm text-[#888] mt-1">Award TBT coins to members in bulk, by batch, or individually.</p>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-3">
          {MODE_CONFIG.map(({ mode: m, label, desc, icon: Icon }) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(null); }}
              className={`flex flex-col items-start gap-2 p-4 rounded-xl border transition-all text-left ${
                mode === m
                  ? "border-amber-500/60 bg-amber-500/10"
                  : "border-[#2a2a2a] bg-[#181818] hover:border-[#333]"
              }`}
            >
              <Icon size={18} className={mode === m ? "text-amber-400" : "text-[#666]"} />
              <div>
                <p className={`text-[13px] font-bold font-rajdhani uppercase tracking-wide ${mode === m ? "text-amber-300" : "text-[#a0a0a0]"}`}>{label}</p>
                <p className="text-[11px] text-[#666] mt-0.5 leading-snug">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Individual — redirect hint */}
        {mode === "individual" && (
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 text-center space-y-2">
            <User size={28} className="mx-auto text-[#666]" />
            <p className="text-sm text-[#a0a0a0]">Go to <strong className="text-[#f0f0f0]">Members → [Member] → Info tab</strong> to add coins to a specific member.</p>
          </div>
        )}

        {/* Bulk / Batch form */}
        {mode !== "individual" && (
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-5">
            {/* Batch picker */}
            {mode === "batch" && (
              <div className="space-y-1.5">
                <label className={labelCls}>Select Batch</label>
                <select
                  value={batchId}
                  onChange={e => setBatchId(e.target.value)}
                  className={inputCls + " appearance-none"}
                >
                  <option value="">Choose a batch…</option>
                  {batches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-1.5">
              <label className={labelCls}>Coin Amount</label>
              <input
                type="number"
                min={1}
                max={100000}
                placeholder="e.g. 500"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className={labelCls}>Reason <span className="text-[#555] normal-case tracking-normal font-normal">(optional)</span></label>
              <input
                type="text"
                placeholder="e.g. welcome_bonus, q4_reward"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Skip existing toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setSkipExisting(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${skipExisting ? "bg-amber-500" : "bg-[#333]"}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${skipExisting ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <span className="text-[12px] text-[#a0a0a0]">
                Skip members who already have coins
              </span>
            </label>

            {/* Grant button */}
            <button
              onClick={handleGrant}
              disabled={!canSubmit || grantCoins.isPending}
              className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-rajdhani font-bold text-[13px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {grantCoins.isPending
                ? <><Loader2 size={15} className="animate-spin" /> Granting…</>
                : <><Coins size={15} /> Grant Coins</>
              }
            </button>

            {/* Result banner */}
            {result && (
              <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3">
                <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                <div>
                  <p className="text-[13px] font-bold text-green-300">
                    {result.granted.toLocaleString()} member{result.granted !== 1 ? "s" : ""} received coins
                  </p>
                  {result.skipped > 0 && (
                    <p className="text-[11px] text-[#888] mt-0.5">{result.skipped} skipped (already had coins)</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

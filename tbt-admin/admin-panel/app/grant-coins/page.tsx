"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAddMemberCoins, useGrantCoins, useListBatches } from "@/lib/hooks/useTbt";
import { useGetMember, useListMembers } from "@/lib/hooks/useMembers";
import { Coins, Users, GraduationCap, User, CheckCircle2, Loader2, Search, X, ExternalLink } from "lucide-react";
import { toast } from "react-hot-toast";

type Mode = "bulk" | "batch" | "individual";

const MODE_CONFIG: { mode: Mode; label: string; desc: string; icon: React.ElementType }[] = [
  { mode: "bulk",       label: "All Members",   desc: "Grant coins to every active member",                icon: Users },
  { mode: "batch",      label: "By Batch",       desc: "Grant coins to all active members in one batch",   icon: GraduationCap },
  { mode: "individual", label: "Individual",     desc: "Search for one member and grant them coins",       icon: User },
];

export default function GrantCoinsPage() {
  const [mode, setMode]               = useState<Mode>("bulk");
  const [amount, setAmount]           = useState("");
  const [reason, setReason]           = useState("");
  const [batchId, setBatchId]         = useState("");
  const [skipExisting, setSkipExisting] = useState(true);
  const [result, setResult]           = useState<{ granted: number; skipped: number } | null>(null);
  // Confirmation is shown in the page: native confirm() is blocked in some
  // browsers (it returns false without showing anything), which made the
  // Grant button look dead.
  const [confirmMsg, setConfirmMsg]   = useState<string | null>(null);

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
    setConfirmMsg(`Grant ${amt.toLocaleString()} coins to ${batchLabel}${skipExisting ? " (skipping those who already have coins)" : ""}?`);
  };

  const doGrant = async () => {
    const amt = parseInt(amount, 10);
    setConfirmMsg(null);
    try {
      const res = await grantCoins.mutateAsync({
        amount: amt,
        reason: reason.trim() || undefined,
        scope: mode as "bulk" | "batch",
        batchId: mode === "batch" ? batchId : undefined,
        skipExisting,
      });
      setResult({ granted: res.granted, skipped: res.skipped });
      toast.success(`Granted ${amt.toLocaleString()} coins each to ${res.granted.toLocaleString()} member${res.granted !== 1 ? "s" : ""}`);
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
              onClick={() => { setMode(m); setResult(null); setConfirmMsg(null); }}
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

        {/* Individual — search a member and grant */}
        {mode === "individual" && <IndividualGrant labelCls={labelCls} inputCls={inputCls} />}

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

            {/* Grant button → in-page confirmation */}
            {confirmMsg ? (
              <ConfirmGrant message={confirmMsg} onConfirm={doGrant} onCancel={() => setConfirmMsg(null)} />
            ) : (
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
            )}

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

// ── Individual grant ──────────────────────────────────────────────────────────

const memberName = (m: any) => [m?.firstName, m?.lastName].filter(Boolean).join(" ") || "Unnamed member";
const initials = (m: any) =>
  (memberName(m).split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2) || "?").toUpperCase();

function MemberAvatar({ member, size = 36 }: { member: any; size?: number }) {
  const [broken, setBroken] = useState(false);
  const url = member?.profilePhotoUrl;
  return (
    <div
      className="shrink-0 rounded-full bg-[#2a2a2a] text-[#a0a0a0] flex items-center justify-center overflow-hidden font-rajdhani font-bold"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {url && !broken
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} />
        : initials(member)}
    </div>
  );
}

function IndividualGrant({ labelCls, inputCls }: { labelCls: string; inputCls: string }) {
  const [query, setQuery]           = useState("");
  const [debounced, setDebounced]   = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount]         = useState("");
  const [reason, setReason]         = useState("");
  const [lastGrant, setLastGrant]   = useState<{ name: string; added: number; newBalance: number | null } | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const searching = debounced.length >= 2 && !selectedId;
  const { data: listData, isFetching: listLoading } = useListMembers({ search: debounced, limit: 8 }, { enabled: searching });
  const results: any[] = (listData as any)?.data ?? [];

  const { data: memberRes, isLoading: memberLoading, refetch: refetchMember } = useGetMember(selectedId ?? "");
  const member: any = selectedId ? (memberRes as any)?.data ?? null : null;
  const addCoins = useAddMemberCoins(selectedId ?? "");

  const amt = parseInt(amount, 10);
  const amountValid = Number.isInteger(amt) && amt > 0 && amt <= 100_000;
  const balance = Number(member?.coinBalance ?? 0);

  const pick = (id: string) => { setSelectedId(id); setLastGrant(null); setConfirming(false); };
  const clear = () => { setSelectedId(null); setAmount(""); setReason(""); setLastGrant(null); setConfirming(false); };

  const handleGrant = () => {
    if (!selectedId || !member) return;
    if (!amountValid) { toast.error("Enter a valid amount (1–100,000)"); return; }
    setConfirming(true);
  };

  const doGrant = async () => {
    if (!selectedId || !member || !amountValid) { setConfirming(false); return; }
    const name = memberName(member);
    setConfirming(false);
    try {
      const res: any = await addCoins.mutateAsync({ amount: amt, reason: reason.trim() || undefined });
      const newBalance = typeof res?.newBalance === "number" ? res.newBalance : null;
      setLastGrant({ name, added: amt, newBalance });
      toast.success(`Granted ${amt.toLocaleString()} coins to ${name}`);
      setAmount("");
      setReason("");
      refetchMember();
    } catch (e: any) {
      toast.error(e.message || "Failed to grant coins");
    }
  };

  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-6 space-y-5">
      {/* Member search / selected member */}
      <div className="space-y-1.5">
        <label className={labelCls}>Member</label>
        {!selectedId ? (
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#606060]" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, phone, email or member ID"
              className={inputCls + " pl-10"}
              aria-label="Search members"
            />
            {listLoading && <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-[#606060]" />}
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-[#1a1a1a] border border-amber-500/40 rounded-xl px-4 py-3">
            {memberLoading || !member ? (
              <Loader2 size={18} className="animate-spin text-[#606060] flex-1" />
            ) : (
              <>
                <MemberAvatar member={member} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#f0f0f0] truncate">{memberName(member)}</p>
                  <p className="text-[11px] text-[#808080] truncate">
                    {[member.memberId, member.phone, member.batch?.name].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Balance</p>
                  <p className="text-sm font-bold text-amber-300 flex items-center justify-end gap-1">
                    <Coins size={13} /> {balance.toLocaleString()}
                  </p>
                </div>
              </>
            )}
            <button
              onClick={clear}
              className="shrink-0 p-1.5 rounded-lg text-[#808080] hover:text-white hover:bg-[#2a2a2a] transition-colors"
              aria-label="Choose a different member"
              title="Choose a different member"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Search results */}
        {searching && (
          <div className="border border-[#2a2a2a] rounded-xl overflow-hidden divide-y divide-[#222]">
            {results.length === 0 && !listLoading && (
              <p className="px-4 py-3 text-[12px] text-[#808080]">No members match “{debounced}”.</p>
            )}
            {results.map((m: any) => (
              <button
                key={m.id}
                onClick={() => pick(m.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-[#161616] hover:bg-[#1f1f1f] text-left transition-colors"
              >
                <MemberAvatar member={m} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[#f0f0f0] truncate">{memberName(m)}</p>
                  <p className="text-[11px] text-[#707070] truncate">{[m.memberId, m.phone, m.email].filter(Boolean).join(" · ")}</p>
                </div>
                {m.status && m.status !== "active" && (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider font-bold text-[#a0a0a0] bg-[#2a2a2a] rounded px-2 py-0.5">{m.status}</span>
                )}
              </button>
            ))}
          </div>
        )}
        {!selectedId && debounced.length < 2 && (
          <p className="text-[11px] text-[#606060]">Type at least 2 characters to search.</p>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <label className={labelCls}>Coin Amount</label>
        <input
          type="number"
          min={1}
          max={100000}
          placeholder="e.g. 500"
          value={amount}
          onChange={e => { setAmount(e.target.value); setConfirming(false); }}
          disabled={!selectedId}
          className={inputCls + " disabled:opacity-40"}
        />
        {member && amountValid && (
          <p className="text-[11px] text-[#808080]">
            New balance will be <strong className="text-amber-300">{(balance + amt).toLocaleString()}</strong> coins.
          </p>
        )}
      </div>

      {/* Reason */}
      <div className="space-y-1.5">
        <label className={labelCls}>Reason <span className="text-[#555] normal-case tracking-normal font-normal">(optional)</span></label>
        <input
          type="text"
          placeholder="e.g. welcome_bonus, q4_reward"
          value={reason}
          onChange={e => setReason(e.target.value)}
          disabled={!selectedId}
          className={inputCls + " disabled:opacity-40"}
        />
      </div>

      {/* Grant button → in-page confirmation */}
      {confirming && member ? (
        <ConfirmGrant
          message={`Grant ${amt.toLocaleString()} coins to ${memberName(member)}? New balance: ${(balance + amt).toLocaleString()}.`}
          onConfirm={doGrant}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <button
          onClick={handleGrant}
          disabled={!member || !amountValid || addCoins.isPending}
          className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-rajdhani font-bold text-[13px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {addCoins.isPending
            ? <><Loader2 size={15} className="animate-spin" /> Granting…</>
            : <><Coins size={15} /> {member ? `Grant Coins to ${memberName(member).split(" ")[0]}` : "Grant Coins"}</>
          }
        </button>
      )}

      {/* Result banner */}
      {lastGrant && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3">
          <CheckCircle2 size={18} className="text-green-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-green-300">
              {lastGrant.added.toLocaleString()} coins granted to {lastGrant.name}
            </p>
            {lastGrant.newBalance != null && (
              <p className="text-[11px] text-[#888] mt-0.5">New balance: {lastGrant.newBalance.toLocaleString()} coins</p>
            )}
          </div>
          {selectedId && (
            <Link href={`/members/${selectedId}`} className="shrink-0 text-[11px] text-[#a0a0a0] hover:text-white flex items-center gap-1">
              View member <ExternalLink size={11} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** In-page "are you sure" step for a grant (replaces window.confirm). */
function ConfirmGrant({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3" role="alertdialog" aria-label="Confirm coin grant">
      <div>
        <p className="text-[13px] font-semibold text-[#f0f0f0]">{message}</p>
        <p className="text-[11px] text-[#a0a0a0] mt-0.5">This cannot be undone.</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 h-11 rounded-xl border border-[#333] text-[#d0d0d0] hover:bg-[#222] font-rajdhani font-bold text-[13px] uppercase tracking-widest transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          autoFocus
          className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-rajdhani font-bold text-[13px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={15} /> Yes, Grant
        </button>
      </div>
    </div>
  );
}

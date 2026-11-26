"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import toast from "react-hot-toast";
import {
  useAdjustAiCredits,
  useAiCreditMember,
  useAiCreditMembers,
  useAiCreditSummary,
  useProviderBalance,
  useSaveBalanceAlert,
} from "@/lib/hooks/useAiCreditsAdmin";

const CARD = "bg-[#181818] border border-[#2a2a2a] rounded-xl p-5";
const LABEL = "text-[11px] font-bold uppercase tracking-widest text-[#a0a0a0] font-rajdhani";
const INPUT = "bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] w-full";
const BTN = "inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50";
const GHOST = "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#2a2a2a] text-[12px] text-[#a0a0a0] hover:text-[#f0f0f0] hover:border-[#444] disabled:opacity-50";

const errorText = (e: any) => {
  const err = e?.response?.data?.error ?? e?.error;
  return (typeof err === "string" ? err : err?.message) || e?.message || "That didn't work. Please try again.";
};
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const usd = (n: number) => `US$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (n: number) => n.toLocaleString("en-IN");
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#141414] p-3 min-w-0">
      <p className="text-[11px] uppercase tracking-widest text-[#808080] font-rajdhani font-bold">{label}</p>
      <p className="text-xl font-semibold text-[#f0f0f0] tabular-nums mt-0.5">{value}</p>
      {hint && <p className="text-[12px] text-[#808080] mt-0.5">{hint}</p>}
    </div>
  );
}

// ── AI provider balance ──────────────────────────────────────────────────────

export function ProviderBalanceCard() {
  const { data, isLoading, isFetching, error, refetch } = useProviderBalance();
  const save = useSaveBalanceAlert();
  const [threshold, setThreshold] = useState("");
  useEffect(() => {
    if (data) setThreshold(String(data.thresholdUsd));
  }, [data?.thresholdUsd]); // eslint-disable-line react-hooks/exhaustive-deps

  const low = data?.remainingUsd != null && data.remainingUsd < data.thresholdUsd;
  const saveThreshold = async () => {
    try {
      await save.mutateAsync(Number(threshold));
      toast.success("Alert level saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <section className={`${CARD} space-y-4`} style={low ? { borderColor: "#dc2626" } : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={LABEL}>AI provider balance (OpenRouter)</h2>
          <p className="text-sm text-[#a0a0a0] mt-1">Every assistant answer, member and admin, is paid from this balance. Admins get an alert when it drops below the level set here.</p>
        </div>
        <button type="button" onClick={() => void refetch()} disabled={isFetching} className={GHOST}>
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> Check now
        </button>
      </div>
      {isLoading ? (
        <p className="text-[#a0a0a0] flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Checking…</p>
      ) : error || !data ? (
        <p className="text-sm text-[#a0a0a0]">{error ? errorText(error) : "Checked a moment ago. Press Check now to read it again."}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Balance left"
              value={data.remainingUsd != null ? usd(data.remainingUsd) : "Unknown"}
              hint={data.source === "key_limit" ? "Left of this key's credit limit" : data.source === "account" ? "Account balance" : undefined}
            />
            <Stat label="Spent today" value={data.usageDailyUsd != null ? usd(data.usageDailyUsd) : "—"} hint="UTC day" />
            <Stat label="Spent this month" value={data.usageMonthlyUsd != null ? usd(data.usageMonthlyUsd) : "—"} hint="UTC month" />
          </div>
          {data.error && <p className="text-[13px] text-[#f0b429]">{data.error}</p>}
          {low && <p className="text-[13px] text-[#f87171] font-semibold">The balance is below the alert level. Top up OpenRouter so the assistant keeps answering.</p>}
        </>
      )}
      <div className="flex flex-wrap items-end gap-3 border-t border-[#2a2a2a] pt-4">
        <label className="block space-y-1.5 w-48">
          <span className={LABEL}>Alert below (US$)</span>
          <input type="number" min="0" step="1" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={INPUT} />
        </label>
        <button type="button" onClick={() => void saveThreshold()} disabled={save.isPending || threshold === "" || Number(threshold) < 0} className={BTN}>
          {save.isPending && <Loader2 size={14} className="animate-spin" />} Save
        </button>
        {data && <p className="text-[12px] text-[#808080]">Last checked {when(data.checkedAt)}. Also checked after answers, at most every 10 minutes.</p>}
      </div>
    </section>
  );
}

// ── Usage and sales ──────────────────────────────────────────────────────────

export function UsageCard() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useAiCreditSummary(days);
  const rate = data?.usdToInr ?? 90;
  const maxDay = data ? Math.max(1, ...data.series.map((d) => Math.max(d.costUsd * rate, d.salesInr))) : 1;

  return (
    <section className={`${CARD} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={LABEL}>Usage and sales</h2>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`${GHOST} ${days === d ? "!text-[#f0f0f0] !border-[#dc2626]" : ""}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <p className="text-[#a0a0a0] flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : error || !data ? (
        <p className="text-sm text-[#a0a0a0]">{errorText(error)}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Credit sales" value={inr(data.salesInr)} hint={`${fmt(data.paidOrders)} paid orders · ${fmt(data.creditsSold)} credits`} />
            <Stat label="Credits used" value={fmt(data.creditsUsed)} hint={`Worth ${inr(data.creditsUsedInr)} · ${fmt(data.chargedAnswers)} charged answers`} />
            <Stat
              label="Provider cost: members"
              value={inr(data.memberCostUsd * rate)}
              hint={`${usd(data.memberCostUsd)} · ${fmt(data.memberAnswers)} answers`}
            />
            <Stat label="Provider cost: admins" value={inr(data.adminCostUsd * rate)} hint={`${usd(data.adminCostUsd)} · ${fmt(data.adminAnswers)} answers`} />
            <Stat
              label="Cost of charged answers"
              value={inr(data.chargedAnswersCostUsd * rate)}
              hint={`Charged for them: ${inr(data.creditsUsedInr)}`}
            />
            <Stat label="Refunded" value={fmt(data.creditsRefunded)} hint="credits" />
            <Stat label="Given free" value={fmt(data.creditsGranted)} hint={data.creditsAdjusted ? `Corrections: ${fmt(data.creditsAdjusted)}` : "credits"} />
            <Stat label="Unspent credits (all time)" value={fmt(data.creditsOutstanding)} hint={`Members can still use ${inr(data.creditsOutstandingInr)}`} />
          </div>
          <div>
            <div className="flex items-end gap-[2px] h-28" aria-label="Daily provider cost and credit sales">
              {data.series.map((d) => (
                <div key={d.date} className="flex-1 flex items-end gap-px h-full" title={`${d.date}: cost ${inr(d.costUsd * rate)}, sales ${inr(d.salesInr)}, ${d.creditsUsed} credits used`}>
                  <div className="flex-1 rounded-t-sm bg-[#606060]" style={{ height: `${((d.costUsd * rate) / maxDay) * 100}%` }} />
                  <div className="flex-1 rounded-t-sm bg-[#dc2626]" style={{ height: `${(d.salesInr / maxDay) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-[#808080] mt-1">
              <span>{data.series[0]?.date}</span>
              <span className="flex gap-3">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#606060]" /> Provider cost (₹)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#dc2626]" /> Credit sales (₹)</span>
              </span>
              <span>{data.series[data.series.length - 1]?.date}</span>
            </div>
          </div>
          <p className="text-[12px] text-[#808080]">Rupee amounts use the dollar rate in the settings below ({inr(rate)} per US$). Days are IST.</p>
        </>
      )}
    </section>
  );
}

// ── Members: refunds and free credits ────────────────────────────────────────

const SOURCE: Record<string, string> = { purchase: "Bought", usage: "Answer", refund: "Refund", grant: "Free credits", adjust: "Correction" };

function MemberPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, error } = useAiCreditMember(id);
  const adjust = useAdjustAiCredits();
  const [kind, setKind] = useState<"grant" | "adjust">("grant");
  const [credits, setCredits] = useState("");
  const [note, setNote] = useState("");

  const run = async (body: Parameters<typeof adjust.mutateAsync>[0], done: string) => {
    try {
      await adjust.mutateAsync(body);
      toast.success(done);
      return true;
    } catch (e) {
      toast.error(errorText(e));
      return false;
    }
  };
  const submit = async () => {
    const n = Number(credits);
    if (await run({ memberId: id, kind, credits: n, note: note.trim() }, kind === "grant" ? `${n} free credits given` : "Balance corrected")) {
      setCredits("");
      setNote("");
    }
  };
  const refund = (a: { messageId: string; credits: number }) => {
    const reason = window.prompt(`Refund ${a.credits} credits for this answer? Reason (the member sees "Refund" in their history):`, "Answer was not useful");
    if (reason && reason.trim().length >= 3) {
      void run({ memberId: id, kind: "refund", credits: a.credits, note: reason.trim(), messageId: a.messageId }, `${a.credits} credits refunded`);
    }
  };

  const n = Number(credits);
  const valid = Number.isInteger(n) && n !== 0 && (kind === "adjust" || n > 0) && note.trim().length >= 3;

  return (
    <div className="rounded-lg border border-[#333] bg-[#141414] p-4 space-y-4">
      {isLoading ? (
        <p className="text-[#a0a0a0] flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : error || !data ? (
        <p className="text-sm text-[#a0a0a0]">{errorText(error)}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[#f0f0f0] font-semibold">{data.member.name ?? "Member"} <span className="text-[#808080] font-normal text-sm">{data.member.phone}</span></p>
              <p className="text-sm text-[#a0a0a0]">
                Balance <span className="text-[#f0f0f0] font-semibold tabular-nums">{fmt(data.balance)}</span> credits
                {data.available !== data.balance && ` (${fmt(data.available)} free to use; the rest is held for an answer in progress)`}
              </p>
            </div>
            <button type="button" onClick={onClose} className={GHOST}>Close</button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[160px_140px_1fr_auto] items-end">
            <label className="block space-y-1.5">
              <span className={LABEL}>Type</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as any)} className={INPUT}>
                <option value="grant">Give free credits</option>
                <option value="adjust">Correct balance (+/−)</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className={LABEL}>Credits</span>
              <input type="number" step="1" value={credits} onChange={(e) => setCredits(e.target.value)} placeholder={kind === "adjust" ? "-50 or 50" : "100"} className={INPUT} />
            </label>
            <label className="block space-y-1.5">
              <span className={LABEL}>Reason</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Shown to admins only" className={INPUT} />
            </label>
            <button type="button" disabled={!valid || adjust.isPending} onClick={() => void submit()} className={BTN}>
              {adjust.isPending && <Loader2 size={14} className="animate-spin" />} Apply
            </button>
          </div>

          <div>
            <h3 className={`${LABEL} mb-2`}>Charged answers</h3>
            {data.answers.length === 0 ? (
              <p className="text-sm text-[#808080]">No charged answers yet.</p>
            ) : (
              <div className="divide-y divide-[#2a2a2a] border border-[#2a2a2a] rounded-lg">
                {data.answers.map((a) => (
                  <div key={a.messageId} className="p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <p className="text-[#f0f0f0] truncate">Q: {a.question || "—"}</p>
                      <p className="text-[#808080] text-[13px] line-clamp-2">{a.answer}</p>
                      <p className="text-[12px] text-[#606060] mt-0.5">{when(a.createdAt)} · {a.credits} credits</p>
                    </div>
                    {a.refunded ? (
                      <span className="text-[12px] text-[#4ade80] shrink-0">Refunded</span>
                    ) : (
                      <button type="button" disabled={adjust.isPending} onClick={() => refund(a)} className={`${GHOST} shrink-0`}>Refund</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className={`${LABEL} mb-2`}>History</h3>
            <div className="max-h-72 overflow-y-auto divide-y divide-[#2a2a2a] border border-[#2a2a2a] rounded-lg">
              {data.entries.length === 0 ? (
                <p className="p-3 text-sm text-[#808080]">Nothing yet.</p>
              ) : (
                data.entries.map((e) => (
                  <div key={e.id} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-[#f0f0f0]">{SOURCE[e.source] ?? e.source}{e.note && e.source !== "usage" ? <span className="text-[#808080]"> · {e.note}</span> : null}</p>
                      <p className="text-[12px] text-[#606060]">{when(e.createdAt)}{e.byName ? ` · by ${e.byName}` : ""}</p>
                    </div>
                    <span className={`tabular-nums font-semibold shrink-0 ${e.delta > 0 ? "text-[#4ade80]" : "text-[#a0a0a0]"}`}>
                      {e.delta > 0 ? "+" : "−"}{fmt(Math.abs(e.delta))}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function MembersCard() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);
  const { data, isLoading, error } = useAiCreditMembers(q);

  return (
    <section className={`${CARD} space-y-4`}>
      <div>
        <h2 className={LABEL}>Members: refunds and free credits</h2>
        <p className="text-sm text-[#a0a0a0] mt-1">Find a member to see their credits, refund a charged answer, or give free credits. Without a search, members with recent credit activity are listed.</p>
      </div>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Name or phone" className={`${INPUT} pl-9`} />
      </div>
      {open && <MemberPanel id={open} onClose={() => setOpen(null)} />}
      {isLoading ? (
        <p className="text-[#a0a0a0] flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</p>
      ) : error ? (
        <p className="text-sm text-[#a0a0a0]">{errorText(error)}</p>
      ) : !data?.length ? (
        <p className="text-sm text-[#808080]">{q ? "No members match." : "No member has AI credit activity yet."}</p>
      ) : (
        <div className="divide-y divide-[#2a2a2a] border border-[#2a2a2a] rounded-lg">
          {data.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setOpen(m.id)}
              className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-[#1f1f1f] ${open === m.id ? "bg-[#1f1f1f]" : ""}`}
            >
              <span className="min-w-0">
                <span className="block text-sm text-[#f0f0f0] truncate">{m.name ?? "Member"}</span>
                <span className="block text-[12px] text-[#606060]">{m.phone}{m.lastActivityAt ? ` · last activity ${when(m.lastActivityAt)}` : ""}</span>
              </span>
              <span className="text-sm tabular-nums text-[#a0a0a0] shrink-0">{fmt(m.balance)} credits</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MembersCard, ProviderBalanceCard, UsageCard } from "@/components/ai-credits/AiCreditsInsights";
import {
  useAiCreditOrders,
  useAiCreditPacks,
  useAiCreditSettings,
  useDeleteAiCreditPack,
  useSaveAiCreditPack,
  useSaveAiCreditSettings,
  type AiCreditPack,
  type AiCreditSettings,
} from "@/lib/hooks/useAiCreditsAdmin";

const CARD = "bg-[#181818] border border-[#2a2a2a] rounded-xl p-5";
const LABEL = "text-[11px] font-bold uppercase tracking-widest text-[#a0a0a0] font-rajdhani";
const INPUT = "bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] w-full";
const BTN = "inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50";
const GHOST = "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#2a2a2a] text-[12px] text-[#a0a0a0] hover:text-[#f0f0f0] hover:border-[#444]";

const errorText = (e: any) => {
  const err = e?.response?.data?.error ?? e?.error;
  return (typeof err === "string" ? err : err?.message) || e?.message || "That didn't work. Please try again.";
};
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Same rounding as the backend (lib/aiCredits.ts creditsForCost). */
const creditsFor = (usd: number, s: AiCreditSettings) =>
  usd > 0 ? Math.max(1, Math.ceil(Number(((usd * s.usdToInr * s.rateMultiplier) / s.inrPerCredit).toFixed(6)))) : 0;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className={LABEL}>{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-[#808080]">{hint}</span>}
    </label>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

function SettingsCard() {
  const { data, isLoading, error } = useAiCreditSettings();
  const save = useSaveAiCreditSettings();
  const [form, setForm] = useState<Record<keyof AiCreditSettings, string> | null>(null);
  useEffect(() => {
    if (data) setForm(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) as any);
  }, [data]);

  if (isLoading || !form) return <div className={`${CARD} text-[#a0a0a0] flex items-center gap-2`}>{error ? errorText(error) : <><Loader2 size={16} className="animate-spin" /> Loading…</>}</div>;

  const num = (k: keyof AiCreditSettings) => Number(form[k]);
  const parsed: AiCreditSettings = {
    chargingEnabled: form.chargingEnabled === "true",
    usdToInr: num("usdToInr"), rateMultiplier: num("rateMultiplier"), inrPerCredit: num("inrPerCredit"),
    minCreditsToAsk: num("minCreditsToAsk"), maxCreditsPerQuestion: num("maxCreditsPerQuestion"),
  };
  const valid = parsed.usdToInr > 0 && parsed.rateMultiplier >= 1 && parsed.inrPerCredit > 0 && parsed.minCreditsToAsk > 0 && parsed.maxCreditsPerQuestion >= parsed.minCreditsToAsk;
  const example = valid ? creditsFor(0.02, parsed) : null;
  const set = (k: keyof AiCreditSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (next: AiCreditSettings, done: string) => {
    try {
      await save.mutateAsync(next);
      toast.success(done);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const toggle = () => {
    const on = !data!.chargingEnabled;
    const q = on
      ? "Start charging AI credits for every TBT Assistant answer now? Members without enough credits will be asked to buy some."
      : "Stop charging? TBT Assistant answers become free again.";
    if (window.confirm(q)) void submit({ ...data!, chargingEnabled: on }, on ? "Charging is on" : "Charging is off");
  };

  return (
    <section className={`${CARD} space-y-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={LABEL}>Charging</h2>
          <p className="text-sm text-[#a0a0a0] mt-1">
            {data!.chargingEnabled
              ? "On: each TBT Assistant answer is paid from the member's AI credits."
              : "Off: TBT Assistant answers are free. Members can still buy credits."}
          </p>
        </div>
        <button type="button" onClick={toggle} disabled={save.isPending} className={data!.chargingEnabled ? GHOST : BTN}>
          {data!.chargingEnabled ? "Turn charging off" : "Turn charging on"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Dollar rate (₹ per US$)" hint="The AI provider bills in US dollars. Update this when the rate moves.">
          <input type="number" step="0.01" min="1" value={form.usdToInr} onChange={set("usdToInr")} className={INPUT} />
        </Field>
        <Field label="Rate multiplier" hint="1.10 = provider cost + 10%. Cannot be below 1.">
          <input type="number" step="0.01" min="1" value={form.rateMultiplier} onChange={set("rateMultiplier")} className={INPUT} />
        </Field>
        <Field label="Value of 1 credit (₹)">
          <input type="number" step="0.01" min="0.01" value={form.inrPerCredit} onChange={set("inrPerCredit")} className={INPUT} />
        </Field>
        <Field label="Credits needed to ask" hint="Below this the member is asked to buy credits.">
          <input type="number" step="1" min="1" value={form.minCreditsToAsk} onChange={set("minCreditsToAsk")} className={INPUT} />
        </Field>
        <Field label="Most credits one question can use" hint="A question that needs more stops and is not charged.">
          <input type="number" step="1" min="1" value={form.maxCreditsPerQuestion} onChange={set("maxCreditsPerQuestion")} className={INPUT} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2a2a2a] pt-4">
        <p className="text-[13px] text-[#a0a0a0]">
          {example != null
            ? <>Example: an answer that costs the provider US$0.02 uses <span className="text-[#f0f0f0] font-semibold">{example} credits</span> ({inr(example * parsed.inrPerCredit)}).</>
            : "Check the numbers: the multiplier must be at least 1, and the most per question at least the amount needed to ask."}
        </p>
        <button type="button" disabled={!valid || save.isPending} onClick={() => void submit({ ...parsed, chargingEnabled: data!.chargingEnabled }, "Saved")} className={BTN}>
          {save.isPending && <Loader2 size={14} className="animate-spin" />} Save
        </button>
      </div>
    </section>
  );
}

// ── Packs ────────────────────────────────────────────────────────────────────

const EMPTY = { label: "", credits: "", priceInr: "", isActive: true, sortOrder: "0" };

function PacksCard() {
  const { data: packs = [], isLoading, error } = useAiCreditPacks();
  const { data: settings } = useAiCreditSettings();
  const save = useSaveAiCreditPack();
  const del = useDeleteAiCreditPack();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(EMPTY);

  const open = (p?: AiCreditPack) => {
    setEditing(p ? p.id : "new");
    setForm(p ? { label: p.label, credits: String(p.credits), priceInr: String(p.priceInr), isActive: p.isActive, sortOrder: String(p.sortOrder) } : EMPTY);
  };
  const submit = async () => {
    try {
      await save.mutateAsync({
        ...(editing && editing !== "new" ? { id: editing } : {}),
        label: form.label.trim(), credits: Number(form.credits), priceInr: Number(form.priceInr), isActive: form.isActive, sortOrder: Number(form.sortOrder) || 0,
      });
      toast.success("Pack saved");
      setEditing(null);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const remove = async (p: AiCreditPack) => {
    if (!window.confirm(`Delete "${p.label}"? Members can no longer buy it. Past orders are kept.`)) return;
    try {
      await del.mutateAsync(p.id);
      toast.success("Pack deleted");
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  // Credits worth at the current credit value, for a quick sanity check.
  const worth = (credits: number) => (settings ? inr(credits * settings.inrPerCredit) : null);

  return (
    <section className={`${CARD} space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={LABEL}>Packs members can buy</h2>
          <p className="text-sm text-[#a0a0a0] mt-1">Paid through Razorpay. Changing a pack does not change orders already started.</p>
        </div>
        {editing == null && <button type="button" onClick={() => open()} className={BTN}><Plus size={14} /> Add pack</button>}
      </div>

      {editing != null && (
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_80px] items-end border border-[#2a2a2a] rounded-lg p-4">
          <Field label="Name"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="900 credits" className={INPUT} maxLength={120} /></Field>
          <Field label="Credits"><input type="number" min="1" step="1" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} className={INPUT} /></Field>
          <Field label="Price (₹)"><input type="number" min="1" step="0.01" value={form.priceInr} onChange={(e) => setForm({ ...form, priceInr: e.target.value })} className={INPUT} /></Field>
          <Field label="Order"><input type="number" step="1" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={INPUT} /></Field>
          <label className="flex items-center gap-2 text-sm text-[#a0a0a0] sm:col-span-4">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> On sale
          </label>
          <div className="flex gap-2 sm:col-span-4">
            <button type="button" onClick={submit} disabled={save.isPending || !form.label.trim() || !(Number(form.credits) > 0) || !(Number(form.priceInr) > 0)} className={BTN}>
              {save.isPending && <Loader2 size={14} className="animate-spin" />} Save pack
            </button>
            <button type="button" onClick={() => setEditing(null)} className={GHOST}>Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-[#a0a0a0] text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>
      ) : error ? (
        <p className="text-[#a0a0a0] text-sm" role="alert">{errorText(error)}</p>
      ) : packs.length === 0 ? (
        <p className="text-[#a0a0a0] text-sm">No packs yet. Members cannot buy credits until you add one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left">
              {["Name", "Credits", "Price", "Worth", "Status", ""].map((h) => <th key={h} className={`${LABEL} pb-2 pr-4`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {packs.map((p) => (
                <tr key={p.id} className="border-t border-[#222] text-[#f0f0f0]">
                  <td className="py-2.5 pr-4">{p.label}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{p.credits.toLocaleString("en-IN")}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{inr(p.priceInr)}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-[#a0a0a0]" title="Credits × value of 1 credit">{worth(p.credits)}</td>
                  <td className="py-2.5 pr-4">{p.isActive ? <span className="text-green-400">On sale</span> : <span className="text-[#808080]">Hidden</span>}</td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button type="button" aria-label={`Edit ${p.label}`} onClick={() => open(p)} className="p-2 text-[#a0a0a0] hover:text-white"><Pencil size={14} /></button>
                    <button type="button" aria-label={`Delete ${p.label}`} onClick={() => remove(p)} className="p-2 text-[#a0a0a0] hover:text-[#dc2626]"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Orders ───────────────────────────────────────────────────────────────────

const STATUS = [{ key: "", label: "All" }, { key: "paid", label: "Paid" }, { key: "created", label: "Started" }, { key: "failed", label: "Failed" }];

function OrdersCard() {
  const [status, setStatus] = useState("");
  const { data: orders = [], isLoading, error } = useAiCreditOrders(status);
  const paid = orders.filter((o) => o.status === "paid");
  return (
    <section className={`${CARD} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={LABEL}>Purchases</h2>
          <p className="text-sm text-[#a0a0a0] mt-1">Latest 200. {status === "paid" || status === "" ? `Paid here: ${inr(paid.reduce((a, o) => a + o.amountInr, 0))}` : null}</p>
        </div>
        <div className="flex gap-1.5">
          {STATUS.map((s) => (
            <button key={s.key} type="button" onClick={() => setStatus(s.key)}
              className={`h-8 px-3 rounded-lg text-[12px] border ${status === s.key ? "border-[#dc2626] text-white" : "border-[#2a2a2a] text-[#a0a0a0]"}`}>{s.label}</button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <p className="text-[#a0a0a0] text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>
      ) : error ? (
        <p className="text-[#a0a0a0] text-sm" role="alert">{errorText(error)}</p>
      ) : orders.length === 0 ? (
        <p className="text-[#a0a0a0] text-sm">No purchases yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left">
              {["When", "Member", "Pack", "Credits", "Amount", "Status"].map((h) => <th key={h} className={`${LABEL} pb-2 pr-4`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-[#222] text-[#f0f0f0]">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-[#a0a0a0]">{when(o.paidAt ?? o.createdAt)}</td>
                  <td className="py-2.5 pr-4"><a href={`/members/${o.memberId}`} className="hover:underline">{o.memberName || "Member"}</a></td>
                  <td className="py-2.5 pr-4 text-[#a0a0a0]">{o.packLabel ?? "—"}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{o.credits.toLocaleString("en-IN")}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{inr(o.amountInr)}</td>
                  <td className="py-2.5 pr-4" title={o.failureReason ?? undefined}>
                    {o.status === "paid" ? <span className="text-green-400">Paid</span> : o.status === "failed" ? <span className="text-[#dc2626]">Failed</span> : <span className="text-[#808080]">Started</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AiCreditsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wide">AI Credits</h1>
          <p className="text-sm text-[#a0a0a0]">Credits members buy and spend on TBT Assistant answers. Who can use the assistant is set in Member Assistant.</p>
        </div>
        <ProviderBalanceCard />
        <UsageCard />
        <SettingsCard />
        <PacksCard />
        <OrdersCard />
        <MembersCard />
      </div>
    </DashboardLayout>
  );
}

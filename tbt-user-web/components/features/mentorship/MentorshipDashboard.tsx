"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Flame, Heart, CheckCircle2, Clock, TrendingUp, TrendingDown,
  BookOpen, BarChart3, Target, Phone, ChevronRight, Trophy, Star, Activity,
} from "lucide-react";
import {
  useMentorshipStats, useMentorshipRevenue, useUpsertMentorshipRevenue,
  useMentorshipSocial, useUpsertMentorshipSocial,
} from "@/lib/hooks/useMentorship";
import { useMyBatchProgram } from "@/lib/hooks/useBatchProgram";
import { useUserSupportQuota } from "@/lib/hooks/useUser";
import { useCountUp, formatINR, growthPct } from "@/lib/hooks/useCountUp";
import { toast } from "react-hot-toast";
import Link from "next/link";

// ─── Animation variants ───────────────────────────────────────────────────────

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: "easeOut" } },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ pct, color = "var(--color-accent)" }: { pct: number; color?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 250); return () => clearTimeout(t); }, []);
  return (
    <div className="w-full h-1.5 rounded-full mt-2" style={{ background: "rgba(255,255,255,0.08)" }}>
      <div
        className="h-1.5 rounded-full"
        style={{
          width: mounted ? `${Math.min(100, pct)}%` : "0%",
          background: color,
          transition: "width 1.1s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </div>
  );
}

function GrowthBadge({ value }: { value: number | null }) {
  if (value == null) return null;
  const pos = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      style={{
        background: pos ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
        color: pos ? "#22c55e" : "#ef4444",
      }}
    >
      {pos ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {pos ? "+" : ""}{value}%
    </span>
  );
}

function MentorshipHeader({
  programName,
  weeklyReportSubmitted,
  streakDays,
  lifelinesTotal,
  lifelinesUsed,
}: {
  programName: string | null;
  weeklyReportSubmitted: boolean;
  streakDays: number;
  lifelinesTotal: number | null;
  lifelinesUsed: number | null;
}) {
  // Only draw hearts the member actually has — no padding, no assumed default.
  const totalHearts = lifelinesTotal ?? 0;
  const filledHearts = lifelinesTotal != null ? lifelinesTotal - (lifelinesUsed ?? 0) : 0;

  return (
    <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3 mb-5">
      <h1 className="text-xl font-bold flex-1 min-w-0 truncate" style={{ color: "var(--color-text-normal)" }}>
        {programName ?? "Mentorship Program"}
      </h1>
      <div className="flex items-center gap-2 flex-wrap">
        {weeklyReportSubmitted && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
            <CheckCircle2 className="w-3 h-3" /> Weekly Report Submitted
          </span>
        )}
        <span className="mentorship-streak-badge inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)" }}>
          <Flame className="w-3 h-3" /> Streak {streakDays} Days
        </span>
        {totalHearts > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>Lifelines</span>
            <span className="inline-flex items-center gap-0.5 ml-0.5">
              {Array.from({ length: totalHearts }).map((_, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.08, type: "spring", stiffness: 400, damping: 16 }}
                >
                  <Heart
                    className="w-4 h-4"
                    style={{ color: i < filledHearts ? "#ef4444" : "rgba(255,255,255,0.2)" }}
                    fill={i < filledHearts ? "#ef4444" : "none"}
                  />
                </motion.span>
              ))}
            </span>
          </span>
        )}
      </div>
    </motion.div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  growth,
  icon: Icon,
  accentColor,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  growth?: number | null;
  icon: React.ElementType;
  accentColor?: string;
  valueColor?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="mentorship-kpi-card relative rounded-2xl p-4 flex flex-col gap-2 overflow-hidden"
      style={{
        background: "var(--color-bg-surface, #141414)",
        border: `1px solid color-mix(in srgb, ${accentColor ?? "var(--color-accent)"} 20%, transparent)`,
      }}
      whileHover={{ scale: 1.015, transition: { duration: 0.18 } }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest leading-tight" style={{ color: "var(--color-text-subtle)" }}>{label}</span>
        <Icon className="w-4 h-4 shrink-0" style={{ color: accentColor ?? "var(--color-accent)", opacity: 0.7 }} />
      </div>
      <div className="text-2xl font-black tracking-tight leading-none" style={{ color: valueColor ?? "#ffffff" }}>{value}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{sub}</span>
        {growth != null && <GrowthBadge value={growth} />}
      </div>
    </motion.div>
  );
}

function JourneyTile({
  label,
  used,
  total,
  suffix,
  icon: Icon,
  noBar,
  pct: pctOverride,
  badge,
  badgeColor,
  sub,
}: {
  label: string;
  used: number | string;
  total?: number | string;
  suffix?: string;
  icon: React.ElementType;
  noBar?: boolean;
  pct?: number | null;
  badge?: string;
  badgeColor?: string;
  sub?: string;
}) {
  const pct = pctOverride != null
    ? Math.min(100, pctOverride)
    : typeof used === "number" && typeof total === "number" && total > 0
      ? (used / total) * 100
      : 0;
  const bColor = badgeColor ?? "rgba(255,255,255,0.5)";
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3 h-3 shrink-0" style={{ color: "var(--color-accent)", opacity: 0.7 }} />
          <span className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: "var(--color-text-subtle)" }}>{label}</span>
        </div>
        {badge && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${bColor}20`, color: bColor, border: `1px solid ${bColor}30` }}>
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-black text-white">{used}</span>
        {total != null && <span className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>/{total}{suffix}</span>}
        {!total && suffix && <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{suffix}</span>}
      </div>
      {sub && <p className="text-[9px] leading-tight" style={{ color: "var(--color-text-subtle)" }}>{sub}</p>}
      {!noBar && <ProgressBar pct={pct} />}
    </div>
  );
}

function SupportCallTile({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const isExhausted = total > 0 && used >= total;
  const pctColor = isExhausted ? "#ef4444" : pct >= 75 ? "#fb923c" : "#818cf8";
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${isExhausted ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: "var(--color-text-subtle)" }}>{label}</span>
        {total > 0 && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${pctColor}20`, color: pctColor, border: `1px solid ${pctColor}30` }}>
            {pct}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-xl font-black" style={{ color: isExhausted ? "#ef4444" : "white" }}>{used}</span>
        <span className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>/{total}</span>
      </div>
      <ProgressBar pct={pct} color={isExhausted ? "#ef4444" : pctColor} />
    </div>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl animate-pulse ${className ?? ""}`} style={{ background: "rgba(255,255,255,0.05)", minHeight: 90 }} />
  );
}

// ─── Revenue Stats inline calculator ─────────────────────────────────────────

type RevenueFormState = {
  revenueGenerated: string;
  revenuePrev: string;
  numberOfOrders: string;
  ordersPrev: string;
  adBudgetSpent: string;
  roas: string;
  customerAcqCost: string;
  organicLeads: string;
  leadsPrev: string;
  avgOrderValue: string;
  rtoReturnsPercent: string;
  conversionRate: string;
  platformBadge: string;
  dailyRevenue: string[];
  dailyOrders: string[];
};

const EMPTY_FORM: RevenueFormState = {
  revenueGenerated: "", revenuePrev: "",
  numberOfOrders: "", ordersPrev: "",
  adBudgetSpent: "", roas: "",
  customerAcqCost: "", organicLeads: "",
  leadsPrev: "", avgOrderValue: "",
  rtoReturnsPercent: "", conversionRate: "", platformBadge: "",
  dailyRevenue: ["", "", "", "", "", "", ""],
  dailyOrders:  ["", "", "", "", "", "", ""],
};

function RevenueStatsSection() {
  const upsert = useUpsertMentorshipRevenue();
  const { data: revenue } = useMentorshipRevenue();

  const [form, setForm] = useState<RevenueFormState>(EMPTY_FORM);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!revenue) return;
    setForm({
      revenueGenerated: revenue.revenueGenerated?.toString() ?? "",
      revenuePrev: revenue.revenuePrev?.toString() ?? "",
      numberOfOrders: revenue.numberOfOrders?.toString() ?? "",
      ordersPrev: revenue.ordersPrev?.toString() ?? "",
      adBudgetSpent: revenue.adBudgetSpent?.toString() ?? "",
      roas: revenue.roas?.toString() ?? "",
      customerAcqCost: revenue.customerAcqCost?.toString() ?? "",
      organicLeads: revenue.organicLeads?.toString() ?? "",
      leadsPrev: revenue.leadsPrev?.toString() ?? "",
      avgOrderValue: revenue.avgOrderValue?.toString() ?? "",
      rtoReturnsPercent: revenue.rtoReturnsPercent?.toString() ?? "",
      conversionRate: revenue.conversionRate?.toString() ?? "",
      platformBadge: revenue.platformBadge ?? "",
      dailyRevenue: revenue.dailyRevenue?.map(String) ?? ["", "", "", "", "", "", ""],
      dailyOrders:  revenue.dailyOrders?.map(String)  ?? ["", "", "", "", "", "", ""],
    });
    setIsDirty(false);
  }, [revenue?.weekNumber]);

  const set = (key: keyof RevenueFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setIsDirty(true);
  };
  const setDailyRev = (i: number, v: string) => {
    setForm(f => { const arr = [...f.dailyRevenue]; arr[i] = v; return { ...f, dailyRevenue: arr }; });
    setIsDirty(true);
  };
  const setDailyOrd = (i: number, v: string) => {
    setForm(f => { const arr = [...f.dailyOrders]; arr[i] = v; return { ...f, dailyOrders: arr }; });
    setIsDirty(true);
  };

  // Live calculations
  const n = (v: string): number | null => (v === "" ? null : Number(v));
  const rev = n(form.revenueGenerated);
  const revPrev = n(form.revenuePrev);
  const orders = n(form.numberOfOrders);
  const ordersPrev = n(form.ordersPrev);
  const adSpend = n(form.adBudgetSpent);
  const roas = n(form.roas);
  const cac = n(form.customerAcqCost);
  const leads = n(form.organicLeads);
  const leadsPrevVal = n(form.leadsPrev);
  const aov = n(form.avgOrderValue);

  const revGrowth = growthPct(rev, revPrev);
  const ordersGrowth = growthPct(orders, ordersPrev);
  const leadsGrowth = growthPct(leads, leadsPrevVal);
  const autoAov = rev != null && orders != null && orders > 0 ? Math.round(rev / orders) : null;
  const effectiveAov = aov ?? autoAov;
  const btoRatio = adSpend != null && rev != null && rev > 0
    ? Math.round((adSpend / rev) * 1000) / 10
    : null;
  const roasLabel = roas != null
    ? (roas >= 3 ? "Highly Profitable" : roas >= 1.5 ? "Moderate" : "Watch Out")
    : null;
  const roasColor = roas != null
    ? (roas >= 3 ? { bg: "rgba(34,197,94,0.15)", text: "#22c55e" }
      : roas >= 1.5 ? { bg: "rgba(251,146,60,0.15)", text: "#fb923c" }
      : { bg: "rgba(239,68,68,0.15)", text: "#ef4444" })
    : null;
  const btoRisk = btoRatio != null
    ? (btoRatio < 5 ? "Low Risk" : btoRatio < 20 ? "Moderate" : "High Risk")
    : null;
  const btoColor = btoRatio != null
    ? (btoRatio < 5 ? { bg: "rgba(34,197,94,0.15)", text: "#22c55e" }
      : btoRatio < 20 ? { bg: "rgba(251,146,60,0.15)", text: "#fb923c" }
      : { bg: "rgba(239,68,68,0.15)", text: "#ef4444" })
    : null;

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        revenueGenerated: rev,
        revenuePrev: revPrev,
        numberOfOrders: orders != null ? Math.round(orders) : null,
        ordersPrev: ordersPrev != null ? Math.round(ordersPrev) : null,
        adBudgetSpent: adSpend,
        roas,
        customerAcqCost: cac,
        organicLeads: leads != null ? Math.round(leads) : null,
        leadsPrev: leadsPrevVal != null ? Math.round(leadsPrevVal) : null,
        avgOrderValue: aov,
        rtoReturnsPercent: n(form.rtoReturnsPercent),
        conversionRate: n(form.conversionRate),
        platformBadge: form.platformBadge || null,
        dailyRevenue: form.dailyRevenue.map(v => n(v)),
        dailyOrders:  form.dailyOrders.map(v => n(v) != null ? Math.round(n(v)!) : null),
      });
      setIsDirty(false);
      toast.success("Revenue stats saved!");
    } catch {
      toast.error("Failed to save.");
    }
  };

  // Input field renderer
  const inp = (
    key: keyof RevenueFormState,
    placeholder: string,
    opts?: { prefix?: string; isAuto?: boolean; autoVal?: number | null },
  ) => {
    const hasAuto = opts?.isAuto && opts.autoVal != null && form[key] === "";
    return (
      <div className="relative">
        {opts?.prefix && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none select-none"
            style={{ color: "var(--color-text-subtle)" }}
          >
            {opts.prefix}
          </span>
        )}
        <input
          type="number"
          min={0}
          step="any"
          placeholder={hasAuto ? opts!.autoVal!.toLocaleString("en-IN") : placeholder}
          value={form[key]}
          onChange={set(key)}
          className="w-full rounded-xl py-2.5 text-sm text-white outline-none transition-colors"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            paddingLeft: opts?.prefix ? "1.6rem" : "0.75rem",
            paddingRight: "0.75rem",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-accent)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
        />
        {hasAuto && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.06)", color: "var(--color-text-subtle)" }}>
            auto
          </span>
        )}
      </div>
    );
  };

  // Calculated result row
  const resultRow = (children: React.ReactNode) => (
    <div className="flex items-center gap-2 flex-wrap pt-1.5 min-h-[22px]">{children}</div>
  );

  const badge = (label: string, colors: { bg: string; text: string }) => (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: colors.bg, color: colors.text }}>
      {label}
    </span>
  );

  const divider = () => (
    <div className="w-full h-px my-1" style={{ background: "rgba(255,255,255,0.06)" }} />
  );

  const groupLabel = (text: string) => (
    <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: "var(--color-text-subtle)" }}>{text}</p>
  );

  const textInp = (key: keyof RevenueFormState, placeholder: string) => (
    <input
      type="text"
      placeholder={placeholder}
      value={form[key] as string}
      onChange={(e) => { setForm(f => ({ ...f, [key]: e.target.value })); setIsDirty(true); }}
      className="w-full rounded-xl py-2.5 px-3 text-sm text-white outline-none transition-colors"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-accent)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
    />
  );

  return (
    <div className="space-y-4">

      {/* ── Platform Badge ───────────────────────────────────────────── */}
      <div>
        {groupLabel("Platform Badge (optional)")}
        {textInp("platformBadge", "e.g. Platinum Seller, Top Merchant…")}
      </div>

      {divider()}

      {/* ── Revenue Performance ─────────────────────────────────────── */}
      <div>
        {groupLabel("Revenue Performance")}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>This Week</p>
            {inp("revenueGenerated", "0", { prefix: "₹" })}
          </div>
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Last Week</p>
            {inp("revenuePrev", "0", { prefix: "₹" })}
          </div>
        </div>
        {resultRow(
          <>
            {rev != null && (
              <span className="text-sm font-extrabold text-white">
                ₹{rev.toLocaleString("en-IN")}
              </span>
            )}
            {revGrowth != null && <GrowthBadge value={revGrowth} />}
            {rev != null && revPrev != null && (
              <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                vs ₹{revPrev.toLocaleString("en-IN")} last week
              </span>
            )}
          </>
        )}
      </div>

      {divider()}

      {/* ── Order Metrics ────────────────────────────────────────────── */}
      <div>
        {groupLabel("Order Metrics")}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Orders This Week</p>
            {inp("numberOfOrders", "0")}
          </div>
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Orders Last Week</p>
            {inp("ordersPrev", "0")}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Avg Order Value</p>
            {inp("avgOrderValue", "0", { prefix: "₹", isAuto: true, autoVal: autoAov })}
          </div>
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>RTO / Returns %</p>
            {inp("rtoReturnsPercent", "0")}
          </div>
        </div>
        {resultRow(
          <>
            {orders != null && (
              <span className="text-sm font-extrabold text-white">{orders.toLocaleString("en-IN")} orders</span>
            )}
            {ordersGrowth != null && <GrowthBadge value={ordersGrowth} />}
            {effectiveAov != null && (
              <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                Avg ₹{effectiveAov.toLocaleString("en-IN")}/order
                {autoAov != null && aov == null && (
                  <span className="ml-1 text-[9px]" style={{ color: "var(--color-text-subtle)" }}>(calculated)</span>
                )}
              </span>
            )}
          </>
        )}
      </div>

      {divider()}

      {/* ── Ad Performance ───────────────────────────────────────────── */}
      <div>
        {groupLabel("Ad Performance")}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Ad Budget Spent</p>
            {inp("adBudgetSpent", "0", { prefix: "₹" })}
          </div>
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>ROAS</p>
            {inp("roas", "0")}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Customer Acq. Cost</p>
            {inp("customerAcqCost", "0", { prefix: "₹" })}
          </div>
          {/* Revenue from ads = roas × ad spend */}
          {roas != null && adSpend != null && (
            <div className="flex flex-col justify-end pb-0.5">
              <p className="text-[9px] mb-1" style={{ color: "var(--color-text-secondary)" }}>Revenue from Ads</p>
              <p className="text-sm font-extrabold text-white">
                ₹{Math.round(roas * adSpend).toLocaleString("en-IN")}
              </p>
            </div>
          )}
        </div>
        {resultRow(
          <>
            {btoRatio != null && btoColor && (
              <>
                <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                  BTO {btoRatio}%
                </span>
                {badge(btoRisk!, btoColor)}
              </>
            )}
            {roasLabel && roasColor && badge(roasLabel, roasColor)}
            {cac != null && (
              <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                CAC ₹{cac.toLocaleString("en-IN")}
              </span>
            )}
          </>
        )}
      </div>

      {divider()}

      {/* ── Organic Growth ───────────────────────────────────────────── */}
      <div>
        {groupLabel("Organic Growth")}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Leads This Week</p>
            {inp("organicLeads", "0")}
          </div>
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Leads Last Week</p>
            {inp("leadsPrev", "0")}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Conversion Rate %</p>
            {inp("conversionRate", "0")}
          </div>
        </div>
        {resultRow(
          <>
            {leads != null && (
              <span className="text-sm font-extrabold text-white">{leads.toLocaleString("en-IN")} leads</span>
            )}
            {leadsGrowth != null && <GrowthBadge value={leadsGrowth} />}
            {leads != null && effectiveAov != null && (
              <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                Est. ₹{Math.round(leads * effectiveAov).toLocaleString("en-IN")} organic revenue
              </span>
            )}
          </>
        )}
      </div>

      {/* ── Weekly Chart ─────────────────────────────────────────────── */}
      <DailyInputsGrid form={form} weekDays={weekDaysFor(revenue)} setDailyRev={setDailyRev} setDailyOrd={setDailyOrd} />

      {/* ── Save button ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex justify-end pt-1"
          >
            <button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-60"
              style={{ background: "var(--color-accent)" }}
            >
              {upsert.isPending ? "Saving…" : "Save Stats"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekDays(): { label: string; day: number }[] {
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, day: d.getDate() };
  });
}

// Mon–Sun of a given ISO week (UTC date math — the backend stores weeks by IST ISO week).
function isoWeekDays(isoWeek: number, isoYear: number): { label: string; day: number }[] {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return labels.map((label, i) => {
    const d = new Date(week1Monday);
    d.setUTCDate(week1Monday.getUTCDate() + (isoWeek - 1) * 7 + i);
    return { label, day: d.getUTCDate() };
  });
}

// Prefer the week the saved report belongs to; fall back to the current local week
// only when there is no report yet (nothing is plotted in that case).
function weekDaysFor(revenue: { weekNumber?: number; year?: number } | null | undefined) {
  return revenue?.weekNumber && revenue?.year ? isoWeekDays(revenue.weekNumber, revenue.year) : getWeekDays();
}

// Daily series as stored: blank / missing days stay null (not plotted), never coerced to 0.
function toSeries(arr: (number | string | null)[] | null | undefined): (number | null)[] {
  return Array.from({ length: 7 }, (_, i) => {
    const v = arr?.[i];
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K+`;
  return v.toLocaleString("en-IN");
}

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

// ─── Part 2 — Revenue Summary KPI Cards ──────────────────────────────────────

function RevenueSummarySection({ revenue }: { revenue: any }) {
  const n = (v: string | null | undefined): number | null =>
    v == null || v === "" ? null : Number(v);

  const rev = revenue?.revenueGenerated ?? null;
  const revPrev = revenue?.revenuePrev ?? null;
  const orders = revenue?.numberOfOrders ?? null;
  const ordersPrev = revenue?.ordersPrev ?? null;
  const adSpend = revenue?.adBudgetSpent ?? null;
  const roas = revenue?.roas ?? null;
  const cac = revenue?.customerAcqCost ?? null;
  const leads = revenue?.organicLeads ?? null;
  const leadsPrev = revenue?.leadsPrev ?? null;
  const aov = revenue?.avgOrderValue ?? null;
  const autoAov = rev != null && orders != null && orders > 0 ? Math.round(rev / orders) : null;
  const effectiveAov = aov ?? autoAov;
  const rto = revenue?.rtoReturnsPercent ?? null;
  const cr = revenue?.conversionRate ?? null;
  const platform = revenue?.platformBadge ?? null;

  const revGrowth = growthPct(rev, revPrev);
  const ordersGrowth = growthPct(orders, ordersPrev);
  const leadsGrowth = growthPct(leads, leadsPrev);
  const btoRatio = adSpend != null && rev != null && rev > 0
    ? Math.round((adSpend / rev) * 1000) / 10 : null;
  const roasLabel = roas != null
    ? (roas >= 3 ? "Highly Profitable" : roas >= 1.5 ? "Moderate" : "Watch Out") : null;
  const roasColor = roas != null
    ? (roas >= 3 ? "#22c55e" : roas >= 1.5 ? "#fb923c" : "#ef4444") : null;
  const btoRisk = btoRatio != null
    ? (btoRatio < 5 ? "Low Risk" : btoRatio < 20 ? "Moderate" : "High Risk") : null;
  const btoColor = btoRatio != null
    ? (btoRatio < 5 ? "#22c55e" : btoRatio < 20 ? "#fb923c" : "#ef4444") : null;
  const crFlow = cr != null ? (cr >= 20 ? "High Converter" : cr >= 10 ? "Free Customer Flow" : "Needs Nurturing") : null;
  const crColor = cr != null ? (cr >= 20 ? "#22c55e" : cr >= 10 ? "#34d399" : "#fb923c") : null;

  const card = (
    label: string,
    main: React.ReactNode,
    mainColor: string,
    meta1: React.ReactNode,
    meta2?: React.ReactNode,
    topRight?: React.ReactNode,
    badge?: { text: string; color: string } | null,
  ) => (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2 min-w-0"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest leading-tight" style={{ color: "var(--color-text-subtle)" }}>{label}</span>
        {topRight}
      </div>
      <div className="text-2xl font-black tracking-tight leading-none" style={{ color: mainColor }}>{main}</div>
      {badge && (
        <span className="self-start text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${badge.color}26`, color: badge.color }}>
          {badge.text}
        </span>
      )}
      <div className="space-y-0.5">
        <p className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>{meta1}</p>
        {meta2 && <p className="text-[10px]" style={{ color: "var(--color-text-subtle)" }}>{meta2}</p>}
      </div>
    </div>
  );

  const roasTopBadge = roas != null ? (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(234,179,8,0.2)", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)" }}>
      ROAS {roas}×
    </span>
  ) : null;

  const leadsTopBadge = leadsGrowth != null ? (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: leadsGrowth >= 0 ? "rgba(167,139,250,0.15)" : "rgba(239,68,68,0.15)", color: leadsGrowth >= 0 ? "#a78bfa" : "#ef4444" }}>
      {leadsGrowth >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {leadsGrowth >= 0 ? "+" : ""}{leadsGrowth}%
    </span>
  ) : null;

  return (
    <motion.div variants={fadeUp} className="rounded-2xl p-4" style={{ background: "var(--color-bg-surface, #141414)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-sm font-bold" style={{ color: "var(--color-text-normal)" }}>Your Revenue Stats</h2>
        {platform && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {platform}
          </span>
        )}
      </div>
      {!revenue ? (
        <p className="text-[11px] py-6 text-center" style={{ color: "var(--color-text-subtle)" }}>
          No revenue numbers saved for this week yet.
        </p>
      ) : (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {card(
          "Revenue Generated",
          rev != null ? `₹${rev.toLocaleString("en-IN")}` : "—",
          "#eab308",
          effectiveAov != null ? `Avg Order Value: ₹${effectiveAov.toLocaleString("en-IN")}` : "No AOV data",
          revPrev != null ? `₹${revPrev.toLocaleString("en-IN")} prev wk` : undefined,
          revGrowth != null ? <GrowthBadge value={revGrowth} /> : undefined,
        )}
        {card(
          "Number of Orders",
          orders != null ? `${orders.toLocaleString("en-IN")} Orders` : "—",
          "#ffffff",
          rto != null ? `RTO / Returns: ${rto}%` : "No RTO data",
          undefined,
          ordersGrowth != null ? <GrowthBadge value={ordersGrowth} /> : undefined,
          btoRisk && btoColor ? { text: btoRisk, color: btoColor } : null,
        )}
        {card(
          "Ad Budget Spent",
          adSpend != null ? `₹${adSpend.toLocaleString("en-IN")}` : "—",
          "#ffffff",
          cac != null ? `Customer Acq Cost: ₹${cac.toLocaleString("en-IN")}` : "No CAC data",
          undefined,
          roasTopBadge,
          roasLabel && roasColor ? { text: roasLabel, color: roasColor } : null,
        )}
        {card(
          "Organic Inbound Leads",
          leads != null ? `${leads.toLocaleString("en-IN")} Leads` : "—",
          "#ffffff",
          cr != null ? `${cr}%` : "No CR data",
          crFlow ?? undefined,
          leadsTopBadge,
          crFlow && crColor ? { text: crFlow, color: crColor } : null,
        )}
      </div>
      )}
    </motion.div>
  );
}

// ─── Part 2 — Weekly Revenue & Order Trajectory Chart ────────────────────────

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function WeeklyLineChart({
  revData,
  ordData,
  weekDays,
  mode,
}: {
  revData: (number | null)[];
  ordData: (number | null)[];
  weekDays: { label: string; day: number }[];
  mode: "daily" | "cumulative";
}) {
  // Cumulative: running total over entered days; a missing day stays a gap.
  const cum = (arr: (number | null)[]) => {
    let run = 0;
    return arr.map((v) => (v == null ? null : (run += v)));
  };
  const displayRev = mode === "cumulative" ? cum(revData) : revData;
  const displayOrd = mode === "cumulative" ? cum(ordData) : ordData;

  const W = 700, H = 200;
  const PL = 58, PR = 16, PT = 20, PB = 32;
  const PW = W - PL - PR;
  const PH = H - PT - PB;

  const nums = (a: (number | null)[]) => a.filter((v): v is number => v != null);
  const maxRev = Math.max(...nums(displayRev), 1);
  const maxOrd = Math.max(...nums(displayOrd), 1);

  const xOf = (i: number) => PL + (i / 6) * PW;
  const yRev = (v: number) => PT + (1 - v / maxRev) * PH;
  const yOrd = (v: number) => PT + (1 - v / maxOrd) * PH;

  // Split a series into contiguous runs so missing days render as gaps.
  const segments = (a: (number | null)[], y: (v: number) => number) => {
    const out: { first: number; last: number; pts: string }[] = [];
    let cur: number[] = [];
    const flush = () => {
      if (cur.length) out.push({ first: cur[0], last: cur[cur.length - 1], pts: cur.map((i) => `${xOf(i).toFixed(1)},${y(a[i] as number).toFixed(1)}`).join(" ") });
      cur = [];
    };
    a.forEach((v, i) => { if (v == null) flush(); else cur.push(i); });
    flush();
    return out;
  };
  const revSegs = segments(displayRev, yRev);
  const ordSegs = segments(displayOrd, yOrd);

  // Peak day is always the best DAILY revenue (in cumulative mode the last point
  // would otherwise always "peak"). The callout sits on the displayed line.
  const dailyRevNums = nums(revData);
  const peakIdx = dailyRevNums.length ? revData.indexOf(Math.max(...dailyRevNums)) : -1;
  const peakDisplay = peakIdx >= 0 ? displayRev[peakIdx] : null;
  const peakX = peakIdx >= 0 ? xOf(peakIdx) : 0;
  const peakY = peakDisplay != null ? yRev(peakDisplay) : 0;

  const fmtY = (v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`;

  // Y-axis ticks (4 levels)
  const yTicks = [0, 0.33, 0.67, 1].map(p => ({
    val: Math.round(maxRev * p),
    y: PT + (1 - p) * PH,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Weekly revenue and order trajectory">
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map(({ val, y }, i) => (
        <g key={i}>
          <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={PL - 4} y={y + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)">{fmtY(val)}</text>
        </g>
      ))}

      {/* Revenue area fill (per contiguous run) */}
      {revSegs.map((seg, i) => (
        <polygon key={i} points={`${xOf(seg.first).toFixed(1)},${(PT + PH).toFixed(1)} ${seg.pts} ${xOf(seg.last).toFixed(1)},${(PT + PH).toFixed(1)}`} fill="url(#revGrad)" />
      ))}

      {/* Order velocity line (dashed yellow) */}
      {ordSegs.map((seg, i) => (
        <polyline key={i} points={seg.pts} fill="none" stroke="#eab308" strokeWidth="1.5" strokeDasharray="5 3" strokeLinejoin="round" />
      ))}

      {/* Revenue line (solid red) */}
      {revSegs.map((seg, i) => (
        <polyline key={i} points={seg.pts} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}

      {/* Data points on revenue line */}
      {displayRev.map((v, i) => v != null && (
        <circle key={i} cx={xOf(i)} cy={yRev(v)} r="3" fill="var(--color-accent)" stroke="#1a1a1a" strokeWidth="1.5" />
      ))}

      {/* Peak callout — values from the member's saved daily data */}
      {peakIdx >= 0 && peakDisplay != null && (
        <g data-testid="peak-callout">
          <line x1={peakX} y1={PT} x2={peakX} y2={PT + PH} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 2" />
          <rect x={peakX - 44} y={peakY - 36} width={88} height={30} rx={6} fill="#1e1e1e" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <text x={peakX} y={peakY - 22} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" fontWeight="600">
            PEAK DAY ({weekDays[peakIdx]?.label?.toUpperCase()})
          </text>
          <text x={peakX} y={peakY - 11} textAnchor="middle" fontSize="10" fill="var(--color-accent)" fontWeight="800">
            ₹{(revData[peakIdx] as number).toLocaleString("en-IN")}
          </text>
          {ordData[peakIdx] != null && (
            <text x={peakX} y={peakY - 1} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)">
              {ordData[peakIdx]} Orders
            </text>
          )}
        </g>
      )}

      {/* X-axis labels */}
      {weekDays.map((d, i) => (
        <text key={i} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)" fontWeight={i === peakIdx ? "700" : "400"}>
          {d.label}({d.day})
        </text>
      ))}
    </svg>
  );
}

function WeeklyChartSection({ revenue }: { revenue: any }) {
  const [mode, setMode] = useState<"daily" | "cumulative">("daily");
  const weekDays = weekDaysFor(revenue);

  const revData = toSeries(revenue?.dailyRevenue);
  const ordData = toSeries(revenue?.dailyOrders);
  const hasData = revData.some(v => v != null) || ordData.some(v => v != null);

  return (
    <motion.div variants={fadeUp} className="rounded-2xl p-4" style={{ background: "var(--color-bg-surface, #141414)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-start justify-between mb-1 gap-3">
        <div>
          <h2 className="text-sm font-bold" style={{ color: "var(--color-text-normal)" }}>Weekly Revenue & Order Trajectory</h2>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-subtle)" }}>
            Comparative trendline for {weekDays[0]?.label} {weekDays[0]?.day} – {weekDays[6]?.label} {weekDays[6]?.day}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-2 mr-3">
            <span className="flex items-center gap-1 text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              <span className="inline-block w-5 h-0.5 rounded" style={{ background: "var(--color-accent)" }} /> Daily Revenue (₹)
            </span>
            <span className="flex items-center gap-1 text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              <span className="inline-block w-5 border-t border-dashed border-yellow-400" /> Order Velocity
            </span>
          </div>
          {(["daily", "cumulative"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all capitalize"
              style={{
                background: mode === m ? "var(--color-accent)" : "rgba(255,255,255,0.05)",
                color: mode === m ? "white" : "var(--color-text-subtle)",
              }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative mt-3 rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.2)" }}>
        {hasData ? (
          <WeeklyLineChart revData={revData} ordData={ordData} weekDays={weekDays} mode={mode} />
        ) : (
          <div className="flex items-center justify-center" style={{ height: 200 }}>
            <p className="text-[11px]" style={{ color: "var(--color-text-subtle)" }}>No daily revenue saved for this week yet</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DailyInputsGrid({
  form,
  weekDays,
  setDailyRev,
  setDailyOrd,
}: {
  form: RevenueFormState;
  weekDays: { label: string; day: number }[];
  setDailyRev: (i: number, v: string) => void;
  setDailyOrd: (i: number, v: string) => void;
}) {
  return (
    <div>
      {/* Daily data inputs */}
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--color-text-subtle)" }}>Daily Inputs</p>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((d, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-[8px] font-bold text-center uppercase" style={{ color: "var(--color-text-subtle)" }}>
                {d.label}
              </p>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="Rev"
                value={form.dailyRevenue[i]}
                onChange={e => setDailyRev(i, e.target.value)}
                className="w-full rounded-lg py-1.5 px-1.5 text-[10px] text-white outline-none text-center transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                onFocus={e => { e.currentTarget.style.borderColor = "var(--color-accent)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
              <input
                type="number"
                min={0}
                step="1"
                placeholder="Ord"
                value={form.dailyOrders[i]}
                onChange={e => setDailyOrd(i, e.target.value)}
                className="w-full rounded-lg py-1.5 px-1.5 text-[10px] text-white outline-none text-center transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#eab308"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-1.5">
          <span className="flex items-center gap-1 text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--color-accent)" }} /> Top row = Revenue (₹)
          </span>
          <span className="flex items-center gap-1 text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            <span className="inline-block w-3 border-t border-dashed border-yellow-400" /> Bottom row = Orders
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Part 2 — Social Media Organic Growth ────────────────────────────────────

type SocialFormState = {
  totalFollowers: string;
  followersPrev: string;
  videoViews: string;
  videoViewsPrev: string;
  contentUploads: string;
  contentUploadTarget: string;
  interactions: string;
  interactionsPrev: string;
  dmLeads: string;
  bioLinkClicks: string;
  bioLinkClicksPrev: string;
};

const EMPTY_SOCIAL: SocialFormState = {
  totalFollowers: "", followersPrev: "",
  videoViews: "", videoViewsPrev: "",
  contentUploads: "", contentUploadTarget: "7",
  interactions: "", interactionsPrev: "",
  dmLeads: "",
  bioLinkClicks: "", bioLinkClicksPrev: "",
};

function SocialGrowthSection({ batchData }: { batchData: any }) {
  const upsert = useUpsertMentorshipSocial();
  const { data: social } = useMentorshipSocial();

  const [form, setForm] = useState<SocialFormState>(EMPTY_SOCIAL);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!social) return;
    setForm({
      totalFollowers:       social.totalFollowers?.toString() ?? "",
      followersPrev:        social.followersPrev?.toString() ?? "",
      videoViews:           social.videoViews?.toString() ?? "",
      videoViewsPrev:       social.videoViewsPrev?.toString() ?? "",
      contentUploads:       social.contentUploads?.toString() ?? "",
      contentUploadTarget:  social.contentUploadTarget?.toString() ?? "7",
      interactions:         social.interactions?.toString() ?? "",
      interactionsPrev:     social.interactionsPrev?.toString() ?? "",
      dmLeads:              social.dmLeads?.toString() ?? "",
      bioLinkClicks:        social.bioLinkClicks?.toString() ?? "",
      bioLinkClicksPrev:    social.bioLinkClicksPrev?.toString() ?? "",
    });
    setIsDirty(false);
  }, [social?.weekNumber]);

  const set = (key: keyof SocialFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [key]: e.target.value }));
    setIsDirty(true);
  };

  const n = (v: string): number | null => (v === "" ? null : Number(v));

  // Calculations
  const followers = n(form.totalFollowers);
  const followersPrev = n(form.followersPrev);
  const videoViews = n(form.videoViews);
  const videoViewsPrev = n(form.videoViewsPrev);
  const contentUploads = n(form.contentUploads);
  const contentTarget = n(form.contentUploadTarget) ?? 7;
  const interactions = n(form.interactions);
  const interactionsPrev = n(form.interactionsPrev);
  const dmLeads = n(form.dmLeads);
  const bioClicks = n(form.bioLinkClicks);
  const bioClicksPrev = n(form.bioLinkClicksPrev);

  const followersGrowth = growthPct(followers, followersPrev);
  const videoGrowth = growthPct(videoViews, videoViewsPrev);
  const interactionsGrowth = growthPct(interactions, interactionsPrev);
  const bioGrowth = growthPct(bioClicks, bioClicksPrev);
  const contentPct = contentUploads != null && contentTarget > 0 ? Math.round((contentUploads / contentTarget) * 100) : null;
  const targetPace = contentPct ?? 0;

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        totalFollowers:      followers != null ? Math.round(followers) : null,
        followersPrev:       followersPrev != null ? Math.round(followersPrev) : null,
        videoViews:          videoViews != null ? Math.round(videoViews) : null,
        videoViewsPrev:      videoViewsPrev != null ? Math.round(videoViewsPrev) : null,
        contentUploads:      contentUploads != null ? Math.round(contentUploads) : null,
        contentUploadTarget: Math.round(contentTarget),
        interactions:        interactions != null ? Math.round(interactions) : null,
        interactionsPrev:    interactionsPrev != null ? Math.round(interactionsPrev) : null,
        dmLeads:             dmLeads != null ? Math.round(dmLeads) : null,
        bioLinkClicks:       bioClicks != null ? Math.round(bioClicks) : null,
        bioLinkClicksPrev:   bioClicksPrev != null ? Math.round(bioClicksPrev) : null,
      });
      setIsDirty(false);
      toast.success("Social stats saved!");
    } catch {
      toast.error("Failed to save.");
    }
  };

  // Social metric tile: compact input pair + calculated % badge
  const tile = (
    label: string,
    currKey: keyof SocialFormState,
    prevKey: keyof SocialFormState | null,
    growth: number | null,
    badge: string,
    opts?: { isQuota?: boolean; targetKey?: keyof SocialFormState; noGrowth?: boolean; suffix?: string },
  ) => {
    const currVal = n(form[currKey]);
    const target = opts?.targetKey ? n(form[opts.targetKey]) : null;
    const displayVal = currVal != null
      ? (opts?.suffix ? `${fmtK(currVal)}${opts.suffix}` : fmtK(currVal))
      : "—";

    return (
      <div
        className="rounded-xl p-3 flex flex-col gap-2"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>{label}</p>
        <div className="text-lg font-extrabold text-white leading-none">
          {displayVal}
          {opts?.isQuota && target != null && (
            <span className="text-xs font-semibold ml-0.5" style={{ color: "var(--color-text-secondary)" }}>/{target}</span>
          )}
        </div>

        {/* Input fields */}
        <div className="flex gap-1">
          <input
            type="number"
            min={0}
            placeholder="This wk"
            value={form[currKey]}
            onChange={set(currKey)}
            className="min-w-0 flex-1 rounded-lg py-1 px-2 text-[10px] text-white outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--color-accent)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          />
          {prevKey && (
            <input
              type="number"
              min={0}
              placeholder={opts?.isQuota ? "Target" : "Last wk"}
              value={form[prevKey]}
              onChange={set(prevKey)}
              className="min-w-0 flex-1 rounded-lg py-1 px-2 text-[10px] text-white outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              onFocus={e => { e.currentTarget.style.borderColor = "#818cf8"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
            />
          )}
        </div>

        {/* Result badge */}
        {!opts?.noGrowth && growth != null ? (
          <GrowthBadge value={growth} />
        ) : (
          <span className="text-[10px] font-semibold" style={{ color: "var(--color-text-subtle)" }}>{badge}</span>
        )}
        {opts?.isQuota && contentPct != null && (
          <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-1 rounded-full" style={{ width: `${Math.min(100, contentPct)}%`, background: contentPct >= 100 ? "#22c55e" : "var(--color-accent)", transition: "width 0.8s ease" }} />
          </div>
        )}
      </div>
    );
  };

  // Tasks row from batch data
  const recentDays: any[] = (batchData?.days ?? [])
    .slice()
    .sort((a: any, b: any) => b.dayNumber - a.dayNumber)
    .slice(0, 6);

  const taskIcon = (status: string) => {
    if (status === "approved") return { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.25)", icon: "✓", color: "#22c55e" };
    if (status === "submitted") return { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.25)", icon: "→", color: "#fbbf24" };
    if (status === "rejected") return { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", icon: "!", color: "#ef4444" };
    return { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.09)", icon: "○", color: "rgba(255,255,255,0.3)" };
  };

  return (
    <motion.div variants={fadeUp} className="space-y-4">
      {/* Social Growth card */}
      <div className="rounded-2xl p-4" style={{ background: "var(--color-bg-surface, #141414)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-sm font-bold" style={{ color: "var(--color-text-normal)" }}>Social Media Organic Growth</h2>
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
            style={{
              background: targetPace >= 100 ? "rgba(34,197,94,0.15)" : targetPace >= 50 ? "rgba(251,146,60,0.12)" : "rgba(255,255,255,0.05)",
              color: targetPace >= 100 ? "#22c55e" : targetPace >= 50 ? "#fb923c" : "rgba(255,255,255,0.4)",
              border: `1px solid ${targetPace >= 100 ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: targetPace >= 100 ? "#22c55e" : targetPace >= 50 ? "#fb923c" : "rgba(255,255,255,0.3)" }} />
            Target Pace: {contentPct ?? 0}%
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {tile("Total Followers", "totalFollowers", "followersPrev", followersGrowth, "+6.8% new fans")}
          {tile("Video Views", "videoViews", "videoViewsPrev", videoGrowth, "+12.8% this wk")}
          {tile("Content Uploads", "contentUploads", "contentUploadTarget", null, "Weekly Quota", { isQuota: true, noGrowth: true })}
          {tile("Interactions", "interactions", "interactionsPrev", interactionsGrowth, "+0.5% Increase")}
          {tile("Inbound DM Leads", "dmLeads", null, null, "Organic", { noGrowth: true })}
          {tile("Bio Link Clicks", "bioLinkClicks", "bioLinkClicksPrev", bioGrowth, "+16.4% CTR")}
        </div>

        <AnimatePresence>
          {isDirty && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex justify-end pt-4"
            >
              <button
                onClick={handleSave}
                disabled={upsert.isPending}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-60"
                style={{ background: "var(--color-accent)" }}
              >
                {upsert.isPending ? "Saving…" : "Save Social Stats"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tasks row */}
      {recentDays.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--color-text-subtle)" }}>Tasks</p>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {recentDays.map((day: any) => {
              const t = taskIcon(day.status ?? "pending");
              return (
                <div
                  key={day.dayNumber}
                  className="shrink-0 rounded-2xl p-3.5 flex flex-col gap-2 w-44"
                  style={{ background: t.bg, border: `1px solid ${t.border}` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>
                      Tasks · Day {day.dayNumber}
                    </span>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: t.border, color: t.color }}>
                      {t.icon}
                    </span>
                  </div>
                  <p className="text-sm font-bold leading-snug" style={{ color: "var(--color-text-normal)" }}>
                    {day.category ?? `Day ${day.dayNumber}`}
                  </p>
                  <p className="text-[9px] capitalize" style={{ color: "var(--color-text-subtle)" }}>
                    {day.status ?? "pending"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MentorshipDashboard({ showBackLink = false }: { showBackLink?: boolean }) {
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useMentorshipStats();
  const { data: batchData, isLoading: batchLoading } = useMyBatchProgram();
  const { data: quota, isLoading: quotaLoading, isError: quotaError, refetch: refetchQuota } = useUserSupportQuota();
  const { data: revenue } = useMentorshipRevenue();
  const [showRevenueForm, setShowRevenueForm] = useState(false);

  const isLoading = statsLoading || batchLoading || quotaLoading;

  const programName = stats?.programName ?? batchData?.batch?.program?.name ?? batchData?.batch?.name ?? null;
  const streakDays = stats?.streakDays ?? 0;
  const weeklyReportSubmitted = stats?.weeklyReportSubmitted ?? false;
  // null when the member has no batch settings yet — header then shows no hearts
  const lifelinesTotal: number | null = batchData?.lifelinesTotal ?? null;
  const lifelinesUsed: number | null = batchData?.lifelinesUsed ?? null;

  const dailyHrs = stats?.dailyTimeSpentHrs ?? 0;
  const dailyGoal: number | null = stats?.dailyTimeGoalHrs ?? null;
  const dailyGrowth = dailyGoal != null && dailyGoal > 0 ? Math.round(((dailyHrs - dailyGoal) / dailyGoal) * 1000) / 10 : null;

  // All six Expert Support Call types count toward the totals shown in the KPI + badges.
  const callTypes = quota
    ? [quota.salesSupport, quota.techSupport, quota.contentSupport, quota.adSupport, quota.callCredits, quota.groupCall]
    : [];
  const allCallsUsed = callTypes.reduce((s, q) => s + (q?.used ?? 0), 0);
  const allCallsAllocated = callTypes.reduce((s, q) => s + (q?.allocated ?? 0), 0);
  const allCallsRemaining = Math.max(0, allCallsAllocated - allCallsUsed);

  const revGrowth = growthPct(revenue?.revenueGenerated ?? null, revenue?.revenuePrev ?? null);
  const leadsGrowthVal = growthPct(revenue?.organicLeads ?? null, revenue?.leadsPrev ?? null);

  const daysLeft = Math.max(0, (stats?.totalDays ?? 0) - (stats?.daysElapsed ?? 0));
  const totalDays = stats?.totalDays ?? 0;
  const daysElapsed = stats?.daysElapsed ?? 0;

  const dailyHrsCount = useCountUp(dailyHrs, 1200, 2);
  const allCallsUsedCount = useCountUp(allCallsUsed, 900);
  const revenueCount = useCountUp(revenue?.revenueGenerated ?? 0, 1400);

  if (isLoading) {
    return (
      <div className="space-y-6 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-6 w-48 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="h-6 w-32 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-36" />
        <SkeletonCard className="h-48" />
      </div>
    );
  }

  if (statsError || quotaError || !stats || !quota) {
    return (
      <div className="rounded-2xl p-6 text-center space-y-3" style={{ background: "var(--color-bg-surface, #141414)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Couldn&apos;t load your mentorship stats.</p>
        <button
          onClick={() => { void refetchStats(); void refetchQuota(); }}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white"
          style={{ background: "var(--color-accent)" }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <MentorshipHeader
        programName={programName}
        weeklyReportSubmitted={weeklyReportSubmitted}
        streakDays={streakDays}
        lifelinesTotal={lifelinesTotal}
        lifelinesUsed={lifelinesUsed}
      />

      {/* ── KPI Strip ────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Daily Time Spent"
          value={`${dailyHrsCount} hrs`}
          sub={dailyGoal != null ? `vs ${dailyGoal}hr goal` : "Today"}
          growth={dailyGrowth}
          icon={Clock}
        />
        <KpiCard
          label="Support Delivered"
          value={`${allCallsUsedCount} Calls`}
          sub={`${allCallsAllocated} Total Calls`}
          icon={Phone}
          accentColor="#818cf8"
        />
        <KpiCard
          label={revenue?.numberOfOrders ? `Revenue Generated | ${revenue.numberOfOrders} Orders` : "Revenue Generated"}
          value={revenue?.revenueGenerated != null ? `₹${revenueCount}` : "—"}
          sub={revenue?.revenueGenerated != null && revenue?.numberOfOrders ? `Avg ₹${Math.round(revenue.revenueGenerated / revenue.numberOfOrders).toLocaleString("en-IN")} / order` : revenue?.revenueGenerated != null ? "No order count yet" : "No data yet"}
          growth={revGrowth}
          icon={BarChart3}
          accentColor="#eab308"
          valueColor={revenue?.revenueGenerated != null ? "#eab308" : undefined}
        />
        <KpiCard
          label="Organic Growth (Weekly)"
          value={leadsGrowthVal != null ? `${leadsGrowthVal >= 0 ? "+" : ""}${leadsGrowthVal}%` : "—"}
          sub={revenue?.leadsPrev != null ? `Closed ${leadsGrowthVal != null ? Math.abs(leadsGrowthVal) : "—"}% Since Prev` : "Weekly vs prior week"}
          growth={leadsGrowthVal}
          icon={TrendingUp}
          accentColor="#f472b6"
          valueColor={leadsGrowthVal != null && leadsGrowthVal >= 0 ? "#22c55e" : undefined}
        />
      </motion.div>

      {/* ── Customer Journey ─────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl p-4"
        style={{ background: "var(--color-bg-surface, #141414)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold" style={{ color: "var(--color-text-normal)" }}>
            Customer Journey
          </h2>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live Update
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <JourneyTile
            label="Daily Usage"
            used={`${Number(dailyHrs.toFixed(2))}h`}
            icon={Activity}
            pct={dailyGoal != null && dailyGoal > 0 ? (dailyHrs / dailyGoal) * 100 : null}
            noBar={dailyGoal == null}
            sub={dailyGoal != null ? `avg: ${dailyGoal}h` : undefined}
          />
          <JourneyTile
            label="Modules"
            used={stats.completedEpisodes}
            total={stats.totalEpisodes}
            icon={BookOpen}
            badge={stats.totalEpisodes > 0 ? `${Math.round((stats.completedEpisodes / stats.totalEpisodes) * 100)}%` : undefined}
            badgeColor="#818cf8"
          />
          <JourneyTile
            label="Tasks"
            used={stats.tasksCompleted}
            total={stats.tasksTotal}
            icon={CheckCircle2}
            badge={stats.tasksTotal > 0 ? `${Math.round((stats.tasksCompleted / stats.tasksTotal) * 100)}%` : undefined}
            badgeColor="#34d399"
          />
          <JourneyTile
            label="Support Days"
            used={daysLeft}
            suffix="d left"
            icon={Target}
            noBar
            sub={totalDays > 0 ? `${totalDays}d total` : undefined}
          />
          <JourneyTile
            label="Tier Access"
            used={daysElapsed}
            total={totalDays}
            suffix="d"
            icon={Star}
            badge={totalDays >= 300 ? "Annual" : undefined}
            badgeColor="#f472b6"
          />
          <JourneyTile
            label="Leaderboard"
            used={stats?.leaderboardRank != null ? `#${stats.leaderboardRank}${ordinalSuffix(stats.leaderboardRank)}` : "#—"}
            icon={Trophy}
            noBar
          />
        </div>
      </motion.div>

      {/* ── Expert Support Calls ─────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl p-4"
        style={{ background: "var(--color-bg-surface, #141414)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-sm font-bold" style={{ color: "var(--color-text-normal)" }}>
            Expert Support Calls
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(129,140,248,0.15)", color: "#818cf8" }}>
              {allCallsUsed} MC Completed
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(251,146,60,0.12)", color: "#fb923c" }}>
              {allCallsRemaining}/{allCallsAllocated} Quota Remaining
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SupportCallTile label="Sales Calls"     used={quota.salesSupport.used}   total={quota.salesSupport.allocated} />
          <SupportCallTile label="Tech Calls"      used={quota.techSupport.used}    total={quota.techSupport.allocated} />
          <SupportCallTile label="Content Calls"   used={quota.contentSupport.used} total={quota.contentSupport.allocated} />
          <SupportCallTile label="Marketing Calls" used={quota.adSupport.used}      total={quota.adSupport.allocated} />
          <SupportCallTile label="Mentor 1-On-1"   used={quota.callCredits.used}    total={quota.callCredits.allocated} />
          <SupportCallTile label="Live Group Q&A"  used={quota.groupCall.used}      total={quota.groupCall.allocated} />
        </div>
      </motion.div>

      {/* ── E. Your Revenue Stats (saved weekly numbers) ───────────────── */}
      <RevenueSummarySection revenue={revenue} />

      {/* ── F. Weekly Revenue & Order Trajectory (saved daily numbers) ──── */}
      <WeeklyChartSection revenue={revenue} />

      {/* ── Data entry: the member's own weekly numbers feed E and F ────── */}
      <motion.div variants={fadeUp} className="flex flex-col gap-3">
        <button
          onClick={() => setShowRevenueForm((v) => !v)}
          className="self-end text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.05)", color: "var(--color-text-secondary)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {showRevenueForm ? "Close" : "Update this week\u2019s numbers"}
        </button>
        {showRevenueForm && (
          <div className="rounded-2xl p-4" style={{ background: "var(--color-bg-surface, #141414)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <RevenueStatsSection />
          </div>
        )}
      </motion.div>

      {showBackLink && (
        <motion.div variants={fadeUp}>
          <Link
            href="/batch-program"
            className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Batch Program
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
}

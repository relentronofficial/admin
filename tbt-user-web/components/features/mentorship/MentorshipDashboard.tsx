"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Flame, Heart, CheckCircle2, Clock, TrendingUp, TrendingDown,
  BookOpen, BarChart3, Target, Phone, ChevronRight, Trophy, Star, Activity,
} from "lucide-react";
import { useMentorshipStats, useMentorshipRevenue, useUpsertMentorshipRevenue } from "@/lib/hooks/useMentorship";
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
  lifelinesTotal: number;
  lifelinesUsed: number;
}) {
  const totalHearts = Math.max(5, lifelinesTotal);
  const filledHearts = lifelinesTotal - lifelinesUsed;

  return (
    <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3 mb-6">
      <h1 className="text-lg font-bold flex-1 min-w-0 truncate" style={{ color: "var(--color-text-normal)" }}>
        {programName ?? "Mentorship Program"}
      </h1>
      <div className="flex items-center gap-2 flex-wrap">
        {weeklyReportSubmitted && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
            <CheckCircle2 className="w-3 h-3" /> Weekly Report Submitted
          </span>
        )}
        <span className="mentorship-streak-badge inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)" }}>
          <Flame className="w-3 h-3" /> {streakDays} Days
        </span>
        <span className="inline-flex items-center gap-0.5">
          {Array.from({ length: totalHearts }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6 + i * 0.08, type: "spring", stiffness: 400, damping: 16 }}
            >
              <Heart
                className="w-4 h-4"
                style={{ color: i < filledHearts ? "#ef4444" : "rgba(255,255,255,0.15)" }}
                fill={i < filledHearts ? "#ef4444" : "none"}
              />
            </motion.span>
          ))}
        </span>
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
}: {
  label: string;
  value: string;
  sub: string;
  growth?: number | null;
  icon: React.ElementType;
  accentColor?: string;
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
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>{label}</span>
        <Icon className="w-4 h-4" style={{ color: accentColor ?? "var(--color-accent)", opacity: 0.7 }} />
      </div>
      <div className="text-2xl font-black tracking-tight text-white">{value}</div>
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
}: {
  label: string;
  used: number | string;
  total?: number | string;
  suffix?: string;
  icon: React.ElementType;
  noBar?: boolean;
}) {
  const pct = typeof used === "number" && typeof total === "number" && total > 0
    ? (used / total) * 100
    : 0;
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" style={{ color: "var(--color-accent)", opacity: 0.7 }} />
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-black text-white">{used}</span>
        {total != null && <span className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>/{total}{suffix}</span>}
        {!total && suffix && <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{suffix}</span>}
      </div>
      {!noBar && <ProgressBar pct={pct} />}
    </div>
  );
}

function SupportCallTile({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const isExhausted = total > 0 && used >= total;
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${isExhausted ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-lg font-black" style={{ color: isExhausted ? "#ef4444" : "white" }}>{used}</span>
        <span className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>/{total}</span>
      </div>
      <ProgressBar pct={pct} color={isExhausted ? "#ef4444" : "var(--color-accent)"} />
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
};

const EMPTY_FORM: RevenueFormState = {
  revenueGenerated: "", revenuePrev: "",
  numberOfOrders: "", ordersPrev: "",
  adBudgetSpent: "", roas: "",
  customerAcqCost: "", organicLeads: "",
  leadsPrev: "", avgOrderValue: "",
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
    });
    setIsDirty(false);
  }, [revenue?.weekNumber]);

  const set = (key: keyof RevenueFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
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

  return (
    <div className="space-y-4">

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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Leads This Week</p>
            {inp("organicLeads", "0")}
          </div>
          <div>
            <p className="text-[9px] mb-1.5" style={{ color: "var(--color-text-secondary)" }}>Leads Last Week</p>
            {inp("leadsPrev", "0")}
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function MentorshipDashboard({ showBackLink = false }: { showBackLink?: boolean }) {
  const { data: stats, isLoading: statsLoading } = useMentorshipStats();
  const { data: batchData, isLoading: batchLoading } = useMyBatchProgram();
  const { data: quota, isLoading: quotaLoading } = useUserSupportQuota();
  const { data: revenue } = useMentorshipRevenue();

  const isLoading = statsLoading || batchLoading || quotaLoading;

  const programName = stats?.programName ?? batchData?.batch?.program?.name ?? batchData?.batch?.name ?? null;
  const streakDays = stats?.streakDays ?? 0;
  const weeklyReportSubmitted = stats?.weeklyReportSubmitted ?? false;
  const lifelinesTotal = batchData?.lifelinesTotal ?? 3;
  const lifelinesUsed = batchData?.lifelinesUsed ?? 0;

  const dailyHrs = stats?.dailyTimeSpentHrs ?? 0;
  const dailyGoal = stats?.dailyTimeGoalHrs ?? 2;
  const dailyGrowth = dailyGoal > 0 ? Math.round(((dailyHrs - dailyGoal) / dailyGoal) * 1000) / 10 : null;

  const allCallsUsed = quota
    ? (quota.techSupport.used + quota.adSupport.used + quota.groupCall.used + quota.callCredits.used)
    : 0;
  const allCallsAllocated = quota
    ? (quota.techSupport.allocated + quota.adSupport.allocated + quota.groupCall.allocated + quota.callCredits.allocated)
    : 0;
  const allCallsRemaining = Math.max(0, allCallsAllocated - allCallsUsed);

  const revGrowth = growthPct(revenue?.revenueGenerated ?? null, revenue?.revenuePrev ?? null);
  const leadsGrowthVal = growthPct(revenue?.organicLeads ?? null, revenue?.leadsPrev ?? null);

  const daysLeft = Math.max(0, (stats?.totalDays ?? 0) - (stats?.daysElapsed ?? 0));
  const totalDays = stats?.totalDays ?? 0;
  const daysElapsed = stats?.daysElapsed ?? 0;
  const attendanceCount = batchData?.attendance?.filter((a: any) => a.status === "present").length ?? 0;

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
          sub={`vs ${dailyGoal}hr goal`}
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
          label="Revenue Generated"
          value={revenue?.revenueGenerated != null ? `₹${revenueCount}` : "—"}
          sub={revenue?.revenueGenerated != null ? `Avg ₹${Math.round((revenue.revenueGenerated ?? 0) / Math.max(1, revenue?.numberOfOrders ?? 1)).toLocaleString("en-IN")} / order` : "No data yet"}
          growth={revGrowth}
          icon={BarChart3}
          accentColor="#34d399"
        />
        <KpiCard
          label="Organic Growth"
          value={leadsGrowthVal != null ? `${leadsGrowthVal >= 0 ? "+" : ""}${leadsGrowthVal}%` : "—"}
          sub="Weekly vs prior week"
          growth={leadsGrowthVal}
          icon={TrendingUp}
          accentColor="#f472b6"
        />
      </motion.div>

      {/* ── Customer Journey ─────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl p-4"
        style={{ background: "var(--color-bg-surface, #141414)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>
            Customer Journey
          </h2>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live Update
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <JourneyTile label="Daily Usage" used={attendanceCount} total={totalDays} icon={Activity} />
          <JourneyTile label="Modules" used={stats?.completedEpisodes ?? 0} total={stats?.totalEpisodes ?? 0} icon={BookOpen} />
          <JourneyTile label="Tasks" used={stats?.tasksCompleted ?? 0} total={stats?.tasksTotal ?? 0} icon={CheckCircle2} />
          <JourneyTile label="Support Days" used={daysLeft} suffix="d left" icon={Target} noBar />
          <JourneyTile label="Tier Access" used={daysElapsed} total={totalDays} suffix="d" icon={Star} />
          <JourneyTile
            label="Leaderboard"
            used={stats?.leaderboardRank != null ? `#${stats.leaderboardRank}` : "#—"}
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
          <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>
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
          <SupportCallTile label="Sales Calls"     used={quota?.salesSupport?.used ?? 0}   total={quota?.salesSupport?.allocated ?? 0} />
          <SupportCallTile label="Tech Calls"      used={quota?.techSupport.used ?? 0}    total={quota?.techSupport.allocated ?? 0} />
          <SupportCallTile label="Content Calls"   used={quota?.contentSupport?.used ?? 0} total={quota?.contentSupport?.allocated ?? 0} />
          <SupportCallTile label="Marketing Calls" used={quota?.adSupport.used ?? 0}      total={quota?.adSupport.allocated ?? 0} />
          <SupportCallTile label="Mentor 1-On-1"   used={quota?.callCredits.used ?? 0}    total={quota?.callCredits.allocated ?? 0} />
          <SupportCallTile label="Live Group Q&A"  used={quota?.groupCall.used ?? 0}      total={quota?.groupCall.allocated ?? 0} />
        </div>
      </motion.div>

      {/* ── Revenue Stats ────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl p-4"
        style={{ background: "var(--color-bg-surface, #141414)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="mb-5">
          <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>
            Your Revenue Stats
          </h2>
          <p className="text-[11px] mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Fill in your numbers — results calculate instantly as you type.
          </p>
        </div>
        <RevenueStatsSection />
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

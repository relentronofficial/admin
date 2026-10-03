"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Flame, Heart, CheckCircle2, Clock, TrendingUp, TrendingDown,
  Users, BookOpen, BarChart3, Target, Zap, Phone, X, Edit3,
  ChevronRight, RefreshCw, Trophy, Star, Activity,
} from "lucide-react";
import { useMentorshipStats, useMentorshipRevenue, useUpsertMentorshipRevenue } from "@/lib/hooks/useMentorship";
import { useMyBatchProgram } from "@/lib/hooks/useBatchProgram";
import { useUserSupportQuota } from "@/lib/hooks/useUser";
import { useMe } from "@/lib/hooks/useUser";
import { useCountUp, formatINR, growthPct } from "@/lib/hooks/useCountUp";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
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

// ─── Section: Header ──────────────────────────────────────────────────────────

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

// ─── Section: KPI Strip ───────────────────────────────────────────────────────

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

// ─── Section: Customer Journey ────────────────────────────────────────────────

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

// ─── Section: Support Calls ───────────────────────────────────────────────────

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

// ─── Section: Revenue Card ────────────────────────────────────────────────────

function RevenueCard({
  label,
  primary,
  sub1,
  sub2,
  badge,
  badgeColor,
  growth,
}: {
  label: string;
  primary: string;
  sub1?: string;
  sub2?: string;
  badge?: string;
  badgeColor?: string;
  growth?: number | null;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{
        background: "var(--color-bg-surface, #141414)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>{label}</span>
        {growth != null && <GrowthBadge value={growth} />}
      </div>
      <div className="text-xl font-black text-white">{primary}</div>
      {badge && (
        <span className="self-start text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: badgeColor ?? "rgba(34,197,94,0.15)", color: "#22c55e" }}>
          {badge}
        </span>
      )}
      {sub1 && <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{sub1}</p>}
      {sub2 && <p className="text-[11px]" style={{ color: "var(--color-text-subtle)" }}>{sub2}</p>}
    </div>
  );
}

// ─── Revenue Edit Modal ───────────────────────────────────────────────────────

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

function RevenueModal({
  onClose,
  initial,
}: {
  onClose: () => void;
  initial: Record<string, number | null>;
}) {
  const upsert = useUpsertMentorshipRevenue();
  const [form, setForm] = useState<RevenueFormState>({
    revenueGenerated: initial.revenueGenerated?.toString() ?? "",
    revenuePrev: initial.revenuePrev?.toString() ?? "",
    numberOfOrders: initial.numberOfOrders?.toString() ?? "",
    ordersPrev: initial.ordersPrev?.toString() ?? "",
    adBudgetSpent: initial.adBudgetSpent?.toString() ?? "",
    roas: initial.roas?.toString() ?? "",
    customerAcqCost: initial.customerAcqCost?.toString() ?? "",
    organicLeads: initial.organicLeads?.toString() ?? "",
    leadsPrev: initial.leadsPrev?.toString() ?? "",
    avgOrderValue: initial.avgOrderValue?.toString() ?? "",
  });

  const field = (key: keyof RevenueFormState, label: string, prefix?: string) => (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-text-subtle)" }}>
        {label}
      </label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{prefix}</span>}
        <input
          type="number"
          min={0}
          step="any"
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none transition-all"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </div>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = (v: string) => (v === "" ? null : Number(v));
    try {
      await upsert.mutateAsync({
        revenueGenerated: n(form.revenueGenerated),
        revenuePrev: n(form.revenuePrev),
        numberOfOrders: n(form.numberOfOrders) ? Math.round(n(form.numberOfOrders)!) : null,
        ordersPrev: n(form.ordersPrev) ? Math.round(n(form.ordersPrev)!) : null,
        adBudgetSpent: n(form.adBudgetSpent),
        roas: n(form.roas),
        customerAcqCost: n(form.customerAcqCost),
        organicLeads: n(form.organicLeads) ? Math.round(n(form.organicLeads)!) : null,
        leadsPrev: n(form.leadsPrev) ? Math.round(n(form.leadsPrev)!) : null,
        avgOrderValue: n(form.avgOrderValue),
      });
      toast.success("Revenue stats updated!");
      onClose();
    } catch {
      toast.error("Failed to save. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-white text-base">Update This Week&apos;s Stats</h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "var(--color-text-subtle)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          {field("revenueGenerated", "Revenue Generated", "₹")}
          {field("revenuePrev", "Revenue — Prev Week", "₹")}
          {field("numberOfOrders", "Number of Orders")}
          {field("ordersPrev", "Orders — Prev Week")}
          {field("adBudgetSpent", "Ad Budget Spent", "₹")}
          {field("roas", "ROAS")}
          {field("customerAcqCost", "Customer Acq. Cost", "₹")}
          {field("organicLeads", "Organic Inbound Leads")}
          {field("leadsPrev", "Leads — Prev Week")}
          {field("avgOrderValue", "Avg Order Value", "₹")}
          <div className="col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: "var(--color-text-secondary)", background: "rgba(255,255,255,0.05)" }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={upsert.isPending}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: "var(--color-accent)", opacity: upsert.isPending ? 0.6 : 1 }}
            >
              {upsert.isPending ? "Saving…" : "Save Stats"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl animate-pulse ${className ?? ""}`} style={{ background: "rgba(255,255,255,0.05)", minHeight: 90 }} />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MentorshipDashboardPage() {
  const { uiStrings } = useSiteConfig();
  const [revenueModalOpen, setRevenueModalOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useMentorshipStats();
  const { data: batchData, isLoading: batchLoading } = useMyBatchProgram();
  const { data: quota, isLoading: quotaLoading } = useUserSupportQuota();
  const { data: revenue, isLoading: revenueLoading } = useMentorshipRevenue();
  const { data: me } = useMe();

  const isLoading = statsLoading || batchLoading || quotaLoading;

  // ── Derived values ──────────────────────────────────────────────────────────
  const programName = stats?.programName ?? batchData?.batch?.program?.name ?? batchData?.batch?.name ?? null;
  const streakDays = stats?.streakDays ?? 0;
  const weeklyReportSubmitted = stats?.weeklyReportSubmitted ?? false;
  const lifelinesTotal = batchData?.lifelinesTotal ?? 3;
  const lifelinesUsed = batchData?.lifelinesUsed ?? 0;

  const dailyHrs = stats?.dailyTimeSpentHrs ?? 0;
  const dailyGoal = stats?.dailyTimeGoalHrs ?? 2;
  const dailyGrowth = dailyGoal > 0 ? Math.round(((dailyHrs - dailyGoal) / dailyGoal) * 1000) / 10 : null;

  // Support totals
  const allCallsUsed = quota
    ? (quota.techSupport.used + quota.adSupport.used + quota.groupCall.used + quota.callCredits.used)
    : 0;
  const allCallsAllocated = quota
    ? (quota.techSupport.allocated + quota.adSupport.allocated + quota.groupCall.allocated + quota.callCredits.allocated)
    : 0;
  const allCallsRemaining = Math.max(0, allCallsAllocated - allCallsUsed);

  // Revenue derived
  const revGrowth = growthPct(revenue?.revenueGenerated ?? null, revenue?.revenuePrev ?? null);
  const ordersGrowth = growthPct(revenue?.numberOfOrders ?? null, revenue?.ordersPrev ?? null);
  const leadsGrowth = growthPct(revenue?.organicLeads ?? null, revenue?.leadsPrev ?? null);
  const btoRatio = revenue?.adBudgetSpent && revenue?.revenueGenerated
    ? Math.round((revenue.adBudgetSpent / revenue.revenueGenerated) * 1000) / 10
    : null;
  const roasVal = revenue?.roas ?? null;
  const roasBadge = roasVal != null ? (roasVal >= 3 ? "Highly Profitable" : roasVal >= 1.5 ? "Moderate" : "Watch Out") : null;
  const roasBadgeColor = roasVal != null ? (roasVal >= 3 ? "rgba(34,197,94,0.15)" : roasVal >= 1.5 ? "rgba(251,146,60,0.15)" : "rgba(239,68,68,0.15)") : undefined;
  const roasBadgeText = roasVal != null ? (roasVal >= 3 ? "#22c55e" : roasVal >= 1.5 ? "#fb923c" : "#ef4444") : undefined;

  // Journey metrics
  const daysLeft = Math.max(0, (stats?.totalDays ?? 0) - (stats?.daysElapsed ?? 0));
  const totalDays = stats?.totalDays ?? 0;
  const daysElapsed = stats?.daysElapsed ?? 0;
  const attendanceCount = batchData?.attendance?.filter((a: any) => a.status === "present").length ?? 0;

  // CountUp targets
  const dailyHrsCount = useCountUp(dailyHrs, 1200, 2);
  const allCallsUsedCount = useCountUp(allCallsUsed, 900);
  const revenueCount = useCountUp(revenue?.revenueGenerated ?? 0, 1400);
  const leadsGrowthVal = growthPct(revenue?.organicLeads ?? null, revenue?.leadsPrev ?? null);

  // ── Skeleton while loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 pb-10">
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
    <>
      <motion.div
        className="space-y-6 pb-10"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <MentorshipHeader
          programName={programName}
          weeklyReportSubmitted={weeklyReportSubmitted}
          streakDays={streakDays}
          lifelinesTotal={lifelinesTotal}
          lifelinesUsed={lifelinesUsed}
        />

        {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
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

        {/* ── Customer Journey ───────────────────────────────────────────────── */}
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

        {/* ── Expert Support Calls ───────────────────────────────────────────── */}
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
            <SupportCallTile label="Sales Calls"     used={quota?.salesSupport.used ?? 0}   total={quota?.salesSupport.allocated ?? 0} />
            <SupportCallTile label="Tech Calls"      used={quota?.techSupport.used ?? 0}    total={quota?.techSupport.allocated ?? 0} />
            <SupportCallTile label="Content Calls"   used={quota?.contentSupport.used ?? 0} total={quota?.contentSupport.allocated ?? 0} />
            <SupportCallTile label="Marketing Calls" used={quota?.adSupport.used ?? 0}      total={quota?.adSupport.allocated ?? 0} />
            <SupportCallTile label="Mentor 1-On-1"   used={quota?.callCredits.used ?? 0}    total={quota?.callCredits.allocated ?? 0} />
            <SupportCallTile label="Live Group Q&A"  used={quota?.groupCall.used ?? 0}      total={quota?.groupCall.allocated ?? 0} />
          </div>
        </motion.div>

        {/* ── Revenue Stats ──────────────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          className="rounded-2xl p-4"
          style={{ background: "var(--color-bg-surface, #141414)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>
              Your Revenue Stats
            </h2>
            <button
              onClick={() => setRevenueModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: "var(--color-accent)", color: "white" }}
            >
              <Edit3 className="w-3 h-3" />
              {revenue ? "Update Stats" : "Add This Week's Stats"}
            </button>
          </div>

          {!revenue ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3" style={{ color: "var(--color-text-subtle)" }}>
              <BarChart3 className="w-8 h-8 opacity-30" />
              <p className="text-sm">No revenue data for this week yet.</p>
              <button
                onClick={() => setRevenueModalOpen(true)}
                className="text-sm font-semibold inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                style={{ color: "var(--color-accent)" }}
              >
                Add Your Stats <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <RevenueCard
                key={`rev-${revenue.weekNumber}-${revenue.revenueGenerated}`}
                label="Revenue Generated"
                primary={formatINR(revenue.revenueGenerated)}
                sub1={revenue.avgOrderValue != null ? `Avg Order Value ${formatINR(revenue.avgOrderValue)}` : undefined}
                sub2={revenue.numberOfOrders != null ? `Last ${revenue.numberOfOrders} orders` : undefined}
                growth={revGrowth}
              />
              <RevenueCard
                label="Number of Orders"
                primary={revenue.numberOfOrders != null ? `${revenue.numberOfOrders.toLocaleString("en-IN")} Orders` : "—"}
                sub1={btoRatio != null ? `BTO/Revenue: ${btoRatio}%` : undefined}
                badge={btoRatio != null ? (btoRatio < 5 ? "Low Risk" : btoRatio < 20 ? "Moderate" : "High Risk") : undefined}
                badgeColor={btoRatio != null ? (btoRatio < 5 ? "rgba(34,197,94,0.15)" : btoRatio < 20 ? "rgba(251,146,60,0.15)" : "rgba(239,68,68,0.15)") : undefined}
                growth={ordersGrowth}
              />
              <RevenueCard
                label="Ad Budget Spent"
                primary={formatINR(revenue.adBudgetSpent)}
                sub1={revenue.roas != null ? `ROAS ${revenue.roas}×` : undefined}
                sub2={revenue.customerAcqCost != null ? `Customer Acq. Cost ${formatINR(revenue.customerAcqCost)}/c` : undefined}
                badge={roasBadge ?? undefined}
                badgeColor={roasBadgeColor != null ? roasBadgeColor.replace("0.15)", `0.15) color: ${roasBadgeText}`) : undefined}
              />
              <RevenueCard
                label="Organic Inbound Leads"
                primary={revenue.organicLeads != null ? `${revenue.organicLeads.toLocaleString("en-IN")} Leads` : "—"}
                sub1="Free Customers"
                growth={leadsGrowth}
              />
            </div>
          )}
        </motion.div>

        {/* ── Back to Batch Program ──────────────────────────────────────────── */}
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
      </motion.div>

      {/* Revenue edit modal */}
      <AnimatePresence>
        {revenueModalOpen && (
          <RevenueModal
            onClose={() => setRevenueModalOpen(false)}
            initial={{
              revenueGenerated: revenue?.revenueGenerated ?? null,
              revenuePrev: revenue?.revenuePrev ?? null,
              numberOfOrders: revenue?.numberOfOrders ?? null,
              ordersPrev: revenue?.ordersPrev ?? null,
              adBudgetSpent: revenue?.adBudgetSpent ?? null,
              roas: revenue?.roas ?? null,
              customerAcqCost: revenue?.customerAcqCost ?? null,
              organicLeads: revenue?.organicLeads ?? null,
              leadsPrev: revenue?.leadsPrev ?? null,
              avgOrderValue: revenue?.avgOrderValue ?? null,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

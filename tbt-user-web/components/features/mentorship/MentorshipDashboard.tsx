"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  TrendingUp, TrendingDown, ChevronRight, Play, Lock, Plus, Loader2, Coins,
  Instagram, RefreshCw, Unlink,
} from "lucide-react";
import {
  useMentorshipStats, useMentorshipRevenue, useMentorshipRevenueHistory,
  useMentorshipSocial,
  useInstagramStatus, useInstagramConnect, useInstagramDisconnect, useInstagramSync,
} from "@/lib/hooks/useMentorship";
import { CHART_PERIODS, buildPeriodPoints, type ChartPeriod, type PeriodPoint } from "./revenuePeriods";
import { useCourseLifelines, useCourse } from "@/lib/hooks/useCourses";
import { sumLessonDurations, formatSeconds, formatMinutes } from "@/lib/utils/courseDurations";
import { useMyBatchProgram } from "@/lib/hooks/useBatchProgram";
import { useContinueLearning } from "@/lib/hooks/useDashboard";
import { useUserSupportQuota } from "@/lib/hooks/useUser";
import { useSupportCallsSummary } from "@/lib/hooks/useSupportCalls";
import { useCountUp, formatINR, growthPct } from "@/lib/hooks/useCountUp";
import { toast } from "react-hot-toast";
import Link from "next/link";
import SupportCallPanel from "./SupportCallPanel";
import WeeklyActivityGraph from "@/components/features/batch/WeeklyActivityGraph";
import type { SupportCallCategory, SupportCallsSummary } from "@/lib/api/services/supportCalls.service";
import { WinsModal } from "@/components/features/community/WinsModal";

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
  onBuyLifeline,
  buyingLifeline = false,
  lifelinePriceInr = null,
  programVideos = null,
}: {
  programName: string | null;
  weeklyReportSubmitted: boolean;
  streakDays: number;
  lifelinesTotal: number | null;
  lifelinesUsed: number | null;
  /** Starts the Extra Lifeline purchase (Razorpay); each used heart shows a + for it. */
  onBuyLifeline?: () => void;
  buyingLifeline?: boolean;
  /** Admin-configured Extra Lifeline price (credit_pricing), for the button label only. */
  lifelinePriceInr?: number | null;
  /** Required program videos (mentorship stats). The "+" shows only when every one is completed. */
  programVideos?: { total: number; completed: number } | null;
}) {
  // lifelinesTotal = original 3 + any bought (member_batch_settings.lifelines_total);
  // lifelinesUsed = lifelines spent. Remaining = total − used (never below 0).
  const totalHearts = lifelinesTotal ?? 0;
  const filledHearts = lifelinesTotal != null ? Math.min(totalHearts, Math.max(0, lifelinesTotal - (lifelinesUsed ?? 0))) : 0;
  // A single "+" — shown only once the member has completed EVERY required
  // program video (backend programVideos). Not tied to the lifeline balance;
  // hidden while loading, when the field is missing, or with zero required videos.
  const allProgramVideosDone =
    programVideos != null &&
    Number.isFinite(programVideos.total) &&
    programVideos.total > 0 &&
    programVideos.completed === programVideos.total;
  const showBuy = !!onBuyLifeline && totalHearts > 0 && allProgramVideosDone;
  const buyLabel = `Buy an extra lifeline${lifelinePriceInr != null ? ` for ₹${lifelinePriceInr}` : ""}`;

  return (
    <motion.div variants={fadeUp} className="flex flex-wrap sm:flex-nowrap items-center gap-2 mb-5">
      <h2 className="flex-1 min-w-0 line-clamp-2 sm:truncate" style={{ fontSize: 22, fontWeight: 600, color: "#f5f5f7", lineHeight: 1.2 }}>
        {programName ?? "Mentorship Program"}
      </h2>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {weeklyReportSubmitted && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full" style={{ background: "#242428", color: "#f5f5f7" }}>
            ✅ Weekly Report Submitted
          </span>
        )}
        {totalHearts > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full" style={{ background: "#d70b1a", padding: "6px 12px" }}>
            {Array.from({ length: filledHearts }).map((_, i) => (
              <span key={i} style={{ fontSize: 12 }}>❤️</span>
            ))}
            {Array.from({ length: totalHearts - filledHearts }).map((_, i) => (
              <span key={`e-${i}`} style={{ fontSize: 12, opacity: 0.4 }}>🤍</span>
            ))}
            {showBuy && (
              <button
                type="button"
                onClick={onBuyLifeline}
                disabled={buyingLifeline}
                aria-label={buyLabel}
                aria-busy={buyingLifeline || undefined}
                title={buyLabel}
                data-lifeline-buy
                className="inline-flex items-center justify-center rounded-full transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-wait focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                style={{ width: 16, height: 16, marginLeft: 2, background: "rgba(255,255,255,0.25)", color: "#fff", outlineColor: "#fff" }}
              >
                {buyingLifeline ? <Loader2 size={10} strokeWidth={3} className="animate-spin" aria-hidden /> : <Plus size={11} strokeWidth={3} aria-hidden />}
              </button>
            )}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function KpiCard({
  label,
  rightLabel,
  value,
  metricColor = "#f5f5f7",
  note,
  onClick,
}: {
  label: string;
  rightLabel?: string;
  value: string;
  metricColor?: string;
  note?: string;
  onClick?: () => void;
}) {
  const isEmpty = value === "—";
  return (
    <motion.div
      variants={fadeUp}
      className="mentorship-kpi-card relative rounded-[10px] overflow-hidden"
      style={{ background: "#242428", padding: 12, height: 63, cursor: onClick ? "pointer" : undefined }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
        <span className="truncate" style={{ color: "#d0cfd4", fontSize: 10, fontWeight: 500, lineHeight: 1.2 }}>{label}</span>
        {rightLabel && <span className="shrink-0 ml-1" style={{ color: "#d0cfd4", fontSize: 7, fontWeight: 500 }}>{rightLabel}</span>}
      </div>
      <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.35, letterSpacing: "-0.5px", color: metricColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
      {note && !isEmpty && (
        <span className="absolute" style={{ right: 10, bottom: 8, fontSize: 7, color: "#20d6a1", fontWeight: 500 }}>
          {note}
        </span>
      )}
      {onClick && isEmpty && (
        <span className="absolute" style={{ left: 12, bottom: 8, fontSize: 7, color: "#818cf8", fontWeight: 600 }}>
          Tap to add →
        </span>
      )}
    </motion.div>
  );
}

function JourneyTile({
  label,
  rightLabel,
  value,
  muted,
  metricColor = "#809ed5",
  note,
  leaderboard,
  onClick,
}: {
  label: string;
  rightLabel?: string;
  value: string;
  muted?: string;
  metricColor?: string;
  note?: string;
  leaderboard?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className="relative rounded-[10px] w-full text-left"
      style={{
        background: leaderboard ? "#292812" : "#242428",
        padding: "9px 12px",
        height: 53,
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 1 }}>
        <span className="truncate" style={{ color: "#d0cfd4", fontSize: 9, fontWeight: 500, lineHeight: 1.2 }}>{label}</span>
        {rightLabel && <span className="shrink-0 ml-1" style={{ color: "#ff313b", fontSize: 7, fontWeight: 600 }}>{rightLabel}</span>}
      </div>
      <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.2, color: metricColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
        {muted && <span style={{ color: "#93939b", fontWeight: 400 }}>{muted}</span>}
      </div>
      {note && (
        <span className="absolute" style={{ bottom: 9, right: 9, fontSize: 7, color: "#20d6a1", fontWeight: 500 }}>
          {note}
        </span>
      )}
    </Tag>
  );
}

type CallCard = SupportCallsSummary["categories"][number];

/** The card's next step, exactly as the server decided it. */
function callCardHint(card: CallCard | undefined): { text: string; color: string; locked: boolean } | null {
  if (!card) return null;
  switch (card.action) {
    case "book":
      return { text: `${card.quota.remaining} free · Book Call`, color: "#22c55e", locked: false };
    case "unlock_with_coins":
      return { text: `${card.coinCost} coins · Unlock Extra Call`, color: "#eab308", locked: false };
    case "purchase_coins":
      return { text: `Buy Coins to Unlock`, color: "#eab308", locked: false };
    default:
      if (card.lockedReason === "not_included") {
        // Not in plan at all — tile is non-interactive.
        return { text: "Not in your plan", color: "#93939b", locked: true };
      }
      // quota_exhausted — still clickable so user can open the coin purchase panel.
      return {
        text: card.coinCost != null ? `${card.coinCost} coins · Extra Call` : "Limit reached · Tap for options",
        color: "#eab308",
        locked: false,
      };
  }
}

function SupportCallTile({ label, used: quotaUsed, total: quotaTotal, card, onClick }: { label: string; used: number; total: number; card?: CallCard; onClick: () => void }) {
  // Counts and the next-step hint come from the same server response when it's loaded, so they never disagree.
  const used = card?.quota.used ?? quotaUsed;
  const total = card?.quota.allocated ?? quotaTotal;
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const hint = callCardHint(card);
  // Only truly non-interactive when not in plan at all (not_included).
  // quota_exhausted tiles stay clickable — the panel handles coin purchase and shows
  // an "extra calls not configured" message if no coin price has been set by the admin.
  const fullyLocked = card?.action === "locked" && card?.lockedReason === "not_included";
  return (
    <button
      type="button"
      onClick={fullyLocked ? undefined : onClick}
      disabled={fullyLocked}
      aria-haspopup={fullyLocked ? undefined : "dialog"}
      aria-label={`${label}: ${used} of ${total} calls completed.${hint ? ` ${hint.text}.` : ""}`}
      data-call-action={card?.action}
      className={`relative block w-full text-left rounded-[10px] transition-[filter] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#809ed5] ${fullyLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:brightness-110"}`}
      style={{ background: "#242428", padding: "10px 12px", minHeight: 53 }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 1 }}>
        <span className="truncate" style={{ color: "#d0cfd4", fontSize: 9, fontWeight: 500, lineHeight: 1.2 }}>{label}</span>
        {total > 0 && (
          <span className="shrink-0 ml-1" style={{ color: "#ff313b", fontSize: 7, fontWeight: 600 }}>{pct}%</span>
        )}
      </div>
      <div style={{ fontSize: 23, fontWeight: 700, lineHeight: 1.2, color: "#809ed5" }}>
        {used}
        <span style={{ color: "#93939b", fontWeight: 400 }}>/{total}</span>
      </div>
      {hint && (
        <div className="flex items-center gap-1 truncate" style={{ color: hint.color, fontSize: 9, fontWeight: 600, marginTop: 2 }}>
          {hint.locked
            ? <Lock size={9} className="shrink-0" aria-hidden="true" />
            : (card?.action === "unlock_with_coins" || card?.action === "purchase_coins")
              ? <Coins size={9} className="shrink-0" aria-hidden="true" />
              : null}
          <span className="truncate">{hint.text}</span>
        </div>
      )}
    </button>
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl animate-pulse ${className ?? ""}`} style={{ background: "rgba(255,255,255,0.05)", minHeight: 90 }} />
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
    ? (btoRatio < 15 ? "Low Risk" : btoRatio < 30 ? "Moderate" : "High Risk") : null;
  const btoColor = btoRatio != null
    ? (btoRatio < 15 ? "#22c55e" : btoRatio < 30 ? "#fb923c" : "#ef4444") : null;
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
        <span className="text-[9px] font-bold uppercase tracking-wide sm:tracking-widest leading-tight" style={{ color: "var(--color-text-subtle)" }}>{label}</span>
        {topRight}
      </div>
      <div className="text-2xl sm:text-3xl font-black tracking-tight leading-none" style={{ color: mainColor }}>{main}</div>
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
  labels,
  tips,
  peakTags,
  peakKind,
}: {
  revData: (number | null)[];
  ordData: (number | null)[];
  /** x-axis label per point */
  labels: string[];
  /** tooltip heading per point */
  tips: string[];
  /** short name per point for the peak callout, e.g. "SAT", "W42", "OCT 2026" */
  peakTags: string[];
  /** "DAY" | "WEEK" | "MONTH" | "YEAR" */
  peakKind: string;
}) {
  const displayRev = revData;
  const displayOrd = ordData;
  const n = revData.length;

  // Draw at the container's real width (1 unit = 1px) so the plot fills the card
  // instead of letterboxing a fixed 700-wide canvas. Below 360 it scales down so
  // the x-axis labels never overlap.
  const svgRef = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(700);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setW(Math.max(w, 360));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 200;
  const PL = 58, PR = 16, PT = 20, PB = 32;
  const PW = W - PL - PR;
  const PH = H - PT - PB;

  const nums = (a: (number | null)[]) => a.filter((v): v is number => v != null);
  const maxRev = Math.max(...nums(displayRev), 1);
  const maxOrd = Math.max(...nums(displayOrd), 1);

  const xOf = (i: number) => PL + (n > 1 ? i / (n - 1) : 0.5) * PW;
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

  // Peak = the point with the best revenue. The callout sits on the displayed line.
  const dailyRevNums = nums(revData);
  const peakIdx = dailyRevNums.length ? revData.indexOf(Math.max(...dailyRevNums)) : -1;
  const peakDisplay = peakIdx >= 0 ? displayRev[peakIdx] : null;
  const peakX = peakIdx >= 0 ? xOf(peakIdx) : 0;
  // Callout box: wide enough for its title, kept inside the plot (the newest point sits on the right edge).
  const peakTitle = peakIdx >= 0 ? `PEAK ${peakKind} (${peakTags[peakIdx]})` : "";
  const peakBoxW = Math.max(88, Math.round(peakTitle.length * 4.6 + 12));
  const peakBoxX = Math.min(Math.max(peakX, PL + peakBoxW / 2), W - PR - peakBoxW / 2);
  const peakY = peakDisplay != null ? yRev(peakDisplay) : 0;

  const fmtY = (v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`;

  // Pointer → nearest point column (SVG units match CSS px; scaled if the box differs).
  const onPointer = (e: React.PointerEvent<SVGRectElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const x = ((e.clientX - box.left) / box.width) * W;
    setHoverIdx(n > 1 ? Math.min(n - 1, Math.max(0, Math.round(((x - PL) / PW) * (n - 1)))) : 0);
  };
  const tipW = Math.max(112, ...tips.map((t) => t.length * 5 + 16));
  const tipX = hoverIdx != null ? Math.min(Math.max(xOf(hoverIdx) - tipW / 2, PL), W - PR - tipW) : 0;
  // Many points (Overall): label every k-th, counted back from the latest so it is always labelled.
  const labelStep = Math.max(1, Math.ceil(n / 8));

  // Y-axis ticks (4 levels)
  const yTicks = [0, 0.33, 0.67, 1].map(p => ({
    val: Math.round(maxRev * p),
    y: PT + (1 - p) * PH,
  }));

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Weekly revenue and order trajectory">
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
          <rect x={peakBoxX - peakBoxW / 2} y={peakY - 36} width={peakBoxW} height={30} rx={6} fill="#1e1e1e" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <text x={peakBoxX} y={peakY - 22} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" fontWeight="600">
            {peakTitle}
          </text>
          <text x={peakBoxX} y={peakY - 11} textAnchor="middle" fontSize="10" fill="var(--color-accent)" fontWeight="800">
            ₹{(revData[peakIdx] as number).toLocaleString("en-IN")}
          </text>
          {ordData[peakIdx] != null && (
            <text x={peakBoxX} y={peakY - 1} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.4)">
              {ordData[peakIdx]} Orders
            </text>
          )}
        </g>
      )}

      {/* Hover: guide line + tooltip for the nearest day */}
      {hoverIdx != null && (
        <g data-testid="chart-tooltip" pointerEvents="none">
          <line x1={xOf(hoverIdx)} y1={PT} x2={xOf(hoverIdx)} y2={PT + PH} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
          {displayRev[hoverIdx] != null && (
            <circle cx={xOf(hoverIdx)} cy={yRev(displayRev[hoverIdx] as number)} r="5" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
          )}
          <rect x={tipX} y={PT} width={tipW} height={46} rx={6} fill="#1e1e1e" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <text x={tipX + 8} y={PT + 13} fontSize="9" fill="rgba(255,255,255,0.55)" fontWeight="700">
            {tips[hoverIdx]}
          </text>
          <text x={tipX + 8} y={PT + 27} fontSize="10" fill="var(--color-accent)" fontWeight="800">
            {displayRev[hoverIdx] != null ? `₹${(displayRev[hoverIdx] as number).toLocaleString("en-IN")}` : "No revenue saved"}
          </text>
          <text x={tipX + 8} y={PT + 40} fontSize="9" fill="#eab308">
            {displayOrd[hoverIdx] != null ? `${displayOrd[hoverIdx]} orders` : "No orders saved"}
          </text>
        </g>
      )}

      {/* Pointer capture over the plot area (drawn last so it receives hover) */}
      <rect
        x={PL - 12}
        y={PT}
        width={PW + 24}
        height={PH}
        fill="transparent"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHoverIdx(null)}
        style={{ cursor: "crosshair" }}
      />

      {/* X-axis labels */}
      {labels.map((label, i) => (n - 1 - i) % labelStep === 0 && (
        <text key={i} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)" fontWeight={i === peakIdx ? "700" : "400"}>
          {label}
        </text>
      ))}
    </svg>
  );
}

const PEAK_KIND: Record<ChartPeriod, string> = { daily: "DAY", weekly: "WEEK", monthly: "MONTH", yearly: "YEAR", overall: "WEEK" };

function WeeklyChartSection({ revenue }: { revenue: any }) {
  const [period, setPeriod] = useState<ChartPeriod>("overall");
  const [showPeriodHint, setShowPeriodHint] = useState(false);
  const weekDays = weekDaysFor(revenue);
  // Longer periods read every saved week; Daily keeps using this week's saved days.
  const history = useMentorshipRevenueHistory(period !== "daily");

  const points: PeriodPoint[] = period === "daily"
    ? (() => {
        const rev = toSeries(revenue?.dailyRevenue);
        const ord = toSeries(revenue?.dailyOrders);
        return weekDays.map((d, i) => ({ label: `${d.label}(${d.day})`, tip: `${d.label} (${d.day})`, rev: rev[i] ?? null, ord: ord[i] ?? null }));
      })()
    : history.data ? buildPeriodPoints(period, history.data.weeks, history.data.currentWeek) : [];
  const revData = points.map(p => p.rev);
  const ordData = points.map(p => p.ord);
  const hasData = revData.some(v => v != null) || ordData.some(v => v != null);
  const periodLabel = CHART_PERIODS.find(p => p.value === period)!.label;
  const subtitle = period === "daily"
    ? `${weekDays[0]?.label} ${weekDays[0]?.day} – ${weekDays[6]?.label} ${weekDays[6]?.day}`
    : points.length ? `${(period === "monthly" || period === "yearly" ? points[0].tip : points[0].label)} – ${(period === "monthly" || period === "yearly" ? points[points.length - 1].tip : points[points.length - 1].label)}` : null;
  const emptyText = period === "daily"
    ? "No daily revenue saved for this week yet"
    : history.isLoading ? "Loading…"
    : history.isError ? "Couldn't load your revenue history"
    : "No revenue saved for this period yet";

  return (
    <motion.div variants={fadeUp} className="rounded-2xl p-4" style={{ background: "var(--color-bg-surface, #141414)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex flex-wrap items-start justify-between mb-1 gap-3">
        <div>
          <h2 className="text-sm font-bold" style={{ color: "var(--color-text-normal)" }}>Weekly Revenue & Order Trajectory</h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle)" }}>
              Comparative trendline for {subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex items-center gap-2 mr-3">
            <span className="flex items-center gap-1 text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              <span className="inline-block w-5 h-0.5 rounded" style={{ background: "var(--color-accent)" }} /> {periodLabel} Revenue (₹)
            </span>
            <span className="flex items-center gap-1 text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              <span className="inline-block w-5 border-t border-dashed border-yellow-400" /> Order Velocity
            </span>
          </div>
          <div className="relative">
            <select
              aria-label="Chart period"
              value={period}
              onChange={e => { setPeriod(e.target.value as ChartPeriod); setShowPeriodHint(true); }}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all outline-none cursor-pointer"
              style={{ background: "var(--color-accent)", color: "white" }}
            >
              {CHART_PERIODS.map(p => (
                <option key={p.value} value={p.value} style={{ background: "var(--color-bg-surface, #141414)", color: "var(--color-text-normal)" }}>{p.label}</option>
              ))}
            </select>
            {showPeriodHint && period !== "overall" && (
              <p className="absolute right-0 top-full mt-1 text-[9px] whitespace-nowrap" style={{ color: "var(--color-text-subtle)" }}>
                Switch back to Overall anytime
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative mt-3 rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.2)" }}>
        {hasData ? (
          <WeeklyLineChart
            key={period}
            revData={revData}
            ordData={ordData}
            labels={points.map(p => p.label)}
            tips={points.map(p => p.tip)}
            peakTags={period === "daily" ? weekDays.map(d => d.label.toUpperCase()) : points.map(p => (period === "monthly" ? p.tip : p.label).toUpperCase())}
            peakKind={PEAK_KIND[period]}
          />
        ) : (
          <div className="flex items-center justify-center" style={{ height: 200 }}>
            <p className="text-[11px]" style={{ color: "var(--color-text-subtle)" }}>{emptyText}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}


// ─── Process status helper (shared by NowLearning + SocialGrowth) ───────────

function calcProcessStatus(proc: any, programTasks: any[], mySubmissions: any[]): "completed" | "active" | "locked" {
  const tasks = programTasks
    .filter((t: any) => t.processId === proc.id)
    .sort((a: any, b: any) => a.stagePosition - b.stagePosition);
  if (tasks.length === 0) return "locked";
  if (tasks[0]?.stageLocked) return "locked";
  const allApproved = tasks.every((t: any) =>
    mySubmissions.some((s: any) => s.taskId === t.id && s.status === "approved")
  );
  return allApproved ? "completed" : "active";
}

// ─── Part 2 — Social Media Organic Growth ────────────────────────────────────


function SocialGrowthSection() {
  const { data: social } = useMentorshipSocial();
  const { data: igStatus } = useInstagramStatus();
  const igConnect = useInstagramConnect();
  const igDisconnect = useInstagramDisconnect();
  const igSync = useInstagramSync();

  // Show toast when redirected back after connecting/error
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ig = params.get("instagram");
    if (!ig) return;
    if (ig === "connected") toast.success("Instagram connected! Your stats are now auto-syncing.");
    if (ig === "error") {
      const reason = params.get("reason") ?? "unknown";
      toast.error(`Instagram connection failed: ${reason}`);
    }
    // Remove params from URL without reload
    params.delete("instagram");
    params.delete("reason");
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", newUrl);
  }, []);




  // ── Display values from saved social data ───────────────────────────────────
  const followers      = social?.totalFollowers ?? null;
  const followersPrev  = social?.followersPrev ?? null;
  const videoViews     = social?.videoViews ?? null;
  const videoViewsPrev = social?.videoViewsPrev ?? null;
  const contentUploads = social?.contentUploads ?? null;
  const contentTarget  = social?.contentUploadTarget ?? 7;
  const interactions   = social?.interactions ?? null;
  const interactionsPrev = social?.interactionsPrev ?? null;
  const dmLeads        = social?.dmLeads ?? null;
  const bioClicks      = social?.bioLinkClicks ?? null;
  const bioClicksPrev  = social?.bioLinkClicksPrev ?? null;

  const followersGrowth    = growthPct(followers, followersPrev);
  const videoGrowth        = growthPct(videoViews, videoViewsPrev);
  const interactionsGrowth = growthPct(interactions, interactionsPrev);
  const bioGrowth          = growthPct(bioClicks, bioClicksPrev);
  const contentPct         = contentUploads != null && contentTarget > 0 ? Math.round((contentUploads / contentTarget) * 100) : null;
  const targetPace         = contentPct ?? 0;




  // ── Read-only display card ───────────────────────────────────────────────────
  const displayCard = (label: string, value: string, sub: React.ReactNode) => (
    <div
      className="rounded-xl p-3.5 flex flex-col gap-1.5"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>{label}</p>
      <p className="text-xl font-extrabold text-white leading-none">{value}</p>
      <div className="mt-0.5">{sub}</div>
    </div>
  );

  const staticBadge = (text: string) => (
    <span className="text-[10px] font-semibold" style={{ color: "var(--color-text-subtle)" }}>{text}</span>
  );

  return (
    <motion.div variants={fadeUp} className="space-y-4">
      {/* ── Social Growth display card ──────────────────────────────── */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--color-bg-surface, #141414)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-bold" style={{ color: "var(--color-text-normal)" }}>Social Media Organic Growth</h2>
            {igStatus?.connected && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "rgba(129,140,248,0.15)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.25)" }}>
                <Instagram size={8} /> Auto-sync ON
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{
                background: targetPace >= 100 ? "rgba(34,197,94,0.15)" : targetPace >= 50 ? "rgba(129,140,248,0.15)" : "rgba(255,255,255,0.05)",
                color:      targetPace >= 100 ? "#22c55e"               : targetPace >= 50 ? "#818cf8"                : "rgba(255,255,255,0.4)",
                border: `1px solid ${targetPace >= 100 ? "rgba(34,197,94,0.2)" : targetPace >= 50 ? "rgba(129,140,248,0.2)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: targetPace >= 100 ? "#22c55e" : targetPace >= 50 ? "#818cf8" : "rgba(255,255,255,0.3)" }} />
              Target Pace: {targetPace}%
            </span>
          </div>
        </div>

        {/* Instagram connection banner */}
        {igStatus?.connected ? (
          <div
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 mb-4"
            style={{ background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.18)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Instagram size={14} style={{ color: "#818cf8", flexShrink: 0 }} />
              <span className="text-[11px] font-semibold truncate" style={{ color: "#818cf8" }}>
                @{(igStatus as any).username}
              </span>
              {(igStatus as any).syncedAt && (
                <span className="text-[10px] hidden sm:inline" style={{ color: "rgba(255,255,255,0.3)" }}>
                  · synced {new Date((igStatus as any).syncedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => igSync.mutate()}
                disabled={igSync.isPending}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: "rgba(129,140,248,0.15)", color: "#818cf8" }}
                title="Sync now"
              >
                <RefreshCw size={11} className={igSync.isPending ? "animate-spin" : ""} />
                {igSync.isPending ? "Syncing…" : "Sync"}
              </button>
              <button
                onClick={() => igDisconnect.mutate()}
                disabled={igDisconnect.isPending}
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}
                title="Disconnect Instagram"
              >
                <Unlink size={11} />
              </button>
            </div>
          </div>
        ) : igStatus?.enabled !== false ? (
          <div
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 mb-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Instagram size={14} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                Connect Instagram to auto-sync your stats weekly
              </span>
            </div>
            <button
              onClick={() => igConnect.mutate()}
              disabled={igConnect.isPending}
              className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", color: "#fff" }}
            >
              <Instagram size={12} />
              {igConnect.isPending ? "Redirecting…" : "Connect"}
            </button>
          </div>
        ) : null}

        {/* Read-only metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {displayCard("Total Followers",   followers  != null ? fmtK(followers)          : "—", <GrowthBadge value={followersGrowth} />)}
          {displayCard("Video Views",       videoViews != null ? fmtK(videoViews)         : "—", <GrowthBadge value={videoGrowth} />)}
          {displayCard("Content Uploads",   contentUploads != null ? `${contentUploads}/${contentTarget}` : "—", staticBadge("Weekly Quota"))}
          {displayCard("Interactions",      interactions != null ? fmtK(interactions)     : "—", <GrowthBadge value={interactionsGrowth} />)}
          {displayCard("Inbound DM Leads",  dmLeads    != null ? String(dmLeads)          : "—", staticBadge("Organic"))}
          {displayCard("Bio Link Clicks",   bioClicks  != null ? String(bioClicks)        : "—", <GrowthBadge value={bioGrowth} />)}
        </div>
      </div>

    </motion.div>
  );
}

// ─── Now Learning ─────────────────────────────────────────────────────────────

function NowLearningSection() {
  const { data: items }     = useContinueLearning();
  const { data: batchData } = useMyBatchProgram();

  const item = (items as any[] | undefined)?.find((i: any) => !i.isCompleted) ?? (items as any[] | undefined)?.[0] ?? null;

  // Fetch full course detail to compute durations when the server returns null
  const { data: courseDetail } = useCourse(item?.type === "course" ? ((item as any).id as string ?? "") : "");
  const durationDisplay: string | null = (() => {
    if ((item as any)?.durationDisplay) return (item as any).durationDisplay as string;
    if (!courseDetail?.lessons) return null;
    const { videoSeconds } = sumLessonDurations(courseDetail.lessons);
    return formatSeconds(videoSeconds);
  })();
  const taskDurationDisplay: string | null = (() => {
    if ((item as any)?.taskDurationDisplay) return (item as any).taskDurationDisplay as string;
    if (!courseDetail?.lessons) return null;
    const { taskMinutes } = sumLessonDurations(courseDetail.lessons);
    return formatMinutes(taskMinutes);
  })();

  const processes: any[]     = batchData?.processes ?? [];
  const programTasks: any[]  = batchData?.programTasks ?? [];
  const mySubmissions: any[] = batchData?.mySubmissions ?? [];

  if (!item && processes.length === 0) return null;

  const progressPct = item
    ? (item.progressPercent ?? (item.durationSeconds > 0 ? Math.round((item.lastWatchedSecs / item.durationSeconds) * 100) : 0))
    : 0;
  const courseBase = item ? (item.type === "course" ? `/learning/${item.id}` : `/workshop/${item.id}`) : "#";
  const lessonHref = item ? (item.type === "course" ? `${courseBase}?lesson=${item.lessonId}` : courseBase) : "#";
  const nextLesson = item
    ? ((item.episodeOrder as number) < (item.episodeCount as number) ? `Lesson ${(item.episodeOrder as number) + 1}` : null)
    : null;

  return (
    <motion.div variants={fadeUp}>

      {/* ── Task cards row ────────────────────────────────────────────── */}
      {processes.length > 0 && (
        <div className="flex gap-[10px] overflow-x-auto mb-[25px]" style={{ scrollbarWidth: "none" }}>
          {processes.map((proc: any) => {
            const s = calcProcessStatus(proc, programTasks, mySubmissions);
            const iconBg = s === "completed" ? "#48b653" : s === "active" ? "#ff2850" : "#55565d";
            const icon   = s === "completed" ? "✓" : s === "active" ? "!" : "";
            return (
              <div
                key={proc.id}
                className="shrink-0 flex items-center gap-[10px]"
                style={{ height: 53, minWidth: 225, flex: "1 0 225px", padding: "9px 12px", background: "#242428", borderRadius: 7 }}
              >
                <div
                  className="shrink-0 flex items-center justify-center"
                  style={{ width: 27, height: 27, borderRadius: "50%", background: iconBg, color: "white", fontSize: 15, fontWeight: 700 }}
                >
                  {icon}
                </div>
                <div className="min-w-0">
                  <div style={{ color: "#92929b", fontSize: 10, marginBottom: 2 }}>Tasks</div>
                  <div className="truncate" style={{ fontSize: 15, fontWeight: 500, color: "#f5f5f7" }}>{proc.title}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Now Learning content ──────────────────────────────────────── */}
      {item && (
        <>
          <h2 style={{ margin: "0 0 18px", fontSize: 22, fontWeight: 500, color: "#f5f5f7" }}>Now Learning</h2>

          {/* 3-column grid: thumbnail | details | next lesson */}
          <div
            className="flex flex-col lg:grid gap-[24px] lg:px-8"
            style={{ gridTemplateColumns: "240px 1fr 110px", alignItems: "center" }}
          >
            {/* ── Column 1: course cover thumbnail ─── */}
            <div
              className="relative flex flex-col items-center justify-center text-center overflow-hidden"
              style={{
                height: 160,
                padding: 12,
                borderRadius: 13,
                background: "radial-gradient(ellipse at center, #10283b 0%, #071521 58%, #020508 100%)",
              }}
            >
              {/* grid pattern */}
              <div style={{ position: "absolute", inset: 0, opacity: 0.22, background: "repeating-linear-gradient(25deg, transparent 0, transparent 18px, #42617b 19px, transparent 20px), repeating-linear-gradient(110deg, transparent 0, transparent 28px, #42617b 29px, transparent 30px)" }} />
              {/* brand */}
              <div style={{ position: "absolute", top: 8, right: 9, zIndex: 1, color: "white", fontSize: 7, fontWeight: 800 }}>
                ✦ TBT BUSINESS
              </div>
              {/* chapter */}
              <div style={{ position: "relative", zIndex: 1, width: 79, padding: 3, marginBottom: 14, background: "#321b1d", border: "1px solid #49292c", borderRadius: 5, color: "#ddd", fontSize: 6, textAlign: "center" }}>
                Lesson {item.episodeOrder}
              </div>
              {/* course title */}
              <div style={{ position: "relative", zIndex: 1, color: "white", fontSize: 20, fontWeight: 500, lineHeight: 1.12, letterSpacing: "-0.6px", padding: "0 8px" }}>
                {item.title}
              </div>
              {/* website */}
              <div style={{ position: "relative", zIndex: 1, marginTop: 13, color: "#c5cbd0", fontSize: 5, letterSpacing: "1.5px" }}>
                WWW.TAMILBUSINESSTRIBE.COM
              </div>
            </div>

            {/* ── Column 2: course details ─── */}
            <div className="min-w-0">
              <div style={{ marginBottom: 9, color: "#b3b3bb", fontSize: 11 }}>
                {item.title} · Lesson {item.episodeOrder} of {item.episodeCount}
              </div>
              <div style={{ marginBottom: 12, fontSize: 15, fontWeight: 500, lineHeight: 1.4, color: "#f5f5f7" }}>
                {item.lastLessonTitle ?? item.title}
              </div>
              <div className="flex flex-wrap gap-[13px]" style={{ marginBottom: 17, color: "#85858e", fontSize: 13 }}>
                <span>Module Duration - <strong style={{ color: "#ededf0", fontWeight: 500 }}>{durationDisplay ?? "—"}</strong></span>
                <span>Task Duration - <strong style={{ color: "#ededf0", fontWeight: 500 }}>{taskDurationDisplay ?? "—"}</strong></span>
              </div>
              <div style={{ marginBottom: 17 }}>
                <div style={{ width: "100%", height: 18, overflow: "hidden", background: "#39393f", borderRadius: 12 }}>
                  <div style={{ width: `${Math.min(100, progressPct)}%`, height: "100%", borderRadius: 12, background: "#d91019", transition: "width 1.1s cubic-bezier(0.4,0,0.2,1)" }} />
                </div>
              </div>
              <Link href={lessonHref}>
                <button style={{ height: 33, padding: "0 25px", border: "none", borderRadius: 9, background: "#ffe000", color: "#090909", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  ► Continue Learning
                </button>
              </Link>
            </div>

            {/* ── Column 3: next lesson ─── */}
            <div className="hidden lg:block">
              <div style={{ marginBottom: 7, color: "#d9d900", fontSize: 11 }}>Next Lesson</div>
              <div
                style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 91, height: 53, overflow: "hidden", marginBottom: 7, border: "1px solid #39393e", borderRadius: 9, background: "linear-gradient(135deg, #111114, #050506)" }}
              >
                {item.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnailUrl as string} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3 }} />
                )}
                <Lock className="w-4 h-4" style={{ position: "relative", zIndex: 1, color: "rgba(255,255,255,0.5)" }} />
              </div>
              {nextLesson && (
                <div style={{ marginBottom: 7, color: "#b9b9c0", fontSize: 9, lineHeight: 1.45 }}>{nextLesson}</div>
              )}
              <Link href={courseBase} style={{ color: "white", fontSize: 11, textDecoration: "underline" }}>
                View Full Module
              </Link>
            </div>

          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MentorshipDashboard({ showBackLink = false, titleOverride = null, courseId = null }: { showBackLink?: boolean; titleOverride?: string | null; courseId?: string | null }) {
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useMentorshipStats();
  const { data: batchData, isLoading: batchLoading } = useMyBatchProgram();
  const { data: quota, isLoading: quotaLoading, isError: quotaError, refetch: refetchQuota } = useUserSupportQuota();
  // Next action per call card (Book / Unlock with coins / Purchase coins / locked); optional overlay on the counts.
  const { data: callSummary } = useSupportCallsSummary();
  const cardFor = (category: SupportCallCategory) => callSummary?.categories.find((c) => c.category === category);
  const { data: revenue } = useMentorshipRevenue();
  const [openCall, setOpenCall] = useState<{ category: SupportCallCategory; label: string } | null>(null);
  const [winsOpen, setWinsOpen] = useState(false);
  const closeCallPanel = useCallback(() => setOpenCall(null), []);
  const handleCallTileClick = useCallback(
    (category: SupportCallCategory, label: string) => {
      setOpenCall({ category, label });
    },
    [],
  );

  const isLoading = statsLoading || batchLoading || quotaLoading;

  const programName = stats?.programName ?? batchData?.batch?.program?.name ?? batchData?.batch?.name ?? null;
  const streakDays = stats?.streakDays ?? 0;
  const weeklyReportSubmitted = stats?.weeklyReportSubmitted ?? false;
  // Course-scoped lifelines — use the courseId passed from the courses page (primaryCourseId).
  // This is the same courseId the video player uses, so the counts always match.
  const { data: courseLifelines } = useCourseLifelines(courseId);
  const lifelinesTotal: number | null =
    courseLifelines != null ? courseLifelines.freeTotal + courseLifelines.purchasedTotal : null;
  const lifelinesUsed: number | null =
    courseLifelines != null ? courseLifelines.freeUsed + courseLifelines.purchasedUsed : null;

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
  // Tier Access counts days the member was actually active in the program (one per
  // program calendar day), not calendar days since the batch started.
  const activeDays = stats?.activeDays ?? 0;

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
        programName={titleOverride ?? programName}
        weeklyReportSubmitted={weeklyReportSubmitted}
        streakDays={streakDays}
        lifelinesTotal={lifelinesTotal}
        lifelinesUsed={lifelinesUsed}
        programVideos={stats?.programVideos ?? null}
      />

      {/* ── KPI Strip ────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Daily Time Spent"
          value={`${dailyHrsCount} hrs`}
          metricColor="#f5f5f7"
          note={dailyGrowth != null ? `${dailyGrowth >= 0 ? "+" : ""}${dailyGrowth}% vs goal` : undefined}
        />
        <KpiCard
          label="Support Delivered"
          value={`${allCallsUsedCount} Calls`}
          metricColor="#bd82ff"
          note={allCallsAllocated > 0 ? `${allCallsUsed}/${allCallsAllocated} Total` : undefined}
        />
        <KpiCard
          label="Revenue Generated"
          rightLabel={revenue?.numberOfOrders ? `${revenue.numberOfOrders}+ Orders` : undefined}
          value={revenue?.revenueGenerated != null ? `₹${revenueCount}` : "—"}
          metricColor="#ffe600"
          note={
            revenue?.revenueGenerated != null && revenue?.numberOfOrders
              ? `Avg ₹${Math.round(revenue.revenueGenerated / revenue.numberOfOrders).toLocaleString("en-IN")}/order`
              : revGrowth != null
                ? `${revGrowth >= 0 ? "+" : ""}${revGrowth}% vs prev`
                : undefined
          }
        />
        <KpiCard
          label="Organic Growth"
          value={leadsGrowthVal != null ? `${leadsGrowthVal >= 0 ? "+" : ""}${leadsGrowthVal}%` : "—"}
          metricColor={leadsGrowthVal != null ? (leadsGrowthVal >= 0 ? "#df72c9" : "#ff313b") : "#df72c9"}
          note={revenue?.leadsPrev != null ? `prev: ${revenue.leadsPrev} leads` : undefined}
        />
      </motion.div>

      {/* ── Expert Support Calls ─────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold" style={{ color: "var(--color-text-normal)" }}>Expert Support Calls</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "#202024", color: "#f5f5f7" }}
            >
              🔴 {allCallsUsed}/{allCallsAllocated} Completed
            </span>
            <span
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "#202024", color: "#f5f5f7" }}
            >
              🟣 {allCallsRemaining} Quota Remaining
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SupportCallTile label="☎ Sales Calls"     used={quota.salesSupport.used}   total={quota.salesSupport.allocated} card={cardFor("sales_support")}   onClick={() => handleCallTileClick("sales_support",   "☎ Sales Calls")} />
          <SupportCallTile label="⚙ Tech Calls"      used={quota.techSupport.used}    total={quota.techSupport.allocated} card={cardFor("tech_support")}    onClick={() => handleCallTileClick("tech_support",    "⚙ Tech Calls")} />
          <SupportCallTile label="▶ Content Calls"   used={quota.contentSupport.used} total={quota.contentSupport.allocated} card={cardFor("content_support")} onClick={() => handleCallTileClick("content_support", "▶ Content Calls")} />
          <SupportCallTile label="📢 Marketing Calls" used={quota.adSupport.used}      total={quota.adSupport.allocated} card={cardFor("ad_support")}      onClick={() => handleCallTileClick("ad_support",      "📢 Marketing Calls")} />
          <SupportCallTile label="♟ Mentor 1-On-1"   used={quota.callCredits.used}    total={quota.callCredits.allocated} card={cardFor("one_to_one")}    onClick={() => handleCallTileClick("one_to_one",      "♟ Mentor 1-On-1")} />
          <SupportCallTile label="👥 Live Group Q&A"  used={quota.groupCall.used}      total={quota.groupCall.allocated} card={cardFor("group_call")}      onClick={() => handleCallTileClick("group_call",      "👥 Live Group Q&A")} />
        </div>
        {openCall && <SupportCallPanel category={openCall.category} label={openCall.label} onClose={closeCallPanel} />}
        <WinsModal open={winsOpen} onClose={() => setWinsOpen(false)} />
      </motion.div>

      {/* ── Customer Journey ─────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold" style={{ color: "var(--color-text-normal)" }}>Customer Journey</h2>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live Update
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <JourneyTile
            label="Daily Usage"
            value={String(Number(dailyHrs.toFixed(2)))}
            muted="h"
            metricColor="#809ed5"
            note={dailyGoal != null ? `Goal: ${dailyGoal}h/day` : undefined}
          />
          <JourneyTile
            label="Modules"
            value={String(stats.completedEpisodes)}
            muted={`/${stats.totalEpisodes}`}
            metricColor="#35cb76"
            note={
              stats.totalEpisodes > 0
                ? stats.completedEpisodes >= stats.totalEpisodes
                  ? "All Done"
                  : `${stats.totalEpisodes - stats.completedEpisodes} Left`
                : undefined
            }
          />
          <JourneyTile
            label="Tasks"
            value={String(stats.tasksCompleted)}
            muted={`/${stats.tasksTotal}`}
            metricColor="#809ed5"
            note={
              stats.tasksTotal > 0
                ? stats.tasksCompleted >= stats.tasksTotal
                  ? "All Done"
                  : `${stats.tasksTotal - stats.tasksCompleted} Left`
                : undefined
            }
          />
          <JourneyTile
            label="Support Days"
            value={String(daysLeft)}
            muted="d left"
            metricColor="#35cb76"
            rightLabel={daysElapsed > 0 ? `Day ${daysElapsed}` : undefined}
          />
          <JourneyTile
            label="Tier Access"
            value={String(activeDays)}
            muted={totalDays > 0 ? `/${totalDays}d` : "d"}
            metricColor="#809ed5"
            note={totalDays >= 300 ? "Annual" : undefined}
          />
          <JourneyTile
            label="Leaderboard"
            value={stats?.leaderboardRank != null ? `#${stats.leaderboardRank}${ordinalSuffix(stats.leaderboardRank)} 🏆` : "Unranked"}
            metricColor="#35cb76"
            leaderboard
            onClick={() => setWinsOpen(true)}
          />
        </div>
      </motion.div>

      {/* ── D2. Weekly Activity Graph — the member's batch tasks by week, from
              GET /api/user-batch/weekly-graph. Renders nothing for a member
              without a batch. ─────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <WeeklyActivityGraph />
      </motion.div>

      {/* ── E. Your Revenue Stats (saved weekly numbers) ───────────────── */}
      <RevenueSummarySection revenue={revenue} />

      {/* ── F. Weekly Revenue & Order Trajectory (saved daily numbers) ──── */}
      <WeeklyChartSection revenue={revenue} />

      {/* ── G. Social Media Organic Growth ────────────────────────────────── */}
      <SocialGrowthSection />

      {/* ── H. Now Learning ──────────────────────────────────────────────── */}
      <NowLearningSection />
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

"use client";

import { useState } from "react";
import {
  CheckCircle2, Flame, Heart, Plus, Clock, Headphones, IndianRupee, TrendingUp,
  BookOpen, ListChecks, CalendarClock, Crown, Trophy, Phone, Code2, PenTool,
  Megaphone, UserRound, Users, ShoppingBag, Target, Inbox,
} from "lucide-react";

// ─── Display data (page-scoped) ──────────────────────────────────────────────
// Values below are fixed display values replicating the TBT – eComm Mastery
// reference dashboard. They are NOT read from the backend.
// Items marked "derived" are computed from the reference numbers; items marked
// "placeholder" were not in the brief and should be replaced with the exact
// screenshot values.

const D = {
  title: "TBT – eComm Mastery",
  streakDays: 37,
  lifelines: 3, // placeholder — heart count not in brief
  summary: {
    dailyTimeHrs: "3.15",
    supportCalls: 12,
    revenue: "₹4,57,856",
    organicGrowth: "+12.5%",
  },
  journey: {
    dailyUsage: "3.15h",
    modulesDone: 2, modulesTotal: 12,
    tasksDone: 32, tasksTotal: 75,
    supportDaysLeft: 48,
    tierDay: 126, tierTotal: 365,
    leaderboardRank: 45,
  },
  calls: [
    { key: "sales",     label: "Sales Calls",     used: 2, total: 7,  icon: Phone,     color: "#3b82f6" },
    { key: "tech",      label: "Tech Calls",      used: 2, total: 7,  icon: Code2,     color: "#8b5cf6", sku: "techSupport" },
    { key: "content",   label: "Content Calls",   used: 4, total: 5,  icon: PenTool,   color: "#ec4899" },
    { key: "marketing", label: "Marketing Calls", used: 4, total: 7,  icon: Megaphone, color: "#f59e0b", sku: "adSupport" },
    { key: "mentor",    label: "Mentor 1-On-1",   used: 3, total: 4,  icon: UserRound, color: "#eab308", sku: "callCredits" },
    { key: "group",     label: "Live Group Q&A",  used: 3, total: 12, icon: Users,     color: "#10b981", sku: "groupCall" },
  ],
  revenue: {
    revenue: 457856,
    orders: 575,
    adSpend: 45856,
    organicLeads: 128,
  },
  // placeholder — daily series not in brief; Mon 14 → Sun 20
  week: [
    { day: "Mon", date: 14, revenue: 48200, orders: 61 },
    { day: "Tue", date: 15, revenue: 55400, orders: 70 },
    { day: "Wed", date: 16, revenue: 51900, orders: 66 },
    { day: "Thu", date: 17, revenue: 63800, orders: 79 },
    { day: "Fri", date: 18, revenue: 82500, orders: 101 },
    { day: "Sat", date: 19, revenue: 89300, orders: 112 },
    { day: "Sun", date: 20, revenue: 66756, orders: 86 },
  ],
};

// ─── Palette (scoped to this dashboard) ──────────────────────────────────────

const C = {
  bg: "#0a0a0c",
  card: "#141418",
  cardHi: "#1a1a20",
  border: "rgba(255,255,255,0.07)",
  text: "#f4f4f5",
  sub: "#a1a1aa",
  muted: "#71717a",
  red: "#ef4444",
  yellow: "#facc15",
  green: "#22c55e",
  track: "rgba(255,255,255,0.08)",
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ─── Primitives ──────────────────────────────────────────────────────────────

function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl p-4 ${onClick ? "cursor-pointer transition-colors hover:brightness-125" : ""} ${className}`}
      style={{ background: C.card, border: `1px solid ${C.border}` }}
    >
      {children}
    </div>
  );
}

function IconBox({ icon: Icon, color }: { icon: any; color: string }) {
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
      <Icon size={15} style={{ color }} />
    </div>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: C.track }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
      {children}
    </span>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h4 className="text-[13px] font-bold uppercase tracking-widest" style={{ color: C.text }}>{children}</h4>
      {right}
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({ onAddLifeline }: { onAddLifeline: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-xl font-extrabold tracking-tight" style={{ color: C.text }}>{D.title}</h3>
        <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: C.green }}>
          <CheckCircle2 size={12} /> Weekly Report Submitted
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: C.cardHi, border: `1px solid ${C.border}` }}>
          <Flame size={16} style={{ color: "#f97316" }} fill="#f97316" />
          <span className="text-sm font-bold" style={{ color: C.text }}>{D.streakDays} Days</span>
        </div>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl" style={{ background: C.cardHi, border: `1px solid ${C.border}` }}>
          {Array.from({ length: D.lifelines }).map((_, i) => (
            <Heart key={i} size={15} style={{ color: C.red }} fill={C.red} />
          ))}
          <button
            onClick={onAddLifeline}
            title="Buy extra lifeline"
            className="ml-1 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.15)", color: C.red }}
          >
            <Plus size={12} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── B. Summary cards ────────────────────────────────────────────────────────

function SummaryCards() {
  const items = [
    { label: "Daily Time Spent", value: D.summary.dailyTimeHrs, unit: "hrs", icon: Clock, color: "#3b82f6" },
    { label: "Support Delivered", value: String(D.summary.supportCalls), unit: "Calls", icon: Headphones, color: "#8b5cf6" },
    { label: "Revenue Generated", value: D.summary.revenue, unit: "", icon: IndianRupee, color: C.green },
    { label: "Organic Growth (Weekly)", value: D.summary.organicGrowth, unit: "", icon: TrendingUp, color: C.yellow },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(({ label, value, unit, icon, color }) => (
        <Card key={label}>
          <IconBox icon={icon} color={color} />
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider leading-tight" style={{ color: C.muted }}>{label}</p>
          <p className="mt-1 text-xl font-extrabold leading-none" style={{ color: C.text }}>
            {value}{unit && <span className="text-xs font-semibold ml-1" style={{ color: C.sub }}>{unit}</span>}
          </p>
        </Card>
      ))}
    </div>
  );
}

// ─── C. Customer Journey ─────────────────────────────────────────────────────

function CustomerJourney() {
  const j = D.journey;
  const items = [
    { label: "Daily Usage", value: j.dailyUsage, sub: "Avg per day", pct: null, color: "#3b82f6", icon: Clock, status: "On Track", statusColor: C.green },
    { label: "Modules", value: `${j.modulesDone}/${j.modulesTotal}`, sub: "Completed", pct: (j.modulesDone / j.modulesTotal) * 100, color: "#8b5cf6", icon: BookOpen },
    { label: "Tasks", value: `${j.tasksDone}/${j.tasksTotal}`, sub: "Completed", pct: (j.tasksDone / j.tasksTotal) * 100, color: "#ec4899", icon: ListChecks },
    { label: "Support Days", value: `${j.supportDaysLeft}d`, sub: "left", pct: null, color: "#f59e0b", icon: CalendarClock, status: "Active", statusColor: C.yellow },
    { label: "Tier Access", value: `${j.tierDay}/${j.tierTotal}d`, sub: "Days used", pct: (j.tierDay / j.tierTotal) * 100, color: C.green, icon: Crown },
    { label: "Leaderboard", value: `#${j.leaderboardRank}th`, sub: "Rank", pct: null, color: C.yellow, icon: Trophy },
  ];
  return (
    <section>
      <SectionTitle
        right={
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: C.green }}>
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping" style={{ background: C.green }} />
              <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: C.green }} />
            </span>
            Live
          </span>
        }
      >
        Customer Journey
      </SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map(({ label, value, sub, pct, color, icon, status, statusColor }) => (
          <Card key={label}>
            <div className="flex items-start justify-between gap-2">
              <IconBox icon={icon} color={color} />
              {status && <Pill color={statusColor!}>{status}</Pill>}
              {pct != null && <span className="text-[10px] font-bold" style={{ color }}>{Math.round(pct)}%</span>}
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
            <p className="mt-1 text-lg font-extrabold leading-none" style={{ color: C.text }}>
              {value} <span className="text-[11px] font-medium" style={{ color: C.sub }}>{sub}</span>
            </p>
            {pct != null && <div className="mt-3"><Bar pct={pct} color={color} /></div>}
          </Card>
        ))}
      </div>
    </section>
  );
}

// ─── D. Expert Support Calls ─────────────────────────────────────────────────

function ExpertCalls({ onBuy }: { onBuy: (sku: string) => void }) {
  return (
    <section>
      <SectionTitle>Expert Support Calls</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {D.calls.map(({ key, label, used, total, icon, color, sku }) => {
          const remaining = total - used;
          const pct = (used / total) * 100;
          const status = remaining === 0 ? { t: "Completed", c: C.green } : pct >= 75 ? { t: "Almost Done", c: C.yellow } : { t: "In Progress", c: "#3b82f6" };
          return (
            <Card key={key} onClick={sku ? () => onBuy(sku) : undefined}>
              <div className="flex items-start justify-between gap-2">
                <IconBox icon={icon} color={color} />
                <Pill color={status.c}>{status.t}</Pill>
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
              <p className="mt-1 text-lg font-extrabold leading-none" style={{ color: C.text }}>
                {used}/{total}
              </p>
              <div className="mt-3"><Bar pct={pct} color={color} /></div>
              <p className="mt-2 text-[10px] font-semibold" style={{ color: C.sub }}>{remaining} remaining</p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// ─── E. Revenue Stats ────────────────────────────────────────────────────────

function RevenueStats() {
  const r = D.revenue;
  // derived from the reference numbers
  const aov = Math.round(r.revenue / r.orders);
  const roas = (r.revenue / r.adSpend).toFixed(1);
  const cpo = Math.round(r.adSpend / r.orders);
  const spendPct = ((r.adSpend / r.revenue) * 100).toFixed(1);
  const items = [
    { label: "Revenue Generated", value: inr(r.revenue), icon: IndianRupee, color: C.green, badge: D.summary.organicGrowth, badgeColor: C.green, detail: `Avg order value ${inr(aov)}` },
    { label: "Number of Orders", value: String(r.orders), icon: ShoppingBag, color: "#3b82f6", badge: `${inr(aov)} AOV`, badgeColor: "#3b82f6", detail: `Conversion via ${r.organicLeads} organic leads` },
    { label: "Ad Budget Spent", value: inr(r.adSpend), icon: Target, color: C.red, badge: `${spendPct}% of rev`, badgeColor: C.red, detail: `Cost per order ${inr(cpo)}` },
    { label: "Organic Inbound Leads", value: String(r.organicLeads), icon: Inbox, color: C.yellow, badge: `${roas}x ROAS`, badgeColor: C.yellow, detail: "Profitable" },
  ];
  return (
    <section>
      <SectionTitle>Your Revenue Stats</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(({ label, value, icon, color, badge, badgeColor, detail }) => (
          <Card key={label}>
            <div className="flex items-start justify-between gap-2">
              <IconBox icon={icon} color={color} />
              <Pill color={badgeColor}>{badge}</Pill>
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider leading-tight" style={{ color: C.muted }}>{label}</p>
            <p className="mt-1 text-lg font-extrabold leading-none" style={{ color: C.text }}>{value}</p>
            <p className="mt-2 text-[10px] font-medium" style={{ color: C.sub }}>{detail}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ─── F. Weekly Revenue & Order Trajectory ────────────────────────────────────

function TrajectoryChart() {
  const [mode, setMode] = useState<"daily" | "cumulative">("daily");

  const rev = D.week.map((d) => d.revenue);
  const ord = D.week.map((d) => d.orders);
  const cum = (a: number[]) => a.map((_, i) => a.slice(0, i + 1).reduce((s, v) => s + v, 0));
  const revS = mode === "daily" ? rev : cum(rev);
  const ordS = mode === "daily" ? ord : cum(ord);

  const W = 640, H = 240, PL = 48, PR = 40, PT = 36, PB = 36;
  const iw = W - PL - PR, ih = H - PT - PB;
  const revMax = Math.max(...revS) * 1.15;
  const ordMax = Math.max(...ordS) * 1.15;
  const x = (i: number) => PL + (iw * i) / (D.week.length - 1);
  const yR = (v: number) => PT + ih - (v / revMax) * ih;
  const yO = (v: number) => PT + ih - (v / ordMax) * ih;
  const path = (s: number[], y: (v: number) => number) => s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path(revS, yR)} L${x(revS.length - 1)},${PT + ih} L${x(0)},${PT + ih} Z`;

  const peak = rev.indexOf(Math.max(...rev));
  const px = x(peak), py = yR(revS[peak]);
  const tipW = 118, tipX = Math.min(W - PR - tipW, Math.max(PL, px - tipW / 2));
  const fmtK = (v: number) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${Math.round(v / 1000)}k`);

  return (
    <section>
      <SectionTitle
        right={
          <div className="flex p-0.5 rounded-lg" style={{ background: C.cardHi, border: `1px solid ${C.border}` }}>
            {(["daily", "cumulative"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-3 py-1 rounded-md text-[11px] font-bold capitalize transition-colors"
                style={mode === m ? { background: C.red, color: "#fff" } : { color: C.sub }}
              >
                {m}
              </button>
            ))}
          </div>
        }
      >
        Weekly Revenue &amp; Order Trajectory
      </SectionTitle>
      <Card className="!p-3">
        <div className="flex items-center gap-4 px-2 pb-1 text-[11px] font-semibold" style={{ color: C.sub }}>
          <span className="inline-flex items-center gap-1.5"><span className="w-4 h-[3px] rounded" style={{ background: C.red }} />Daily Revenue (₹)</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: C.yellow }} />Order Velocity</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Weekly revenue and order trajectory">
          <defs>
            <linearGradient id="mdRevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.red} stopOpacity="0.28" />
              <stop offset="100%" stopColor={C.red} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const yy = PT + ih * t;
            return (
              <g key={t}>
                <line x1={PL} x2={W - PR} y1={yy} y2={yy} stroke="rgba(255,255,255,0.06)" strokeDasharray={t === 1 ? undefined : "3 4"} />
                <text x={PL - 8} y={yy + 3} textAnchor="end" fontSize="10" fill={C.muted}>{fmtK(revMax * (1 - t))}</text>
                <text x={W - PR + 8} y={yy + 3} textAnchor="start" fontSize="10" fill={C.muted}>{Math.round(ordMax * (1 - t))}</text>
              </g>
            );
          })}
          <path d={area} fill="url(#mdRevFill)" />
          <path d={path(revS, yR)} fill="none" stroke={C.red} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <path d={path(ordS, yO)} fill="none" stroke={C.yellow} strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" />
          {revS.map((v, i) => (
            <circle key={i} cx={x(i)} cy={yR(v)} r={i === peak ? 5 : 3} fill={i === peak ? C.red : C.card} stroke={C.red} strokeWidth="2" />
          ))}
          {D.week.map((d, i) => (
            <text key={d.day} x={x(i)} y={H - 12} textAnchor="middle" fontSize="11" fontWeight={i === peak ? 700 : 500} fill={i === peak ? C.text : C.muted}>
              {d.day} ({d.date})
            </text>
          ))}
          {/* peak-day tooltip */}
          <line x1={px} x2={px} y1={py} y2={PT + ih} stroke={C.red} strokeOpacity="0.4" strokeDasharray="2 3" />
          <g transform={`translate(${tipX},${Math.max(2, py - 52)})`}>
            <rect width={tipW} height="40" rx="8" fill={C.cardHi} stroke={C.border} />
            <text x="10" y="16" fontSize="10" fontWeight="700" fill={C.yellow}>PEAK · {D.week[peak].day} {D.week[peak].date}</text>
            <text x="10" y="31" fontSize="11" fontWeight="700" fill={C.text}>{inr(rev[peak])} · {ord[peak]} orders</text>
          </g>
        </svg>
      </Card>
    </section>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function MentorshipDashboard({ onBuyCredit }: { onBuyCredit: (quotaKey: string) => void }) {
  return (
    <div className="rounded-2xl p-4 sm:p-5 space-y-6" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}>
      <Header onAddLifeline={() => onBuyCredit("lifelines")} />
      <SummaryCards />
      <CustomerJourney />
      <ExpertCalls onBuy={onBuyCredit} />
      <RevenueStats />
      <TrajectoryChart />
    </div>
  );
}

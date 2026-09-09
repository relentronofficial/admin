"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/lib/socket/useSocket";
import apiClient from "@/lib/api/client";
import {
  CheckCircle2, Lock, Pencil, X, Save, Monitor, Smartphone, Tablet, Wifi,
  Camera, Loader2, Trophy, Flame, Heart, LogOut, Bell, Mail, MessageSquare,
  Headphones, Megaphone, Phone, Users, Star, Zap, ShoppingCart, ChevronRight, Clock,
} from "lucide-react";
import { useMe, useUpdateProfile, useGetAvatarPresignUrl, useUpdateAvatar, useNotificationPrefs, useUpdateNotificationPrefs, useUserSupportQuota, useCreditPricing, usePurchaseCredit, useMyCreditPurchases, type CreditPricingItem } from "@/lib/hooks/useUser";
import { useMyDevices, useRevokeDevice } from "@/lib/hooks/useDashboard";
import { cn } from "@/lib/utils/cn";
import toast from "react-hot-toast";
import type { MemberProfile, ProfileSection, ProfileTier, ProfileBadge, DeviceSession } from "@/types";

// ─── Avatar with upload ───────────────────────────────────────────────────────

function Avatar({
  avatarUrl,
  avatarGradient,
  firstName,
  onUploadClick,
  isUploading,
}: {
  avatarUrl: string | null;
  avatarGradient: string | null;
  firstName: string;
  onUploadClick: () => void;
  isUploading: boolean;
}) {
  const ring = avatarGradient ?? "var(--color-accent)";
  return (
    <button
      onClick={onUploadClick}
      disabled={isUploading}
      className="relative group flex-shrink-0 rounded-full"
      title="Change photo"
    >
      <div className="rounded-full p-[3px]" style={{ background: ring }}>
        {avatarUrl ? (
          <div className="relative w-20 h-20 rounded-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt={firstName} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
            style={{ background: "var(--color-accent)" }}
          >
            {firstName[0]?.toUpperCase() ?? "?"}
          </div>
        )}
      </div>
      {/* Camera overlay */}
      <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 group-disabled:opacity-100 transition-opacity">
        {isUploading
          ? <Loader2 size={18} className="text-white animate-spin" />
          : <Camera size={18} className="text-white" />}
      </div>
    </button>
  );
}

// ─── Membership plan badge ────────────────────────────────────────────────────

const PLAN_STYLES: Record<string, { color: string; bg: string }> = {
  free:       { color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
  starter:    { color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  premium:    { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  vip:        { color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  enterprise: { color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
};

function PlanBadge({ plan }: { plan: string }) {
  const style = PLAN_STYLES[plan] ?? { color: "#9ca3af", bg: "rgba(156,163,175,0.12)" };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
      style={{ color: style.color, background: style.bg }}
    >
      {plan}
    </span>
  );
}

// ─── Badge chip ───────────────────────────────────────────────────────────────

function BadgeChip({ badge }: { badge: ProfileBadge }) {
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
      style={{ color: badge.color, background: badge.bgColor }}
    >
      {badge.label}
    </span>
  );
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatsStrip({ profile }: { profile: MemberProfile }) {
  const stats = [
    {
      label: "Points",
      value: (profile.totalPoints ?? 0).toLocaleString(),
      Icon: Trophy,
      color: "#eab308",
      tooltip: "XP earned by completing lessons and passing quizzes",
    },
    {
      label: "Streak",
      value: `${profile.currentStreak ?? 0}d`,
      Icon: Flame,
      color: "#f97316",
      tooltip: "Consecutive days with at least one lesson completed",
    },
    {
      label: "Health",
      value: `${profile.healthScore ?? 0}%`,
      Icon: Heart,
      color: "#ef4444",
      tooltip: "Your overall activity score based on consistency and course completion",
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(({ label, value, Icon, color, tooltip }) => (
        <div
          key={label}
          title={tooltip}
          className="flex flex-col items-center gap-1.5 py-4 rounded-2xl border border-border bg-card cursor-help"
        >
          <div className="p-2 rounded-xl" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
            <Icon size={16} style={{ color }} />
          </div>
          <p className="text-base font-bold text-foreground leading-none">{value}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Tier row ─────────────────────────────────────────────────────────────────

function TierRow({ tier }: { tier: ProfileTier }) {
  const unlocked = tier.status === "unlocked";
  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-lg border", unlocked ? "border-border" : "border-border/40 opacity-60")}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{tier.label}</p>
        {!unlocked && tier.unlockConditionText && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tier.unlockConditionText}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
        {unlocked ? (
          <>
            <CheckCircle2 size={13} style={{ color: "var(--color-success)" }} />
            <span className="text-[11px] font-bold" style={{ color: "var(--color-success)" }}>UNLOCKED</span>
          </>
        ) : (
          <>
            <Lock size={13} style={{ color: "var(--color-locked)" }} />
            <span className="text-[11px] font-bold" style={{ color: "var(--color-locked)" }}>LOCKED</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Mentorship Benefits section ─────────────────────────────────────────────

function QuotaCard({
  icon: Icon,
  label,
  allocated,
  used,
  remaining,
  color,
}: {
  icon: any;
  label: string;
  allocated: number;
  used: number;
  remaining: number;
  color: string;
}) {
  const pct = allocated > 0 ? Math.min(100, (used / allocated) * 100) : 0;
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold text-foreground leading-none">{remaining}</span>
        <span className="text-xs text-muted-foreground mb-0.5">/ {allocated} remaining</span>
      </div>
      {allocated > 0 && (
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct >= 100 ? "var(--color-alert)" : color }}
          />
        </div>
      )}
    </div>
  );
}

// Credit type → SKUs (credit_type values that match that quota card)
const CREDIT_SKUS: Record<string, string[]> = {
  techSupport:  ['tech_support'],
  adSupport:    ['ad_support'],
  groupCall:    ['group_call_45', 'group_call_60'],
  callCredits:  ['one_to_one_45', 'one_to_one_60'],
  lifelines:    ['lifeline'],
};

function CreditPurchaseModal({
  quotaKey,
  onClose,
}: {
  quotaKey: string;
  onClose: () => void;
}) {
  const { data: pricing = [] } = useCreditPricing();
  const { data: purchases = [] } = useMyCreditPurchases();
  const purchase = usePurchaseCredit();
  const [paymentRef, setPaymentRef] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const skus = CREDIT_SKUS[quotaKey] ?? [];
  const options = pricing.filter((p: CreditPricingItem) => skus.includes(p.credit_type));
  const pendingForType = purchases.filter(p => skus.includes(p.credit_type) && p.status === 'pending');

  const handleBuy = async () => {
    if (!selected) return;
    try {
      await purchase.mutateAsync({ creditType: selected, quantity: 1, paymentRef: paymentRef.trim() || undefined });
      setDone(true);
      toast.success("Purchase request submitted — pending admin approval");
    } catch {
      toast.error("Failed to submit purchase");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border overflow-hidden shadow-2xl" style={{ background: "var(--color-modal-bg, #1a1a1a)", borderColor: "var(--color-surface-overlay, rgba(255,255,255,0.1))" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-surface-overlay, rgba(255,255,255,0.08))" }}>
          <p className="font-bold text-[15px] text-foreground">Buy Extra Credits</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {done ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle2 size={40} className="mx-auto text-green-400" />
              <p className="text-sm font-semibold text-foreground">Request submitted!</p>
              <p className="text-xs text-muted-foreground">We'll review your payment and activate the credit shortly.</p>
              <button onClick={onClose} className="mt-2 w-full py-2.5 rounded-xl text-sm font-bold" style={{ background: "var(--color-accent)", color: "#fff" }}>
                Done
              </button>
            </div>
          ) : (
            <>
              {pendingForType.length > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-xs" style={{ background: "color-mix(in srgb, var(--color-accent) 10%, transparent)", color: "var(--color-accent)" }}>
                  <Clock size={13} className="flex-shrink-0" />
                  {pendingForType.length} purchase{pendingForType.length > 1 ? "s" : ""} pending approval
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Select option</p>
                {options.map((opt: CreditPricingItem) => (
                  <button
                    key={opt.credit_type}
                    onClick={() => setSelected(opt.credit_type)}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left"
                    style={{
                      borderColor: selected === opt.credit_type ? "var(--color-accent)" : "var(--color-surface-overlay, rgba(255,255,255,0.1))",
                      background: selected === opt.credit_type ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "transparent",
                    }}
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                      {opt.description && <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-sm font-bold text-foreground">₹{Number(opt.price_inr).toLocaleString('en-IN')}</span>
                      {selected === opt.credit_type && <CheckCircle2 size={16} style={{ color: "var(--color-accent)" }} />}
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1.5">Payment Reference (optional)</label>
                <input
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="UPI transaction ID, screenshot ref…"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent bg-transparent"
                  style={{ borderColor: "var(--color-surface-overlay, rgba(255,255,255,0.15))" }}
                />
              </div>

              <button
                onClick={handleBuy}
                disabled={!selected || purchase.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                {purchase.isPending ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />}
                Request Purchase
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MentorshipBenefitsSection() {
  const { data: quota, isLoading } = useUserSupportQuota();
  const [buyModal, setBuyModal] = useState<string | null>(null);
  const qc = useQueryClient();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    const onApproved = (payload: { creditType: string; quantity: number; message?: string }) => {
      qc.invalidateQueries({ queryKey: ["user", "support-quota"] });
      qc.invalidateQueries({ queryKey: ["user", "my-credit-purchases"] });
      toast.success(payload.message ?? "Your extra credit has been added!");
    };
    const onRejected = (payload: { message?: string }) => {
      toast.error(payload.message ?? "Your purchase request could not be approved.");
    };
    socket.on("credit_approved", onApproved);
    socket.on("credit_rejected", onRejected);
    return () => {
      socket.off("credit_approved", onApproved);
      socket.off("credit_rejected", onRejected);
    };
  }, [socket, qc]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
        ))}
      </div>
    );
  }
  if (!quota) return null;

  const quotaCards: Array<{ quotaKey: string; icon: any; label: string; allocated: number; used: number; remaining: number; color: string; buyable: boolean }> = [
    { quotaKey: "techSupport",  icon: Headphones, label: "Tech Support",  allocated: quota.techSupport.allocated,  used: quota.techSupport.used,  remaining: quota.techSupport.remaining,  color: "#3b82f6", buyable: true },
    { quotaKey: "adSupport",    icon: Megaphone,  label: "Ad Support",    allocated: quota.adSupport.allocated,    used: quota.adSupport.used,    remaining: quota.adSupport.remaining,    color: "#8b5cf6", buyable: true },
    { quotaKey: "groupCall",    icon: Users,      label: "Group Calls",   allocated: quota.groupCall.allocated,    used: quota.groupCall.used,    remaining: quota.groupCall.remaining,    color: "#10b981", buyable: true },
    { quotaKey: "callCredits",  icon: Phone,      label: "Extra Calls",   allocated: quota.callCredits.allocated,  used: quota.callCredits.used,  remaining: quota.callCredits.remaining,  color: "#f59e0b", buyable: true },
    { quotaKey: "lifelines",    icon: Zap,        label: "Lifelines",     allocated: quota.lifelines.total,        used: quota.lifelines.used,    remaining: quota.lifelines.remaining,    color: "#dc2626", buyable: true },
  ];

  return (
    <>
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quotaCards.map(({ quotaKey, icon: Icon, label, allocated, used, remaining, color, buyable }) => {
            const pct = allocated > 0 ? Math.min(100, (used / allocated) * 100) : 0;
            const exhausted = allocated > 0 && remaining === 0;
            return (
              <div key={quotaKey} className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex-1">{label}</span>
                </div>
                <div className="flex items-end gap-1.5">
                  <span className="text-2xl font-bold text-foreground leading-none">{remaining}</span>
                  <span className="text-xs text-muted-foreground mb-0.5">/ {allocated} remaining</span>
                </div>
                {allocated > 0 && (
                  <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--color-alert)" : color }} />
                  </div>
                )}
                {buyable && exhausted && (
                  <button
                    onClick={() => setBuyModal(quotaKey)}
                    className="flex items-center justify-center gap-1.5 mt-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)", color: "var(--color-accent)" }}
                  >
                    <ShoppingCart size={11} /> Buy Extra
                  </button>
                )}
              </div>
            );
          })}

          {/* One-to-One card */}
          <div className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg" style={{ background: quota.oneToOne ? "color-mix(in srgb, #eab308 12%, transparent)" : "var(--color-bg-surface)" }}>
                <Star size={14} style={{ color: quota.oneToOne ? "#eab308" : "var(--color-locked, #4a4a4a)" }} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">1-on-1 with Shakthi</span>
            </div>
            <span className="text-sm font-bold" style={{ color: quota.oneToOne ? "#eab308" : "var(--color-locked, #4a4a4a)" }}>
              {quota.oneToOne ? "Included in your plan" : "Not in your plan"}
            </span>
            {!quota.oneToOne && (
              <button
                onClick={() => setBuyModal("callCredits")}
                className="flex items-center justify-center gap-1.5 mt-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)", color: "var(--color-accent)" }}
              >
                <ShoppingCart size={11} /> Buy a Session
              </button>
            )}
          </div>
        </div>

        {/* Purchase history link */}
        <PurchaseHistoryRow />
      </div>

      {buyModal && (
        <CreditPurchaseModal quotaKey={buyModal} onClose={() => setBuyModal(null)} />
      )}
    </>
  );
}

function PurchaseHistoryRow() {
  const { data: purchases = [] } = useMyCreditPurchases();
  const pendingCount = purchases.filter((p: any) => p.status === 'pending').length;
  if (purchases.length === 0) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card text-sm">
      <span className="text-muted-foreground">Your credit purchases</span>
      <div className="flex items-center gap-2">
        {pendingCount > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--color-alert) 15%, transparent)", color: "var(--color-alert)" }}>
            {pendingCount} pending
          </span>
        )}
        <span className="text-xs text-muted-foreground">{purchases.length} total</span>
      </div>
    </div>
  );
}

// ─── Personal section (editable — includes extended fields) ──────────────────

function PersonalSection({ section, profile }: { section: ProfileSection; profile: MemberProfile }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName ?? "",
    phone: profile.phone,
    dob: profile.dob ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    businessName: profile.businessName ?? "",
  });
  const updateProfile = useUpdateProfile();
  const fl = section.fieldLabels;
  const READONLY = new Set(["email"]);

  const handleSave = async () => {
    await updateProfile.mutateAsync({
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      phone: form.phone || undefined,
      dob: form.dob || null,
      city: form.city || null,
      state: form.state || null,
      businessName: form.businessName || null,
    });
    setEditing(false);
  };

  const fieldValue = (field: string) => {
    switch (field) {
      case "firstName":    return profile.firstName;
      case "lastName":     return profile.lastName ?? "—";
      case "email":        return profile.email;
      case "phone":        return profile.phone;
      case "dob":          return profile.dob ?? "—";
      case "city":         return profile.city ?? "—";
      case "state":        return profile.state ?? "—";
      case "businessName": return profile.businessName ?? "—";
      default:             return "—";
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {section.fields.map((field) => {
          const label = fl[field] ?? field;
          const readonly = READONLY.has(field) || !editing;

          if (!readonly) {
            return (
              <div key={field} className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
                <input
                  type={field === "dob" ? "date" : "text"}
                  value={form[field as keyof typeof form] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-ring transition-colors"
                />
              </div>
            );
          }

          return (
            <div key={field} className="space-y-0.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {label}
                {READONLY.has(field) && (
                  <span className="ml-1.5 normal-case font-normal text-muted-foreground/60">(read-only)</span>
                )}
              </p>
              <p className="text-sm text-foreground">{fieldValue(field)}</p>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-1">
        {editing ? (
          <>
            <button
              onClick={handleSave}
              disabled={updateProfile.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--color-accent)" }}
            >
              {updateProfile.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={13} />}
              {profile.saveLabel}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors"
            >
              <X size={13} /> Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors"
          >
            <Pencil size={13} /> Edit
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Subscription section ─────────────────────────────────────────────────────

function SubscriptionSection({ section, profile }: { section: ProfileSection; profile: MemberProfile }) {
  const fl = section.fieldLabels;
  const sub = profile.subscription;
  if (!sub) {
    return (
      <div className="space-y-2">
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Plan</p>
          <div className="flex items-center gap-2">
            {profile.membershipPlan ? (
              <PlanBadge plan={profile.membershipPlan} />
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const valueOf = (field: string) => {
    if (field === "startDate") return sub.startDate;
    if (field === "endDate") return sub.endDate;
    return "—";
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {section.fields.map((field) => (
          <div key={field} className="space-y-0.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{fl[field] ?? field}</p>
            <p className="text-sm text-foreground">{valueOf(field)}</p>
          </div>
        ))}
      </div>
      <div className="space-y-0.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Status</p>
        <span
          className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full text-white capitalize"
          style={{ background: sub.status === "active" ? "var(--color-success)" : "var(--color-alert)" }}
        >
          {sub.status}
        </span>
      </div>
    </div>
  );
}

// ─── Notification preferences ─────────────────────────────────────────────────

function NotificationPrefsSection() {
  const { data: prefs } = useNotificationPrefs();
  const updatePrefs = useUpdateNotificationPrefs();

  const toggle = (key: "email" | "push" | "sms") => {
    if (!prefs) return;
    updatePrefs.mutate({ [key]: !prefs[key] });
  };

  const items = [
    { key: "email" as const, label: "Email notifications", Icon: Mail },
    { key: "push" as const, label: "Push notifications", Icon: Bell },
    { key: "sms" as const, label: "SMS notifications", Icon: MessageSquare },
  ];

  return (
    <div className="space-y-1">
      {items.map(({ key, label, Icon }) => {
        const on = prefs?.[key] ?? true;
        return (
          <div key={key} className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <Icon size={15} className="text-muted-foreground" />
              <span className="text-sm text-foreground">{label}</span>
            </div>
            <button
              onClick={() => toggle(key)}
              disabled={updatePrefs.isPending}
              className="relative w-9 h-5 rounded-full transition-colors disabled:opacity-50"
              style={{ background: on ? "var(--color-accent)" : "color-mix(in srgb, var(--color-accent) 30%, #e5e7eb)" }}
            >
              <div
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                  on ? "left-[18px]" : "left-0.5"
                )}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Active Devices ───────────────────────────────────────────────────────────

function relativeTimeDevice(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function DeviceIcon({ deviceType }: { deviceType: DeviceSession["deviceType"] }) {
  if (deviceType === "mobile") return <Smartphone size={18} className="flex-shrink-0" />;
  if (deviceType === "tablet") return <Tablet size={18} className="flex-shrink-0" />;
  return <Monitor size={18} className="flex-shrink-0" />;
}

function DeviceCard({ device }: { device: DeviceSession }) {
  const revoke = useRevokeDevice();

  const handleRevoke = () => {
    revoke.mutate(device.id, {
      onSuccess: () => toast.success("Device signed out"),
      onError: () => toast.error("Failed to revoke device"),
    });
  };

  return (
    <div
      className={cn("flex items-start gap-3 p-4 rounded-xl border transition-colors", device.isCurrent ? "border-border" : "border-border/40")}
      style={device.isCurrent ? { borderColor: "color-mix(in srgb, var(--color-accent) 50%, transparent)" } : {}}
    >
      <div
        className="p-2 rounded-lg flex-shrink-0 mt-0.5"
        style={{
          background: device.isCurrent ? "color-mix(in srgb, var(--color-accent) 15%, transparent)" : "var(--color-bg-surface)",
          color: device.isCurrent ? "var(--color-accent)" : "var(--color-locked, #4a4a4a)",
        }}
      >
        <DeviceIcon deviceType={device.deviceType} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{device.os} · {device.browser}</span>
          {device.isCurrent && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)" }}
            >
              <Wifi size={9} /> THIS DEVICE
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {device.ipAddress ?? "IP hidden"} · Last active {relativeTimeDevice(device.lastActiveAt)}
        </p>
      </div>

      {!device.isCurrent && (
        <button
          onClick={handleRevoke}
          disabled={revoke.isPending}
          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:border-alert transition-colors disabled:opacity-50 flex-shrink-0"
          style={{ color: "var(--color-alert)" }}
          title="Sign out this device"
        >
          {revoke.isPending ? <Loader2 size={11} className="animate-spin" /> : <LogOut size={11} />}
          Sign out
        </button>
      )}
    </div>
  );
}

function ActiveDevicesSection() {
  const { data: devices, isLoading } = useMyDevices();
  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
          ))}
        </div>
      ) : !devices || devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active devices found.</p>
      ) : (
        <div className="space-y-2">
          {devices.map((d) => <DeviceCard key={d.id} device={d} />)}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {[80, 60, 48, 64, 48].map((h, i) => (
        <div key={i} className="rounded-2xl animate-pulse" style={{ height: h, background: "var(--color-bg-surface)" }} />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: profile, isLoading } = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getPresign = useGetAvatarPresignUrl();
  const updateAvatar = useUpdateAvatar();
  const [avatarUploading, setAvatarUploading] = useState(false);

  if (isLoading || !profile) return <ProfileSkeleton />;

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please select an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");

    setAvatarUploading(true);
    try {
      const { data } = await getPresign.mutateAsync({ filename: file.name, contentType: file.type });
      await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await updateAvatar.mutateAsync(data.publicUrl);
      toast.success("Profile photo updated");
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ""; }}
      />

      {/* Header — avatar + name + badges */}
      <div className="flex items-center gap-5 p-6 rounded-2xl border border-border bg-card">
        <Avatar
          avatarUrl={profile.avatarUrl}
          avatarGradient={profile.avatarGradient}
          firstName={profile.firstName}
          onUploadClick={() => fileInputRef.current?.click()}
          isUploading={avatarUploading}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-foreground truncate">
            {profile.firstName}{profile.lastName ? ` ${profile.lastName}` : ""}
          </h2>
          <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {profile.membershipPlan && <PlanBadge plan={profile.membershipPlan} />}
            {(profile.badges ?? []).map((b) => <BadgeChip key={b.id} badge={b} />)}
          </div>
        </div>
      </div>

      {/* Stats strip — only rendered when new fields are present (guards old cached backend response) */}
      {profile.totalPoints != null && <StatsStrip profile={profile} />}

      {/* Mentorship Benefits */}
      <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
        <h3 className="text-sm font-bold text-foreground">Your Mentorship Benefits</h3>
        <MentorshipBenefitsSection />
      </div>

      {/* Dynamic sections */}
      {(profile.sections ?? []).map((section) => (
        <div key={section.id} className="p-6 rounded-2xl border border-border bg-card space-y-4">
          <h3 className="text-sm font-bold text-foreground">{section.label}</h3>
          {section.id === "personal" && <PersonalSection section={section} profile={profile} />}
          {section.id === "subscription" && <SubscriptionSection section={section} profile={profile} />}
          {section.id === "tiers" && (
            <div className="space-y-2">
              {(profile.tiers ?? []).length > 0 ? (profile.tiers ?? []).map((tier) => <TierRow key={tier.tierNumber} tier={tier} />) : <p className="text-sm text-muted-foreground">—</p>}
            </div>
          )}
        </div>
      ))}

      {/* Notification preferences */}
      <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
        <h3 className="text-sm font-bold text-foreground">Notification Preferences</h3>
        <NotificationPrefsSection />
      </div>

      {/* Active Devices */}
      <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
        <h3 className="text-sm font-bold text-foreground">Active Devices</h3>
        <ActiveDevicesSection />
      </div>

      {/* Sign out */}
      <div className="pb-4">
        <button
          onClick={async () => {
            try { await apiClient.post("/api/user-auth/logout"); } catch {}
            queryClient.clear();
            router.replace("/login");
          }}
          className="w-full py-3 rounded-xl border text-sm font-semibold transition-colors"
          style={{ borderColor: "var(--color-alert)", color: "var(--color-alert)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "color-mix(in srgb, var(--color-alert) 10%, transparent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; }}
        >
          {profile.signOutLabel}
        </button>
      </div>
    </div>
  );
}

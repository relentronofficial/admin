"use client";

import { useState } from "react";
import Image from "next/image";
import { useClerk } from "@clerk/nextjs";
import { CheckCircle2, Lock, Pencil, X, Save } from "lucide-react";
import { useMe, useUpdateProfile } from "@/lib/hooks/useUser";
import { cn } from "@/lib/utils/cn";
import type { MemberProfile, ProfileSection, ProfileTier, ProfileBadge } from "@/types";

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  avatarUrl,
  avatarGradient,
  firstName,
}: {
  avatarUrl: string | null;
  avatarGradient: string | null;
  firstName: string;
}) {
  const ring = avatarGradient ?? "var(--color-accent)";
  if (avatarUrl) {
    return (
      <div
        className="rounded-full p-[3px] flex-shrink-0"
        style={{ background: ring }}
      >
        <div className="relative w-20 h-20 rounded-full overflow-hidden">
          <Image src={avatarUrl} alt={firstName} fill className="object-cover" />
        </div>
      </div>
    );
  }
  return (
    <div
      className="rounded-full p-[3px] flex-shrink-0"
      style={{ background: ring }}
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
        style={{ background: "var(--color-bg-surface, #111)" }}
      >
        {firstName[0]?.toUpperCase() ?? "?"}
      </div>
    </div>
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

// ─── Tier row ─────────────────────────────────────────────────────────────────

function TierRow({ tier }: { tier: ProfileTier }) {
  const unlocked = tier.status === "unlocked";
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        unlocked ? "border-border" : "border-border/40 opacity-60"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{tier.label}</p>
        {!unlocked && tier.unlockConditionText && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {tier.unlockConditionText}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
        {unlocked ? (
          <>
            <CheckCircle2 size={13} style={{ color: "var(--color-success)" }} />
            <span className="text-[11px] font-bold" style={{ color: "var(--color-success)" }}>
              UNLOCKED
            </span>
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

// ─── Personal details section (editable) ─────────────────────────────────────

function PersonalSection({
  section,
  profile,
}: {
  section: ProfileSection;
  profile: MemberProfile;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName ?? "",
    phone: profile.phone,
    dob: profile.dob ?? "",
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
    });
    setEditing(false);
  };

  const fieldValue = (field: string) => {
    switch (field) {
      case "firstName": return profile.firstName;
      case "lastName": return profile.lastName ?? "—";
      case "email": return profile.email;
      case "phone": return profile.phone;
      case "dob": return profile.dob ?? "—";
      default: return "—";
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
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {label}
                </label>
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
                  <span className="ml-1.5 normal-case font-normal text-muted-foreground/60">
                    (read-only)
                  </span>
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
              <Save size={13} />
              {profile.saveLabel}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors"
            >
              <X size={13} />
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors"
          >
            <Pencil size={13} />
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Subscription section ─────────────────────────────────────────────────────

function SubscriptionSection({
  section,
  profile,
}: {
  section: ProfileSection;
  profile: MemberProfile;
}) {
  const fl = section.fieldLabels;
  const sub = profile.subscription;

  if (!sub) {
    return <p className="text-sm text-muted-foreground">—</p>;
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
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {fl[field] ?? field}
            </p>
            <p className="text-sm text-foreground">{valueOf(field)}</p>
          </div>
        ))}
      </div>
      <div className="space-y-0.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Status
        </p>
        <span
          className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full text-white capitalize"
          style={{
            background:
              sub.status === "active" ? "var(--color-success)" : "var(--color-alert)",
          }}
        >
          {sub.status}
        </span>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {[80, 48, 64, 48].map((h, i) => (
        <div
          key={i}
          className="rounded-2xl animate-pulse"
          style={{ height: h, background: "var(--color-bg-surface)" }}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: profile, isLoading } = useMe();
  const { signOut } = useClerk();

  if (isLoading || !profile) return <ProfileSkeleton />;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header — avatar + name + badges */}
      <div className="flex items-center gap-5 p-6 rounded-2xl border border-border bg-card">
        <Avatar
          avatarUrl={profile.avatarUrl}
          avatarGradient={profile.avatarGradient}
          firstName={profile.firstName}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-foreground truncate">
            {profile.firstName}
            {profile.lastName ? ` ${profile.lastName}` : ""}
          </h2>
          <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
          {profile.badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {profile.badges.map((b) => (
                <BadgeChip key={b.id} badge={b} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic sections — order, labels, and fields all from API */}
      {profile.sections.map((section) => (
        <div
          key={section.id}
          className="p-6 rounded-2xl border border-border bg-card space-y-4"
        >
          <h3 className="text-sm font-bold text-foreground">{section.label}</h3>

          {section.id === "personal" && (
            <PersonalSection section={section} profile={profile} />
          )}
          {section.id === "subscription" && (
            <SubscriptionSection section={section} profile={profile} />
          )}
          {section.id === "tiers" && (
            <div className="space-y-2">
              {profile.tiers.length > 0 ? (
                profile.tiers.map((tier) => (
                  <TierRow key={tier.tierNumber} tier={tier} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Sign out — label from API, danger-styled */}
      <div className="pb-4">
        <button
          onClick={() => signOut({ redirectUrl: "/login" })}
          className="w-full py-3 rounded-xl border text-sm font-semibold transition-colors"
          style={{
            borderColor: "var(--color-alert)",
            color: "var(--color-alert)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "color-mix(in srgb, var(--color-alert) 10%, transparent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "";
          }}
        >
          {profile.signOutLabel}
        </button>
      </div>
    </div>
  );
}

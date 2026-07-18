"use client";

import { useEffect, useState } from "react";
import { X, RotateCcw } from "lucide-react";
import type { MemberFilters } from "@/lib/hooks/useMembers";

/**
 * Slide-out right-side drawer that lets an admin narrow the Members
 * list along every relevant facet. Emits changes via [onChange] the
 * moment a facet is ticked so the table updates live — no separate
 * "Apply" click required. "Clear All" wipes every facet in one tap.
 *
 * The drawer is presentational only. It does not fetch anything; the
 * parent owns the [filters] state and re-renders the useListMembers
 * query when [onChange] fires.
 */

type Option = { label: string; value: string };

interface Props {
  open: boolean;
  onClose: () => void;
  filters: MemberFilters;
  onChange: (next: MemberFilters) => void;
  /** Options fetched from the parent (batches, states, sectors, industries).
   *  Enum-typed dimensions are hardcoded below since the enum values are
   *  known at compile time. */
  batches: Array<{ id: string; name: string }>;
  states: string[];       // master + distinct values found across members
  sectors: string[];
  industries: string[];
  cities?: string[];      // master-backed city list
  businessTypes?: string[]; // master-backed business-type list
}

// Enum options — kept in one place so the drawer can't drift from the
// backend's accepted values. Matches the Prisma enum definitions in
// backend/prisma/schema.prisma.
const PLAN_OPTIONS: Option[] = [
  { label: "Free", value: "free" },
  { label: "Premium", value: "premium" },
  { label: "VIP", value: "vip" },
  { label: "Enterprise", value: "enterprise" },
];
const VERIFICATION_OPTIONS: Option[] = [
  { label: "Awaiting KYC", value: "awaiting_kyc" },
  { label: "In Review", value: "in_review" },
  { label: "Verified", value: "verified" },
  { label: "Rejected", value: "rejected" },
];
const GENDER_OPTIONS: Option[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];
const BUSINESS_STAGE_OPTIONS: Option[] = [
  { label: "Idea", value: "idea" },
  { label: "Early", value: "early" },
  { label: "Growth", value: "growth" },
  { label: "Scale", value: "scale" },
  { label: "Established", value: "established" },
];
const CHURN_RISK_OPTIONS: Option[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];
const TIER_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "Tier 1", value: 1 },
  { label: "Tier 2", value: 2 },
  { label: "Tier 3", value: 3 },
];

export default function MembersFilterDrawer({
  open,
  onClose,
  filters,
  onChange,
  batches,
  states,
  sectors,
  industries,
  cities = [],
  businessTypes = [],
}: Props) {
  // Local staging state — allows a smooth "type-then-apply" flow for
  // the date inputs without spamming the useListMembers query with a
  // partial date on every keystroke. All other controls apply live.
  const [staged, setStaged] = useState<MemberFilters>(filters);
  useEffect(() => setStaged(filters), [filters]);

  const applyPatch = (patch: Partial<MemberFilters>) => {
    const next = { ...staged, ...patch };
    setStaged(next);
    onChange(next);
  };

  const toggleStr = (key: keyof MemberFilters, value: string) => {
    const arr = ((staged[key] as string[] | undefined) ?? []).slice();
    const idx = arr.indexOf(value);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(value);
    applyPatch({ [key]: arr.length ? arr : undefined } as any);
  };
  const toggleNum = (key: keyof MemberFilters, value: number) => {
    const arr = ((staged[key] as number[] | undefined) ?? []).slice();
    const idx = arr.indexOf(value);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(value);
    applyPatch({ [key]: arr.length ? arr : undefined } as any);
  };

  const clearAll = () => {
    setStaged({});
    onChange({});
  };

  // Trap Escape to close — matches the standard modal/drawer pattern.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Scrim */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={
          "fixed inset-0 z-40 bg-black/60 transition-opacity " +
          (open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")
        }
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Filter members"
        aria-hidden={!open}
        className={
          "fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] bg-[#141414] border-l border-[#2a2a2a] " +
          "shadow-2xl flex flex-col transition-transform duration-200 " +
          (open ? "translate-x-0" : "translate-x-full")
        }
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-widest font-rajdhani text-white">
              Filter Members
            </h2>
            <p className="text-[10px] text-[#888] mt-0.5">
              Live updates the table below.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close filter drawer"
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/5 text-[#a0a0a0] hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <Facet label="Batch">
            <ChipGroup
              options={batches.map((b) => ({ label: b.name, value: b.id }))}
              selected={staged.batchId ?? []}
              onToggle={(v) => toggleStr("batchId", v)}
              emptyLabel="No batches configured yet."
            />
          </Facet>

          <Facet label="Membership Plan">
            <ChipGroup
              options={PLAN_OPTIONS}
              selected={staged.membershipPlan ?? []}
              onToggle={(v) => toggleStr("membershipPlan", v)}
            />
          </Facet>

          <Facet label="Verification Status">
            <ChipGroup
              options={VERIFICATION_OPTIONS}
              selected={staged.verificationStatus ?? []}
              onToggle={(v) => toggleStr("verificationStatus", v)}
            />
          </Facet>

          <Facet label="Gender">
            <ChipGroup
              options={GENDER_OPTIONS}
              selected={staged.gender ?? []}
              onToggle={(v) => toggleStr("gender", v)}
            />
          </Facet>

          <Facet label="Business Stage">
            <ChipGroup
              options={BUSINESS_STAGE_OPTIONS}
              selected={staged.businessStage ?? []}
              onToggle={(v) => toggleStr("businessStage", v)}
            />
          </Facet>

          <Facet label="Churn Risk">
            <ChipGroup
              options={CHURN_RISK_OPTIONS}
              selected={staged.churnRisk ?? []}
              onToggle={(v) => toggleStr("churnRisk", v)}
            />
          </Facet>

          <Facet label="Tier">
            <ChipGroup
              options={TIER_OPTIONS.map((t) => ({ label: t.label, value: String(t.value) }))}
              selected={(staged.currentTier ?? []).map(String)}
              onToggle={(v) => toggleNum("currentTier", Number(v))}
            />
          </Facet>

          <Facet label="State">
            <ChipGroup
              options={states.map((s) => ({ label: s, value: s }))}
              selected={staged.state ?? []}
              onToggle={(v) => toggleStr("state", v)}
              emptyLabel="No state data on members yet."
            />
          </Facet>

          <Facet label="City">
            <ChipGroup
              options={cities.map((s) => ({ label: s, value: s }))}
              selected={staged.city ?? []}
              onToggle={(v) => toggleStr("city", v)}
              emptyLabel="No cities configured yet."
            />
          </Facet>

          <Facet label="Business Type">
            <ChipGroup
              options={businessTypes.map((s) => ({ label: s, value: s }))}
              selected={staged.businessType ?? []}
              onToggle={(v) => toggleStr("businessType", v)}
              emptyLabel="No business types configured yet."
            />
          </Facet>

          <Facet label="Sector">
            <ChipGroup
              options={sectors.map((s) => ({ label: s, value: s }))}
              selected={staged.sector ?? []}
              onToggle={(v) => toggleStr("sector", v)}
              emptyLabel="No sector data on members yet."
            />
          </Facet>

          <Facet label="Industry">
            <ChipGroup
              options={industries.map((s) => ({ label: s, value: s }))}
              selected={staged.industry ?? []}
              onToggle={(v) => toggleStr("industry", v)}
              emptyLabel="No industry data on members yet."
            />
          </Facet>

          <Facet label="Joined Between">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={staged.joinedFrom ?? ""}
                onChange={(e) => applyPatch({ joinedFrom: e.target.value || undefined })}
                className="bg-[#1a1a1a] border border-[#333] rounded-md h-9 px-2 text-white text-xs outline-none focus:border-[#dc2626]"
              />
              <input
                type="date"
                value={staged.joinedTo ?? ""}
                onChange={(e) => applyPatch({ joinedTo: e.target.value || undefined })}
                className="bg-[#1a1a1a] border border-[#333] rounded-md h-9 px-2 text-white text-xs outline-none focus:border-[#dc2626]"
              />
            </div>
          </Facet>

          <Facet label="Team & Capabilities">
            <div className="flex flex-col gap-2">
              <BoolToggle
                label="Has marketing team"
                value={staged.hasMarketingTeam}
                onChange={(v) => applyPatch({ hasMarketingTeam: v })}
              />
              <BoolToggle
                label="Has video-editing team"
                value={staged.hasVideoEditing}
                onChange={(v) => applyPatch({ hasVideoEditing: v })}
              />
            </div>
          </Facet>
        </div>

        <footer className="border-t border-[#2a2a2a] px-5 py-3 flex items-center justify-between">
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] hover:text-white"
          >
            <RotateCcw size={12} /> Clear All
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-md bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani"
          >
            Done
          </button>
        </footer>
      </aside>
    </>
  );
}

// ── Small building blocks ──────────────────────────────────────────

function Facet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[10px] text-[#dc2626] font-bold uppercase tracking-widest font-rajdhani mb-2">
        {label}
      </p>
      {children}
    </section>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
  emptyLabel = "No options available.",
}: {
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  emptyLabel?: string;
}) {
  if (options.length === 0) {
    return <p className="text-[11px] text-[#666] italic">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            onClick={() => onToggle(o.value)}
            className={
              "px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider font-rajdhani transition-colors " +
              (active
                ? "bg-[#dc2626] text-white border border-[#dc2626]"
                : "bg-[#1a1a1a] text-[#a0a0a0] border border-[#333] hover:border-[#606060] hover:text-white")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function BoolToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  // Tri-state: yes / no / any. Any = undefined (dimension not filtered).
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#f0f0f0]">{label}</span>
      <div className="flex rounded-md overflow-hidden border border-[#333]">
        {[
          { label: "Any", v: undefined as boolean | undefined },
          { label: "Yes", v: true },
          { label: "No", v: false },
        ].map((opt) => {
          const active = value === opt.v;
          return (
            <button
              key={opt.label}
              onClick={() => onChange(opt.v)}
              className={
                "px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest font-rajdhani transition-colors " +
                (active
                  ? "bg-[#dc2626] text-white"
                  : "bg-[#1a1a1a] text-[#a0a0a0] hover:bg-[#252525]")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

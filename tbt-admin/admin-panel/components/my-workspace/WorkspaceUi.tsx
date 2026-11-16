"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page heading shared by the My Workspace pages. */
export function WorkspaceHeader({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon: any }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-[rgba(220,38,38,0.12)] border border-[rgba(220,38,38,0.3)] flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-[#dc2626]" />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold uppercase tracking-widest font-rajdhani text-[#f0f0f0]">{title}</h1>
        <p className="text-[13px] text-[#a0a0a0] mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

export function StatTile({ label, value, href, tone = "default" }: { label: string; value: number | string; href?: string; tone?: "default" | "alert" }) {
  const body = (
    <div
      className={cn(
        "bg-[#181818] border rounded-xl p-4 h-full transition-colors",
        tone === "alert" ? "border-[rgba(220,38,38,0.45)]" : "border-[#2a2a2a]",
        href && "hover:border-[#444]"
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">{label}</p>
      <p className={cn("text-2xl font-bold mt-1 tabular-nums", tone === "alert" ? "text-[#f87171]" : "text-[#f0f0f0]")}>{value}</p>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

/** Segmented filter. `value` is the active option key. */
export function FilterTabs({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "px-3 h-8 rounded-lg text-[12px] font-semibold border transition-colors",
            value === o.key
              ? "bg-[#dc2626] border-[#dc2626] text-white"
              : "bg-[#1a1a1a] border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] hover:border-[#444]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-[#181818] border border-[#2a2a2a] rounded-xl", className)}>{children}</div>;
}

export function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-14 text-[#606060]">
      <Loader2 size={20} className="animate-spin" />
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="py-14 text-center text-[13px] text-[#606060]">{text}</p>;
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-14 text-center">
      <p className="text-[13px] text-[#a0a0a0]">Couldn&apos;t load this list.</p>
      <button type="button" onClick={onRetry} className="mt-3 px-4 h-9 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-[12px] font-semibold">
        Try again
      </button>
    </div>
  );
}

export function Pager({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2a2a] text-[12px] text-[#a0a0a0]">
      <span>
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </span>
      <div className="flex gap-1.5">
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="w-8 h-8 rounded-lg border border-[#2a2a2a] flex items-center justify-center disabled:opacity-40 hover:border-[#444]">
          <ChevronLeft size={14} />
        </button>
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}
          className="w-8 h-8 rounded-lg border border-[#2a2a2a] flex items-center justify-center disabled:opacity-40 hover:border-[#444]">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * Filter state that starts from (and is written back to) the page's query
 * string, so links like /my-workspace/tickets?status=overdue land on the
 * right filter and reloads keep it.
 */
export function useQueryState(key: string, fallback: string, allowed: string[]): [string, (v: string) => void] {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get(key);
    if (v && allowed.includes(v)) setValue(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (v: string) => {
    setValue(v);
    const params = new URLSearchParams(window.location.search);
    if (v === fallback) params.delete(key);
    else params.set(key, v);
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  };
  return [value, set];
}

export const memberName = (m: { firstName?: string | null; lastName?: string | null } | null | undefined) =>
  [m?.firstName, m?.lastName].filter(Boolean).join(" ") || "—";

export const humanize = (s: string | null | undefined) =>
  (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** "3d ago" style relative time; "Never" for null. */
export function ago(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.floor(mo / 12)}y ago`;
}

const PILL: Record<string, string> = {
  red: "bg-[rgba(220,38,38,0.14)] text-[#f87171] border-[rgba(220,38,38,0.35)]",
  amber: "bg-[rgba(245,158,11,0.12)] text-[#fbbf24] border-[rgba(245,158,11,0.3)]",
  green: "bg-[rgba(34,197,94,0.12)] text-[#4ade80] border-[rgba(34,197,94,0.3)]",
  blue: "bg-[rgba(59,130,246,0.12)] text-[#60a5fa] border-[rgba(59,130,246,0.3)]",
  gray: "bg-[#1f1f1f] text-[#a0a0a0] border-[#333]",
};

export function Pill({ children, tone = "gray" }: { children: React.ReactNode; tone?: keyof typeof PILL }) {
  return (
    <span className={cn("inline-flex items-center px-2 h-5 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap", PILL[tone])}>
      {children}
    </span>
  );
}

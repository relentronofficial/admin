"use client";

/** Shared building blocks for the Insights page and the Dashboard overview. */
import { useId, useMemo, useState, type ReactNode } from "react";
import { Download, ArrowUpRight, ArrowDownRight, Minus, Loader2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { InsightsRange } from "@/lib/hooks/useInsights";

// ── Formatting ───────────────────────────────────────────────────────────────

export const fmtNum = (v: number | null | undefined) => (v == null ? "—" : Number(v).toLocaleString("en-IN"));
export const fmtInr = (v: number | null | undefined) =>
  v == null ? "—" : `₹${Math.round(Number(v)).toLocaleString("en-IN")}`;
export const fmtInrShort = (v: number | null | undefined) => {
  if (v == null) return "—";
  const n = Number(v);
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};
export const fmtPct = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);
export const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";
export const fmtDay = (v: string) =>
  new Date(`${v}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export const labelCls = "text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani";

// ── CSV export ───────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** value written to the CSV (defaults to row[key]) */
  csv?: (row: T) => string | number | null | undefined;
  align?: "left" | "right";
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv<T>(filename: string, columns: Column<T>[], rows: T[]) {
  const lines = [columns.map((c) => csvCell(c.label)).join(",")];
  for (const r of rows) {
    lines.push(columns.map((c) => csvCell(c.csv ? c.csv(r) : (r as Record<string, unknown>)[c.key])).join(","));
  }
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Layout pieces ────────────────────────────────────────────────────────────

export function Section({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden min-w-0">
      <div className="px-5 pt-4 pb-3 border-b border-[#2a2a2a] flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-0.5 bg-[#e02020] h-5 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="font-rajdhani text-base font-semibold tracking-wide uppercase text-[#f0f0f0]">{title}</h3>
            {subtitle && <p className="text-[11px] text-[#888] mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Loading() {
  return <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin text-[#777]" /></div>;
}

export function ErrorNote({ text = "Could not load this data. Try again in a moment." }: { text?: string }) {
  return <div className="text-center py-10 text-sm text-red-400">{text}</div>;
}

export function Empty({ text }: { text: string }) {
  return <div className="text-center py-10 text-[#777] text-sm italic">{text}</div>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-[11px] text-[#777] leading-relaxed">{children}</p>;
}

export function ChangeBadge({ change, invert = false }: { change: number | null | undefined; invert?: boolean }) {
  if (change == null) return <span className="text-[10px] text-[#666] font-bold">no prior data</span>;
  const good = invert ? change < 0 : change > 0;
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  const color = change === 0 ? "text-[#888]" : good ? "text-green-400" : "text-red-400";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${color}`}>
      <Icon size={12} />{Math.abs(change)}%
    </span>
  );
}

export function Sparkline({ data, dataKey, color = "#dc2626" }: { data: any[]; dataKey: string; color?: string }) {
  const id = `spark-${useId().replace(/:/g, "")}`;
  if (!data?.length) return null;
  return (
    <div className="h-9 mt-2 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KpiCard({ title, value, change, sub, spark, sparkKey, invert }: {
  title: string; value: ReactNode; change?: number | null; sub?: ReactNode; spark?: any[]; sparkKey?: string; invert?: boolean;
}) {
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className={labelCls}>{title}</p>
        {change !== undefined && <ChangeBadge change={change} invert={invert} />}
      </div>
      <p className="font-rajdhani text-2xl font-bold text-[#f0f0f0] truncate mt-1">{value}</p>
      {sub && <p className="text-[11px] text-[#777] mt-0.5 truncate">{sub}</p>}
      {spark && sparkKey && <Sparkline data={spark} dataKey={sparkKey} />}
    </div>
  );
}

export function Bar({ percent, color = "#dc2626" }: { percent: number | null; color?: string }) {
  const p = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div className="h-1.5 rounded-full bg-[#262626] overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
    </div>
  );
}

// ── Range picker ─────────────────────────────────────────────────────────────

const PRESETS: Array<{ key: InsightsRange["range"]; label: string }> = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "custom", label: "Custom" },
];

export function RangePicker({ value, onChange }: { value: InsightsRange; onChange: (r: InsightsRange) => void }) {
  const today = useMemo(() => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10), []);
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? today);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-[#2a2a2a] overflow-hidden">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key === "custom" ? { range: "custom", from: from || undefined, to: to || undefined } : { range: p.key })}
            className={`px-3 h-8 text-[11px] font-bold uppercase tracking-wider font-rajdhani transition-colors ${
              value.range === p.key ? "bg-[#dc2626] text-white" : "bg-[#1a1a1a] text-[#a0a0a0] hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value.range === "custom" && (
        <div className="flex items-center gap-1.5">
          <input type="date" value={from} max={to || today} onChange={(e) => { setFrom(e.target.value); onChange({ range: "custom", from: e.target.value, to }); }}
            className="h-8 bg-[#1a1a1a] border border-[#333] rounded-lg px-2 text-[12px] text-white outline-none focus:border-[#dc2626] [color-scheme:dark]" aria-label="From date" />
          <span className="text-[#666] text-xs">to</span>
          <input type="date" value={to} min={from} max={today} onChange={(e) => { setTo(e.target.value); onChange({ range: "custom", from, to: e.target.value }); }}
            className="h-8 bg-[#1a1a1a] border border-[#333] rounded-lg px-2 text-[12px] text-white outline-none focus:border-[#dc2626] [color-scheme:dark]" aria-label="To date" />
        </div>
      )}
    </div>
  );
}

// ── Table with CSV export ────────────────────────────────────────────────────

export function CsvButton<T>({ filename, columns, rows }: { filename: string; columns: Column<T>[]; rows: T[] }) {
  return (
    <button
      type="button"
      disabled={!rows.length}
      onClick={() => downloadCsv(filename, columns, rows)}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#333] bg-[#1a1a1a] text-[11px] font-bold uppercase tracking-wider font-rajdhani text-[#a0a0a0] hover:text-white disabled:opacity-40"
    >
      <Download size={13} /> CSV
    </button>
  );
}

export function DataTable<T>({ columns, rows, empty = "No data for this period.", onRowClick, maxHeight }: {
  columns: Column<T>[]; rows: T[]; empty?: string; onRowClick?: (row: T) => void; maxHeight?: number;
}) {
  if (!rows.length) return <Empty text={empty} />;
  return (
    <div className="overflow-auto -mx-5" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full text-[12px] min-w-[560px]">
        <thead className="sticky top-0 bg-[#181818] z-[1]">
          <tr className="border-b border-[#2a2a2a]">
            {columns.map((c) => (
              <th key={c.key} className={`px-5 py-2 ${labelCls} whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#222]">
          {rows.map((r, i) => (
            <tr key={i} onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={onRowClick ? "cursor-pointer hover:bg-white/[0.03]" : "hover:bg-white/[0.015]"}>
              {columns.map((c) => (
                <td key={c.key} className={`px-5 py-2.5 text-[#d0d0d0] ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                  {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

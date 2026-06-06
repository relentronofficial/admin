"use client";

import { useState } from "react";
import {
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Zap,
  Tv2,
  Wifi,
  Search,
  Filter,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSecurityLogs, useSecurityLogStats } from "@/lib/hooks/useTbt";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Event type config ────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  EXCESSIVE_SKIPPING: {
    label: "Excessive Skipping",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    Icon: Zap,
  },
  RAPID_EPISODE_SWITCHING: {
    label: "Rapid Switching",
    color: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    Icon: Tv2,
  },
  ABNORMAL_PROGRESS_SPEED: {
    label: "Abnormal Speed",
    color: "#dc2626",
    bg: "rgba(220,38,38,0.12)",
    Icon: AlertTriangle,
  },
  MULTIPLE_DEVICES: {
    label: "Multiple Devices",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    Icon: Wifi,
  },
};

const ALL_EVENT_TYPES = Object.keys(EVENT_CONFIG);

function EventBadge({ eventType }: { eventType: string }) {
  const cfg = EVENT_CONFIG[eventType] ?? {
    label: eventType,
    color: "#a0a0a0",
    bg: "rgba(160,160,160,0.12)",
    Icon: ShieldAlert,
  };
  const Icon = cfg.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function MetadataSummary({ eventType, metadata }: { eventType: string; metadata: any }) {
  if (!metadata || typeof metadata !== "object") return <span className="text-[#606060]">—</span>;
  const m = metadata as Record<string, any>;

  if (eventType === "EXCESSIVE_SKIPPING") {
    return (
      <span className="text-[#a0a0a0] text-xs">
        Skipped from <b className="text-[#f0f0f0]">{m.fromSecs ?? "?"}s</b> → <b className="text-[#f0f0f0]">{m.toSecs ?? "?"}s</b>
        {m.reportedDelta != null && <span className="ml-1 text-[#606060]">(claimed {m.reportedDelta}s delta)</span>}
      </span>
    );
  }
  if (eventType === "RAPID_EPISODE_SWITCHING") {
    return (
      <span className="text-[#a0a0a0] text-xs">
        <b className="text-[#f0f0f0]">{m.episodeCount}</b> episodes in {m.windowMinutes ?? 5} min
      </span>
    );
  }
  if (eventType === "ABNORMAL_PROGRESS_SPEED") {
    return (
      <span className="text-[#a0a0a0] text-xs">
        Claimed <b className="text-[#f0f0f0]">{m.reportedDelta}s</b> delta, wall clock was <b className="text-[#f0f0f0]">{m.wallClockElapsed}s</b>
      </span>
    );
  }
  if (eventType === "MULTIPLE_DEVICES") {
    return (
      <span className="text-[#a0a0a0] text-xs">
        <b className="text-[#f0f0f0]">{m.deviceCount}</b> concurrent devices · IP: {m.ipAddress ?? "unknown"}
      </span>
    );
  }
  return <span className="text-[#606060] text-xs font-mono">{JSON.stringify(metadata).slice(0, 60)}…</span>;
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip() {
  const { data } = useSecurityLogStats();
  const stats = data?.data;
  if (!stats) return null;

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#181818] border border-[#2a2a2a] text-sm">
        <ShieldAlert size={14} className="text-[#dc2626]" />
        <span className="text-[#a0a0a0]">Last 7 days:</span>
        <span className="text-[#f0f0f0] font-bold">{stats.totalLast7Days}</span>
      </div>
      {(stats.byType as any[]).map((b: any) => {
        const cfg = EVENT_CONFIG[b.eventType];
        if (!cfg) return null;
        return (
          <div key={b.eventType} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#181818] border border-[#2a2a2a] text-sm">
            <span style={{ color: cfg.color }} className="font-bold">{b.count}</span>
            <span className="text-[#606060]">{cfg.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SecurityLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const LIMIT = 25;

  const { data, isLoading } = useSecurityLogs({
    page,
    limit: LIMIT,
    eventType: eventTypeFilter || undefined,
    search: search || undefined,
  });

  const logs: any[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert size={20} className="text-[#dc2626]" />
              Security Logs
            </h1>
            <p className="text-xs text-[#606060] mt-0.5">Suspicious activity — logged only, no automatic blocking</p>
          </div>
        </div>

        {/* Stats */}
        <StatsStrip />

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search member, email…"
              className="pl-9 pr-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626] w-64"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
            <select
              value={eventTypeFilter}
              onChange={(e) => { setEventTypeFilter(e.target.value); setPage(1); }}
              className="pl-9 pr-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#a0a0a0] outline-none focus:border-[#dc2626] appearance-none cursor-pointer"
            >
              <option value="">All event types</option>
              {ALL_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{EVENT_CONFIG[t].label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-[#606060] text-sm">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <ShieldAlert size={32} className="text-[#333]" />
              <p className="text-[#606060] text-sm">No security events found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {["Event", "Member", "Details", "Time"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={log.id}
                    className={cn(
                      "border-b border-[#1f1f1f] hover:bg-[#181818] transition-colors",
                      i === logs.length - 1 && "border-b-0"
                    )}
                  >
                    <td className="px-4 py-3">
                      <EventBadge eventType={log.eventType} />
                    </td>
                    <td className="px-4 py-3">
                      {log.member ? (
                        <div>
                          <p className="text-[#f0f0f0] font-medium text-xs">{log.member.name}</p>
                          <p className="text-[#606060] text-[11px]">{log.member.email}</p>
                          <p className="text-[#444] text-[10px] font-mono">{log.member.memberId}</p>
                        </div>
                      ) : (
                        <span className="text-[#444] text-xs">Unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <MetadataSummary eventType={log.eventType} metadata={log.metadata} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-[#a0a0a0] text-xs">
                        {format(new Date(log.createdAt), "dd MMM yyyy")}
                      </p>
                      <p className="text-[#606060] text-[11px]">
                        {format(new Date(log.createdAt), "HH:mm:ss")}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#606060]">{total} events total</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-[#a0a0a0]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

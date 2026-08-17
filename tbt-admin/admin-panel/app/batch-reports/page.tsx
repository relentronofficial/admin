"use client";

import { useState } from "react";
import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
  Send,
  Eye,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useReportDeliveryHistory,
  usePreviewBatchReport,
  useSendTestBatchReport,
} from "@/lib/hooks/useTbt";
import { useListMembers } from "@/lib/hooks/useMembers";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Status badge ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  sent: { label: "Sent", color: "#22c55e", bg: "rgba(34,197,94,0.12)", Icon: CheckCircle2 },
  failed: { label: "Failed", color: "#dc2626", bg: "rgba(220,38,38,0.12)", Icon: XCircle },
  skipped: { label: "Skipped", color: "#a0a0a0", bg: "rgba(160,160,160,0.12)", Icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.skipped;
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

// ─── Test-send panel ────────────────────────────────────────────────────────

function TestSendPanel() {
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
  const [reportType, setReportType] = useState<"weekly" | "monthly">("weekly");
  const [force, setForce] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [sendResult, setSendResult] = useState<any>(null);

  const { data: memberResults } = useListMembers({ search, limit: 8 });
  const members: any[] = memberResults?.data ?? [];

  const preview = usePreviewBatchReport();
  const sendTest = useSendTestBatchReport();

  const canAct = !!selectedMember;

  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest flex items-center gap-2">
        <Send size={15} className="text-[#dc2626]" />
        Send Test Report
      </h2>
      <p className="text-xs text-[#888]">
        Preview or manually send a weekly/monthly report to one member — for testing without waiting for the schedule.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <div className="relative">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1.5">
            Member
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <input
              value={selectedMember ? selectedMember.name : search}
              onChange={(e) => {
                setSelectedMember(null);
                setSearch(e.target.value);
                setPreviewResult(null);
                setSendResult(null);
              }}
              placeholder="Search member by name, email, phone…"
              className="pl-9 pr-4 h-10 w-full text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626]"
            />
          </div>
          {!selectedMember && search.length >= 2 && members.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-[#181818] border border-[#2a2a2a] rounded-lg overflow-hidden shadow-lg">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedMember({ id: m.id, name: `${m.firstName} ${m.lastName ?? ""}`.trim() });
                    setSearch("");
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-[#f0f0f0] hover:bg-[#222] transition-colors flex items-center justify-between"
                >
                  <span>{m.firstName} {m.lastName ?? ""}</span>
                  <span className="text-[#888]">{m.phone}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-1.5">
            Report Type
          </label>
          <select
            value={reportType}
            onChange={(e) => { setReportType(e.target.value as "weekly" | "monthly"); setPreviewResult(null); setSendResult(null); }}
            className="h-10 px-3 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] outline-none focus:border-[#dc2626] cursor-pointer"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          disabled={!canAct || preview.isPending}
          onClick={async () => {
            setSendResult(null);
            const res = await preview.mutateAsync({ memberId: selectedMember!.id, reportType });
            setPreviewResult(res);
          }}
          className="inline-flex items-center gap-2 px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] hover:border-[#444] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Eye size={13} /> Preview
        </button>
        <button
          disabled={!canAct || sendTest.isPending}
          onClick={async () => {
            setPreviewResult(null);
            const res = await sendTest.mutateAsync({ memberId: selectedMember!.id, reportType, force });
            setSendResult(res);
          }}
          className="inline-flex items-center gap-2 px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={13} /> Send Now
        </button>
        <label className="flex items-center gap-1.5 text-[11px] text-[#888] cursor-pointer select-none">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="accent-[#dc2626]" />
          Force (bypass duplicate-period check)
        </label>
      </div>

      {previewResult && (
        <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-4 text-xs space-y-2">
          {previewResult.eligible ? (
            <>
              <p className="text-[#22c55e] font-bold uppercase tracking-widest text-[10px]">Eligible — preview only, not sent</p>
              <pre className="whitespace-pre-wrap text-[#f0f0f0] font-sans">{previewResult.message}</pre>
            </>
          ) : (
            <p className="text-[#a0a0a0]">Not eligible: {previewResult.reason}</p>
          )}
        </div>
      )}

      {sendResult && (
        <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-4 text-xs">
          <p className="text-[#f0f0f0]">
            Result: <StatusBadge status={sendResult.status} />
            {sendResult.reason && <span className="text-[#888] ml-2">{sendResult.reason}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BatchReportsPage() {
  const [page, setPage] = useState(1);
  const [reportTypeFilter, setReportTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const LIMIT = 25;

  const { data, isLoading } = useReportDeliveryHistory({
    page,
    limit: LIMIT,
    reportType: reportTypeFilter || undefined,
    status: statusFilter || undefined,
  });

  const rows: any[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest flex items-center gap-2">
            <MessageSquare size={20} className="text-[#dc2626]" />
            Batch Reports
          </h1>
          <p className="text-xs text-[#888] mt-0.5">
            Weekly &amp; monthly 90-Day Task WhatsApp report delivery — sent automatically at the end of every week/month
          </p>
        </div>

        <TestSendPanel />

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <select
              value={reportTypeFilter}
              onChange={(e) => { setReportTypeFilter(e.target.value); setPage(1); }}
              className="pl-9 pr-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#a0a0a0] outline-none focus:border-[#dc2626] appearance-none cursor-pointer"
            >
              <option value="">All report types</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="pl-9 pr-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#a0a0a0] outline-none focus:border-[#dc2626] appearance-none cursor-pointer"
            >
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-[#888] text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <MessageSquare size={32} className="text-[#666]" />
              <p className="text-[#888] text-sm">No reports delivered yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {["Member", "Type", "Period", "Status", "Detail", "Sent At"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-[#1f1f1f] hover:bg-[#181818] transition-colors",
                      i === rows.length - 1 && "border-b-0"
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="text-[#f0f0f0] font-medium text-xs">
                        {row.member?.firstName} {row.member?.lastName ?? ""}
                      </p>
                      <p className="text-[#888] text-[11px]">{row.member?.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-[#a0a0a0] text-xs uppercase tracking-wide">{row.reportType}</td>
                    <td className="px-4 py-3 text-[#a0a0a0] text-xs font-mono">{row.reportPeriod}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 max-w-xs text-[#888] text-xs">{row.failureReason ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-[#a0a0a0] text-xs">{format(new Date(row.sentAt), "dd MMM yyyy")}</p>
                      <p className="text-[#888] text-[11px]">{format(new Date(row.sentAt), "HH:mm:ss")}</p>
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
            <p className="text-xs text-[#888]">{total} reports total</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-[#a0a0a0]">{page} / {totalPages}</span>
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

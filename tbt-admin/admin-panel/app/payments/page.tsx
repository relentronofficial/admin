"use client";

import { useState, useRef, useCallback } from "react";
import {
  usePaymentStats,
  usePaymentList,
  usePaymentAnalytics,
  useSyncRazorpayPayment,
  useApprovePayment,
  useRefundPayment,
  useRevenueByCourse,
} from "@/lib/hooks/useTbt";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { RefreshCw, CheckCircle, RotateCcw, Download, Search, Filter, X, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const fmtSmall = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

const statusColor: Record<string, string> = {
  completed: "bg-green-900/40 text-green-400 border border-green-800",
  pending:   "bg-yellow-900/40 text-yellow-400 border border-yellow-800",
  failed:    "bg-red-900/40 text-red-400 border border-red-800",
  refunded:  "bg-purple-900/40 text-purple-400 border border-purple-800",
};

const methodBadge: Record<string, { label: string; cls: string }> = {
  razorpay:     { label: "Razorpay",     cls: "bg-blue-900/40 text-blue-400 border border-blue-800" },
  manual:       { label: "Manual",       cls: "bg-[#2a2a2a] text-[#a0a0a0] border border-[#333]" },
  bank_transfer:{ label: "Bank",         cls: "bg-[#2a2a2a] text-[#a0a0a0] border border-[#333]" },
  upi:          { label: "UPI",          cls: "bg-green-900/40 text-green-400 border border-green-800" },
  free:         { label: "Free",         cls: "bg-[#1a1a1a] text-[#606060] border border-[#2a2a2a]" },
  external:     { label: "External",     cls: "bg-[#1a1a1a] text-[#606060] border border-[#2a2a2a]" },
};

function CopyableId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const truncated = value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
  return (
    <button
      onClick={copy}
      title={value}
      className="flex items-center gap-1 font-mono text-xs text-[#606060] hover:text-[#a0a0a0] group"
    >
      <span>{copied ? "Copied!" : truncated}</span>
      <Copy size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5 flex flex-col gap-1">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">{label}</p>
      <p className="text-2xl font-bold text-[#f0f0f0]">{value}</p>
      {sub && <p className="text-xs text-[#606060]">{sub}</p>}
    </div>
  );
}

// ── Refund Modal ─────────────────────────────────────────────────────────────

function RefundModal({
  payment,
  onClose,
}: {
  payment: any;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [speed, setSpeed] = useState<"normal" | "optimum">("normal");
  const refundMutation = useRefundPayment();

  const handleRefund = async () => {
    try {
      await refundMutation.mutateAsync({
        paymentId: payment.id,
        amount: amount ? parseFloat(amount) : undefined,
        note: note || undefined,
        speed,
      });
      toast.success("Refund processed successfully");
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Refund failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 w-[440px] max-w-full mx-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[14px] font-bold uppercase tracking-widest text-[#f0f0f0] font-rajdhani">
            Issue Refund
          </h3>
          <button onClick={onClose} className="text-[#606060] hover:text-[#f0f0f0]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1 mb-5 text-sm text-[#a0a0a0]">
          <div>Member: <span className="text-[#f0f0f0]">{payment.member?.firstName} {payment.member?.lastName}</span></div>
          <div>Course: <span className="text-[#f0f0f0]">{payment.course?.title}</span></div>
          <div>Paid: <span className="text-[#f0f0f0]">{fmtSmall(payment.amount)}</span></div>
          {payment.method === "razorpay" && payment.razorpayPaymentId && (
            <div>Razorpay ID: <span className="text-[#f0f0f0] font-mono text-xs">{payment.razorpayPaymentId}</span></div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">
              Refund Amount (leave blank for full refund)
            </label>
            <input
              type="number"
              placeholder={`Max: ${payment.amount}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              placeholder="Reason for refund"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
            />
          </div>
          {payment.method === "razorpay" ? (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">
                Refund Speed
              </label>
              <select
                value={speed}
                onChange={(e) => setSpeed(e.target.value as "normal" | "optimum")}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] text-sm"
              >
                <option value="normal">Normal (3–5 business days)</option>
                <option value="optimum">Optimum (instant, higher fee)</option>
              </select>
            </div>
          ) : (
            <div className="p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg text-yellow-400 text-xs">
              This will mark the payment as refunded in TBT only — no actual payment gateway refund will be initiated.
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border border-[#2a2a2a] text-[#a0a0a0] text-sm hover:bg-[#1a1a1a]"
          >
            Cancel
          </button>
          <button
            onClick={handleRefund}
            disabled={refundMutation.isPending}
            className="flex-1 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-50"
          >
            {refundMutation.isPending ? "Processing..." : `Refund ${amount ? fmtSmall(parseFloat(amount) || 0) : fmtSmall(payment.amount)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Razorpay Sync Modal ───────────────────────────────────────────────────────

function SyncModal({ payment, onClose }: { payment: any; onClose: () => void }) {
  const syncMutation = useSyncRazorpayPayment();
  const [result, setResult] = useState<any>(null);

  const handleSync = async () => {
    try {
      const data = await syncMutation.mutateAsync(payment.id);
      setResult(data);
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Sync failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 w-[480px] max-w-full mx-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[14px] font-bold uppercase tracking-widest text-[#f0f0f0] font-rajdhani">
            Razorpay Sync
          </h3>
          <button onClick={onClose} className="text-[#606060] hover:text-[#f0f0f0]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1 mb-4 text-sm text-[#a0a0a0]">
          <div>Member: <span className="text-[#f0f0f0]">{payment.member?.firstName} {payment.member?.lastName}</span></div>
          <div>DB Status: <span className={`px-2 py-0.5 rounded text-xs ${statusColor[payment.status] ?? ""}`}>{payment.status}</span></div>
          {payment.razorpayPaymentId && (
            <div>Razorpay Payment ID: <span className="text-[#f0f0f0] font-mono text-xs">{payment.razorpayPaymentId}</span></div>
          )}
        </div>

        {result && (
          <div className="bg-[#1a1a1a] rounded-lg p-4 space-y-2 text-sm mb-4">
            {result.synced === false ? (
              <p className="text-[#a0a0a0]">Not a Razorpay payment — no sync needed.</p>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-[#606060]">Razorpay Status</span>
                  <span className="text-[#f0f0f0] font-semibold">{result.razorpayStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#606060]">Razorpay Amount</span>
                  <span className="text-[#f0f0f0]">₹{((result.razorpayAmount ?? 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#606060]">Refund Status</span>
                  <span className="text-[#f0f0f0]">{result.razorpayRefundStatus ?? "—"}</span>
                </div>
                {result.mismatch && (
                  <div className="mt-2 p-2 bg-red-900/30 border border-red-800 rounded text-red-400 text-xs">
                    Status mismatch detected. DB shows <strong>{result.dbStatus}</strong> but Razorpay shows <strong>{result.razorpayStatus}</strong>.
                  </div>
                )}
                {!result.mismatch && (
                  <div className="mt-2 p-2 bg-green-900/30 border border-green-800 rounded text-green-400 text-xs">
                    In sync ✓
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border border-[#2a2a2a] text-[#a0a0a0] text-sm hover:bg-[#1a1a1a]"
          >
            Close
          </button>
          <button
            onClick={handleSync}
            disabled={syncMutation.isPending}
            className="flex-1 h-10 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} className={syncMutation.isPending ? "animate-spin" : ""} />
            {syncMutation.isPending ? "Checking..." : "Fetch from Razorpay"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [filters, setFilters] = useState<{
    page: number; limit: number; method: string; status: string;
    search: string; dateFrom: string; dateTo: string; days: number; groupBy: "day" | "month";
  }>({
    page: 1, limit: 25, method: "", status: "",
    search: "", dateFrom: "", dateTo: "", days: 30, groupBy: "day",
  });
  const [tab, setTab] = useState<"overview" | "list" | "razorpay">("overview");
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value, page: 1 }));
    }, 300);
  }, []);
  const [refundTarget, setRefundTarget] = useState<any>(null);
  const [syncTarget, setSyncTarget] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);

  const statsQuery = usePaymentStats();
  const analyticsQuery = usePaymentAnalytics({ days: filters.days, groupBy: filters.groupBy });
  const listQuery = usePaymentList({
    page: filters.page,
    limit: filters.limit,
    method: filters.method || undefined,
    status: filters.status || undefined,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });
  const revenueByCourseQuery = useRevenueByCourse();
  const razorpayListQuery = usePaymentList({
    page: filters.page,
    limit: filters.limit,
    method: "razorpay",
    status: filters.status || undefined,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });

  const approveMutation = useApprovePayment();

  const stats = statsQuery.data ?? {};
  const analytics = analyticsQuery.data ?? { series: [], summary: {} };
  const list = listQuery.data;
  const payments: any[] = list?.data ?? [];
  const meta = list?.meta ?? { total: 0, page: 1, limit: 25, totalRevenue: 0 };

  const handleApprove = async (paymentId: string) => {
    try {
      await approveMutation.mutateAsync(paymentId);
      toast.success("Payment approved and access granted");
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? "Approval failed");
    }
  };

  const exportCsv = async () => {
    try {
      const res: any = await import("@/lib/api/apiClient").then(({ default: client }) =>
        client.get("/api/payments/list", {
          params: {
            limit: 9999, page: 1,
            method: filters.method || undefined,
            status: filters.status || undefined,
            search: filters.search || undefined,
            dateFrom: filters.dateFrom || undefined,
            dateTo: filters.dateTo || undefined,
          },
        }),
      );
      const allPayments: any[] = res?.data ?? payments;
      if (!allPayments.length) return;
      const headers = [
        "id", "member_name", "member_email", "course",
        "amount", "currency", "method", "status",
        "razorpay_payment_id", "razorpay_order_id", "razorpay_refund_id",
        "refunded_amount", "created_at", "paid_at",
      ];
      const rows = allPayments.map((p: any) => [
        p.id,
        `${p.member?.firstName ?? ""} ${p.member?.lastName ?? ""}`.trim(),
        p.member?.email ?? "",
        p.course?.title ?? "",
        p.amount,
        p.currency ?? "INR",
        p.method,
        p.status,
        p.razorpayPaymentId ?? "",
        p.razorpayOrderId ?? "",
        p.razorpayRefundId ?? "",
        p.refundedAmount ?? "",
        p.createdAt ? new Date(p.createdAt).toISOString() : "",
        p.paidAt ? new Date(p.paidAt).toISOString() : "",
      ]);
      const csv = [headers, ...rows].map((r) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3 items-start">
          <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
          <div>
            <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Payments</h1>
            <p className="text-[12px] text-[#888] font-medium uppercase tracking-[1px] font-rajdhani">Revenue tracking and payment management</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 h-9 rounded-lg border border-[#2a2a2a] text-[#a0a0a0] text-sm hover:bg-[#1a1a1a]"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      {/* Stat Cards */}
      {statsQuery.isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
          <StatCard label="Total Revenue" value={fmt(stats.totalRevenue ?? 0)} />
          <StatCard label="This Month" value={fmt(stats.thisMonthRevenue ?? 0)} />
          <StatCard label="Razorpay" value={fmt(stats.razorpayRevenue ?? 0)} />
          <StatCard label="Manual / Other" value={fmt(stats.manualRevenue ?? 0)} />
          <StatCard label="Pending" value={String(stats.pendingCount ?? 0)} sub="requires approval" />
          <StatCard label="Refunded" value={fmt(stats.refundedTotal ?? 0)} />
          <StatCard label="Failed" value={String(stats.failedCount ?? 0)} />
        </div>
      )}

      {/* Pending alert */}
      {!statsQuery.isLoading && (stats.pendingCount ?? 0) > 0 && (
        <div
          className="flex items-center justify-between px-4 py-3 bg-yellow-900/20 border border-yellow-800/50 rounded-xl cursor-pointer hover:bg-yellow-900/30 transition-colors"
          onClick={() => { setTab("list"); setFilters((f) => ({ ...f, status: "pending", page: 1 })); }}
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-yellow-400 text-sm font-semibold">
              {stats.pendingCount} payment{stats.pendingCount > 1 ? "s" : ""} pending approval
            </span>
          </div>
          <span className="text-yellow-600 text-xs">Click to review →</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2a2a2a]">
        {([
          { key: "overview", label: "Revenue Overview" },
          { key: "list", label: "All Payments" },
          { key: "razorpay", label: "Razorpay" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-[#dc2626] text-[#f0f0f0]"
                : "border-transparent text-[#606060] hover:text-[#a0a0a0]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Chart Controls */}
          <div className="flex gap-3 items-center flex-wrap">
            {([7, 30, 90, 365] as const).map((d) => (
              <button
                key={d}
                onClick={() => setFilters((f) => ({ ...f, days: d }))}
                className={`px-3 h-8 rounded-lg text-xs font-semibold transition-colors ${
                  filters.days === d
                    ? "bg-[#dc2626] text-white"
                    : "bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] hover:bg-[#252525]"
                }`}
              >
                {d === 365 ? "1 Year" : `${d}D`}
              </button>
            ))}
            <button
              onClick={() => setFilters((f) => ({ ...f, groupBy: f.groupBy === "day" ? "month" : "day" }))}
              className="px-3 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-xs text-[#a0a0a0] hover:bg-[#252525]"
            >
              Group by: {filters.groupBy}
            </button>
          </div>

          {/* Summary */}
          {analytics.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Period Revenue" value={fmt(analytics.summary.totalRevenue ?? 0)} />
              <StatCard label="Razorpay" value={fmt(analytics.summary.razorpayRevenue ?? 0)} />
              <StatCard label="Manual / Other" value={fmt(analytics.summary.manualRevenue ?? 0)} />
              <StatCard
                label="Growth vs Prior Period"
                value={
                  analytics.summary.growthPercent != null
                    ? `${analytics.summary.growthPercent >= 0 ? "+" : ""}${analytics.summary.growthPercent.toFixed(1)}%`
                    : "—"
                }
                sub={analytics.summary.growthPercent != null
                  ? analytics.summary.growthPercent >= 0 ? "↑ growth" : "↓ decline"
                  : "no prior data"}
              />
            </div>
          )}

          {/* Revenue Chart */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-4">
              Revenue Trend
            </p>
            {analyticsQuery.isLoading ? (
              <div className="h-64 animate-pulse bg-[#1a1a1a] rounded" />
            ) : analytics.series.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[#606060] text-sm">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.series} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#606060", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#2a2a2a" }}
                  />
                  <YAxis
                    tick={{ fill: "#606060", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#2a2a2a" }}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    contentStyle={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 8 }}
                    labelStyle={{ color: "#a0a0a0" }}
                    formatter={(value: unknown) => [fmtSmall(Number(value)), ""]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "#a0a0a0" }}
                  />
                  <Bar dataKey="razorpay" name="Razorpay" fill="#dc2626" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="manual" name="Manual" fill="#4a4a4a" stackId="a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Line Chart */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-4">
              Daily Total Revenue
            </p>
            {analyticsQuery.isLoading ? (
              <div className="h-48 animate-pulse bg-[#1a1a1a] rounded" />
            ) : analytics.series.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-[#606060] text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics.series} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="date" tick={{ fill: "#606060", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#2a2a2a" }} />
                  <YAxis tick={{ fill: "#606060", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#2a2a2a" }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip contentStyle={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 8 }} labelStyle={{ color: "#a0a0a0" }} formatter={(value: unknown) => [fmtSmall(Number(value)), "Revenue"]} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="#dc2626" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#dc2626" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Method Distribution */}
          {analytics.summary && (analytics.summary.totalRevenue ?? 0) > 0 && (() => {
            const pieData = [
              { name: "Razorpay", value: analytics.summary.razorpayRevenue ?? 0, color: "#dc2626" },
              { name: "Manual / Bank / UPI / Ext", value: analytics.summary.manualRevenue ?? 0, color: "#4a4a4a" },
            ].filter((d) => d.value > 0);
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-4">Payment Method Mix</p>
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={54} dataKey="value" strokeWidth={0}>
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 8 }} formatter={(value: unknown) => [fmtSmall(Number(value)), ""]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      {pieData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <div>
                            <div className="text-xs text-[#a0a0a0]">{d.name}</div>
                            <div className="text-sm font-semibold text-[#f0f0f0]">{fmtSmall(d.value)}</div>
                            <div className="text-xs text-[#606060]">{((d.value / (analytics.summary.totalRevenue ?? 1)) * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Revenue by Course */}
                <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-4">Revenue by Course</p>
                  {revenueByCourseQuery.isLoading ? (
                    <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-[#1a1a1a] rounded animate-pulse" />)}</div>
                  ) : (revenueByCourseQuery.data ?? []).length === 0 ? (
                    <div className="text-[#606060] text-sm">No data</div>
                  ) : (() => {
                    const courses = revenueByCourseQuery.data ?? [];
                    const max = courses[0]?.totalRevenue ?? 1;
                    return (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {courses.map((c) => (
                          <div key={c.courseId}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-[#a0a0a0] truncate max-w-[160px]" title={c.courseTitle}>{c.courseTitle}</span>
                              <span className="text-[#f0f0f0] font-semibold flex-shrink-0 ml-2">{fmt(c.totalRevenue)}</span>
                            </div>
                            <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                              <div className="h-full bg-[#dc2626] rounded-full" style={{ width: `${(c.totalRevenue / max) * 100}%` }} />
                            </div>
                            <div className="text-[10px] text-[#606060] mt-0.5">{c.completedCount} paid · {c.pendingCount} pending</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Razorpay Tab */}
      {tab === "razorpay" && (() => {
        const rzPayments: any[] = razorpayListQuery.data?.data ?? [];
        const rzMeta = razorpayListQuery.data?.meta ?? { total: 0, page: 1, limit: 25, totalRevenue: 0 };
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#a0a0a0]">{rzMeta.total} Razorpay payments · revenue: <span className="text-[#f0f0f0] font-semibold">{fmt(rzMeta.totalRevenue)}</span></p>
              <div className="flex gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
                  <input type="text" placeholder="Search…" value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 pl-9 pr-4 text-white text-sm outline-none focus:border-[#dc2626] w-48" />
                </div>
              </div>
            </div>
            <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2a2a2a]">
                      {["Member", "Course", "Amount", "Order ID", "Payment ID", "Status", "Date", "Actions"].map((h) => (
                        <th key={h} className="text-left text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani px-4 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {razorpayListQuery.isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-b border-[#1e1e1e]">
                          {Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-[#1a1a1a] rounded animate-pulse" /></td>)}
                        </tr>
                      ))
                    ) : rzPayments.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-[#606060]">No Razorpay payments found</td></tr>
                    ) : rzPayments.map((p) => (
                      <tr key={p.id} className="border-b border-[#1e1e1e] hover:bg-[#1a1a1a] transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-[#f0f0f0] font-medium">{p.member?.firstName} {p.member?.lastName}</div>
                          <div className="text-[#606060] text-xs">{p.member?.email}</div>
                        </td>
                        <td className="px-4 py-3"><div className="text-[#a0a0a0] max-w-[160px] truncate">{p.course?.title}</div></td>
                        <td className="px-4 py-3 whitespace-nowrap text-[#f0f0f0] font-semibold">{fmtSmall(p.amount)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{p.razorpayOrderId ? <CopyableId value={p.razorpayOrderId} /> : <span className="text-[#333]">—</span>}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{p.razorpayPaymentId ? <CopyableId value={p.razorpayPaymentId} /> : <span className="text-[#333]">—</span>}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-xs ${statusColor[p.status] ?? "text-[#a0a0a0]"}`}>{p.status}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-[#606060]">
                          {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-IN") : p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {p.status === "completed" && (
                              <button onClick={() => setRefundTarget(p)} title="Refund" className="p-1.5 rounded bg-purple-900/30 border border-purple-800 text-purple-400 hover:bg-purple-900/60">
                                <RotateCcw size={13} />
                              </button>
                            )}
                            <button onClick={() => setSyncTarget(p)} title="Sync with Razorpay" className="p-1.5 rounded bg-blue-900/30 border border-blue-800 text-blue-400 hover:bg-blue-900/60">
                              <RefreshCw size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rzMeta.total > rzMeta.limit && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2a2a]">
                  <span className="text-xs text-[#606060]">{(rzMeta.page - 1) * rzMeta.limit + 1}–{Math.min(rzMeta.page * rzMeta.limit, rzMeta.total)} of {rzMeta.total}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} disabled={filters.page <= 1} className="px-3 h-8 rounded border border-[#2a2a2a] text-[#a0a0a0] text-xs disabled:opacity-40 hover:bg-[#1a1a1a]">Previous</button>
                    <button onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} disabled={filters.page * rzMeta.limit >= rzMeta.total} className="px-3 h-8 rounded border border-[#2a2a2a] text-[#a0a0a0] text-xs disabled:opacity-40 hover:bg-[#1a1a1a]">Next</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* List Tab */}
      {tab === "list" && (
        <div>
          {/* Search + Filter bar */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
              <input
                type="text"
                placeholder="Search by name, email…"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 pl-9 pr-4 text-white text-sm outline-none focus:border-[#dc2626]"
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-3 h-9 rounded-lg border text-sm ${
                showFilters ? "border-[#dc2626] text-[#dc2626]" : "border-[#2a2a2a] text-[#a0a0a0] hover:bg-[#1a1a1a]"
              }`}
            >
              <Filter size={14} />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-4 bg-[#181818] border border-[#2a2a2a] rounded-xl">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white text-sm outline-none focus:border-[#dc2626]"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">Method</label>
                <select
                  value={filters.method}
                  onChange={(e) => setFilters((f) => ({ ...f, method: e.target.value, page: 1 }))}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white text-sm outline-none focus:border-[#dc2626]"
                >
                  <option value="">All</option>
                  <option value="razorpay">Razorpay</option>
                  <option value="manual">Manual</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="free">Free</option>
                  <option value="external">External</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, page: 1 }))}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white text-sm outline-none focus:border-[#dc2626]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani block mb-1">To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, page: 1 }))}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white text-sm outline-none focus:border-[#dc2626]"
                />
              </div>
            </div>
          )}

          {/* Filtered Revenue */}
          {meta.totalRevenue != null && (
            <div className="mb-3 text-sm text-[#a0a0a0]">
              {meta.total} payments — filtered revenue: <span className="text-[#f0f0f0] font-semibold">{fmt(meta.totalRevenue)}</span>
            </div>
          )}

          {/* Table */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    {["Member", "Course", "Amount", "Method", "Status", "Razorpay ID", "Date", "Actions"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani px-4 py-3 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listQuery.isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-[#1e1e1e]">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-[#1a1a1a] rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-[#606060]">
                        No payments found
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="border-b border-[#1e1e1e] hover:bg-[#1a1a1a] transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-[#f0f0f0] font-medium">
                            {p.member?.firstName} {p.member?.lastName}
                          </div>
                          <div className="text-[#606060] text-xs">{p.member?.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[#a0a0a0] max-w-[180px] truncate">{p.course?.title}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-[#f0f0f0] font-semibold">{fmtSmall(p.amount)}</div>
                          {p.refundedAmount != null && (
                            <div className="text-purple-400 text-xs">Refunded: {fmtSmall(p.refundedAmount)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {(() => { const b = methodBadge[p.method]; return b ? <span className={`px-2 py-0.5 rounded text-xs ${b.cls}`}>{b.label}</span> : <span className="text-[#a0a0a0] text-xs">{p.method}</span>; })()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-xs ${statusColor[p.status] ?? "text-[#a0a0a0]"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {p.razorpayPaymentId ? (
                            <CopyableId value={p.razorpayPaymentId} />
                          ) : (
                            <span className="text-[#333]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-[#606060]">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {p.status === "pending" && (
                              <button
                                onClick={() => handleApprove(p.id)}
                                disabled={approveMutation.isPending}
                                title="Approve"
                                className="p-1.5 rounded bg-green-900/30 border border-green-800 text-green-400 hover:bg-green-900/60 disabled:opacity-50"
                              >
                                <CheckCircle size={13} />
                              </button>
                            )}
                            {p.status === "completed" && (
                              <button
                                onClick={() => setRefundTarget(p)}
                                title="Refund"
                                className="p-1.5 rounded bg-purple-900/30 border border-purple-800 text-purple-400 hover:bg-purple-900/60"
                              >
                                <RotateCcw size={13} />
                              </button>
                            )}
                            {p.method === "razorpay" && (
                              <button
                                onClick={() => setSyncTarget(p)}
                                title="Sync with Razorpay"
                                className="p-1.5 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] hover:bg-[#252525]"
                              >
                                <RefreshCw size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta.total > meta.limit && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2a2a]">
                <span className="text-xs text-[#606060]">
                  {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                    disabled={filters.page <= 1}
                    className="px-3 h-8 rounded border border-[#2a2a2a] text-[#a0a0a0] text-xs disabled:opacity-40 hover:bg-[#1a1a1a]"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                    disabled={filters.page * meta.limit >= meta.total}
                    className="px-3 h-8 rounded border border-[#2a2a2a] text-[#a0a0a0] text-xs disabled:opacity-40 hover:bg-[#1a1a1a]"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {refundTarget && (
        <RefundModal payment={refundTarget} onClose={() => setRefundTarget(null)} />
      )}
      {syncTarget && (
        <SyncModal payment={syncTarget} onClose={() => setSyncTarget(null)} />
      )}
    </div>
    </DashboardLayout>
  );
}

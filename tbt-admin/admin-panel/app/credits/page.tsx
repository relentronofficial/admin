"use client";

import { useState } from "react";
import {
  ShoppingCart, CheckCircle2, XCircle, Clock, Loader2,
  ThumbsUp, ThumbsDown, Edit2, Save, X,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListPendingCreditPurchases,
  useListCreditPurchases,
  useApproveCreditPurchase,
  useRejectCreditPurchase,
  useGetCreditPricing,
  useUpdateCreditPricing,
} from "@/lib/hooks/useTbt";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Tab = "pending" | "all" | "pricing";

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "Pending",  color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  approved: { label: "Approved", color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
  rejected: { label: "Rejected", color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
};

function fmtDate(d: any) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy, HH:mm"); } catch { return "—"; }
}

function PurchaseCard({ rec, showActions }: { rec: any; showActions: boolean }) {
  const approve = useApproveCreditPurchase();
  const reject = useRejectCreditPurchase();
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const status = STATUS_BADGE[rec.status] ?? STATUS_BADGE.pending;

  const handleApprove = async () => {
    try {
      await approve.mutateAsync(rec.id);
      toast.success("Credit approved");
    } catch { toast.error("Failed to approve"); }
  };

  const handleReject = async () => {
    try {
      await reject.mutateAsync({ id: rec.id, adminNote: rejectNote.trim() || undefined });
      toast.success("Purchase rejected");
      setRejecting(false);
    } catch { toast.error("Failed to reject"); }
  };

  return (
    <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1f1f1f] flex items-center justify-center text-xs font-bold text-[#dc2626] flex-shrink-0">
            {rec.first_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#f0f0f0]">
              {rec.first_name} {rec.last_name}
            </p>
            <p className="text-[11px] text-[#606060]">{rec.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ color: status.color, background: status.bg }}
          >
            {status.label}
          </span>
          <span className="text-[12px] font-bold text-[#f0f0f0]">₹{Number(rec.amount_inr).toLocaleString("en-IN")}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: "#1f1f1f", color: "#a0a0a0" }}>
          {rec.credit_type?.replace(/_/g, " ")}
        </span>
        <span className="text-[11px] text-[#606060]">Qty: {rec.quantity}</span>
        {rec.payment_ref && (
          <span className="text-[11px] text-[#606060]">Ref: <span className="text-[#a0a0a0] font-mono">{rec.payment_ref}</span></span>
        )}
        <span className="text-[11px] text-[#444] ml-auto">{fmtDate(rec.created_at)}</span>
      </div>

      {rec.admin_note && (
        <p className="text-[12px] text-[#a0a0a0] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2">
          Admin note: {rec.admin_note}
        </p>
      )}

      {showActions && rec.status === "pending" && (
        !rejecting ? (
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={approve.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: "#22c55e" }}
            >
              {approve.isPending ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
              Approve
            </button>
            <button
              onClick={() => setRejecting(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
            >
              <ThumbsDown size={14} /> Reject
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              rows={2}
              placeholder="Optional rejection note…"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#dc2626] resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setRejecting(false)} className="flex-1 py-2 rounded-lg text-sm text-[#606060] hover:text-white transition-colors bg-[#1f1f1f]">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={reject.isPending}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ background: "#ef4444" }}
              >
                {reject.isPending ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null}
                Confirm Reject
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function PendingTab() {
  const { data, isLoading } = useListPendingCreditPurchases();
  const records: any[] = (data as any)?.data ?? [];

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-[#dc2626]" /></div>;
  if (records.length === 0) return (
    <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-16 text-center">
      <CheckCircle2 size={36} className="text-green-500/40 mx-auto mb-3" />
      <p className="text-[#606060] text-sm">No pending purchase requests.</p>
    </div>
  );
  return <div className="space-y-3">{records.map((r: any) => <PurchaseCard key={r.id} rec={r} showActions />)}</div>;
}

function AllTab() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data, isLoading } = useListCreditPurchases(statusFilter ? { status: statusFilter } : undefined);
  const records: any[] = (data as any)?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mr-1">Filter</span>
        {["", "pending", "approved", "rejected"].map(f => (
          <button
            key={f || "all"}
            onClick={() => setStatusFilter(f)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all capitalize"
            style={statusFilter === f ? { background: "#dc2626", color: "#fff" } : { background: "#1f1f1f", color: "#888" }}
          >
            {f || "All"}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-[#dc2626]" /></div>
      ) : records.length === 0 ? (
        <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-10 text-center">
          <p className="text-[#606060] text-sm">No purchases found.</p>
        </div>
      ) : (
        <div className="space-y-3">{records.map((r: any) => <PurchaseCard key={r.id} rec={r} showActions={false} />)}</div>
      )}
    </div>
  );
}

function PricingTab() {
  const { data: rows = [], isLoading } = useGetCreditPricing();
  const updatePricing = useUpdateCreditPricing();
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ priceInr: string; label: string; description: string }>({ priceInr: "", label: "", description: "" });

  const startEdit = (row: any) => {
    setEditing(row.credit_type);
    setEditForm({ priceInr: String(row.price_inr), label: row.label, description: row.description ?? "" });
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      await updatePricing.mutateAsync({
        creditType: editing,
        priceInr: Number(editForm.priceInr),
        label: editForm.label,
        description: editForm.description || undefined,
      });
      toast.success("Pricing updated");
      setEditing(null);
    } catch { toast.error("Failed to update pricing"); }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-[#dc2626]" /></div>;

  return (
    <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1f1f1f]">
        <p className="text-[13px] font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wide">Credit Pricing</p>
        <p className="text-[11px] text-[#606060] mt-0.5">These prices are shown to members in the Buy Extra flow.</p>
      </div>
      <div className="divide-y divide-[#1f1f1f]">
        {(rows as any[]).map((row: any) => {
          const isEditing = editing === row.credit_type;
          return (
            <div key={row.credit_type} className="px-5 py-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#606060] block mb-1 uppercase tracking-wider font-rajdhani font-bold">Label</label>
                      <input
                        value={editForm.label}
                        onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#606060] block mb-1 uppercase tracking-wider font-rajdhani font-bold">Price (INR)</label>
                      <input
                        type="number"
                        min={0}
                        value={editForm.priceInr}
                        onChange={e => setEditForm(f => ({ ...f, priceInr: e.target.value }))}
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[#606060] block mb-1 uppercase tracking-wider font-rajdhani font-bold">Description</label>
                    <input
                      value={editForm.description}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(null)} className="px-4 py-1.5 rounded-lg text-sm text-[#606060] hover:text-white transition-colors bg-[#1f1f1f]">
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={updatePricing.isPending}
                      className="flex items-center gap-1.5 bg-[#dc2626] text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      {updatePricing.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-[#f0f0f0]">{row.label}</p>
                      <span className="text-[10px] text-[#444] font-mono">{row.credit_type}</span>
                    </div>
                    {row.description && <p className="text-[12px] text-[#606060] mt-0.5">{row.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[15px] font-bold text-[#f0f0f0]">₹{Number(row.price_inr).toLocaleString("en-IN")}</span>
                    <button
                      onClick={() => startEdit(row)}
                      className="p-1.5 rounded-lg bg-[#1f1f1f] hover:bg-[#2a2a2a] text-[#606060] hover:text-[#f0f0f0] transition-all"
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CreditsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const { data: pendingData } = useListPendingCreditPurchases();
  const pendingCount = ((pendingData as any)?.data ?? []).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex gap-3 items-start">
          <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
          <div>
            <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">Credit Purchases</h1>
            <p className="text-[12px] text-[#888] font-medium uppercase tracking-[1px] font-rajdhani">
              Review member requests for extra support sessions and lifelines.
            </p>
          </div>
        </div>

        <div className="flex gap-1 bg-[#141414] border border-[#1f1f1f] rounded-xl p-1 w-fit">
          {([
            { id: "pending", label: "Pending", badge: pendingCount },
            { id: "all",     label: "All Purchases" },
            { id: "pricing", label: "Pricing" },
          ] as { id: Tab; label: string; badge?: number }[]).map(({ id: tid, label, badge }) => (
            <button
              key={tid}
              onClick={() => setActiveTab(tid)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all",
                activeTab === tid ? "bg-[#dc2626] text-white" : "text-[#606060] hover:text-[#a0a0a0] hover:bg-[#1f1f1f]",
              )}
            >
              {label}
              {badge !== undefined && badge > 0 && (
                <span className="min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
                  style={{ background: activeTab === tid ? "rgba(255,255,255,0.25)" : "#dc2626", color: "#fff" }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "pending" && <PendingTab />}
        {activeTab === "all"     && <AllTab />}
        {activeTab === "pricing" && <PricingTab />}
      </div>
    </DashboardLayout>
  );
}

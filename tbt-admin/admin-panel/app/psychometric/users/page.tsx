"use client";

import { useEffect, useState, useCallback } from "react";
import { Users as UsersIcon, Clock, Trophy } from "lucide-react";
import { api, getToken, type ApiEnvelope } from "@/lib/psychometric/api";
import { useToast } from "@/components/psychometric/ToastProvider";
import StatCard from "@/components/psychometric/StatCard";
import PageHeader from "@/components/psychometric/PageHeader";
import ConfirmModal from "@/components/psychometric/ConfirmModal";

// Candidates: TBT members who start the assessment (they sign in with their TBT
// login, so there are no Psychometric accounts to create or verify here) plus
// candidates imported from the former standalone platform.
type UserRow = {
  _id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  sharedCode?: string | null;
  candidateId?: string | null;
  batch?: string | null;
  source: "tbt" | "standalone";
  hasCompletedAssessment: boolean;
  createdAt: string;
};

type UserStats = { totalUsers: number; completedUsers: number };

export default function UsersPage() {
  const showToast = useToast();
  const token = getToken();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [batch, setBatch] = useState("");
  const [batches, setBatches] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (batch) params.set("batch", batch);
    const { ok, data } = await api.get<ApiEnvelope<UserRow[]> & { stats?: UserStats; batches?: string[] }>(`/admin/users?${params}`, token);
    if (!ok) { showToast("Failed to load candidates.", "error"); return; }
    setRows(data.data);
    setStats(data.stats ?? null);
    setTotal(data.total ?? 0);
    setPages(data.pages || 1);
    if (data.batches) setBatches(data.batches);
  }, [page, search, status, batch, token, showToast]);

  useEffect(() => { load(); }, [load]);

  async function confirmDelete() {
    if (!deleteId) return;
    const { ok, data } = await api.delete<ApiEnvelope>(`/admin/users/${deleteId}`, token);
    setDeleteId(null);
    if (!ok) { showToast(data.message || "Delete failed.", "error"); return; }
    showToast("Candidate removed.", "success");
    load();
  }

  const SourceBadge = ({ u }: { u: UserRow }) => (
    <span className={`badge ${u.source === "tbt" ? "badge-active" : "badge-inactive"}`}>{u.source === "tbt" ? "TBT member" : "Imported"}</span>
  );
  const contact = (u: UserRow) => u.email || u.phone || "—";

  return (
    <>
      <PageHeader title="Candidates" breadcrumb="TBT members and imported candidates who take the assessment" />
      <main className="p-6 space-y-4 max-w-6xl mx-auto">
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={UsersIcon} value={stats.totalUsers} label="Total Candidates" />
            <StatCard icon={Trophy} value={stats.completedUsers} label="Completed Assessment" tone="success" />
            <StatCard icon={Clock} value={stats.totalUsers - stats.completedUsers} label="Not Completed" />
          </div>
        )}

        <div className="card flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold mb-1">Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name / Email / Code"
              className="border-2 rounded-lg px-3 py-2 w-full focus:outline-none" style={{ borderColor: "var(--tbt-border)" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="border-2 rounded-lg px-3 py-2 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
              <option value="">All</option>
              <option value="completed">Completed Assessment</option>
              <option value="not-completed">Not Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Batch</label>
            <select value={batch} onChange={(e) => { setBatch(e.target.value); setPage(1); }}
              className="border-2 rounded-lg px-3 py-2 focus:outline-none" style={{ borderColor: "var(--tbt-border)" }}>
              <option value="">All Batches</option>
              {batches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <button onClick={() => { setPage(1); load(); }} className="btn btn-primary btn-sm">Apply</button>
          <button onClick={() => { setSearch(""); setStatus(""); setBatch(""); setPage(1); }} className="btn btn-outline btn-sm">Clear</button>
        </div>

        <div className="card">
          <p className="text-sm mb-3" style={{ color: "var(--tbt-muted)" }}>{total} candidate(s) found</p>
          {/* Wide screens: table (secondary columns only from 1400px, where they fit). */}
          <div className="hidden xl:block table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Email / Phone</th><th className="hidden min-[1400px]:table-cell nowrap">Candidate ID</th><th className="hidden min-[1400px]:table-cell nowrap">Access Code</th><th className="nowrap">Batch</th><th className="nowrap">Source</th><th className="nowrap">Assessment</th><th className="hidden min-[1400px]:table-cell nowrap">Since</th><th className="nowrap">Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u._id}>
                  <td className="font-semibold truncate" style={{ maxWidth: 170 }} title={u.name}>{u.name}</td>
                  <td className="text-xs truncate" style={{ maxWidth: 240 }} title={contact(u)}>{contact(u)}</td>
                  <td className="hidden min-[1400px]:table-cell nowrap"><span className="font-mono text-xs">{u.candidateId || "—"}</span></td>
                  <td className="hidden min-[1400px]:table-cell nowrap"><span className="font-mono text-xs">{u.sharedCode || "—"}</span></td>
                  <td className="nowrap"><span className="text-xs">{u.batch || "—"}</span></td>
                  <td className="nowrap"><SourceBadge u={u} /></td>
                  <td className="nowrap"><span className={`badge ${u.hasCompletedAssessment ? "badge-good" : "badge-pending"}`}>{u.hasCompletedAssessment ? "Completed" : "Pending"}</span></td>
                  <td className="text-xs hidden min-[1400px]:table-cell nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="nowrap"><button onClick={() => setDeleteId(u._id)} className="btn btn-danger btn-sm">Delete</button></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8" style={{ color: "var(--tbt-muted)" }}>No candidates found.</td></tr>
              )}
            </tbody>
          </table>
          </div>

          {/* Narrower screens: one card per candidate. */}
          <div className="xl:hidden space-y-2.5">
            {rows.map((u) => (
              <div key={u._id} className="rounded-xl border p-3" style={{ borderColor: "var(--tbt-border)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: "var(--tbt-text)" }} title={u.name}>{u.name}</p>
                    <p className="text-xs truncate" style={{ color: "var(--tbt-muted)" }} title={contact(u)}>{contact(u)}</p>
                  </div>
                  <button onClick={() => setDeleteId(u._id)} className="btn btn-danger btn-sm shrink-0">Delete</button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <SourceBadge u={u} />
                  <span className={`badge ${u.hasCompletedAssessment ? "badge-good" : "badge-pending"}`}>{u.hasCompletedAssessment ? "Completed" : "Pending"}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5 text-xs" style={{ color: "var(--tbt-muted)" }}>
                  <span>Code: <span className="font-mono" style={{ color: "var(--tbt-text)" }}>{u.sharedCode || "—"}</span></span>
                  <span>Batch: <span style={{ color: "var(--tbt-text)" }}>{u.batch || "—"}</span></span>
                  <span>ID: <span className="font-mono" style={{ color: "var(--tbt-text)" }}>{u.candidateId || "—"}</span></span>
                  <span>Since: <span style={{ color: "var(--tbt-text)" }}>{new Date(u.createdAt).toLocaleDateString()}</span></span>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <p className="text-center py-8 text-sm" style={{ color: "var(--tbt-muted)" }}>No candidates found.</p>
            )}
          </div>
          <div className="flex justify-between items-center mt-4">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-outline btn-sm">← Prev</button>
            <span className="text-sm" style={{ color: "var(--tbt-muted)" }}>Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn btn-outline btn-sm">Next →</button>
          </div>
        </div>
      </main>

      {deleteId && (
        <ConfirmModal
          title="Remove This Candidate?"
          message="This removes the candidate and any assessment in progress. A TBT member can start the assessment again afterwards."
          warning="Submitted assessment results stay in the system for audit purposes."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { Trash2, Bell, X, Loader2, AlertCircle, Users, Send, BarChart2, Search, CheckCircle2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListAppNotifications, useSendAppNotification, useDeleteAppNotification,
  useGetNotificationStats, useListWorkshops, useListBatches,
} from "@/lib/hooks/useTbt";
import { useListMembers } from "@/lib/hooks/useMembers";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

const NOTIF_TYPES = ["info", "success", "warning", "alert"];
const RECIPIENT_TYPES = [
  { value: "all",      label: "All Members"          },
  { value: "specific", label: "Specific Members"      },
  { value: "workshop", label: "By Workshop Enrollment" },
  { value: "batch",    label: "By Batch"              },
];

const labelCls  = "block text-[11px] font-bold text-[#606060] uppercase tracking-widest mb-2 font-rajdhani";
const inputCls  = "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm";
const selectCls = "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm appearance-none";

const typeColor = (t: string) => {
  if (t === "success") return "text-green-400 bg-green-400/10 border-green-400/20";
  if (t === "warning") return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  if (t === "alert")   return "text-red-400 bg-red-400/10 border-red-400/20";
  return "text-blue-400 bg-blue-400/10 border-blue-400/20";
};

const EMPTY_FORM = { title: "", message: "", type: "info", recipientType: "all", workshopId: "", batchId: "" };

export default function AppNotificationsPage() {
  const { data, isLoading, refetch } = useListAppNotifications();
  const sendNotif  = useSendAppNotification();
  const deleteNotif = useDeleteAppNotification();

  const { data: workshopsData } = useListWorkshops();
  const workshops = (workshopsData as any)?.data || [];

  const { data: batchesData } = useListBatches();
  const batches = (batchesData as any)?.data || [];

  const notifications = (data as any)?.data || [];
  const total = (data as any)?.meta?.total || 0;

  // ── Compose form state ────────────────────────────────────────────────
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState<any>(EMPTY_FORM);
  const [selectedMembers, setSelectedMembers] = useState<{ id: string; name: string }[]>([]);
  const [memberSearch, setMemberSearch]       = useState("");
  const [memberDropOpen, setMemberDropOpen]   = useState(false);

  const { data: memberSearchData } = useListMembers({ search: memberSearch, limit: 8 });
  const memberResults = (memberSearchData as any)?.data || [];

  const toggleMember = (m: { id: string; name: string }) => {
    setSelectedMembers(prev =>
      prev.find(x => x.id === m.id) ? prev.filter(x => x.id !== m.id) : [...prev, m]
    );
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setSelectedMembers([]);
    setMemberSearch("");
    setMemberDropOpen(false);
  };

  const handleSend = async () => {
    if (!form.title || !form.message) return toast.error("Title and message are required");
    if (form.recipientType === "specific" && selectedMembers.length === 0) return toast.error("Select at least one member");
    if (form.recipientType === "workshop" && !form.workshopId) return toast.error("Select a workshop");
    if (form.recipientType === "batch" && !form.batchId) return toast.error("Select a batch");
    try {
      const payload: any = { title: form.title, message: form.message, type: form.type, recipientType: form.recipientType };
      if (form.recipientType === "specific")  payload.memberIds  = selectedMembers.map(m => m.id);
      if (form.recipientType === "workshop")  payload.workshopId = form.workshopId;
      if (form.recipientType === "batch")     payload.batchId    = form.batchId;
      await sendNotif.mutateAsync(payload);
      toast.success("Notification sent");
      setShowForm(false);
      resetForm();
      refetch();
    } catch (err: any) { toast.error(err.message || "Failed to send notification"); }
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const [deleting, setDeleting] = useState<string | null>(null);
  const handleDelete = async (id: string) => {
    try { await deleteNotif.mutateAsync(id); toast.success("Notification deleted"); setDeleting(null); refetch(); }
    catch (err: any) { toast.error(err.message || "Failed"); }
  };

  // ── Stats expand ──────────────────────────────────────────────────────
  const [viewingStatsId, setViewingStatsId] = useState<string | null>(null);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
            <div>
              <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">App Notifications</h1>
              <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">Send push notifications to TBT members.</p>
            </div>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 bg-[#dc2626] text-white px-5 py-2.5 rounded-md font-rajdhani font-bold text-[12px] tracking-widest uppercase hover:bg-red-700 transition-all">
            <Send size={14} /> Compose
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-xl flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-[#dc2626]"><Bell size={20} /></div>
            <div>
              <p className="text-[10px] text-[#606060] uppercase font-bold tracking-wider font-rajdhani">Total Sent</p>
              <p className="text-xl font-bold text-[#f0f0f0] font-rajdhani">{total}</p>
            </div>
          </div>
          <div className="bg-[#181818] border border-[#2a2a2a] p-4 rounded-xl flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-blue-400"><Users size={20} /></div>
            <div>
              <p className="text-[10px] text-[#606060] uppercase font-bold tracking-wider font-rajdhani">This Page</p>
              <p className="text-xl font-bold text-[#f0f0f0] font-rajdhani">{notifications.length}</p>
            </div>
          </div>
        </div>

        {/* Sent notifications table */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[#dc2626]" /></div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Bell size={36} className="mx-auto text-[#333]" />
              <p className="text-[#606060] font-rajdhani font-bold uppercase tracking-widest text-sm">No notifications sent yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#1a1a1a] border-b border-[#2a2a2a]">
                  <th className="px-5 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Title</th>
                  <th className="px-4 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Type</th>
                  <th className="px-4 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Sent At</th>
                  <th className="px-4 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Recipients</th>
                  <th className="px-4 py-4 text-left text-[10px] uppercase tracking-[2px] text-[#606060] font-bold font-rajdhani">Read</th>
                  <th className="px-4 py-4 w-[72px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {notifications.map((notif: any) => (
                  <>
                    <tr key={notif.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-bold text-[#f0f0f0] text-sm">{notif.title}</p>
                        <p className="text-[11px] text-[#606060] mt-0.5 truncate max-w-[260px]">{notif.message}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${typeColor(notif.type)}`}>
                          {notif.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[12px] text-[#606060] whitespace-nowrap">
                        {notif.createdAt ? format(new Date(notif.createdAt), "dd MMM yyyy HH:mm") : "—"}
                      </td>
                      <td className="px-4 py-4 text-[13px] font-bold text-[#a0a0a0]">
                        {notif._count?.recipients ?? "—"}
                      </td>
                      <td className="px-4 py-4">
                        <NotifReadCount notifId={notif.id} visible={viewingStatsId === notif.id} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingStatsId(viewingStatsId === notif.id ? null : notif.id)}
                            title="View stats"
                            className={`p-1.5 rounded transition-all ${viewingStatsId === notif.id ? "text-blue-400 bg-blue-400/10" : "text-[#444] hover:text-blue-400 hover:bg-blue-400/10"}`}
                          >
                            <BarChart2 size={14} />
                          </button>
                          <button onClick={() => setDeleting(notif.id)} className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-400/10 rounded transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {viewingStatsId === notif.id && (
                      <tr key={`${notif.id}-stats`} className="bg-[#111]">
                        <td colSpan={6} className="px-5 py-0">
                          <NotifStats notifId={notif.id} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── COMPOSE MODAL ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-[#2a2a2a] flex justify-between items-center bg-[#1a1a1a]">
              <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">Compose Notification</h3>
              <button onClick={() => setShowForm(false)} className="text-[#606060] hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">

              <div>
                <label className={labelCls}>Title *</label>
                <input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Message *</label>
                <textarea value={form.message} onChange={e => setForm((f: any) => ({ ...f, message: e.target.value }))} rows={3} className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Type</label>
                  <select value={form.type} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value }))} className={selectCls}>
                    {NOTIF_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Recipients</label>
                  <select value={form.recipientType} onChange={e => { setForm((f: any) => ({ ...f, recipientType: e.target.value })); setSelectedMembers([]); setMemberSearch(""); }} className={selectCls}>
                    {RECIPIENT_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Specific members — search + chips */}
              {form.recipientType === "specific" && (
                <div>
                  <label className={labelCls}>Members *</label>
                  {selectedMembers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedMembers.map(m => (
                        <span key={m.id} className="flex items-center gap-1 bg-[#dc2626]/10 border border-[#dc2626]/20 text-[#f0f0f0] text-[11px] px-2 py-1 rounded-full">
                          {m.name}
                          <button type="button" onClick={() => toggleMember(m)} className="text-[#dc2626] hover:text-red-300"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 focus-within:border-[#dc2626] transition-all">
                      <Search size={13} className="text-[#444] shrink-0" />
                      <input
                        value={memberSearch}
                        onChange={e => { setMemberSearch(e.target.value); setMemberDropOpen(true); }}
                        onFocus={() => setMemberDropOpen(true)}
                        placeholder="Search members..."
                        className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[#444]"
                      />
                    </div>
                    {memberDropOpen && memberSearch && memberResults.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {memberResults.map((m: any) => {
                          const fullName = `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email;
                          const isSelected = selectedMembers.some(x => x.id === m.id);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => { toggleMember({ id: m.id, name: fullName }); setMemberSearch(""); setMemberDropOpen(false); }}
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
                            >
                              <div>
                                <p className="text-[13px] font-bold text-[#f0f0f0]">{fullName}</p>
                                <p className="text-[11px] text-[#444]">{m.email}</p>
                              </div>
                              {isSelected && <CheckCircle2 size={14} className="text-[#dc2626] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {selectedMembers.length > 0 && (
                    <p className="text-[11px] text-[#444] mt-1">{selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""} selected</p>
                  )}
                </div>
              )}

              {/* Workshop dropdown */}
              {form.recipientType === "workshop" && (
                <div>
                  <label className={labelCls}>Workshop *</label>
                  <select value={form.workshopId} onChange={e => setForm((f: any) => ({ ...f, workshopId: e.target.value }))} className={selectCls}>
                    <option value="">Select a workshop...</option>
                    {workshops.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Batch dropdown */}
              {form.recipientType === "batch" && (
                <div>
                  <label className={labelCls}>Batch *</label>
                  <select value={form.batchId} onChange={e => setForm((f: any) => ({ ...f, batchId: e.target.value }))} className={selectCls}>
                    <option value="">Select a batch...</option>
                    {batches.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name || b.label || b.id}</option>
                    ))}
                  </select>
                </div>
              )}

            </div>
            <div className="px-6 py-4 border-t border-[#2a2a2a] bg-[#1a1a1a] flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-6 py-2 text-[#606060] hover:text-white font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleSend} disabled={sendNotif.isPending} className="bg-[#dc2626] hover:bg-red-700 text-white px-8 py-2 rounded-md font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all flex items-center gap-2">
                {sendNotif.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ─────────────────────────────────────────────────── */}
      {deleting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl">
            <AlertCircle className="text-red-500 mx-auto mb-4" size={36} />
            <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0] mb-2">Delete Notification?</h3>
            <p className="text-[#606060] text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-[#a0a0a0] font-rajdhani font-bold text-[12px] uppercase tracking-widest hover:text-white transition-all">Cancel</button>
              <button onClick={() => handleDelete(deleting)} className="flex-1 py-2.5 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg font-rajdhani font-bold text-[12px] uppercase tracking-widest transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function NotifReadCount({ notifId, visible }: { notifId: string; visible: boolean }) {
  const { data, isLoading } = useGetNotificationStats(notifId);
  const stats = (data as any)?.data;
  if (!visible) return <span className="text-[#333] text-sm">—</span>;
  if (isLoading) return <Loader2 size={12} className="animate-spin text-[#444]" />;
  if (!stats) return <span className="text-[#333] text-sm">—</span>;
  return <span className="text-[13px] font-bold text-green-400">{stats.read ?? stats.readCount ?? 0}</span>;
}

function NotifStats({ notifId }: { notifId: string }) {
  const { data, isLoading } = useGetNotificationStats(notifId);
  const stats = (data as any)?.data;
  if (isLoading) return (
    <div className="flex items-center gap-2 py-3 text-[#606060] text-sm">
      <Loader2 size={13} className="animate-spin" /> Loading stats...
    </div>
  );
  if (!stats) return null;
  const total = stats.total ?? stats.totalRecipients ?? 0;
  const read  = stats.read  ?? stats.readCount     ?? 0;
  const readRate = total > 0 ? Math.round((read / total) * 100) : 0;
  return (
    <div className="flex items-center gap-8 py-3">
      <div>
        <p className="text-[10px] text-[#444] uppercase font-bold tracking-widest font-rajdhani">Recipients</p>
        <p className="text-lg font-bold text-[#f0f0f0] font-rajdhani">{total}</p>
      </div>
      <div>
        <p className="text-[10px] text-[#444] uppercase font-bold tracking-widest font-rajdhani">Read</p>
        <p className="text-lg font-bold text-green-400 font-rajdhani">{read}</p>
      </div>
      <div>
        <p className="text-[10px] text-[#444] uppercase font-bold tracking-widest font-rajdhani">Unread</p>
        <p className="text-lg font-bold text-[#606060] font-rajdhani">{total - read}</p>
      </div>
      <div className="flex-1 max-w-[200px]">
        <p className="text-[10px] text-[#444] uppercase font-bold tracking-widest font-rajdhani mb-1">Read Rate {readRate}%</p>
        <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${readRate}%` }} />
        </div>
      </div>
    </div>
  );
}

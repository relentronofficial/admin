"use client";

// Weekly Activity Graph — member-first. The admin selects a member; the
// backend resolves that member's batch and program (members.batch_id →
// batches.program_id, the same mapping the member's own graph uses), and the
// page loads that program's weeks, milestones and activities. There is no
// program picker: an admin can never record against the wrong program.
// Everything is stored on the backend (/api/weekly-graph/admin) and the member
// graph on /batch-program reads it on every load — no redeploy per change.
// Role rules are enforced server-side; the UI surfaces the server's messages.
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Plus, Loader2, X, Edit2, Trash2, GripVertical, CheckCircle2, Eye, EyeOff, Search, Sparkles, AlertTriangle, UserRound } from "lucide-react";
import { toast } from "react-hot-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListMembers } from "@/lib/hooks/useMembers";
import {
  useWeeklyGraphConfig,
  useInitializeWeeklyGraph,
  useSaveGraphWeek,
  useDeleteGraphWeek,
  useReorderGraphWeeks,
  useSaveGraphMilestone,
  useDeleteGraphMilestone,
  useReorderGraphMilestones,
  useSaveGraphActivity,
  useGraphMemberRecords,
  useSaveGraphMemberRecord,
  useDeleteGraphMemberRecord,
  type GraphActivityItem,
  type GraphMemberProgram,
  type GraphMemberRecord,
  type GraphMilestoneItem,
  type GraphMilestoneKind,
  type GraphWeekItem,
  type WeeklyGraphConfig,
} from "@/lib/hooks/useTbt";
import { cn } from "@/lib/utils";

const LABEL = "text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani";
const INPUT = "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626]";
const CARD = "bg-[#181818] border border-[#2a2a2a] rounded-xl";
const BTN = "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50";
const BTN_PRIMARY = cn(BTN, "bg-[#dc2626] hover:bg-red-700 text-white");
const BTN_GHOST = cn(BTN, "bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] hover:text-white");
const ICON_BTN = "p-1.5 rounded-md text-[#a0a0a0] hover:text-white hover:bg-[#222] disabled:opacity-40";

const errMsg = (e: any, fallback: string) => e?.message || fallback;

export default function WeeklyGraphPage() {
  // The only selection on the page. The program comes from the member.
  const [memberId, setMemberId] = useState("");
  const { data: memberData, isLoading: memberLoading, isError: memberIsError, error: memberError } = useGraphMemberRecords(memberId);
  const member = memberData?.member ?? null;
  const programId = memberData && !memberData.noProgramReason ? member?.programId ?? "" : "";

  const { data: config, isLoading, isError, error, refetch } = useWeeklyGraphConfig(programId);
  const initialize = useInitializeWeeklyGraph(programId);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl">
        <div>
          <h1 className="font-rajdhani text-2xl font-bold uppercase tracking-tight text-[#f0f0f0] flex items-center gap-2">
            <BarChart3 size={22} className="text-[#dc2626]" /> Weekly Graph
          </h1>
          <p className="text-[13px] text-[#a0a0a0] mt-1">
            Select a member to view and record their milestones. Their batch and program are picked up automatically. Changes are live on the member&apos;s next load.
          </p>
        </div>

        <section className={CARD}>
          <SectionHeader title="Member milestones" hint="Search a member by name or phone. Their batch and program are loaded automatically." />
          <div className="px-5 pb-5 space-y-4">
            <MemberPicker selected={memberId} onSelect={setMemberId} />

            {memberId && memberLoading && <p className="text-[13px] text-[#a0a0a0] flex items-center"><Loader2 size={14} className="animate-spin mr-2" /> Loading member…</p>}
            {memberId && memberIsError && <p className="text-[13px] text-[#ef4444]">{errMsg(memberError, "Could not load this member")}</p>}

            {member && <MemberSummary member={member} />}

            {memberData?.noProgramReason && (
              <div className="flex items-start gap-2 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-4 py-3 text-[13px] text-[#fca5a5]">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#ef4444]" />
                <span>{memberData.noProgramReason} Milestones can&apos;t be recorded until then.</span>
              </div>
            )}

            {programId && isLoading && <p className="text-[13px] text-[#a0a0a0] flex items-center"><Loader2 size={14} className="animate-spin mr-2" /> Loading the program&apos;s milestones…</p>}
            {programId && isError && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[#ef4444] text-[13px]">{errMsg(error, "Could not load the program configuration.")}</p>
                <button className={BTN_GHOST} onClick={() => refetch()}>Retry</button>
              </div>
            )}

            {member && memberData && config && config.program.id === member.programId && (
              <MemberRecords member={member} records={memberData.records} config={config} />
            )}
          </div>
        </section>

        {member && config && config.program.id === member.programId && (
          <>
            <div className="pt-2">
              <h2 className="font-rajdhani text-xl font-bold uppercase tracking-tight text-[#f0f0f0]">Program settings · {config.program.name}</h2>
              <p className="text-[12px] text-[#f59e0b] mt-0.5">These apply to every member of {config.program.name}, not just {member.firstName}.</p>
            </div>
            {!config.saved ? (
              <div className={cn(CARD, "p-5 flex flex-wrap items-center justify-between gap-4 border-[#f59e0b]/40")}>
                <div>
                  <p className="text-[#f0f0f0] font-semibold flex items-center gap-2"><Sparkles size={16} className="text-[#f59e0b]" /> Using the built-in defaults</p>
                  <p className="text-[13px] text-[#a0a0a0] mt-1">
                    Members of {config.program.name} currently see 7-day weeks and the five default milestones below. Start customizing to save them as editable items.
                  </p>
                </div>
                <button
                  className={BTN_PRIMARY}
                  disabled={initialize.isPending}
                  onClick={() => initialize.mutateAsync().then(() => toast.success("Defaults saved — you can now edit them"), (e) => toast.error(errMsg(e, "Could not save the defaults")))}
                >
                  {initialize.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Start customizing
                </button>
              </div>
            ) : (
              <p className="text-[12px] text-[#22c55e] flex items-center gap-1.5"><CheckCircle2 size={14} /> All changes are saved to the server.</p>
            )}

            <WeeksSection config={config} programId={programId} />
            <MilestonesSection config={config} programId={programId} />
            <ActivitiesSection config={config} programId={programId} />
          </>
        )}

        {!memberId && (
          <div className={cn(CARD, "p-8 text-center text-[13px] text-[#606060]")}>
            <UserRound size={22} className="mx-auto mb-2 text-[#404040]" />
            Select a member above to see their milestones and their program&apos;s graph settings.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ── Shared: reorderable list ─────────────────────────────────────────────────

function useReorderable<T extends { id: string | null }>(items: T[]) {
  const [local, setLocal] = useState<T[]>(items);
  const [dirty, setDirty] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  useEffect(() => { setLocal(items); setDirty(false); }, [items]);
  const onDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === dropIdx) { setDragOver(null); return; }
    const next = [...local];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setLocal(next);
    setDirty(true);
    dragIdx.current = null;
    setDragOver(null);
  };
  const rowProps = (i: number, enabled: boolean) => enabled ? {
    draggable: true,
    onDragStart: () => { dragIdx.current = i; },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(i); },
    onDragLeave: () => setDragOver(null),
    onDrop: (e: React.DragEvent) => onDrop(e, i),
  } : {};
  const cancel = () => { setLocal(items); setDirty(false); };
  return { local, dirty, dragOver, rowProps, cancel, setDirty };
}

function SectionHeader({ title, hint, children }: { title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div>
        <h2 className="font-rajdhani text-lg font-bold uppercase tracking-tight text-[#f0f0f0]">{title}</h2>
        <p className="text-[12px] text-[#606060] mt-0.5">{hint}</p>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function OrderBar({ dirty, saving, onSave, onCancel }: { dirty: boolean; saving: boolean; onSave: () => void; onCancel: () => void }) {
  if (!dirty) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-[#f59e0b]">Unsaved order</span>
      <button className={BTN_GHOST} onClick={onCancel} disabled={saving}>Cancel</button>
      <button className={BTN_PRIMARY} onClick={onSave} disabled={saving}>{saving && <Loader2 size={14} className="animate-spin" />} Save order</button>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded", active ? "bg-[#22c55e]/15 text-[#22c55e]" : "bg-[#606060]/20 text-[#a0a0a0]")}>
      {active ? "Active" : "Disabled"}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h3 className="font-rajdhani font-bold uppercase tracking-widest text-[#f0f0f0]">{title}</h3>
          <button className={ICON_BTN} onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function FormActions({ saving, onCancel, error }: { saving: boolean; onCancel: () => void; error: string | null }) {
  return (
    <>
      {error && <p className="text-[13px] text-[#ef4444]">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className={BTN_GHOST} onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className={BTN_PRIMARY} disabled={saving}>{saving && <Loader2 size={14} className="animate-spin" />} Save</button>
      </div>
    </>
  );
}

const needsSaved = (config: WeeklyGraphConfig) => !config.saved
  ? "Click “Start customizing” first so every item has a stable id."
  : null;

// ── Weeks ────────────────────────────────────────────────────────────────────

function WeeksSection({ config, programId }: { config: WeeklyGraphConfig; programId: string }) {
  const save = useSaveGraphWeek(programId);
  const del = useDeleteGraphWeek(programId);
  const reorder = useReorderGraphWeeks(programId);
  const { local, dirty, dragOver, rowProps, cancel } = useReorderable(config.weeks);
  const [editing, setEditing] = useState<GraphWeekItem | "new" | null>(null);
  const nextStart = Math.max(0, ...config.weeks.map((w) => w.endDay)) + 1;

  const toggle = async (w: GraphWeekItem) => {
    if (w.isActive && !window.confirm(`Disable "${w.label}"? It and its activities disappear from members' graphs. Nothing is deleted — you can enable it again.`)) return;
    try { await save.mutateAsync({ id: w.id, isActive: !w.isActive }); toast.success(w.isActive ? "Week disabled" : "Week enabled"); }
    catch (e) { toast.error(errMsg(e, "Could not update the week")); }
  };
  const remove = async (w: GraphWeekItem) => {
    if (!window.confirm(`Delete "${w.label}" permanently? Weeks with activities or member records can only be disabled.`)) return;
    try { await del.mutateAsync(w.id!); toast.success("Week deleted"); } catch (e) { toast.error(errMsg(e, "Could not delete the week")); }
  };

  return (
    <section className={CARD}>
      <SectionHeader title="Weeks (X axis)" hint="Each week covers a range of program days. Activities on those days appear in that week. Drag to reorder.">
        <OrderBar dirty={dirty} saving={reorder.isPending} onCancel={cancel}
          onSave={() => reorder.mutateAsync(local.map((w) => w.id!)).then(() => toast.success("Week order saved"), (e) => toast.error(errMsg(e, "Could not save the order")))} />
        {!dirty && <button className={BTN_PRIMARY} onClick={() => setEditing("new")}><Plus size={14} /> Add week</button>}
      </SectionHeader>
      {local.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-[#606060]">No weeks yet. Add the first week, e.g. W1 · days 1–7.</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead><tr className="border-y border-[#2a2a2a] bg-[#1a1a1a]">
            {["", "Label", "Days", "Status", ""].map((h, i) => <th key={i} className={cn(LABEL, "text-left px-4 py-2")}>{h}</th>)}
          </tr></thead>
          <tbody>
            {local.map((w, i) => (
              <tr key={w.id ?? `d${i}`} {...rowProps(i, config.saved)} className={cn("border-b border-[#222]", dragOver === i && "bg-[#dc2626]/10", !w.isActive && "opacity-60")}>
                <td className="px-4 py-2 w-8 text-[#606060]">{config.saved && <GripVertical size={14} className="cursor-grab" />}</td>
                <td className="px-4 py-2 text-[#f0f0f0] font-semibold">{w.label}</td>
                <td className="px-4 py-2 text-[#a0a0a0]">Day {w.startDay}–{w.endDay}</td>
                <td className="px-4 py-2"><StatusPill active={w.isActive} /></td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button className={ICON_BTN} disabled={!config.saved} title={needsSaved(config) ?? "Edit"} onClick={() => setEditing(w)}><Edit2 size={14} /></button>
                  <button className={ICON_BTN} disabled={!config.saved} title={w.isActive ? "Disable" : "Enable"} onClick={() => toggle(w)}>{w.isActive ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  <button className={ICON_BTN} disabled={!config.saved} title="Delete" onClick={() => remove(w)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <WeekForm
          initial={editing === "new" ? { id: null, label: `W${config.weeks.length + 1}`, startDay: nextStart, endDay: nextStart + 6, sortOrder: 0, isActive: true } : editing}
          isNew={editing === "new"}
          onClose={() => setEditing(null)}
          onSave={async (v) => { await save.mutateAsync(v); toast.success(editing === "new" ? "Week added" : "Week saved"); setEditing(null); }}
        />
      )}
    </section>
  );
}

function WeekForm({ initial, isNew, onClose, onSave }: {
  initial: GraphWeekItem; isNew: boolean; onClose: () => void; onSave: (v: { id: string | null; label: string; startDay: number; endDay: number }) => Promise<void>;
}) {
  const [label, setLabel] = useState(initial.label);
  const [startDay, setStartDay] = useState(String(initial.startDay));
  const [endDay, setEndDay] = useState(String(initial.endDay));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = Number(startDay), en = Number(endDay);
    if (!label.trim()) return setError("Label is required");
    if (!Number.isInteger(s) || !Number.isInteger(en) || s < 1 || en < s) return setError("Enter whole days, with the end day on or after the start day");
    setSaving(true); setError(null);
    try { await onSave({ id: isNew ? null : initial.id, label: label.trim(), startDay: s, endDay: en }); }
    catch (err) { setError(errMsg(err, "Could not save the week")); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={isNew ? "Add week" : "Edit week"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className={LABEL}>Label</label><input className={cn(INPUT, "mt-1")} value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} autoFocus /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={LABEL}>Start day</label><input type="number" min={1} className={cn(INPUT, "mt-1")} value={startDay} onChange={(e) => setStartDay(e.target.value)} /></div>
          <div><label className={LABEL}>End day</label><input type="number" min={1} className={cn(INPUT, "mt-1")} value={endDay} onChange={(e) => setEndDay(e.target.value)} /></div>
        </div>
        <FormActions saving={saving} onCancel={onClose} error={error} />
      </form>
    </Modal>
  );
}

// ── Milestones ───────────────────────────────────────────────────────────────

function MilestonesSection({ config, programId }: { config: WeeklyGraphConfig; programId: string }) {
  const save = useSaveGraphMilestone(programId);
  const del = useDeleteGraphMilestone(programId);
  const reorder = useReorderGraphMilestones(programId);
  const { local, dirty, dragOver, rowProps, cancel } = useReorderable(config.milestones);
  const [editing, setEditing] = useState<GraphMilestoneItem | "new" | null>(null);
  const firstRevenue = local.findIndex((m) => m.isActive && m.kind === "revenue");
  const activityAfterRevenue = firstRevenue >= 0 && local.some((m, i) => i > firstRevenue && m.isActive && m.kind === "activity");

  const toggle = async (m: GraphMilestoneItem) => {
    if (m.isActive && !window.confirm(`Disable "${m.label}"? It is removed from the graph's axis. Linked activities and member records are kept.`)) return;
    try { await save.mutateAsync({ id: m.id, isActive: !m.isActive }); toast.success(m.isActive ? "Milestone disabled" : "Milestone enabled"); }
    catch (e) { toast.error(errMsg(e, "Could not update the milestone")); }
  };
  const remove = async (m: GraphMilestoneItem) => {
    if (!window.confirm(`Delete "${m.label}" permanently? Milestones linked to activities or member records can only be disabled.`)) return;
    try { await del.mutateAsync(m.id!); toast.success("Milestone deleted"); } catch (e) { toast.error(errMsg(e, "Could not delete the milestone")); }
  };

  return (
    <section className={CARD}>
      <SectionHeader title="Milestones (Y axis, bottom → top)" hint="Activity milestones are reached by approved tasks. Revenue milestones are reached only when an admin records them for a member.">
        <OrderBar dirty={dirty} saving={reorder.isPending} onCancel={cancel}
          onSave={() => reorder.mutateAsync(local.map((m) => m.id!)).then(() => toast.success("Milestone order saved"), (e) => toast.error(errMsg(e, "Could not save the order")))} />
        {!dirty && <button className={BTN_PRIMARY} onClick={() => setEditing("new")}><Plus size={14} /> Add milestone</button>}
      </SectionHeader>
      {activityAfterRevenue && (
        <p className="mx-5 mb-3 text-[12px] text-[#f59e0b]">An activity milestone sits above a revenue milestone — tasks can&apos;t reach it (only an admin record can). Drag it below the revenue milestones if that isn&apos;t intended.</p>
      )}
      {local.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-[#606060]">No milestones — members will see the five defaults until you add one.</p>
      ) : (
        <table className="w-full text-[13px]">
          <thead><tr className="border-y border-[#2a2a2a] bg-[#1a1a1a]">
            {["", "Label", "Type", "Status", ""].map((h, i) => <th key={i} className={cn(LABEL, "text-left px-4 py-2")}>{h}</th>)}
          </tr></thead>
          <tbody>
            {local.map((m, i) => (
              <tr key={m.id ?? `d${i}`} {...rowProps(i, config.saved)} className={cn("border-b border-[#222]", dragOver === i && "bg-[#dc2626]/10", !m.isActive && "opacity-60")}>
                <td className="px-4 py-2 w-8 text-[#606060]">{config.saved && <GripVertical size={14} className="cursor-grab" />}</td>
                <td className="px-4 py-2 text-[#f0f0f0] font-semibold">{m.label}</td>
                <td className="px-4 py-2 text-[#a0a0a0]">{m.kind === "revenue" ? "Revenue (admin-recorded)" : "Activity"}</td>
                <td className="px-4 py-2"><StatusPill active={m.isActive} /></td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button className={ICON_BTN} disabled={!config.saved} title={needsSaved(config) ?? "Edit"} onClick={() => setEditing(m)}><Edit2 size={14} /></button>
                  <button className={ICON_BTN} disabled={!config.saved} title={m.isActive ? "Disable" : "Enable"} onClick={() => toggle(m)}>{m.isActive ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  <button className={ICON_BTN} disabled={!config.saved} title="Delete" onClick={() => remove(m)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <MilestoneForm
          initial={editing === "new" ? { id: null, label: "", kind: "activity", sortOrder: 0, isActive: true } : editing}
          isNew={editing === "new"}
          onClose={() => setEditing(null)}
          onSave={async (v) => { await save.mutateAsync(v); toast.success(editing === "new" ? "Milestone added" : "Milestone saved"); setEditing(null); }}
        />
      )}
    </section>
  );
}

function MilestoneForm({ initial, isNew, onClose, onSave }: {
  initial: GraphMilestoneItem; isNew: boolean; onClose: () => void; onSave: (v: { id: string | null; label: string; kind: GraphMilestoneKind }) => Promise<void>;
}) {
  const [label, setLabel] = useState(initial.label);
  const [kind, setKind] = useState<GraphMilestoneKind>(initial.kind);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return setError("Label is required");
    setSaving(true); setError(null);
    try { await onSave({ id: isNew ? null : initial.id, label: label.trim(), kind }); }
    catch (err) { setError(errMsg(err, "Could not save the milestone")); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={isNew ? "Add milestone" : "Edit milestone"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className={LABEL}>Label</label><input className={cn(INPUT, "mt-1")} value={label} maxLength={60} placeholder="e.g. ₹5 Lakhs or Sales Automation" onChange={(e) => setLabel(e.target.value)} autoFocus /></div>
        <div>
          <label className={LABEL}>Type</label>
          <select className={cn(INPUT, "mt-1")} value={kind} onChange={(e) => setKind(e.target.value as GraphMilestoneKind)}>
            <option value="activity">Activity — reached by approved tasks</option>
            <option value="revenue">Revenue — reached only by an admin record</option>
          </select>
        </div>
        {!isNew && <p className="text-[12px] text-[#606060]">Renaming keeps every linked activity and member record.</p>}
        <FormActions saving={saving} onCancel={onClose} error={error} />
      </form>
    </Modal>
  );
}

// ── Activities ───────────────────────────────────────────────────────────────

function ActivitiesSection({ config, programId }: { config: WeeklyGraphConfig; programId: string }) {
  const save = useSaveGraphActivity(programId);
  const [editing, setEditing] = useState<GraphActivityItem | "new" | null>(null);
  const weekName = (a: GraphActivityItem) =>
    config.weeks.find((w) => (a.weekId ? w.id === a.weekId : w.startDay <= a.dayNumber && a.dayNumber <= w.endDay))?.label ?? `Day ${a.dayNumber}`;
  const msName = (a: GraphActivityItem) => config.milestones.find((m) => m.id && m.id === a.milestoneId)?.label ?? (a.isMilestone ? a.milestoneLabel : null);

  const toggle = async (a: GraphActivityItem) => {
    if (a.isActive && !window.confirm(`Disable "${a.title}"? It is hidden from members. Submissions and reviews are kept.`)) return;
    try { await save.mutateAsync({ id: a.id, isActive: !a.isActive }); toast.success(a.isActive ? "Activity disabled" : "Activity enabled"); }
    catch (e) { toast.error(errMsg(e, "Could not update the activity")); }
  };

  return (
    <section className={CARD}>
      <SectionHeader title="Activities" hint="Program-level tasks. Moving an activity to another week moves it to that week's first day; submissions are kept. Batch-specific tasks are managed on the batch page.">
        <button className={BTN_PRIMARY} disabled={!config.saved} title={needsSaved(config) ?? ""} onClick={() => setEditing("new")}><Plus size={14} /> Add activity</button>
      </SectionHeader>
      {config.activities.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-[#606060]">No activities in this program yet.</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0"><tr className="border-y border-[#2a2a2a] bg-[#1a1a1a]">
              {["Activity", "Week", "Milestone", "Status", ""].map((h, i) => <th key={i} className={cn(LABEL, "text-left px-4 py-2")}>{h}</th>)}
            </tr></thead>
            <tbody>
              {config.activities.map((a) => (
                <tr key={a.id} className={cn("border-b border-[#222]", !a.isActive && "opacity-60")}>
                  <td className="px-4 py-2 text-[#f0f0f0]">
                    {a.title}
                    {a.memberId && <span className="ml-2 text-[10px] uppercase tracking-widest text-[#a78bfa]">member-specific</span>}
                    {!a.isRequired && <span className="ml-2 text-[10px] uppercase tracking-widest text-[#606060]">optional</span>}
                  </td>
                  <td className="px-4 py-2 text-[#a0a0a0]">{weekName(a)}</td>
                  <td className="px-4 py-2 text-[#a0a0a0]">{msName(a) ?? "—"}</td>
                  <td className="px-4 py-2"><StatusPill active={a.isActive} /></td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button className={ICON_BTN} disabled={!config.saved} title={needsSaved(config) ?? "Edit"} onClick={() => setEditing(a)}><Edit2 size={14} /></button>
                    <button className={ICON_BTN} disabled={!config.saved} title={a.isActive ? "Disable" : "Enable"} onClick={() => toggle(a)}>{a.isActive ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <ActivityForm
          config={config}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => { await save.mutateAsync(v); toast.success(editing === "new" ? "Activity added" : "Activity saved"); setEditing(null); }}
        />
      )}
    </section>
  );
}

function ActivityForm({ config, initial, onClose, onSave }: {
  config: WeeklyGraphConfig; initial: GraphActivityItem | null; onClose: () => void;
  onSave: (v: { id?: string; title: string; weekId: string | null; milestoneId: string | null; isRequired: boolean }) => Promise<void>;
}) {
  const currentWeek = initial
    ? initial.weekId ?? config.weeks.find((w) => w.startDay <= initial.dayNumber && initial.dayNumber <= w.endDay)?.id ?? ""
    : config.weeks.find((w) => w.isActive)?.id ?? "";
  const [title, setTitle] = useState(initial?.title ?? "");
  const [weekId, setWeekId] = useState<string>(currentWeek ?? "");
  const [milestoneId, setMilestoneId] = useState<string>(initial?.milestoneId ?? "");
  const [isRequired, setIsRequired] = useState(initial?.isRequired ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Title is required");
    if (!weekId) return setError("Choose a week");
    setSaving(true); setError(null);
    try { await onSave({ id: initial?.id, title: title.trim(), weekId, milestoneId: milestoneId || null, isRequired }); }
    catch (err) { setError(errMsg(err, "Could not save the activity")); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={initial ? "Edit activity" : "Add activity"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className={LABEL}>Title</label><input className={cn(INPUT, "mt-1")} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} autoFocus /></div>
        <div>
          <label className={LABEL}>Week</label>
          <select className={cn(INPUT, "mt-1")} value={weekId} onChange={(e) => setWeekId(e.target.value)}>
            <option value="">Choose a week…</option>
            {config.weeks.filter((w) => w.isActive || w.id === weekId).map((w) => <option key={w.id!} value={w.id!}>{w.label} · days {w.startDay}–{w.endDay}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Milestone (optional)</label>
          <select className={cn(INPUT, "mt-1")} value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
            <option value="">None</option>
            {config.milestones.filter((m) => (m.isActive && m.kind === "activity") || m.id === milestoneId).map((m) => <option key={m.id!} value={m.id!}>{m.label}</option>)}
          </select>
          <p className="text-[11px] text-[#606060] mt-1">When approved, the activity lifts its week to this milestone.</p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[#a0a0a0]">
          <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} /> Required
        </label>
        <FormActions saving={saving} onCancel={onClose} error={error} />
      </form>
    </Modal>
  );
}

// ── Member milestones (admin-recorded) ───────────────────────────────────────

const memberName = (m: { firstName: string; lastName?: string | null }) => `${m.firstName} ${m.lastName ?? ""}`.trim();

/** Search by name or phone; picking a result is the page's only selection step. */
function MemberPicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const { data: membersRes, isFetching } = useListMembers({ search, limit: 8 }, { enabled: search.trim().length >= 2 && !selected });
  const results: any[] = membersRes?.data || [];
  return (
    <div className="space-y-2">
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
        <input className={cn(INPUT, "pl-9")} placeholder="Search a member by name or phone…" value={search}
          onChange={(e) => { setSearch(e.target.value); if (selected) onSelect(""); }} />
        {search.trim().length >= 2 && !selected && (
          <div className="absolute z-10 mt-1 w-full bg-[#141414] border border-[#2a2a2a] rounded-lg max-h-64 overflow-y-auto">
            {isFetching && <p className="p-3 text-[12px] text-[#606060]">Searching…</p>}
            {!isFetching && results.length === 0 && <p className="p-3 text-[12px] text-[#606060]">No members found</p>}
            {results.map((m) => (
              <button key={m.id} className="w-full text-left px-3 py-2 hover:bg-[#1f1f1f] text-[13px] text-[#f0f0f0]"
                onClick={() => { onSelect(m.id); setSearch(memberName(m)); }}>
                {m.firstName} {m.lastName} <span className="text-[#606060]">· {m.phone} {m.batch?.name ? `· ${m.batch.name}` : "· no batch"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <button className="text-[12px] text-[#a0a0a0] underline" onClick={() => { onSelect(""); setSearch(""); }}>Choose another member</button>
      )}
    </div>
  );
}

/** Read-only: where the member's milestones will be saved. Nothing here is editable. */
function MemberSummary({ member }: { member: GraphMemberProgram }) {
  const cell = (label: string, value: string | null, missing: string) => (
    <div>
      <p className={LABEL}>{label}</p>
      <p className={cn("mt-1 text-[13px]", value ? "text-[#f0f0f0]" : "text-[#ef4444]")}>{value ?? missing}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] px-4 py-3">
      {cell("Member", memberName(member), "—")}
      {cell("Phone", member.phone, "—")}
      {cell("Batch", member.batchName, "No batch")}
      {cell("Program", member.programName, member.batchId ? "Batch not linked" : "—")}
    </div>
  );
}

function MemberRecords({ member, records, config }: { member: GraphMemberProgram; records: GraphMemberRecord[]; config: WeeklyGraphConfig }) {
  const saveRecord = useSaveGraphMemberRecord(member.id);
  const delRecord = useDeleteGraphMemberRecord(member.id);
  const initialize = useInitializeWeeklyGraph(config.program.id);
  const [milestone, setMilestone] = useState("");
  const [week, setWeek] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => { setMilestone(""); setWeek(""); setNote(""); }, [member.id]);
  const activeMs = useMemo(() => config.milestones.filter((m) => m.isActive && m.id), [config.milestones]);
  const activeWeeks = useMemo(() => config.weeks.filter((w) => w.isActive && w.id), [config.weeks]);
  // One record per milestone (the server upserts) — say so before the admin overwrites one.
  const existing = records.find((r) => r.milestoneId === milestone);

  const record = async () => {
    if (!milestone || !week) return toast.error("Choose a milestone and a week");
    try {
      await saveRecord.mutateAsync({ milestoneId: milestone, weekId: week, note: note || undefined });
      toast.success(existing ? "Milestone updated" : "Milestone recorded");
      setNote("");
    } catch (e) { toast.error(errMsg(e, "Could not record the milestone")); }
  };
  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Remove "${label}" from ${member.firstName}'s graph?`)) return;
    try { await delRecord.mutateAsync(id); toast.success("Record removed"); } catch (e) { toast.error(errMsg(e, "Could not remove the record")); }
  };

  return (
    <div className="space-y-4">
      {records.length === 0 ? (
        <p className="text-[13px] text-[#606060]">No milestones recorded for {member.firstName} yet.</p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => {
            const otherProgram = !!r.programId && r.programId !== config.program.id;
            return (
              <li key={r.id} className={cn("flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[13px]", otherProgram && "opacity-60")}>
                <span className="text-[#f0f0f0]">
                  {r.milestoneLabel}{r.kind === "revenue" && <span className="text-[#606060]"> (revenue)</span>}
                  <span className="text-[#606060]"> · {r.weekLabel ?? "week removed"}{r.note ? ` · ${r.note}` : ""}{r.recordedBy ? ` · by ${r.recordedBy}` : ""}</span>
                  {otherProgram && <span className="ml-2 text-[10px] uppercase tracking-widest text-[#f59e0b]">previous program · not on their graph</span>}
                </span>
                <span className="flex items-center gap-1">
                  {!otherProgram && (
                    <button className={ICON_BTN} title="Edit" onClick={() => { setMilestone(r.milestoneId); setWeek(r.weekId ?? ""); setNote(r.note ?? ""); }}><Edit2 size={14} /></button>
                  )}
                  <button className={ICON_BTN} title="Remove" onClick={() => remove(r.id, r.milestoneLabel)}><Trash2 size={14} /></button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {!config.saved ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[12px] text-[#f59e0b]">{config.program.name} still uses the built-in defaults. Save them once so each milestone and week has a stable id.</p>
          <button className={BTN_PRIMARY} disabled={initialize.isPending}
            onClick={() => initialize.mutateAsync().then(() => toast.success("Defaults saved"), (e) => toast.error(errMsg(e, "Could not save the defaults")))}>
            {initialize.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Start customizing
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.4fr_auto] gap-3 items-end">
            <div><label className={LABEL}>Milestone</label>
              <select className={cn(INPUT, "mt-1")} value={milestone} onChange={(e) => setMilestone(e.target.value)}>
                <option value="">Choose…</option>
                {activeMs.map((m) => <option key={m.id!} value={m.id!}>{m.label}{m.kind === "revenue" ? " (revenue)" : ""}</option>)}
              </select></div>
            <div><label className={LABEL}>Week reached</label>
              <select className={cn(INPUT, "mt-1")} value={week} onChange={(e) => setWeek(e.target.value)}>
                <option value="">Choose…</option>
                {activeWeeks.map((w) => <option key={w.id!} value={w.id!}>{w.label}</option>)}
              </select></div>
            <div><label className={LABEL}>Note (optional)</label>
              <input className={cn(INPUT, "mt-1")} value={note} maxLength={500} placeholder="e.g. Verified from invoices" onChange={(e) => setNote(e.target.value)} /></div>
            <button className={cn(BTN_PRIMARY, "h-11")} disabled={saveRecord.isPending} onClick={record}>
              {saveRecord.isPending ? <Loader2 size={14} className="animate-spin" /> : existing ? <CheckCircle2 size={14} /> : <Plus size={14} />} {existing ? "Update" : "Record"}
            </button>
          </div>
          {existing && (
            <p className="text-[12px] text-[#a0a0a0]">{member.firstName} already has &ldquo;{existing.milestoneLabel}&rdquo; ({existing.weekLabel ?? "week removed"}). Saving moves it to the chosen week — one record per milestone.</p>
          )}
        </>
      )}
    </div>
  );
}

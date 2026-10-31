"use client";

// Weekly Activity Graph configuration — per program. Weeks (X axis), milestones
// (Y axis), the program's activities, and admin-recorded member milestones.
// Everything is stored on the backend (/api/weekly-graph/admin) and the member
// graph on /batch-program reads it on every load — no redeploy per change.
// Role rules are enforced server-side; the UI surfaces the server's messages.
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Plus, Loader2, X, Edit2, Trash2, GripVertical, CheckCircle2, Eye, EyeOff, Search, Sparkles } from "lucide-react";
import { toast } from "react-hot-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListMembers } from "@/lib/hooks/useMembers";
import {
  useListPrograms,
  useWeeklyGraphConfig,
  useInitializeWeeklyGraph,
  useSaveGraphWeek,
  useDeleteGraphWeek,
  useReorderGraphWeeks,
  useSaveGraphMilestone,
  useDeleteGraphMilestone,
  useReorderGraphMilestones,
  useSaveGraphActivity,
  useDeleteGraphActivity,
  useGraphMemberRecords,
  useSaveGraphMemberRecord,
  useDeleteGraphMemberRecord,
  type GraphActivityItem,
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
const formatInr = (n: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}`;

export default function WeeklyGraphPage() {
  const { data: programsRes, isLoading: programsLoading } = useListPrograms();
  const programs: Array<{ id: string; name: string; durationDays?: number }> = programsRes?.data || [];
  const [programId, setProgramId] = useState("");
  useEffect(() => { if (!programId && programs.length) setProgramId(programs[0].id); }, [programs, programId]);

  const { data: config, isLoading, isError, error, refetch } = useWeeklyGraphConfig(programId);
  const initialize = useInitializeWeeklyGraph(programId);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-rajdhani text-2xl font-bold uppercase tracking-tight text-[#f0f0f0] flex items-center gap-2">
              <BarChart3 size={22} className="text-[#dc2626]" /> Weekly Graph
            </h1>
            <p className="text-[13px] text-[#a0a0a0] mt-1">
              Configure the member Weekly Activity Graph per program. Changes are live on members&apos; next load — no redeploy.
            </p>
          </div>
          <div className="w-72">
            <label className={LABEL}>Program</label>
            <select className={cn(INPUT, "mt-1")} value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={programsLoading}>
              {programsLoading && <option>Loading…</option>}
              {!programsLoading && programs.length === 0 && <option value="">No programs</option>}
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {!programsLoading && programs.length === 0 && (
          <div className={cn(CARD, "p-8 text-center text-[#a0a0a0]")}>Create a program first (Batches → Programs).</div>
        )}

        {programId && isLoading && (
          <div className={cn(CARD, "p-10 flex items-center justify-center text-[#a0a0a0]")}><Loader2 className="animate-spin mr-2" size={18} /> Loading configuration…</div>
        )}

        {programId && isError && (
          <div className={cn(CARD, "p-6 flex items-center justify-between")}>
            <p className="text-[#ef4444] text-sm">{errMsg(error, "Could not load the configuration.")}</p>
            <button className={BTN_GHOST} onClick={() => refetch()}>Retry</button>
          </div>
        )}

        {config && (
          <>
            {!config.saved ? (
              <div className={cn(CARD, "p-5 flex flex-wrap items-center justify-between gap-4 border-[#f59e0b]/40")}>
                <div>
                  <p className="text-[#f0f0f0] font-semibold flex items-center gap-2"><Sparkles size={16} className="text-[#f59e0b]" /> Using the built-in defaults</p>
                  <p className="text-[13px] text-[#a0a0a0] mt-1">
                    Members of {config.program.name} currently see 7-day weeks and the default milestones below. Start customizing to save them as editable items.
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
            <MemberRecordsSection config={config} />
          </>
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
  // A week in use (activities / member records) is deleted only after choosing the week
  // that takes them over — the server moves them, then deletes the week, in one step.
  type MoveTarget = { id: string; label: string; startDay: number; endDay: number; isActive: boolean };
  const [moving, setMoving] = useState<{ week: GraphWeekItem; activities: number; records: number; targets: MoveTarget[] } | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const remove = async (w: GraphWeekItem) => {
    if (!window.confirm(`Delete "${w.label}" permanently?`)) return;
    try { await del.mutateAsync({ id: w.id! }); toast.success("Week deleted"); }
    catch (e: any) {
      if (e?.response?.status === 409) {
        // The server sends the counts and the valid destination weeks (this program's
        // other saved weeks, read fresh from the database).
        const info = e?.response?.data?.data ?? {};
        const targets: MoveTarget[] = Array.isArray(info.targets) ? info.targets : [];
        // Default: the nearest active week before it, else the nearest after, else any.
        const active = targets.filter((t) => t.isActive);
        const before = active.filter((t) => t.startDay < w.startDay).sort((a, b) => b.startDay - a.startDay)[0];
        const after = active.filter((t) => t.startDay > w.startDay).sort((a, b) => a.startDay - b.startDay)[0];
        setMoveTo((before ?? after ?? targets[0])?.id ?? "");
        setMoveError(null);
        setMoving({ week: w, activities: Number(info.activities ?? 0), records: Number(info.records ?? 0), targets });
      } else {
        toast.error(errMsg(e, "Could not delete the week"));
      }
    }
  };
  const moveAndDelete = async () => {
    if (!moving || !moveTo) return;
    setMoveError(null);
    try {
      await del.mutateAsync({ id: moving.week.id!, moveTo });
      const target = moving.targets.find((x) => x.id === moveTo)?.label ?? "the chosen week";
      toast.success(`Week deleted — its activities and member records now belong to ${target}`);
      setMoving(null);
    } catch (e) { setMoveError(errMsg(e, "Could not delete the week")); }
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
      {moving && (
        <Modal title={`Delete ${moving.week.label}`} onClose={() => { if (!del.isPending) setMoving(null); }}>
          <p className="text-[13px] text-[#f0f0f0]">
            {moving.week.label} (day {moving.week.startDay}–{moving.week.endDay}) has {moving.activities} {moving.activities === 1 ? "activity" : "activities"}
            {" "}and {moving.records} member {moving.records === 1 ? "record" : "records"}.
          </p>
          <p className="text-[13px] text-[#a0a0a0]">
            Choose the week that takes them over. Activities keep their days (members&apos; checklists don&apos;t change); on the graph they appear in the chosen week. Nothing is deleted except {moving.week.label}.
          </p>
          {moving.records > 0 && (
            <p className="text-[13px] text-[#f59e0b]">
              {moving.records} member milestone {moving.records === 1 ? "record is" : "records are"} kept and moved to the chosen week — they will show in that week on those members&apos; graphs.
            </p>
          )}
          {moving.targets.length > 0 ? (
            <label className="block">
              <span className={LABEL}>Move to week</span>
              <select className={cn(INPUT, "mt-1")} value={moveTo} onChange={(e) => setMoveTo(e.target.value)} disabled={del.isPending}>
                {moving.targets.map((x) => (
                  <option key={x.id} value={x.id} className="bg-[#1a1a1a] text-white">{x.label} · day {x.startDay}–{x.endDay}{x.isActive ? "" : " (disabled)"}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-[13px] text-[#ef4444]">
              There is no other week in this program to move them to. Add a week first, then delete {moving.week.label}.
            </p>
          )}
          {moveError && <p className="text-[13px] text-[#ef4444]">{moveError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={BTN_GHOST} onClick={() => setMoving(null)} disabled={del.isPending}>Cancel</button>
            <button type="button" className={BTN_PRIMARY} onClick={moveAndDelete} disabled={del.isPending || !moveTo}>
              {del.isPending && <Loader2 size={14} className="animate-spin" />} Move and delete
            </button>
          </div>
        </Modal>
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
      <SectionHeader title="Milestones (Y axis, bottom → top)" hint="Activity milestones are reached by approved tasks. A revenue milestone is reached when the member's reported revenue (Your Revenue Stats, running total since the batch started) reaches its threshold, or when an admin records it.">
        <OrderBar dirty={dirty} saving={reorder.isPending} onCancel={cancel}
          onSave={() => reorder.mutateAsync(local.map((m) => m.id!)).then(() => toast.success("Milestone order saved"), (e) => toast.error(errMsg(e, "Could not save the order")))} />
        {!dirty && <button className={BTN_PRIMARY} onClick={() => setEditing("new")}><Plus size={14} /> Add milestone</button>}
      </SectionHeader>
      {activityAfterRevenue && (
        <p className="mx-5 mb-3 text-[12px] text-[#f59e0b]">An activity milestone sits above a revenue milestone — tasks can&apos;t reach it (only an admin record can). Drag it below the revenue milestones if that isn&apos;t intended.</p>
      )}
      {local.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-[#606060]">No milestones — members will see the defaults until you add one.</p>
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
                <td className="px-4 py-2 text-[#a0a0a0]">
                  {m.kind !== "revenue"
                    ? "Activity"
                    : m.threshold != null
                      ? `Revenue ≥ ${formatInr(m.threshold)}`
                      : "Revenue — no threshold (admin-recorded only)"}
                </td>
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
  initial: GraphMilestoneItem; isNew: boolean; onClose: () => void;
  onSave: (v: { id: string | null; label: string; kind: GraphMilestoneKind; threshold: number | null }) => Promise<void>;
}) {
  const [label, setLabel] = useState(initial.label);
  const [kind, setKind] = useState<GraphMilestoneKind>(initial.kind);
  const [threshold, setThreshold] = useState(initial.threshold != null ? String(initial.threshold) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return setError("Label is required");
    // The server validates the amount too; blank = no threshold (reached only by an admin record).
    const amount = kind === "revenue" && threshold.trim() !== "" ? Number(threshold) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) return setError("Threshold must be an amount greater than 0");
    setSaving(true); setError(null);
    try { await onSave({ id: isNew ? null : initial.id, label: label.trim(), kind, threshold: amount }); }
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
            <option value="revenue">Revenue — reached by the member&apos;s reported revenue or an admin record</option>
          </select>
        </div>
        {kind === "revenue" && (
          <div>
            <label className={LABEL} htmlFor="milestone-threshold">Revenue threshold (₹)</label>
            <input
              id="milestone-threshold"
              className={cn(INPUT, "mt-1")}
              type="number"
              inputMode="decimal"
              min={1}
              step="any"
              value={threshold}
              placeholder="e.g. 100000"
              onChange={(e) => setThreshold(e.target.value)}
            />
            <p className="text-[12px] text-[#606060] mt-1">
              Reached when the member&apos;s total reported revenue (Your Revenue Stats) since the batch started is at or above this amount.
              Leave blank to reach it only by an admin record.
            </p>
          </div>
        )}
        {!isNew && <p className="text-[12px] text-[#606060]">Renaming keeps every linked activity and member record.</p>}
        <FormActions saving={saving} onCancel={onClose} error={error} />
      </form>
    </Modal>
  );
}

// ── Activities ───────────────────────────────────────────────────────────────

function ActivitiesSection({ config, programId }: { config: WeeklyGraphConfig; programId: string }) {
  const save = useSaveGraphActivity(programId);
  const del = useDeleteGraphActivity(programId);
  const [editing, setEditing] = useState<GraphActivityItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<GraphActivityItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Set when the server refused the delete (409: the activity has member submissions).
  const [blockedSubmissions, setBlockedSubmissions] = useState<number | null>(null);
  const weekName = (a: GraphActivityItem) =>
    config.weeks.find((w) => (a.weekId ? w.id === a.weekId : w.startDay <= a.dayNumber && a.dayNumber <= w.endDay))?.label ?? `Day ${a.dayNumber}`;
  const msName = (a: GraphActivityItem) => config.milestones.find((m) => m.id && m.id === a.milestoneId)?.label ?? (a.isMilestone ? a.milestoneLabel : null);

  const toggle = async (a: GraphActivityItem) => {
    if (a.isActive && !window.confirm(`Disable "${a.title}"? It is hidden from members. Submissions and reviews are kept.`)) return;
    try { await save.mutateAsync({ id: a.id, isActive: !a.isActive }); toast.success(a.isActive ? "Activity disabled" : "Activity enabled"); }
    catch (e) { toast.error(errMsg(e, "Could not update the activity")); }
  };
  const deleteBusy = del.isPending || save.isPending;
  const openDelete = (a: GraphActivityItem) => { setDeleteError(null); setBlockedSubmissions(null); setDeleting(a); };
  const closeDelete = () => { if (!deleteBusy) { setDeleting(null); setDeleteError(null); setBlockedSubmissions(null); } };
  const confirmDelete = async () => {
    if (!deleting?.id) return;
    setDeleteError(null);
    try { await del.mutateAsync({ id: deleting.id }); toast.success("Activity deleted"); setDeleting(null); }
    catch (e: any) {
      if (e?.response?.status === 409) {
        // The activity has submissions: ask again, stating how many, before archiving it.
        setBlockedSubmissions(Number(String(e?.message ?? "").match(/has (\d+) submission/)?.[1] ?? 0));
      } else {
        setDeleteError(errMsg(e, "Could not delete the activity"));
      }
    }
  };
  // Explicit second confirmation: the server archives the activity and keeps every submission.
  const deleteKeepingSubmissions = async () => {
    if (!deleting?.id) return;
    setDeleteError(null);
    try {
      const res: any = await del.mutateAsync({ id: deleting.id, archive: true });
      const kept = Number(res?.submissions ?? blockedSubmissions ?? 0);
      toast.success(`Activity deleted — ${kept} ${kept === 1 ? "submission" : "submissions"} kept`);
      setDeleting(null); setBlockedSubmissions(null);
    } catch (e) { setDeleteError(errMsg(e, "Could not delete the activity")); }
  };
  // Same operation as the row's eye button, run only on the admin's click.
  const disableInstead = async () => {
    if (!deleting?.id) return;
    setDeleteError(null);
    try { await save.mutateAsync({ id: deleting.id, isActive: false }); toast.success("Activity disabled"); setDeleting(null); setBlockedSubmissions(null); }
    catch (e) { setDeleteError(errMsg(e, "Could not disable the activity")); }
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
                    <button className={ICON_BTN} disabled={!config.saved} title={needsSaved(config) ?? "Delete"} aria-label={`Delete ${a.title}`} onClick={() => openDelete(a)}><Trash2 size={14} /></button>
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
      {deleting && blockedSubmissions === null && (
        <Modal title="Delete activity" onClose={closeDelete}>
          <p className="text-[13px] text-[#a0a0a0]">Are you sure you want to delete this activity?</p>
          <p className="text-[13px] text-[#f0f0f0]">{deleting.title}</p>
          {deleteError && <p className="text-[13px] text-[#ef4444]">{deleteError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={BTN_GHOST} onClick={closeDelete} disabled={del.isPending}>Cancel</button>
            <button type="button" className={BTN_PRIMARY} onClick={confirmDelete} disabled={del.isPending}>{del.isPending && <Loader2 size={14} className="animate-spin" />} Delete</button>
          </div>
        </Modal>
      )}
      {deleting && blockedSubmissions !== null && (
        <Modal title="Delete activity with submissions" onClose={closeDelete}>
          <p className="text-[13px] text-[#f0f0f0]">{deleting.title}</p>
          <p className="text-[13px] text-[#f0f0f0]">
            This activity has {blockedSubmissions} member {blockedSubmissions === 1 ? "submission" : "submissions"}.
          </p>
          <p className="text-[13px] text-[#a0a0a0]">
            Deleting it removes the activity from this list, from members&apos; checklists and from the weekly graph.
            The {blockedSubmissions === 1 ? "submission is" : `${blockedSubmissions} submissions are`} kept — with their reviews and points — and are not erased.
          </p>
          {deleteError && <p className="text-[13px] text-[#ef4444]">{deleteError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={BTN_GHOST} onClick={closeDelete} disabled={deleteBusy}>Cancel</button>
            {deleting.isActive && (
              <button type="button" className={BTN_GHOST} onClick={disableInstead} disabled={deleteBusy}>{save.isPending && <Loader2 size={14} className="animate-spin" />} Disable instead</button>
            )}
            <button type="button" className={BTN_PRIMARY} onClick={deleteKeepingSubmissions} disabled={deleteBusy}>{del.isPending && <Loader2 size={14} className="animate-spin" />} Delete activity</button>
          </div>
        </Modal>
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

function MemberRecordsSection({ config }: { config: WeeklyGraphConfig }) {
  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState("");
  const { data: membersRes, isFetching } = useListMembers({ search, limit: 8 }, { enabled: search.trim().length >= 2 });
  const results: any[] = membersRes?.data || [];
  const { data, isLoading, isError, error } = useGraphMemberRecords(memberId);
  const saveRecord = useSaveGraphMemberRecord(memberId);
  const delRecord = useDeleteGraphMemberRecord(memberId);
  const [milestone, setMilestone] = useState("");
  const [week, setWeek] = useState("");
  const [note, setNote] = useState("");
  const inProgram = data?.member.programId === config.program.id;
  const activeMs = useMemo(() => config.milestones.filter((m) => m.isActive && m.id), [config.milestones]);
  const activeWeeks = useMemo(() => config.weeks.filter((w) => w.isActive && w.id), [config.weeks]);

  const record = async () => {
    if (!milestone || !week) return toast.error("Choose a milestone and a week");
    try { await saveRecord.mutateAsync({ milestoneId: milestone, weekId: week, note: note || undefined }); toast.success("Milestone recorded"); setNote(""); }
    catch (e) { toast.error(errMsg(e, "Could not record the milestone")); }
  };
  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Remove "${label}" from this member's graph?`)) return;
    try { await delRecord.mutateAsync(id); toast.success("Record removed"); } catch (e) { toast.error(errMsg(e, "Could not remove the record")); }
  };

  return (
    <section className={CARD}>
      <SectionHeader title="Member milestones" hint="Record a milestone a member has reached (e.g. a verified revenue milestone). It lifts that member's point in the chosen week. One record per milestone." />
      <div className="px-5 pb-5 space-y-4">
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
          <input className={cn(INPUT, "pl-9")} placeholder="Search a member by name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search.trim().length >= 2 && !memberId && (
            <div className="absolute z-10 mt-1 w-full bg-[#141414] border border-[#2a2a2a] rounded-lg max-h-64 overflow-y-auto">
              {isFetching && <p className="p-3 text-[12px] text-[#606060]">Searching…</p>}
              {!isFetching && results.length === 0 && <p className="p-3 text-[12px] text-[#606060]">No members found</p>}
              {results.map((m) => (
                <button key={m.id} className="w-full text-left px-3 py-2 hover:bg-[#1f1f1f] text-[13px] text-[#f0f0f0]" onClick={() => { setMemberId(m.id); setSearch(`${m.firstName} ${m.lastName ?? ""}`.trim()); }}>
                  {m.firstName} {m.lastName} <span className="text-[#606060]">· {m.phone} {m.batch?.name ? `· ${m.batch.name}` : ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {memberId && (
          <button className="text-[12px] text-[#a0a0a0] underline" onClick={() => { setMemberId(""); setSearch(""); }}>Choose another member</button>
        )}

        {memberId && isLoading && <p className="text-[13px] text-[#a0a0a0] flex items-center"><Loader2 size={14} className="animate-spin mr-2" /> Loading…</p>}
        {memberId && isError && <p className="text-[13px] text-[#ef4444]">{errMsg(error, "Could not load this member")}</p>}
        {data && !inProgram && (
          <p className="text-[13px] text-[#f59e0b]">This member is not in a batch of {config.program.name}. Switch the program above to the member&apos;s program.</p>
        )}
        {data && inProgram && (
          <>
            {data.records.length === 0 ? (
              <p className="text-[13px] text-[#606060]">No milestones recorded for {data.member.firstName} yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.records.map((r) => (
                  <li key={r.id} className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[13px]">
                    <span className="text-[#f0f0f0]">{r.milestoneLabel} <span className="text-[#606060]">· {r.weekLabel ?? "week removed"}{r.note ? ` · ${r.note}` : ""}{r.recordedBy ? ` · by ${r.recordedBy}` : ""}</span></span>
                    <button className={ICON_BTN} title="Remove" onClick={() => remove(r.id, r.milestoneLabel)}><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            {!config.saved ? (
              <p className="text-[12px] text-[#f59e0b]">{needsSaved(config)}</p>
            ) : (
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
                  {saveRecord.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Record
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

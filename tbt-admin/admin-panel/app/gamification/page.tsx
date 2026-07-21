"use client";

/**
 * TBT Gamification admin — three-tab surface.
 *
 * Tabs:
 *   * Task Path  — the 90-day task ladder (task_order ordered),
 *                   inline completions count, CRUD.
 *   * Levels     — points-to-level ladder (level_number ordered), CRUD.
 *   * Leaderboard — top N members by total_points, with a "Grant
 *                    points" mini-form for manual corrections /
 *                    bonuses.
 */

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useTbtDashboard,
  useListTbtLevels,
  useCreateTbtLevel,
  useUpdateTbtLevel,
  useDeleteTbtLevel,
  useListTbtTasks,
  useCreateTbtTask,
  useUpdateTbtTask,
  useDeleteTbtTask,
  useTbtLeaderboard,
  useGrantPoints,
  useTbtActivityLog,
  type TbtLevel,
  type TbtTask,
} from "@/lib/hooks/useGamification";
import { toast } from "react-hot-toast";
import {
  Trophy,
  ListChecks,
  Award,
  Plus,
  X,
  Loader2,
  Edit2,
  Trash2,
  Crown,
  Zap,
  History,
} from "lucide-react";

const labelCls =
  "block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani";
const inputCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm";
const textareaCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] transition-all text-sm min-h-[90px]";

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg px-3 py-2">
      <div className="text-[9px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">
        {label}
      </div>
      <div className="text-lg font-bold text-white tracking-tight">{value}</div>
    </div>
  );
}

type Tab = "tasks" | "levels" | "leaderboard" | "activity";

export default function GamificationPage() {
  const [tab, setTab] = useState<Tab>("tasks");
  const { data: stats } = useTbtDashboard();

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white font-rajdhani uppercase tracking-wider flex items-center gap-3">
              <Trophy className="text-[#dc2626]" size={24} /> TBT Gamification
            </h1>
            <p className="text-[12px] text-[#888] mt-1">
              90-day task path, points ladder, and leaderboard.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
          <StatChip label="Levels" value={stats?.levels ?? "—"} />
          <StatChip label="Tasks" value={stats?.tasks ?? "—"} />
          <StatChip label="Completions" value={stats?.completions ?? "—"} />
          <StatChip
            label="Points Awarded"
            value={stats?.totalPointsAwarded?.toLocaleString() ?? "—"}
          />
          <StatChip label="Active Members" value={stats?.activeMembers ?? "—"} />
        </div>

        <div className="flex items-center gap-1 border-b border-[#2a2a2a] mb-5">
          {(
            [
              { id: "tasks", label: "Task Path", icon: ListChecks },
              { id: "levels", label: "Levels", icon: Award },
              { id: "leaderboard", label: "Leaderboard", icon: Crown },
              { id: "activity", label: "Activity Log", icon: History },
            ] as { id: Tab; label: string; icon: any }[]
          ).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "flex items-center gap-2 px-4 py-2.5 text-[12px] font-bold uppercase tracking-widest font-rajdhani border-b-2 transition-colors " +
                  (active
                    ? "border-[#dc2626] text-white"
                    : "border-transparent text-[#888] hover:text-white")
                }
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "tasks" && <TasksTab />}
        {tab === "levels" && <LevelsTab />}
        {tab === "leaderboard" && <LeaderboardTab />}
        {tab === "activity" && <ActivityLogTab />}
      </div>
    </DashboardLayout>
  );
}

// ────────────────────────────────────────────────────────────────
// TASKS
// ────────────────────────────────────────────────────────────────

function TasksTab() {
  const { data: rows, isLoading } = useListTbtTasks();
  const [editing, setEditing] = useState<TbtTask | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteTbtTask();

  const onDelete = async (id: string) => {
    if (!confirm("Delete this task? Existing member completions will cascade-delete.")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Task deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Delete failed");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#888]">
          {rows?.length ?? 0} task{(rows?.length ?? 0) === 1 ? "" : "s"} in the path
        </span>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg"
        >
          <Plus size={12} /> New Task
        </button>
      </div>

      <div className="space-y-2">
        {isLoading && (
          <div className="p-8 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={16} />
          </div>
        )}
        {!isLoading && (rows?.length ?? 0) === 0 && (
          <div className="p-8 text-center text-[#666] text-[12px]">No tasks yet.</div>
        )}
        {rows?.map((t) => (
          <div
            key={t.id}
            className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#dc2626]/10 border border-[#dc2626]/30 flex items-center justify-center">
                <span className="text-[13px] font-bold text-[#dc2626]">{t.taskOrder}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-white">{t.title}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
                      <Zap size={10} /> {t.rewardPoints} pts
                    </span>
                    <span
                      className={
                        "text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold " +
                        (t.status === "active"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-white/5 text-[#888]")
                      }
                    >
                      {t.status}
                    </span>
                  </div>
                </div>
                {t.description && (
                  <p className="text-[12px] text-[#a0a0a0] mt-1 leading-relaxed">
                    {t.description}
                  </p>
                )}
                {t.requiredAction && (
                  <div className="mt-2 text-[11px] text-[#888]">
                    <span className="text-[#666] uppercase tracking-widest font-rajdhani font-bold text-[9px]">
                      Required action:
                    </span>{" "}
                    {t.requiredAction}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-[#666]">
                    {t._count?.completions ?? 0} member{" "}
                    {(t._count?.completions ?? 0) === 1 ? "completion" : "completions"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditing(t)}
                      className="text-[10px] text-[#a0a0a0] hover:text-white flex items-center gap-1 px-2 py-1"
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                    <button
                      onClick={() => onDelete(t.id)}
                      className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1"
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <TaskForm
          initial={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function TaskForm({ initial, onClose }: { initial?: TbtTask; onClose: () => void }) {
  const create = useCreateTbtTask();
  const update = useUpdateTbtTask();
  const isEdit = !!initial;
  const [taskOrder, setTaskOrder] = useState(initial?.taskOrder ?? 1);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [requiredAction, setRequiredAction] = useState(initial?.requiredAction ?? "");
  const [rewardPoints, setRewardPoints] = useState(initial?.rewardPoints ?? 100);
  const [status, setStatus] = useState<"active" | "inactive">(
    (initial?.status as any) ?? "active",
  );
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title required.");
      return;
    }
    const data: any = {
      taskOrder,
      title,
      description: description || null,
      requiredAction: requiredAction || null,
      rewardPoints,
      status,
      sortOrder,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: initial!.id, data });
        toast.success("Task updated");
      } else {
        await create.mutateAsync(data);
        toast.success("Task created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit Task" : "New Task"} wide>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Task Order (#)</label>
          <input
            type="number"
            className={inputCls}
            value={taskOrder}
            onChange={(e) => setTaskOrder(Number(e.target.value) || 1)}
          />
        </div>
        <div>
          <label className={labelCls}>Reward Points</label>
          <input
            type="number"
            className={inputCls}
            value={rewardPoints}
            onChange={(e) => setRewardPoints(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select
            className={inputCls}
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className={labelCls}>Title</label>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="mt-3">
        <label className={labelCls}>Description</label>
        <textarea
          className={textareaCls}
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="mt-3">
        <label className={labelCls}>Required Action</label>
        <input
          className={inputCls}
          value={requiredAction ?? ""}
          onChange={(e) => setRequiredAction(e.target.value)}
        />
      </div>
      <div className="mt-3">
        <label className={labelCls}>Sort Order</label>
        <input
          type="number"
          className={inputCls}
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
        />
      </div>
      <ModalActions
        onClose={onClose}
        onSubmit={submit}
        busy={create.isPending || update.isPending}
        isEdit={isEdit}
      />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────
// LEVELS
// ────────────────────────────────────────────────────────────────

function LevelsTab() {
  const { data: rows, isLoading } = useListTbtLevels();
  const [editing, setEditing] = useState<TbtLevel | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteTbtLevel();

  const onDelete = async (id: string) => {
    if (!confirm("Delete this level?")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Level deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Delete failed");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#888]">
          {rows?.length ?? 0} level{(rows?.length ?? 0) === 1 ? "" : "s"}
        </span>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg"
        >
          <Plus size={12} /> New Level
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading && (
          <div className="col-span-full p-8 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={16} />
          </div>
        )}
        {!isLoading && (rows?.length ?? 0) === 0 && (
          <div className="col-span-full p-8 text-center text-[#666] text-[12px]">
            No levels yet.
          </div>
        )}
        {rows?.map((l) => (
          <div
            key={l.id}
            className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4 flex gap-3"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border border-yellow-500/30 flex items-center justify-center">
              <span className="text-[15px] font-bold text-yellow-400 font-rajdhani">
                {l.levelNumber}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-[14px] font-semibold text-white">{l.name}</div>
                <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 flex-shrink-0">
                  {l.requiredPoints.toLocaleString()} pts
                </span>
              </div>
              {l.description && (
                <p className="text-[11px] text-[#a0a0a0] leading-relaxed">{l.description}</p>
              )}
              {l.reward && (
                <div className="mt-2 text-[11px]">
                  <span className="text-[#666] uppercase tracking-widest font-rajdhani font-bold text-[9px]">
                    Reward:
                  </span>{" "}
                  <span className="text-white">{l.reward}</span>
                </div>
              )}
              <div className="mt-2 flex items-center gap-1">
                <button
                  onClick={() => setEditing(l)}
                  className="text-[10px] text-[#a0a0a0] hover:text-white flex items-center gap-1 px-2 py-1"
                >
                  <Edit2 size={11} /> Edit
                </button>
                <button
                  onClick={() => onDelete(l.id)}
                  className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1"
                >
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <LevelForm
          initial={editing ?? undefined}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function LevelForm({ initial, onClose }: { initial?: TbtLevel; onClose: () => void }) {
  const create = useCreateTbtLevel();
  const update = useUpdateTbtLevel();
  const isEdit = !!initial;
  const [levelNumber, setLevelNumber] = useState(initial?.levelNumber ?? 1);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [requiredPoints, setRequiredPoints] = useState(initial?.requiredPoints ?? 100);
  const [reward, setReward] = useState(initial?.reward ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Name required.");
      return;
    }
    const data: any = {
      levelNumber,
      name,
      description: description || null,
      requiredPoints,
      reward: reward || null,
      sortOrder,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: initial!.id, data });
        toast.success("Level updated");
      } else {
        await create.mutateAsync(data);
        toast.success("Level created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  return (
    <Modal onClose={onClose} title={isEdit ? "Edit Level" : "New Level"} wide>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Level #</label>
          <input
            type="number"
            className={inputCls}
            value={levelNumber}
            onChange={(e) => setLevelNumber(Number(e.target.value) || 1)}
          />
        </div>
        <div>
          <label className={labelCls}>Required Points</label>
          <input
            type="number"
            className={inputCls}
            value={requiredPoints}
            onChange={(e) => setRequiredPoints(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className={labelCls}>Sort Order</label>
          <input
            type="number"
            className={inputCls}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <div className="mt-3">
        <label className={labelCls}>Name</label>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="mt-3">
        <label className={labelCls}>Description</label>
        <textarea
          className={textareaCls}
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="mt-3">
        <label className={labelCls}>Reward</label>
        <input
          className={inputCls}
          value={reward ?? ""}
          onChange={(e) => setReward(e.target.value)}
          placeholder="Bronze Badge, Trophy, etc."
        />
      </div>
      <ModalActions
        onClose={onClose}
        onSubmit={submit}
        busy={create.isPending || update.isPending}
        isEdit={isEdit}
      />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────
// LEADERBOARD
// ────────────────────────────────────────────────────────────────

function LeaderboardTab() {
  const { data: rows, isLoading } = useTbtLeaderboard(100);
  const grant = useGrantPoints();
  const [showGrant, setShowGrant] = useState(false);

  const memberName = (m: any) => {
    if (!m) return "Unknown";
    const n = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
    return n || m.email || "Member";
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#888]">Top {rows?.length ?? 0} members</span>
        <button
          onClick={() => setShowGrant(true)}
          className="flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg"
        >
          <Zap size={12} /> Grant Points
        </button>
      </div>

      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[80px_1fr_140px] px-4 py-3 border-b border-[#2a2a2a] text-[10px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">
          <span>Rank</span>
          <span>Member</span>
          <span className="text-right">Total Points</span>
        </div>
        {isLoading && (
          <div className="p-8 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={16} />
          </div>
        )}
        {!isLoading && (rows?.length ?? 0) === 0 && (
          <div className="p-8 text-center text-[#666] text-[12px]">
            No leaderboard entries yet.
          </div>
        )}
        {rows?.map((r) => (
          <div
            key={r.memberId}
            className="grid grid-cols-[80px_1fr_140px] px-4 py-3 border-b border-[#2a2a2a]/50 last:border-b-0 items-center hover:bg-white/[0.02]"
          >
            <span className="text-[13px] font-bold text-white font-rajdhani">
              {r.rank <= 3 && (
                <Crown
                  size={13}
                  className="inline mr-1 -mt-0.5"
                  style={{
                    color: r.rank === 1 ? "#fbbf24" : r.rank === 2 ? "#d1d5db" : "#f97316",
                  }}
                />
              )}
              #{r.rank}
            </span>
            <span className="text-[13px] text-white truncate">{memberName(r.member)}</span>
            <span className="text-[13px] text-right text-yellow-400 font-bold font-rajdhani">
              {r.totalPoints.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {showGrant && (
        <GrantPointsForm
          onClose={() => setShowGrant(false)}
          onSubmit={async (memberId, points, source) => {
            try {
              await grant.mutateAsync({ memberId, points, source });
              toast.success("Points granted");
              setShowGrant(false);
            } catch (err: any) {
              toast.error(err?.response?.data?.error?.message ?? "Grant failed");
            }
          }}
          busy={grant.isPending}
        />
      )}
    </>
  );
}

function GrantPointsForm({
  onClose,
  onSubmit,
  busy,
}: {
  onClose: () => void;
  onSubmit: (memberId: string, points: number, source?: string) => Promise<void>;
  busy: boolean;
}) {
  const [memberId, setMemberId] = useState("");
  const [points, setPoints] = useState(100);
  const [source, setSource] = useState("manual_grant");

  return (
    <Modal onClose={onClose} title="Grant Points">
      <label className={labelCls}>Member ID (UUID)</label>
      <input
        className={inputCls}
        value={memberId}
        onChange={(e) => setMemberId(e.target.value)}
        placeholder="00000000-0000-0000-0000-000000000000"
      />
      <div className="mt-1 text-[10px] text-[#666]">
        Paste from the Members list URL. Negative values allowed for corrections.
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className={labelCls}>Points</label>
          <input
            type="number"
            className={inputCls}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <label className={labelCls}>Source Label</label>
          <input className={inputCls} value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
      </div>
      <ModalActions
        onClose={onClose}
        onSubmit={() => {
          if (!memberId.trim()) {
            toast.error("Member ID required.");
            return;
          }
          void onSubmit(memberId.trim(), points, source.trim() || "manual_grant");
        }}
        busy={busy}
        isEdit={false}
        submitLabel="GRANT"
      />
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────────

function Modal({
  onClose,
  title,
  children,
  wide,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-6 overflow-y-auto">
      <div
        className={
          "bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-2xl w-full " +
          (wide ? "max-w-2xl" : "max-w-md")
        }
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h3 className="text-[14px] font-bold uppercase tracking-widest font-rajdhani text-white">
            {title}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-[#a0a0a0]">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  onClose,
  onSubmit,
  busy,
  isEdit,
  submitLabel,
}: {
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  isEdit: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[#2a2a2a]">
      <button
        onClick={onClose}
        disabled={busy}
        className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] hover:text-white disabled:opacity-40"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={busy}
        className="px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40 flex items-center gap-1.5"
      >
        {busy && <Loader2 size={12} className="animate-spin" />}
        {submitLabel ?? (isEdit ? "Save" : "Create")}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ────────────────────────────────────────────────────────────────

function ActivityLogTab() {
  const [period, setPeriod] = useState<"all" | "week" | "month">("all");
  const [page, setPage] = useState(1);
  const limit = 50;
  const { data, isLoading, isFetching } = useTbtActivityLog({
    period,
    page,
    limit,
  });
  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const setPeriodAndReset = (p: "all" | "week" | "month") => {
    setPeriod(p);
    setPage(1);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#888]">
          {total.toLocaleString()} activity row{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1">
          {(
            [
              { id: "all" as const, label: "All Time" },
              { id: "week" as const, label: "This Week" },
              { id: "month" as const, label: "This Month" },
            ]
          ).map((p) => {
            const active = period === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPeriodAndReset(p.id)}
                className={
                  "text-[10px] font-bold uppercase tracking-widest font-rajdhani px-3 py-1.5 rounded-md border " +
                  (active
                    ? "bg-[#dc2626]/15 text-[#dc2626] border-[#dc2626]"
                    : "bg-[#181818] text-[#888] border-[#2a2a2a] hover:text-white")
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_2fr_1fr_1fr] px-4 py-2.5 border-b border-[#2a2a2a] text-[9px] font-bold text-[#666] uppercase tracking-widest font-rajdhani">
          <div>When</div>
          <div>Member</div>
          <div className="text-right">Points</div>
          <div className="text-right">Source</div>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={16} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-[#666] text-[12px]">
            No activity in this period.
          </div>
        ) : (
          rows.map((r) => {
            const memberName = r.member
              ? [r.member.firstName, r.member.lastName]
                  .filter((s): s is string => !!s && s.length > 0)
                  .join(" ")
                  .trim() || "Unknown"
              : "Unknown";
            const when = new Date(r.createdAt);
            const whenStr =
              when.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              }) +
              " · " +
              when.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });
            return (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_2fr_1fr_1fr] px-4 py-3 border-b border-[#2a2a2a] last:border-b-0 items-center text-[12px]"
              >
                <div className="text-[#a0a0a0]">{whenStr}</div>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#2a2a2a] flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {r.member?.profilePhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.member.profilePhotoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-[#666] font-bold">
                        {memberName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-white truncate">{memberName}</span>
                </div>
                <div className="text-right">
                  <span
                    className={
                      "text-[11px] font-bold px-2 py-0.5 rounded font-rajdhani " +
                      (r.points >= 0
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-red-500/10 text-red-400")
                    }
                  >
                    {r.points >= 0 ? "+" : ""}
                    {r.points}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold bg-white/5 text-[#888]">
                    {r.source}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-[11px] text-[#888]">
          <span>
            Page {page} of {totalPages}
            {isFetching && (
              <Loader2 className="inline animate-spin ml-2" size={12} />
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md bg-[#181818] border border-[#2a2a2a] text-[10px] font-bold uppercase tracking-widest font-rajdhani disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md bg-[#181818] border border-[#2a2a2a] text-[10px] font-bold uppercase tracking-widest font-rajdhani disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}

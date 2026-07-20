"use client";

/**
 * Morning Ritual admin — two-tab CRUD (Habits · Buttons).
 *
 * The 5-question morning ritual widget that shows on the mobile app
 * home page. Habits are the questions; buttons_config sets the
 * yes/not-yet labels. Both are global (no per-member config).
 */

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useListHabits,
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useGetButtonsConfig,
  useUpdateButtonsConfig,
  type Habit,
} from "@/lib/hooks/useRituals";
import { toast } from "react-hot-toast";
import { Sun, Plus, X, Loader2, Edit2, Trash2 } from "lucide-react";

const labelCls =
  "block text-[11px] font-bold text-[#888] uppercase tracking-widest mb-2 font-rajdhani";
const inputCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm";
const textareaCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white outline-none focus:border-[#dc2626] transition-all text-sm min-h-[80px]";

type Tab = "habits" | "buttons";

export default function RitualsPage() {
  const [tab, setTab] = useState<Tab>("habits");

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1200px] mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-white font-rajdhani uppercase tracking-wider flex items-center gap-3">
            <Sun className="text-[#dc2626]" size={24} /> Morning Ritual
          </h1>
          <p className="text-[12px] text-[#888] mt-1">
            The 5-question habit prompt that appears on the mobile app home page.
          </p>
        </div>

        <div className="flex items-center gap-1 border-b border-[#2a2a2a] mb-5">
          {(
            [
              { id: "habits", label: "Habits" },
              { id: "buttons", label: "Button Labels" },
            ] as { id: Tab; label: string }[]
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "px-4 py-2.5 text-[12px] font-bold uppercase tracking-widest font-rajdhani border-b-2 transition-colors " +
                  (active
                    ? "border-[#dc2626] text-white"
                    : "border-transparent text-[#888] hover:text-white")
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "habits" && <HabitsTab />}
        {tab === "buttons" && <ButtonsTab />}
      </div>
    </DashboardLayout>
  );
}

function HabitsTab() {
  const { data: rows, isLoading } = useListHabits();
  const [editing, setEditing] = useState<Habit | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteHabit();

  const onDelete = async (id: string) => {
    if (!confirm("Delete this habit?")) return;
    try {
      await del.mutateAsync(id);
      toast.success("Habit deleted");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Delete failed");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[#888]">
          {rows?.length ?? 0} habit{(rows?.length ?? 0) === 1 ? "" : "s"} — shown in order
        </span>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-[#dc2626] hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-widest font-rajdhani px-3 py-2 rounded-lg"
        >
          <Plus size={12} /> New Habit
        </button>
      </div>

      <div className="space-y-2">
        {isLoading && (
          <div className="p-8 text-center text-[#666]">
            <Loader2 className="inline animate-spin" size={16} />
          </div>
        )}
        {!isLoading && (rows?.length ?? 0) === 0 && (
          <div className="p-8 text-center text-[#666] text-[12px]">No habits yet.</div>
        )}
        {rows?.map((h, idx) => (
          <div key={h.id} className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                <span className="text-[13px] font-bold text-yellow-400">{idx + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-white font-medium">
                      {h.rawQuestion}
                    </div>
                    {h.highlightWord && (
                      <div className="text-[10px] text-[#666] mt-0.5">
                        Highlighted: <span className="text-yellow-400">{h.highlightWord}</span>
                      </div>
                    )}
                  </div>
                  <span
                    className={
                      "text-[10px] px-2 py-0.5 rounded uppercase tracking-widest font-rajdhani font-bold " +
                      (h.status === "active"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-white/5 text-[#888]")
                    }
                  >
                    {h.status}
                  </span>
                </div>
                {h.subtitle && (
                  <p className="text-[12px] text-[#a0a0a0] mt-1">{h.subtitle}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-[#666] font-mono">
                    icon: {h.icon} · sort: {h.sortOrder}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditing(h)}
                      className="text-[10px] text-[#a0a0a0] hover:text-white flex items-center gap-1 px-2 py-1"
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                    <button
                      onClick={() => onDelete(h.id)}
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
        <HabitForm
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

function HabitForm({ initial, onClose }: { initial?: Habit; onClose: () => void }) {
  const create = useCreateHabit();
  const update = useUpdateHabit();
  const isEdit = !!initial;
  const [rawQuestion, setRawQuestion] = useState(initial?.rawQuestion ?? "");
  const [highlightWord, setHighlightWord] = useState(initial?.highlightWord ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "fa-sun");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [status, setStatus] = useState<"active" | "inactive">(
    (initial?.status as any) ?? "active",
  );

  const submit = async () => {
    if (!rawQuestion.trim()) {
      toast.error("Question required.");
      return;
    }
    const data = { rawQuestion, highlightWord, subtitle, icon, sortOrder, status };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: initial!.id, data });
        toast.success("Habit updated");
      } else {
        await create.mutateAsync(data);
        toast.success("Habit created");
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-6 overflow-y-auto">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h3 className="text-[14px] font-bold uppercase tracking-widest font-rajdhani text-white">
            {isEdit ? "Edit Habit" : "New Habit"}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-[#a0a0a0]">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">
          <label className={labelCls}>Question</label>
          <input
            className={inputCls}
            value={rawQuestion}
            onChange={(e) => setRawQuestion(e.target.value)}
            placeholder="Did you write your morning pages?"
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className={labelCls}>Highlight Word</label>
              <input
                className={inputCls}
                value={highlightWord}
                onChange={(e) => setHighlightWord(e.target.value)}
                placeholder="morning pages"
              />
            </div>
            <div>
              <label className={labelCls}>Icon (FontAwesome)</label>
              <input
                className={inputCls}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="fa-sun"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className={labelCls}>Subtitle</label>
            <textarea
              className={textareaCls}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Build clarity. Boost focus. Start your day right."
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className={labelCls}>Sort Order</label>
              <input
                type="number"
                className={inputCls}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
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
          <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[#2a2a2a]">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={create.isPending || update.isPending}
              className="px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani bg-[#dc2626] hover:bg-red-700 text-white flex items-center gap-1.5"
            >
              {(create.isPending || update.isPending) && (
                <Loader2 size={12} className="animate-spin" />
              )}
              {isEdit ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ButtonsTab() {
  const { data: config, isLoading } = useGetButtonsConfig();
  const update = useUpdateButtonsConfig();
  const [yesLabel, setYesLabel] = useState("");
  const [notYetLabel, setNotYetLabel] = useState("");
  const [initialized, setInitialized] = useState(false);

  React.useEffect(() => {
    if (config && !initialized) {
      setYesLabel(config.yesLabel);
      setNotYetLabel(config.notYetLabel);
      setInitialized(true);
    }
  }, [config, initialized]);

  const save = async () => {
    if (!yesLabel.trim() || !notYetLabel.trim()) {
      toast.error("Both labels required.");
      return;
    }
    try {
      await update.mutateAsync({ yesLabel, notYetLabel });
      toast.success("Button labels saved");
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Save failed");
    }
  };

  if (isLoading || !config) {
    return (
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-8 text-center">
        <Loader2 className="inline animate-spin text-[#666]" size={16} />
      </div>
    );
  }

  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5 max-w-xl">
      <p className="text-[12px] text-[#a0a0a0] mb-4">
        These labels appear on the two answer buttons under each habit question in the
        mobile app's Morning Ritual widget.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>&quot;Yes&quot; Button</label>
          <input className={inputCls} value={yesLabel} onChange={(e) => setYesLabel(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>&quot;Not Yet&quot; Button</label>
          <input
            className={inputCls}
            value={notYetLabel}
            onChange={(e) => setNotYetLabel(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={update.isPending}
          className="px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-rajdhani bg-[#dc2626] hover:bg-red-700 text-white flex items-center gap-1.5"
        >
          {update.isPending && <Loader2 size={12} className="animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}

"use client";

// Admin management for the FAQ shown from the "FAQ" button on the member
// Modules page (/courses). Members only ever see published FAQs, in this order.
import { useEffect, useRef, useState } from "react";
import { HelpCircle, Loader2, Plus, Save, Trash2, GripVertical, Pencil, Eye, EyeOff, X } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useMe } from "@/lib/hooks/useAdmin";
import {
  useDeleteModuleFaq,
  useListModuleFaqs,
  useReorderModuleFaqs,
  useSaveModuleFaq,
  useSetModuleFaqPublished,
  type ModuleFaq,
} from "@/lib/hooks/useTbt";

const QUESTION_MAX = 300;
const ANSWER_MAX = 5000;

const labelCls = "text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani";
const inputCls = "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 text-white text-sm outline-none focus:border-[#dc2626]";

type Draft = { id?: string; question: string; answer: string; isPublished: boolean };

function FaqForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const save = useSaveModuleFaq();
  const [form, setForm] = useState<Draft>(initial);
  const [errors, setErrors] = useState<{ question?: string; answer?: string }>({});

  const submit = async () => {
    const next: typeof errors = {};
    if (!form.question.trim()) next.question = "Question is required";
    else if (form.question.trim().length > QUESTION_MAX) next.question = `Keep the question under ${QUESTION_MAX} characters`;
    if (!form.answer.trim()) next.answer = "Answer is required";
    else if (form.answer.trim().length > ANSWER_MAX) next.answer = `Keep the answer under ${ANSWER_MAX} characters`;
    setErrors(next);
    if (next.question || next.answer) return;
    try {
      await save.mutateAsync({ id: form.id, question: form.question, answer: form.answer, isPublished: form.isPublished });
      toast.success(form.id ? "FAQ updated" : "FAQ created");
      onDone();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save FAQ");
    }
  };

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#f0f0f0]">{form.id ? "Edit FAQ" : "New FAQ"}</h2>
        <button onClick={onDone} aria-label="Close form" className="text-[#606060] hover:text-[#a0a0a0]"><X size={16} /></button>
      </div>
      <div className="space-y-1">
        <label htmlFor="faq-question" className={labelCls}>Question</label>
        <input
          id="faq-question"
          value={form.question}
          maxLength={QUESTION_MAX}
          onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
          className={`${inputCls} h-11`}
          placeholder="e.g. How do I unlock the next module?"
        />
        <div className="flex justify-between text-[11px]">
          <span className="text-red-400">{errors.question}</span>
          <span className="text-[#606060]">{form.question.length}/{QUESTION_MAX}</span>
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="faq-answer" className={labelCls}>Answer</label>
        <textarea
          id="faq-answer"
          value={form.answer}
          maxLength={ANSWER_MAX}
          rows={6}
          onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
          className={`${inputCls} py-3 resize-y min-h-[120px] leading-relaxed`}
          placeholder="Plain text. Line breaks are kept as written."
        />
        <div className="flex justify-between text-[11px]">
          <span className="text-red-400">{errors.answer}</span>
          <span className="text-[#606060]">{form.answer.length}/{ANSWER_MAX}</span>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-[#a0a0a0]">
        <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
        Published (visible to members)
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={save.isPending}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-xs font-bold text-white bg-[#dc2626] hover:bg-red-700 disabled:opacity-50"
        >
          {save.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save
        </button>
        <button onClick={onDone} disabled={save.isPending} className="h-10 px-3 text-xs text-[#a0a0a0] hover:text-white">Cancel</button>
      </div>
    </div>
  );
}

export default function ModuleFaqsPage() {
  const { data, isLoading, isError, refetch } = useListModuleFaqs();
  const { data: me } = useMe();
  const canEdit = me?.role === "admin" || me?.role === "super_admin";
  const setPublished = useSetModuleFaqPublished();
  const reorder = useReorderModuleFaqs();
  const remove = useDeleteModuleFaq();

  const [editing, setEditing] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ModuleFaq | null>(null);

  // DnD reorder (same pattern as the rest of the admin panel): local order + Save Order when dirty.
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [localItems, setLocalItems] = useState<ModuleFaq[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  useEffect(() => {
    setLocalItems(data ?? []);
    setIsDirty(false);
  }, [data]);

  const onDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === dropIdx) { setDragOver(null); return; }
    const next = [...localItems];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setLocalItems(next);
    setIsDirty(true);
    dragIdx.current = null;
    setDragOver(null);
  };

  const move = (idx: number, delta: number) => {
    const to = idx + delta;
    if (to < 0 || to >= localItems.length) return;
    const next = [...localItems];
    [next[idx], next[to]] = [next[to], next[idx]];
    setLocalItems(next);
    setIsDirty(true);
  };

  const saveOrder = async () => {
    try {
      await reorder.mutateAsync(localItems.map((f) => f.id));
      toast.success("Order saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save order");
    }
  };

  const togglePublished = async (faq: ModuleFaq) => {
    try {
      await setPublished.mutateAsync({ id: faq.id, isPublished: !faq.isPublished });
      toast.success(faq.isPublished ? "FAQ unpublished" : "FAQ published");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update FAQ");
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await remove.mutateAsync(confirmDelete.id);
      toast.success("FAQ deleted");
      setConfirmDelete(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete FAQ");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <HelpCircle size={22} className="text-[#dc2626]" />
            <div>
              <h1 className="text-xl font-bold text-[#f0f0f0]">Modules FAQ</h1>
              <p className="text-xs text-[#606060] mt-0.5">
                Questions members see from the FAQ button on the Modules page. Only published FAQs are shown, in this order.
              </p>
            </div>
          </div>
          {canEdit && !editing && (
            <button
              onClick={() => setEditing({ question: "", answer: "", isPublished: false })}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-xs font-bold text-white bg-[#dc2626] hover:bg-red-700"
            >
              <Plus size={14} /> Add FAQ
            </button>
          )}
        </div>

        {!canEdit && me && (
          <p className="text-xs text-[#a0a0a0] bg-[#181818] border border-[#2a2a2a] rounded-lg px-4 py-3">
            You can view the FAQ. Only Admin and Super Admin accounts can change it.
          </p>
        )}

        {editing && <FaqForm key={editing.id ?? "new"} initial={editing} onDone={() => setEditing(null)} />}

        {isLoading ? (
          <div className="flex items-center gap-2 text-[#606060] text-sm"><Loader2 size={16} className="animate-spin" /> Loading...</div>
        ) : isError ? (
          <div className="flex items-center gap-3 text-sm text-[#a0a0a0]">
            Couldn&apos;t load FAQs.
            <button onClick={() => refetch()} className="text-[#dc2626] font-semibold">Retry</button>
          </div>
        ) : localItems.length === 0 ? (
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-8 text-center text-sm text-[#606060]">
            No FAQs yet. {canEdit ? "Add the first one; members see it once it's published." : ""}
          </div>
        ) : (
          <div className="space-y-2">
            {isDirty && canEdit && (
              <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#dc2626]/40 rounded-lg px-4 py-2.5">
                <span className="text-xs text-[#a0a0a0]">Order changed. Save it to update what members see.</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setLocalItems(data ?? []); setIsDirty(false); }} className="text-xs text-[#a0a0a0] hover:text-white px-2">Reset</button>
                  <button
                    onClick={saveOrder}
                    disabled={reorder.isPending}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-white bg-[#dc2626] hover:bg-red-700 disabled:opacity-50"
                  >
                    {reorder.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save Order
                  </button>
                </div>
              </div>
            )}
            {localItems.map((faq, idx) => (
              <div
                key={faq.id}
                draggable={canEdit}
                onDragStart={() => { dragIdx.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onDrop(e, idx)}
                className={`bg-[#181818] border rounded-xl p-4 flex gap-3 ${dragOver === idx ? "border-[#dc2626]" : "border-[#2a2a2a]"}`}
              >
                {canEdit && (
                  <div className="flex flex-col items-center gap-1 pt-0.5 text-[#606060]">
                    <GripVertical size={16} className="cursor-grab" aria-hidden="true" />
                    <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up" className="text-[10px] disabled:opacity-30 hover:text-white">▲</button>
                    <button onClick={() => move(idx, 1)} disabled={idx === localItems.length - 1} aria-label="Move down" className="text-[10px] disabled:opacity-30 hover:text-white">▼</button>
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-[#f0f0f0]">{idx + 1}. {faq.question}</p>
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        faq.isPublished ? "text-green-400 bg-green-500/10" : "text-[#a0a0a0] bg-[#2a2a2a]"
                      }`}
                    >
                      {faq.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="text-xs text-[#a0a0a0] whitespace-pre-line line-clamp-3">{faq.answer}</p>
                  {canEdit && (
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => setEditing({ id: faq.id, question: faq.question, answer: faq.answer, isPublished: faq.isPublished })}
                        className="inline-flex items-center gap-1 text-xs text-[#a0a0a0] hover:text-white"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => togglePublished(faq)}
                        disabled={setPublished.isPending}
                        className="inline-flex items-center gap-1 text-xs text-[#a0a0a0] hover:text-white disabled:opacity-50"
                      >
                        {faq.isPublished ? <EyeOff size={12} /> : <Eye size={12} />} {faq.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <button onClick={() => setConfirmDelete(faq)} className="inline-flex items-center gap-1 text-xs text-[#a0a0a0] hover:text-red-400">
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="faq-delete-title"
            className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="faq-delete-title" className="text-sm font-bold text-[#f0f0f0]">Delete this FAQ?</h2>
            <p className="text-xs text-[#a0a0a0]">&ldquo;{confirmDelete.question}&rdquo; will be removed for everyone. This can&apos;t be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} disabled={remove.isPending} className="h-9 px-3 text-xs text-[#a0a0a0] hover:text-white">Cancel</button>
              <button
                onClick={doDelete}
                disabled={remove.isPending}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold text-white bg-[#dc2626] hover:bg-red-700 disabled:opacity-50"
              >
                {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useAdminPsychometricQuestions,
  useAdminCreatePsychometricQuestion,
  useAdminUpdatePsychometricQuestion,
  useAdminDeletePsychometricQuestion,
  useAdminPsychometricResponses,
} from "@/lib/hooks/useTbt";
import { Brain, Plus, Pencil, Trash2, Eye, X, Save, ChevronDown, ChevronUp, GripVertical, Loader2, Users2 } from "lucide-react";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface Option { id: string; text: string; score: number; }
interface Question {
  id: string;
  questionText: string;
  category: string;
  options: Option[];
  sortOrder: number;
  isActive: boolean;
}

const CATEGORIES = ["Vision", "Execution", "Leadership", "Innovation", "Resilience"];

const SCORE_LABEL_COLOR: Record<string, string> = {
  Expert:     "#10b981",
  Proficient: "#3b82f6",
  Growing:    "#f59e0b",
  Developing: "#ef4444",
};

// ── Question Form Modal ───────────────────────────────────────────────────────

function QuestionModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: Question;
  onClose: () => void;
  onSave: (data: { questionText: string; category: string; options: Option[]; isActive: boolean }) => void;
  saving: boolean;
}) {
  const [questionText, setQuestionText] = useState(initial?.questionText ?? "");
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0]);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [options, setOptions] = useState<Option[]>(
    initial?.options ?? [
      { id: "a", text: "", score: 4 },
      { id: "b", text: "", score: 3 },
      { id: "c", text: "", score: 2 },
      { id: "d", text: "", score: 1 },
    ]
  );

  const handleOptionChange = (idx: number, field: keyof Option, value: string | number) => {
    setOptions((prev) => prev.map((o, i) => i === idx ? { ...o, [field]: value } : o));
  };

  const handleSubmit = () => {
    if (!questionText.trim()) { toast.error("Question text required"); return; }
    if (options.some((o) => !o.text.trim())) { toast.error("All option texts are required"); return; }
    onSave({ questionText: questionText.trim(), category, options, isActive });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-[#2a2a2a] bg-[#141414] shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="font-bold text-[#f0f0f0]">{initial ? "Edit Question" : "New Question"}</h2>
          <button onClick={onClose} className="text-[#606060] hover:text-[#f0f0f0]"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] block mb-1.5">Question</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={2}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-white outline-none focus:border-[#dc2626] resize-none text-sm"
              placeholder="Enter your question..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] block mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 px-3 text-white outline-none focus:border-[#dc2626] text-sm"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] block mb-1.5">Status</label>
              <select
                value={isActive ? "active" : "inactive"}
                onChange={(e) => setIsActive(e.target.value === "active")}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-10 px-3 text-white outline-none focus:border-[#dc2626] text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#606060] block mb-2">Answer Options</label>
            <div className="space-y-2.5">
              {options.map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#606060] w-4">{opt.id.toUpperCase()}.</span>
                  <input
                    value={opt.text}
                    onChange={(e) => handleOptionChange(i, "text", e.target.value)}
                    className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 text-white outline-none focus:border-[#dc2626] text-sm"
                    placeholder={`Option ${opt.id.toUpperCase()}`}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#606060]">Score</span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={opt.score}
                      onChange={(e) => handleOptionChange(i, "score", Number(e.target.value))}
                      className="w-14 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-2 text-white outline-none focus:border-[#dc2626] text-sm text-center"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#2a2a2a] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {initial ? "Save Changes" : "Create Question"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Responses tab ─────────────────────────────────────────────────────────────

function ResponsesTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminPsychometricResponses({ page, limit: 20 });
  const responses = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <div className="space-y-3">
      <p className="text-[#a0a0a0] text-sm">{total} total submissions</p>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl animate-pulse bg-[#1a1a1a]" />)}
        </div>
      ) : responses.length === 0 ? (
        <p className="text-[#606060] text-sm text-center py-10">No submissions yet.</p>
      ) : (
        <div className="space-y-2">
          {responses.map((r: any) => (
            <div key={r.id} className="p-4 rounded-xl border border-[#2a2a2a] bg-[#181818]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-[#f0f0f0]">{r.memberName || "—"}</p>
                  <p className="text-xs text-[#606060]">{r.memberEmail}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold" style={{ color: SCORE_LABEL_COLOR[r.results?.overallLabel] ?? "#f0f0f0" }}>
                    {r.results?.overallPercentage ?? 0}%
                  </p>
                  <p className="text-[11px] text-[#606060]">{r.results?.overallLabel}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(r.results?.categories ?? []).map((c: any) => (
                  <span key={c.name} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: SCORE_LABEL_COLOR[c.label] ?? "#a0a0a0", background: `${SCORE_LABEL_COLOR[c.label] ?? "#a0a0a0"}18` }}>
                    {c.name}: {c.percentage}%
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-[#606060] mt-2">{new Date(r.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
      {total > 20 && (
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-xs text-[#a0a0a0] disabled:opacity-40 hover:text-[#f0f0f0]">Prev</button>
          <span className="text-xs text-[#606060]">Page {page}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={responses.length < 20}
            className="px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-xs text-[#a0a0a0] disabled:opacity-40 hover:text-[#f0f0f0]">Next</button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PsychometricPage() {
  const [tab, setTab] = useState<"questions" | "responses">("questions");
  const [modalOpen, setModalOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);

  const { data: questions = [], isLoading } = useAdminPsychometricQuestions();
  const createQ  = useAdminCreatePsychometricQuestion();
  const updateQ  = useAdminUpdatePsychometricQuestion();
  const deleteQ  = useAdminDeletePsychometricQuestion();

  const handleSave = async (data: { questionText: string; category: string; options: Option[]; isActive: boolean }) => {
    try {
      if (editQuestion) {
        await updateQ.mutateAsync({ id: editQuestion.id, ...data });
        toast.success("Question updated");
      } else {
        await createQ.mutateAsync({ ...data, sortOrder: questions.length });
        toast.success("Question created");
      }
      setModalOpen(false);
      setEditQuestion(null);
    } catch {
      toast.error("Failed to save question");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this question?")) return;
    try {
      await deleteQ.mutateAsync(id);
      toast.success("Question deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const openEdit = (q: Question) => {
    setEditQuestion(q);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditQuestion(null);
    setModalOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#dc2626]/15 flex items-center justify-center">
              <Brain size={20} className="text-[#dc2626]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest">
                Psychometric Assessment
              </h1>
              <p className="text-xs text-[#606060]">Manage test questions and view member results</p>
            </div>
          </div>
          {tab === "questions" && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-bold transition-colors"
            >
              <Plus size={14} /> Add Question
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[#2a2a2a]">
          {(["questions", "responses"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold transition-colors capitalize"
              style={{ color: tab === t ? "#dc2626" : "#606060", borderBottom: tab === t ? "2px solid #dc2626" : "2px solid transparent" }}
            >
              {t === "questions" ? <Brain size={13} /> : <Users2 size={13} />}
              {t}
              {t === "questions" && <span className="ml-1 text-[11px] bg-[#1a1a1a] text-[#a0a0a0] px-1.5 py-0.5 rounded-full">{questions.length}</span>}
            </button>
          ))}
        </div>

        {tab === "responses" ? (
          <ResponsesTab />
        ) : isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl animate-pulse bg-[#1a1a1a]" />)}
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 text-[#606060]">
            <Brain size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No questions yet. Click "Add Question" to create the first one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(questions as Question[]).map((q, i) => (
              <div key={q.id} className="flex items-start gap-3 p-4 rounded-xl border border-[#2a2a2a] bg-[#181818]">
                <span className="text-[#606060] text-sm font-bold w-5 flex-shrink-0 mt-0.5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#dc2626]/10 text-[#dc2626]">{q.category}</span>
                    {!q.isActive && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#606060]/20 text-[#606060]">Inactive</span>}
                  </div>
                  <p className="text-sm text-[#f0f0f0] leading-relaxed">{q.questionText}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {q.options.map((o) => (
                      <span key={o.id} className="text-[10px] text-[#a0a0a0] bg-[#1a1a1a] px-2 py-0.5 rounded-md">
                        {o.id.toUpperCase()}. {o.text.slice(0, 40)}{o.text.length > 40 ? "…" : ""} (+{o.score})
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(q)} className="p-2 rounded-lg hover:bg-[#1a1a1a] text-[#606060] hover:text-[#f0f0f0] transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(q.id)} className="p-2 rounded-lg hover:bg-[#1a1a1a] text-[#606060] hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <QuestionModal
          initial={editQuestion ?? undefined}
          onClose={() => { setModalOpen(false); setEditQuestion(null); }}
          onSave={handleSave}
          saving={createQ.isPending || updateQ.isPending}
        />
      )}
    </DashboardLayout>
  );
}

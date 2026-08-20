"use client";

import { useState, useRef, useEffect } from "react";
import {
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  FileWarning,
  ArrowLeft,
  FileText,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListMembers, useGetMember, useApproveMember } from "@/lib/hooks/useMembers";
import {
  useRejectOnboarding,
  useRequestOnboardingChanges,
  useListOnboardingContent,
  useCreateOnboardingContent,
  useUpdateOnboardingContent,
  useDeleteOnboardingContent,
  useReorderOnboardingContent,
} from "@/lib/hooks/useOnboarding";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Status config — the 4 admin-visible states from the spec ─────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  under_review: { label: "Pending Review", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", Icon: Clock },
  verified: { label: "Approved", color: "#22c55e", bg: "rgba(34,197,94,0.12)", Icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "#dc2626", bg: "rgba(220,38,38,0.12)", Icon: XCircle },
  changes_requested: { label: "Changes Required", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", Icon: FileWarning },
  awaiting_kyc: { label: "Not Submitted", color: "#606060", bg: "rgba(96,96,96,0.12)", Icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.awaiting_kyc;
  const Icon = cfg.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

const PROFILE_DISPLAY_FIELDS: { key: string; label: string }[] = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "businessName", label: "Business Name" },
  { key: "businessType", label: "Business Type" },
  { key: "productServiceType", label: "Product/Service" },
  { key: "gstNumber", label: "GST Number" },
  { key: "annualTurnover", label: "Annual Turnover" },
  { key: "businessStage", label: "Business Stage" },
  { key: "sector", label: "Sector" },
  { key: "industry", label: "Industry" },
];

// ─── Application detail / review ────────────────────────────────────────────

function ApplicationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading } = useGetMember(id);
  const member: any = data?.data;
  const approve = useApproveMember();
  const reject = useRejectOnboarding();
  const requestChanges = useRequestOnboardingChanges();
  const [note, setNote] = useState("");

  const canReview = member?.verificationStatus === "under_review";

  const handleApprove = async () => {
    if (!window.confirm(`Approve ${member?.firstName} ${member?.lastName ?? ""}? This activates their account.`)) return;
    await approve.mutateAsync({ id, data: {} });
  };

  const handleReject = async () => {
    if (!note.trim()) { window.alert("A reason is required to reject an application."); return; }
    if (!window.confirm("Reject this application? The member will see this reason.")) return;
    await reject.mutateAsync({ id, reason: note.trim() });
    setNote("");
  };

  const handleRequestChanges = async () => {
    if (!note.trim()) { window.alert("A note is required to request changes."); return; }
    if (!window.confirm("Send this application back for changes?")) return;
    await requestChanges.mutateAsync({ id, note: note.trim() });
    setNote("");
  };

  if (isLoading) return <div className="flex items-center justify-center py-16 text-[#888] text-sm">Loading…</div>;
  if (!member) return <div className="flex items-center justify-center py-16 text-[#888] text-sm">Application not found</div>;

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-[#888] hover:text-[#f0f0f0] transition-colors"
      >
        <ArrowLeft size={13} /> Back to applications
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest">
            {member.firstName} {member.lastName ?? ""}
          </h2>
          <p className="text-xs text-[#888] mt-0.5">{member.memberId}</p>
        </div>
        <StatusBadge status={member.verificationStatus} />
      </div>

      {member.onboardingReviewNote && (
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-lg p-3 text-xs text-[#a0a0a0]">
          <span className="text-[#606060] uppercase tracking-widest text-[10px] font-bold">Last admin note</span>
          <p className="mt-1">{member.onboardingReviewNote}</p>
        </div>
      )}

      {/* Profile summary */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-3">Submitted Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {PROFILE_DISPLAY_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex justify-between text-xs border-b border-[#1f1f1f] pb-2">
              <span className="text-[#888]">{label}</span>
              <span className="text-[#f0f0f0] text-right">{member[key] || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Documents */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-3">Documents</h3>
        {(!member.kycDocuments || member.kycDocuments.length === 0) ? (
          <p className="text-xs text-[#888]">No documents submitted</p>
        ) : (
          <div className="space-y-2">
            {member.kycDocuments.map((doc: any) => (
              <a
                key={doc.id}
                href={doc.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs text-[#a0a0a0] hover:text-[#f0f0f0] transition-colors"
              >
                <FileText size={13} className="text-[#dc2626]" />
                {doc.documentType}
                <span className="text-[#606060] uppercase text-[10px]">({doc.status})</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Review actions */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Review</h3>
        {!canReview ? (
          <p className="text-xs text-[#888]">
            {member.verificationStatus === "verified"
              ? "This application has already been approved."
              : "This application isn't currently awaiting review."}
          </p>
        ) : (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required for Reject / Request Changes — explain what's wrong or missing…"
              rows={3}
              className="w-full text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626] resize-none"
            />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleApprove}
                disabled={approve.isPending}
                className="px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#22c55e] hover:bg-green-600 text-white disabled:opacity-40 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={requestChanges.isPending}
                className="px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg border border-[#8b5cf6] text-[#8b5cf6] hover:bg-[rgba(139,92,246,0.1)] disabled:opacity-40 transition-colors"
              >
                Request Changes
              </button>
              <button
                onClick={handleReject}
                disabled={reject.isPending}
                className="px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg border border-[#dc2626] text-[#dc2626] hover:bg-[rgba(220,38,38,0.1)] disabled:opacity-40 transition-colors"
              >
                Reject
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Applications tab ───────────────────────────────────────────────────────

function ApplicationsTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("under_review");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const LIMIT = 25;

  const { data, isLoading } = useListMembers({
    page,
    limit: LIMIT,
    search,
    facets: statusFilter ? { verificationStatus: [statusFilter] } : undefined,
  });

  const rows: any[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  if (selectedId) return <ApplicationDetail id={selectedId} onBack={() => setSelectedId(null)} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, phone, email…"
            className="pl-9 pr-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626] w-64"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="pl-9 pr-4 h-9 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#a0a0a0] outline-none focus:border-[#dc2626] appearance-none cursor-pointer"
          >
            <option value="under_review">Pending Review</option>
            <option value="verified">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="changes_requested">Changes Required</option>
            <option value="">All statuses</option>
          </select>
        </div>
      </div>

      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-[#888] text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <UserCheck size={32} className="text-[#666]" />
            <p className="text-[#888] text-sm">No applications found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {["Member", "Phone", "Status", "Submitted"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m: any, i: number) => (
                <tr
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "border-b border-[#1f1f1f] hover:bg-[#181818] transition-colors cursor-pointer",
                    i === rows.length - 1 && "border-b-0"
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="text-[#f0f0f0] font-medium text-xs">{m.firstName} {m.lastName ?? ""}</p>
                    <p className="text-[#888] text-[11px]">{m.businessName ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-[#a0a0a0] text-xs">{m.phone}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.verificationStatus} /></td>
                  <td className="px-4 py-3 text-[#a0a0a0] text-xs">
                    {m.onboardingSubmittedAt ? format(new Date(m.onboardingSubmittedAt), "dd MMM yyyy, HH:mm") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#888]">{total} applications total</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-30 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-[#a0a0a0]">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] disabled:opacity-30 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Content tab (admin-authored onboarding step text/audio/video/image/quiz) ─

type QuizOption = { id: string; text: string; correct: boolean };
type QuizQuestion = { id: string; question: string; options: QuizOption[]; explanation: string };

const EMPTY_FORM = { stepKey: "", title: "", textBody: "", videoUrl: "", audioUrl: "", imageUrl: "", lottieUrl: "", sortOrder: 0 };

function QuizPreview({ questions }: { questions: QuizQuestion[] }) {
  if (!questions?.length) return <p className="text-xs text-[#888] p-4">No questions</p>;
  return (
    <div className="p-4 bg-[#0a0a0a] space-y-4">
      {questions.map((q: any, qi: number) => (
        <div key={q.id ?? qi} className="space-y-2">
          <p className="text-xs text-[#f0f0f0] font-medium">{qi + 1}. {q.question}</p>
          <div className="space-y-1 pl-3">
            {(q.options ?? []).map((opt: any) => (
              <div key={opt.id} className={cn("flex items-center gap-2 text-xs", opt.correct ? "text-[#22c55e]" : "text-[#888]")}>
                <span className="font-mono w-4">{opt.id?.toUpperCase()}.</span>
                <span>{opt.text}</span>
                {opt.correct && <span className="text-[10px] font-bold">(correct)</span>}
              </div>
            ))}
          </div>
          {q.explanation && (
            <p className="text-[11px] text-[#606060] pl-3 italic">{q.explanation}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ContentTab() {
  const { data, isLoading } = useListOnboardingContent();
  const create = useCreateOnboardingContent();
  const update = useUpdateOnboardingContent();
  const del = useDeleteOnboardingContent();
  const reorder = useReorderOnboardingContent();
  const serverRows: any[] = data?.data ?? [];

  // DnD reorder state
  const [localRows, setLocalRows] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => { setLocalRows(serverRows); setIsDirty(false); }, [data]);

  const onDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === dropIdx) { setDragOver(null); return; }
    const next = [...localRows];
    const [moved] = next.splice(from, 1);
    next.splice(dropIdx, 0, moved);
    setLocalRows(next);
    setIsDirty(true);
    dragIdx.current = null;
    setDragOver(null);
  };

  const handleSaveOrder = async () => {
    await reorder.mutateAsync(localRows.map((r) => r.id));
    setIsDirty(false);
  };

  // Quiz preview state
  const [previewQuizId, setPreviewQuizId] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [quizQs, setQuizQs] = useState<QuizQuestion[]>([]);
  const [showQuizBuilder, setShowQuizBuilder] = useState(false);

  const addQuestion = () => setQuizQs((qs) => [
    ...qs,
    {
      id: Date.now().toString(),
      question: "",
      explanation: "",
      options: [
        { id: "a", text: "", correct: true },
        { id: "b", text: "", correct: false },
        { id: "c", text: "", correct: false },
        { id: "d", text: "", correct: false },
      ],
    },
  ]);

  const removeQuestion = (id: string) => setQuizQs((qs) => qs.filter((q) => q.id !== id));
  const updateQuestion = (id: string, field: string, val: string) =>
    setQuizQs((qs) => qs.map((q) => (q.id === id ? { ...q, [field]: val } : q)));
  const updateOption = (qId: string, optId: string, val: string) =>
    setQuizQs((qs) => qs.map((q) => q.id === qId ? { ...q, options: q.options.map((o) => o.id === optId ? { ...o, text: val } : o) } : q));
  const setCorrect = (qId: string, optId: string) =>
    setQuizQs((qs) => qs.map((q) => q.id === qId ? { ...q, options: q.options.map((o) => ({ ...o, correct: o.id === optId })) } : q));

  const handleCreate = async () => {
    if (!form.stepKey.trim() || !form.title.trim()) { window.alert("Step key and title are required."); return; }
    const quizData = quizQs.length > 0 ? { questions: quizQs } : undefined;
    await create.mutateAsync({ ...form, quizData, isActive: true } as any);
    setForm({ ...EMPTY_FORM });
    setQuizQs([]);
    setShowQuizBuilder(false);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete onboarding step "${title}"? This cannot be undone.`)) return;
    await del.mutateAsync(id);
  };

  const inputCls = "h-10 px-3 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626] w-full";

  return (
    <div className="space-y-5">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Add Step Content</h3>

        {/* Basic fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <input placeholder="Step key (e.g. introduction)" value={form.stepKey} onChange={(e) => setForm({ ...form, stepKey: e.target.value })} className={inputCls} />
            <p className="mt-1 text-[11px] text-[#555]">
              Use <code className="text-[#888]">introduction</code> to show before the profile step, or <code className="text-[#888]">guided_instructions</code> to show after document upload.
            </p>
          </div>
          <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
          <input
            type="number"
            placeholder="Sort order (0 = first)"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
        <textarea placeholder="Text body" value={form.textBody} onChange={(e) => setForm({ ...form, textBody: e.target.value })} rows={3} className="w-full text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626] resize-none" />

        {/* Media URLs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Video URL (HLS/mp4, optional)" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} className={inputCls} />
          <input placeholder="Audio URL (optional)" value={form.audioUrl} onChange={(e) => setForm({ ...form, audioUrl: e.target.value })} className={inputCls} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input placeholder="Image URL (hero illustration, optional)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className={inputCls} />
          <input placeholder="Lottie URL (.json animation, optional)" value={form.lottieUrl} onChange={(e) => setForm({ ...form, lottieUrl: e.target.value })} className={inputCls} />
        </div>

        {/* Quiz builder */}
        <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
          <button
            onClick={() => setShowQuizBuilder((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#a0a0a0] hover:text-[#f0f0f0] transition-colors"
          >
            <span>Quiz Builder {quizQs.length > 0 && `(${quizQs.length} question${quizQs.length > 1 ? "s" : ""})`}</span>
            <span>{showQuizBuilder ? "▲" : "▼"}</span>
          </button>
          {showQuizBuilder && (
            <div className="border-t border-[#2a2a2a] p-4 space-y-4">
              {quizQs.map((q, qi) => (
                <div key={q.id} className="bg-[#0f0f0f] border border-[#333] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Question {qi + 1}</span>
                    <button onClick={() => removeQuestion(q.id)} className="text-[#dc2626] hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                  <input
                    placeholder="Question text"
                    value={q.question}
                    onChange={(e) => updateQuestion(q.id, "question", e.target.value)}
                    className={inputCls}
                  />
                  <div className="space-y-2">
                    {q.options.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={opt.correct}
                          onChange={() => setCorrect(q.id, opt.id)}
                          className="accent-[#dc2626]"
                          title="Mark as correct answer"
                        />
                        <input
                          placeholder={`Option ${opt.id.toUpperCase()}`}
                          value={opt.text}
                          onChange={(e) => updateOption(q.id, opt.id, e.target.value)}
                          className="flex-1 h-9 px-3 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626]"
                        />
                        {opt.correct && <span className="text-[10px] text-[#22c55e] font-bold uppercase">✓ Correct</span>}
                      </div>
                    ))}
                  </div>
                  <input
                    placeholder="Explanation (shown after answering)"
                    value={q.explanation}
                    onChange={(e) => updateQuestion(q.id, "explanation", e.target.value)}
                    className={inputCls}
                  />
                </div>
              ))}
              <button
                onClick={addQuestion}
                className="inline-flex items-center gap-2 px-3 h-8 text-xs font-bold uppercase tracking-widest rounded-lg border border-[#2a2a2a] text-[#a0a0a0] hover:text-[#f0f0f0] hover:border-[#444] transition-colors"
              >
                <Plus size={12} /> Add Question
              </button>
            </div>
          )}
        </div>

        <button onClick={handleCreate} disabled={create.isPending} className="inline-flex items-center gap-2 px-4 h-9 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40 transition-colors">
          <Plus size={13} /> Add Step
        </button>
      </div>

      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {isDirty && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[rgba(220,38,38,0.06)]">
            <p className="text-xs text-[#a0a0a0]">Drag rows to reorder. Changes are local until saved.</p>
            <button
              onClick={handleSaveOrder}
              disabled={reorder.isPending}
              className="px-4 h-8 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40 transition-colors"
            >
              {reorder.isPending ? "Saving…" : "Save Order"}
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-[#888] text-sm">Loading…</div>
        ) : localRows.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-[#888] text-sm">No onboarding content yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="w-8 px-2 py-3" />
                {["Step Key", "Title", "Media", "Active", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#888] font-rajdhani">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {localRows.map((row: any, i: number) => (
                <>
                  <tr
                    key={row.id}
                    draggable
                    onDragStart={() => { dragIdx.current = i; }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
                    onDrop={(e) => onDrop(e, i)}
                    onDragLeave={() => setDragOver(null)}
                    className={cn(
                      "border-b border-[#1f1f1f] transition-colors",
                      i === localRows.length - 1 && previewQuizId !== row.id && "border-b-0",
                      dragOver === i && "border-t-2 border-t-[#dc2626]",
                    )}
                  >
                    <td className="px-2 py-3 text-[#444] cursor-grab active:cursor-grabbing">
                      <GripVertical size={14} />
                    </td>
                    <td className="px-4 py-3 text-[#a0a0a0] text-xs font-mono">{row.stepKey}</td>
                    <td className="px-4 py-3 text-[#f0f0f0] text-xs">{row.title}</td>
                    <td className="px-4 py-3 text-[#888] text-xs">
                      {[
                        row.lottieUrl && "lottie",
                        row.imageUrl && "image",
                        row.videoUrl && "video",
                        row.audioUrl && "audio",
                        row.quizData && "quiz",
                      ].filter(Boolean).join(", ") || "text only"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => update.mutateAsync({ id: row.id, data: { isActive: !row.isActive } })}
                        className={cn("text-[11px] font-bold uppercase px-2 py-1 rounded-full", row.isActive ? "text-[#22c55e] bg-[rgba(34,197,94,0.12)]" : "text-[#888] bg-[rgba(136,136,136,0.12)]")}
                      >
                        {row.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {row.quizData?.questions?.length > 0 && (
                          <button
                            onClick={() => setPreviewQuizId((id) => id === row.id ? null : row.id)}
                            className="text-[#888] hover:text-[#f0f0f0] transition-colors"
                            title="Preview quiz"
                          >
                            {previewQuizId === row.id ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                        <button onClick={() => handleDelete(row.id, row.title)} className="text-[#dc2626] hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {previewQuizId === row.id && row.quizData && (
                    <tr key={`${row.id}-quiz`} className={cn("border-b border-[#1f1f1f]", i === localRows.length - 1 && "border-b-0")}>
                      <td colSpan={6} className="p-0">
                        <QuizPreview questions={row.quizData.questions ?? []} />
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
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [tab, setTab] = useState<"applications" | "content">("applications");

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest flex items-center gap-2">
            <UserCheck size={20} className="text-[#dc2626]" />
            Onboarding
          </h1>
          <p className="text-xs text-[#888] mt-0.5">Self-onboarding applications and instructional content</p>
        </div>

        <div className="flex gap-1 border-b border-[#2a2a2a]">
          {(["applications", "content"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-xs font-bold uppercase tracking-widest font-rajdhani border-b-2 transition-colors",
                tab === t ? "text-[#dc2626] border-[#dc2626]" : "text-[#888] border-transparent hover:text-[#f0f0f0]"
              )}
            >
              {t === "applications" ? "Applications" : "Content"}
            </button>
          ))}
        </div>

        {tab === "applications" ? <ApplicationsTab /> : <ContentTab />}
      </div>
    </DashboardLayout>
  );
}

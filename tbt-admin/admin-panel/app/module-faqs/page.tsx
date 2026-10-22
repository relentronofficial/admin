"use client";

// Admin management for the FAQ shown from the "FAQ" button on the member
// Modules page (/courses). Members only ever see published FAQs, in this order.
import { useEffect, useRef, useState } from "react";
import { HelpCircle, Loader2, Plus, Save, Trash2, GripVertical, Pencil, Eye, EyeOff, X, Upload, Video } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useMe, useCreateBunnyVideo, useGetPresignedUrl } from "@/lib/hooks/useAdmin";
import {
  useCreateModuleFaqsBulk,
  useDeleteModuleFaq,
  useListModuleFaqs,
  useReorderModuleFaqs,
  useSaveModuleFaq,
  useSetModuleFaqPublished,
  type ModuleFaq,
  type ModuleFaqCategory,
} from "@/lib/hooks/useTbt";

const QUESTION_MAX = 300;
const ANSWER_MAX = 5000;

const labelCls = "text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani";
const inputCls = "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 text-white text-sm outline-none focus:border-[#dc2626]";

type Draft = {
  id?: string; question: string; answer: string; isPublished: boolean; videoUrl?: string | null; bunnyVideoId?: string | null;
  category?: ModuleFaqCategory | null;
  thumbnailUrl?: string | null;
};

/** FAQ categories — the sections members see in the FAQ popup. */
const FAQ_CATEGORY_OPTIONS: Array<{ value: ModuleFaqCategory; label: string }> = [
  { value: "ecommerce", label: "Ecommerce" },
  { value: "service", label: "Service" },
  { value: "coachx", label: "CoachX" },
];

/** One Question/Answer (+ optional video) entry in the form. */
type Entry = {
  key: string;
  question: string;
  answer: string;
  videoUrl: string | null;
  bunnyVideoId: string | null;
  /** 0–100 while uploading, null otherwise */
  uploadPct: number | null;
  uploadError: string | null;
  /** Name of the file chosen in this session (shown with its upload status). */
  fileName: string | null;
  /** Optional thumbnail image (public URL) and its upload state. */
  thumbnailUrl: string | null;
  thumbPct: number | null;
  thumbError: string | null;
  thumbFileName: string | null;
};

/** Video formats the FAQ uploader accepts (Bunny Stream transcodes all three). */
const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";
const isSupportedVideo = (file: File) =>
  ["video/mp4", "video/webm", "video/quicktime"].includes(file.type) || /\.(mp4|webm|mov)$/i.test(file.name);
type EntryErrors = { question?: string; answer?: string };

let entrySeq = 0;
const newEntry = (over: Partial<Entry> = {}): Entry => ({
  key: `e${++entrySeq}`, question: "", answer: "", videoUrl: null, bunnyVideoId: null, uploadPct: null, uploadError: null, fileName: null,
  thumbnailUrl: null, thumbPct: null, thumbError: null, thumbFileName: null, ...over,
});

/**
 * Optional FAQ video — same Bunny Stream flow as the ads/onboarding uploads:
 * create the video server-side (useCreateBunnyVideo), upload the file with
 * tus-js-client (progress), then keep the returned embed URL + video id.
 */
function FaqVideoField({ entry, number, inputId, disabled, onChange }: {
  entry: Entry;
  number: number;
  inputId: string;
  disabled: boolean;
  onChange: (patch: Partial<Entry>) => void;
}) {
  const createBunnyVideo = useCreateBunnyVideo();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploading = entry.uploadPct !== null;

  const upload = async (file: File) => {
    if (!isSupportedVideo(file)) {
      onChange({ fileName: file.name, uploadError: "Unsupported format — choose an MP4, WebM or MOV video" });
      return;
    }
    onChange({ fileName: file.name, uploadPct: 0, uploadError: null });
    try {
      const title = entry.question.trim() || file.name;
      const { videoId, tusUploadUrl, tusHeaders, embedUrl } = await createBunnyVideo.mutateAsync({ title });
      const { Upload } = await import("tus-js-client");
      await new Promise<void>((resolve, reject) => {
        const tus = new Upload(file, {
          endpoint: tusUploadUrl,
          headers: {
            AuthorizationSignature: tusHeaders.AuthorizationSignature,
            AuthorizationExpire: String(tusHeaders.AuthorizationExpire),
            VideoId: tusHeaders.VideoId,
            LibraryId: tusHeaders.LibraryId,
          },
          chunkSize: 5 * 1024 * 1024,
          retryDelays: [0, 3000, 5000, 10000],
          metadata: { filetype: file.type, title },
          onProgress(sent: number, total: number) { onChange({ uploadPct: Math.round((sent / total) * 100) }); },
          onSuccess() { resolve(); },
          onError(err: any) { reject(err); },
        });
        tus.start();
      });
      onChange({ videoUrl: embedUrl, bunnyVideoId: videoId, uploadPct: null, uploadError: null });
      toast.success("Video uploaded");
    } catch (err: any) {
      onChange({ uploadPct: null, uploadError: err?.message || "Video upload failed" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className={labelCls}>Video {number} (Optional)</label>
      <input
        id={inputId}
        ref={fileRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-[#f0f0f0] bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#dc2626] disabled:opacity-50"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? `Uploading… ${entry.uploadPct}%` : entry.videoUrl ? "Replace Video" : "Upload Video"}
        </button>
        {entry.videoUrl && !uploading && (
          <>
            <a href={entry.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-green-400 hover:underline">
              <Video size={12} /> Video attached
            </a>
            <button
              type="button"
              onClick={() => onChange({ videoUrl: null, bunnyVideoId: null })}
              disabled={disabled}
              className="text-xs text-[#a0a0a0] hover:text-red-400"
            >
              Remove video
            </button>
          </>
        )}
      </div>
      <p className="text-[11px] text-[#606060]">Supported formats: MP4, WebM, MOV</p>
      {entry.fileName && (
        <p className="text-[11px] text-[#a0a0a0]" data-video-status>
          {entry.fileName}
          {" — "}
          {uploading ? `Uploading ${entry.uploadPct}%` : entry.uploadError ? "Upload failed" : entry.videoUrl ? "Uploaded" : ""}
        </p>
      )}
      {uploading && (
        <div className="h-1.5 w-full max-w-xs bg-[#2a2a2a] rounded-full overflow-hidden" role="progressbar" aria-label="Video upload progress" aria-valuenow={entry.uploadPct ?? 0} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-[#dc2626]" style={{ width: `${entry.uploadPct}%` }} />
        </div>
      )}
      {entry.uploadError && <p className="text-[11px] text-red-400" role="alert">{entry.uploadError}</p>}
    </div>
  );
}

/** Thumbnail image formats the FAQ uploader accepts. */
const THUMB_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const THUMB_MAX_BYTES = 10 * 1024 * 1024;
const isSupportedThumb = (file: File) =>
  ["image/jpeg", "image/png", "image/webp"].includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);

/** PUT the file to a presigned storage URL, reporting progress (fetch has no upload progress). */
const putWithProgress = (url: string, file: File, onProgress: (pct: number) => void) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.send(file);
  });

/**
 * Optional FAQ thumbnail — same presigned-URL storage upload used across the admin
 * (useGetPresignedUrl → PUT the file → keep the public URL). Storage credentials stay server-side.
 */
function FaqThumbnailField({ entry, inputId, disabled, onChange }: {
  entry: Entry;
  inputId: string;
  disabled: boolean;
  onChange: (patch: Partial<Entry>) => void;
}) {
  const getPresignedUrl = useGetPresignedUrl();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploading = entry.thumbPct !== null;

  const upload = async (file: File) => {
    if (!isSupportedThumb(file)) {
      onChange({ thumbFileName: file.name, thumbError: "Unsupported format — choose a JPG, JPEG, PNG or WebP image" });
      return;
    }
    if (file.size > THUMB_MAX_BYTES) {
      onChange({ thumbFileName: file.name, thumbError: "Image is too large — the limit is 10 MB" });
      return;
    }
    onChange({ thumbFileName: file.name, thumbPct: 0, thumbError: null });
    try {
      const contentType = file.type || (/\.png$/i.test(file.name) ? "image/png" : /\.webp$/i.test(file.name) ? "image/webp" : "image/jpeg");
      const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "-");
      const { uploadUrl, publicUrl } = await getPresignedUrl.mutateAsync({
        filename: safeName, contentType, bucket: "site-assets", pathPrefix: "module-faqs/thumbnails",
      });
      if (!uploadUrl || !publicUrl) throw new Error("Could not start the upload");
      await putWithProgress(uploadUrl, file, (pct) => onChange({ thumbPct: pct }));
      onChange({ thumbnailUrl: publicUrl, thumbPct: null, thumbError: null });
      toast.success("Thumbnail uploaded");
    } catch (err: any) {
      onChange({ thumbPct: null, thumbError: err?.message || "Thumbnail upload failed" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className={labelCls}>Thumbnail (Optional)</label>
      <input
        id={inputId}
        ref={fileRef}
        type="file"
        accept={THUMB_ACCEPT}
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-[#f0f0f0] bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#dc2626] disabled:opacity-50"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? `Uploading… ${entry.thumbPct}%` : entry.thumbnailUrl ? "Replace Thumbnail" : "Upload Thumbnail"}
        </button>
        {entry.thumbnailUrl && !uploading && (
          <button
            type="button"
            onClick={() => onChange({ thumbnailUrl: null })}
            disabled={disabled}
            className="text-xs text-[#a0a0a0] hover:text-red-400"
          >
            Remove thumbnail
          </button>
        )}
      </div>
      {entry.thumbFileName && (
        <p className="text-[11px] text-[#a0a0a0]" data-thumb-status>
          {entry.thumbFileName}
          {" — "}
          {uploading ? `Uploading ${entry.thumbPct}%` : entry.thumbError ? "Upload failed" : entry.thumbnailUrl ? "Uploaded" : ""}
        </p>
      )}
      {uploading && (
        <div className="h-1.5 w-full max-w-xs bg-[#2a2a2a] rounded-full overflow-hidden" role="progressbar" aria-label="Thumbnail upload progress" aria-valuenow={entry.thumbPct ?? 0} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-[#dc2626]" style={{ width: `${entry.thumbPct}%` }} />
        </div>
      )}
      {entry.thumbnailUrl && !uploading && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.thumbnailUrl} alt="Thumbnail preview" className="h-24 w-auto max-w-[200px] rounded-lg border border-[#2a2a2a] object-cover" />
      )}
      {entry.thumbError && <p className="text-[11px] text-red-400" role="alert">{entry.thumbError}</p>}
    </div>
  );
}

function FaqForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const save = useSaveModuleFaq();
  const saveMany = useCreateModuleFaqsBulk();
  const isEdit = !!initial.id;
  const [isPublished, setIsPublished] = useState(initial.isPublished);
  // No preselection: the admin must choose (older FAQs without one start empty too).
  const [category, setCategory] = useState<ModuleFaqCategory | "">(initial.category ?? "");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>(() => [
    newEntry({ question: initial.question, answer: initial.answer, videoUrl: initial.videoUrl ?? null, bunnyVideoId: initial.bunnyVideoId ?? null, thumbnailUrl: initial.thumbnailUrl ?? null }),
  ]);
  const [errors, setErrors] = useState<Record<string, EntryErrors>>({});
  const saving = save.isPending || saveMany.isPending;
  const anyUploading = entries.some((e) => e.uploadPct !== null);
  const anyThumbUploading = entries.some((e) => e.thumbPct !== null);

  const patch = (key: string, p: Partial<Entry>) => setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...p } : e)));

  const submit = async () => {
    if (anyUploading) {
      toast.error("Wait for the video upload to finish");
      return;
    }
    if (anyThumbUploading) {
      toast.error("Wait for the thumbnail upload to finish");
      return;
    }
    const next: Record<string, EntryErrors> = {};
    for (const e of entries) {
      const err: EntryErrors = {};
      if (!e.question.trim()) err.question = "Question is required";
      else if (e.question.trim().length > QUESTION_MAX) err.question = `Keep the question under ${QUESTION_MAX} characters`;
      if (!e.answer.trim()) err.answer = "Answer is required";
      else if (e.answer.trim().length > ANSWER_MAX) err.answer = `Keep the answer under ${ANSWER_MAX} characters`;
      if (err.question || err.answer) next[e.key] = err;
    }
    setErrors(next);
    const catErr = category ? null : "Category is required";
    setCategoryError(catErr);
    if (Object.keys(next).length > 0 || catErr || !category) return;
    const payload = (e: Entry) => ({ question: e.question, answer: e.answer, isPublished, videoUrl: e.videoUrl, bunnyVideoId: e.bunnyVideoId, category, thumbnailUrl: e.thumbnailUrl });
    try {
      if (isEdit) {
        await save.mutateAsync({ id: initial.id, ...payload(entries[0]) });
        toast.success("FAQ updated");
      } else {
        await saveMany.mutateAsync(entries.map(payload));
        toast.success(entries.length === 1 ? "FAQ created" : `${entries.length} FAQs created`);
      }
      onDone();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save FAQ");
    }
  };

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#f0f0f0]">{isEdit ? "Edit FAQ" : "New FAQ"}</h2>
        <button onClick={onDone} aria-label="Close form" className="text-[#606060] hover:text-[#a0a0a0]"><X size={16} /></button>
      </div>
      <div className="space-y-1">
        <label htmlFor="faq-category" className={labelCls}>Category</label>
        <select
          id="faq-category"
          required
          value={category}
          onChange={(e) => { setCategory(e.target.value as ModuleFaqCategory | ""); setCategoryError(null); }}
          className={`${inputCls} h-11`}
          aria-invalid={categoryError ? true : undefined}
        >
          <option value="" disabled>Select a category</option>
          {FAQ_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {categoryError && <p className="text-[11px] text-red-400">{categoryError}</p>}
      </div>
      {entries.map((entry, i) => {
        const qId = i === 0 ? "faq-question" : `faq-question-${i + 1}`;
        const aId = i === 0 ? "faq-answer" : `faq-answer-${i + 1}`;
        const err = errors[entry.key] ?? {};
        return (
          <div key={entry.key} className={i === 0 ? "space-y-4" : "space-y-4 border-t border-[#2a2a2a] pt-4"} data-faq-entry={i + 1}>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor={qId} className={labelCls}>Question {i + 1}</label>
              </div>
              <input
                id={qId}
                value={entry.question}
                maxLength={QUESTION_MAX}
                onChange={(e) => patch(entry.key, { question: e.target.value })}
                className={`${inputCls} h-11`}
                placeholder="e.g. How do I unlock the next module?"
              />
              <div className="flex justify-between text-[11px]">
                <span className="text-red-400">{err.question}</span>
                <span className="text-[#606060]">{entry.question.length}/{QUESTION_MAX}</span>
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor={aId} className={labelCls}>Answer {i + 1}</label>
              <textarea
                id={aId}
                value={entry.answer}
                maxLength={ANSWER_MAX}
                rows={6}
                onChange={(e) => patch(entry.key, { answer: e.target.value })}
                className={`${inputCls} py-3 resize-y min-h-[120px] leading-relaxed`}
                placeholder="Plain text. Line breaks are kept as written."
              />
              <div className="flex justify-between text-[11px]">
                <span className="text-red-400">{err.answer}</span>
                <span className="text-[#606060]">{entry.answer.length}/{ANSWER_MAX}</span>
              </div>
            </div>
            <FaqVideoField entry={entry} number={i + 1} inputId={`faq-video-${i + 1}`} disabled={saving} onChange={(p) => patch(entry.key, p)} />
            <FaqThumbnailField entry={entry} inputId={`faq-thumbnail-${i + 1}`} disabled={saving} onChange={(p) => patch(entry.key, p)} />
          </div>
        );
      })}
      <label className="flex items-center gap-2 text-sm text-[#a0a0a0]">
        <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
        Published (visible to members)
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={saving || anyUploading || anyThumbUploading}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-xs font-bold text-white bg-[#dc2626] hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save FAQ
        </button>
        <button onClick={onDone} disabled={saving} className="h-10 px-3 text-xs text-[#a0a0a0] hover:text-white">Cancel</button>
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
              onClick={() => setEditing({ question: "", answer: "", isPublished: false, videoUrl: null, bunnyVideoId: null })}
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
                  {faq.videoUrl && (
                    <p className="inline-flex items-center gap-1 text-[11px] text-green-400"><Video size={11} /> Video attached</p>
                  )}
                  {canEdit && (
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => setEditing({ id: faq.id, question: faq.question, answer: faq.answer, isPublished: faq.isPublished, videoUrl: faq.videoUrl ?? null, bunnyVideoId: faq.bunnyVideoId ?? null, category: faq.category ?? null, thumbnailUrl: faq.thumbnailUrl ?? null })}
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

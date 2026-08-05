"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Image as ImageIcon, Loader2, Video, X } from "lucide-react";

import { useMe } from "@/lib/hooks/useUser";
import { useSubmitPost } from "@/lib/hooks/useCommunity";
import { uploadPostMedia } from "@/lib/api/services/community.service";
import { memberDisplayName } from "@/lib/hooks/useCommunity";

import { MemberAvatar } from "./MemberAvatar";

const MAX_MEDIA = 4;
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

interface MediaSlot {
  id: string;
  file: File;
  previewUrl: string;
  isVideo: boolean;
  uploading: boolean;
  uploadedUrl: string | null;
}

/**
 * Compact inline composer that lives at the top of the feed. Clicking
 * anywhere on the compact row opens the full modal composer.
 */
export function InlineComposerRow({ onOpen }: { onOpen: () => void }) {
  const { data: me } = useMe();
  const name = memberDisplayName(me as unknown as { firstName?: string; lastName?: string });
  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-colors hover:bg-[var(--color-surface-overlay)]"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <MemberAvatar
        member={me as unknown as { firstName?: string; lastName?: string; profilePhotoUrl?: string | null }}
        size={40}
      />
      <span className="flex-1 text-sm text-muted-foreground">
        Share a win, ask a question, {name}…
      </span>
    </button>
  );
}

// ── Composer modal ─────────────────────────────────────────────────────────

export function ComposerModal({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const { data: me } = useMe();
  const submit = useSubmitPost();

  const [content, setContent] = useState("");
  const [slots, setSlots] = useState<MediaSlot[]>([]);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, busy]);

  useEffect(() => {
    if (!open) {
      // reset when closing
      setContent("");
      slots.forEach((s) => URL.revokeObjectURL(s.previewUrl));
      setSlots([]);
      setBanner(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;

    const remaining = MAX_MEDIA - slots.length;
    if (remaining <= 0) {
      setBanner(`Attachment limit reached (${MAX_MEDIA}).`);
      return;
    }

    const accepted: File[] = [];
    for (const f of picked) {
      if (accepted.length >= remaining) break;
      if (f.size > MAX_MEDIA_BYTES) {
        setBanner(`Skipped "${f.name}" — over 20 MB.`);
        continue;
      }
      accepted.push(f);
    }

    const newSlots: MediaSlot[] = accepted.map((file) => ({
      id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      isVideo: file.type.startsWith("video/"),
      uploading: true,
      uploadedUrl: null,
    }));
    setSlots((prev) => [...prev, ...newSlots]);

    await Promise.all(
      newSlots.map(async (slot) => {
        const url = await uploadPostMedia(slot.file);
        setSlots((prev) =>
          prev.map((s) => (s.id === slot.id ? { ...s, uploading: false, uploadedUrl: url } : s)),
        );
      }),
    );
  }

  function removeSlot(id: string) {
    setSlots((prev) => {
      const slot = prev.find((s) => s.id === id);
      if (slot) URL.revokeObjectURL(slot.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }

  async function onPost() {
    setBanner(null);
    const trimmed = content.trim();
    if (!trimmed && slots.length === 0) {
      setBanner("Write something or attach media before posting.");
      return;
    }
    const anyUploading = slots.some((s) => s.uploading);
    if (anyUploading) {
      setBanner("Wait for uploads to finish.");
      return;
    }
    const anyFailed = slots.some((s) => !s.uploading && !s.uploadedUrl);
    if (anyFailed) {
      setBanner("Some uploads failed. Remove them or try again.");
      return;
    }

    setBusy(true);
    try {
      const urls = slots.map((s) => s.uploadedUrl).filter((u): u is string => !!u);
      await submit.mutateAsync({
        content: trimmed,
        mediaUrls: urls.length > 0 ? urls : undefined,
      });
      onSubmitted?.();
      onClose();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Could not post. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6 overflow-y-auto">
      <div
        className="w-full sm:max-w-lg rounded-none sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-medium)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <h3 className="text-base font-bold text-foreground">Create a post</h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1 rounded-lg hover:bg-[var(--color-surface-overlay)] disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <MemberAvatar
              member={me as unknown as { firstName?: string; lastName?: string; profilePhotoUrl?: string | null }}
              size={40}
            />
            <textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Share a win, ask a question, drop a lesson…"
              className="flex-1 bg-transparent text-sm text-foreground outline-none resize-none placeholder:text-muted-foreground min-h-[120px]"
            />
          </div>

          {slots.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {slots.map((s) => (
                <div
                  key={s.id}
                  className="relative aspect-square rounded-lg overflow-hidden bg-black"
                  style={{ border: "1px solid var(--color-border-subtle)" }}
                >
                  {s.isVideo ? (
                    <video src={s.previewUrl} className="w-full h-full object-cover" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.previewUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  {s.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 size={20} className="animate-spin text-white" />
                    </div>
                  )}
                  {!s.uploading && !s.uploadedUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-900/70 text-white text-xs font-bold">
                      Failed
                    </div>
                  )}
                  <button
                    onClick={() => removeSlot(s.id)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center"
                    aria-label="Remove"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {banner && (
            <div
              className="p-2.5 rounded-lg flex items-start gap-2 text-xs"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#ef4444",
              }}
            >
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{banner}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between p-3 gap-3"
          style={{
            borderTop: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-surface)",
          }}
        >
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={onPickFiles}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={slots.length >= MAX_MEDIA || busy}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] disabled:opacity-40"
              aria-label="Attach image"
            >
              <ImageIcon size={18} />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={slots.length >= MAX_MEDIA || busy}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] disabled:opacity-40"
              aria-label="Attach video"
            >
              <Video size={18} />
            </button>
            <span className="text-[11px] text-muted-foreground ml-1">
              {slots.length}/{MAX_MEDIA}
            </span>
          </div>
          <button
            onClick={onPost}
            disabled={busy}
            className="px-5 py-2 rounded-full text-sm font-bold text-white flex items-center gap-2 disabled:opacity-60"
            style={{ background: "var(--color-accent)" }}
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Posting…
              </>
            ) : (
              "Post"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

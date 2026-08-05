"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";

import { useReportPost } from "@/lib/hooks/useCommunity";
import type { CommunityPost, ReportReason } from "@/types";

const REASONS: Array<{ value: ReportReason; label: string; hint: string }> = [
  { value: "spam", label: "Spam", hint: "Repeated or promotional content" },
  { value: "harassment", label: "Harassment", hint: "Bullying or targeted abuse" },
  { value: "inappropriate", label: "Inappropriate", hint: "Nudity, violence, or hate" },
  { value: "misinformation", label: "Misinformation", hint: "False or misleading claims" },
  { value: "other", label: "Other", hint: "Something else" },
];

export function ReportSheet({
  post,
  open,
  onClose,
}: {
  post: CommunityPost | null;
  open: boolean;
  onClose: () => void;
}) {
  const report = useReportPost();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { alreadyReported: boolean }>(null);

  useEffect(() => {
    if (!open) {
      setReason(null);
      setDetail("");
      setDone(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function onSubmit() {
    if (!reason || !post) return;
    setBusy(true);
    try {
      const res = await report.mutateAsync({
        postId: post.id,
        reason,
        detail: detail.trim() || undefined,
      });
      setDone({ alreadyReported: res.data?.alreadyReported ?? false });
    } catch {
      /* keep sheet open so the user can retry */
    } finally {
      setBusy(false);
    }
  }

  if (!open || !post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-medium)",
        }}
      >
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <h3 className="text-base font-bold text-foreground">Report post</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--color-surface-overlay)]"
            aria-label="Close"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center space-y-3">
            <div
              className="mx-auto w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(39,174,96,0.10)",
                border: "1px solid rgba(39,174,96,0.35)",
              }}
            >
              <CheckCircle2 size={26} style={{ color: "#27AE60" }} />
            </div>
            <div className="text-base font-bold text-foreground">
              {done.alreadyReported ? "Already reported" : "Thanks — we'll review this"}
            </div>
            <div className="text-sm text-muted-foreground">
              Our moderators will take it from here.
            </div>
            <button
              onClick={onClose}
              className="mt-3 px-5 py-2 rounded-full text-sm font-bold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="space-y-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className="w-full text-left p-3 rounded-xl transition-colors"
                  style={{
                    background:
                      reason === r.value
                        ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                        : "var(--color-bg-surface)",
                    border: `1px solid ${
                      reason === r.value ? "var(--color-accent)" : "var(--color-border-subtle)"
                    }`,
                  }}
                >
                  <div className="text-sm font-bold text-foreground">{r.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r.hint}</div>
                </button>
              ))}
            </div>

            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value.slice(0, 500))}
              placeholder="Add context (optional, max 500 chars)"
              rows={3}
              className="w-full px-3 py-2 rounded-xl text-sm text-foreground outline-none resize-y"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
              }}
            />

            <button
              onClick={onSubmit}
              disabled={!reason || busy}
              className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "var(--color-accent)" }}
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Submitting…
                </>
              ) : (
                "Submit report"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

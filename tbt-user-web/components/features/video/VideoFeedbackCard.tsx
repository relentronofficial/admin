"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Send, Loader2 } from "lucide-react";
import { useMyEpisodeFeedback, useSubmitEpisodeFeedback } from "@/lib/hooks/useCourseReports";

interface Props {
  courseId: string;
  episodeId: string;
}

/** Free-text "what did you think of this video" feedback that goes to the
 * admin (WhatsApp + in-app), distinct from the private Reflection note and
 * the rating/yes-no FeedbackModal survey. One submission per video —
 * resubmitting updates it (mirrors the weekly-feedback precedent). */
export function VideoFeedbackCard({ courseId, episodeId }: Props) {
  const { data: existing } = useMyEpisodeFeedback(episodeId);
  const submit = useSubmitEpisodeFeedback();
  const [text, setText] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Reset per-episode local state when the lesson changes, and prefill with
  // any previously-submitted feedback for this video.
  useEffect(() => {
    setText(existing?.feedback ?? "");
    setJustSubmitted(false);
    setError("");
  }, [episodeId, existing?.feedback]);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError("");
    setJustSubmitted(false);
    try {
      await submit.mutateAsync({ courseId, episodeId, feedback: trimmed });
      setJustSubmitted(true);
    } catch {
      setError("Unable to submit feedback. Please try again.");
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-border-card)" }}
    >
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: "var(--color-bg-surface)" }}>
        <MessageSquareText size={14} style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-normal)" }}>
          {existing ? "Your Feedback On This Video" : "Share Feedback On This Video"}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(""); }}
          placeholder="What did you think of this video?"
          rows={3}
          className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none text-foreground placeholder-muted-foreground"
          style={{ background: "var(--color-surface-overlay)", border: "1px solid var(--color-border-subtle)" }}
        />
        {error && (
          <p className="text-xs" style={{ color: "var(--color-alert)" }}>{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || submit.isPending}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-colors"
          style={{ background: "var(--color-accent)" }}
        >
          {submit.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {submit.isPending ? "Submitting…" : existing ? "Update Feedback" : "Submit Feedback"}
        </button>
        {justSubmitted && !submit.isPending && (
          <p className="text-xs text-center" style={{ color: "var(--color-success)" }}>
            Your feedback was submitted successfully.
          </p>
        )}
      </div>
    </div>
  );
}

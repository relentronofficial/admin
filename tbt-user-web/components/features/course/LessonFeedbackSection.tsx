"use client";

import { useState, useEffect, useRef } from "react";
import { Star, ThumbsUp, Loader2 } from "lucide-react";
import { useSaveLessonFeedback } from "@/lib/hooks/useCourses";

export interface LessonFeedbackExisting {
  rating: number;
  feedbackText: string | null;
  liked: boolean | null;
}

// Lesson Feedback Section — inline (not a modal), rendered below the video
// once the lesson is completed. One 1-10 star rating + like + optional text
// per lesson, upserted so re-submitting updates the same row instead of
// creating a duplicate. Distinct from the admin-authored per-question
// FeedbackModal (video-feedback module) and from ReflectionModal (free-text
// only, no rating).
export function LessonFeedbackSection({ lessonId, courseId, existing }: {
  lessonId: string;
  courseId: string;
  existing: LessonFeedbackExisting | undefined;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState(existing?.feedbackText ?? "");
  const [liked, setLiked] = useState(existing?.liked ?? false);
  const [justSaved, setJustSaved] = useState(false);
  const saveFeedback = useSaveLessonFeedback(courseId);
  // Guards the prefill effect below from clobbering input the member has
  // already started once their previously-saved feedback loads.
  const userEditedRef = useRef(false);

  // This component is remounted per lesson (keyed by lessonId at the call
  // site), but `existing` comes from a separate query than the course/lesson
  // fetch and can resolve after this component's first render. Re-apply it
  // the first time real data shows up so a cold page load / refresh doesn't
  // show an empty form for a lesson the member already rated.
  useEffect(() => {
    if (existing && !userEditedRef.current) {
      setRating(existing.rating);
      setText(existing.feedbackText ?? "");
      setLiked(existing.liked ?? false);
    }
  }, [existing]);

  const displayRating = hoverRating || rating;

  const handleSubmit = () => {
    if (!rating) return;
    saveFeedback.mutate(
      { lessonId, rating, feedbackText: text.trim() || undefined, liked },
      { onSuccess: () => setJustSaved(true) }
    );
  };

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-card)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Star size={13} style={{ color: "var(--color-accent)" }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>
            Rate this lesson
          </p>
        </div>
        <button
          type="button"
          onClick={() => { userEditedRef.current = true; setLiked((l) => !l); setJustSaved(false); }}
          aria-pressed={liked}
          aria-label={liked ? "Unlike this lesson" : "Like this lesson"}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
          style={liked
            ? { background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)" }
            : { border: "1px solid var(--color-border-strong)", color: "var(--color-text-subtle)" }}
        >
          <ThumbsUp size={13} fill={liked ? "var(--color-accent)" : "none"} /> {liked ? "Liked" : "Like"}
        </button>
      </div>

      <div className="flex items-center gap-1 flex-wrap" onMouseLeave={() => setHoverRating(0)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => { userEditedRef.current = true; setRating(i); setJustSaved(false); }}
            onMouseEnter={() => setHoverRating(i)}
            aria-label={`Rate ${i} out of 10`}
            className="transition-transform hover:scale-110"
          >
            <Star size={22} fill={i <= displayRating ? "#facc15" : "none"} color={i <= displayRating ? "#facc15" : "#666"} />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm font-semibold" style={{ color: "var(--color-text-normal)" }}>
            {rating}/10
          </span>
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => { userEditedRef.current = true; setText(e.target.value); setJustSaved(false); }}
        placeholder="Share your feedback about this video..."
        rows={3}
        className="w-full rounded-xl p-3 text-sm text-foreground resize-none outline-none placeholder:opacity-40"
        style={{ background: "var(--color-surface-overlay)", border: "1px solid var(--color-border-medium)" }}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={!rating || saveFeedback.isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--color-accent)" }}
        >
          {saveFeedback.isPending ? <Loader2 size={13} className="animate-spin" /> : existing ? "Update Feedback" : "Submit Feedback"}
        </button>
        {justSaved && (
          <span className="text-xs font-semibold" style={{ color: "var(--color-success)" }}>✓ Feedback saved</span>
        )}
      </div>
    </div>
  );
}

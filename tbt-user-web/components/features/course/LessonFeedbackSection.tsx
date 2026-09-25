"use client";

import { useState, useEffect, useRef } from "react";
import { Star, Heart, Loader2 } from "lucide-react";
import { useSaveLessonFeedback } from "@/lib/hooks/useCourses";
import { useSubmitEpisodeFeedback } from "@/lib/hooks/useCourseReports";

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
  // null = neither, true = liked, false = disliked
  const [liked, setLiked] = useState<boolean | null>(existing?.liked ?? null);
  const [justSaved, setJustSaved] = useState(false);
  const saveFeedback = useSaveLessonFeedback(courseId);
  // Also feeds Admin -> Courses -> Feedback (CourseEpisodeFeedback), so this one
  // on-screen section reaches the admin panel. Best-effort: a failure here must
  // never block the lesson_feedback save, which drives this section's state.
  const submitEpisodeFeedback = useSubmitEpisodeFeedback();
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
      setLiked(existing.liked ?? null);
    }
  }, [existing]);

  const displayRating = hoverRating || rating;

  const handleSubmit = () => {
    if (!rating) return;
    const trimmedText = text.trim() || undefined;
    saveFeedback.mutate(
      { lessonId, rating, feedbackText: trimmedText, liked: liked ?? undefined },
      { onSuccess: () => setJustSaved(true) }
    );
    submitEpisodeFeedback.mutate({
      courseId,
      episodeId: lessonId,
      rating,
      liked: liked ?? undefined,
      feedback: trimmedText,
    });
  };

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-card)" }}
    >
      <div className="flex items-center gap-2">
        <Star size={13} style={{ color: "var(--color-accent)" }} />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>
          Rate this lesson
        </p>
      </div>

      {/* Like / Dislike */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => { userEditedRef.current = true; setLiked(liked === true ? null : true); setJustSaved(false); }}
          aria-pressed={liked === true}
          aria-label="Like this lesson"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${liked === true ? "border-green-500 text-green-400 bg-green-500/10" : "border-transparent text-[var(--color-text-subtle)] bg-[var(--color-surface-overlay)] hover:border-green-500/50"}`}
        >
          <Heart size={13} fill={liked === true ? "currentColor" : "none"} />
          Like
        </button>
        <button
          type="button"
          onClick={() => { userEditedRef.current = true; setLiked(liked === false ? null : false); setJustSaved(false); }}
          aria-pressed={liked === false}
          aria-label="Dislike this lesson"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${liked === false ? "border-red-500 text-red-400 bg-red-500/10" : "border-transparent text-[var(--color-text-subtle)] bg-[var(--color-surface-overlay)] hover:border-red-500/50"}`}
        >
          <Heart size={13} fill={liked === false ? "currentColor" : "none"} className={liked === false ? "rotate-180" : ""} />
          Dislike
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

"use client";

import { useState } from "react";
import { X, Star, ThumbsUp, ThumbsDown, Send, Loader2 } from "lucide-react";
import type { FeedbackQuestion, FeedbackResponse } from "@/lib/hooks/useVideoFeedback";
import { useSubmitVideoFeedback } from "@/lib/hooks/useVideoFeedback";

interface Props {
  episodeId: string;
  episodeType?: string;
  questions: FeedbackQuestion[];
  onClose: () => void;
}

export function FeedbackModal({ episodeId, episodeType = "course", questions, onClose }: Props) {
  const submit = useSubmitVideoFeedback();
  const [answers, setAnswers] = useState<Record<string, FeedbackResponse>>({});
  const [submitted, setSubmitted] = useState(false);

  const setRating = (questionId: string, ratingValue: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, ratingValue } }));
  };

  const setYesNo = (questionId: string, yesNoValue: boolean) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, yesNoValue } }));
  };

  const handleSubmit = async () => {
    const responses = Object.values(answers);
    if (responses.length === 0) { onClose(); return; }
    await submit.mutateAsync({ episodeId, episodeType, responses });
    setSubmitted(true);
    setTimeout(onClose, 1200);
  };

  const allAnswered = questions.every(q => answers[q.id] !== undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-sm rounded-2xl border overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
        style={{ background: "var(--color-modal-bg, #1a1a1a)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--color-success, #16a34a)" }}>
              <ThumbsUp size={20} className="text-white" />
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-normal)" }}>
              Thanks for your feedback!
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <p className="text-sm font-bold" style={{ color: "var(--color-text-normal)" }}>
                Quick feedback
              </p>
              <button onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100 transition-opacity" style={{ color: "var(--color-text-secondary)" }}>
                <X size={16} />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-5">
              {questions.map(q => (
                <div key={q.id}>
                  <p className="text-xs mb-3" style={{ color: "var(--color-text-secondary)" }}>
                    {q.questionText}
                  </p>
                  {q.questionType === "rating" ? (
                    <div className="flex gap-1 flex-wrap">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                        const selected = answers[q.id]?.ratingValue === n;
                        return (
                          <button
                            key={n}
                            onClick={() => setRating(q.id, n)}
                            className="w-8 h-8 rounded-lg text-xs font-bold transition-all"
                            style={{
                              background: selected ? "var(--color-accent)" : "rgba(255,255,255,0.06)",
                              color: selected ? "#fff" : "var(--color-text-secondary)",
                              border: selected ? "none" : "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {[
                        { label: "Yes", value: true, icon: ThumbsUp },
                        { label: "No", value: false, icon: ThumbsDown },
                      ].map(({ label, value, icon: Icon }) => {
                        const selected = answers[q.id]?.yesNoValue === value;
                        return (
                          <button
                            key={label}
                            onClick={() => setYesNo(q.id, value)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                            style={{
                              background: selected ? "var(--color-accent)" : "rgba(255,255,255,0.06)",
                              color: selected ? "#fff" : "var(--color-text-secondary)",
                              border: selected ? "none" : "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            <Icon size={14} />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={handleSubmit}
                disabled={submit.isPending}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: allAnswered ? "var(--color-accent)" : "rgba(255,255,255,0.1)" }}
              >
                {submit.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {allAnswered ? "Submit" : "Skip"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

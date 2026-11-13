"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";

// Lesson-level error screen. Without it a crash here fell through to the
// root boundary, which logs nothing in production and offers only "Go home".
// "Try again" refetches this course's data before re-rendering, keeping the
// same URL (course + ?lesson=); after repeated failures it offers a full
// reload instead of looping.
const MAX_RETRIES = 2;

export default function LearningError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { courseId } = useParams<{ courseId: string }>();
  const queryClient = useQueryClient();
  const [attempts, setAttempts] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const logged = useRef<Error | null>(null);

  useEffect(() => {
    if (logged.current === error) return;
    logged.current = error;
    // Message, stack and digest only — no lesson content or user data.
    console.error("[LearningError]", { courseId, message: error?.message, digest: error?.digest, stack: error?.stack });
  }, [error, courseId]);

  const retry = async () => {
    setRetrying(true);
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["courses", courseId] }),
        queryClient.invalidateQueries({ queryKey: ["user", "progress", courseId] }),
      ]);
    } finally {
      setAttempts((n) => n + 1);
      setRetrying(false);
      reset();
    }
  };

  const exhausted = attempts >= MAX_RETRIES;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--color-text-normal)" }}>
            This lesson couldn&apos;t load
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {exhausted
              ? "It still isn't loading. Reload the page to get the latest version, or go back to your courses."
              : "Something went wrong while showing this lesson. Your progress is safe."}
          </p>
          {error?.digest && (
            <p className="text-xs mt-2 font-mono" style={{ color: "var(--color-text-subtle)" }}>
              Ref: {error.digest}
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          {exhausted ? (
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--color-accent)" }}
            >
              Reload page
            </button>
          ) : (
            <button
              onClick={retry}
              disabled={retrying}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--color-accent)" }}
            >
              {retrying ? "Retrying…" : "Try again"}
            </button>
          )}
          <Link
            href="/learning"
            className="px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-secondary)" }}
          >
            My courses
          </Link>
        </div>
      </div>
    </div>
  );
}

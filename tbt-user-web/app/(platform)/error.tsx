"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-[60vh]">
      <div className="max-w-md w-full text-center space-y-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)" }}
        >
          <span className="text-2xl">⚠️</span>
        </div>

        <div>
          <h1 className="text-xl font-bold mb-2" style={{ color: "var(--color-text-normal)" }}>
            Something went wrong
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            An unexpected error occurred on this page. Try again or return to the dashboard.
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-accent)" }}
          >
            Try again
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-subtle, #2a2a2a)" }}
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

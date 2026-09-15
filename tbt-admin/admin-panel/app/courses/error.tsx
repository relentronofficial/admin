"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function CoursesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CoursesPage error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
      <AlertCircle size={40} className="text-red-500" />
      <div className="text-center space-y-2">
        <p className="text-[#f0f0f0] font-rajdhani font-bold text-lg uppercase tracking-widest">
          Something went wrong
        </p>
        <p className="text-[#888] text-sm max-w-md">
          {error?.message || "An unexpected error occurred loading the courses page."}
        </p>
        {error?.digest && (
          <p className="text-[#555] text-[11px] font-mono">Digest: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 bg-[#dc2626] hover:bg-red-700 text-white font-rajdhani font-bold text-[11px] uppercase tracking-widest rounded transition-colors"
        >
          <RotateCcw size={13} /> Try Again
        </button>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#444] text-[#a0a0a0] hover:text-white font-rajdhani font-bold text-[11px] uppercase tracking-widest rounded transition-colors"
        >
          <LayoutDashboard size={13} /> Dashboard
        </Link>
      </div>
    </div>
  );
}

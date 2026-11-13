"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ResultView } from "@/components/features/psychometric/ResultView";
import { usePsychometricResult } from "@/lib/hooks/usePsychometric";

export default function PsychometricResultPage() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = usePsychometricResult();

  // No result yet → the member hasn't completed it; send them to the start page.
  useEffect(() => { if (data === null) router.replace("/psychometric"); }, [data, router]);

  if (isLoading || data === null) {
    return (
      <div className="py-20 text-center" role="status">
        <Loader2 className="mx-auto mb-4 animate-spin" size={32} style={{ color: "var(--color-accent)" }} />
        <p style={{ color: "var(--color-text-subtle)" }}>Loading results…</p>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4" style={{ color: "var(--color-accent)" }}>{(error as Error)?.message || "Couldn't load your results. Please check your connection."}</p>
        <button onClick={() => refetch()} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "var(--color-accent)" }}>Retry</button>
      </div>
    );
  }
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <ResultView data={data} />
    </div>
  );
}

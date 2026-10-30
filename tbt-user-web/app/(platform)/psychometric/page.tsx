"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useMe } from "@/lib/hooks/useUser";
import { usePsychometricResult, usePsychometricSettings } from "@/lib/hooks/usePsychometric";

// Psychometric assessment — start page (the former standalone "instructions"
// screen). Members take it with their TBT login: no access code, no second
// account. Completed members are sent to their result instead.
export default function PsychometricStartPage() {
  const { data: me } = useMe();
  const { data: settings } = usePsychometricSettings();
  const { data: result, isLoading } = usePsychometricResult();
  const minutes = settings?.assessment_duration_minutes ?? 30;
  const retestApproved = result?.retest?.status === "approved";

  const card = { background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" } as const;
  const button = "inline-flex justify-center px-6 py-3 rounded-xl text-sm font-bold text-white";

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="rounded-2xl border p-8 text-center" style={card}>
        <div className="text-5xl mb-4" aria-hidden>🎯</div>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: "var(--color-text-primary)" }}>Ready to Discover Your Potential?</h1>
        <p className="mb-6" style={{ color: "var(--color-text-subtle)" }}>
          {me?.firstName ? `Welcome, ${me.firstName}! ` : "Welcome! "}Take a moment to understand your strengths.
        </p>

        {isLoading ? (
          <Loader2 className="mx-auto animate-spin" size={24} style={{ color: "var(--color-accent)" }} />
        ) : result && !retestApproved ? (
          <>
            <p className="text-sm mb-5" style={{ color: "var(--color-text-normal)" }}>You have completed the assessment.</p>
            <Link href="/psychometric/result" className={button} style={{ background: "var(--color-accent)" }}>View Your Results</Link>
          </>
        ) : (
          <>
            <div className="text-left rounded-xl p-4 mb-6 space-y-2 text-sm" style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-normal)" }}>
              <p className="font-semibold" style={{ color: "var(--color-text-primary)" }}>Before you begin:</p>
              <p>✅ A short set of questions across several psychometric categories</p>
              <p>⏱️ {minutes}-minute time limit — complete in one sitting</p>
              <p>🔒 {retestApproved ? "Your retest is approved — this is one more attempt" : "One attempt only — answers cannot be changed after submission"}</p>
              <p>💡 Answer honestly — there are no right or wrong answers</p>
            </div>
            <Link href="/psychometric/assessment" className={`${button} w-full`} style={{ background: "var(--color-accent)" }}>
              {retestApproved ? "Start Retest" : "Start Assessment"}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import { usePsychometricResult, usePsychometricSettings } from "@/lib/hooks/usePsychometric";

// The member's entry point to the full (timed) Psychometric assessment from
// their Profile: start it, or see the latest score and open the result.
// Distinct from the profile's short "Business Psychometric Assessment" quiz.
export function ProfileAssessmentCard() {
  const { data: settings } = usePsychometricSettings();
  const { data: result, isLoading } = usePsychometricResult();
  const minutes = settings?.assessment_duration_minutes ?? 30;
  const latest = result?.data;
  const retestApproved = result?.retest?.status === "approved";
  const link = "inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold text-white";

  return (
    <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
      <div className="flex items-center gap-2">
        <Target size={15} style={{ color: "var(--color-accent)" }} />
        <h3 className="text-sm font-bold text-foreground">Full Psychometric Assessment</h3>
      </div>
      {isLoading ? (
        <div className="h-10 rounded-lg animate-pulse" style={{ background: "var(--color-surface-overlay-md, rgba(255,255,255,0.07))" }} />
      ) : latest ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-bold text-foreground leading-none">{latest.percentage}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {latest.level} · Attempt {latest.attemptNumber} · {new Date(latest.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            {retestApproved && (
              <Link href="/psychometric" className={link} style={{ background: "var(--color-accent)" }}>Start retest</Link>
            )}
            <Link
              href="/psychometric/result"
              className="inline-flex items-center px-4 py-2 rounded-lg border text-xs font-semibold"
              style={{ borderColor: "var(--color-surface-overlay, rgba(255,255,255,0.1))", color: "var(--color-text-secondary, #a0a0a0)" }}
            >
              View results
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            A {minutes}-minute assessment of your entrepreneurial strengths, with business recommendations.
          </p>
          <Link href="/psychometric" className={`${link} shrink-0`} style={{ background: "var(--color-accent)" }}>Take the assessment</Link>
        </div>
      )}
    </div>
  );
}

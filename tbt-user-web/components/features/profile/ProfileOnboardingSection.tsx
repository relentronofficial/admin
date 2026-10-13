"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ClipboardCheck, FileText, Video, AlertCircle, Lock, RefreshCw } from "lucide-react";
import { useOnboardingState, useOnboardingContent } from "@/lib/hooks/useOnboarding";
import { PlyrPlayer } from "@/components/features/video/PlyrPlayer";
import { useMyOnboardingMeetings } from "@/lib/hooks/useOnboardingMeetings";
import type { OnboardingState } from "@/lib/api/services/onboarding.service";
import { cn } from "@/lib/utils/cn";

// Read-only view of the member's own onboarding application. Source of truth
// is the same data the Admin → Onboarding review drawer shows; both APIs used
// here are member-scoped on the server (req.memberId from the session), so a
// member can only ever see their own record. No admin controls are exposed.

type VStatus = OnboardingState["verificationStatus"];

// Same labels as Admin → Onboarding.
const STATUS_META: Record<VStatus, { label: string; color: string }> = {
  awaiting_kyc: { label: "Not Submitted", color: "var(--color-text-secondary)" },
  under_review: { label: "Pending Review", color: "#eab308" },
  changes_requested: { label: "Changes Required", color: "#f97316" },
  verified: { label: "Approved", color: "var(--color-success)" },
  rejected: { label: "Rejected", color: "var(--color-alert)" },
};

// Same fields, order and labels as Admin → Onboarding "Submitted Profile".
const PROFILE_DISPLAY_FIELDS: { key: string; label: string }[] = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "businessName", label: "Business Name" },
  { key: "productServiceType", label: "Business Type" },
  { key: "businessStartedFrom", label: "Business Started From" },
  { key: "teamSize", label: "Total Team Members" },
  { key: "preferredSessionMode", label: "Preferred Session Mode" },
  { key: "instagramLink", label: "Instagram Link" },
  { key: "instagramStats", label: "Instagram Posts & Followers" },
  { key: "facebookStats", label: "Facebook Posts & Followers" },
  { key: "websiteUrl", label: "Website Link" },
  { key: "annualTurnover", label: "Revenue Until Now" },
  { key: "revenueGoalAfterTbt", label: "Revenue Goal After TBT" },
  { key: "goalAfter90Days", label: "Learning Goals" },
  { key: "gstNumber", label: "GST Number" },
];

const MEETING_STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  live: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Mirrors backend canEditOnboarding (lib/onboardingLogic.ts).
const canEdit = (s: VStatus) => s === "awaiting_kyc" || s === "changes_requested";

const isAccessError = (err: unknown) =>
  err instanceof Error && /unauthori[sz]ed|forbidden|session/i.test(err.message);

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.map(String).join(", ") : "—";
  if (typeof v === "object") {
    const parts = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== null && x !== undefined && x !== "")
      .map(([k, x]) => `${k}: ${String(x)}`);
    return parts.length ? parts.join(" · ") : "—";
  }
  return String(v);
};

const humanize = (s: string) => s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const daysAgo = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
};

function StatusBadge({ status }: { status: VStatus }) {
  const meta = STATUS_META[status] ?? { label: humanize(String(status)), color: "var(--color-text-secondary)" };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${meta.color} 35%, transparent)` }}
    >
      {meta.label}
    </span>
  );
}

function SubHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span style={{ color: "var(--color-accent)" }}>{icon}</span>
      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">{children}</h4>
    </div>
  );
}

// Same playback rule as the onboarding wizard (/onboarding): Admin uploads save a
// Bunny embed URL (iframe player); HLS streams use the shared PlyrPlayer (hls.js);
// direct files use a native <video>.
function OnboardingVideoPlayer({ url, title }: { url: string; title: string }) {
  const path = url.split("?")[0].toLowerCase();
  return (
    <div className="rounded-2xl overflow-hidden bg-black aspect-video w-full">
      {path.endsWith(".m3u8") ? (
        <PlyrPlayer hlsUrl={url} className="w-full h-full" />
      ) : /\.(mp4|webm|ogg|mov)$/.test(path) ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={url} controls playsInline preload="metadata" className="w-full h-full" />
      ) : (
        <iframe src={url} title={title} className="w-full h-full" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
      )}
    </div>
  );
}

// Videos uploaded in Admin → Onboarding (active content steps, member-scoped
// GET /api/onboarding/content). Renders nothing when no step has a video.
function OnboardingVideos() {
  const { data, refetch } = useOnboardingContent();
  useEffect(() => { void refetch(); }, [refetch]);
  const steps = (data ?? []).filter((s) => !!s.videoUrl);
  if (steps.length === 0) return null;
  return (
    <div>
      <SubHeading icon={<Video size={13} />}>Onboarding Video{steps.length > 1 ? "s" : ""}</SubHeading>
      <div className="space-y-4">
        {steps.map((s) => (
          <div key={s.id} className="space-y-1.5">
            {s.title && <p className="text-sm font-semibold text-foreground">{s.title}</p>}
            <OnboardingVideoPlayer url={s.videoUrl as string} title={s.title || "Onboarding video"} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MeetingsList() {
  const { data, isLoading, isError, refetch } = useMyOnboardingMeetings();
  // Mounted only when the panel opens; refetch so admin scheduling changes show
  // (app-wide defaults disable refetch-on-mount/focus with a 5-minute staleTime).
  useEffect(() => { void refetch(); }, [refetch]);
  const meetings = data ?? [];
  if (isLoading) return <div className="h-10 rounded-xl animate-pulse" style={{ background: "var(--color-surface-overlay)" }} />;
  if (isError) return <p className="text-xs text-muted-foreground">Couldn&apos;t load meetings.</p>;
  if (meetings.length === 0) return <p className="text-xs text-muted-foreground">No meetings yet</p>;
  return (
    <ul className="space-y-2">
      {meetings.map((m) => {
        const joinable = m.status === "scheduled" || m.status === "live";
        return (
          <li key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: "var(--color-surface-overlay-xs)" }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{m.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(m.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                {MEETING_STATUS_LABEL[m.status] ?? humanize(m.status)}
              </p>
            </div>
            {joinable && (
              <Link
                href={`/onboarding/meeting/${m.id}`}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                style={{ background: "var(--color-accent)" }}
              >
                Join
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ProfileOnboardingSection() {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, error, refetch, isFetching } = useOnboardingState();
  const status = data?.verificationStatus;
  const notStarted = status === "awaiting_kyc" && !data?.onboardingSubmittedAt;

  // Opening the panel re-reads the member's record so Admin decisions (approve,
  // request changes, review note) show immediately despite the app-wide cache.
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void refetch();
  };

  return (
    <div className="p-6 rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="profile-onboarding-panel"
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardCheck size={15} style={{ color: "var(--color-accent)" }} />
          <h3 className="text-sm font-bold text-foreground">Onboarding</h3>
          {status && <StatusBadge status={status} />}
        </div>
        <ChevronDown size={16} className={cn("text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div id="profile-onboarding-panel" className="mt-4 space-y-5">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: "var(--color-surface-overlay)" }} />
              ))}
            </div>
          ) : isError ? (
            isAccessError(error) ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock size={14} /> You don&apos;t have access to this information.
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle size={14} style={{ color: "var(--color-alert)" }} /> Couldn&apos;t load your onboarding details.
                </div>
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="flex items-center gap-1 text-xs font-bold disabled:opacity-50"
                  style={{ color: "var(--color-accent)" }}
                >
                  <RefreshCw size={12} className={cn(isFetching && "animate-spin")} /> Retry
                </button>
              </div>
            )
          ) : !data ? null : notStarted ? (
            <div className="space-y-5">
            <OnboardingVideos />
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">You haven&apos;t submitted your onboarding details yet.</p>
              <Link
                href="/onboarding"
                className="inline-block px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: "var(--color-accent)" }}
              >
                Start onboarding
              </Link>
            </div>
            </div>
          ) : (
            <>
              {/* Status */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status:</span>
                {status && <StatusBadge status={status} />}
                {data.onboardingSubmittedAt && (
                  <span className="text-xs text-muted-foreground">Submitted {daysAgo(data.onboardingSubmittedAt)}</span>
                )}
              </div>

              {/* Member-facing note from the review (not the admin-internal notes) */}
              {data.onboardingReviewNote && (
                <div className="p-3 rounded-xl text-sm" style={{ background: "var(--color-surface-overlay-xs)", border: "1px solid var(--color-border-subtle)" }}>
                  <p className="text-xs font-bold text-muted-foreground mb-1">Message from the TBT team</p>
                  <p className="text-foreground whitespace-pre-line">{data.onboardingReviewNote}</p>
                </div>
              )}

              {/* Admin-uploaded onboarding video(s) */}
              <OnboardingVideos />

              {/* Submitted Profile */}
              <div>
                <SubHeading icon={<ClipboardCheck size={13} />}>Submitted Profile</SubHeading>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  {PROFILE_DISPLAY_FIELDS.map(({ key, label }) => (
                    <div key={key} className="min-w-0">
                      <dt className="text-[11px] text-muted-foreground">{label}</dt>
                      <dd className="text-sm text-foreground break-words">{formatValue(data.profile?.[key])}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Documents */}
              <div>
                <SubHeading icon={<FileText size={13} />}>Documents</SubHeading>
                {data.documents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No documents submitted</p>
                ) : (
                  <ul className="space-y-2">
                    {data.documents.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-xl" style={{ background: "var(--color-surface-overlay-xs)" }}>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{humanize(d.documentType)}</p>
                          <p className="text-xs text-muted-foreground">{humanize(d.status)}</p>
                        </div>
                        {d.documentUrl && (
                          <a href={d.documentUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-bold" style={{ color: "var(--color-accent)" }}>
                            View
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Verification meetings */}
              <div>
                <SubHeading icon={<Video size={13} />}>Verification Meeting</SubHeading>
                <MeetingsList />
              </div>

              {/* Continue / update — only when the existing rules allow editing */}
              {status && canEdit(status) && (
                <Link
                  href="/onboarding"
                  className="block w-full text-center py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: "var(--color-accent)" }}
                >
                  {status === "changes_requested" ? "Update details" : "Continue onboarding"}
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

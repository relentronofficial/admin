"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Video, Calendar, Camera, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useOnboardingState,
  useOnboardingContent,
  useSaveOnboardingProgress,
  usePresignOnboardingDocument,
  useRegisterOnboardingDocument,
  useDeleteOnboardingDocument,
  useSubmitOnboarding,
  usePresignProfilePhoto,
} from "@/lib/hooks/useOnboarding";
import { useMyOnboardingMeetings } from "@/lib/hooks/useOnboardingMeetings";
import type { OnboardingContentStep } from "@/lib/api/services/onboarding.service";

// Wizard chrome (labels/copy) is hardcoded here rather than sourced from
// uiStrings — the *educational content* (step 2/5 text+audio+video) is the
// piece the product spec requires to be admin-manageable, and that already
// comes from the onboarding_content table (useOnboardingContent). See
// SELF_ONBOARDING_SPECKIT.md — this is a scope decision, not an oversight.

// ─── Types ──────────────────────────────────────────────────────────────────

// Dynamic steps: "welcome", "education:<stepKey>", "profile", "skills", "documents", "review"
// Step keys from the DB become "education:<stepKey>" segments.
type FixedStep = "welcome" | "profile" | "skills" | "documents" | "review";
type DynamicStep = `education:${string}`;
type Step = FixedStep | DynamicStep;

const REQUIRED_FIELDS = ["firstName", "businessName", "businessType", "city", "state"] as const;

const DOCUMENT_TYPES = [
  { value: "business_proof", label: "Business Proof" },
  { value: "gst_certificate", label: "GST Certificate" },
  { value: "id_proof", label: "ID Proof" },
  { value: "other", label: "Other" },
];

const MARKETING_CHANNELS = ["SEO", "Paid Ads", "Social Media", "Email", "Referral", "Offline"];

const ANNUAL_TURNOVER_OPTIONS = [
  "Under 10L",
  "10L - 25L",
  "25L - 50L",
  "50L - 1Cr",
  "1Cr - 5Cr",
  "5Cr+",
];

function buildStepOrder(contentSteps: OnboardingContentStep[]): Step[] {
  const educationSteps: DynamicStep[] = contentSteps.map((c) => `education:${c.stepKey}` as DynamicStep);
  return ["welcome", ...educationSteps, "profile", "skills", "documents", "review"];
}

const SKILL_FIELDS = [
  { key: "skillBusinessFoundation", label: "Business Foundation" },
  { key: "skillContent", label: "Content" },
  { key: "skillFunnels", label: "Funnels" },
  { key: "skillAds", label: "Ads" },
  { key: "skillSales", label: "Sales" },
  { key: "skillOverallMarketing", label: "Overall Marketing" },
] as const;

function SkillSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: "var(--color-accent)" }}>{value}<span className="text-muted-foreground font-normal">/10</span></span>
      </div>
      <input
        type="range" min={1} max={10} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: "var(--color-accent)" }}
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>Beginner</span><span>Expert</span>
      </div>
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function ProgressBar({ step, stepOrder }: { step: Step; stepOrder: Step[] }) {
  const index = stepOrder.indexOf(step);
  const total = stepOrder.length;
  const pct = Math.round(((index + 1) / total) * 100);
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-muted-foreground mb-2">
        <span>Step {index + 1} of {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-surface-overlay)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--color-accent)" }} />
      </div>
    </div>
  );
}

function ContentBlock({ content }: { content: OnboardingContentStep }) {
  const isHls = content.videoUrl?.endsWith(".m3u8");
  return (
    <div className="space-y-4">
      {content.textBody && <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{content.textBody}</p>}
      {content.videoUrl && (
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          {isHls ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={content.videoUrl} controls className="w-full h-full" />
          ) : (
            <iframe src={content.videoUrl} className="w-full h-full" allow="autoplay; fullscreen" />
          )}
        </div>
      )}
      {content.audioUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio src={content.audioUrl} controls className="w-full" />
      )}
    </div>
  );
}

function ContentStepSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 rounded bg-[var(--color-surface-overlay)] w-3/4" />
      <div className="h-4 rounded bg-[var(--color-surface-overlay)] w-full" />
      <div className="h-4 rounded bg-[var(--color-surface-overlay)] w-5/6" />
      <div className="rounded-xl bg-[var(--color-surface-overlay)] aspect-video" />
    </div>
  );
}

function StepShell({ title, children, onBack, onNext, nextLabel, nextDisabled }: {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-4">{title}</h1>
      <div className="mb-8">{children}</div>
      <div className="flex justify-between">
        {onBack ? (
          <button onClick={onBack} className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Back
          </button>
        ) : <span />}
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--color-accent)" }}
        >
          {nextLabel ?? "Continue"}
        </button>
      </div>
    </div>
  );
}

// ─── Read-only states ───────────────────────────────────────────────────────

function VerificationMeetingCard() {
  const router = useRouter();
  const { data: meetings } = useMyOnboardingMeetings();
  const meeting = meetings?.find((m) => m.status === "scheduled" || m.status === "live");
  if (!meeting) return null;

  return (
    <div
      className="max-w-lg mx-auto mt-6 p-5 rounded-xl text-left"
      style={{ background: "color-mix(in srgb, var(--color-accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)" }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)" }}>
          <Video size={18} style={{ color: "var(--color-accent)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
            <Calendar size={12} /> {new Date(meeting.scheduledAt).toLocaleString()}
          </p>
          {meeting.status === "live" && (
            <p className="text-xs font-semibold mt-1" style={{ color: "var(--color-success, #22c55e)" }}>Live now</p>
          )}
        </div>
        <button
          onClick={() => router.push(`/onboarding/meeting/${meeting.id}`)}
          className="px-4 h-9 text-xs font-semibold rounded-lg text-white shrink-0"
          style={{ background: "var(--color-accent)" }}
        >
          {meeting.status === "live" ? "Join Now" : "View"}
        </button>
      </div>
    </div>
  );
}

function relativeDate(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function PendingReviewView({ submittedAt }: { submittedAt: string | null }) {
  const when = relativeDate(submittedAt);
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <h1 className="text-xl font-bold text-foreground mb-3">Application Submitted</h1>
      {when && (
        <p className="text-xs text-muted-foreground mb-2">Submitted {when}</p>
      )}
      <p className="text-sm text-muted-foreground leading-relaxed">
        Your onboarding has been submitted successfully and is waiting for admin approval.
        We&apos;ll notify you as soon as it&apos;s reviewed.
      </p>
      <VerificationMeetingCard />
    </div>
  );
}

function RejectedView({ note }: { note: string | null }) {
  const whatsappUrl = "https://wa.me/918778766710?text=Hi%2C%20my%20TBT%20application%20was%20not%20approved.%20Can%20you%20help%3F";
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <h1 className="text-xl font-bold text-foreground mb-3">Application Not Approved</h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
        {note || "Your application was not approved. Please contact support for details."}
      </p>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: "#25D366" }}
      >
        <MessageCircle size={16} />
        Contact Support on WhatsApp
      </a>
    </div>
  );
}

// ─── Wizard ─────────────────────────────────────────────────────────────────

function OnboardingWizard({ initialProfile, initialDocuments, changesNote }: {
  initialProfile: Record<string, any>;
  initialDocuments: { id: string; documentType: string; documentUrl: string; status: string }[];
  changesNote: string | null;
}) {
  const { data: contentSteps, isLoading: contentLoading } = useOnboardingContent();
  const saveProgress = useSaveOnboardingProgress();
  const presignDoc = usePresignOnboardingDocument();
  const registerDoc = useRegisterOnboardingDocument();
  const deleteDoc = useDeleteOnboardingDocument();
  const presignPhoto = usePresignProfilePhoto();
  const submit = useSubmitOnboarding();

  const stepOrder = useMemo(
    () => buildStepOrder(contentSteps ?? []),
    [contentSteps],
  );

  const [step, setStep] = useState<Step>("welcome");

  // Split currentChallenges array into individual challenge fields for the UI,
  // and ensure marketingChannels is always an array.
  const [profile, setProfile] = useState<Record<string, any>>(() => {
    const p = { ...initialProfile };
    if (Array.isArray(p.currentChallenges)) {
      p.challenge1 = p.currentChallenges[0] ?? "";
      p.challenge2 = p.currentChallenges[1] ?? "";
      p.challenge3 = p.currentChallenges[2] ?? "";
      delete p.currentChallenges;
    }
    if (!Array.isArray(p.marketingChannels)) {
      p.marketingChannels = [];
    }
    return p;
  });

  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0].value);
  const [uploading, setUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | undefined>(undefined);

  const missingFields = REQUIRED_FIELDS.filter((f) => !profile[f]);
  const readyToSubmit = missingFields.length === 0 && initialDocuments.length > 0;

  const currentIndex = stepOrder.indexOf(step);
  const prevStep = currentIndex > 0 ? stepOrder[currentIndex - 1] : undefined;
  const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : undefined;

  const toggleMarketingChannel = (channel: string) => {
    setProfile((p) => {
      const current = (p.marketingChannels as string[]) || [];
      return {
        ...p,
        marketingChannels: current.includes(channel)
          ? current.filter((c: string) => c !== channel)
          : [...current, channel],
      };
    });
  };

  const saveAndAdvance = async (next: Step) => {
    try {
      // Strip read-only fields (phone, email) and combine challenge fields into
      // currentChallenges array before sending — the backend schema uses .strict()
      // and won't accept extra fields. Strip null/undefined/empty-string values because
      // z.string().optional() does NOT accept null, and z.string().min(1) rejects "".
      const { phone: _p, email: _e, challenge1, challenge2, challenge3, ...editable } = profile as any;
      const currentChallenges = [challenge1, challenge2, challenge3].filter(Boolean);
      const body = Object.fromEntries(
        Object.entries({ ...editable, currentChallenges })
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
      );
      await saveProgress.mutateAsync(body);
      setStep(next);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Couldn't save your progress. Please try again.";
      // eslint-disable-next-line no-console
      console.error("[onboarding] saveAndAdvance error:", err);
      toast.error(msg);
    }
  };

  const handleDocUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data } = await presignDoc.mutateAsync({ filename: file.name, contentType: file.type, documentType });
      await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await registerDoc.mutateAsync({ documentType, documentUrl: data.publicUrl });
      toast.success("Document uploaded");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true);
    try {
      const { data } = await presignPhoto.mutateAsync({ filename: file.name, contentType: file.type });
      await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setProfile((p) => ({ ...p, profilePhotoUrl: data.publicUrl }));
      toast.success("Photo uploaded");
    } catch {
      toast.error("Photo upload failed. Please try again.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await submit.mutateAsync();
      toast.success("Onboarding submitted!");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Please complete all required fields first.");
    }
  };

  const inputCls = "w-full h-11 px-4 rounded-xl text-sm text-foreground outline-none";
  const inputStyle = { background: "var(--color-surface-overlay)", border: "1px solid var(--color-border-subtle)" };

  return (
    <div className="py-8 px-4">
      <ProgressBar step={step} stepOrder={stepOrder} />

      {changesNote && (
        <div className="max-w-2xl mx-auto mb-6 p-4 rounded-xl text-sm" style={{ background: "color-mix(in srgb, var(--color-alert) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--color-alert) 30%, transparent)" }}>
          <p className="font-semibold text-foreground mb-1">Admin requested some changes</p>
          <p className="text-muted-foreground">{changesNote}</p>
        </div>
      )}

      {/* ── Welcome ── */}
      {step === "welcome" && (
        <StepShell title="Welcome to TBT 👋" onNext={() => setStep(stepOrder[1] ?? "profile")}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Let&apos;s get your account set up. This should take about 5–10 minutes — you can save your
            progress and come back anytime before submitting.
          </p>
        </StepShell>
      )}

      {/* ── Dynamic education steps (one per onboarding_content row) ── */}
      {step.startsWith("education:") && (() => {
        const key = step.slice("education:".length);
        const content = contentSteps?.find((c) => c.stepKey === key);
        const title = content?.title || "Before you continue";
        return (
          <StepShell
            title={title}
            onBack={prevStep ? () => setStep(prevStep) : undefined}
            onNext={() => setStep(nextStep ?? "review")}
          >
            {contentLoading ? (
              <ContentStepSkeleton />
            ) : content ? (
              <ContentBlock content={content} />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                We&apos;ll ask you for a few business details and a document to verify your account.
                Once submitted, our team reviews it and you&apos;ll be notified as soon as you&apos;re approved.
              </p>
            )}
          </StepShell>
        );
      })()}

      {/* ── Profile ── */}
      {step === "profile" && (
        <StepShell
          title="Tell us about your business"
          onBack={prevStep ? () => setStep(prevStep) : undefined}
          onNext={() => saveAndAdvance(nextStep ?? "review")}
          nextDisabled={saveProgress.isPending}
        >
          <div className="space-y-5">
            {/* Profile photo */}
            <div className="flex flex-col items-center gap-3 pb-2">
              <div
                className="relative w-24 h-24 rounded-full overflow-hidden cursor-pointer group"
                style={{ background: "var(--color-surface-overlay)", border: "2px dashed var(--color-border-subtle)" }}
                onClick={() => photoInputRef.current?.click()}
              >
                {profile.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profilePhotoUrl as string} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera size={28} className="text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  {photoUploading ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Camera size={20} className="text-white" />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {profile.profilePhotoUrl ? "Tap to change photo" : "Add profile photo (optional)"}
              </p>
              <input
                ref={photoInputRef as React.RefObject<HTMLInputElement>}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={photoUploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
              />
            </div>

            {/* Read-only contact info */}
            <div className="grid grid-cols-2 gap-4">
              {[{ key: "phone", label: "Phone" }, { key: "email", label: "Email" }].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
                  <input
                    readOnly
                    value={profile[key] ?? ""}
                    className="w-full h-11 px-4 rounded-xl text-sm outline-none opacity-60 cursor-default"
                    style={{ background: "var(--color-surface-overlay)", border: "1px solid var(--color-border-subtle)", color: "var(--color-text-secondary)" }}
                  />
                </div>
              ))}
            </div>

            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              {[{ key: "firstName", label: "First Name *" }, { key: "lastName", label: "Last Name" }].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
                  <input
                    value={profile[key] ?? ""}
                    onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>

            {/* DOB + Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  value={profile.dob ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, dob: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Gender</label>
                <select
                  value={profile.gender ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="" disabled>Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            {/* Location — city, state, pincode */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">City *</label>
                <input
                  value={profile.city ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">State *</label>
                <input
                  value={profile.state ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Pincode</label>
                <input
                  value={profile.pincode ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, pincode: e.target.value }))}
                  placeholder="600001"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Brand Name + Business Established On */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Brand Name *</label>
                <input
                  value={profile.businessName ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, businessName: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Business Established On</label>
                <input
                  type="date"
                  value={profile.businessEstablishedOn ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, businessEstablishedOn: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Business Type + Instagram Link */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Business Type *</label>
                <select
                  value={profile.productServiceType ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, productServiceType: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="" disabled>Select…</option>
                  <option value="Product-based">Product-based</option>
                  <option value="Service-based">Service-based</option>
                  <option value="Both">Both</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Instagram Link *</label>
                <input
                  value={profile.instagramLink ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, instagramLink: e.target.value }))}
                  placeholder="@username"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Revenue Generated + Revenue Goal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Revenue Generated Until Now *</label>
                <select
                  value={profile.annualTurnover ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, annualTurnover: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="" disabled>Select…</option>
                  {ANNUAL_TURNOVER_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Revenue Goal After TBT *</label>
                <input
                  value={profile.revenueGoalAfterTbt ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, revenueGoalAfterTbt: e.target.value }))}
                  placeholder="e.g. 1Cr in 12 months"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Learning Goals + Business Started From */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Learning Goals *</label>
                <input
                  value={profile.goalAfter90Days ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, goalAfter90Days: e.target.value }))}
                  placeholder="What do you want to achieve?"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Business Started From *</label>
                <input
                  value={profile.businessStartedFrom ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, businessStartedFrom: e.target.value }))}
                  placeholder="e.g. 2019 or Yet to Start"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Team Size + Website URL */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Total Members in Your Team *</label>
                <input
                  value={profile.teamSize ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, teamSize: e.target.value }))}
                  placeholder="e.g. 5"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Website URL</label>
                <input
                  value={profile.websiteUrl ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, websiteUrl: e.target.value }))}
                  placeholder="https://yourbrand.com"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Instagram Stats + Facebook Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Instagram Posts &amp; Followers *</label>
                <input
                  value={profile.instagramStats ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, instagramStats: e.target.value }))}
                  placeholder="e.g. 120 posts, 4.2K followers"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Facebook Posts &amp; Followers *</label>
                <input
                  value={profile.facebookStats ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, facebookStats: e.target.value }))}
                  placeholder="e.g. 80 posts, 2K followers"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Preferred Session Mode */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Offline / Online / Both *</label>
              <div className="flex gap-3">
                {(["offline", "online", "hybrid"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, preferredSessionMode: mode }))}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors capitalize",
                      profile.preferredSessionMode === mode ? "text-white border-transparent" : "text-muted-foreground"
                    )}
                    style={profile.preferredSessionMode === mode
                      ? { background: "var(--color-accent)", borderColor: "var(--color-accent)" }
                      : { borderColor: "var(--color-border-subtle)" }}
                  >
                    {mode === "hybrid" ? "Both" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* GST Number */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">GST Number *</label>
              <input
                value={profile.gstNumber ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, gstNumber: e.target.value }))}
                placeholder="22AAAAA0000A1Z5"
                className={inputCls}
                style={inputStyle}
              />
            </div>

            {/* Existing Marketing Channels */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Existing Marketing Channel</label>
              <div className="flex flex-wrap gap-2">
                {MARKETING_CHANNELS.map((channel) => {
                  const active = ((profile.marketingChannels as string[]) || []).includes(channel);
                  return (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => toggleMarketingChannel(channel)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium border transition-colors",
                        active ? "text-white border-transparent" : "text-muted-foreground"
                      )}
                      style={active
                        ? { background: "var(--color-accent)", borderColor: "var(--color-accent)" }
                        : { borderColor: "var(--color-border-subtle)" }}
                    >
                      {channel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name of Marketing Channel */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name of the Marketing Channel</label>
              <input
                value={profile.marketingChannelName ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, marketingChannelName: e.target.value }))}
                placeholder="e.g. Facebook Ads account name"
                className={inputCls}
                style={inputStyle}
              />
            </div>

            {/* Domain & Hosting Details */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Domain &amp; Hosting Details</label>
              <input
                value={profile.domainHostingDetails ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, domainHostingDetails: e.target.value }))}
                placeholder="Provider, expiry dates, etc."
                className={inputCls}
                style={inputStyle}
              />
            </div>

            {/* Business Address */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Business Address</label>
              <textarea
                value={profile.businessAddress ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, businessAddress: e.target.value }))}
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm text-foreground outline-none resize-none"
                style={inputStyle}
              />
            </div>

            {/* Key Challenges */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Key Challenges</label>
              <div className="space-y-3">
                {[
                  { key: "challenge1", placeholder: "Primary business obstacle" },
                  { key: "challenge2", placeholder: "Secondary concern" },
                  { key: "challenge3", placeholder: "Other support needed" },
                ].map(({ key, placeholder }, i) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                    <input
                      value={profile[key] ?? ""}
                      onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className={cn(inputCls, "flex-1")}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Social Media Handling */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Social Media Handling *</label>
              <div className="flex gap-3 mb-3">
                {([{ label: "In-house", val: true }, { label: "Outsourced / None", val: false }] as const).map(({ label, val }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, hasMarketingTeam: val }))}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors",
                      profile.hasMarketingTeam === val ? "text-white border-transparent" : "text-muted-foreground"
                    )}
                    style={profile.hasMarketingTeam === val
                      ? { background: "var(--color-accent)", borderColor: "var(--color-accent)" }
                      : { borderColor: "var(--color-border-subtle)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {profile.hasMarketingTeam && (
                <input
                  value={profile.marketingTeamDetails ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, marketingTeamDetails: e.target.value }))}
                  placeholder="Describe your social media team or agency"
                  className={inputCls}
                  style={inputStyle}
                />
              )}
            </div>

            {/* Video Editing */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Video Editing *</label>
              <div className="flex gap-3 mb-3">
                {([{ label: "Yes", val: true }, { label: "No", val: false }] as const).map(({ label, val }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, hasVideoEditing: val }))}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors",
                      profile.hasVideoEditing === val ? "text-white border-transparent" : "text-muted-foreground"
                    )}
                    style={profile.hasVideoEditing === val
                      ? { background: "var(--color-accent)", borderColor: "var(--color-accent)" }
                      : { borderColor: "var(--color-border-subtle)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {profile.hasVideoEditing && (
                <input
                  value={profile.videoEditingDetails ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, videoEditingDetails: e.target.value }))}
                  placeholder="In-house, outsourced, or tools used"
                  className={inputCls}
                  style={inputStyle}
                />
              )}
            </div>
          </div>
        </StepShell>
      )}

      {/* ── Skills & Growth ── */}
      {step === "skills" && (
        <StepShell
          title="Your skills & learning goals"
          onBack={prevStep ? () => setStep(prevStep) : undefined}
          onNext={() => saveAndAdvance(nextStep ?? "review")}
          nextDisabled={saveProgress.isPending}
        >
          <div className="space-y-7">
            {/* Website question */}
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Do you have a website?</p>
              <div className="flex gap-3">
                {([{ label: "Yes", val: true }, { label: "No", val: false }] as const).map(({ label, val }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, hasWebsite: val, ...(val === false && { weeklyWebsiteOrders: undefined }) }))}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors",
                      profile.hasWebsite === val
                        ? "text-white border-transparent"
                        : "text-muted-foreground"
                    )}
                    style={profile.hasWebsite === val
                      ? { background: "var(--color-accent)", borderColor: "var(--color-accent)" }
                      : { borderColor: "var(--color-border-subtle)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Weekly orders — only when website = yes */}
            {profile.hasWebsite === true && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Weekly orders from your website
                </label>
                <input
                  type="number" min={0}
                  value={profile.weeklyWebsiteOrders ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, weeklyWebsiteOrders: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  placeholder="e.g. 50"
                  className="w-full h-11 px-4 rounded-xl text-sm text-foreground outline-none"
                  style={{ background: "var(--color-surface-overlay)", border: "1px solid var(--color-border-subtle)" }}
                />
              </div>
            )}

            {/* Skill sliders */}
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Rate your skills</p>
              <p className="text-xs text-muted-foreground mb-4">1 = Beginner &nbsp;·&nbsp; 10 = Expert</p>
              <div className="space-y-5">
                {SKILL_FIELDS.map(({ key, label }) => (
                  <SkillSlider
                    key={key}
                    label={label}
                    value={typeof profile[key] === "number" ? profile[key] : 1}
                    onChange={(v) => setProfile((p) => ({ ...p, [key]: v }))}
                  />
                ))}
              </div>
            </div>

            {/* Learning hours slider */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm font-medium text-foreground">Hours per week for learning</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: "var(--color-accent)" }}>
                  {typeof profile.weeklyLearningHours === "number" ? profile.weeklyLearningHours : 5} hrs
                </span>
              </div>
              <input
                type="range" min={5} max={80} step={5}
                value={typeof profile.weeklyLearningHours === "number" ? profile.weeklyLearningHours : 5}
                onChange={(e) => setProfile((p) => ({ ...p, weeklyLearningHours: Number(e.target.value) }))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: "var(--color-accent)" }}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>5 hrs</span><span>40 hrs</span><span>80 hrs</span>
              </div>
            </div>
          </div>
        </StepShell>
      )}

      {/* ── Documents ── */}
      {step === "documents" && (
        <StepShell
          title="Upload a document"
          onBack={prevStep ? () => setStep(prevStep) : undefined}
          onNext={() => setStep(nextStep ?? "review")}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Document Type</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full h-11 px-4 rounded-xl text-sm text-foreground outline-none"
                style={{ background: "var(--color-surface-overlay)", border: "1px solid var(--color-border-subtle)" }}
              >
                {DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <input
              type="file"
              accept="image/*,application/pdf"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); e.target.value = ""; }}
              className="text-sm text-muted-foreground"
            />
            {initialDocuments.length > 0 && (
              <ul className="space-y-2">
                {initialDocuments.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between text-sm p-3 rounded-xl" style={{ background: "var(--color-surface-overlay)" }}>
                    <span className="text-foreground">{doc.documentType}</span>
                    <button onClick={() => deleteDoc.mutate(doc.id)} className="text-xs text-muted-foreground hover:text-foreground">Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </StepShell>
      )}

      {/* ── Review & Submit ── */}
      {step === "review" && (
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-foreground mb-4">Review &amp; Submit</h1>
          <div className="space-y-2 mb-6">
            {Object.entries(profile).filter(([k, v]) => v && k !== "profilePhotoUrl" && !k.startsWith("challenge")).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm py-2 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
                <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                <span className="text-foreground">{Array.isArray(value) ? value.join(", ") : String(value)}</span>
              </div>
            ))}
            {/* Show challenges if any */}
            {([profile.challenge1, profile.challenge2, profile.challenge3].filter(Boolean) as string[]).length > 0 && (
              <div className="py-2 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
                <span className="text-muted-foreground text-sm">Key Challenges</span>
                <ul className="mt-1 space-y-0.5">
                  {([profile.challenge1, profile.challenge2, profile.challenge3].filter(Boolean) as string[]).map((c, i) => (
                    <li key={i} className="text-sm text-foreground">{i + 1}. {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">{initialDocuments.length} document(s) uploaded</p>
          {!readyToSubmit && (
            <p className="text-sm mb-4" style={{ color: "var(--color-alert)" }}>
              {missingFields.length > 0
                ? `Please fill in: ${missingFields.join(", ")}`
                : "Please upload at least one document."}
            </p>
          )}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(prevStep ?? "documents")}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!readyToSubmit || submit.isPending}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--color-accent)" }}
            >
              Submit for Approval
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { data: state, isLoading } = useOnboardingState();

  if (isLoading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!state) return <div className="py-16 text-center text-sm text-muted-foreground">Something went wrong. Please refresh.</div>;

  if (state.verificationStatus === "under_review") return <PendingReviewView submittedAt={state.onboardingSubmittedAt} />;
  if (state.verificationStatus === "rejected") return <RejectedView note={state.onboardingReviewNote} />;

  return (
    <OnboardingWizard
      initialProfile={state.profile as Record<string, any>}
      initialDocuments={state.documents}
      changesNote={state.verificationStatus === "changes_requested" ? state.onboardingReviewNote : null}
    />
  );
}

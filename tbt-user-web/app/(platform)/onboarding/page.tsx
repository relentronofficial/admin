"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Video, Calendar } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useOnboardingState,
  useOnboardingContent,
  useSaveOnboardingProgress,
  usePresignOnboardingDocument,
  useRegisterOnboardingDocument,
  useDeleteOnboardingDocument,
  useSubmitOnboarding,
} from "@/lib/hooks/useOnboarding";
import { useMyOnboardingMeetings } from "@/lib/hooks/useOnboardingMeetings";
import type { OnboardingContentStep } from "@/lib/api/services/onboarding.service";

// Wizard chrome (labels/copy) is hardcoded here rather than sourced from
// uiStrings — the *educational content* (step 2/5 text+audio+video) is the
// piece the product spec requires to be admin-manageable, and that already
// comes from the onboarding_content table (useOnboardingContent). See
// SELF_ONBOARDING_SPECKIT.md — this is a scope decision, not an oversight.

type Step = "welcome" | "education" | "profile" | "documents" | "guided_media" | "review";
const STEP_ORDER: Step[] = ["welcome", "education", "profile", "documents", "guided_media", "review"];

const REQUIRED_FIELDS = ["firstName", "businessName", "businessType", "city", "state"] as const;

const DOCUMENT_TYPES = [
  { value: "business_proof", label: "Business Proof" },
  { value: "gst_certificate", label: "GST Certificate" },
  { value: "id_proof", label: "ID Proof" },
  { value: "other", label: "Other" },
];

// ─── Shared bits ────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: Step }) {
  const index = STEP_ORDER.indexOf(step);
  const pct = Math.round(((index + 1) / STEP_ORDER.length) * 100);
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-muted-foreground mb-2">
        <span>Step {index + 1} of {STEP_ORDER.length}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-surface-overlay)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--color-accent)" }} />
      </div>
    </div>
  );
}

function ContentBlock({ content }: { content?: OnboardingContentStep }) {
  if (!content) return null;
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

function PendingReviewView() {
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <h1 className="text-xl font-bold text-foreground mb-3">Application Submitted</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Your onboarding has been submitted successfully and is waiting for admin approval.
        We&apos;ll notify you as soon as it&apos;s reviewed.
      </p>
      <VerificationMeetingCard />
    </div>
  );
}

function RejectedView({ note }: { note: string | null }) {
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <h1 className="text-xl font-bold text-foreground mb-3">Application Not Approved</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {note || "Your application was not approved. Please contact support for details."}
      </p>
    </div>
  );
}

// ─── Wizard ─────────────────────────────────────────────────────────────────

function OnboardingWizard({ initialProfile, initialDocuments, changesNote }: {
  initialProfile: Record<string, any>;
  initialDocuments: { id: string; documentType: string; documentUrl: string; status: string }[];
  changesNote: string | null;
}) {
  const router = useRouter();
  const { data: content } = useOnboardingContent();
  const saveProgress = useSaveOnboardingProgress();
  const presign = usePresignOnboardingDocument();
  const registerDoc = useRegisterOnboardingDocument();
  const deleteDoc = useDeleteOnboardingDocument();
  const submit = useSubmitOnboarding();

  const [step, setStep] = useState<Step>("welcome");
  const [profile, setProfile] = useState<Record<string, any>>(initialProfile);
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0].value);
  const [uploading, setUploading] = useState(false);

  const introContent = useMemo(() => content?.find((c) => c.stepKey === "introduction"), [content]);
  const guidedContent = useMemo(() => content?.find((c) => c.stepKey === "guided_instructions"), [content]);

  const missingFields = REQUIRED_FIELDS.filter((f) => !profile[f]);
  const readyToSubmit = missingFields.length === 0 && initialDocuments.length > 0;

  const saveAndAdvance = async (next: Step) => {
    try {
      await saveProgress.mutateAsync(profile);
      setStep(next);
    } catch {
      toast.error("Couldn't save your progress. Please try again.");
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data } = await presign.mutateAsync({ filename: file.name, contentType: file.type, documentType });
      await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await registerDoc.mutateAsync({ documentType, documentUrl: data.publicUrl });
      toast.success("Document uploaded");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
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

  return (
    <div className="py-8 px-4">
      <ProgressBar step={step} />

      {changesNote && (
        <div className="max-w-2xl mx-auto mb-6 p-4 rounded-xl text-sm" style={{ background: "color-mix(in srgb, var(--color-alert) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--color-alert) 30%, transparent)" }}>
          <p className="font-semibold text-foreground mb-1">Admin requested some changes</p>
          <p className="text-muted-foreground">{changesNote}</p>
        </div>
      )}

      {step === "welcome" && (
        <StepShell title="Welcome to TBT 👋" onNext={() => setStep("education")}>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Let&apos;s get your account set up. This should take about 5–10 minutes — you can save your
            progress and come back anytime before submitting.
          </p>
        </StepShell>
      )}

      {step === "education" && (
        <StepShell title="Before you start" onBack={() => setStep("welcome")} onNext={() => setStep("profile")}>
          {introContent ? <ContentBlock content={introContent} /> : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              We&apos;ll ask you for a few business details and a document to verify your account.
              Once submitted, our team reviews it and you&apos;ll be notified as soon as you&apos;re approved.
            </p>
          )}
        </StepShell>
      )}

      {step === "profile" && (
        <StepShell
          title="Tell us about your business"
          onBack={() => setStep("education")}
          onNext={() => saveAndAdvance("documents")}
          nextDisabled={saveProgress.isPending}
        >
          <div className="space-y-4">
            {[
              { key: "firstName", label: "First Name *" },
              { key: "lastName", label: "Last Name" },
              { key: "city", label: "City *" },
              { key: "state", label: "State *" },
              { key: "businessName", label: "Business Name *" },
              { key: "businessType", label: "Business Type *" },
              { key: "productServiceType", label: "Product / Service Type" },
              { key: "gstNumber", label: "GST Number" },
              { key: "annualTurnover", label: "Annual Turnover" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
                <input
                  value={profile[key] ?? ""}
                  onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full h-11 px-4 rounded-xl text-sm text-foreground outline-none"
                  style={{ background: "var(--color-surface-overlay)", border: "1px solid var(--color-border-subtle)" }}
                />
              </div>
            ))}
          </div>
        </StepShell>
      )}

      {step === "documents" && (
        <StepShell title="Upload a document" onBack={() => setStep("profile")} onNext={() => setStep("guided_media")}>
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
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
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

      {step === "guided_media" && (
        <StepShell title="A quick walkthrough" onBack={() => setStep("documents")} onNext={() => setStep("review")}>
          {guidedContent ? <ContentBlock content={guidedContent} /> : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              You&apos;re almost done — review your details on the next screen and submit for approval.
            </p>
          )}
        </StepShell>
      )}

      {step === "review" && (
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-foreground mb-4">Review &amp; Submit</h1>
          <div className="space-y-2 mb-6">
            {Object.entries(profile).filter(([, v]) => v).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm py-2 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
                <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                <span className="text-foreground">{String(value)}</span>
              </div>
            ))}
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
            <button onClick={() => setStep("guided_media")} className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
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

  if (state.verificationStatus === "under_review") return <PendingReviewView />;
  if (state.verificationStatus === "rejected") return <RejectedView note={state.onboardingReviewNote} />;

  return (
    <OnboardingWizard
      initialProfile={state.profile}
      initialDocuments={state.documents}
      changesNote={state.verificationStatus === "changes_requested" ? state.onboardingReviewNote : null}
    />
  );
}

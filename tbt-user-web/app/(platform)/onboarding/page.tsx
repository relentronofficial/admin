"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import apiClient from "@/lib/api/client";

// Wizard chrome (labels/copy) is hardcoded here rather than sourced from
// uiStrings — the *educational content* (step 2/5 text+audio+video) is the
// piece the product spec requires to be admin-manageable, and that already
// comes from the onboarding_content table (useOnboardingContent). See
// SELF_ONBOARDING_SPECKIT.md — this is a scope decision, not an oversight.

// ─── Types ──────────────────────────────────────────────────────────────────

type FixedStep = "welcome" | "profile" | "skills" | "documents" | "review";
type DynamicStep = `education:${string}`;
type Step = FixedStep | DynamicStep;

// Fields checked by the backend submit gate and the frontend review page.
// productServiceType is the "Business Type" the wizard collects — businessType
// is a separate unused DB column, so we check productServiceType here.
const REQUIRED_FIELDS = ["firstName", "businessName", "productServiceType", "city", "state"] as const;

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

// ─── Micro-components ────────────────────────────────────────────────────────

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--color-alert, #ef4444)" }}>
      {error}
    </p>
  );
}

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

  const [profile, setProfileState] = useState<Record<string, any>>(() => {
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

  // Per-field validation errors shown inline
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0].value);
  const [uploading, setUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | undefined>(undefined);

  // Location dropdowns — states loaded once, cities cascade from selected state
  const [states, setStates] = useState<{ name: string; isoCode: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedStateCode, setSelectedStateCode] = useState<string>("");

  useEffect(() => {
    apiClient.get("/api/location/states?countryCode=IN").then((res) => {
      setStates((res as any).data?.data ?? []);
    }).catch(() => {});
  }, []);

  // When states load, resolve the already-saved state name → isoCode for city fetch
  useEffect(() => {
    if (!states.length || !profile.state) return;
    const match = states.find((s) => s.name === profile.state);
    if (match && match.isoCode !== selectedStateCode) setSelectedStateCode(match.isoCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states]);

  useEffect(() => {
    if (!selectedStateCode) { setCities([]); return; }
    apiClient.get(`/api/location/cities?countryCode=IN&stateCode=${selectedStateCode}`).then((res) => {
      setCities((res as any).data?.data ?? []);
    }).catch(() => {});
  }, [selectedStateCode]);

  // Update a profile field and clear its error in one call
  const setField = (key: string, value: unknown) => {
    setProfileState((p) => ({ ...p, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // Dynamic border style — red when field has an error
  const fieldStyle = (key: string) => ({
    background: "var(--color-surface-overlay)",
    border: `1px solid ${errors[key] ? "var(--color-alert, #ef4444)" : "var(--color-border-subtle)"}`,
  });

  // Validate the profile step — returns true if valid
  const validateProfileStep = (): boolean => {
    const errs: Record<string, string> = {};
    const str = (k: string) => (profile[k] ?? "").toString().trim();

    if (!str("firstName")) errs.firstName = "First name is required";
    if (!str("city")) errs.city = "City is required";
    if (!str("state")) errs.state = "State is required";
    if (!str("businessName")) errs.businessName = "Brand name is required";
    if (!str("productServiceType")) errs.productServiceType = "Please select a business type";
    if (!str("instagramLink")) errs.instagramLink = "Instagram link is required";
    if (!str("annualTurnover")) errs.annualTurnover = "Please select your revenue range";
    if (!str("revenueGoalAfterTbt")) errs.revenueGoalAfterTbt = "Revenue goal is required";
    if (!str("goalAfter90Days")) errs.goalAfter90Days = "Learning goal is required";
    if (!str("businessStartedFrom")) errs.businessStartedFrom = "This field is required";
    if (!str("teamSize")) errs.teamSize = "Team size is required";
    if (!str("instagramStats")) errs.instagramStats = "Instagram stats are required";
    if (!str("facebookStats")) errs.facebookStats = "Facebook stats are required";
    if (!str("gstNumber")) errs.gstNumber = "GST number is required";
    if (profile.preferredSessionMode == null) {
      errs.preferredSessionMode = "Please select a session mode";
    }
    if (profile.hasMarketingTeam == null) {
      errs.hasMarketingTeam = "Please select an option";
    }
    if (profile.hasVideoEditing == null) {
      errs.hasVideoEditing = "Please select an option";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const missingFields = REQUIRED_FIELDS.filter((f) => !profile[f]);
  const readyToSubmit = missingFields.length === 0 && initialDocuments.length > 0;

  const currentIndex = stepOrder.indexOf(step);
  const prevStep = currentIndex > 0 ? stepOrder[currentIndex - 1] : undefined;
  const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : undefined;

  const toggleMarketingChannel = (channel: string) => {
    setProfileState((p) => {
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
    // Run step-specific validation before hitting the server
    if (step === "profile" && !validateProfileStep()) {
      // Scroll to the first invalid field
      setTimeout(() => {
        const el = document.querySelector("[data-field-error]");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    try {
      // Strip read-only fields, combine challenge fields, strip null/undefined/empty-string
      // values — the backend schema uses .strict() and z.string().optional() rejects null,
      // z.string().min(1) rejects "".
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
      setProfileState((p) => ({ ...p, profilePhotoUrl: data.publicUrl }));
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

      {/* ── Dynamic education steps ── */}
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
              <div data-field-error={errors.firstName ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">First Name *</label>
                <input
                  value={profile.firstName ?? ""}
                  onChange={(e) => setField("firstName", e.target.value)}
                  className={inputCls}
                  style={fieldStyle("firstName")}
                />
                <FieldError error={errors.firstName} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Last Name</label>
                <input
                  value={profile.lastName ?? ""}
                  onChange={(e) => setField("lastName", e.target.value)}
                  className={inputCls}
                  style={fieldStyle("lastName")}
                />
              </div>
            </div>

            {/* DOB + Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  value={profile.dob ? (typeof profile.dob === "string" ? profile.dob.slice(0, 10) : new Date(profile.dob).toISOString().slice(0, 10)) : ""}
                  onChange={(e) => setField("dob", e.target.value)}
                  className={inputCls}
                  style={fieldStyle("dob")}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Gender</label>
                <select
                  value={profile.gender ?? ""}
                  onChange={(e) => setField("gender", e.target.value || null)}
                  className={inputCls}
                  style={fieldStyle("gender")}
                >
                  <option value="" disabled>Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            {/* Location — state first so city cascade works */}
            <div className="grid grid-cols-3 gap-4">
              <div data-field-error={errors.state ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">State *</label>
                <select
                  value={states.find((s) => s.name === profile.state)?.isoCode ?? ""}
                  onChange={(e) => {
                    const s = states.find((st) => st.isoCode === e.target.value);
                    if (!s) return;
                    setField("state", s.name);
                    setSelectedStateCode(s.isoCode);
                    setField("city", "");
                  }}
                  className={inputCls}
                  style={fieldStyle("state")}
                >
                  <option value="">Select state…</option>
                  {states.map((s) => (
                    <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
                  ))}
                </select>
                <FieldError error={errors.state} />
              </div>
              <div data-field-error={errors.city ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">City *</label>
                <select
                  value={profile.city ?? ""}
                  onChange={(e) => setField("city", e.target.value)}
                  className={inputCls}
                  style={fieldStyle("city")}
                  disabled={!selectedStateCode}
                >
                  <option value="">{selectedStateCode ? "Select city…" : "Select state first"}</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <FieldError error={errors.city} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Pincode</label>
                <input
                  value={profile.pincode ?? ""}
                  onChange={(e) => setField("pincode", e.target.value)}
                  placeholder="600001"
                  className={inputCls}
                  style={fieldStyle("pincode")}
                />
              </div>
            </div>

            {/* Brand Name + Business Established On */}
            <div className="grid grid-cols-2 gap-4">
              <div data-field-error={errors.businessName ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Brand Name *</label>
                <input
                  value={profile.businessName ?? ""}
                  onChange={(e) => setField("businessName", e.target.value)}
                  className={inputCls}
                  style={fieldStyle("businessName")}
                />
                <FieldError error={errors.businessName} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Business Established On</label>
                <input
                  type="date"
                  value={profile.businessEstablishedOn ? (typeof profile.businessEstablishedOn === "string" ? profile.businessEstablishedOn.slice(0, 10) : new Date(profile.businessEstablishedOn).toISOString().slice(0, 10)) : ""}
                  onChange={(e) => setField("businessEstablishedOn", e.target.value)}
                  className={inputCls}
                  style={fieldStyle("businessEstablishedOn")}
                />
              </div>
            </div>

            {/* Business Type + Instagram Link */}
            <div className="grid grid-cols-2 gap-4">
              <div data-field-error={errors.productServiceType ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Business Type *</label>
                <select
                  value={profile.productServiceType ?? ""}
                  onChange={(e) => setField("productServiceType", e.target.value || null)}
                  className={inputCls}
                  style={fieldStyle("productServiceType")}
                >
                  <option value="" disabled>Select…</option>
                  <option value="Product-based">Product-based</option>
                  <option value="Service-based">Service-based</option>
                  <option value="Both">Both</option>
                  <option value="Other">Other</option>
                </select>
                <FieldError error={errors.productServiceType} />
              </div>
              <div data-field-error={errors.instagramLink ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Instagram Link *</label>
                <input
                  value={profile.instagramLink ?? ""}
                  onChange={(e) => setField("instagramLink", e.target.value)}
                  placeholder="@username"
                  className={inputCls}
                  style={fieldStyle("instagramLink")}
                />
                <FieldError error={errors.instagramLink} />
              </div>
            </div>

            {/* Revenue Generated + Revenue Goal */}
            <div className="grid grid-cols-2 gap-4">
              <div data-field-error={errors.annualTurnover ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Revenue Generated Until Now *</label>
                <select
                  value={profile.annualTurnover ?? ""}
                  onChange={(e) => setField("annualTurnover", e.target.value || null)}
                  className={inputCls}
                  style={fieldStyle("annualTurnover")}
                >
                  <option value="" disabled>Select…</option>
                  {ANNUAL_TURNOVER_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <FieldError error={errors.annualTurnover} />
              </div>
              <div data-field-error={errors.revenueGoalAfterTbt ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Revenue Goal After TBT *</label>
                <input
                  value={profile.revenueGoalAfterTbt ?? ""}
                  onChange={(e) => setField("revenueGoalAfterTbt", e.target.value)}
                  placeholder="e.g. 1Cr in 12 months"
                  className={inputCls}
                  style={fieldStyle("revenueGoalAfterTbt")}
                />
                <FieldError error={errors.revenueGoalAfterTbt} />
              </div>
            </div>

            {/* Learning Goals + Business Started From */}
            <div className="grid grid-cols-2 gap-4">
              <div data-field-error={errors.goalAfter90Days ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Learning Goals *</label>
                <input
                  value={profile.goalAfter90Days ?? ""}
                  onChange={(e) => setField("goalAfter90Days", e.target.value)}
                  placeholder="What do you want to achieve?"
                  className={inputCls}
                  style={fieldStyle("goalAfter90Days")}
                />
                <FieldError error={errors.goalAfter90Days} />
              </div>
              <div data-field-error={errors.businessStartedFrom ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Business Started From *</label>
                <input
                  value={profile.businessStartedFrom ?? ""}
                  onChange={(e) => setField("businessStartedFrom", e.target.value)}
                  placeholder="e.g. 2019 or Yet to Start"
                  className={inputCls}
                  style={fieldStyle("businessStartedFrom")}
                />
                <FieldError error={errors.businessStartedFrom} />
              </div>
            </div>

            {/* Team Size + Website URL */}
            <div className="grid grid-cols-2 gap-4">
              <div data-field-error={errors.teamSize ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Total Members in Your Team *</label>
                <input
                  value={profile.teamSize ?? ""}
                  onChange={(e) => setField("teamSize", e.target.value)}
                  placeholder="e.g. 5"
                  className={inputCls}
                  style={fieldStyle("teamSize")}
                />
                <FieldError error={errors.teamSize} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Website URL</label>
                <input
                  value={profile.websiteUrl ?? ""}
                  onChange={(e) => setField("websiteUrl", e.target.value)}
                  placeholder="https://yourbrand.com"
                  className={inputCls}
                  style={fieldStyle("websiteUrl")}
                />
              </div>
            </div>

            {/* Instagram Stats + Facebook Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div data-field-error={errors.instagramStats ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Instagram Posts &amp; Followers *</label>
                <input
                  value={profile.instagramStats ?? ""}
                  onChange={(e) => setField("instagramStats", e.target.value)}
                  placeholder="e.g. 120 posts, 4.2K followers"
                  className={inputCls}
                  style={fieldStyle("instagramStats")}
                />
                <FieldError error={errors.instagramStats} />
              </div>
              <div data-field-error={errors.facebookStats ? true : undefined}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Facebook Posts &amp; Followers *</label>
                <input
                  value={profile.facebookStats ?? ""}
                  onChange={(e) => setField("facebookStats", e.target.value)}
                  placeholder="e.g. 80 posts, 2K followers"
                  className={inputCls}
                  style={fieldStyle("facebookStats")}
                />
                <FieldError error={errors.facebookStats} />
              </div>
            </div>

            {/* Preferred Session Mode */}
            <div data-field-error={errors.preferredSessionMode ? true : undefined}>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Offline / Online / Both *</label>
              <div className="flex gap-3">
                {(["offline", "online", "hybrid"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setField("preferredSessionMode", mode)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors capitalize",
                      profile.preferredSessionMode === mode ? "text-white border-transparent" : "text-muted-foreground"
                    )}
                    style={profile.preferredSessionMode === mode
                      ? { background: "var(--color-accent)", borderColor: "var(--color-accent)" }
                      : { borderColor: errors.preferredSessionMode ? "var(--color-alert, #ef4444)" : "var(--color-border-subtle)" }}
                  >
                    {mode === "hybrid" ? "Both" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
              <FieldError error={errors.preferredSessionMode} />
            </div>

            {/* GST Number */}
            <div data-field-error={errors.gstNumber ? true : undefined}>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">GST Number *</label>
              <input
                value={profile.gstNumber ?? ""}
                onChange={(e) => setField("gstNumber", e.target.value)}
                placeholder="22AAAAA0000A1Z5"
                className={inputCls}
                style={fieldStyle("gstNumber")}
              />
              <FieldError error={errors.gstNumber} />
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
                onChange={(e) => setField("marketingChannelName", e.target.value)}
                placeholder="e.g. Facebook Ads account name"
                className={inputCls}
                style={fieldStyle("marketingChannelName")}
              />
            </div>

            {/* Domain & Hosting Details */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Domain &amp; Hosting Details</label>
              <input
                value={profile.domainHostingDetails ?? ""}
                onChange={(e) => setField("domainHostingDetails", e.target.value)}
                placeholder="Provider, expiry dates, etc."
                className={inputCls}
                style={fieldStyle("domainHostingDetails")}
              />
            </div>

            {/* Business Address */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Business Address</label>
              <textarea
                value={profile.businessAddress ?? ""}
                onChange={(e) => setField("businessAddress", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm text-foreground outline-none resize-none"
                style={fieldStyle("businessAddress")}
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
                      onChange={(e) => setField(key, e.target.value)}
                      placeholder={placeholder}
                      className={cn(inputCls, "flex-1")}
                      style={fieldStyle(key)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Social Media Handling */}
            <div data-field-error={errors.hasMarketingTeam ? true : undefined}>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Social Media Handling *</label>
              <div className="flex gap-3 mb-3">
                {([{ label: "In-house", val: true }, { label: "Outsourced / None", val: false }] as const).map(({ label, val }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setField("hasMarketingTeam", val)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors",
                      profile.hasMarketingTeam === val ? "text-white border-transparent" : "text-muted-foreground"
                    )}
                    style={profile.hasMarketingTeam === val
                      ? { background: "var(--color-accent)", borderColor: "var(--color-accent)" }
                      : { borderColor: errors.hasMarketingTeam ? "var(--color-alert, #ef4444)" : "var(--color-border-subtle)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <FieldError error={errors.hasMarketingTeam} />
              {profile.hasMarketingTeam && (
                <input
                  value={profile.marketingTeamDetails ?? ""}
                  onChange={(e) => setField("marketingTeamDetails", e.target.value)}
                  placeholder="Describe your social media team or agency"
                  className={inputCls}
                  style={fieldStyle("marketingTeamDetails")}
                />
              )}
            </div>

            {/* Video Editing */}
            <div data-field-error={errors.hasVideoEditing ? true : undefined}>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Video Editing *</label>
              <div className="flex gap-3 mb-3">
                {([{ label: "Yes", val: true }, { label: "No", val: false }] as const).map(({ label, val }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setField("hasVideoEditing", val)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors",
                      profile.hasVideoEditing === val ? "text-white border-transparent" : "text-muted-foreground"
                    )}
                    style={profile.hasVideoEditing === val
                      ? { background: "var(--color-accent)", borderColor: "var(--color-accent)" }
                      : { borderColor: errors.hasVideoEditing ? "var(--color-alert, #ef4444)" : "var(--color-border-subtle)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <FieldError error={errors.hasVideoEditing} />
              {profile.hasVideoEditing && (
                <input
                  value={profile.videoEditingDetails ?? ""}
                  onChange={(e) => setField("videoEditingDetails", e.target.value)}
                  placeholder="In-house, outsourced, or tools used"
                  className={inputCls}
                  style={fieldStyle("videoEditingDetails")}
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
                    onClick={() => setField("hasWebsite", val)}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors",
                      profile.hasWebsite === val ? "text-white border-transparent" : "text-muted-foreground"
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
                  onChange={(e) => setField("weeklyWebsiteOrders", e.target.value === "" ? undefined : Number(e.target.value))}
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
                    onChange={(v) => setField(key, v)}
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
                onChange={(e) => setField("weeklyLearningHours", Number(e.target.value))}
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

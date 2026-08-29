"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Video, Calendar, Camera, MessageCircle,
  Upload, Trash2, Building2, MapPin,
  TrendingUp, Instagram, Users, Shield, Megaphone,
  CheckCircle2, Clock, XCircle,
} from "lucide-react";
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

// ─── Types ──────────────────────────────────────────────────────────────────

type FixedStep = "welcome" | "profile" | "skills" | "documents" | "review";
type DynamicStep = `education:${string}`;
type Step = FixedStep | DynamicStep;

const REQUIRED_FIELDS = ["firstName", "businessName", "productServiceType", "city", "state"] as const;

const DOCUMENT_TYPES = [
  { value: "business_proof", label: "Business Proof" },
  { value: "gst_certificate", label: "GST Certificate" },
  { value: "id_proof", label: "ID Proof" },
  { value: "other", label: "Other" },
];

const MARKETING_CHANNELS = ["SEO", "Paid Ads", "Social Media", "Email", "Referral", "Offline"];

const ANNUAL_TURNOVER_OPTIONS = [
  "Under 10L", "10L - 25L", "25L - 50L", "50L - 1Cr", "1Cr - 5Cr", "5Cr+",
];

function buildStepOrder(contentSteps: OnboardingContentStep[]): Step[] {
  const educationSteps: DynamicStep[] = contentSteps.map((c) => `education:${c.stepKey}` as DynamicStep);
  return ["welcome", ...educationSteps, "profile", "skills", "documents", "review"];
}

const SKILL_FIELDS = [
  { key: "skillBusinessFoundation", label: "Business Foundation" },
  { key: "skillContent", label: "Content Creation" },
  { key: "skillFunnels", label: "Sales Funnels" },
  { key: "skillAds", label: "Paid Ads" },
  { key: "skillSales", label: "Sales & Closing" },
  { key: "skillOverallMarketing", label: "Overall Marketing" },
] as const;

// ─── Design tokens ───────────────────────────────────────────────────────────

const INPUT_CLS = "w-full h-12 px-4 rounded-xl text-sm text-foreground outline-none transition-colors";
const CARD_BG   = "var(--color-bg-surface, #111)";
const OVERLAY   = "var(--color-surface-overlay, rgba(255,255,255,0.05))";
const BORDER    = "var(--color-border-subtle, rgba(255,255,255,0.08))";

// ─── Micro-components ────────────────────────────────────────────────────────

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--color-alert, #ef4444)" }}>
      {error}
    </p>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-1">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "color-mix(in srgb, var(--color-accent) 14%, transparent)" }}
      >
        <Icon size={13} style={{ color: "var(--color-accent)" }} />
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-[0.14em] whitespace-nowrap"
        style={{ color: "var(--color-text-subtle, #666)" }}
      >
        {title}
      </span>
      <div className="flex-1 h-px" style={{ background: BORDER }} />
    </div>
  );
}

function SegmentedSkillSlider({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-baseline gap-0.5">
          <span className="text-lg font-bold tabular-nums leading-none" style={{ color: "var(--color-accent)" }}>
            {value}
          </span>
          <span className="text-xs text-muted-foreground">/10</span>
        </div>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className="flex-1 h-2.5 rounded-full transition-all duration-150 hover:opacity-80"
            style={{
              background: i < value ? "var(--color-accent)" : OVERLAY,
              opacity: i < value ? 0.45 + (i + 1) * 0.055 : undefined,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Beginner</span>
        <span>Expert</span>
      </div>
    </div>
  );
}

// ─── Progress ────────────────────────────────────────────────────────────────

function StepProgress({ step, stepOrder }: { step: Step; stepOrder: Step[] }) {
  const index = stepOrder.indexOf(step);
  const stepLabel =
    step === "welcome" ? "Welcome"
    : step.startsWith("education:") ? "Learn"
    : step === "profile" ? "Profile"
    : step === "skills" ? "Skills"
    : step === "documents" ? "Documents"
    : "Review";

  return (
    <div className="px-6 pt-6 pb-5 border-b" style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: "var(--color-accent)" }}
        >
          {stepLabel}
        </span>
        <span className="text-xs tabular-nums" style={{ color: "var(--color-text-subtle, #666)" }}>
          {index + 1} / {stepOrder.length}
        </span>
      </div>
      <div className="flex gap-1">
        {stepOrder.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-all duration-500"
            style={{ background: i <= index ? "var(--color-accent)" : OVERLAY }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Content blocks (education steps) ────────────────────────────────────────

function ContentBlock({ content }: { content: OnboardingContentStep }) {
  const isHls = content.videoUrl?.endsWith(".m3u8");
  return (
    <div className="space-y-5">
      {content.textBody && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-secondary)" }}>
          {content.textBody}
        </p>
      )}
      {content.videoUrl && (
        <div className="rounded-2xl overflow-hidden bg-black aspect-video">
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
      <div className="h-4 rounded-lg w-3/4" style={{ background: OVERLAY }} />
      <div className="h-4 rounded-lg w-full" style={{ background: OVERLAY }} />
      <div className="h-4 rounded-lg w-5/6" style={{ background: OVERLAY }} />
      <div className="rounded-2xl aspect-video" style={{ background: OVERLAY }} />
    </div>
  );
}

// ─── Step shell ───────────────────────────────────────────────────────────────

function StepShell({
  title, subtitle, children, onBack, onNext, nextLabel, nextDisabled, saving,
}: {
  title: string; subtitle?: string; children: React.ReactNode;
  onBack?: () => void; onNext: () => void;
  nextLabel?: string; nextDisabled?: boolean; saving?: boolean;
}) {
  return (
    <div className="p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground leading-tight">{title}</h2>
        {subtitle && (
          <p className="mt-2 mb-7 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {subtitle}
          </p>
        )}
        {!subtitle && <div className="mb-6" />}
        <div className="mb-10">{children}</div>
        <div className="flex justify-between items-center pt-5 border-t" style={{ borderColor: BORDER }}>
          {onBack ? (
            <button
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Back
            </button>
          ) : <span />}
          <button
            onClick={onNext}
            disabled={nextDisabled || saving}
            className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
            style={{
              background: "var(--color-accent)",
              boxShadow: "0 4px 18px color-mix(in srgb, var(--color-accent) 35%, transparent)",
            }}
          >
            {saving && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {saving ? "Saving…" : (nextLabel ?? "Continue")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status screens ───────────────────────────────────────────────────────────

function VerificationMeetingCard() {
  const router = useRouter();
  const { data: meetings } = useMyOnboardingMeetings();
  const meeting = meetings?.find((m) => m.status === "scheduled" || m.status === "live");
  if (!meeting) return null;

  return (
    <div
      className="mt-6 p-5 rounded-2xl text-left"
      style={{
        background: "color-mix(in srgb, var(--color-accent) 7%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)" }}
        >
          <Video size={18} style={{ color: "var(--color-accent)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{meeting.title}</p>
          <p className="text-xs flex items-center gap-1.5 mt-1" style={{ color: "var(--color-text-subtle)" }}>
            <Calendar size={11} />
            {new Date(meeting.scheduledAt).toLocaleString()}
          </p>
          {meeting.status === "live" && (
            <span
              className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold"
              style={{ background: "color-mix(in srgb, var(--color-success, #22c55e) 15%, transparent)", color: "var(--color-success, #22c55e)" }}
            >
              Live now
            </span>
          )}
        </div>
        <button
          onClick={() => router.push(`/onboarding/meeting/${meeting.id}`)}
          className="px-4 h-9 text-xs font-semibold rounded-xl text-white shrink-0 transition-opacity hover:opacity-90"
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
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function PendingReviewView({ submittedAt }: { submittedAt: string | null }) {
  const when = relativeDate(submittedAt);
  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
        style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}
      >
        <Clock size={28} style={{ color: "var(--color-accent)" }} />
      </div>
      <h1 className="text-xl font-bold text-foreground mb-2">Application Under Review</h1>
      {when && (
        <p className="text-xs mb-3" style={{ color: "var(--color-text-subtle)" }}>Submitted {when}</p>
      )}
      <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--color-text-secondary)" }}>
        Your onboarding has been submitted and is waiting for admin approval.
        We&apos;ll notify you as soon as it&apos;s reviewed.
      </p>
      <VerificationMeetingCard />
    </div>
  );
}

function RejectedView({ note }: { note: string | null }) {
  const whatsappUrl = "https://wa.me/918778766710?text=Hi%2C%20my%20TBT%20application%20was%20not%20approved.%20Can%20you%20help%3F";
  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
        style={{ background: "color-mix(in srgb, var(--color-alert, #ef4444) 10%, transparent)" }}
      >
        <XCircle size={28} style={{ color: "var(--color-alert, #ef4444)" }} />
      </div>
      <h1 className="text-xl font-bold text-foreground mb-3">Application Not Approved</h1>
      <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--color-text-secondary)" }}>
        {note || "Your application was not approved. Please contact support for details."}
      </p>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: "#25D366", boxShadow: "0 4px 14px rgba(37,211,102,0.3)" }}
      >
        <MessageCircle size={16} />
        Contact Support on WhatsApp
      </a>
    </div>
  );
}

// ─── Wizard ──────────────────────────────────────────────────────────────────

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

  const stepOrder = useMemo(() => buildStepOrder(contentSteps ?? []), [contentSteps]);
  const [step, setStep] = useState<Step>("welcome");

  const [profile, setProfileState] = useState<Record<string, any>>(() => {
    const p = { ...initialProfile };
    if (Array.isArray(p.currentChallenges)) {
      p.challenge1 = p.currentChallenges[0] ?? "";
      p.challenge2 = p.currentChallenges[1] ?? "";
      p.challenge3 = p.currentChallenges[2] ?? "";
      delete p.currentChallenges;
    }
    if (!Array.isArray(p.marketingChannels)) p.marketingChannels = [];
    return p;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0].value);
  const [uploading, setUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | undefined>(undefined);

  // Location dropdowns
  const [states, setStates] = useState<{ name: string; isoCode: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedStateCode, setSelectedStateCode] = useState<string>("");

  useEffect(() => {
    apiClient.get("/api/location/states?countryCode=IN").then((res) => {
      setStates((res as any).data ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!states.length || !profile.state) return;
    const match = states.find((s) => s.name === profile.state);
    if (match && match.isoCode !== selectedStateCode) setSelectedStateCode(match.isoCode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states]);

  useEffect(() => {
    if (!selectedStateCode) { setCities([]); return; }
    apiClient.get(`/api/location/cities?countryCode=IN&stateCode=${selectedStateCode}`).then((res) => {
      setCities((res as any).data ?? []);
    }).catch(() => {});
  }, [selectedStateCode]);

  const setField = (key: string, value: unknown) => {
    setProfileState((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const inputStyle = (key: string) => ({
    background: OVERLAY,
    border: `1.5px solid ${errors[key] ? "var(--color-alert, #ef4444)" : BORDER}`,
  });

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
    if (profile.preferredSessionMode == null) errs.preferredSessionMode = "Please select a session mode";
    if (profile.hasMarketingTeam == null) errs.hasMarketingTeam = "Please select an option";
    if (profile.hasVideoEditing == null) errs.hasVideoEditing = "Please select an option";
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
    if (step === "profile" && !validateProfileStep()) {
      setTimeout(() => {
        const el = document.querySelector("[data-field-error]");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    try {
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

  // Shared toggle button style
  const toggleStyle = (active: boolean, hasError?: boolean) =>
    active
      ? {
          background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
          borderColor: "var(--color-accent)",
          color: "var(--color-accent)",
          boxShadow: "0 0 16px color-mix(in srgb, var(--color-accent) 22%, transparent)",
        }
      : {
          background: "transparent",
          borderColor: hasError ? "var(--color-alert, #ef4444)" : BORDER,
          color: "var(--color-text-secondary)",
        };

  return (
    <div className="py-6 px-4 md:px-6">
      {/* Admin change request banner */}
      {changesNote && (
        <div
          className="max-w-3xl mx-auto mb-5 px-5 py-4 rounded-2xl text-sm"
          style={{
            background: "color-mix(in srgb, var(--color-alert, #ef4444) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-alert, #ef4444) 25%, transparent)",
          }}
        >
          <p className="font-semibold text-foreground mb-0.5">Changes requested by admin</p>
          <p style={{ color: "var(--color-text-secondary)" }}>{changesNote}</p>
        </div>
      )}

      {/* Main card */}
      <div
        className="max-w-3xl mx-auto rounded-2xl overflow-hidden"
        style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
      >
        <StepProgress step={step} stepOrder={stepOrder} />

        {/* ── Welcome ── */}
        {step === "welcome" && (
          <StepShell
            title="Welcome to TBT"
            subtitle="Complete your profile in a few steps to unlock full platform access. This takes about 5–10 minutes — your progress is saved automatically."
            onNext={() => setStep(stepOrder[1] ?? "profile")}
          >
            <div className="space-y-3">
              {[
                { icon: Users, label: "Personal & business details" },
                { icon: TrendingUp, label: "Skills & learning goals" },
                { icon: Upload, label: "Upload a KYC document" },
                { icon: CheckCircle2, label: "Submit for admin review" },
              ].map(({ icon: Icon, label }, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-3.5 rounded-xl"
                  style={{ background: OVERLAY, border: `1px solid ${BORDER}` }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}
                  >
                    <Icon size={15} style={{ color: "var(--color-accent)" }} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </div>
              ))}
            </div>
          </StepShell>
        )}

        {/* ── Education steps ── */}
        {step.startsWith("education:") && (() => {
          const key = step.slice("education:".length);
          const content = contentSteps?.find((c) => c.stepKey === key);
          return (
            <StepShell
              title={content?.title || "Before you continue"}
              onBack={prevStep ? () => setStep(prevStep) : undefined}
              onNext={() => setStep(nextStep ?? "review")}
            >
              {contentLoading ? <ContentStepSkeleton /> : content ? <ContentBlock content={content} /> : (
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                  We&apos;ll ask you for a few business details and a document to verify your account.
                </p>
              )}
            </StepShell>
          );
        })()}

        {/* ── Profile ── */}
        {step === "profile" && (
          <StepShell
            title="Tell us about your business"
            subtitle="Fill in your details so our team can get to know you and your goals."
            onBack={prevStep ? () => setStep(prevStep) : undefined}
            onNext={() => saveAndAdvance(nextStep ?? "review")}
            saving={saveProgress.isPending}
          >
            <div className="space-y-4">

              {/* ── Personal ── */}
              <SectionHeader icon={Users} title="Personal Info" />

              {/* Profile photo */}
              <div className="flex flex-col items-center gap-3 py-2">
                <div
                  className="relative w-28 h-28 rounded-full overflow-hidden cursor-pointer group"
                  style={{
                    background: OVERLAY,
                    border: `2px solid ${profile.profilePhotoUrl ? "var(--color-accent)" : BORDER}`,
                    boxShadow: profile.profilePhotoUrl ? "0 0 20px color-mix(in srgb, var(--color-accent) 20%, transparent)" : undefined,
                  }}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {profile.profilePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.profilePhotoUrl as string} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera size={30} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    {photoUploading ? (
                      <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Camera size={22} className="text-white" />
                    )}
                  </div>
                </div>
                <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  {profile.profilePhotoUrl ? "Tap to change photo" : "Add profile photo (optional)"}
                </p>
                <input
                  ref={photoInputRef as React.RefObject<HTMLInputElement>}
                  type="file" accept="image/*" className="hidden" disabled={photoUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
                />
              </div>

              {/* Read-only contact */}
              <div className="grid grid-cols-2 gap-3">
                {[{ key: "phone", label: "Phone" }, { key: "email", label: "Email" }].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>{label}</label>
                    <input
                      readOnly value={profile[key] ?? ""}
                      className={cn(INPUT_CLS, "opacity-50 cursor-default")}
                      style={{ background: OVERLAY, border: `1.5px solid ${BORDER}` }}
                    />
                  </div>
                ))}
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div data-field-error={errors.firstName ? true : undefined}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>First Name *</label>
                  <input value={profile.firstName ?? ""} onChange={(e) => setField("firstName", e.target.value)} className={INPUT_CLS} style={inputStyle("firstName")} />
                  <FieldError error={errors.firstName} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Last Name</label>
                  <input value={profile.lastName ?? ""} onChange={(e) => setField("lastName", e.target.value)} className={INPUT_CLS} style={inputStyle("lastName")} />
                </div>
              </div>

              {/* DOB + Gender */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Date of Birth</label>
                  <input
                    type="date"
                    value={profile.dob ? (typeof profile.dob === "string" ? profile.dob.slice(0, 10) : new Date(profile.dob).toISOString().slice(0, 10)) : ""}
                    onChange={(e) => setField("dob", e.target.value)}
                    className={INPUT_CLS} style={inputStyle("dob")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Gender</label>
                  <select value={profile.gender ?? ""} onChange={(e) => setField("gender", e.target.value || null)} className={INPUT_CLS} style={inputStyle("gender")}>
                    <option value="" disabled>Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              {/* ── Location ── */}
              <SectionHeader icon={MapPin} title="Location" />

              <div className="grid grid-cols-3 gap-3">
                <div data-field-error={errors.state ? true : undefined}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>State *</label>
                  <select
                    value={states.find((s) => s.name === profile.state)?.isoCode ?? ""}
                    onChange={(e) => {
                      const s = states.find((st) => st.isoCode === e.target.value);
                      if (!s) return;
                      setField("state", s.name);
                      setSelectedStateCode(s.isoCode);
                      setField("city", "");
                    }}
                    className={INPUT_CLS} style={inputStyle("state")}
                  >
                    <option value="">Select state…</option>
                    {states.map((s) => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
                  </select>
                  <FieldError error={errors.state} />
                </div>
                <div data-field-error={errors.city ? true : undefined}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>City *</label>
                  <select
                    value={profile.city ?? ""}
                    onChange={(e) => setField("city", e.target.value)}
                    className={INPUT_CLS} style={inputStyle("city")}
                    disabled={!selectedStateCode}
                  >
                    <option value="">{selectedStateCode ? "Select city…" : "Select state first"}</option>
                    {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <FieldError error={errors.city} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Pincode</label>
                  <input value={profile.pincode ?? ""} onChange={(e) => setField("pincode", e.target.value)} placeholder="600001" className={INPUT_CLS} style={inputStyle("pincode")} />
                </div>
              </div>

              {/* ── Business ── */}
              <SectionHeader icon={Building2} title="Business Details" />

              <div className="grid grid-cols-2 gap-3">
                <div data-field-error={errors.businessName ? true : undefined}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Brand Name *</label>
                  <input value={profile.businessName ?? ""} onChange={(e) => setField("businessName", e.target.value)} className={INPUT_CLS} style={inputStyle("businessName")} />
                  <FieldError error={errors.businessName} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Established On</label>
                  <input
                    type="date"
                    value={profile.businessEstablishedOn ? (typeof profile.businessEstablishedOn === "string" ? profile.businessEstablishedOn.slice(0, 10) : new Date(profile.businessEstablishedOn).toISOString().slice(0, 10)) : ""}
                    onChange={(e) => setField("businessEstablishedOn", e.target.value)}
                    className={INPUT_CLS} style={inputStyle("businessEstablishedOn")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div data-field-error={errors.productServiceType ? true : undefined}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Business Type *</label>
                  <select value={profile.productServiceType ?? ""} onChange={(e) => setField("productServiceType", e.target.value || null)} className={INPUT_CLS} style={inputStyle("productServiceType")}>
                    <option value="" disabled>Select…</option>
                    <option value="Product-based">Product-based</option>
                    <option value="Service-based">Service-based</option>
                    <option value="Both">Both</option>
                    <option value="Other">Other</option>
                  </select>
                  <FieldError error={errors.productServiceType} />
                </div>
                <div data-field-error={errors.businessStartedFrom ? true : undefined}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Business Started From *</label>
                  <input value={profile.businessStartedFrom ?? ""} onChange={(e) => setField("businessStartedFrom", e.target.value)} placeholder="e.g. 2019 or Yet to Start" className={INPUT_CLS} style={inputStyle("businessStartedFrom")} />
                  <FieldError error={errors.businessStartedFrom} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div data-field-error={errors.teamSize ? true : undefined}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Team Size *</label>
                  <input value={profile.teamSize ?? ""} onChange={(e) => setField("teamSize", e.target.value)} placeholder="e.g. 5" className={INPUT_CLS} style={inputStyle("teamSize")} />
                  <FieldError error={errors.teamSize} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Website URL</label>
                  <input value={profile.websiteUrl ?? ""} onChange={(e) => setField("websiteUrl", e.target.value)} placeholder="https://yourbrand.com" className={INPUT_CLS} style={inputStyle("websiteUrl")} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Business Address</label>
                <textarea
                  value={profile.businessAddress ?? ""}
                  onChange={(e) => setField("businessAddress", e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl text-sm text-foreground outline-none resize-none transition-colors"
                  style={inputStyle("businessAddress")}
                />
              </div>

              {/* ── Revenue & Goals ── */}
              <SectionHeader icon={TrendingUp} title="Revenue & Goals" />

              <div className="grid grid-cols-2 gap-3">
                <div data-field-error={errors.annualTurnover ? true : undefined}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Revenue Until Now *</label>
                  <select value={profile.annualTurnover ?? ""} onChange={(e) => setField("annualTurnover", e.target.value || null)} className={INPUT_CLS} style={inputStyle("annualTurnover")}>
                    <option value="" disabled>Select…</option>
                    {ANNUAL_TURNOVER_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <FieldError error={errors.annualTurnover} />
                </div>
                <div data-field-error={errors.revenueGoalAfterTbt ? true : undefined}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Revenue Goal After TBT *</label>
                  <input value={profile.revenueGoalAfterTbt ?? ""} onChange={(e) => setField("revenueGoalAfterTbt", e.target.value)} placeholder="e.g. 1Cr in 12 months" className={INPUT_CLS} style={inputStyle("revenueGoalAfterTbt")} />
                  <FieldError error={errors.revenueGoalAfterTbt} />
                </div>
              </div>

              <div data-field-error={errors.goalAfter90Days ? true : undefined}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Learning Goals *</label>
                <input value={profile.goalAfter90Days ?? ""} onChange={(e) => setField("goalAfter90Days", e.target.value)} placeholder="What do you want to achieve in 90 days?" className={INPUT_CLS} style={inputStyle("goalAfter90Days")} />
                <FieldError error={errors.goalAfter90Days} />
              </div>

              {/* Preferred session mode */}
              <div data-field-error={errors.preferredSessionMode ? true : undefined}>
                <label className="block text-xs font-medium mb-2.5" style={{ color: "var(--color-text-subtle)" }}>Preferred Session Mode *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["offline", "online", "hybrid"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setField("preferredSessionMode", mode)}
                      className="py-3 rounded-xl text-sm font-semibold border-2 transition-all capitalize"
                      style={toggleStyle(profile.preferredSessionMode === mode, !!errors.preferredSessionMode)}
                    >
                      {mode === "hybrid" ? "Both" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                <FieldError error={errors.preferredSessionMode} />
              </div>

              {/* ── Social Media ── */}
              <SectionHeader icon={Instagram} title="Social Media" />

              <div data-field-error={errors.instagramLink ? true : undefined}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Instagram Link *</label>
                <input value={profile.instagramLink ?? ""} onChange={(e) => setField("instagramLink", e.target.value)} placeholder="@username or profile URL" className={INPUT_CLS} style={inputStyle("instagramLink")} />
                <FieldError error={errors.instagramLink} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div data-field-error={errors.instagramStats ? true : undefined}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Instagram Posts & Followers *</label>
                  <input value={profile.instagramStats ?? ""} onChange={(e) => setField("instagramStats", e.target.value)} placeholder="e.g. 120 posts, 4.2K followers" className={INPUT_CLS} style={inputStyle("instagramStats")} />
                  <FieldError error={errors.instagramStats} />
                </div>
                <div data-field-error={errors.facebookStats ? true : undefined}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Facebook Posts & Followers *</label>
                  <input value={profile.facebookStats ?? ""} onChange={(e) => setField("facebookStats", e.target.value)} placeholder="e.g. 80 posts, 2K followers" className={INPUT_CLS} style={inputStyle("facebookStats")} />
                  <FieldError error={errors.facebookStats} />
                </div>
              </div>

              {/* ── Marketing & Operations ── */}
              <SectionHeader icon={Megaphone} title="Marketing & Operations" />

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: "var(--color-text-subtle)" }}>Existing Marketing Channels</label>
                <div className="flex flex-wrap gap-2">
                  {MARKETING_CHANNELS.map((channel) => {
                    const active = ((profile.marketingChannels as string[]) || []).includes(channel);
                    return (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => toggleMarketingChannel(channel)}
                        className="px-4 py-2 rounded-full text-sm font-medium border-2 transition-all"
                        style={toggleStyle(active)}
                      >
                        {channel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Marketing Channel Name</label>
                <input value={profile.marketingChannelName ?? ""} onChange={(e) => setField("marketingChannelName", e.target.value)} placeholder="e.g. Facebook Ads account name" className={INPUT_CLS} style={inputStyle("marketingChannelName")} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Domain & Hosting Details</label>
                <input value={profile.domainHostingDetails ?? ""} onChange={(e) => setField("domainHostingDetails", e.target.value)} placeholder="Provider, expiry dates, etc." className={INPUT_CLS} style={inputStyle("domainHostingDetails")} />
              </div>

              {/* Social media handling */}
              <div data-field-error={errors.hasMarketingTeam ? true : undefined}>
                <label className="block text-xs font-medium mb-2.5" style={{ color: "var(--color-text-subtle)" }}>Social Media Handling *</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {([{ label: "In-house", val: true }, { label: "Outsourced / None", val: false }] as const).map(({ label, val }) => (
                    <button key={label} type="button" onClick={() => setField("hasMarketingTeam", val)}
                      className="py-3 rounded-xl text-sm font-semibold border-2 transition-all"
                      style={toggleStyle(profile.hasMarketingTeam === val, !!errors.hasMarketingTeam)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <FieldError error={errors.hasMarketingTeam} />
                {profile.hasMarketingTeam && (
                  <input value={profile.marketingTeamDetails ?? ""} onChange={(e) => setField("marketingTeamDetails", e.target.value)} placeholder="Describe your social media team or agency" className={INPUT_CLS} style={inputStyle("marketingTeamDetails")} />
                )}
              </div>

              {/* Video editing */}
              <div data-field-error={errors.hasVideoEditing ? true : undefined}>
                <label className="block text-xs font-medium mb-2.5" style={{ color: "var(--color-text-subtle)" }}>Video Editing Capability *</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {([{ label: "Yes", val: true }, { label: "No", val: false }] as const).map(({ label, val }) => (
                    <button key={label} type="button" onClick={() => setField("hasVideoEditing", val)}
                      className="py-3 rounded-xl text-sm font-semibold border-2 transition-all"
                      style={toggleStyle(profile.hasVideoEditing === val, !!errors.hasVideoEditing)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <FieldError error={errors.hasVideoEditing} />
                {profile.hasVideoEditing && (
                  <input value={profile.videoEditingDetails ?? ""} onChange={(e) => setField("videoEditingDetails", e.target.value)} placeholder="In-house, outsourced, or tools used" className={INPUT_CLS} style={inputStyle("videoEditingDetails")} />
                )}
              </div>

              {/* ── Compliance ── */}
              <SectionHeader icon={Shield} title="Compliance & Challenges" />

              <div data-field-error={errors.gstNumber ? true : undefined}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>GST Number *</label>
                <input value={profile.gstNumber ?? ""} onChange={(e) => setField("gstNumber", e.target.value)} placeholder="22AAAAA0000A1Z5" className={INPUT_CLS} style={inputStyle("gstNumber")} />
                <FieldError error={errors.gstNumber} />
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: "var(--color-text-subtle)" }}>Key Challenges</label>
                <div className="space-y-2.5">
                  {[
                    { key: "challenge1", placeholder: "Primary business obstacle" },
                    { key: "challenge2", placeholder: "Secondary concern" },
                    { key: "challenge3", placeholder: "Other support needed" },
                  ].map(({ key, placeholder }, i) => (
                    <div key={key} className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{ background: OVERLAY, color: "var(--color-text-subtle)" }}
                      >
                        {i + 1}
                      </div>
                      <input value={profile[key] ?? ""} onChange={(e) => setField(key, e.target.value)} placeholder={placeholder} className={cn(INPUT_CLS, "flex-1")} style={inputStyle(key)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {/* ── Skills ── */}
        {step === "skills" && (
          <StepShell
            title="Your skills & learning goals"
            subtitle="Rate your current skill levels honestly — this helps us personalize your journey."
            onBack={prevStep ? () => setStep(prevStep) : undefined}
            onNext={() => saveAndAdvance(nextStep ?? "review")}
            saving={saveProgress.isPending}
          >
            <div className="space-y-8">
              {/* Website */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">Do you have a website?</p>
                <div className="flex gap-3">
                  {([{ label: "Yes", val: true }, { label: "No", val: false }] as const).map(({ label, val }) => (
                    <button key={label} type="button" onClick={() => setField("hasWebsite", val)}
                      className="px-8 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                      style={toggleStyle(profile.hasWebsite === val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {profile.hasWebsite === true && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Weekly orders from your website</label>
                  <input
                    type="number" min={0}
                    value={profile.weeklyWebsiteOrders ?? ""}
                    onChange={(e) => setField("weeklyWebsiteOrders", e.target.value === "" ? undefined : Number(e.target.value))}
                    placeholder="e.g. 50"
                    className={INPUT_CLS}
                    style={{ background: OVERLAY, border: `1.5px solid ${BORDER}` }}
                  />
                </div>
              )}

              {/* Skill sliders */}
              <div
                className="p-5 rounded-2xl space-y-6"
                style={{ background: OVERLAY, border: `1px solid ${BORDER}` }}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">Rate your skills</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle)" }}>Tap a segment to set your level · 1 = Beginner · 10 = Expert</p>
                </div>
                {SKILL_FIELDS.map(({ key, label }) => (
                  <SegmentedSkillSlider
                    key={key}
                    label={label}
                    value={typeof profile[key] === "number" ? profile[key] : 1}
                    onChange={(v) => setField(key, v)}
                  />
                ))}
              </div>

              {/* Learning hours */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-foreground">Hours per week for learning</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: "var(--color-accent)" }}>
                      {typeof profile.weeklyLearningHours === "number" ? profile.weeklyLearningHours : 5}
                    </span>
                    <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>hrs</span>
                  </div>
                </div>
                <input
                  type="range" min={5} max={80} step={5}
                  value={typeof profile.weeklyLearningHours === "number" ? profile.weeklyLearningHours : 5}
                  onChange={(e) => setField("weeklyLearningHours", Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "var(--color-accent)" }}
                />
                <div className="flex justify-between text-xs mt-1.5" style={{ color: "var(--color-text-subtle)" }}>
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
            subtitle="We need at least one document to verify your identity or business."
            onBack={prevStep ? () => setStep(prevStep) : undefined}
            onNext={() => setStep(nextStep ?? "review")}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-subtle)" }}>Document Type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className={INPUT_CLS}
                  style={{ background: OVERLAY, border: `1.5px solid ${BORDER}` }}
                >
                  {DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              {/* Upload zone */}
              <label
                className={cn(
                  "flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all py-10 gap-3",
                  uploading ? "opacity-60 pointer-events-none" : "hover:border-[var(--color-accent)]"
                )}
                style={{ borderColor: BORDER, background: OVERLAY }}
              >
                {uploading ? (
                  <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
                ) : (
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: "color-mix(in srgb, var(--color-accent) 10%, transparent)" }}
                  >
                    <Upload size={22} style={{ color: "var(--color-accent)" }} />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {uploading ? "Uploading…" : "Click to upload"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle)" }}>
                    PDF, JPG or PNG · Max 50 MB
                  </p>
                </div>
                <input
                  type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); e.target.value = ""; }}
                />
              </label>

              {/* Uploaded docs */}
              {initialDocuments.length > 0 && (
                <ul className="space-y-2">
                  {initialDocuments.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl"
                      style={{ background: OVERLAY, border: `1px solid ${BORDER}` }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "color-mix(in srgb, var(--color-success, #22c55e) 12%, transparent)" }}
                      >
                        <CheckCircle2 size={15} style={{ color: "var(--color-success, #22c55e)" }} />
                      </div>
                      <span className="flex-1 text-sm font-medium text-foreground capitalize">
                        {doc.documentType.replace(/_/g, " ")}
                      </span>
                      <button
                        onClick={() => deleteDoc.mutate(doc.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                        style={{ background: "color-mix(in srgb, var(--color-alert, #ef4444) 10%, transparent)" }}
                      >
                        <Trash2 size={13} style={{ color: "var(--color-alert, #ef4444)" }} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </StepShell>
        )}

        {/* ── Review & Submit ── */}
        {step === "review" && (
          <div className="p-6 md:p-8">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-foreground mb-2">Review & Submit</h2>
              <p className="text-sm mb-7" style={{ color: "var(--color-text-secondary)" }}>
                Double-check your details before submitting for admin review.
              </p>

              {/* Profile summary card */}
              {(profile.firstName || profile.profilePhotoUrl) && (
                <div
                  className="flex items-center gap-4 p-4 rounded-2xl mb-5"
                  style={{ background: "color-mix(in srgb, var(--color-accent) 6%, transparent)", border: `1px solid color-mix(in srgb, var(--color-accent) 18%, transparent)` }}
                >
                  <div
                    className="w-14 h-14 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                    style={{ background: OVERLAY }}
                  >
                    {profile.profilePhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.profilePhotoUrl as string} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <Users size={22} className="text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{[profile.firstName, profile.lastName].filter(Boolean).join(" ")}</p>
                    <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{profile.businessName}</p>
                    {(profile.city || profile.state) && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle)" }}>{[profile.city, profile.state].filter(Boolean).join(", ")}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Field list */}
              <div
                className="rounded-2xl overflow-hidden mb-5"
                style={{ border: `1px solid ${BORDER}` }}
              >
                {Object.entries(profile)
                  .filter(([k, v]) => v && k !== "profilePhotoUrl" && !k.startsWith("challenge") && k !== "marketingChannels")
                  .map(([key, value], i, arr) => (
                    <div
                      key={key}
                      className="flex justify-between gap-4 px-4 py-3 text-sm"
                      style={{ borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : undefined }}
                    >
                      <span className="text-xs capitalize shrink-0 pt-0.5" style={{ color: "var(--color-text-subtle)" }}>
                        {key.replace(/([A-Z])/g, " $1")}
                      </span>
                      <span className="text-foreground text-right break-all">{String(value)}</span>
                    </div>
                  ))}
                {((profile.marketingChannels as string[]) || []).length > 0 && (
                  <div className="flex justify-between gap-4 px-4 py-3 text-sm" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <span className="text-xs pt-0.5" style={{ color: "var(--color-text-subtle)" }}>Marketing Channels</span>
                    <span className="text-foreground text-right">{(profile.marketingChannels as string[]).join(", ")}</span>
                  </div>
                )}
                {([profile.challenge1, profile.challenge2, profile.challenge3].filter(Boolean) as string[]).length > 0 && (
                  <div className="px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <p className="text-xs mb-2" style={{ color: "var(--color-text-subtle)" }}>Key Challenges</p>
                    {([profile.challenge1, profile.challenge2, profile.challenge3].filter(Boolean) as string[]).map((c, i) => (
                      <p key={i} className="text-sm text-foreground">{i + 1}. {c}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Document count */}
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5"
                style={{
                  background: initialDocuments.length > 0
                    ? "color-mix(in srgb, var(--color-success, #22c55e) 8%, transparent)"
                    : "color-mix(in srgb, var(--color-alert, #ef4444) 8%, transparent)",
                  border: `1px solid ${initialDocuments.length > 0
                    ? "color-mix(in srgb, var(--color-success, #22c55e) 20%, transparent)"
                    : "color-mix(in srgb, var(--color-alert, #ef4444) 20%, transparent)"}`,
                }}
              >
                {initialDocuments.length > 0 ? (
                  <CheckCircle2 size={16} style={{ color: "var(--color-success, #22c55e)" }} />
                ) : (
                  <XCircle size={16} style={{ color: "var(--color-alert, #ef4444)" }} />
                )}
                <span className="text-sm font-medium text-foreground">
                  {initialDocuments.length > 0
                    ? `${initialDocuments.length} document${initialDocuments.length > 1 ? "s" : ""} uploaded`
                    : "No document uploaded — please go back and upload one"}
                </span>
              </div>

              {!readyToSubmit && missingFields.length > 0 && (
                <p className="text-sm mb-5 px-4 py-3 rounded-xl" style={{ background: "color-mix(in srgb, var(--color-alert, #ef4444) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--color-alert, #ef4444) 20%, transparent)", color: "var(--color-alert, #ef4444)" }}>
                  Please fill in: {missingFields.join(", ")}
                </p>
              )}

              <div className="flex justify-between items-center pt-5 border-t" style={{ borderColor: BORDER }}>
                <button
                  onClick={() => setStep(prevStep ?? "documents")}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!readyToSubmit || submit.isPending}
                  className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                  style={{
                    background: "var(--color-accent)",
                    boxShadow: "0 4px 18px color-mix(in srgb, var(--color-accent) 35%, transparent)",
                  }}
                >
                  {submit.isPending && (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  Submit for Approval
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { data: state, isLoading } = useOnboardingState();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-muted-foreground/20 border-t-[var(--color-accent)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Something went wrong. Please refresh.</p>
      </div>
    );
  }

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

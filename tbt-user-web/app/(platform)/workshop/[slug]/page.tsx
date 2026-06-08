"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Lock,
  Star,
  Video,
  FileText,
  Trophy,
  RotateCcw,
  Play,
  Pause,
  Loader2,
  GraduationCap,
  Download,
  X,
} from "lucide-react";
import {
  useWorkshopDetail,
  useWorkshopFlow,
  useWorkshopQa,
  usePostQa,
  usePostQaReply,
  useWorkshopAssignments,
  useSubmitAssignment,
  useWorkshopChallenges,
  useCompleteChallenge,
  useCompleteWorkshopEpisode,
  usePostEpisodeProgress,
  useWorkshopCertificate,
} from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket/client";
import { cn } from "@/lib/utils/cn";
import { getServerNow, getCachedTokenSync } from "@/lib/api/client";
import { normalizeBunnyUrl, withResumeTime } from "@/lib/utils/format";
import { VideoWatermark } from "@/components/features/video/VideoWatermark";
import type {
  WorkshopFlowItem,
  WorkshopTab,
  LearningProgress,
  WorkshopCertificate,
  WorkshopAssignment,
  QAPost,
  QAReply,
} from "@/types";

// ─── Countdown ────────────────────────────────────────────────────────────────

function Countdown({
  scheduledAt,
  config,
}: {
  scheduledAt: string;
  config: { stayTunedMessage: string; stayTunedColor: string };
}) {
  const { uiStrings } = useSiteConfig();
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    const target = new Date(scheduledAt).getTime();
    const tick = () => setDiff(Math.max(0, target - getServerNow()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  const units = [
    [Math.floor(diff / 86400000), uiStrings?.countdownDays],
    [Math.floor((diff % 86400000) / 3600000), uiStrings?.countdownHours],
    [Math.floor((diff % 3600000) / 60000), uiStrings?.countdownMins],
    [Math.floor((diff % 60000) / 1000), uiStrings?.countdownSecs],
  ] as [number, string | undefined][];

  return (
    <div className="text-center py-8 px-4">
      <div className="flex gap-4 justify-center mb-5">
        {units.map(([val, label], i) => (
          <div key={i} className="flex flex-col items-center min-w-[52px]">
            <span
              className="text-4xl font-bold font-mono tabular-nums leading-none"
              style={{ color: "var(--color-accent)" }}
            >
              {String(val).padStart(2, "0")}
            </span>
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground mt-1.5 uppercase">
              {label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-sm" style={{ color: config.stayTunedColor }}>
        {config.stayTunedMessage}
      </p>
    </div>
  );
}

// ─── Main Area: Live Call Countdown ──────────────────────────────────────────
// Pure black background, centered layout, date label in teal, monospace digits.

function MainAreaCountdown({ item }: { item: WorkshopFlowItem }) {
  const { uiStrings } = useSiteConfig();
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    if (!item.scheduledAt) return;
    const target = new Date(item.scheduledAt).getTime();
    const tick = () => setDiff(Math.max(0, target - getServerNow()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [item.scheduledAt]);

  if (!item.scheduledAt || !item.countdownConfig) return null;

  const teal = item.countdownConfig.stayTunedColor || "#2dd4bf";

  const units = [
    [Math.floor(diff / 86400000), uiStrings?.countdownDays ?? "DAYS"],
    [Math.floor((diff % 86400000) / 3600000), uiStrings?.countdownHours ?? "HOURS"],
    [Math.floor((diff % 3600000) / 60000), uiStrings?.countdownMins ?? "MINS"],
    [Math.floor((diff % 60000) / 1000), uiStrings?.countdownSecs ?? "SECS"],
  ] as [number, string][];

  const dateLabel = new Date(item.scheduledAt)
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    .toUpperCase();

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col items-center justify-center text-center py-12 px-6 space-y-6"
      style={{ background: "#000", minHeight: 300 }}
    >
      {/* LIVE CALL label */}
      {item.label && (
        <p
          className="text-xs font-bold uppercase tracking-[0.2em]"
          style={{ color: item.labelColor ?? "var(--color-alert)" }}
        >
          {item.label}
        </p>
      )}

      {/* Call title */}
      {item.title && (
        <h2 className="text-xl md:text-2xl font-bold text-white leading-snug max-w-md -mt-3">
          {item.title}
        </h2>
      )}

      {/* Countdown digits */}
      <div className="flex gap-5 md:gap-8">
        {units.map(([val, label], i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-4xl md:text-5xl font-bold tabular-nums text-white font-mono leading-none">
              {String(val).padStart(2, "0")}
            </span>
            <span
              className="text-[10px] font-bold tracking-[0.2em] mt-2 uppercase"
              style={{ color: teal }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Date label — "JUNE 2, 2026" in teal small-caps */}
      <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: teal }}>
        {dateLabel}
      </p>

      {/* Stay tuned message */}
      {item.countdownConfig.stayTunedMessage && (
        <p className="text-sm italic max-w-sm -mt-3" style={{ color: teal }}>
          {item.countdownConfig.stayTunedMessage}
        </p>
      )}

      {/* Join button — only when liveUrl is unlocked */}
      {item.liveUrl && (
        <a
          href={item.liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-bold text-white"
          style={{ background: "var(--color-accent)" }}
        >
          {uiStrings?.liveCallJoinLabel}
        </a>
      )}
    </div>
  );
}

// ─── Main Area: Assignment (form + submitted review) ─────────────────────────

function renderAnswerText(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const isNumbered = lines.length > 1 && lines.every((l) => /^\d+[.)]\s/.test(l));
  if (isNumbered) {
    return (
      <ol className="list-decimal list-inside space-y-2">
        {lines.map((l, i) => (
          <li key={i} className="text-sm text-foreground leading-relaxed">
            {l.replace(/^\d+[.)]\s*/, "")}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{text}</p>
  );
}

function AssignmentMainView({
  assignmentId,
  slug,
  onBack,
}: {
  assignmentId: string;
  slug: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const { data } = useWorkshopAssignments(slug);
  const submit = useSubmitAssignment();
  const [answer, setAnswer] = useState("");

  const assignment = data?.groups
    .flatMap((g) => g.assignments)
    .find((a) => a.id === assignmentId);

  if (!assignment) return null;

  const sub = assignment.submission;
  const isSubmitted = !!sub?.isSubmitted;

  // ── Submitted: show answer review ──
  if (isSubmitted) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={13} />
          {sub.backLabel ?? "Back"}
        </button>

        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} style={{ color: "var(--color-success)" }} />
          <h3 className="font-bold text-sm text-amber-500">{assignment.title}</h3>
        </div>

        {sub.yourAnswerLabel && (
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {sub.yourAnswerLabel}
          </p>
        )}

        <div className="rounded-lg border border-border bg-card p-4">
          {sub.answerText ? renderAnswerText(sub.answerText) : null}
        </div>
      </div>
    );
  }

  // ── Not yet submitted: show question + answer form ──
  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft size={13} />
        {assignment.cancelLabel}
      </button>

      <div className="flex items-center gap-1.5">
        <FileText size={14} style={{ color: "var(--color-accent)" }} className="flex-shrink-0" />
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--color-accent)" }}
        >
          {assignment.typeLabel}
        </span>
      </div>

      <h3 className="font-semibold text-foreground text-base leading-snug">{assignment.title}</h3>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={6}
        className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring resize-none transition-colors"
      />

      <div className="flex gap-2">
        <button
          onClick={async () => {
            if (!answer.trim()) return;
            try {
              await submit.mutateAsync({ id: assignment.id, answerText: answer });
              setAnswer("");
              // Refetch assignments (sidebar + this view both update) and flow (progress bar)
              qc.invalidateQueries({ queryKey: ["workshop-assignments", slug] });
              qc.invalidateQueries({ queryKey: ["workshop-flow", slug] });
            } catch {
              // mutation failed — user can retry
            }
          }}
          disabled={submit.isPending || !answer.trim()}
          className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-60 transition-opacity"
          style={{ background: "var(--color-accent)" }}
        >
          {assignment.submitLabel}
        </button>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/10 transition-colors"
        >
          {assignment.cancelLabel}
        </button>
      </div>
    </div>
  );
}



// ─── Sidebar: Learning Progress Widget (collapsible) ─────────────────────────

function LearningProgressWidget({ progress }: { progress: LearningProgress | null }) {
  const [open, setOpen] = useState(true);

  if (!progress || progress.totalCount === 0) return null;

  const pct: number = progress.percentage ?? 0;
  const milestones: boolean[] = progress.milestones?.map((m) => !!m.achieved) ?? [
    pct >= 33,
    pct >= 66,
    pct >= 100,
  ];

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/5 transition-colors"
      >
        <span className="text-sm font-medium text-foreground">
          {progress.label}{" "}
          <span
            className="font-bold tabular-nums"
            style={{ color: "var(--color-accent)" }}
          >
            {pct}%
          </span>
        </span>
        {open ? (
          <ChevronUp size={14} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Star milestone markers */}
          <div className="flex gap-1.5">
            {milestones.map((filled, i) => (
              <Star
                key={i}
                size={14}
                className={filled ? "" : "text-muted-foreground"}
                style={filled ? { color: "var(--color-accent)", fill: "var(--color-accent)" } : {}}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "var(--color-accent)" }}
            />
          </div>

          {/* Count */}
          <p className="text-xs text-muted-foreground tabular-nums">
            {progress.completedCount} / {progress.totalCount}{" "}
            {progress.completedLabel ?? "Completed"}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar: Certificate Card ───────────────────────────────────────────────

function CertificateCard({ cert, slug }: { cert: WorkshopCertificate; slug: string }) {
  const [showModal, setShowModal] = useState(false);
  const { refetch, data: certDetails, isFetching } = useWorkshopCertificate(slug);

  const handleDownload = async () => {
    const result = await refetch();
    if (result.data) setShowModal(true);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!cert.eligible) {
    // Not yet eligible — show progress toward certificate
    const allDone = cert.videosCompletedPct === 100 && cert.challengesCompletedPct === 100;
    if (allDone) return null; // eligible === true would show, so this shouldn't fire

    return (
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2.5">
          <GraduationCap size={15} className="text-muted-foreground flex-shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground">Certificate Progress</span>
        </div>
        <div className="px-4 pb-4 space-y-2.5">
          {/* Videos bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Videos</span>
              <span
                className="text-[10px] font-bold tabular-nums"
                style={{ color: cert.videosCompletedPct === 100 ? "var(--color-success)" : "var(--color-accent)" }}
              >
                {cert.videosCompletedPct}%
              </span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${cert.videosCompletedPct}%`,
                  background: cert.videosCompletedPct === 100 ? "var(--color-success)" : "var(--color-accent)",
                }}
              />
            </div>
          </div>
          {/* Challenges bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Challenges</span>
              <span
                className="text-[10px] font-bold tabular-nums"
                style={{ color: cert.challengesCompletedPct === 100 ? "var(--color-success)" : "var(--color-accent)" }}
              >
                {cert.challengesCompletedPct}%
              </span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${cert.challengesCompletedPct}%`,
                  background: cert.challengesCompletedPct === 100 ? "var(--color-success)" : "var(--color-accent)",
                }}
              />
            </div>
          </div>
          {/* What's left */}
          {(cert.remainingVideos > 0 || cert.remainingChallenges > 0) && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {cert.remainingVideos > 0 && `${cert.remainingVideos} video${cert.remainingVideos > 1 ? "s" : ""} remaining`}
              {cert.remainingVideos > 0 && cert.remainingChallenges > 0 && " · "}
              {cert.remainingChallenges > 0 && `${cert.remainingChallenges} challenge${cert.remainingChallenges > 1 ? "s" : ""} remaining`}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Eligible — certificate unlocked
  return (
    <>
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: "color-mix(in srgb, var(--color-success) 6%, var(--color-bg-surface))",
          borderColor: "color-mix(in srgb, var(--color-success) 35%, transparent)",
        }}
      >
        <div className="px-4 pt-4 pb-3 flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--color-success) 18%, transparent)" }}
          >
            <GraduationCap size={18} style={{ color: "var(--color-success)" }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight" style={{ color: "var(--color-success)" }}>
              🎓 Certificate Ready
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              You've completed all videos and challenges
            </p>
          </div>
        </div>

        {/* Two ticks */}
        <div className="px-4 pb-3 space-y-1.5">
          {[
            { label: "Videos", pct: cert.videosCompletedPct },
            { label: "Challenges", pct: cert.challengesCompletedPct },
          ].map(({ label, pct }) => (
            <div key={label} className="flex items-center gap-2">
              <CheckCircle2 size={11} style={{ color: "var(--color-success)" }} className="flex-shrink-0" />
              <span className="text-[10px] text-muted-foreground flex-1">{label}</span>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: "var(--color-success)" }}>
                {pct}%
              </span>
            </div>
          ))}
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={handleDownload}
            disabled={isFetching}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold text-white transition-opacity disabled:opacity-60"
            style={{ background: "var(--color-success)" }}
          >
            {isFetching ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            {isFetching ? "Loading…" : "Download Certificate"}
          </button>
        </div>
      </div>

      {/* Certificate Modal */}
      {showModal && certDetails && (
        <CertificateModal details={certDetails} onClose={() => setShowModal(false)} onPrint={handlePrint} />
      )}
    </>
  );
}

// ─── Certificate Modal (print-ready) ─────────────────────────────────────────

function CertificateModal({
  details,
  onClose,
  onPrint,
}: {
  details: import("@/types").CertificateDetails;
  onClose: () => void;
  onPrint: () => void;
}) {
  const completedDate = new Date(details.completedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 print:p-0"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl print:rounded-none print:shadow-none print:max-w-none"
        style={{ background: "var(--color-bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button (hidden on print) */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors print:hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <X size={16} />
        </button>

        {/* Certificate content */}
        <div
          className="relative p-10 text-center space-y-5"
          style={{
            background: "linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(0,0,0,0) 60%)",
            borderTop: "4px solid var(--color-success)",
          }}
        >
          {/* Seal */}
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: "color-mix(in srgb, var(--color-success) 15%, transparent)",
                border: "2px solid var(--color-success)",
              }}
            >
              <GraduationCap size={30} style={{ color: "var(--color-success)" }} />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              Certificate of Completion
            </p>
            <p className="text-[10px] text-muted-foreground">Tamil Business Tribe</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">This certifies that</p>
            <p className="text-2xl font-bold text-foreground">{details.memberName}</p>
            <p className="text-xs text-muted-foreground">has successfully completed</p>
          </div>

          <p
            className="text-lg font-bold leading-snug max-w-md mx-auto"
            style={{ color: "var(--color-accent)" }}
          >
            {details.workshopTitle}
          </p>

          <p className="text-xs text-muted-foreground">
            Completed on <span className="font-semibold text-foreground">{completedDate}</span>
          </p>

          {/* Certificate ID */}
          <p className="text-[9px] font-mono text-muted-foreground tracking-wider">
            Certificate ID: {details.certificateId}
          </p>

          {/* Divider */}
          <div
            className="h-px w-24 mx-auto"
            style={{ background: "color-mix(in srgb, var(--color-success) 40%, transparent)" }}
          />
        </div>

        {/* Actions (hidden on print) */}
        <div className="px-8 pb-6 flex items-center justify-center gap-3 print:hidden">
          <button
            onClick={onPrint}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white"
            style={{ background: "var(--color-success)" }}
          >
            <Download size={14} />
            Save / Print
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Sidebar: Q&A Tab ─────────────────────────────────────────────────────────

function QaAvatar({ avatarUrl, name, size = 7 }: { avatarUrl?: string | null; name?: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full flex-shrink-0`;
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name ?? ""} className={`${cls} object-cover`} />;
  }
  return (
    <div className={`${cls} bg-muted flex items-center justify-center text-xs font-bold`}>
      {name?.[0]}
    </div>
  );
}

function QaTab({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data: d, isLoading } = useWorkshopQa(slug, page);
  const postQa = usePostQa();
  const postReply = usePostQaReply();
  const { uiStrings } = useSiteConfig();
  const [text, setText] = useState("");
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await postQa.mutateAsync({ slug, questionText: text.trim() });
      setText("");
      setPage(1); // jump to page 1 so the new question is visible at the top
      qc.invalidateQueries({ queryKey: ["workshop-qa", slug] });
    } catch {
      // mutation failed — isPending resets automatically, text preserved for retry
    }
  };

  const handleReply = async (postId: string) => {
    const rt = replyTexts[postId]?.trim();
    if (!rt) return;
    try {
      await postReply.mutateAsync({ postId, replyText: rt });
      setReplyTexts((prev) => ({ ...prev, [postId]: "" }));
      setReplyOpen((prev) => ({ ...prev, [postId]: false }));
      qc.invalidateQueries({ queryKey: ["workshop-qa", slug] });
    } catch {
      // mutation failed — isPending resets automatically, reply text preserved
    }
  };

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">{uiStrings?.qaLoadingLabel}</p>;
  }

  const pagination = d?.pagination;
  const totalPages = Math.ceil((pagination?.total ?? 0) / (pagination?.limit ?? 20));
  const hasPrev = (pagination?.page ?? 1) > 1;
  const hasNext = (pagination?.page ?? 1) < totalPages;

  return (
    <div className="space-y-5">
      {/* Ask form */}
      <div>
        <h3 className="font-bold text-sm text-foreground mb-1">
          {d?.headingHighlight
            ? d.heading?.replace(d.headingHighlight, "")
            : d?.heading}
          {d?.headingHighlight && (
            <span style={{ color: "var(--color-accent)" }}>{d.headingHighlight}</span>
          )}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">{d?.promptText}</p>
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={d?.inputPlaceholder ?? undefined}
            rows={3}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-ring resize-none transition-colors"
          />
          <button
            type="submit"
            disabled={postQa.isPending}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-60"
            style={{ background: "var(--color-accent)" }}
          >
            {d?.submitLabel}
          </button>
        </form>
      </div>

      {/* Posts list */}
      {d && d.posts.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-xs text-foreground">
            {d.communityHeadingHighlight
              ? d.communityHeading?.replace(d.communityHeadingHighlight, "")
              : d.communityHeading}
            {d.communityHeadingHighlight && (
              <span style={{ color: "var(--color-accent)" }}>
                {d.communityHeadingHighlight}
              </span>
            )}
          </h4>
          {d.posts.map((post: QAPost) => (
            <div key={post.id} className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <QaAvatar avatarUrl={post.author?.avatarUrl} name={post.author?.name} size={6} />
                <span className="text-xs font-medium text-foreground">{post.author?.name}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{post.timeAgo}</span>
              </div>
              <p className="text-xs text-foreground">{post.questionText}</p>
              {post.replies?.length > 0 && (
                <div className="pl-3 border-l-2 border-border space-y-2">
                  {post.replies.map((r: QAReply) => (
                    <div key={r.id} className="flex gap-1.5">
                      <QaAvatar avatarUrl={r.author?.avatarUrl} name={r.author?.name} size={5} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground">{r.author?.name}</p>
                        <p className="text-xs text-foreground">{r.replyText}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!replyOpen[post.id] ? (
                <button
                  onClick={() => setReplyOpen((prev) => ({ ...prev, [post.id]: true }))}
                  className="text-[11px] font-medium"
                  style={{ color: "var(--color-accent)" }}
                >
                  {post.replyLabel}
                </button>
              ) : (
                <div className="flex gap-1.5 pt-1">
                  <input
                    value={replyTexts[post.id] ?? ""}
                    onChange={(e) =>
                      setReplyTexts((prev) => ({ ...prev, [post.id]: e.target.value }))
                    }
                    placeholder={d?.inputPlaceholder ?? undefined}
                    className="flex-1 bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring transition-colors"
                  />
                  <button
                    onClick={() => handleReply(post.id)}
                    disabled={postReply.isPending}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white disabled:opacity-60 flex-shrink-0"
                    style={{ background: "var(--color-accent)" }}
                  >
                    {d?.submitLabel}
                  </button>
                  <button
                    onClick={() => setReplyOpen((prev) => ({ ...prev, [post.id]: false }))}
                    className="text-[11px] text-muted-foreground px-1.5 hover:text-foreground"
                  >
                    {uiStrings?.assignmentCancelLabel}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrev}
            className="text-xs font-medium disabled:opacity-40"
            style={{ color: hasPrev ? "var(--color-accent)" : undefined }}
          >
            {uiStrings?.paginationPrevLabel}
          </button>
          <span className="text-[10px] text-muted-foreground">
            {pagination?.page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className="text-xs font-medium disabled:opacity-40"
            style={{ color: hasNext ? "var(--color-accent)" : undefined }}
          >
            {uiStrings?.paginationNextLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar: Assignments Tab ─────────────────────────────────────────────────

function AssignmentsTab({
  slug,
  onSubmissionView,
}: {
  slug: string;
  onSubmissionView: (assignmentId: string) => void;
}) {
  const { data, isLoading } = useWorkshopAssignments(slug);
  const { uiStrings } = useSiteConfig();

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">{uiStrings?.loading}</p>;
  }

  const groups = data?.groups ?? [];

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.challengeLabel} className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {group.challengeLabel}
          </p>
          {group.assignments.map((a) => {
            const isSubmitted = !!a.submission?.isSubmitted;
            return (
              <div
                key={a.id}
                className="rounded-xl border p-3 space-y-1.5 cursor-pointer hover:bg-accent/5 transition-colors"
                style={!isSubmitted ? { borderColor: "var(--color-accent)" } : undefined}
                onClick={() => onSubmissionView(a.id)}
              >
                {/* Document icon + type label */}
                <div className="flex items-center gap-1.5">
                  <FileText size={12} style={{ color: "var(--color-accent)" }} className="flex-shrink-0" />
                  <p
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {a.typeLabel}
                  </p>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-xs text-foreground leading-snug">{a.title}</p>
                  {isSubmitted && (
                    <CheckCircle2 size={13} style={{ color: "var(--color-success)" }} className="flex-shrink-0 mt-0.5" />
                  )}
                </div>

                {!isSubmitted && (
                  <p className="text-xs font-medium" style={{ color: "var(--color-accent)" }}>
                    {a.ctaLabel}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Live Call URL Unlock Watcher ─────────────────────────────────────────────
// Renders nothing. Sets a setTimeout for each locked live call URL so the flow
// query is refetched exactly when `scheduledAt - liveUrlUnlocksMinutesBefore` arrives.

function LiveCallUnlockWatcher({
  flowItems,
  onUnlock,
}: {
  flowItems: WorkshopFlowItem[];
  onUnlock: () => void;
}) {
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const item of flowItems) {
      if (
        item.type === "live_call" &&
        !item.liveUrl &&
        item.scheduledAt &&
        item.liveUrlUnlocksMinutesBefore
      ) {
        const unlockMs =
          new Date(item.scheduledAt).getTime() -
          item.liveUrlUnlocksMinutesBefore * 60 * 1000;
        const msUntilUnlock = unlockMs - getServerNow();
        if (msUntilUnlock > 0) {
          timers.push(setTimeout(onUnlock, msUntilUnlock));
        }
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [flowItems, onUnlock]);

  return null;
}

// ─── Challenge type metadata ──────────────────────────────────────────────────

const CHALLENGE_TYPE_META: Record<string, { label: string; color: string }> = {
  watch:     { label: "WATCH",     color: "#3b82f6" },
  quiz:      { label: "QUIZ",      color: "#f59e0b" },
  written:   { label: "WRITTEN",   color: "#8b5cf6" },
  matching:  { label: "MATCH",     color: "#ec4899" },
  flashcard: { label: "FLASHCARD", color: "#06b6d4" },
  live_call: { label: "LIVE",      color: "#ff3d8b" },
};

function statusStyle(status: string) {
  switch (status) {
    case "completed":  return { bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.5)",  text: "#22c55e" };
    case "in_progress":return { bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.5)", text: "#ec4899" };
    case "locked":     return { bg: "rgba(60,60,60,0.05)",   border: "rgba(80,80,80,0.2)",   text: "#606060" };
    case "past":       return { bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.5)",  text: "#22c55e" };
    case "upcoming":   return { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.5)", text: "#f59e0b" };
    default:           return { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.5)",  text: "#ef4444" };
  }
}

// ─── Sidebar: Challenge List ──────────────────────────────────────────────────

function ChallengeList({
  slug,
  selectedId,
  onSelect,
}: {
  slug: string;
  selectedId: string | null;
  onSelect: (ch: any) => void;
}) {
  const { data, isLoading } = useWorkshopChallenges(slug);
  const challenges = data?.challenges ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {challenges.map((ch: any) => {
        const isSelected = selectedId === ch.id;

        if (ch.type === "live_call") {
          const lColor = ch.labelColor ?? "#ff3d8b";
          const ss = statusStyle(ch.status);
          return (
            <button
              key={ch.id}
              onClick={() => onSelect(ch)}
              className="w-full text-left rounded-xl border p-3 transition-all"
              style={{
                background: isSelected ? `color-mix(in srgb, var(--color-accent) 12%, transparent)` : ss.bg,
                borderColor: isSelected ? "var(--color-accent)" : ss.border,
              }}
            >
              <div className="flex items-center gap-2">
                <Video size={10} className="flex-shrink-0" style={{ color: lColor }} />
                <span className="flex-1 text-xs font-semibold text-foreground line-clamp-1">{ch.title}</span>
                {ch.status === "past" && (
                  <CheckCircle2 size={12} className="flex-shrink-0" style={{ color: "#22c55e" }} />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: `${lColor}22`, color: lColor }}
                >
                  {ch.label ?? "LIVE CALL"}
                </span>
                <span className="text-[9px] font-bold ml-auto" style={{ color: ss.text }}>
                  {ch.status === "past" ? "Ended" : "Upcoming"}
                </span>
              </div>
            </button>
          );
        }

        const ss = statusStyle(ch.status);
        const typeMeta = CHALLENGE_TYPE_META[ch.type] ?? CHALLENGE_TYPE_META.watch;
        const totalSecs = (ch.episodes ?? []).reduce((a: number, ep: any) => a + (ep.durationSeconds ?? 0), 0);
        const totalMins = totalSecs > 0 ? Math.ceil(totalSecs / 60) : null;
        const isCompleted = ch.status === "completed";
        const isInProgress = ch.status === "in_progress" && !ch.isLocked;

        return (
          <button
            key={ch.id}
            disabled={ch.isLocked}
            onClick={() => !ch.isLocked && onSelect(ch)}
            className="w-full text-left rounded-xl border p-3 transition-all"
            style={{
              background: isSelected
                ? "color-mix(in srgb, var(--color-accent) 12%, transparent)"
                : isCompleted
                  ? "rgba(34,197,94,0.04)"
                  : ss.bg,
              borderColor: isSelected
                ? "var(--color-accent)"
                : isCompleted
                  ? "rgba(34,197,94,0.3)"
                  : ss.border,
              opacity: ch.isLocked ? 0.55 : isCompleted && !isSelected ? 0.7 : 1,
              borderLeft: isCompleted && !isSelected ? "3px solid rgba(34,197,94,0.5)" : undefined,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black flex-shrink-0" style={{ color: ch.numberColor }}>
                {ch.numberLabel}
              </span>
              <span className="flex-1 text-xs font-semibold text-foreground line-clamp-1">{ch.title}</span>
              {ch.isLocked ? (
                <Lock size={11} className="flex-shrink-0 text-muted-foreground" />
              ) : isCompleted ? (
                <CheckCircle2 size={12} className="flex-shrink-0" style={{ color: "#22c55e" }} />
              ) : null}
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${typeMeta.color}22`, color: typeMeta.color }}
              >
                {typeMeta.label}
              </span>
              {isInProgress && !isSelected && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)" }}
                >
                  Resume
                </span>
              )}
              {ch.progressPercent > 0 && ch.progressPercent < 100 && (
                <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "var(--color-bg-surface)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${ch.progressPercent}%`, background: ss.text }} />
                </div>
              )}
              <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                {totalMins && (
                  <span className="text-[9px] text-muted-foreground">~{totalMins}m</span>
                )}
                {!ch.isLocked && !isCompleted && !isInProgress && (
                  <span className="text-[9px] font-bold" style={{ color: ss.text }}>Not Started</span>
                )}
                {isCompleted && (
                  <span className="text-[9px] font-bold" style={{ color: "#22c55e" }}>Done</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main: Watch Challenge ────────────────────────────────────────────────────

function WatchChallengeView({
  challenge,
  slug,
  initialEpisodeId,
  onChallengeComplete,
}: {
  challenge: any;
  slug: string;
  initialEpisodeId?: string;
  onChallengeComplete?: () => void;
}) {
  const qc = useQueryClient();
  const completeEp = useCompleteWorkshopEpisode();
  const postProgress = usePostEpisodeProgress();

  const episodes: any[] = challenge.episodes ?? [];

  const [activeEpIdx, setActiveEpIdx] = useState(() => {
    if (initialEpisodeId) {
      const idx = episodes.findIndex((e: any) => e.id === initialEpisodeId);
      if (idx >= 0) return idx;
    }
    const firstIncomplete = episodes.findIndex((e: any) => !e.isCompleted);
    return firstIncomplete >= 0 ? firstIncomplete : 0;
  });

  const ep = episodes[activeEpIdx];

  const [watchState, setWatchState] = useState<"not_started" | "resume" | "watching" | "paused" | "completed">("not_started");
  const [currentPlayhead, setCurrentPlayhead] = useState(0);
  const [forceStartFrom, setForceStartFrom] = useState<number | null>(null);
  const [upNextCountdown, setUpNextCountdown] = useState<number | null>(null);

  const iframeFocusedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const markCalledRef = useRef(false);
  const lastPlayheadRef = useRef<number>(0);
  const activeEpIdxRef = useRef(activeEpIdx);
  const onChallengeCompleteRef = useRef(onChallengeComplete);
  const currentEpRef = useRef<any>(undefined);

  useEffect(() => { activeEpIdxRef.current = activeEpIdx; }, [activeEpIdx]);
  useEffect(() => { onChallengeCompleteRef.current = onChallengeComplete; }, [onChallengeComplete]);
  useEffect(() => { currentEpRef.current = ep; }, [ep]);

  // Episode switch: reset local state
  useEffect(() => {
    clearInterval(timerRef.current);
    iframeFocusedRef.current = false;
    setForceStartFrom(null);
    setUpNextCountdown(null);

    if (!ep) return;
    const alreadyDone = !!ep.isCompleted;
    const resumeSecs = ep.lastWatchedSecs ?? 0;
    const hasProgress = !alreadyDone && resumeSecs > 3;
    setWatchState(alreadyDone ? "completed" : hasProgress ? "resume" : "not_started");
    setCurrentPlayhead(resumeSecs);
    lastPlayheadRef.current = resumeSecs;
    markCalledRef.current = alreadyDone;
  }, [ep?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Up Next countdown: auto-advance
  useEffect(() => {
    if (upNextCountdown === null) return;
    if (upNextCountdown <= 0) {
      setUpNextCountdown(null);
      setActiveEpIdx((prev) => {
        const next = prev + 1;
        return next < episodes.length ? next : prev;
      });
      return;
    }
    const id = setTimeout(() => setUpNextCountdown((n) => (n !== null ? n - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [upNextCountdown, episodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush progress on tab close
  useEffect(() => {
    const handleUnload = () => {
      const curEp = currentEpRef.current;
      if (!curEp || markCalledRef.current) return;
      const saved = lastPlayheadRef.current;
      if (saved <= 3) return;
      const token = getCachedTokenSync();
      if (!token) return;
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      fetch(`${base}/api/user/workshop/episodes/${curEp.id}/progress`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ watchedSeconds: Math.floor(saved), deltaSeconds: 0, isCompleted: false }),
      });
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ep || !ep.videoUrl) return;

    let lastPlayhead = ep.lastWatchedSecs ?? 0;

    const doMarkComplete = () => {
      if (markCalledRef.current) return;
      markCalledRef.current = true;
      clearInterval(timerRef.current);
      setWatchState("completed");
      completeEp.mutate(ep.id, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["workshop-challenges", slug] });
          qc.invalidateQueries({ queryKey: ["workshop-flow", slug] });
          qc.invalidateQueries({ queryKey: ["workshop-detail", slug] });
          qc.invalidateQueries({ queryKey: ["user", "dashboard", "continue-learning"] });
          const curIdx = activeEpIdxRef.current;
          if (curIdx + 1 < episodes.length) {
            setUpNextCountdown(5);
          } else {
            onChallengeCompleteRef.current?.();
          }
        },
        onError: () => {
          markCalledRef.current = false;
          setWatchState("paused");
        },
      });
    };

    const handler = (e: MessageEvent) => {
      let data = e.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data || typeof data !== "object") return;

      let evt = "";
      let payloadValue: any = undefined;

      if (data.context === "player.js") {
        evt = (data.event || "").toLowerCase();
        payloadValue = data.value;
      } else {
        const inner = data.data ?? data;
        evt = (inner.event || inner.type || inner.action || "").toLowerCase();
        payloadValue = inner.value ?? inner;
      }

      if (!evt) return;

      if (evt === "ready" && e.source) {
        const win = e.source as Window;
        ["play", "pause", "timeupdate", "ended"].forEach((eventName) => {
          win.postMessage(
            JSON.stringify({ context: "player.js", method: "addEventListener", value: eventName }),
            "*"
          );
        });
        return;
      }

      const isPlay = evt === "play" || evt === "playing" || evt === "onplay" || evt === "start";
      const isEnd = evt === "ended" || evt === "end" || evt === "finish" ||
                    evt === "onfinish" || evt === "complete" || evt === "onended";
      const isPause = evt === "pause" || evt === "paused" || evt === "onpause";
      const isTimeUpdate = evt === "timeupdate";

      if (isTimeUpdate && payloadValue !== undefined) {
        const currentTime = typeof payloadValue === 'number' ? payloadValue : payloadValue.seconds;
        if (currentTime !== undefined) {
          lastPlayhead = currentTime;
          lastPlayheadRef.current = currentTime;
          setCurrentPlayhead(currentTime);
        }
      }

      if (isPlay && !isEnd) {
        setWatchState("watching");
        if (!iframeFocusedRef.current) {
          iframeFocusedRef.current = true;
          clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            postProgress.mutate(
              { episodeId: ep.id, watchedSeconds: Math.floor(lastPlayhead), deltaSeconds: 15, isCompleted: false },
              {
                onSuccess: (data: any) => {
                  if (data?.isCompleted) doMarkComplete();
                },
              }
            );
          }, 15000);
        }
      } else if (isPause && !isEnd) {
        setWatchState("paused");
        iframeFocusedRef.current = false;
        clearInterval(timerRef.current);
      }

      if (isEnd) {
        clearInterval(timerRef.current);
        iframeFocusedRef.current = false;
        postProgress.mutate(
          { episodeId: ep.id, watchedSeconds: Math.floor(lastPlayhead), deltaSeconds: 15, isCompleted: false },
          {
            onSuccess: (data: any) => {
              if (data?.isCompleted) { doMarkComplete(); return; }
              doMarkComplete();
            },
          }
        );
      }
    };

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      clearInterval(timerRef.current);
      const saved = lastPlayheadRef.current;
      if (saved > 3 && !markCalledRef.current) {
        postProgress.mutate({ episodeId: ep.id, watchedSeconds: Math.floor(saved), deltaSeconds: 0, isCompleted: false });
      }
    };
  }, [ep?.id, ep?.videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ep) return <p className="text-sm text-muted-foreground text-center py-8">No episodes yet.</p>;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const activeProgressPct = ep.durationSeconds > 0
    ? Math.min(100, Math.round((Math.max(ep.actualWatchedSecs ?? 0, currentPlayhead) / ep.durationSeconds) * 100))
    : 0;

  const iframeSrc = ep.videoUrl
    ? withResumeTime(normalizeBunnyUrl(ep.videoUrl), forceStartFrom !== null ? forceStartFrom : (ep.lastWatchedSecs ?? 0))
    : null;

  return (
    <div className="space-y-4">
      <ChallengeHeader challenge={challenge} />

      {/* Player — sticky on mobile so controls stay visible while scrolling the episode list */}
      <div className="sticky top-0 z-10 lg:static lg:z-auto -mx-4 px-4 lg:mx-0 lg:px-0 pt-2 pb-1 lg:pt-0 lg:pb-0" style={{ background: "var(--color-bg-primary)" }}>
        <VideoWatermark
          className="rounded-xl overflow-hidden bg-black aspect-video relative"
          containerId="workshop-video-root"
          showFullscreenButton={!!ep.videoUrl}
        >
          {iframeSrc ? (
            <iframe
              key={`${ep.id}-${forceStartFrom}`}
              src={iframeSrc}
              className="w-full h-full"
              allow="autoplay"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No video</div>
          )}
        </VideoWatermark>
      </div>

      {/* Episode title + live status badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{ep.title}</p>
        </div>
        {ep.isCompleted || watchState === "completed" ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
            <CheckCircle2 size={13} /> Completed
          </span>
        ) : watchState === "watching" ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0" style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)" }}>
            <Play size={13} fill="currentColor" /> Watching {activeProgressPct}%
          </span>
        ) : watchState === "paused" ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 text-muted-foreground" style={{ background: "rgba(255,255,255,0.05)" }}>
            <Pause size={13} /> Paused at {formatTime(currentPlayhead)}
          </span>
        ) : watchState === "resume" ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0" style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)", color: "var(--color-accent)" }}>
            <Play size={11} fill="currentColor" className="ml-0.5" /> Resume from {formatTime(Math.max(ep.lastWatchedSecs ?? 0, currentPlayhead))}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 text-muted-foreground" style={{ background: "rgba(255,255,255,0.05)" }}>
            Progress saved automatically
          </span>
        )}
      </div>

      {/* Resume card — only when there's saved progress */}
      {(watchState === "resume" || watchState === "paused") && Math.max(ep.lastWatchedSecs ?? 0, currentPlayhead) > 3 && (
        <div
          className="rounded-xl border px-4 py-3 space-y-2"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 6%, transparent)",
            borderColor: "color-mix(in srgb, var(--color-accent) 22%, transparent)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: "color-mix(in srgb, var(--color-accent) 18%, transparent)" }}
              >
                <Play size={11} fill="currentColor" style={{ color: "var(--color-accent)" }} className="ml-0.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight" style={{ color: "var(--color-accent)" }}>
                  Resume from {formatTime(Math.max(ep.lastWatchedSecs ?? 0, currentPlayhead))}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{ep.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-bold" style={{ color: "var(--color-accent)" }}>
                {activeProgressPct}%
              </span>
              <button
                onClick={() => { setForceStartFrom(0); setWatchState("not_started"); }}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border"
              >
                Start over
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${activeProgressPct}%`, background: "var(--color-accent)" }}
              />
            </div>
            {ep.durationSeconds > 0 && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                {formatTime(Math.max(ep.lastWatchedSecs ?? 0, currentPlayhead))} / {formatTime(ep.durationSeconds)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Up Next countdown card */}
      {upNextCountdown !== null && activeEpIdx + 1 < episodes.length && (
        <div
          className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 6%, transparent)",
            borderColor: "color-mix(in srgb, var(--color-accent) 22%, transparent)",
          }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Up Next</p>
            <p className="text-sm font-semibold text-foreground truncate">
              {episodes[activeEpIdx + 1]?.title ?? "Next Episode"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { setUpNextCountdown(null); setActiveEpIdx((prev) => prev + 1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              Play Now
            </button>
            <button
              onClick={() => setUpNextCountdown(null)}
              className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground border border-border hover:text-foreground transition-colors whitespace-nowrap"
            >
              Cancel ({upNextCountdown}s)
            </button>
          </div>
        </div>
      )}

      {/* Video completion summary */}
      {(() => {
        const total = episodes.length;
        const done = episodes.filter((e: any, i: number) =>
          !!e.isCompleted || (i === activeEpIdx && watchState === "completed")
        ).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return total > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Videos</span>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: done === total ? "#22c55e" : "var(--color-accent)" }}>
                {done} / {total} completed
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: done === total ? "#22c55e" : "var(--color-accent)" }}
              />
            </div>
          </div>
        ) : null;
      })()}

      {/* Dynamic Episode list */}
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
        {episodes.map((e: any, i: number) => {
          const isActive = i === activeEpIdx;
          const isDone = !!e.isCompleted || (isActive && watchState === "completed");
          const progressPct = e.durationSeconds > 0
            ? Math.min(100, Math.round((Math.max(e.actualWatchedSecs ?? 0, isActive ? currentPlayhead : (e.lastWatchedSecs ?? 0)) / e.durationSeconds) * 100))
            : 0;

          const isWatching = isActive && watchState === "watching";
          const isPausedState = isActive && watchState === "paused";
          const isResumeState = isActive && watchState === "resume";
          const hasPartialProgress = !isDone && !isActive && (e.lastWatchedSecs > 0 || e.actualWatchedSecs > 0);
          const showBar = !isDone && (isWatching || isPausedState || isResumeState || hasPartialProgress);

          const borderColor = isDone
            ? "#22c55e"
            : isWatching
              ? "var(--color-accent)"
              : isPausedState
                ? "rgba(255,255,255,0.15)"
                : "transparent";

          const bgColor = isDone
            ? "rgba(34,197,94,0.06)"
            : isWatching
              ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
              : isPausedState || isResumeState
                ? "rgba(255,255,255,0.03)"
                : "transparent";

          return (
            <button
              key={e.id}
              onClick={() => setActiveEpIdx(i)}
              className="w-full flex flex-col px-3 py-3.5 text-left transition-all"
              style={{ borderLeft: `3px solid ${borderColor}`, background: bgColor }}
            >
              {/* Row 1: icon + title + right label */}
              <div className="flex items-center gap-3">
                {/* State icon */}
                <span
                  className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-[11px] font-bold transition-colors"
                  style={
                    isDone
                      ? { background: "#22c55e22", color: "#22c55e" }
                      : isWatching
                        ? { background: "var(--color-accent)", color: "#fff" }
                        : isPausedState
                          ? { background: "rgba(255,255,255,0.08)", color: "#fff" }
                          : isResumeState || hasPartialProgress
                            ? { background: "color-mix(in srgb, var(--color-accent) 18%, transparent)", color: "var(--color-accent)" }
                            : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }
                  }
                >
                  {isDone ? (
                    <CheckCircle2 size={14} />
                  ) : isWatching ? (
                    <Play size={10} fill="currentColor" className="ml-0.5 animate-pulse" />
                  ) : isPausedState ? (
                    <Pause size={10} fill="currentColor" />
                  ) : isResumeState || hasPartialProgress ? (
                    <Play size={10} fill="currentColor" className="ml-0.5" />
                  ) : (
                    i + 1
                  )}
                </span>

                {/* Title */}
                <span
                  className="flex-1 min-w-0 text-sm font-medium truncate transition-colors"
                  style={{
                    color: isDone
                      ? "#22c55e"
                      : isWatching || isPausedState || isResumeState
                        ? "#fff"
                        : hasPartialProgress
                          ? "rgba(255,255,255,0.7)"
                          : "rgba(255,255,255,0.4)",
                  }}
                >
                  {e.title}
                </span>

                {/* Right label */}
                <span className="flex-shrink-0 min-w-0">
                  {isDone ? (
                    <span className="text-[11px] font-bold" style={{ color: "#22c55e" }}>Completed</span>
                  ) : isWatching ? (
                    <span className="text-[11px] font-bold" style={{ color: "var(--color-accent)" }}>Watching...</span>
                  ) : isPausedState ? (
                    <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                      Paused at {formatTime(currentPlayhead)}
                    </span>
                  ) : isResumeState ? (
                    <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: "var(--color-accent)" }}>
                      Resume {progressPct}%
                    </span>
                  ) : hasPartialProgress ? (
                    <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: "var(--color-accent)" }}>
                      Resume {progressPct}%
                    </span>
                  ) : e.durationLabel ? (
                    <span className="text-[11px] text-muted-foreground">{e.durationLabel}</span>
                  ) : null}
                </span>
              </div>

              {/* Row 2: progress bar — only for in-progress states, never for completed */}
              {showBar && (
                <div className="mt-2.5 pl-10 flex items-center gap-2.5">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progressPct}%`,
                        background: isWatching || isResumeState || hasPartialProgress
                          ? "var(--color-accent)"
                          : "rgba(255,255,255,0.3)",
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground w-7 text-right whitespace-nowrap">
                    {progressPct}%
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main: Quiz Challenge ─────────────────────────────────────────────────────

function QuizScoreModal({
  score,
  total,
  onRewatch,
  onNext,
  isPending,
}: {
  score: number;
  total: number;
  onRewatch: () => void;
  onNext: () => void;
  isPending: boolean;
}) {
  const isPerfect = score === total;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-5 text-center shadow-2xl" style={{ background: "var(--color-bg-surface, #1a1a1a)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: isPerfect ? "#22c55e18" : "rgba(255,255,255,0.06)" }}
          >
            <Trophy size={26} style={{ color: isPerfect ? "#22c55e" : "var(--color-accent)" }} />
          </div>
          <p className="text-base font-bold text-foreground">Quiz Completed</p>
          <p className="text-muted-foreground text-sm">
            Your score is{" "}
            <span className="font-black text-foreground text-lg">{score}</span>
            {" "}out of{" "}
            <span className="font-black text-foreground text-lg">{total}</span>
          </p>
          {!isPerfect && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Rewatch the video to strengthen your understanding, or continue to the next challenge.
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onRewatch}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--color-fg, #f0f0f0)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Rewatch
          </button>
          <button
            onClick={onNext}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all"
            style={{ background: "var(--color-accent)" }}
          >
            {isPending ? "Saving..." : "Next Challenge"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuizChallengeView({
  challenge,
  slug,
  onDone,
  onRewatch,
}: {
  challenge: any;
  slug: string;
  onDone: () => void;
  onRewatch: () => void;
}) {
  const qc = useQueryClient();
  const completeChallenge = useCompleteChallenge();
  const questions: any[] = challenge.quizData?.questions ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showModal, setShowModal] = useState(false);
  const [score, setScore] = useState(0);

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);

  const handleSubmit = async () => {
    const correct = questions.filter((q) => {
      const sel = answers[q.id];
      return q.options?.find((o: any) => o.id === sel)?.correct;
    }).length;
    setScore(correct);
    setShowModal(true);
  };

  const handleNext = async () => {
    await completeChallenge.mutateAsync({
      challengeId: challenge.id,
      answersData: { answers, score, total: questions.length },
    });
    qc.invalidateQueries({ queryKey: ["workshop-challenges", slug] });
    qc.invalidateQueries({ queryKey: ["workshop-detail", slug] });
    setShowModal(false);
    onDone();
  };

  const handleRewatch = () => {
    setShowModal(false);
    onRewatch();
  };

  return (
    <div className="space-y-5">
      {showModal && (
        <QuizScoreModal
          score={score}
          total={questions.length}
          onRewatch={handleRewatch}
          onNext={handleNext}
          isPending={completeChallenge.isPending}
        />
      )}

      <ChallengeHeader challenge={challenge} />

      {questions.map((q: any, qi: number) => {
        const selected = answers[q.id];
        return (
          <div key={q.id} className="space-y-2.5">
            <p className="text-sm font-semibold text-foreground">
              <span className="text-muted-foreground mr-1">Q{qi + 1}.</span>{q.question}
            </p>
            <div className="space-y-1.5">
              {(q.options ?? []).map((opt: any) => {
                const isSelected = selected === opt.id;
                const borderColor = isSelected
                  ? "var(--color-accent)"
                  : "var(--color-border, rgba(255,255,255,0.1))";
                const bg = isSelected
                  ? "color-mix(in srgb, var(--color-accent) 8%, transparent)"
                  : "transparent";

                return (
                  <button
                    key={opt.id}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left text-xs transition-all"
                    style={{ borderColor, background: bg }}
                  >
                    <span
                      className="w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-[9px] font-bold"
                      style={{
                        borderColor: isSelected ? "var(--color-accent)" : "var(--color-border, rgba(255,255,255,0.15))",
                        color: isSelected ? "var(--color-accent)" : "var(--color-muted)",
                      }}
                    >
                      {opt.id.toUpperCase()}
                    </span>
                    <span className="flex-1 text-foreground">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered}
        className="w-full py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50 transition-opacity"
        style={{ background: "var(--color-accent)" }}
      >
        Submit Quiz
      </button>
    </div>
  );
}

// ─── Main: Written Challenge ──────────────────────────────────────────────────

function WrittenChallengeView({ challenge, slug, onDone }: { challenge: any; slug: string; onDone: () => void }) {
  const qc = useQueryClient();
  const completeChallenge = useCompleteChallenge();
  const prompt = challenge.quizData?.prompt ?? challenge.description ?? "";
  const placeholder = challenge.quizData?.placeholder ?? "Write your answer here...";
  const isCompleted = challenge.status === "completed";
  const existingAnswer = challenge.submission?.answersData?.answer ?? "";
  const [answer, setAnswer] = useState(existingAnswer);

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    await completeChallenge.mutateAsync({ challengeId: challenge.id, answersData: { answer } });
    qc.invalidateQueries({ queryKey: ["workshop-challenges", slug] });
    qc.invalidateQueries({ queryKey: ["workshop-detail", slug] });
    onDone();
  };

  return (
    <div className="space-y-4">
      <ChallengeHeader challenge={challenge} />
      <div className="rounded-xl border border-border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Challenge</p>
        <p className="text-sm text-foreground leading-relaxed">{prompt}</p>
      </div>

      {isCompleted ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
            <p className="text-xs font-bold text-foreground">Answer Submitted</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{existingAnswer}</p>
          </div>
          <button onClick={onDone} className="text-xs font-bold" style={{ color: "var(--color-accent)" }}>Back to challenges →</button>
        </div>
      ) : (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={placeholder}
            rows={6}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-ring resize-none transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || completeChallenge.isPending}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "var(--color-accent)" }}
          >
            {completeChallenge.isPending ? "Submitting..." : "Submit Answer"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Main: Matching Challenge ─────────────────────────────────────────────────

function MatchingChallengeView({ challenge, slug, onDone }: { challenge: any; slug: string; onDone: () => void }) {
  const qc = useQueryClient();
  const completeChallenge = useCompleteChallenge();
  const pairs: any[] = challenge.quizData?.pairs ?? [];
  const isCompleted = challenge.status === "completed";

  // Shuffle right column on mount
  const [rightOrder] = useState<string[]>(() => {
    const ids = pairs.map((p) => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  });

  const [leftSelected, setLeftSelected] = useState<string | null>(null);
  const [rightSelected, setRightSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({}); // leftId -> rightId
  const [wrongPair, setWrongPair] = useState<string | null>(null);

  useEffect(() => {
    if (!leftSelected || !rightSelected) return;
    const pair = pairs.find((p) => p.id === leftSelected);
    if (pair && rightSelected === pair.id) {
      setMatched((m) => ({ ...m, [leftSelected]: rightSelected }));
    } else {
      setWrongPair(leftSelected);
      setTimeout(() => setWrongPair(null), 800);
    }
    setLeftSelected(null);
    setRightSelected(null);
  }, [leftSelected, rightSelected]);

  const allMatched = pairs.length > 0 && Object.keys(matched).length === pairs.length;

  const handleComplete = async () => {
    await completeChallenge.mutateAsync({ challengeId: challenge.id, answersData: { matched } });
    qc.invalidateQueries({ queryKey: ["workshop-challenges", slug] });
    qc.invalidateQueries({ queryKey: ["workshop-detail", slug] });
    onDone();
  };

  return (
    <div className="space-y-4">
      <ChallengeHeader challenge={challenge} />
      <p className="text-xs text-muted-foreground">Match each term on the left with its correct pair on the right.</p>

      {isCompleted ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
            <p className="text-xs font-bold text-foreground">Challenge Completed!</p>
          </div>
          <div className="space-y-1.5">
            {pairs.map((p) => (
              <div key={p.id} className="flex gap-2 items-center text-xs rounded-lg border border-border px-3 py-2" style={{ borderColor: "#22c55e44" }}>
                <span className="flex-1 font-medium text-foreground">{p.left}</span>
                <span className="text-muted-foreground">→</span>
                <span className="flex-1 text-muted-foreground">{p.right}</span>
              </div>
            ))}
          </div>
          <button onClick={onDone} className="text-xs font-bold" style={{ color: "var(--color-accent)" }}>Back to challenges →</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {/* Left column */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">Terms</p>
              {pairs.map((p) => {
                const isMatchedLeft = !!matched[p.id];
                const isWrong = wrongPair === p.id;
                const isSel = leftSelected === p.id;
                return (
                  <button
                    key={p.id}
                    disabled={isMatchedLeft}
                    onClick={() => !isMatchedLeft && setLeftSelected(isSel ? null : p.id)}
                    className="w-full px-3 py-2 rounded-lg border text-left text-xs font-medium transition-all"
                    style={{
                      borderColor: isMatchedLeft ? "#22c55e88" : isWrong ? "#ef4444" : isSel ? "var(--color-accent)" : "rgba(255,255,255,0.1)",
                      background: isMatchedLeft ? "#22c55e0a" : isWrong ? "#ef44440a" : isSel ? "color-mix(in srgb, var(--color-accent) 10%, transparent)" : "transparent",
                      color: isMatchedLeft ? "#22c55e" : "inherit",
                    }}
                  >
                    {p.left}
                  </button>
                );
              })}
            </div>

            {/* Right column */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">Definitions</p>
              {rightOrder.map((rid) => {
                const p = pairs.find((x) => x.id === rid)!;
                const isMatchedRight = Object.values(matched).includes(p.id);
                const isSel = rightSelected === p.id;
                return (
                  <button
                    key={p.id}
                    disabled={isMatchedRight || !leftSelected}
                    onClick={() => leftSelected && !isMatchedRight && setRightSelected(isSel ? null : p.id)}
                    className="w-full px-3 py-2 rounded-lg border text-left text-xs transition-all"
                    style={{
                      borderColor: isMatchedRight ? "#22c55e88" : isSel ? "var(--color-accent)" : "rgba(255,255,255,0.1)",
                      background: isMatchedRight ? "#22c55e0a" : isSel ? "color-mix(in srgb, var(--color-accent) 10%, transparent)" : "transparent",
                      color: isMatchedRight ? "#22c55e" : !leftSelected ? "var(--color-muted-foreground, #888)" : "inherit",
                      opacity: !leftSelected && !isMatchedRight ? 0.6 : 1,
                    }}
                  >
                    {p.right}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {Object.keys(matched).length}/{pairs.length} matched
          </p>

          {allMatched && (
            <button
              onClick={handleComplete}
              disabled={completeChallenge.isPending}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "var(--color-accent)" }}
            >
              {completeChallenge.isPending ? "Saving..." : "Complete Challenge ✓"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main: Flashcard Challenge ────────────────────────────────────────────────

function FlashcardChallengeView({ challenge, slug, onDone }: { challenge: any; slug: string; onDone: () => void }) {
  const qc = useQueryClient();
  const completeChallenge = useCompleteChallenge();
  const cards: any[] = challenge.quizData?.cards ?? [];
  const isCompleted = challenge.status === "completed";

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(isCompleted);

  const card = cards[idx];
  const allKnown = known.size >= cards.length;

  const handleGotIt = () => {
    setKnown((k) => new Set([...k, card.id]));
    setFlipped(false);
    if (idx < cards.length - 1) setIdx((i) => i + 1);
  };

  const handleReview = () => {
    setFlipped(false);
    if (idx < cards.length - 1) setIdx((i) => i + 1);
    else setIdx(0);
  };

  const handleComplete = async () => {
    await completeChallenge.mutateAsync({ challengeId: challenge.id, answersData: { reviewed: cards.length } });
    qc.invalidateQueries({ queryKey: ["workshop-challenges", slug] });
    qc.invalidateQueries({ queryKey: ["workshop-detail", slug] });
    setDone(true);
  };

  if (done) {
    return (
      <div className="space-y-4">
        <ChallengeHeader challenge={challenge} />
        <div className="rounded-xl border p-6 text-center space-y-3" style={{ borderColor: "#22c55e44", background: "#22c55e0a" }}>
          <Trophy size={32} className="mx-auto" style={{ color: "#22c55e" }} />
          <p className="font-bold text-foreground">All cards reviewed!</p>
          <p className="text-sm text-muted-foreground">{known.size}/{cards.length} marked as known</p>
          <button onClick={onDone} className="text-xs font-bold" style={{ color: "var(--color-accent)" }}>Back to challenges →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ChallengeHeader challenge={challenge} />

      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Card {idx + 1} of {cards.length}</span>
        <span style={{ color: "#22c55e" }}>{known.size} known</span>
      </div>

      {/* Flashcard — click to flip */}
      <button
        onClick={() => setFlipped((f) => !f)}
        className="w-full rounded-2xl border p-8 text-center transition-all min-h-[180px] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-accent/50"
        style={{ borderColor: "rgba(255,255,255,0.12)", background: flipped ? "color-mix(in srgb, var(--color-accent) 6%, var(--color-bg-surface))" : "var(--color-bg-surface)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {flipped ? "Answer" : "Question — tap to flip"}
        </p>
        <p className="text-base font-semibold text-foreground leading-relaxed">
          {flipped ? card?.back : card?.front}
        </p>
        <RotateCcw size={13} className="text-muted-foreground mt-1" />
      </button>

      {/* Navigation */}
      <div className="flex gap-2">
        <button
          onClick={handleReview}
          className="flex-1 py-2.5 rounded-lg text-xs font-bold border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          Review Again
        </button>
        <button
          onClick={handleGotIt}
          className="flex-1 py-2.5 rounded-lg text-xs font-bold text-white"
          style={{ background: "#22c55e" }}
        >
          Got It ✓
        </button>
      </div>

      {allKnown && !done && (
        <button
          onClick={handleComplete}
          disabled={completeChallenge.isPending}
          className="w-full py-2.5 rounded-lg text-sm font-bold text-white"
          style={{ background: "var(--color-accent)" }}
        >
          {completeChallenge.isPending ? "Saving..." : "Complete Challenge"}
        </button>
      )}
    </div>
  );
}

// ─── Main: Live Call Challenge ────────────────────────────────────────────────

function LiveCallChallengeView({ challenge }: { challenge: any; onDone: () => void }) {
  const { uiStrings } = useSiteConfig();
  const isPast = challenge.status === "past";
  const lColor = challenge.labelColor ?? "#ff3d8b";
  const teal = challenge.stayTunedColor ?? "#2dd4bf";
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    if (!challenge.scheduledAt || isPast) return;
    const target = new Date(challenge.scheduledAt).getTime();
    const tick = () => setDiff(Math.max(0, target - getServerNow()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [challenge.scheduledAt, isPast]);

  const units = [
    [Math.floor(diff / 86400000), uiStrings?.countdownDays ?? "DAYS"],
    [Math.floor((diff % 86400000) / 3600000), uiStrings?.countdownHours ?? "HOURS"],
    [Math.floor((diff % 3600000) / 60000), uiStrings?.countdownMins ?? "MINS"],
    [Math.floor((diff % 60000) / 1000), uiStrings?.countdownSecs ?? "SECS"],
  ] as [number, string][];

  const dateLabel = challenge.scheduledAt
    ? new Date(challenge.scheduledAt)
        .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        .toUpperCase()
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: lColor }}>
            {challenge.label ?? "LIVE CALL:"}
          </span>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: `${lColor}22`, color: lColor }}
          >
            LIVE SESSION
          </span>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={
              isPast
                ? { background: "rgba(34,197,94,0.1)", color: "#22c55e" }
                : { background: "rgba(245,158,11,0.1)", color: "#f59e0b" }
            }
          >
            {isPast ? "Ended" : "Upcoming"}
          </span>
        </div>
        <h3 className="font-bold text-foreground text-base">{challenge.title}</h3>
        {challenge.facilitatorName && (
          <p className="text-xs text-muted-foreground">
            {challenge.facilitatorName}
            {challenge.facilitatorTitle ? ` · ${challenge.facilitatorTitle}` : ""}
          </p>
        )}
      </div>

      {isPast ? (
        <div
          className="rounded-xl border p-6 text-center space-y-2"
          style={{ borderColor: "#22c55e44", background: "#22c55e0a" }}
        >
          <CheckCircle2 size={24} className="mx-auto" style={{ color: "#22c55e" }} />
          <p className="font-bold text-foreground">Session Completed</p>
          <p className="text-xs text-muted-foreground">This live session has ended.</p>
        </div>
      ) : (
        <div
          className="rounded-xl border p-8 text-center space-y-5"
          style={{ background: "#000", borderColor: `${lColor}44` }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: lColor }}>
            {challenge.label ?? "LIVE CALL:"}
          </p>
          <h3 className="text-lg font-bold text-white leading-snug -mt-2">{challenge.title}</h3>

          <div className="flex gap-5 md:gap-8 justify-center">
            {units.map(([val, label], i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="text-4xl font-bold tabular-nums text-white font-mono leading-none">
                  {String(val).padStart(2, "0")}
                </span>
                <span
                  className="text-[10px] font-bold tracking-[0.2em] mt-2 uppercase"
                  style={{ color: teal }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {dateLabel && (
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: teal }}>
              {dateLabel}
            </p>
          )}

          {challenge.stayTunedMessage && (
            <p className="text-sm italic max-w-sm mx-auto" style={{ color: teal }}>
              {challenge.stayTunedMessage}
            </p>
          )}

          {challenge.liveUrl && (
            <a
              href={challenge.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-bold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              {uiStrings?.liveCallJoinLabel ?? "Join Call"}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Challenge Header (shared) ────────────────────────────────────────────────

function ChallengeHeader({ challenge }: { challenge: any }) {
  const typeMeta = CHALLENGE_TYPE_META[challenge.type] ?? CHALLENGE_TYPE_META.watch;
  const ss = statusStyle(challenge.status);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black" style={{ color: challenge.numberColor }}>{challenge.numberLabel}</span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${typeMeta.color}22`, color: typeMeta.color }}>{typeMeta.label}</span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: ss.bg, color: ss.text }}>
          {challenge.status === "completed" ? "Completed" : challenge.status === "in_progress" ? "In Progress" : "Not Started"}
        </span>
      </div>
      <h3 className="font-bold text-foreground text-base">{challenge.title}</h3>
      {challenge.description && <p className="text-xs text-muted-foreground leading-relaxed">{challenge.description}</p>}
    </div>
  );
}

// ─── Main: Challenge Dispatcher ───────────────────────────────────────────────

function ChallengeView({
  challenge,
  slug,
  onDone,
  initialEpisodeId,
  onChallengeComplete,
  onRewatch,
}: {
  challenge: any;
  slug: string;
  onDone: () => void;
  initialEpisodeId?: string;
  onChallengeComplete?: () => void;
  onRewatch?: () => void;
}) {
  const advance = onChallengeComplete ?? onDone;
  switch (challenge.type) {
    case "live_call":  return <LiveCallChallengeView challenge={challenge} onDone={advance} />;
    case "quiz":       return (
      <QuizChallengeView
        challenge={challenge}
        slug={slug}
        onDone={advance}
        onRewatch={onRewatch ?? advance}
      />
    );
    case "written":    return <WrittenChallengeView challenge={challenge} slug={slug} onDone={advance} />;
    case "matching":   return <MatchingChallengeView challenge={challenge} slug={slug} onDone={advance} />;
    case "flashcard":  return <FlashcardChallengeView challenge={challenge} slug={slug} onDone={advance} />;
    default:           return (
      <WatchChallengeView
        challenge={challenge}
        slug={slug}
        initialEpisodeId={initialEpisodeId}
        onChallengeComplete={advance}
      />
    );
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 w-20 rounded" style={{ background: "var(--color-bg-surface)" }} />
      <div className="h-7 w-3/4 rounded" style={{ background: "var(--color-bg-surface)" }} />
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-3">
          <div className="h-48 rounded-xl" style={{ background: "var(--color-bg-surface)" }} />
        </div>
        <div className="lg:w-80 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl" style={{ background: "var(--color-bg-surface)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type MainView =
  | { kind: "default" }
  | { kind: "challenge"; challenge: any; initialEpisodeId?: string }
  | { kind: "assignment"; assignmentId: string };

export default function WorkshopDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const epParam = searchParams.get("ep");
  const qc = useQueryClient();
  const { data: detail, isLoading: detailLoading } = useWorkshopDetail(slug);
  const { data: flowData } = useWorkshopFlow(slug);
  const { data: challengesData } = useWorkshopChallenges(slug);
  const { uiStrings } = useSiteConfig();

  const tabs = detail?.sidebar?.tabs ?? [];
  const [activeTab, setActiveTab] = useState<string>("");
  const [mainView, setMainView] = useState<MainView>({ kind: "default" });
  const hasAutoOpenedRef = useRef(false);

  const handleLiveUrlUnlock = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["workshop-flow", slug] });
  }, [qc, slug]);

  // Auto-open challenge from ?ep param (Continue Watching → workshop page)
  useEffect(() => {
    if (hasAutoOpenedRef.current || !challengesData?.challenges) return;
    const challenges: any[] = challengesData.challenges;

    if (epParam) {
      for (const ch of challenges) {
        if (ch.isLocked || !ch.episodes) continue;
        if (ch.episodes.some((e: any) => e.id === epParam)) {
          hasAutoOpenedRef.current = true;
          setMainView({ kind: "challenge", challenge: ch, initialEpisodeId: epParam });
          setActiveTab("challenges");
          return;
        }
      }
    }

    // Fallback: auto-open first in-progress challenge
    const inProgress = challenges.find((ch: any) => ch.status === "in_progress" && !ch.isLocked);
    if (inProgress) {
      hasAutoOpenedRef.current = true;
      setMainView({ kind: "challenge", challenge: inProgress });
      setActiveTab("challenges");
    }
  }, [epParam, challengesData?.challenges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Advance to the next challenge after current one completes.
  // Use index rather than isLocked — the lock status in cached data is stale
  // at the moment this runs (invalidateQueries hasn't refetched yet).
  const handleChallengeComplete = useCallback(() => {
    const challenges: any[] = challengesData?.challenges ?? [];
    const currentId = mainView.kind === "challenge" ? mainView.challenge?.id : null;
    if (!currentId) { setMainView({ kind: "default" }); return; }
    const currentIdx = challenges.findIndex((ch: any) => ch.id === currentId);
    const next = challenges[currentIdx + 1];
    if (next) {
      setMainView({ kind: "challenge", challenge: next });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setMainView({ kind: "default" });
    }
  }, [mainView, challengesData?.challenges]);

  // Navigate to the nearest preceding watch challenge (for quiz "Rewatch" button)
  const handleRewatch = useCallback(() => {
    const challenges: any[] = challengesData?.challenges ?? [];
    const currentId = mainView.kind === "challenge" ? mainView.challenge?.id : null;
    if (!currentId) return;
    const currentIdx = challenges.findIndex((ch: any) => ch.id === currentId);
    const nonWatchTypes = ["quiz", "written", "matching", "flashcard", "live_call"];
    const prev = challenges.slice(0, currentIdx).reverse().find(
      (ch: any) => !nonWatchTypes.includes(ch.type)
    );
    if (prev) {
      setMainView({ kind: "challenge", challenge: prev });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // No preceding video — just complete and advance
      handleChallengeComplete();
    }
  }, [mainView, challengesData?.challenges, handleChallengeComplete]);

  useEffect(() => {
    if (tabs.length > 0 && !activeTab) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs.length]);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;

    getSocket().then((socket) => {
      if (!mounted) return;
      socket.emit('join:workshop', slug);
      socket.on('qa:new_question', () => {
        qc.invalidateQueries({ queryKey: ['workshop-qa', slug] });
      });
      socket.on('qa:new_reply', () => {
        qc.invalidateQueries({ queryKey: ['workshop-qa', slug] });
      });
    });

    return () => {
      mounted = false;
      getSocket().then((socket) => {
        socket.emit('leave:workshop', slug);
        socket.off('qa:new_question');
        socket.off('qa:new_reply');
      });
    };
  }, [slug, qc]);

  if (detailLoading) return <DetailSkeleton />;
  if (!detail) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {uiStrings?.errorGeneric}
      </p>
    );
  }

  const progress = detail.learningProgress;

  const upcomingLiveCall =
    detail.defaultMainAreaType === "countdown"
      ? (flowData?.flowItems ?? []).find(
          (item: WorkshopFlowItem) =>
            item.type === "live_call" && item.status !== "past" && item.scheduledAt
        )
      : null;

  const currentTabId = activeTab || tabs[0]?.id;

  return (
    <div className="space-y-4">
      {/* Live URL auto-refetch when unlock window opens */}
      {flowData?.flowItems && (
        <LiveCallUnlockWatcher
          flowItems={flowData.flowItems}
          onUnlock={handleLiveUrlUnlock}
        />
      )}

      {/* Header — back link + title */}
      <Link
        href={detail.backUrl}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft size={15} />
        {detail.backLabel}
      </Link>
      <h1 className="text-xl font-bold text-foreground leading-tight">{detail.title}</h1>

      {/* Two-column body */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left: Main Area ── */}
        <div className="flex-1 min-w-0">
          {mainView.kind === "assignment" ? (
            <AssignmentMainView
              assignmentId={mainView.assignmentId}
              slug={slug}
              onBack={() => setMainView({ kind: "default" })}
            />
          ) : mainView.kind === "challenge" ? (
            <ChallengeView
              challenge={mainView.challenge}
              slug={slug}
              onDone={() => setMainView({ kind: "default" })}
              initialEpisodeId={mainView.initialEpisodeId}
              onChallengeComplete={handleChallengeComplete}
              onRewatch={handleRewatch}
            />
          ) : upcomingLiveCall ? (
            <MainAreaCountdown item={upcomingLiveCall} />
          ) : (
            <div
              className="rounded-xl border border-border border-dashed flex items-center justify-center"
              style={{ minHeight: 180 }}
            >
              <p className="text-sm text-muted-foreground text-center px-4">
                Select a challenge from the sidebar to begin
              </p>
            </div>
          )}
        </div>

        {/* ── Right: Sidebar ── */}
        <div className="w-full lg:w-[280px] flex-shrink-0 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto space-y-3">
          {/* Challenge progress + certificate — always visible above tabs */}
          <LearningProgressWidget progress={progress} />
          {detail.certificate && (
            <CertificateCard cert={detail.certificate} slug={slug} />
          )}

          {/* Tab buttons */}
          {tabs.length > 0 && (
            <div className="flex border-b border-border">
              {tabs
                .slice()
                .sort((a: WorkshopTab, b: WorkshopTab) => a.order - b.order)
                .map((tab: WorkshopTab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-1 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors",
                      currentTabId === tab.id
                        ? "border-current"
                        : "text-muted-foreground border-transparent hover:text-foreground"
                    )}
                    style={
                      currentTabId === tab.id
                        ? { borderColor: "var(--color-accent)", color: "var(--color-accent)" }
                        : {}
                    }
                  >
                    {tab.label}
                  </button>
                ))}
            </div>
          )}

          {/* Challenges tab */}
          {currentTabId === "challenges" && (
            <ChallengeList
              slug={slug}
              selectedId={mainView.kind === "challenge" ? mainView.challenge?.id : null}
              onSelect={(ch) => {
                setMainView({ kind: "challenge", challenge: ch });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}

          {currentTabId === "qa" && <QaTab slug={slug} />}

          {currentTabId === "assignment" && (
            <AssignmentsTab
              slug={slug}
              onSubmissionView={(id) => {
                setMainView({ kind: "assignment", assignmentId: id });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

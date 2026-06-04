"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import {
  useWorkshopDetail,
  useWorkshopFlow,
  useWorkshopQa,
  usePostQa,
  usePostQaReply,
  useWorkshopAssignments,
  useSubmitAssignment,
} from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket/client";
import { cn } from "@/lib/utils/cn";
import { getServerNow } from "@/lib/api/client";
import type {
  WorkshopFlowItem,
  WorkshopTab,
  LearningProgress,
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

// ─── Episode icon resolvers ───────────────────────────────────────────────────

function resolveEpisodeCompletedIcon(iconType?: string) {
  switch (iconType) {
    case "checkmark_pink":
      return <CheckCircle2 size={14} style={{ color: "var(--color-alert)" }} />;
    case "checkmark":
    case "checkmark_green":
    default:
      return <CheckCircle2 size={14} style={{ color: "var(--color-success)" }} />;
  }
}

function CircularProgress({ pct }: { pct: number }) {
  const r = 7;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="flex-shrink-0 -rotate-90">
      <circle cx="9" cy="9" r={r} fill="none" strokeWidth="2" className="stroke-muted" />
      <circle
        cx="9" cy="9" r={r}
        fill="none"
        strokeWidth="2"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ stroke: "var(--color-accent)", transition: "stroke-dasharray 0.4s ease" }}
      />
    </svg>
  );
}

function resolveEpisodeLockIcon(iconType?: string) {
  switch (iconType) {
    case "padlock":
    default:
      return <Lock size={13} style={{ color: "var(--color-locked)" }} />;
  }
}

// ─── Sidebar: Learning Progress Widget (collapsible) ─────────────────────────

function LearningProgressWidget({ progress }: { progress: LearningProgress | null }) {
  const [open, setOpen] = useState(true);

  if (!progress) return null;

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

// ─── Sidebar: Flow Item Row ───────────────────────────────────────────────────

function FlowItemRow({
  item,
  onEpisodeClick,
  onLiveCallClick,
  onAssignmentTabClick,
}: {
  item: WorkshopFlowItem;
  onEpisodeClick: (id: string) => void;
  onLiveCallClick: (item: WorkshopFlowItem) => void;
  onAssignmentTabClick: () => void;
}) {
  const [open, setOpen] = useState(item.isExpanded ?? false);
  const { uiStrings } = useSiteConfig();

  if (item.type === "live_call") {
    const isPast = item.status === "past";
    return (
      <div
        className={cn(
          "rounded-xl border border-border p-3 space-y-1.5 text-sm",
          !isPast && item.scheduledAt ? "cursor-pointer hover:bg-accent/5 transition-colors" : ""
        )}
        onClick={() => !isPast && item.scheduledAt && onLiveCallClick(item)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
              style={{ color: item.labelColor ?? "var(--color-alert)" }}
            >
              {item.label}
            </span>
            {isPast && (
              <Video
                size={12}
                className="flex-shrink-0"
                style={{ color: item.labelColor ?? "var(--color-alert)" }}
              />
            )}
            {isPast && item.recordingAvailable && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white flex-shrink-0"
                style={{ background: "var(--color-success)" }}
              >
                REC
              </span>
            )}
          </div>
          {item.isCompleted && (
            <CheckCircle2 size={13} style={{ color: "var(--color-success)" }} className="flex-shrink-0" />
          )}
        </div>
        <p className="font-semibold text-xs text-foreground leading-snug line-clamp-2">{item.title}</p>
        {item.facilitatorName && (
          <p className="text-[11px] text-muted-foreground">
            {item.facilitatorName}
            {item.facilitatorTitle ? ` · ${item.facilitatorTitle}` : ""}
          </p>
        )}
        {item.prerequisiteNote && (
          <p className="text-[11px]" style={{ color: "var(--color-alert)" }}>
            {item.prerequisiteNote}
          </p>
        )}
        {isPast && item.recordingLabel && (
          <p className="text-[11px]" style={{ color: "var(--color-accent)" }}>
            {item.recordingLabel}
          </p>
        )}
      </div>
    );
  }

  if (item.type === "challenge") {
    return (
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          className="w-full flex items-center gap-2 p-3 text-left hover:bg-accent/5 transition-colors"
          onClick={() => setOpen((o) => !o)}
        >
          {item.progressPercent !== undefined && (
            <CircularProgress pct={item.progressPercent} />
          )}
          <span
            className="text-[10px] font-bold flex-shrink-0"
            style={{ color: item.numberColor ?? "var(--color-accent)" }}
          >
            {item.numberLabel}
          </span>
          <span className="flex-1 font-semibold text-xs text-foreground line-clamp-1">
            {item.title}
          </span>
          {item.progressPercent !== undefined && (
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {item.progressPercent}%
            </span>
          )}
          {open ? (
            <ChevronUp size={12} className="text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
          )}
        </button>

        {item.progressPercent !== undefined && (
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${item.progressPercent}%`, background: "var(--color-accent)" }}
            />
          </div>
        )}

        {open && (
          <div className="divide-y divide-border">
            {item.description && (
              <p className="text-[11px] text-muted-foreground px-3 py-2.5 leading-relaxed">
                {item.description}
              </p>
            )}
            {(item.episodes ?? []).map((ep) => (
              <button
                key={ep.id}
                disabled={ep.isLocked}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                  ep.isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/5 cursor-pointer"
                )}
                onClick={() => {
                  if (ep.isLocked) return;
                  if (ep.type === "assignment") {
                    onAssignmentTabClick();
                  } else if (ep.type === "video") {
                    onEpisodeClick(ep.id);
                  }
                }}
              >
                {/* Left: order number or completed check — only for unlocked */}
                {!ep.isLocked && (
                  <div className="flex-shrink-0">
                    {ep.isCompleted
                      ? resolveEpisodeCompletedIcon(ep.completedIconType)
                      : (
                        <span className="w-4 h-4 flex items-center justify-center rounded-full border border-border text-[9px] text-muted-foreground">
                          {ep.order}
                        </span>
                      )}
                  </div>
                )}
                {/* Middle: title + type · duration */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{ep.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ep.typeLabel}
                    {ep.durationLabel ? ` · ${ep.durationLabel}` : ""}
                  </p>
                </div>
                {/* Right: lock icon — only for locked rows */}
                {ep.isLocked && resolveEpisodeLockIcon(ep.lockIconType)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default: pre-requisite and custom types — collapsible, labelColor from API
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-accent/5 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {item.label && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
              style={{ color: item.labelColor ?? "var(--color-accent)" }}
            >
              {item.label}
            </span>
          )}
          {item.title && (
            <span className="text-xs text-foreground truncate">{item.title}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {item.isCompleted && (
            <CheckCircle2 size={13} style={{ color: "var(--color-success)" }} />
          )}
          {open ? (
            <ChevronUp size={12} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={12} className="text-muted-foreground" />
          )}
        </div>
      </button>
      {open && item.description && (
        <p className="text-xs text-muted-foreground px-3 pb-3 leading-relaxed">
          {item.description}
        </p>
      )}
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
        const msUntilUnlock = unlockMs - Date.now();
        if (msUntilUnlock > 0) {
          timers.push(setTimeout(onUnlock, msUntilUnlock));
        }
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [flowItems, onUnlock]);

  return null;
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
  | { kind: "assignment"; assignmentId: string };

export default function WorkshopDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: detail, isLoading: detailLoading } = useWorkshopDetail(slug);
  const { data: flowData, isLoading: flowLoading } = useWorkshopFlow(slug);
  const { uiStrings } = useSiteConfig();

  const tabs = detail?.sidebar?.tabs ?? [];
  const [activeTab, setActiveTab] = useState<string>("");
  const [mainView, setMainView] = useState<MainView>({ kind: "default" });

  const handleLiveUrlUnlock = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["workshop-flow", slug] });
  }, [qc, slug]);

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
          ) : upcomingLiveCall ? (
            <MainAreaCountdown item={upcomingLiveCall} />
          ) : (
            <div
              className="rounded-xl border border-border border-dashed flex items-center justify-center"
              style={{ minHeight: 180 }}
            >
              <p className="text-sm text-muted-foreground text-center px-4">
                Select an episode from the sidebar to begin
              </p>
            </div>
          )}
        </div>

        {/* ── Right: Sidebar ── */}
        <div className="w-full lg:w-[280px] flex-shrink-0 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto space-y-3">
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
            <div className="space-y-3">
              {/* Collapsible progress widget */}
              <LearningProgressWidget progress={progress} />

              {/* Workshop flow label */}
              {detail.workshopFlowLabel && (
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
                  {detail.workshopFlowLabel}
                </p>
              )}

              {/* Flow items */}
              {flowLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 rounded-xl animate-pulse"
                      style={{ background: "var(--color-bg-surface)" }}
                    />
                  ))}
                </div>
              ) : (
                (flowData?.flowItems ?? []).map((item: WorkshopFlowItem) => (
                  <FlowItemRow
                    key={item.id}
                    item={item}
                    onEpisodeClick={(id) => {
                      router.push(`/episode/${slug}/${id}`);
                    }}
                    onAssignmentTabClick={() => {
                      setActiveTab("assignment");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    onLiveCallClick={(liveItem) => {
                      setMainView({ kind: "default" });
                    }}
                  />
                ))
              )}
            </div>
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

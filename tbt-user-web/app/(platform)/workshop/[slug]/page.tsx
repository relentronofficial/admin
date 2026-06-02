"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronDown, ChevronUp, CheckCircle2, Lock } from "lucide-react";
import {
  useWorkshopDetail,
  useWorkshopFlow,
  useWorkshopQa,
  usePostQa,
  usePostQaReply,
  useWorkshopAssignments,
  useSubmitAssignment,
  useEpisodePlayback,
  usePostEpisodeProgress,
} from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils/cn";
import type { WorkshopFlowItem } from "@/types";

// ─── Countdown (digit clock — unit labels from uiStrings/API) ────────────────

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
    const tick = () => setDiff(Math.max(0, target - Date.now()));
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
              className="text-4xl font-bold tabular-nums leading-none"
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

// ─── Main Area Countdown (§7.4) ───────────────────────────────────────────────
// Shows the full live-call context around the countdown clock.
// All text/colors come from the flow item — no hardcoded strings.

function MainAreaCountdown({ item }: { item: WorkshopFlowItem }) {
  const { uiStrings } = useSiteConfig();

  if (!item.scheduledAt || !item.countdownConfig) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-5 pt-5 pb-3 space-y-2">
        {/* LIVE CALL: label — color from API */}
        {item.label && (
          <p
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: item.labelColor ?? "var(--color-alert)" }}
          >
            {item.label}
          </p>
        )}

        {/* Call title */}
        {item.title && (
          <h2 className="text-lg font-bold text-foreground leading-snug">
            {item.title}
          </h2>
        )}

        {/* Facilitator name · title, then description */}
        {item.facilitatorName && (
          <div className="space-y-0.5 pt-1">
            <p className="text-sm text-muted-foreground">
              {item.facilitatorName}
              {item.facilitatorTitle ? ` · ${item.facilitatorTitle}` : ""}
            </p>
            {item.facilitatorDescription && (
              <p className="text-xs text-muted-foreground/70 leading-snug">
                {item.facilitatorDescription}
              </p>
            )}
          </div>
        )}

        {/* Prerequisite note — alert color from design system */}
        {item.prerequisiteNote && (
          <p className="text-xs pt-1" style={{ color: "var(--color-alert)" }}>
            {item.prerequisiteNote}
          </p>
        )}
      </div>

      {/* Countdown digits + stayTunedMessage */}
      <Countdown scheduledAt={item.scheduledAt} config={item.countdownConfig} />

      {/* Join button — shown when liveUrl is unlocked; label from uiStrings */}
      {item.liveUrl && (
        <div className="px-5 pb-5">
          <a
            href={item.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-bold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            {uiStrings?.liveCallJoinLabel}
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Episode Player ───────────────────────────────────────────────────────────

function EpisodePlayer({ episodeId }: { episodeId: string }) {
  const { data: playback, isLoading } = useEpisodePlayback(episodeId);
  const postProgress = usePostEpisodeProgress();
  const { uiStrings } = useSiteConfig();
  const [speed, setSpeed] = useState<string>("");
  const [quality, setQuality] = useState<string>("");

  // Initialise speed/quality once playback data arrives
  useEffect(() => {
    if (playback && !speed) setSpeed(playback.defaultSpeed);
    if (playback && !quality) setQuality(playback.defaultQuality);
  }, [playback?.id]);

  if (isLoading) {
    return <div className="aspect-video bg-black rounded-xl animate-pulse" />;
  }
  if (!playback?.videoUrl) {
    return (
      <div className="aspect-video bg-black rounded-xl flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{uiStrings?.errorGeneric}</p>
      </div>
    );
  }

  const hasQualityChoice = playback.qualityOptions.length > 1;

  return (
    <div className="space-y-3">
      {/* Player */}
      <iframe
        src={playback.videoUrl}
        className="w-full aspect-video rounded-xl border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        title={playback.title}
      />

      {/* Controls: title + speed/quality selectors + complete button */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="flex-1 font-semibold text-foreground text-sm line-clamp-1 min-w-0">
          {playback.title}
        </h3>

        {/* Speed selector — options from API */}
        <select
          value={speed}
          onChange={(e) => setSpeed(e.target.value)}
          className="bg-card border border-border text-foreground text-xs rounded-lg px-2 py-1.5 outline-none flex-shrink-0"
        >
          {playback.speedOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Quality selector — only when multiple options exist (HLS mode) */}
        {hasQualityChoice && (
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="bg-card border border-border text-foreground text-xs rounded-lg px-2 py-1.5 outline-none flex-shrink-0"
          >
            {playback.qualityOptions.map((q) => (
              <option key={q} value={q}>
                {q === "auto" ? playback.playerLabels.autoLabel : q}
              </option>
            ))}
          </select>
        )}

        {/* Complete button — label from API */}
        <button
          onClick={() =>
            postProgress.mutate({
              episodeId,
              watchedSeconds: playback.durationSeconds ?? undefined,
              isCompleted: true,
            })
          }
          disabled={postProgress.isPending}
          className="text-xs px-3 py-1.5 rounded-lg text-white font-medium flex-shrink-0 disabled:opacity-60"
          style={{ background: "var(--color-success)" }}
        >
          <CheckCircle2 size={13} className="inline mr-1" />
          {playback.playerLabels.completeLabel}
        </button>
      </div>

      {/* Description — from API, shown if present */}
      {playback.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {playback.description}
        </p>
      )}
    </div>
  );
}

// ─── Episode icon resolvers ───────────────────────────────────────────────────

function resolveEpisodeCompletedIcon(iconType?: string) {
  switch (iconType) {
    case "checkmark":
    case "checkmark_green":
    default:
      return <CheckCircle2 size={16} style={{ color: "var(--color-success)" }} />;
  }
}

function resolveEpisodeLockIcon(iconType?: string) {
  switch (iconType) {
    case "padlock":
    default:
      return <Lock size={13} className="text-muted-foreground" />;
  }
}

// ─── Flow Item Row ────────────────────────────────────────────────────────────

function FlowItemRow({
  item,
  onEpisodeClick,
}: {
  item: WorkshopFlowItem;
  onEpisodeClick: (id: string) => void;
}) {
  const [open, setOpen] = useState(item.isExpanded ?? false);
  const { uiStrings } = useSiteConfig();

  if (item.type === "live_call") {
    const isPast = item.status === "past";
    return (
      <div className="rounded-xl border border-border p-4 space-y-2">
        {/* Header: label + completed indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: item.labelColor ?? "var(--color-alert)" }}
            >
              {item.label}
            </span>
            {isPast && item.recordingAvailable && (
              <span
                className="text-[10px] px-2 py-0.5 rounded font-bold text-white"
                style={{ background: "var(--color-success)" }}
              >
                REC
              </span>
            )}
          </div>
          {item.isCompleted && (
            <CheckCircle2 size={14} style={{ color: "var(--color-success)" }} />
          )}
        </div>

        {/* Title */}
        <p className="font-semibold text-sm text-foreground">{item.title}</p>

        {/* Facilitator */}
        {item.facilitatorName && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">
              {item.facilitatorName}
              {item.facilitatorTitle ? ` · ${item.facilitatorTitle}` : ""}
            </p>
            {item.facilitatorDescription && (
              <p className="text-xs text-muted-foreground/70 leading-snug">
                {item.facilitatorDescription}
              </p>
            )}
          </div>
        )}

        {/* Prerequisite note — label color from alert */}
        {item.prerequisiteNote && (
          <p className="text-xs" style={{ color: "var(--color-alert)" }}>
            {item.prerequisiteNote}
          </p>
        )}

        {/* Upcoming: join button (if liveUrl set) or countdown */}
        {!isPast && item.scheduledAt && (
          item.liveUrl ? (
            <a
              href={item.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              {uiStrings?.liveCallJoinLabel}
            </a>
          ) : (
            item.countdownConfig && (
              <Countdown scheduledAt={item.scheduledAt} config={item.countdownConfig} />
            )
          )
        )}

        {/* Past: recording label */}
        {isPast && item.recordingLabel && (
          <p className="text-xs" style={{ color: "var(--color-accent)" }}>
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
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/5 transition-colors"
          onClick={() => setOpen((o) => !o)}
        >
          <span
            className="text-xs font-bold flex-shrink-0"
            style={{ color: item.numberColor ?? "var(--color-accent)" }}
          >
            {item.numberLabel}
          </span>
          <span className="flex-1 font-semibold text-sm text-foreground line-clamp-1">
            {item.title}
          </span>
          {item.progressPercent !== undefined && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {item.progressPercent}%
            </span>
          )}
          {open ? (
            <ChevronUp size={14} className="text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
          )}
        </button>

        {/* Progress bar */}
        {item.progressPercent !== undefined && (
          <div className="h-0.5 bg-muted mx-4">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${item.progressPercent}%`,
                background: "var(--color-accent)",
              }}
            />
          </div>
        )}

        {open && (
          <div className="divide-y divide-border">
            {/* Challenge description */}
            {item.description && (
              <p className="text-xs text-muted-foreground px-4 py-3 leading-relaxed">
                {item.description}
              </p>
            )}
            {(item.episodes ?? []).map((ep) => (
              <button
                key={ep.id}
                disabled={ep.isLocked}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  ep.isLocked
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-accent/5 cursor-pointer"
                )}
                onClick={() => !ep.isLocked && onEpisodeClick(ep.id)}
              >
                <div className="flex-shrink-0">
                  {ep.isLocked
                    ? resolveEpisodeLockIcon(ep.lockIconType)
                    : ep.isCompleted
                    ? resolveEpisodeCompletedIcon(ep.completedIconType)
                    : (
                      <span className="w-5 h-5 flex items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground">
                        {ep.order}
                      </span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{ep.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ep.typeLabel}
                    {ep.durationLabel ? ` · ${ep.durationLabel}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default: pre-requisite and any other custom type
  return (
    <div className="rounded-xl border border-border p-4 space-y-1">
      <div className="flex items-center justify-between">
        {item.label && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {item.label}
          </p>
        )}
        {item.isCompleted && (
          <CheckCircle2 size={14} style={{ color: "var(--color-success)" }} />
        )}
      </div>
      {item.description && (
        <p className="text-sm text-foreground">{item.description}</p>
      )}
    </div>
  );
}

// ─── Q&A Tab ──────────────────────────────────────────────────────────────────

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
    await postQa.mutateAsync({ slug, questionText: text.trim() });
    setText("");
    qc.invalidateQueries({ queryKey: ["workshop-qa", slug] });
  };

  const handleReply = async (postId: string) => {
    const rt = replyTexts[postId]?.trim();
    if (!rt) return;
    await postReply.mutateAsync({ postId, replyText: rt });
    setReplyTexts((prev) => ({ ...prev, [postId]: "" }));
    setReplyOpen((prev) => ({ ...prev, [postId]: false }));
    qc.invalidateQueries({ queryKey: ["workshop-qa", slug] });
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{uiStrings?.qaLoadingLabel}</p>;
  }

  const pagination = d?.pagination;
  const totalPages = Math.ceil((pagination?.total ?? 0) / (pagination?.limit ?? 20));
  const hasPrev = (pagination?.page ?? 1) > 1;
  const hasNext = (pagination?.page ?? 1) < totalPages;

  return (
    <div className="space-y-6">
      {/* Ask form */}
      <div>
        <h3 className="font-bold text-foreground mb-1">{d?.heading}</h3>
        <p className="text-sm text-muted-foreground mb-4">{d?.promptText}</p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={d?.inputPlaceholder}
            className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors"
          />
          <button
            type="submit"
            disabled={postQa.isPending}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-60 flex-shrink-0"
            style={{ background: "var(--color-accent)" }}
          >
            {d?.submitLabel}
          </button>
        </form>
      </div>

      {/* Posts list */}
      {d?.posts?.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-foreground">
            {d.communityHeadingHighlight
              ? d.communityHeading?.replace(d.communityHeadingHighlight, "")
              : d.communityHeading}
            {d.communityHeadingHighlight && (
              <span style={{ color: "var(--color-accent)" }}>
                {d.communityHeadingHighlight}
              </span>
            )}
          </h4>
          {d.posts.map((post: any) => (
            <div key={post.id} className="rounded-xl border border-border p-4 space-y-3">
              {/* Author row */}
              <div className="flex items-center gap-2">
                <QaAvatar avatarUrl={post.author?.avatarUrl} name={post.author?.name} />
                <span className="text-sm font-medium text-foreground">{post.author?.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{post.timeAgo}</span>
              </div>

              {/* Question */}
              <p className="text-sm text-foreground">{post.questionText}</p>

              {/* Replies */}
              {post.replies?.length > 0 && (
                <div className="pl-4 border-l-2 border-border space-y-3">
                  {post.replies.map((r: any) => (
                    <div key={r.id} className="flex gap-2">
                      <QaAvatar avatarUrl={r.author?.avatarUrl} name={r.author?.name} size={6} />
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-muted-foreground">{r.author?.name}</p>
                          {r.timeAgo && (
                            <span className="text-xs text-muted-foreground/60">{r.timeAgo}</span>
                          )}
                        </div>
                        <p className="text-sm text-foreground">{r.replyText}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply toggle */}
              {!replyOpen[post.id] ? (
                <button
                  onClick={() => setReplyOpen((prev) => ({ ...prev, [post.id]: true }))}
                  className="text-xs font-medium"
                  style={{ color: "var(--color-accent)" }}
                >
                  {post.replyLabel}
                </button>
              ) : (
                <div className="flex gap-2 pt-1">
                  <input
                    value={replyTexts[post.id] ?? ""}
                    onChange={(e) =>
                      setReplyTexts((prev) => ({ ...prev, [post.id]: e.target.value }))
                    }
                    placeholder={d?.inputPlaceholder}
                    className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-ring transition-colors"
                  />
                  <button
                    onClick={() => handleReply(post.id)}
                    disabled={postReply.isPending}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-60 flex-shrink-0"
                    style={{ background: "var(--color-accent)" }}
                  >
                    {d?.submitLabel}
                  </button>
                  <button
                    onClick={() => setReplyOpen((prev) => ({ ...prev, [post.id]: false }))}
                    className="text-xs text-muted-foreground px-2 hover:text-foreground"
                  >
                    {uiStrings?.assignmentCancelLabel}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrev}
            className="text-sm font-medium disabled:opacity-40"
            style={{ color: hasPrev ? "var(--color-accent)" : undefined }}
          >
            {uiStrings?.paginationPrevLabel}
          </button>
          <span className="text-xs text-muted-foreground">
            {pagination?.page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className="text-sm font-medium disabled:opacity-40"
            style={{ color: hasNext ? "var(--color-accent)" : undefined }}
          >
            {uiStrings?.paginationNextLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Assignments Tab ──────────────────────────────────────────────────────────

function AssignmentsTab({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useWorkshopAssignments(slug);
  const submit = useSubmitAssignment();
  const { uiStrings } = useSiteConfig();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  // tracks which submitted assignments the user dismissed (to allow re-submission)
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{uiStrings?.loading}</p>;
  }

  const groups = data?.groups ?? [];

  return (
    <div className="space-y-8">
      {groups.map((group: any) => (
        <div key={group.challengeLabel} className="space-y-3">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              {group.challengeLabel}
            </p>
            <h3 className="font-semibold text-foreground">{group.challengeTitle}</h3>
          </div>
          {group.assignments.map((a: any) => {
            const showSubmitted = a.submission?.isSubmitted && !dismissed[a.id];
            return (
              <div key={a.id} className="rounded-xl border border-border p-4 space-y-2">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--color-accent)" }}
                >
                  {a.typeLabel}
                </p>
                <p className="font-medium text-sm text-foreground">{a.title}</p>

                {showSubmitted ? (
                  // Submitted answer view
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      {a.submission.yourAnswerLabel}
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-line">
                      {a.submission.answerText}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="inline-flex items-center gap-1.5">
                        {resolveEpisodeCompletedIcon(a.submission.completedIcon)}
                      </span>
                      {a.submission.backLabel && (
                        <button
                          onClick={() =>
                            setDismissed((prev) => ({ ...prev, [a.id]: true }))
                          }
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {a.submission.backLabel}
                        </button>
                      )}
                    </div>
                  </div>
                ) : active === a.id ? (
                  // Answer form
                  <div className="space-y-2 pt-1">
                    <textarea
                      value={answers[a.id] ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [a.id]: e.target.value }))
                      }
                      rows={4}
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-ring resize-none transition-colors"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (!answers[a.id]?.trim()) return;
                          await submit.mutateAsync({ id: a.id, answerText: answers[a.id] });
                          qc.invalidateQueries({ queryKey: ["workshop-assignments", slug] });
                          setActive(null);
                          setDismissed((prev) => ({ ...prev, [a.id]: false }));
                        }}
                        disabled={submit.isPending}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-60"
                        style={{ background: "var(--color-accent)" }}
                      >
                        {a.submitLabel}
                      </button>
                      <button
                        onClick={() => {
                          setActive(null);
                          setDismissed((prev) => ({ ...prev, [a.id]: false }));
                        }}
                        className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent/10 transition-colors"
                      >
                        {a.cancelLabel}
                      </button>
                    </div>
                  </div>
                ) : (
                  // CTA button (also shown after dismiss, allowing re-submission)
                  <button
                    onClick={() => {
                      if (dismissed[a.id] && !answers[a.id]) {
                        setAnswers((prev) => ({
                          ...prev,
                          [a.id]: a.submission?.answerText ?? "",
                        }));
                      }
                      setActive(a.id);
                    }}
                    className="text-sm font-medium"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {a.ctaLabel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-4 w-20 rounded" style={{ background: "var(--color-bg-surface)" }} />
      <div className="h-7 w-3/4 rounded" style={{ background: "var(--color-bg-surface)" }} />
      <div className="h-20 rounded-xl" style={{ background: "var(--color-bg-surface)" }} />
      <div className="flex gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-9 w-24 rounded"
            style={{ background: "var(--color-bg-surface)" }}
          />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl"
            style={{ background: "var(--color-bg-surface)" }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkshopDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: detail, isLoading: detailLoading } = useWorkshopDetail(slug);
  const { data: flowData, isLoading: flowLoading } = useWorkshopFlow(slug);
  const { uiStrings } = useSiteConfig();

  // Initial tab comes from the first tab in the API response — not hardcoded
  const tabs = detail?.sidebar?.tabs ?? [];
  const [activeTab, setActiveTab] = useState<string>("");
  const [activeEpisode, setActiveEpisode] = useState<string | null>(null);

  // Set initial tab once detail loads
  useEffect(() => {
    if (tabs.length > 0 && !activeTab) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs.length]);

  if (detailLoading) return <DetailSkeleton />;
  if (!detail) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {uiStrings?.errorGeneric}
      </p>
    );
  }

  const progress = detail.learningProgress;

  // Find the first upcoming live call from flow (used when defaultMainAreaType === 'countdown')
  const upcomingLiveCall = detail.defaultMainAreaType === "countdown"
    ? (flowData?.flowItems ?? []).find(
        (item: WorkshopFlowItem) =>
          item.type === "live_call" && item.status !== "past" && item.scheduledAt
      )
    : null;

  const currentTabId = activeTab || tabs[0]?.id;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link — label and URL from API */}
      <Link
        href={detail.backUrl}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft size={15} />
        {detail.backLabel}
      </Link>

      {/* Workshop title */}
      <h1 className="text-2xl font-bold text-foreground leading-tight">{detail.title}</h1>

      {/* Learning progress — label from API, no hardcoded strings */}
      <div className="rounded-xl border border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{progress.label}</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: "var(--color-accent)" }}>
            {progress.percentage}%
          </p>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress.percentage}%`,
              background: "var(--color-accent)",
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {progress.completedCount}/{progress.totalCount}
        </p>
      </div>

      {/* Main area: episode player if watching, else countdown if upcoming call */}
      {activeEpisode ? (
        <div className="rounded-xl border border-border p-4 space-y-3">
          <button
            onClick={() => setActiveEpisode(null)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={13} />
            {detail.backLabel}
          </button>
          <EpisodePlayer episodeId={activeEpisode} />
        </div>
      ) : upcomingLiveCall ? (
        <MainAreaCountdown item={upcomingLiveCall} />
      ) : null}

      {/* Tabs — ids, labels, and order all from API */}
      {tabs.length > 0 && (
        <div className="border-b border-border">
          <div className="flex gap-0">
            {tabs
              .slice()
              .sort((a: any, b: any) => a.order - b.order)
              .map((tab: any) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
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
        </div>
      )}

      {/* Tab content */}
      <div>
        {/* Challenges — workshop flow label as section heading */}
        {currentTabId === "challenges" && (
          <div className="space-y-3">
            {detail.workshopFlowLabel && (
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                {detail.workshopFlowLabel}
              </h2>
            )}
            {flowLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl animate-pulse"
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
                    setActiveEpisode(id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              ))
            )}
          </div>
        )}

        {currentTabId === "qa" && <QaTab slug={slug} />}
        {currentTabId === "assignment" && <AssignmentsTab slug={slug} />}
      </div>
    </div>
  );
}

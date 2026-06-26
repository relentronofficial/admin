"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft, CheckCircle2, Play, Loader2, X, Zap, Award,
  Lock, Trophy, ChevronDown, ChevronUp, Copy, Check,
  AlertTriangle, ExternalLink, Clock, TrendingUp, RotateCcw, SkipForward,
} from "lucide-react";
import { VideoPlayer } from "@/components/features/video/VideoPlayer";
import { PlyrPlayer } from "@/components/features/video/PlyrPlayer";
import type { PlyrPlayerHandle } from "@/components/features/video/PlyrPlayer";
import { PageLoader } from "@/components/common/LoadingSpinner";
import {
  useCourse, useLessonProgress, useMarkLessonComplete,
  useSubmitCourseQuiz, useCourseXp, useCertificateEligibility,
  useCourseLeaderboard, useRequestCourseAccess,
} from "@/lib/hooks/useCourses";
import { useMe } from "@/lib/hooks/useUser";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { normalizeBunnyUrl, withResumeTime } from "@/lib/utils/format";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils/cn";
import { VideoWatermark } from "@/components/features/video/VideoWatermark";
import type { Lesson } from "@/types";

type WatchState = "not_started" | "watching" | "paused" | "completed";

function isBunnyEmbed(url: string) {
  return url.includes("mediadelivery.net");
}

// Unified "lesson already done" check used in every place resumeAtSeconds is decided.
// Four signals, any one is sufficient:
//   1. completedIds (from progress query) — authoritative DB state
//   2. lesson.isCompleted (from course query) — may be stale but usually correct
//   3. durationSeconds threshold — 85% of stored duration (fails if duration is wrong in DB)
//   4. Position heuristic — resume position ≈ total accumulated watch time (handles wrong duration metadata)
function lessonAlreadyDone(
  lessonId: string,
  completedIds: Set<string>,
  isCompleted: boolean | null | undefined,
  durationSeconds: number | null | undefined,
  actualWatchedSecs: number | null | undefined,
  resumeAtSeconds: number | null | undefined,
): boolean {
  if (completedIds.has(lessonId) || !!isCompleted) return true;
  const dur = durationSeconds ?? 0;
  const watched = actualWatchedSecs ?? 0;
  const resume = resumeAtSeconds ?? 0;
  if (dur > 0 && watched >= dur * 0.85) return true;
  // If the playhead is within 5 s of the furthest-watched mark, user is at the end of what they've seen.
  if (watched > 5 && Math.abs(resume - watched) < 5) return true;
  return false;
}

function fmtDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

interface SelectedLesson {
  id: string;
  title: string;
  videoUrl: string;
  hlsUrl?: string | null;
  durationSeconds: number;
  resumeAtSeconds?: number;
  actualWatchedSecs?: number;
  isCompleted?: boolean;
}

// ── Instructor Card ───────────────────────────────────────────────────────────
function InstructorCard({ instructor }: { instructor: { fullName: string; designation?: string | null; profilePhotoUrl?: string | null } }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {instructor.profilePhotoUrl ? (
        <img src={instructor.profilePhotoUrl} alt={instructor.fullName} className="w-10 h-10 rounded-full object-cover shrink-0" />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
          style={{ background: "color-mix(in srgb, var(--color-accent) 25%, rgba(255,255,255,0.1))" }}
        >
          {instructor.fullName[0]}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Instructor</p>
        <p className="text-sm font-semibold text-white truncate">{instructor.fullName}</p>
        {instructor.designation && (
          <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.45)" }}>{instructor.designation}</p>
        )}
      </div>
    </div>
  );
}

// ── Access Expiry Warning ─────────────────────────────────────────────────────
function ExpiryWarning({ expiresAt }: { expiresAt: string }) {
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft > 7) return null;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
      style={{
        background: "color-mix(in srgb, var(--color-alert) 12%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-alert) 30%, transparent)",
      }}
    >
      <AlertTriangle size={16} style={{ color: "var(--color-alert)", flexShrink: 0 }} />
      <p className="text-white">
        Your access expires in{" "}
        <strong>{daysLeft <= 0 ? "less than a day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}</strong>. Complete it before it expires!
      </p>
    </div>
  );
}

// ── XP + Streak Widget ────────────────────────────────────────────────────────
function XpStreakWidget({ courseId }: { courseId: string }) {
  const { data: xp } = useCourseXp(courseId);
  if (!xp || (!xp.totalXp && !xp.currentStreak)) return null;
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: "Total XP", value: xp.totalXp ?? 0, icon: <Zap size={16} />, accent: true },
        { label: "Current Streak", value: `${xp.currentStreak ?? 0}d`, icon: <TrendingUp size={16} />, accent: false },
        { label: "Best Streak", value: `${xp.longestStreak ?? 0}d`, icon: <Trophy size={16} />, accent: false },
      ].map(({ label, value, icon, accent }) => (
        <div
          key={label}
          className="rounded-xl p-3 text-center"
          style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex justify-center mb-1" style={{ color: accent ? "var(--color-accent)" : "rgba(255,255,255,0.4)" }}>
            {icon}
          </div>
          <p className="text-base font-bold text-white">{value}</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Leaderboard Widget ────────────────────────────────────────────────────────
function LeaderboardWidget({ courseId }: { courseId: string }) {
  const { data: lb } = useCourseLeaderboard(courseId);
  const [open, setOpen] = useState(false);
  if (!lb?.leaderboard?.length) return null;
  const top5 = lb.leaderboard.slice(0, 5);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <Trophy size={15} style={{ color: "var(--color-accent)" }} />
          Leaderboard
          {lb.myRank && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              #{lb.myRank}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
          : <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.4)" }} />}
      </button>
      {open && (
        <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {top5.map((entry: any, i: number) => {
            const isMe = lb.myRank === i + 1;
            return (
              <div
                key={entry.memberId ?? i}
                className="flex items-center gap-3 px-4 py-2.5 text-sm border-b last:border-b-0"
                style={{
                  borderColor: "rgba(255,255,255,0.05)",
                  background: isMe ? "color-mix(in srgb, var(--color-accent) 10%, transparent)" : "transparent",
                }}
              >
                <span
                  className="w-5 text-xs font-bold text-center shrink-0"
                  style={{ color: i < 3 ? "var(--color-accent)" : "rgba(255,255,255,0.35)" }}
                >
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <span className="flex-1 truncate" style={{ color: isMe ? "#fff" : "rgba(255,255,255,0.7)" }}>
                  {entry.name ?? "Member"}
                </span>
                <span className="text-xs font-bold flex items-center gap-1" style={{ color: "var(--color-accent)" }}>
                  <Zap size={11} />{entry.xp ?? 0}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Related Courses ───────────────────────────────────────────────────────────
function RelatedCourses({ courses, title }: { courses: any[]; title: string }) {
  if (!courses?.length) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-white mb-3">{title}</p>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {courses.map((c: any) => (
          <a
            key={c.id}
            href={`/learning/${c.id}`}
            className="shrink-0 w-48 rounded-xl overflow-hidden group"
            style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="aspect-video relative overflow-hidden">
              {c.thumbnailUrl ? (
                <img
                  src={c.thumbnailUrl}
                  alt={c.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <Play size={20} style={{ color: "var(--color-accent)" }} />
                </div>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-xs font-medium text-white line-clamp-2 leading-snug">{c.title}</p>
              {c.price != null && Number(c.price) > 0 && (
                <p className="text-xs mt-1 font-semibold" style={{ color: "var(--color-accent)" }}>
                  ₹{Number(c.price).toLocaleString("en-IN")}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Paywall View ──────────────────────────────────────────────────────────────
function PaywallView({ course: courseRaw, courseId }: { course: any; courseId: string }) {
  const course = courseRaw as any;
  const requestAccess = useRequestCourseAccess();
  const lessons = course.lessons ?? [];

  const handleGetAccess = async () => {
    if (course.paymentLinkUrl) {
      window.open(course.paymentLinkUrl, "_blank");
      return;
    }
    try {
      const res = await requestAccess.mutateAsync(courseId);
      const { paymentUrl } = (res as any).data ?? res;
      if (paymentUrl) window.open(paymentUrl, "_blank");
      else toast.success("Access request sent! We'll notify you shortly.");
    } catch (e: any) {
      toast.error(e.message || "Failed to request access.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div
        className="relative w-full aspect-video rounded-xl overflow-hidden"
        style={{ background: "var(--color-bg-surface)" }}
      >
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Lock size={48} style={{ color: "rgba(255,255,255,0.2)" }} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6">
          <h1 className="text-2xl font-bold text-white leading-tight">{course.title}</h1>
          {course.description && (
            <p className="text-sm mt-1 line-clamp-2" style={{ color: "rgba(255,255,255,0.65)" }}>
              {course.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-3">
            {course.level && (
              <span
                className="text-xs capitalize px-2.5 py-1 rounded-full font-medium"
                style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
              >
                {course.level}
              </span>
            )}
            {lessons.length > 0 && (
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Instructor */}
      {course.instructor && <InstructorCard instructor={course.instructor} />}

      {/* Purchase CTA */}
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.09)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
              Get Access
            </p>
            {course.price != null && Number(course.price) > 0 ? (
              <p className="text-3xl font-bold text-white mt-1">
                ₹{Number(course.price).toLocaleString("en-IN")}
              </p>
            ) : (
              <p className="text-lg font-semibold text-white mt-1">Contact us for pricing</p>
            )}
            {course.accessType === "lifetime" ? (
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>Lifetime access</p>
            ) : course.accessDurationDays ? (
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>
                {course.accessDurationDays}-day access
              </p>
            ) : null}
          </div>
          <Lock size={32} style={{ color: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
        </div>

        {course.pendingPayment ? (
          <div className="space-y-3">
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
              style={{
                background: "color-mix(in srgb, var(--color-alert) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-alert) 25%, transparent)",
              }}
            >
              <Loader2 size={14} style={{ color: "var(--color-alert)" }} className="animate-spin" />
              <span style={{ color: "rgba(255,255,255,0.75)" }}>Payment pending — awaiting confirmation</span>
            </div>
            {course.pendingPayment.paymentUrl && (
              <button
                onClick={() => window.open(course.pendingPayment.paymentUrl, "_blank")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ border: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)", color: "var(--color-accent)" }}
              >
                <ExternalLink size={14} /> Complete Payment
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={handleGetAccess}
            disabled={requestAccess.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--color-accent)" }}
          >
            {requestAccess.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Processing...</>
            ) : (
              <>{course.paymentLinkUrl ? <ExternalLink size={14} /> : <Lock size={14} />} Get Access</>
            )}
          </button>
        )}
      </div>

      {/* Locked lesson preview */}
      {lessons.length > 0 && (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div
            className="px-4 py-3 border-b text-sm font-semibold"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "var(--color-bg-surface)", color: "rgba(255,255,255,0.7)" }}
          >
            {lessons.length} {lessons.length === 1 ? "Lesson" : "Lessons"} — Preview
          </div>
          <div>
            {lessons.map((lesson: any, idx: number) => (
              <div
                key={lesson.id}
                className="flex items-center gap-4 px-4 py-4 border-b last:border-b-0"
                style={{ borderColor: "rgba(255,255,255,0.06)", background: "var(--color-bg-surface)" }}
              >
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {lesson.title}
                  </p>
                  {lesson.durationSeconds > 0 && (
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "rgba(255,255,255,0.28)" }}>
                      <Clock size={10} /> {fmtDuration(lesson.durationSeconds)}
                    </p>
                  )}
                </div>
                <Lock size={13} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upsell */}
      {course.upsellCourses?.length > 0 && (
        <RelatedCourses courses={course.upsellCourses} title="You might also like" />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetLessonId = searchParams.get("lesson");
  const { uiStrings } = useSiteConfig();
  const { data: course, isLoading } = useCourse(courseId);
  const { data: progressList } = useLessonProgress(courseId);
  const markComplete = useMarkLessonComplete(courseId);
  const { data: me } = useMe();

  const [selectedLesson, setSelectedLesson] = useState<SelectedLesson | null>(null);
  const [watchState, setWatchState] = useState<WatchState>("not_started");
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [liveWatched, setLiveWatched] = useState<number>(0);
  const [liveRealDuration, setLiveRealDuration] = useState<number>(0);
  const [hlsFailed, setHlsFailed] = useState(false);
  const [upNextCountdown, setUpNextCountdown] = useState<number | null>(null);
  const [videoKey, setVideoKey] = useState(0);
  const topRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<PlyrPlayerHandle | null>(null);
  const [certCopied, setCertCopied] = useState(false);

  // Quiz modal state
  const [quizModal, setQuizModal] = useState<{ episodeId: string; quizData: any } | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [xpFlash, setXpFlash] = useState<number | null>(null);
  const [downloadingCert, setDownloadingCert] = useState(false);
  const submitQuiz = useSubmitCourseQuiz(courseId, quizModal?.episodeId ?? "");
  const { data: certData } = useCertificateEligibility(courseId);

  // Auto-select lesson from URL parameter once course data loads
  useEffect(() => {
    if (course?.lessons && targetLessonId && !selectedLesson) {
      const target = course.lessons.find((l: any) => l.id === targetLessonId);
      if (target && target.videoUrl) {
        const alreadyDone = lessonAlreadyDone(
          target.id, completedIds, (target as any).isCompleted,
          target.durationSeconds, (target as any).actualWatchedSecs, (target as any).resumeAtSeconds,
        );
        setSelectedLesson({
          id: target.id,
          title: target.title,
          videoUrl: target.videoUrl,
          hlsUrl: (target as any).hlsUrl ?? null,
          durationSeconds: target.durationSeconds ?? 0,
          resumeAtSeconds: alreadyDone ? 0 : ((target as any).resumeAtSeconds ?? 0),
          actualWatchedSecs: (target as any).actualWatchedSecs ?? 0,
          isCompleted: alreadyDone,
        });
      }
    }
  }, [course, targetLessonId, selectedLesson]);

  // Show quiz modal on first episode completion
  const quizTriggeredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (watchState === "completed" && selectedLesson && !quizTriggeredForRef.current) {
      const lesson = course?.lessons?.find((l: any) => l.id === selectedLesson.id);
      if (lesson?.hasQuiz) {
        quizTriggeredForRef.current = selectedLesson.id;
        setQuizModal({ episodeId: selectedLesson.id, quizData: lesson });
        setQuizAnswers({});
        setQuizResult(null);
      }
    }
    if (!selectedLesson || watchState !== "completed") {
      quizTriggeredForRef.current = null;
    }
  }, [watchState, selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tracking refs ────────────────────────────────────────────────────────────
  const markCalledRef = useRef(false);
  const selectedLessonRef = useRef<SelectedLesson | null>(null);
  selectedLessonRef.current = selectedLesson;
  const courseRef = useRef<any>(null);
  courseRef.current = course;

  const realDurationRef = useRef<number>(0);
  const liveWatchedRef = useRef<number>(0);
  const lastHeartbeatWatchedRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isHiddenRef = useRef<boolean>(false);
  const isSeekingRef = useRef<boolean>(false);
  const seekClearRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastPlayheadRef = useRef<number>(0);
  const speedRef = useRef<number>(1);
  const doMarkCompleteRef = useRef<boolean>(false);
  const upNextTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Stable up-next trigger via ref to avoid stale closures inside intervals
  const triggerUpNextRef = useRef<() => void>(() => {});
  triggerUpNextRef.current = useCallback(() => {
    clearInterval(upNextTimerRef.current);
    const lessons = courseRef.current?.lessons ?? [];
    const currentIdx = lessons.findIndex((l: any) => l.id === selectedLessonRef.current?.id);
    if (currentIdx < 0 || currentIdx >= lessons.length - 1) return;
    let n = 5;
    setUpNextCountdown(n);
    upNextTimerRef.current = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(upNextTimerRef.current);
        setUpNextCountdown(null);
        const next = lessons[currentIdx + 1];
        if (next?.videoUrl) {
          const nextDone = lessonAlreadyDone(
            next.id, completedIdsRef.current, (next as any).isCompleted,
            next.durationSeconds, (next as any).actualWatchedSecs, (next as any).resumeAtSeconds,
          );
          setSelectedLesson({
            id: next.id,
            title: next.title,
            videoUrl: next.videoUrl,
            hlsUrl: (next as any).hlsUrl ?? null,
            durationSeconds: next.durationSeconds ?? 0,
            resumeAtSeconds: nextDone ? 0 : ((next as any).resumeAtSeconds ?? 0),
            actualWatchedSecs: (next as any).actualWatchedSecs ?? 0,
            isCompleted: nextDone,
          });
          topRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        setUpNextCountdown(n);
      }
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const completedIds = new Set(
    progressList?.filter((p) => p.completed).map((p) => p.lessonId) ?? []
  );
  const completedIdsRef = useRef<Set<string>>(new Set());
  completedIdsRef.current = completedIds;

  // When server data arrives and contradicts a stale-cache "completed" state,
  // correct watchState so the user can actually re-watch the lesson.
  useEffect(() => {
    if (!selectedLesson || watchState === "watching" || watchState === "not_started") return;
    const done = lessonAlreadyDone(
      selectedLesson.id, completedIds, selectedLesson.isCompleted,
      selectedLesson.durationSeconds, selectedLesson.actualWatchedSecs, selectedLesson.resumeAtSeconds,
    );
    if (!done && watchState === "completed" && !doMarkCompleteRef.current) {
      setWatchState("not_started");
      markCalledRef.current = false;
    }
  }, [completedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset all tracking state on lesson change
  useEffect(() => {
    realDurationRef.current = 0;
    liveWatchedRef.current = 0;
    lastHeartbeatWatchedRef.current = 0;
    isPlayingRef.current = false;
    isSeekingRef.current = false;
    speedRef.current = 1;
    doMarkCompleteRef.current = false;
    clearTimeout(seekClearRef.current);
    clearInterval(upNextTimerRef.current);
    setLiveWatched(0);
    setLiveRealDuration(0);
    setHlsFailed(false);
    setUpNextCountdown(null);

    if (!selectedLesson) return;
    lastPlayheadRef.current = selectedLesson.resumeAtSeconds ?? 0;
    const alreadyDone = lessonAlreadyDone(
      selectedLesson.id, completedIdsRef.current, selectedLesson.isCompleted,
      selectedLesson.durationSeconds, selectedLesson.actualWatchedSecs, selectedLesson.resumeAtSeconds,
    );
    setWatchState(alreadyDone ? "completed" : "not_started");
    setWatchedSeconds(selectedLesson.resumeAtSeconds ?? 0);
    // Only suppress future API calls when the server has authoritatively confirmed completion.
    // Heuristic signals (threshold / position) show the right UI but still need a backend sync.
    const serverConfirmed = completedIdsRef.current.has(selectedLesson.id) || !!selectedLesson.isCompleted;
    markCalledRef.current = serverConfirmed;
  }, [selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the player reports the real video duration, re-evaluate completion using
  // accurate duration (overrides wrong durationSeconds stored in DB).
  useEffect(() => {
    if (!selectedLesson || liveRealDuration <= 0) return;
    if (selectedLesson.isCompleted || completedIds.has(selectedLesson.id)) return;
    if (markCalledRef.current) return;
    const watched = selectedLesson.actualWatchedSecs ?? 0;
    if (watched < liveRealDuration * 0.85) return;
    setWatchState("completed");
    markCalledRef.current = true;
    markComplete.mutate({ lessonId: selectedLesson.id, watchedSeconds: Math.floor(watched), isCompleted: true, videoDuration: liveRealDuration });
  }, [liveRealDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Native VideoPlayer callbacks ─────────────────────────────────────────────
  const handleVideoReady = (duration: number) => {
    realDurationRef.current = duration;
    setLiveRealDuration(duration);
  };

  const handleVideoPlay = () => {
    isPlayingRef.current = true;
    setWatchState((prev) => (prev === "completed" ? "completed" : "watching"));
  };

  const handleVideoPause = () => {
    isPlayingRef.current = false;
    setWatchState((prev) => (prev === "completed" ? "completed" : "paused"));
  };

  const handleVideoSeeked = () => {
    isSeekingRef.current = true;
    clearTimeout(seekClearRef.current);
    seekClearRef.current = setTimeout(() => { isSeekingRef.current = false; }, 800);
  };

  const handleVideoProgress = (s: number) => {
    lastPlayheadRef.current = s;
    setWatchedSeconds(s);
  };

  const handleVideoSpeedChange = (s: number) => {
    speedRef.current = s;
  };

  const handleVideoEnded = () => {
    isPlayingRef.current = false;
    const lesson = selectedLessonRef.current;
    if (!lesson) return;
    // Always update UI when video ends — regardless of whether heartbeat already called the API.
    setWatchState("completed");
    triggerUpNextRef.current();
    // Only send the API call if the heartbeat hasn't already done so.
    if (!markCalledRef.current) {
      markCalledRef.current = true;
      doMarkCompleteRef.current = false;
      markComplete.mutate({ lessonId: lesson.id, watchedSeconds: Math.floor(lastPlayheadRef.current), isCompleted: true, videoDuration: realDurationRef.current > 0 ? realDurationRef.current : undefined });
    }
  };

  // ── Bunny iframe message handler — only runs when HLS is unavailable or failed ──
  useEffect(() => {
    if (!selectedLesson || !isBunnyEmbed(selectedLesson.videoUrl)) return;
    if (selectedLesson.hlsUrl && !hlsFailed) return;

    const BUNNY_ORIGIN = "https://iframe.mediadelivery.net";

    const doMarkComplete = () => {
      const lesson = selectedLessonRef.current;
      if (!lesson) return;
      isPlayingRef.current = false;
      doMarkCompleteRef.current = false;
      setWatchState("completed");
      triggerUpNextRef.current();
      if (!markCalledRef.current) {
        markCalledRef.current = true;
        markComplete.mutate({ lessonId: lesson.id, isCompleted: true, watchedSeconds: Math.floor(lastPlayheadRef.current), videoDuration: realDurationRef.current > 0 ? realDurationRef.current : undefined });
      }
    };

    const handler = (e: MessageEvent) => {
      if (e.origin && !e.origin.includes("mediadelivery.net")) return;

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
        ["play", "pause", "timeupdate", "ended", "seeked"].forEach((eventName) => {
          win.postMessage(
            JSON.stringify({ context: "player.js", method: "addEventListener", value: eventName }),
            BUNNY_ORIGIN
          );
        });
        // Request actual video duration and current time (to detect auto-play already in progress)
        win.postMessage(JSON.stringify({ context: "player.js", method: "getDuration" }), BUNNY_ORIGIN);
        win.postMessage(JSON.stringify({ context: "player.js", method: "getCurrentTime" }), BUNNY_ORIGIN);
        win.postMessage(JSON.stringify({ context: "player.js", method: "isPaused" }), BUNNY_ORIGIN);
        return;
      }

      const isPlay = evt === "play" || evt === "playing" || evt === "onplay" || evt === "start"
        || evt === "autoplay" || evt === "autoplaystart";
      const isEnd = evt === "ended" || evt === "end" || evt === "finish" || evt === "onfinish" || evt === "complete" || evt === "onended";
      const isPause = evt === "pause" || evt === "paused" || evt === "onpause";
      const isTimeUpdate = evt === "timeupdate";
      const isSeeked = evt === "seeked";

      // Handle getDuration response from Bunny Player.js API
      if (evt === "getduration" && payloadValue !== undefined) {
        const dur = typeof payloadValue === "number" ? payloadValue : Number(payloadValue);
        if (dur > 0 && realDurationRef.current === 0) {
          realDurationRef.current = dur;
          setLiveRealDuration(dur);
        }
      }

      // Detect if player was already playing when our handler registered (e.g. autoplay)
      if (evt === "getcurrenttime" && payloadValue !== undefined) {
        const ct = typeof payloadValue === "number" ? payloadValue : Number(payloadValue);
        if (ct > 0) {
          lastPlayheadRef.current = ct;
          isPlayingRef.current = true;
          setWatchState((s) => (s === "completed" ? "completed" : "watching"));
        }
      }
      if (evt === "ispaused" && payloadValue === false) {
        isPlayingRef.current = true;
        setWatchState((s) => (s === "completed" ? "completed" : "watching"));
      }

      if (isTimeUpdate && payloadValue !== undefined) {
        const currentTime = typeof payloadValue === "number" ? payloadValue : payloadValue.seconds;
        if (currentTime !== undefined) {
          lastPlayheadRef.current = currentTime;
          setWatchedSeconds(Math.floor(currentTime));
        }
        // Fallback: some Bunny versions include duration in the timeupdate payload
        if (typeof payloadValue === "object" && payloadValue.duration > 0 && realDurationRef.current === 0) {
          realDurationRef.current = payloadValue.duration;
          setLiveRealDuration(payloadValue.duration);
        }
      }

      if (isSeeked) {
        isSeekingRef.current = true;
        clearTimeout(seekClearRef.current);
        seekClearRef.current = setTimeout(() => { isSeekingRef.current = false; }, 800);
      }

      if (isPlay && !isEnd) {
        isPlayingRef.current = true;
        setWatchState((s) => (s === "completed" ? "completed" : "watching"));
      } else if (isPause && !isEnd) {
        isPlayingRef.current = false;
        setWatchState((s) => (s === "completed" ? "completed" : "paused"));
      }

      if (isEnd) doMarkComplete();
    };

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      isPlayingRef.current = false;
    };
  }, [selectedLesson?.id, hlsFailed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 1-second tick + tab visibility + beforeunload ────────────────────────────
  useEffect(() => {
    if (!selectedLesson) return;

    const handleVisibility = () => { isHiddenRef.current = document.hidden; };
    document.addEventListener("visibilitychange", handleVisibility);

    const handleBeforeUnload = () => {
      const lesson = selectedLessonRef.current;
      if (!lesson || !isPlayingRef.current) return;
      const delta = Math.min(liveWatchedRef.current - lastHeartbeatWatchedRef.current, 30);
      if (delta <= 0) return;
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      fetch(`${apiBase}/api/user/enrollments/${courseId}/progress/${lesson.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify({
          watchedSeconds: Math.floor(lastPlayheadRef.current),
          deltaSeconds: delta,
        }),
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    const tick = setInterval(() => {
      if (!isPlayingRef.current || isHiddenRef.current || isSeekingRef.current) return;
      liveWatchedRef.current += speedRef.current;
      setLiveWatched(Math.floor(liveWatchedRef.current));
    }, 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(tick);
    };
  }, [selectedLesson?.id, courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 5-second heartbeat ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedLesson) return;

    const hb = setInterval(() => {
      if (!isPlayingRef.current) return;
      const lesson = selectedLessonRef.current;
      if (!lesson || markCalledRef.current) return;

      const delta = Math.min(liveWatchedRef.current - lastHeartbeatWatchedRef.current, 30);
      if (delta <= 0) return;
      lastHeartbeatWatchedRef.current = liveWatchedRef.current;

      const activeDuration = realDurationRef.current > 0 ? realDurationRef.current : lesson.durationSeconds;
      const threshold = activeDuration > 0 ? activeDuration * 0.85 : 90;
      const knownSecs = lesson.actualWatchedSecs ?? 0;
      const shouldComplete = doMarkCompleteRef.current || (knownSecs + liveWatchedRef.current) >= threshold;

      markComplete.mutate(
        {
          lessonId: lesson.id,
          watchedSeconds: Math.floor(lastPlayheadRef.current),
          deltaSeconds: delta,
          isCompleted: shouldComplete || undefined,
          videoDuration: realDurationRef.current > 0 ? realDurationRef.current : undefined,
        },
        {
          onSuccess: (res: any) => {
            const d = res?.data ?? res;
            // Only sync the server-reported watch count; UI completion is driven by handleVideoEnded.
            if (typeof d?.actualWatchedSecs === "number" && d.actualWatchedSecs > liveWatchedRef.current) {
              liveWatchedRef.current = d.actualWatchedSecs;
              lastHeartbeatWatchedRef.current = d.actualWatchedSecs;
              setLiveWatched(Math.floor(d.actualWatchedSecs));
            }
          },
        }
      );

      if (shouldComplete && !markCalledRef.current) {
        doMarkCompleteRef.current = false;
        markCalledRef.current = true;
        // Backend now knows it's complete; UI will transition when the video actually ends.
      }
    }, 5000);

    return () => clearInterval(hb);
  }, [selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <PageLoader />;
  if (!course) {
    return (
      <p className="text-center py-16 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
        {uiStrings?.errorGeneric ?? "Course not found."}
      </p>
    );
  }

  // Paywall — course not purchased
  if (!course.hasAccess) {
    return <PaywallView course={course} courseId={courseId} />;
  }

  const lessons: Lesson[] = course.lessons ?? [];

  // Next lesson for up-next UI
  const currentLessonIdx = lessons.findIndex((l: any) => l.id === selectedLesson?.id);
  const nextLesson = currentLessonIdx >= 0 && currentLessonIdx < lessons.length - 1
    ? lessons[currentLessonIdx + 1]
    : null;

  const handleSelectLesson = (lesson: any) => {
    if (!lesson.videoUrl) return;
    setVideoKey(0);
    const alreadyDone = lessonAlreadyDone(
      lesson.id, completedIds, lesson.isCompleted,
      lesson.durationSeconds, lesson.actualWatchedSecs, lesson.resumeAtSeconds,
    );
    setSelectedLesson({
      id: lesson.id,
      title: lesson.title,
      videoUrl: lesson.videoUrl,
      hlsUrl: lesson.hlsUrl ?? null,
      durationSeconds: lesson.durationSeconds ?? 0,
      resumeAtSeconds: alreadyDone ? 0 : (lesson.resumeAtSeconds ?? 0),
      actualWatchedSecs: lesson.actualWatchedSecs ?? 0,
      isCompleted: alreadyDone,
    });
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleRewatch = () => {
    if (!selectedLesson) return;
    clearInterval(upNextTimerRef.current);
    setUpNextCountdown(null);
    liveWatchedRef.current = 0;
    lastHeartbeatWatchedRef.current = 0;
    setLiveWatched(0);
    setWatchState("not_started");
    // markCalledRef stays true so we don't re-trigger completion
    setVideoKey((k) => k + 1);
  };

  const handleShareCert = async () => {
    if (!me?.id) return;
    const certId = btoa(`${me.id}:${courseId}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const url = `${window.location.origin}/verify/course/${certId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCertCopied(true);
      setTimeout(() => setCertCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const activeDuration = liveRealDuration > 0 ? liveRealDuration : (selectedLesson?.durationSeconds ?? 0);

  const statusBadge = (() => {
    if (!selectedLesson) return null;
    const cumulativeWatched = Math.max(liveWatched, selectedLesson.actualWatchedSecs ?? 0);
    const progressPct = activeDuration > 0
      ? Math.min(100, Math.round((cumulativeWatched / activeDuration) * 100))
      : 0;

    if (watchState === "completed" || selectedLesson.isCompleted) return {
      label: "Completed",
      icon: <CheckCircle2 size={15} />,
      bg: "var(--color-success)",
      pct: 100,
    };
    if (watchState === "watching") return {
      label: "Watching...",
      icon: <Loader2 size={15} className="animate-spin" />,
      bg: "var(--color-alert)",
      pct: progressPct,
    };
    return {
      label: "Not Started",
      icon: <Play size={15} fill="currentColor" />,
      bg: "rgba(255,255,255,0.10)",
      pct: progressPct,
    };
  })();

  return (
    <div className="space-y-6 pb-12">
      {/* Back */}
      <button
        onClick={() => { selectedLesson ? setSelectedLesson(null) : router.back(); }}
        className="inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-100"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        <ChevronLeft size={16} />
        {selectedLesson ? course.title : "Back"}
      </button>

      {/* Access expiry warning */}
      {course.accessExpiresAt && course.accessType !== "lifetime" && (
        <ExpiryWarning expiresAt={course.accessExpiresAt} />
      )}

      {/* Top area */}
      <div ref={topRef}>
        {selectedLesson ? (
          <div className="space-y-4">
            <VideoWatermark
              className="w-full aspect-video rounded-xl overflow-hidden relative bg-black"
              containerId="course-video-root"
              showFullscreenButton={!!(selectedLesson.hlsUrl || isBunnyEmbed(selectedLesson.videoUrl))}
            >
              {selectedLesson.hlsUrl && !hlsFailed ? (
                <PlyrPlayer
                  ref={playerRef}
                  key={`${selectedLesson.id}-${videoKey}`}
                  hlsUrl={selectedLesson.hlsUrl}
                  startAt={videoKey > 0 ? 0 : (selectedLesson.resumeAtSeconds ?? 0)}
                  autoplay={true}
                  className="absolute inset-0 w-full h-full bg-black"
                  onReady={handleVideoReady}
                  onTimeUpdate={handleVideoProgress}
                  onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                  onEnded={handleVideoEnded}
                  onSpeedChange={handleVideoSpeedChange}
                  onError={() => setHlsFailed(true)}
                />
              ) : isBunnyEmbed(selectedLesson.videoUrl) ? (
                <iframe
                  key={`${selectedLesson.id}-${videoKey}-iframe`}
                  src={withResumeTime(normalizeBunnyUrl(selectedLesson.videoUrl) + "&autoplay=true", videoKey > 0 ? 0 : (selectedLesson.resumeAtSeconds ?? 0))}
                  className="w-full h-full border-0"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media"
                  title={selectedLesson.title}
                />
              ) : (
                <VideoPlayer
                  key={`${selectedLesson.id}-${videoKey}`}
                  src={selectedLesson.videoUrl}
                  lessonId={selectedLesson.id}
                  resumeAtSeconds={videoKey > 0 ? 0 : (selectedLesson.resumeAtSeconds ?? 0)}
                  onReady={handleVideoReady}
                  onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                  onSeeked={handleVideoSeeked}
                  onProgress={handleVideoProgress}
                  onSpeedChange={handleVideoSpeedChange}
                  onEnded={handleVideoEnded}
                />
              )}
            </VideoWatermark>

            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-white leading-snug">{selectedLesson.title}</h2>
              {statusBadge && (
                <div
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
                  style={{ background: statusBadge.bg, color: "#fff" }}
                >
                  {statusBadge.icon}
                  {statusBadge.label}
                  {statusBadge.pct < 100 && statusBadge.pct > 0 && ` (${statusBadge.pct}%)`}
                </div>
              )}
            </div>

            {/* Up-next countdown */}
            {upNextCountdown !== null && nextLesson && (
              <div
                className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-surface))",
                  border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <SkipForward size={14} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                  <span className="truncate" style={{ color: "rgba(255,255,255,0.7)" }}>
                    Next: <span className="text-white font-medium">{nextLesson.title}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold" style={{ color: "var(--color-accent)" }}>
                    {upNextCountdown}s
                  </span>
                  <button
                    onClick={() => { clearInterval(upNextTimerRef.current); setUpNextCountdown(null); }}
                    className="text-xs px-2 py-1 rounded-md transition-opacity hover:opacity-70"
                    style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Rewatch button (only when completed and not counting down) */}
            {watchState === "completed" && upNextCountdown === null && (
              <button
                onClick={handleRewatch}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.45)" }}
              >
                <RotateCcw size={11} /> Rewatch from start
              </button>
            )}
          </div>
        ) : (
          /* Course banner */
          <div>
            <div
              className="relative w-full aspect-video rounded-xl overflow-hidden"
              style={{ background: "var(--color-bg-surface)" }}
            >
              {course.thumbnailUrl ? (
                <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play size={48} style={{ color: "var(--color-accent)" }} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-6">
                <h1 className="text-2xl font-bold text-white leading-tight">{course.title}</h1>
                {course.description && (
                  <p className="text-sm mt-1 line-clamp-2" style={{ color: "rgba(255,255,255,0.65)" }}>
                    {course.description}
                  </p>
                )}
                <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {completedIds.size} / {lessons.length} completed
                </p>
              </div>
            </div>
            {course.instructor && (
              <div className="mt-3">
                <InstructorCard instructor={course.instructor} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lesson list */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div
          className="px-4 py-3 border-b text-sm font-semibold"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "var(--color-bg-surface)", color: "rgba(255,255,255,0.7)" }}
        >
          {lessons.length} {lessons.length === 1 ? "Lesson" : "Lessons"}
          {completedIds.size > 0 && (
            <span className="ml-2 text-xs font-normal" style={{ color: "rgba(255,255,255,0.35)" }}>
              · {completedIds.size} done
            </span>
          )}
        </div>

        <div>
          {lessons.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No lessons available yet.
            </p>
          ) : (
            lessons.map((lesson, idx) => {
              const isCompleted = completedIds.has(lesson.id);
              const isActive = selectedLesson?.id === lesson.id;
              const hasVideo = !!lesson.videoUrl;
              const duration = isActive && liveRealDuration > 0 ? liveRealDuration : (lesson.durationSeconds ?? 0);
              const activeLessonDuration = (isActive && activeDuration > 0 ? activeDuration : duration) ?? 0;
              const livePct = isActive && liveWatched > 0 && activeLessonDuration > 0
                ? Math.min(100, Math.round((liveWatched / activeLessonDuration) * 100))
                : 0;

              return (
                <button
                  key={lesson.id}
                  onClick={() => hasVideo && handleSelectLesson(lesson)}
                  disabled={!hasVideo}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-4 text-left transition-colors border-b last:border-b-0",
                    hasVideo ? "cursor-pointer hover:opacity-90" : "cursor-default opacity-50"
                  )}
                  style={{
                    borderColor: "rgba(255,255,255,0.06)",
                    background: isActive
                      ? "color-mix(in srgb, var(--color-accent) 18%, var(--color-bg-surface))"
                      : "var(--color-bg-surface)",
                  }}
                >
                  <span
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: isCompleted ? "var(--color-success)" : isActive ? "var(--color-accent)" : "rgba(255,255,255,0.08)",
                      color: isCompleted || isActive ? "#fff" : "rgba(255,255,255,0.45)",
                    }}
                  >
                    {isCompleted ? <CheckCircle2 size={14} /> : idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.85)" }}>
                      {lesson.title}
                    </p>
                    {duration && duration > 0 ? (
                      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                        <Clock size={10} /> {fmtDuration(duration)}
                      </p>
                    ) : lesson.description ? (
                      <p className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                        {lesson.description}
                      </p>
                    ) : null}
                    {/* Live progress bar for active lesson */}
                    {isActive && livePct > 0 && (
                      <div className="h-0.5 rounded-full overflow-hidden mt-1.5" style={{ background: "rgba(255,255,255,0.1)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${livePct}%`, background: "var(--color-accent)" }}
                        />
                      </div>
                    )}
                  </div>

                  {isActive ? (
                    <Play size={14} fill="currentColor" style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                  ) : isCompleted ? (
                    <CheckCircle2 size={15} style={{ color: "var(--color-success)", flexShrink: 0 }} />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* XP + Streak */}
      <XpStreakWidget courseId={courseId} />

      {/* Leaderboard */}
      <LeaderboardWidget courseId={courseId} />

      {/* Certificate CTA */}
      {certData?.eligible && (
        <div
          className="rounded-xl p-5 flex items-center gap-4"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-surface))",
            border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
          }}
        >
          <div
            className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--color-accent) 20%, transparent)" }}
          >
            <Award size={24} style={{ color: "var(--color-accent)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm">You completed this course!</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
              Your certificate of completion is ready.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {me?.id && (
              <button
                onClick={handleShareCert}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                style={{
                  border: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)",
                  color: "var(--color-accent)",
                }}
                title="Copy shareable link"
              >
                {certCopied ? <Check size={13} /> : <Copy size={13} />}
                {certCopied ? "Copied!" : "Share"}
              </button>
            )}
            <button
              disabled={downloadingCert}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "var(--color-accent)" }}
              onClick={async () => {
                setDownloadingCert(true);
                try {
                  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
                  const res = await fetch(`${apiBase}/api/user/courses/${courseId}/certificate`, { credentials: "include" });
                  if (!res.ok) { toast.error("Certificate not ready yet."); return; }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `certificate-${courseId}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast.error("Failed to download certificate.");
                } finally {
                  setDownloadingCert(false);
                }
              }}
            >
              {downloadingCert ? <Loader2 size={13} className="animate-spin" /> : <Award size={13} />}
              {downloadingCert ? "Preparing..." : "Download"}
            </button>
          </div>
        </div>
      )}

      {/* Related courses */}
      {(course as any).upsellCourses?.length > 0 && (
        <RelatedCourses courses={(course as any).upsellCourses} title="You might also like" />
      )}
      {(course as any).crossSellCourses?.length > 0 && (
        <RelatedCourses courses={(course as any).crossSellCourses} title="Related Courses" />
      )}

      {/* XP flash */}
      {xpFlash !== null && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl font-bold text-white text-sm animate-bounce"
          style={{ background: "var(--color-accent)" }}
        >
          <Zap size={16} /> +{xpFlash} XP earned!
        </div>
      )}

      {/* Quiz modal */}
      {quizModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>Episode Quiz</p>
                <p className="text-sm font-semibold text-white mt-0.5">{quizModal.quizData?.title ?? "Quiz"}</p>
              </div>
              {!quizResult && (
                <button onClick={() => setQuizModal(null)} className="text-white/40 hover:text-white/70 transition-colors">
                  <X size={18} />
                </button>
              )}
            </div>

            {quizResult ? (
              <div className="p-6 text-center space-y-4">
                <div className={`text-5xl font-bold ${quizResult.passed ? "text-green-400" : "text-red-400"}`}>
                  {quizResult.score}%
                </div>
                <p className="text-white font-semibold">{quizResult.passed ? "🎉 Passed!" : "Not quite — try again"}</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {quizResult.correct} / {quizResult.total} correct
                </p>
                {quizResult.passed && xpFlash !== null && (
                  <div className="flex items-center justify-center gap-1.5 text-sm font-bold" style={{ color: "var(--color-accent)" }}>
                    <Zap size={14} /> +{xpFlash} XP awarded
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  {!quizResult.passed && (
                    <button
                      onClick={() => { setQuizAnswers({}); setQuizResult(null); }}
                      className="flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors"
                      style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
                    >
                      Try Again
                    </button>
                  )}
                  <button
                    onClick={() => { setQuizModal(null); setQuizResult(null); }}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                    style={{ background: "var(--color-accent)" }}
                  >
                    {quizResult.passed ? "Continue" : "Skip"}
                  </button>
                </div>
              </div>
            ) : (
              <QuizQuestions
                quizData={quizModal.quizData}
                courseId={courseId}
                episodeId={quizModal.episodeId}
                answers={quizAnswers}
                setAnswers={setQuizAnswers}
                onSubmit={async (answers) => {
                  try {
                    const res = await submitQuiz.mutateAsync(answers);
                    const result = (res as any).data ?? res;
                    setQuizResult(result);
                    if (result.passed && (course as any).xpPerEpisode) {
                      setXpFlash((course as any).xpPerEpisode);
                      setTimeout(() => setXpFlash(null), 3000);
                    }
                  } catch (e: any) {
                    toast.error(e.message || "Failed to submit quiz");
                  }
                }}
                isSubmitting={submitQuiz.isPending}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quiz questions component ──────────────────────────────────────────────────
function QuizQuestions({
  quizData, courseId, episodeId, answers, setAnswers, onSubmit, isSubmitting,
}: {
  quizData: any; courseId: string; episodeId: string;
  answers: Record<string, string>; setAnswers: (a: Record<string, string>) => void;
  onSubmit: (a: Record<string, string>) => void; isSubmitting: boolean;
}) {
  const questions: any[] =
    quizData?.quizData?.questions ??
    quizData?.lessons?.find?.((l: any) => l.id === episodeId)?.quizData?.questions ??
    [];

  if (!questions.length) {
    return (
      <div className="p-6 text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
        No quiz questions configured.
      </div>
    );
  }

  const allAnswered = questions.every((q: any) => answers[q.id]);

  return (
    <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
      {questions.map((q: any, qi: number) => (
        <div key={q.id}>
          <p className="text-sm font-medium text-white mb-3">{qi + 1}. {q.question}</p>
          <div className="space-y-2">
            {q.options?.map((opt: any) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAnswers({ ...answers, [q.id]: opt.id })}
                className="w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all border"
                style={{
                  borderColor: answers[q.id] === opt.id ? "var(--color-accent)" : "rgba(255,255,255,0.1)",
                  background: answers[q.id] === opt.id ? "color-mix(in srgb, var(--color-accent) 15%, transparent)" : "transparent",
                  color: answers[q.id] === opt.id ? "#fff" : "rgba(255,255,255,0.6)",
                }}
              >
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        onClick={() => onSubmit(answers)}
        disabled={!allAnswered || isSubmitting}
        className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
        style={{ background: "var(--color-accent)" }}
      >
        {isSubmitting ? "Submitting..." : "Submit Answers"}
      </button>
    </div>
  );
}

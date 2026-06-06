"use client";

import { use, useState, useRef, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, CheckCircle2, Play, Loader2 } from "lucide-react";
import { VideoPlayer } from "@/components/features/video/VideoPlayer";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { useCourse, useLessonProgress, useMarkLessonComplete } from "@/lib/hooks/useCourses";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { normalizeBunnyUrl, withResumeTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { VideoWatermark } from "@/components/features/video/VideoWatermark";
import type { Lesson } from "@/types";

type WatchState = "not_started" | "watching" | "paused" | "completed";

function isBunnyEmbed(url: string) {
  return url.includes("mediadelivery.net");
}

interface SelectedLesson {
  id: string;
  title: string;
  videoUrl: string;
  durationSeconds: number;
  resumeAtSeconds?: number;
  actualWatchedSecs?: number;
  isCompleted?: boolean;
}

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

  const [selectedLesson, setSelectedLesson] = useState<SelectedLesson | null>(null);
  const [watchState, setWatchState] = useState<WatchState>("not_started");
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  // Auto-select lesson from URL parameter once course data loads
  useEffect(() => {
    if (course?.lessons && targetLessonId && !selectedLesson) {
      const target = course.lessons.find((l: any) => l.id === targetLessonId);
      if (target && target.videoUrl) {
        setSelectedLesson({
          id: target.id,
          title: target.title,
          videoUrl: target.videoUrl,
          durationSeconds: target.durationSeconds ?? 0,
          resumeAtSeconds: (target as any).resumeAtSeconds ?? 0,
          actualWatchedSecs: (target as any).actualWatchedSecs ?? 0,
          isCompleted: (target as any).isCompleted ?? false,
        });
      }
    }
  }, [course, targetLessonId, selectedLesson]);

  // Refs so closure callbacks always see current values
  const markCalledRef = useRef(false);
  const elapsedRef = useRef(0); // Time spent watching in this session
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const iframeFocusedRef = useRef(false);
  const selectedLessonRef = useRef<SelectedLesson | null>(null);
  selectedLessonRef.current = selectedLesson;

  const completedIds = new Set(
    progressList?.filter((p) => p.completed).map((p) => p.lessonId) ?? []
  );

  // ── Reset state whenever lesson changes ──────────────────────────────────
  useEffect(() => {
    clearInterval(timerRef.current);
    iframeFocusedRef.current = false;
    elapsedRef.current = 0;

    if (!selectedLesson) return;
    const alreadyDone = completedIds.has(selectedLesson.id) || !!selectedLesson.isCompleted;
    setWatchState(alreadyDone ? "completed" : "not_started");
    setWatchedSeconds(selectedLesson.resumeAtSeconds ?? 0);
    markCalledRef.current = alreadyDone;
  }, [selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Native VideoPlayer callbacks ─────────────────────────────────────────
  const handleNativeProgress = (s: number) => {
    setWatchedSeconds(s);
    setWatchState((prev) => (prev === "completed" ? "completed" : "watching"));
  };

  const handleNativeHeartbeat = (currentTime: number) => {
    const lesson = selectedLessonRef.current;
    if (!lesson || markCalledRef.current) return;
    
    elapsedRef.current += 15;
    const threshold = lesson.durationSeconds > 0 ? lesson.durationSeconds * 0.85 : 90;
    const isCompleted = (lesson.actualWatchedSecs ?? 0) + elapsedRef.current >= threshold;
    
    markComplete.mutate({
      lessonId: lesson.id,
      watchedSeconds: Math.floor(currentTime),
      deltaSeconds: 15,
      isCompleted: isCompleted ? true : undefined,
    });

    if (isCompleted) {
      markCalledRef.current = true;
      setWatchState("completed");
    }
  };

  const handleNativeEnded = () => {
    const lesson = selectedLessonRef.current;
    if (!lesson || markCalledRef.current) return;
    markCalledRef.current = true;
    setWatchState("completed");
    markComplete.mutate({ lessonId: lesson.id, watchedSeconds, isCompleted: true });
  };

  // ── Heartbeat & Complete logic for Bunny Iframe ──────────────────────────
  useEffect(() => {
    if (!selectedLesson || !isBunnyEmbed(selectedLesson.videoUrl)) return;

    let localElapsed = 0;
    let lastPlayhead = selectedLesson.resumeAtSeconds ?? 0;

    const doMarkComplete = () => {
      const lesson = selectedLessonRef.current;
      if (!lesson || markCalledRef.current) return;
      markCalledRef.current = true;
      clearInterval(timerRef.current);
      setWatchState("completed");
      markComplete.mutate({ lessonId: lesson.id, isCompleted: true });
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
        const eventsToSubscribe = ["play", "pause", "timeupdate", "ended"];
        eventsToSubscribe.forEach((eventName) => {
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
        }
      }

      if (isPlay && !isEnd) {
        setWatchState((s) => (s === "completed" ? "completed" : "watching"));
        if (!iframeFocusedRef.current) {
          iframeFocusedRef.current = true;
          clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            localElapsed += 15;
            const lesson = selectedLessonRef.current;
            if (!lesson) return;
            
            const threshold = lesson.durationSeconds > 0 ? lesson.durationSeconds * 0.85 : 90;
            const isCompleted = (lesson.actualWatchedSecs ?? 0) + localElapsed >= threshold;

            if (isCompleted) {
              doMarkComplete();
            } else {
              markComplete.mutate({
                lessonId: lesson.id,
                watchedSeconds: Math.floor(lastPlayhead),
                deltaSeconds: 15,
                isCompleted: false,
              });
            }
          }, 15000);
        }
      } else if (isPause && !isEnd) {
        setWatchState((s) => (s === "completed" ? "completed" : "paused"));
        iframeFocusedRef.current = false;
        clearInterval(timerRef.current);
      }

      if (isEnd) doMarkComplete();
    };

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      clearInterval(timerRef.current);
    };
  }, [selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <PageLoader />;
  if (!course) {
    return (
      <p className="text-center py-16 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
        {uiStrings?.errorGeneric ?? "Course not found."}
      </p>
    );
  }

  const lessons: Lesson[] = course.lessons ?? [];

  const handleSelectLesson = (lesson: any) => {
    if (!lesson.videoUrl) return;
    setSelectedLesson({
      id: lesson.id,
      title: lesson.title,
      videoUrl: lesson.videoUrl,
      durationSeconds: lesson.durationSeconds ?? 0,
      resumeAtSeconds: lesson.resumeAtSeconds ?? 0,
      actualWatchedSecs: lesson.actualWatchedSecs ?? 0,
      isCompleted: lesson.isCompleted ?? false,
    });
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Status badge
  const statusBadge = (() => {
    if (!selectedLesson) return null;
    const progressPct = selectedLesson.durationSeconds > 0 
      ? Math.min(100, Math.round(((selectedLesson.actualWatchedSecs ?? 0) / selectedLesson.durationSeconds) * 100))
      : 0;

    if (watchState === "completed" || selectedLesson.isCompleted) return {
      label: uiStrings?.episodeCompleteLabel ?? "Completed",
      icon: <CheckCircle2 size={15} />,
      bg: "var(--color-success)",
      pct: 100
    };
    if (watchState === "watching") return {
      label: "Watching...",
      icon: <Loader2 size={15} className="animate-spin" />,
      bg: "var(--color-alert)",
      pct: progressPct
    };
    return {
      label: "Not Started",
      icon: <Play size={15} fill="currentColor" />,
      bg: "rgba(255,255,255,0.10)",
      pct: progressPct
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

      {/* Top area */}
      <div ref={topRef}>
        {selectedLesson ? (
          <div className="space-y-4">
            <VideoWatermark
              className="w-full aspect-video rounded-xl overflow-hidden relative bg-black"
              containerId="course-video-root"
              showFullscreenButton={isBunnyEmbed(selectedLesson.videoUrl)}
            >
              {isBunnyEmbed(selectedLesson.videoUrl) ? (
                <iframe
                  key={selectedLesson.id}
                  src={withResumeTime(normalizeBunnyUrl(selectedLesson.videoUrl), selectedLesson.resumeAtSeconds ?? 0)}
                  className="w-full h-full border-0"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media"
                  title={selectedLesson.title}
                />
              ) : (
                <VideoPlayer
                  src={selectedLesson.videoUrl}
                  lessonId={selectedLesson.id}
                  resumeAtSeconds={selectedLesson.resumeAtSeconds ?? 0}
                  onProgress={handleNativeProgress}
                  onHeartbeat={handleNativeHeartbeat}
                  onEnded={handleNativeEnded}
                />
              )}
            </VideoWatermark>

            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-white leading-snug">
                {selectedLesson.title}
              </h2>
              {statusBadge && (
                <div
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors"
                  style={{ background: statusBadge.bg, color: "#fff" }}
                >
                  {statusBadge.icon}
                  {statusBadge.label}
                  {statusBadge.pct < 100 && statusBadge.pct > 0 && ` (${statusBadge.pct}%)`}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Course banner */
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
                    {lesson.description && (
                      <p className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                        {lesson.description}
                      </p>
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
    </div>
  );
}

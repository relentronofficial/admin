"use client";

import { use, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { VideoPlayer } from "@/components/features/video/VideoPlayer";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { useCourse, useMarkLessonComplete, useLessonProgress } from "@/lib/hooks/useCourses";
import { cn } from "@/lib/utils/cn";
import { toast } from "react-hot-toast";

export default function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = use(params);
  const { data: course, isLoading } = useCourse(courseId);
  const { data: progressList } = useLessonProgress(courseId);
  const markComplete = useMarkLessonComplete(courseId);
  const [watchedSeconds, setWatchedSeconds] = useState(0);

  if (isLoading) return <PageLoader />;
  if (!course) return <p className="text-center py-16 text-muted-foreground">Course not found.</p>;

  const lessons = course.lessons ?? [];
  const lesson = lessons.find((l) => l.id === lessonId);
  const currentIndex = lessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  const completedIds = new Set(
    progressList?.filter((p) => p.completed).map((p) => p.lessonId) ?? []
  );

  const handleComplete = async () => {
    try {
      await markComplete.mutateAsync({ lessonId, watchedSeconds });
      toast.success("Lesson marked as complete!");
    } catch {
      toast.error("Failed to mark complete");
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-6">
      {/* Video + lesson info */}
      <div className="space-y-4">
        <Link
          href={`/learning/${courseId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} /> Back to course
        </Link>

        {lesson?.videoUrl ? (
          <VideoPlayer
            src={lesson.videoUrl}
            lessonId={lessonId}
            onProgress={setWatchedSeconds}
            onEnded={handleComplete}
          />
        ) : (
          <div className="aspect-video rounded-xl bg-muted flex items-center justify-center">
            <p className="text-muted-foreground text-sm">No video for this lesson</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{lesson?.title}</h1>
            {lesson?.description && (
              <p className="text-sm text-muted-foreground mt-1">{lesson.description}</p>
            )}
          </div>
          <button
            onClick={handleComplete}
            disabled={markComplete.isPending || completedIds.has(lessonId)}
            className={cn(
              "shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
              completedIds.has(lessonId)
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
            )}
          >
            <CheckCircle2 size={16} />
            {completedIds.has(lessonId) ? "Completed" : "Mark Complete"}
          </button>
        </div>

        {/* Prev / Next */}
        <div className="flex gap-3 pt-2">
          {prevLesson && (
            <Link
              href={`/learning/${courseId}/${prevLesson.id}`}
              className="flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
            >
              <ChevronLeft size={16} className="shrink-0" />
              <span className="truncate">{prevLesson.title}</span>
            </Link>
          )}
          {nextLesson && (
            <Link
              href={`/learning/${courseId}/${nextLesson.id}`}
              className="flex-1 flex items-center justify-end gap-2 px-4 py-3 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
            >
              <span className="truncate">{nextLesson.title}</span>
              <ChevronRight size={16} className="shrink-0" />
            </Link>
          )}
        </div>
      </div>

      {/* Sidebar — lesson list */}
      <div className="hidden lg:block">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold truncate">{course.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{completedIds.size} / {lessons.length} completed</p>
          </div>
          <div className="divide-y divide-border max-h-[calc(100vh-200px)] overflow-y-auto">
            {lessons.map((l, idx) => (
              <Link
                key={l.id}
                href={`/learning/${courseId}/${l.id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors",
                  l.id === lessonId && "bg-muted font-medium"
                )}
              >
                <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">{idx + 1}</span>
                <span className="flex-1 line-clamp-2 text-xs">{l.title}</span>
                {completedIds.has(l.id) && (
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

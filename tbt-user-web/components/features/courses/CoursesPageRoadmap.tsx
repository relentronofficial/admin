"use client";

// The Floating Learning Roadmap on the /courses catalog, for one course — the
// member's most recent in-progress one (chosen by the page). Same data and rules
// as the course page: the course detail (server-computed lesson locks) and the
// member's own lesson progress, grouped by buildSectionGroups and turned into
// levels by buildRoadmapLevels. Choosing a level opens the lesson through the
// course page's existing `?lesson=` deep link, which applies the usual lock
// checks and start-video dialog.
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCourse, useLessonProgress } from "@/lib/hooks/useCourses";
import { buildSectionGroups } from "@/lib/utils/sectionProgress";
import { buildRoadmapLevels } from "@/lib/utils/roadmapLevels";
import LearningRoadmap from "./LearningRoadmap";

export default function CoursesPageRoadmap({ courseId }: { courseId: string }) {
  const router = useRouter();
  const courseQuery = useCourse(courseId);
  const progressQuery = useLessonProgress(courseId);
  const course = courseQuery.data;
  const progressList = progressQuery.data;

  const levels = useMemo(() => {
    if (!course) return [];
    const completedIds = new Set((progressList ?? []).filter((p) => p.completed).map((p) => p.lessonId));
    const sections: any[] = (course as any).sections ?? [];
    return buildRoadmapLevels(buildSectionGroups((course.lessons ?? []) as any[], sections, completedIds), completedIds);
  }, [course, progressList]);

  const status = courseQuery.isError || progressQuery.isError ? "error" : !course || progressQuery.isLoading ? "loading" : "ready";

  return (
    <LearningRoadmap
      levels={levels}
      title={course?.title}
      status={status}
      onRetry={() => {
        void courseQuery.refetch();
        void progressQuery.refetch();
      }}
      onOpenLesson={(lesson) => router.push(`/learning/${courseId}?lesson=${lesson.id}`)}
    />
  );
}

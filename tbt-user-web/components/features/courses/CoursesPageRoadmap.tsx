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
  const { data: course } = useCourse(courseId);
  const { data: progressList } = useLessonProgress(courseId);

  const levels = useMemo(() => {
    if (!course) return [];
    const completedIds = new Set((progressList ?? []).filter((p) => p.completed).map((p) => p.lessonId));
    const sections: any[] = (course as any).sections ?? [];
    return buildRoadmapLevels(buildSectionGroups((course.lessons ?? []) as any[], sections, completedIds), completedIds);
  }, [course, progressList]);

  if (!course) return null;
  return (
    <LearningRoadmap
      levels={levels}
      title={course.title}
      onOpenLesson={(lesson) => router.push(`/learning/${courseId}?lesson=${lesson.id}`)}
    />
  );
}

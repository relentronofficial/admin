"use client";

import { useContinueLearning } from "@/lib/hooks/useDashboard";
import { useCourseLifelines } from "@/lib/hooks/useCourses";
import { MAX_LIFELINES_HELD, heldLifelines } from "@/lib/lifelines";

/**
 * The lifeline count a member sees, from the one pool the video player actually
 * spends: the course pool (`GET /api/user/courses/:id/lifelines`).
 *
 * With no courseId (Mentorship page, Profile) it uses the member's most recent
 * in-progress course, the same course the hearts on Mentorship have always used.
 * `held` is clamped to the holding cap the heart rows show; null while loading or
 * when there is no course to read.
 */
export function useMemberLifelines(courseId?: string | null) {
  const { data: continueLearning } = useContinueLearning();
  const resolvedCourseId =
    courseId ??
    ((continueLearning as any[] | undefined)?.find((i: any) => i.type === "course" && !i.isCompleted)?.id ?? null);
  const { data, isLoading } = useCourseLifelines(resolvedCourseId);
  return {
    courseId: resolvedCourseId as string | null,
    data: data ?? null,
    held: data != null ? heldLifelines(data.remaining) : null,
    max: MAX_LIFELINES_HELD,
    isLoading: !!resolvedCourseId && isLoading,
  };
}

"use client";

import { BookOpen, Award, CheckCircle2, Play } from "lucide-react";
import { CardSkeleton } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useMyEnrollments } from "@/lib/hooks/useCourses";
import Link from "next/link";

function EnrolledCourseCard({ enrollment }: { enrollment: any }) {
  const course = enrollment.course;
  const progress = enrollment.progressPercent ?? 0;
  const isCompleted = progress >= 100;

  return (
    <Link
      href={`/learning/${course.id}`}
      className="group rounded-xl overflow-hidden flex flex-col"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      <div className="relative aspect-video overflow-hidden">
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--color-surface-overlay)" }}>
            <Play size={32} style={{ color: "var(--color-accent)" }} />
          </div>
        )}
        {isCompleted && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-white"
            style={{ background: "var(--color-success)" }}
          >
            <CheckCircle2 size={11} /> Done
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="font-semibold text-sm text-foreground line-clamp-2 leading-snug">{course.title}</p>
        {course.level && (
          <p className="text-xs capitalize text-muted-foreground">{course.level}</p>
        )}
        <div className="mt-auto pt-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progress}% complete</span>
            {isCompleted && <CheckCircle2 size={12} style={{ color: "var(--color-success)" }} />}
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-progress-track)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: isCompleted ? "var(--color-success)" : "var(--color-accent)",
              }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function LearningPage() {
  const { data: enrollments, isLoading } = useMyEnrollments();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">My Learning</h2>
          <p className="text-sm mt-1 text-muted-foreground">
            All your enrolled courses in one place.
          </p>
        </div>
        <Link
          href="/learning/badges"
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg shrink-0 transition-opacity hover:opacity-80"
          style={{
            color: "var(--color-accent)",
            border: "1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)",
          }}
        >
          <Award size={14} /> My Badges
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : enrollments && enrollments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {enrollments.map((e: any) => (
            <EnrolledCourseCard key={e.id} enrollment={e} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="You haven't enrolled in any courses. Browse our catalog to get started."
          action={
            <Link
              href="/courses"
              className="text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--color-accent)" }}
            >
              Browse Courses
            </Link>
          }
        />
      )}
    </div>
  );
}

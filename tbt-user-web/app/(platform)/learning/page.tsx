"use client";

import { BookOpen, Award } from "lucide-react";
import { ProgramCard } from "@/components/features/programs/ProgramCard";
import { CardSkeleton } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useMyEnrollments } from "@/lib/hooks/useCourses";
import Link from "next/link";

export default function LearningPage() {
  const { data: enrollments, isLoading } = useMyEnrollments();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Learning</h2>
          <p className="text-muted-foreground text-sm mt-1">All your enrolled courses in one place.</p>
        </div>
        <Link href="/learning/badges"
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors shrink-0"
          style={{ color: "var(--color-accent)" }}>
          <Award size={14} /> My Badges
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : enrollments && enrollments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {enrollments.map((e) => (
            <ProgramCard
              key={e.id}
              course={e.course}
              enrolled
              progress={e.progressPercent}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="You haven't enrolled in any courses. Browse our programs to get started."
          action={
            <Link
              href="/programs"
              className="bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Browse Programs
            </Link>
          }
        />
      )}
    </div>
  );
}

"use client";

import { BookOpen, Flame, Trophy, Calendar } from "lucide-react";
import { StatsCard } from "@/components/features/dashboard/StatsCard";
import { ProgramCard } from "@/components/features/programs/ProgramCard";
import { PageLoader, CardSkeleton } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useDashboardStats, useContinueLearning } from "@/lib/hooks/useDashboard";
import { useMe } from "@/lib/hooks/useUser";

export default function DashboardPage() {
  const { data: me } = useMe();
  const { data: stats, isLoading: loadingStats } = useDashboardStats();
  const { data: continueItems, isLoading: loadingContinue } = useContinueLearning();

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {me?.firstName || "Member"} 👋
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Here&apos;s what&apos;s happening with your learning journey.
        </p>
      </div>

      {/* Stats */}
      {loadingStats ? (
        <PageLoader />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="Courses Enrolled"
            value={stats?.totalCourses ?? 0}
            icon={BookOpen}
          />
          <StatsCard
            label="Completed"
            value={stats?.completedCourses ?? 0}
            icon={Trophy}
            accent
          />
          <StatsCard
            label="Current Streak"
            value={`${stats?.currentStreak ?? 0}d`}
            icon={Flame}
          />
          <StatsCard
            label="Upcoming Events"
            value={stats?.upcomingEvents ?? 0}
            icon={Calendar}
          />
        </div>
      )}

      {/* Continue Learning */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Continue Learning</h3>
        </div>

        {loadingContinue ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : continueItems && continueItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {continueItems.map((item) => (
              <div key={item.courseId} className="rounded-xl border border-border bg-card p-4">
                <p className="font-medium text-sm line-clamp-2">{item.title}</p>
                <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full transition-all"
                    style={{ width: `${item.progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{item.progressPercent}% complete</p>
                {item.lastLessonTitle && (
                  <p className="text-xs text-brand-600 mt-0.5 truncate">Next: {item.lastLessonTitle}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No courses in progress"
            description="Explore our programs and start your first course."
          />
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { BookOpen, Flame, Trophy, Calendar, Play } from "lucide-react";
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
            {continueItems.map((item: any) => {
              const href = item.type === "course" 
                ? `/learning/${item.id}?lesson=${item.lessonId}` 
                : `/episode/${item.id}/${item.lessonId}`;

              return (
                <Link
                  key={item.lessonId}
                  href={href}
                  className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-brand-600/50 transition-colors"
                >
                  <div className="aspect-video w-full relative bg-black/50 overflow-hidden">
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={item.thumbnailUrl} 
                        alt={item.title} 
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                        <BookOpen size={32} />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-brand-600 text-white rounded-full p-3 transform scale-90 group-hover:scale-100 transition-transform shadow-lg">
                        <Play fill="currentColor" size={20} className="ml-1" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col">
                    <p className="font-medium text-sm line-clamp-1 mb-1">{item.title}</p>
                    {item.lastLessonTitle && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        Resume: <span className="text-white/80">{item.lastLessonTitle}</span>
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
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

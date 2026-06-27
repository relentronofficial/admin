"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Flame, Trophy, Calendar, Play, CheckCircle2, Video, ArrowRight } from "lucide-react";
import { StatsCard } from "@/components/features/dashboard/StatsCard";
import { PageLoader, CardSkeleton } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useDashboardStats, useContinueLearning } from "@/lib/hooks/useDashboard";
import { useMe } from "@/lib/hooks/useUser";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";

export default function DashboardPage() {
  const { data: me } = useMe();
  const { uiStrings } = useSiteConfig();
  const { data: stats, isLoading: loadingStats } = useDashboardStats();
  const { data: recentItems, isLoading: loadingRecent } = useContinueLearning();

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {uiStrings?.dashboardWelcome
            ? uiStrings.dashboardWelcome.replace("{name}", me?.firstName || "Member")
            : `Welcome back, ${me?.firstName || "Member"} 👋`}
        </h2>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
          {uiStrings?.dashboardSubtitle ?? "Here's what's happening with your learning journey."}
        </p>
      </div>

      {/* Stats */}
      {loadingStats ? (
        <PageLoader />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard label={uiStrings?.statCoursesEnrolled ?? "Courses Enrolled"} value={stats?.totalCourses ?? 0} icon={BookOpen} />
          <StatsCard label={uiStrings?.statCompleted ?? "Completed"} value={stats?.completedCourses ?? 0} icon={Trophy} accent />
          <StatsCard label={uiStrings?.statStreak ?? "Current Streak"} value={`${stats?.currentStreak ?? 0}d`} icon={Flame} />
          <StatsCard label={uiStrings?.statUpcomingEvents ?? "Upcoming Events"} value={stats?.upcomingEvents ?? 0} icon={Calendar} />
        </div>
      )}

      {/* Recently Watched */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {uiStrings?.recentlyWatched ?? "Recently Watched"}
          </h3>
        </div>

        {loadingRecent ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : recentItems && recentItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentItems.map((item: any) => {
              const href = item.type === "course"
                ? `/learning/${item.id}?lesson=${item.lessonId}`
                : `/episode/${item.id}/${item.lessonId}`;

              return (
                <Link
                  key={`${item.type}-${item.id}-${item.lessonId}`}
                  href={href}
                  className="group relative flex flex-col rounded-xl overflow-hidden transition-all hover:scale-[1.01]"
                  style={{
                    background: "var(--color-bg-surface)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video w-full relative bg-black overflow-hidden">
                    {item.thumbnailUrl ? (
                      <Image
                        src={item.thumbnailUrl}
                        alt={item.title}
                        fill
                        className="object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: "rgba(255,255,255,0.15)" }}>
                        <BookOpen size={32} />
                      </div>
                    )}

                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div
                        className="rounded-full p-3 shadow-lg transform scale-90 group-hover:scale-100 transition-transform"
                        style={{ background: "var(--color-accent)" }}
                      >
                        <Play fill="currentColor" size={18} className="ml-0.5 text-white" />
                      </div>
                    </div>

                    {/* Type badge */}
                    <div className="absolute top-2 left-2">
                      <span
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                        style={{
                          background: item.type === "course"
                            ? "color-mix(in srgb, var(--color-accent) 85%, transparent)"
                            : "rgba(255,255,255,0.15)",
                          color: "white",
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        {item.type === "course" ? <BookOpen size={9} /> : <Video size={9} />}
                        {item.type === "course" ? "Course" : "Workshop"}
                      </span>
                    </div>

                    {/* Completed badge */}
                    {item.isCompleted && (
                      <div className="absolute top-2 right-2">
                        <span
                          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{ background: "var(--color-success, #16a34a)", color: "white" }}
                        >
                          <CheckCircle2 size={9} />
                          Done
                        </span>
                      </div>
                    )}

                    {/* Progress bar */}
                    {!item.isCompleted && item.progressPercent > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${item.progressPercent}%`,
                            background: "var(--color-accent)",
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 flex-1 flex flex-col gap-0.5">
                    <p className="font-semibold text-sm line-clamp-1 text-white">{item.title}</p>
                    <p className="text-xs line-clamp-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {item.isCompleted
                        ? `Completed: ${item.lastLessonTitle}`
                        : `Resume: ${item.lastLessonTitle}`}
                    </p>
                    {!item.isCompleted && item.progressPercent > 0 && (
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {item.progressPercent}% watched
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            <EmptyState
              icon={BookOpen}
              title={uiStrings?.recentlyWatchedEmpty ?? "Nothing watched yet"}
              description={uiStrings?.recentlyWatchedEmptyDesc ?? "Start a course or workshop to see your progress here."}
            />
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/workshops"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--color-accent)" }}
              >
                Explore Workshops <ArrowRight size={15} />
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.75)" }}
              >
                Browse Courses <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

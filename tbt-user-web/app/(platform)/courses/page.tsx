"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search, BookOpen, Play, Trophy, Zap, Clock, Lock,
  ChevronRight, Award, TrendingUp, CheckCircle2, Layers,
} from "lucide-react";
import { useCourses, useMyEnrollments } from "@/lib/hooks/useCourses";
import { cn } from "@/lib/utils/cn";

// ── Level config ──────────────────────────────────────────────────────────────

const LEVELS = [
  { value: "all",          label: "All" },
  { value: "beginner",     label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced",     label: "Advanced" },
] as const;

// ── Skeletons ─────────────────────────────────────────────────────────────────

function CourseCardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      <div className="aspect-video" style={{ background: "var(--color-surface-overlay)" }} />
      <div className="p-4 space-y-3">
        <div className="h-3 rounded-full w-16" style={{ background: "var(--color-surface-overlay-md)" }} />
        <div className="h-4 rounded-full w-4/5" style={{ background: "var(--color-surface-overlay-md)" }} />
        <div className="h-3 rounded-full w-3/5" style={{ background: "var(--color-surface-overlay)" }} />
        <div className="h-8 rounded-xl mt-4" style={{ background: "var(--color-surface-overlay)" }} />
      </div>
    </div>
  );
}

function EnrolledCardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden flex gap-4 p-4 animate-pulse shrink-0 w-72"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      <div className="w-20 h-16 rounded-xl shrink-0" style={{ background: "var(--color-surface-overlay-md)" }} />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3.5 rounded-full w-4/5" style={{ background: "var(--color-surface-overlay-md)" }} />
        <div className="h-2.5 rounded-full w-3/5" style={{ background: "var(--color-surface-overlay)" }} />
        <div className="h-2 rounded-full w-full mt-3" style={{ background: "var(--color-surface-overlay)" }} />
      </div>
    </div>
  );
}

// ── Enrolled (my courses) card ─────────────────────────────────────────────────

function EnrolledCourseCard({ enrollment }: { enrollment: any }) {
  const course = enrollment.course;
  const pct = enrollment.progressPercent ?? 0;
  const completed = enrollment.completedAt != null;

  return (
    <Link
      href={`/learning/${enrollment.courseId}`}
      className="group flex gap-4 p-4 rounded-2xl shrink-0 w-72 transition-all duration-200"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      {/* Thumbnail */}
      <div className="w-20 h-16 rounded-xl overflow-hidden shrink-0 relative bg-black">
        {course?.thumbnailUrl ? (
          <Image src={course.thumbnailUrl} alt={course.title} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={18} className="text-muted-foreground opacity-20" />
          </div>
        )}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "var(--color-accent)" }}>
            <Play size={10} fill="white" className="text-white ml-0.5" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <p className="text-[13px] font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-[var(--color-accent)] transition-colors">
            {course?.title}
          </p>
        </div>
        <div className="mt-2">
          {completed ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} style={{ color: "var(--color-success, #22c55e)" }} />
              <span className="text-[11px] font-semibold" style={{ color: "var(--color-success, #22c55e)" }}>Completed</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] text-muted-foreground">{pct}% complete</span>
                {enrollment.totalLessons > 0 && (
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {enrollment.completedLessons ?? 0}/{enrollment.totalLessons}
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-progress-track)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: "var(--color-accent)" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Course catalog card ───────────────────────────────────────────────────────

function CourseCard({ course, isEnrolled, progress }: { course: any; isEnrolled: boolean; progress?: number }) {
  const hasAccess = course.hasAccess;
  const price = course.price;

  return (
    <Link
      href={`/learning/${course.id}`}
      className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.border = "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px color-mix(in srgb, var(--color-accent) 12%, transparent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.border = "1px solid var(--color-border-subtle)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.3)";
      }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden" style={{ background: "var(--color-surface-overlay-xs)" }}>
        {course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt={course.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen size={36} className="text-muted-foreground opacity-10" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)" }} />

        {/* Level badge */}
        <div className="absolute top-3 left-3">
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg backdrop-blur-sm"
            style={{
              background: "color-mix(in srgb, var(--color-accent) 20%, rgba(0,0,0,0.7))",
              border: "1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)",
              color: "var(--color-accent)",
            }}
          >
            {course.level || "course"}
          </span>
        </div>

        {/* Access / price badge */}
        <div className="absolute top-3 right-3">
          {isEnrolled ? (
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm"
              style={{ background: "rgba(0,0,0,0.7)", color: "var(--color-success, #22c55e)", border: "1px solid rgba(34,197,94,0.3)" }}
            >
              <CheckCircle2 size={9} /> Enrolled
            </span>
          ) : hasAccess ? (
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm"
              style={{ background: "rgba(0,0,0,0.7)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }}
            >
              Access
            </span>
          ) : price > 0 ? (
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm"
              style={{ background: "rgba(0,0,0,0.75)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              <Lock size={9} /> ₹{price.toLocaleString("en-IN")}
            </span>
          ) : null}
        </div>

        {/* Progress bar */}
        {isEnrolled && typeof progress === "number" && (
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "rgba(0,0,0,0.4)" }}>
            <div className="h-full transition-all" style={{ width: `${progress}%`, background: "var(--color-accent)" }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-[14px] leading-snug text-foreground line-clamp-2 group-hover:text-[var(--color-accent)] transition-colors duration-150">
            {course.title}
          </h3>
          {course.description && (
            <p className="text-[12px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
              {course.description}
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground border-t pt-3" style={{ borderColor: "var(--color-border-subtle)" }}>
          {course._count?.lessons != null && (
            <span className="flex items-center gap-1">
              <Layers size={11} /> {course._count.lessons} episodes
            </span>
          )}
          {course.durationDisplay && (
            <span className="flex items-center gap-1">
              <Clock size={11} /> {course.durationDisplay}
            </span>
          )}
          {course.xpPerEpisode && (
            <span className="flex items-center gap-1 ml-auto" style={{ color: "var(--color-accent)" }}>
              <Zap size={11} /> {course.xpPerEpisode} XP/ep
            </span>
          )}
        </div>

        {/* CTA */}
        <div
          className="flex items-center justify-between px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-200"
          style={{
            background: isEnrolled
              ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface-overlay))"
              : "var(--color-surface-overlay)",
            border: isEnrolled
              ? "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)"
              : "1px solid var(--color-border-subtle)",
            color: isEnrolled ? "var(--color-accent)" : "var(--color-text-secondary)",
          }}
        >
          <span>{isEnrolled ? "Continue Learning" : hasAccess ? "Enroll Now" : price > 0 ? `Buy — ₹${price.toLocaleString("en-IN")}` : "View Course"}</span>
          <ChevronRight size={14} />
        </div>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: "newest",  label: "Newest" },
  { value: "popular", label: "Popular" },
] as const;

export default function CoursesPage() {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [sort, setSort] = useState<"newest" | "popular">("newest");

  const { data: catalogData, isLoading: catalogLoading } = useCourses({
    search: search || undefined,
    level: level !== "all" ? level : undefined,
    sort,
    limit: 24,
  });
  const { data: enrollments, isLoading: enrollLoading } = useMyEnrollments();

  const catalogCourses: any[] = catalogData?.data ?? [];
  const myEnrollments: any[] = enrollments ?? [];

  const enrolledMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of myEnrollments) m.set(e.courseId, e);
    return m;
  }, [myEnrollments]);

  const activeEnrollments = myEnrollments.filter((e) => !e.completedAt);
  const completedEnrollments = myEnrollments.filter((e) => e.completedAt);

  return (
    <div className="space-y-10">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl px-6 py-8 md:px-10 md:py-10"
        style={{
          background: "color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-surface, #181818))",
          border: "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)",
        }}
      >
        {/* Glow */}
        <div
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "color-mix(in srgb, var(--color-accent) 18%, transparent)", border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)" }}
              >
                <BookOpen size={15} style={{ color: "var(--color-accent)" }} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>
                TBT Learning
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">Courses</h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Expand your skills with expert-led courses. Learn at your own pace and earn XP along the way.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <Link
              href="/learning/badges"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-colors"
              style={{
                background: "var(--color-surface-overlay-md)",
                border: "1px solid var(--color-border-medium)",
                color: "var(--color-text-secondary)",
              }}
            >
              <Award size={14} /> My Badges
            </Link>
          </div>
        </div>

        {/* Quick stats */}
        {myEnrollments.length > 0 && (
          <div className="flex items-center gap-6 mt-6 pt-5" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
            {[
              { label: "Enrolled", value: myEnrollments.length, icon: <BookOpen size={13} /> },
              { label: "Completed", value: completedEnrollments.length, icon: <CheckCircle2 size={13} /> },
              { label: "In Progress", value: activeEnrollments.length, icon: <TrendingUp size={13} /> },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span style={{ color: "var(--color-accent)" }}>{s.icon}</span>
                <span className="text-sm font-bold text-foreground">{s.value}</span>
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── My Courses (enrolled with progress) ─────────────────────── */}
      {(enrollLoading || activeEnrollments.length > 0) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Play size={15} style={{ color: "var(--color-accent)" }} />
              Continue Learning
            </h2>
            {activeEnrollments.length > 4 && (
              <Link href="/learning" className="text-[12px] font-semibold transition-colors" style={{ color: "var(--color-accent)" }}>
                View all →
              </Link>
            )}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            {enrollLoading
              ? Array.from({ length: 3 }).map((_, i) => <EnrolledCardSkeleton key={i} />)
              : activeEnrollments.slice(0, 8).map((e) => <EnrolledCourseCard key={e.id} enrollment={e} />)
            }
          </div>
        </section>
      )}

      {/* ── Completed courses ────────────────────────────────────────── */}
      {completedEnrollments.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 size={15} style={{ color: "var(--color-success, #22c55e)" }} />
            Completed
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            {completedEnrollments.map((e) => <EnrolledCourseCard key={e.id} enrollment={e} />)}
          </div>
        </section>
      )}

      {/* ── Browse all courses ───────────────────────────────────────── */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Layers size={15} style={{ color: "var(--color-accent)" }} />
            Browse All
          </h2>
          {!catalogLoading && catalogCourses.length > 0 && (
            <span className="text-[11px] text-muted-foreground">{catalogCourses.length} courses</span>
          )}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses..."
              className="w-full pl-9 pr-4 h-10 text-sm text-foreground placeholder:text-muted-foreground rounded-xl outline-none transition-all"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--color-border-subtle)")}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            {LEVELS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setLevel(value)}
                className={cn("h-10 px-4 rounded-xl text-[12px] font-semibold transition-all duration-150")}
                style={
                  level === value
                    ? {
                        background: "var(--color-accent)",
                        color: "white",
                        border: "1px solid transparent",
                      }
                    : {
                        background: "var(--color-surface-overlay)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border-subtle)",
                      }
                }
              >
                {label}
              </button>
            ))}

            {/* Sort selector */}
            <div className="ml-auto sm:ml-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "newest" | "popular")}
                className="h-10 px-3 pr-8 rounded-xl text-[12px] font-semibold outline-none cursor-pointer appearance-none"
                style={{
                  background: "var(--color-surface-overlay)",
                  border: "1px solid var(--color-border-subtle)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {SORT_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Grid */}
        {catalogLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <CourseCardSkeleton key={i} />)}
          </div>
        ) : catalogCourses.length === 0 ? (
          <div
            className="flex flex-col items-center py-20 rounded-2xl gap-3"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--color-surface-overlay)" }}
            >
              <BookOpen size={24} className="text-muted-foreground opacity-20" />
            </div>
            <p className="text-muted-foreground text-sm font-medium">No courses found</p>
            {(search || level !== "all") && (
              <button
                onClick={() => { setSearch(""); setLevel("all"); setSort("newest"); }}
                className="text-[12px] font-semibold transition-colors"
                style={{ color: "var(--color-accent)" }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {catalogCourses.map((course: any) => {
              const enrollment = enrolledMap.get(course.id);
              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  isEnrolled={!!enrollment}
                  progress={enrollment?.progressPercent}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

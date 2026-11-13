"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Search, Lock, Play, ShoppingCart, Loader2,
  Clock, Zap, ArrowRight, CheckCircle2, Sparkles,
} from "lucide-react";
import { useCourses, useMyEnrollments } from "@/lib/hooks/useCourses";
import { useMe } from "@/lib/hooks/useUser";
import { formatMinutes } from "@/lib/utils/courseDurations";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden animate-pulse"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-surface-overlay)" }}
    >
      <div className="aspect-[16/9]" style={{ background: "var(--color-surface-overlay)" }} />
      <div className="p-5 space-y-3">
        <div className="h-4 rounded-md w-3/4" style={{ background: "var(--color-surface-overlay-md)" }} />
        <div className="h-3 rounded-md w-full" style={{ background: "var(--color-surface-overlay)" }} />
        <div className="h-3 rounded-md w-2/3" style={{ background: "var(--color-surface-overlay)" }} />
        <div className="h-9 rounded-xl mt-4" style={{ background: "var(--color-surface-overlay-md)" }} />
      </div>
    </div>
  );
}

// ── Course Card ───────────────────────────────────────────────────────────────

function CourseCard({ c, index, onCourseClick }: { c: any; index: number; onCourseClick: (c: any) => void }) {
  const router = useRouter();
  const hasAccess = c.hasAccess;
  const hasPrice = c.price != null && Number(c.price) > 0;
  const durationLabel = c.durationHours != null ? formatMinutes(Math.round(c.durationHours * 60)) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group flex flex-col rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-surface-overlay)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
      whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(0,0,0,0.25)" }}
      onClick={() => onCourseClick(c)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] overflow-hidden shrink-0" style={{ background: "var(--color-surface-overlay)" }}>
        {c.thumbnailUrl ? (
          <img
            src={c.thumbnailUrl}
            alt={c.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={32} style={{ color: "var(--color-text-subtle)" }} />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", border: "2px solid rgba(255,255,255,0.4)" }}
          >
            {hasAccess
              ? <Play size={22} fill="white" className="text-white ml-0.5" />
              : <ArrowRight size={22} className="text-white" />
            }
          </div>
        </div>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {hasAccess && (
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
              style={{ background: "rgba(34,197,94,0.9)", color: "#fff", backdropFilter: "blur(4px)" }}
            >
              <CheckCircle2 size={10} /> Enrolled
            </span>
          )}
        </div>
        {!hasAccess && hasPrice && (
          <div className="absolute top-3 right-3">
            <span
              className="text-[11px] font-black px-2.5 py-1 rounded-full"
              style={{
                background: "var(--color-accent)",
                color: "#fff",
                boxShadow: "0 2px 8px color-mix(in srgb, var(--color-accent) 50%, transparent)",
              }}
            >
              ₹{Number(c.price).toLocaleString("en-IN")}
            </span>
          </div>
        )}
        {c.level && (
          <div className="absolute bottom-3 left-3">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
              style={{
                background: "rgba(0,0,0,0.6)",
                color: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(4px)",
              }}
            >
              {c.level}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-5">
        {/* Title + description */}
        <div className="flex-1 mb-4">
          <h3
            className="font-bold text-sm leading-snug line-clamp-2 mb-1.5"
            style={{ color: "var(--color-text-normal)" }}
          >
            {c.title}
          </h3>
          {c.description && (
            <p
              className="text-xs leading-relaxed line-clamp-2"
              style={{ color: "var(--color-text-subtle)" }}
            >
              {c.description}
            </p>
          )}
        </div>

        {/* Meta row */}
        {(c.totalLessons > 0 || durationLabel) && (
          <div
            className="flex items-center gap-3 mb-4 text-xs"
            style={{ color: "var(--color-text-subtle)" }}
          >
            {c.totalLessons > 0 && (
              <span className="flex items-center gap-1">
                <BookOpen size={11} /> {c.totalLessons} lessons
              </span>
            )}
            {durationLabel && (
              <span className="flex items-center gap-1">
                <Clock size={11} /> {durationLabel}
              </span>
            )}
            {c.xpPerEpisode > 0 && (
              <span className="flex items-center gap-1">
                <Zap size={11} style={{ color: "var(--color-accent)" }} />
                {c.xpPerEpisode} XP
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        {hasAccess ? (
          <button
            onClick={e => { e.stopPropagation(); router.push(`/learning/${c.id}`); }}
            className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{ background: "var(--color-success, #22c55e)", color: "#fff" }}
          >
            <Play size={13} fill="currentColor" /> Continue Learning
          </button>
        ) : hasPrice ? (
          <button
            onClick={e => { e.stopPropagation(); router.push(`/courses/${c.id}`); }}
            className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
              boxShadow: "0 2px 12px color-mix(in srgb, var(--color-accent) 30%, transparent)",
            }}
          >
            <ShoppingCart size={13} />
            Buy Now · ₹{Number(c.price).toLocaleString("en-IN")}
          </button>
        ) : c.paymentLinkUrl ? (
          <button
            onClick={e => { e.stopPropagation(); router.push(`/courses/${c.id}`); }}
            className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            <ShoppingCart size={13} /> Buy Now
          </button>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); router.push(`/courses/${c.id}`); }}
            className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 border"
            style={{
              background: "transparent",
              borderColor: "color-mix(in srgb, var(--color-accent) 50%, transparent)",
              color: "var(--color-accent)",
            }}
          >
            View Course <ArrowRight size={13} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useCourses({ limit: 100, courseType: "mini_course", search: search || undefined });
  const courses: any[] = data?.data ?? [];

  const { data: enrollmentsData } = useMyEnrollments();
  const enrollments: any[] = (enrollmentsData as any) ?? [];
  const enrolledIds = new Set(enrollments.map((e: any) => e.courseId));

  const { isError: isAuthError } = useMe();

  const handleCourseClick = (c: any) => {
    if (isAuthError) {
      router.push(`/login?redirect_url=${encodeURIComponent(`/courses/${c.id}`)}`);
      return;
    }
    if (c.hasAccess || enrolledIds.has(c.id)) {
      router.push(`/learning/${c.id}`);
    } else {
      router.push(`/courses/${c.id}`);
    }
  };

  // Merge server hasAccess with local enrollment set
  const enriched = courses.map((c: any) => ({
    ...c,
    hasAccess: c.hasAccess || enrolledIds.has(c.id),
  }));

  const enrolledCount = enriched.filter(c => c.hasAccess).length;

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg-primary)" }}>

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "var(--color-bg-surface)", borderBottom: "1px solid var(--color-surface-overlay)" }}
      >
        {/* Radial glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% -10%, color-mix(in srgb, var(--color-accent) 8%, transparent), transparent)",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {/* Tag */}
            <div className="flex items-center justify-center mb-4">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                  color: "var(--color-accent)",
                  border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                }}
              >
                <Sparkles size={11} /> Mini Courses
              </span>
            </div>

            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3"
              style={{ color: "var(--color-text-normal)" }}
            >
              Learn a Skill.{" "}
              <span style={{ color: "var(--color-accent)" }}>Earn From It.</span>
            </h1>
            <p
              className="text-sm sm:text-base max-w-xl mx-auto mb-8"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Focused, self-paced courses — buy once, keep forever.
            </p>

            {/* Stats */}
            {!isLoading && enriched.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="flex items-center justify-center gap-6 mb-8 flex-wrap"
              >
                {[
                  { value: enriched.length, label: "Courses" },
                  { value: enriched.reduce((s: number, c: any) => s + (c.totalLessons || 0), 0), label: "Lessons" },
                  ...(enrolledCount > 0 ? [{ value: enrolledCount, label: "Enrolled" }] : []),
                ].map((stat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {i > 0 && <span style={{ color: "var(--color-surface-overlay-md)" }}>·</span>}
                    <span className="font-black text-lg" style={{ color: "var(--color-text-normal)" }}>
                      {stat.value}
                    </span>
                    <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                      {stat.label}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Search */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="relative max-w-sm mx-auto"
            >
              <Search
                size={15}
                className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--color-text-subtle)" }}
              />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search courses…"
                className="w-full rounded-2xl pl-11 pr-5 py-3 text-sm border outline-none transition-all"
                style={{
                  background: "var(--color-bg-primary)",
                  borderColor: search ? "var(--color-accent)" : "var(--color-surface-overlay-md)",
                  color: "var(--color-text-normal)",
                  boxShadow: search ? "0 0 0 3px color-mix(in srgb, var(--color-accent) 12%, transparent)" : "none",
                }}
              />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : enriched.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24 space-y-4"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-subtle)" }}
            >
              <BookOpen size={28} />
            </div>
            <p className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              {search ? `No courses match "${search}"` : "No mini courses available yet"}
            </p>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ color: "var(--color-accent)" }}
              >
                Clear search
              </button>
            )}
          </motion.div>
        ) : (
          <>
            {/* Result count */}
            <AnimatePresence>
              {search && (
                <motion.p
                  key="count"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs mb-5"
                  style={{ color: "var(--color-text-subtle)" }}
                >
                  {enriched.length} result{enriched.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
                </motion.p>
              )}
            </AnimatePresence>

            {/* Enrolled section */}
            {!search && enrolledCount > 0 && (
              <div className="mb-10">
                <h2
                  className="text-xs font-bold uppercase tracking-widest mb-4"
                  style={{ color: "var(--color-text-subtle)" }}
                >
                  Your Courses
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {enriched
                    .filter(c => c.hasAccess)
                    .map((c, i) => (
                      <CourseCard key={c.id} c={c} index={i} onCourseClick={handleCourseClick} />
                    ))}
                </div>
              </div>
            )}

            {/* All / remaining courses */}
            {(!search && enrolledCount > 0) ? (
              enriched.filter(c => !c.hasAccess).length > 0 && (
                <div>
                  <h2
                    className="text-xs font-bold uppercase tracking-widest mb-4"
                    style={{ color: "var(--color-text-subtle)" }}
                  >
                    Explore More
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {enriched
                      .filter(c => !c.hasAccess)
                      .map((c, i) => (
                        <CourseCard key={c.id} c={c} index={i} onCourseClick={handleCourseClick} />
                      ))}
                  </div>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {enriched.map((c, i) => (
                  <CourseCard key={c.id} c={c} index={i} onCourseClick={handleCourseClick} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

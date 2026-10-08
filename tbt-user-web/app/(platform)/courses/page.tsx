"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useCourses, useMyEnrollments, useCourseCategories } from "@/lib/hooks/useCourses";
import { useWatchHistory } from "@/lib/hooks/useDashboard";
import { useMe, useUpdateProfile } from "@/lib/hooks/useUser";
import MentorshipDashboard from "@/components/features/mentorship/MentorshipDashboard";

// ── Filter config ─────────────────────────────────────────────────────────────

const LEVELS = [
  { value: "all",          label: "All" },
  { value: "beginner",     label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced",     label: "Advanced" },
] as const;

const SORT_OPTIONS = [
  { value: "newest",  label: "Newest" },
  { value: "popular", label: "Popular" },
] as const;

// ── ModuleCard ────────────────────────────────────────────────────────────────

function ModuleCard({
  course,
  enrollment,
  index,
}: {
  course: any;
  enrollment?: any;
  index: number;
}) {
  const hasAccess = course.hasAccess;
  const isLocked = !hasAccess && !enrollment;
  const progressPct = enrollment?.progressPercent ?? 0;
  const isCompleted = enrollment?.completedAt != null;
  const isInProgress = !!enrollment && !isCompleted && progressPct > 0;

  return (
    <Link href={`/learning/${course.id}`} className="block">
      <div
        className="relative overflow-hidden"
        style={{
          height: 248,
          borderRadius: 12,
          background: "#242428",
          border: "1px solid #414146",
          cursor: "pointer",
          transition: "border-color 0.2s",
        }}
      >
        {/* ── Cover (151px) ─── */}
        <div
          className="relative flex flex-col items-center justify-center text-center"
          style={{
            height: 151,
            padding: "12px 16px",
            background:
              "radial-gradient(ellipse at center, #10283b 0%, #071521 58%, #020508 100%)",
          }}
        >
          {/* Grid pattern */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.22,
              background:
                "repeating-linear-gradient(25deg, transparent 0, transparent 18px, #42617b 19px, transparent 20px), repeating-linear-gradient(110deg, transparent 0, transparent 28px, #42617b 29px, transparent 30px)",
            }}
          />
          {/* Brand */}
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 9,
              zIndex: 1,
              color: "white",
              fontSize: 7,
              fontWeight: 800,
            }}
          >
            ✦ TBT BUSINESS
          </div>
          {/* Chapter */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              width: 79,
              padding: 3,
              marginBottom: 8,
              background: "#321b1d",
              border: "1px solid #49292c",
              borderRadius: 5,
              color: "#ddd",
              fontSize: 6,
              textAlign: "center",
            }}
          >
            Chapter {index + 1}
          </div>
          {/* Module label */}
          {course.module && (
            <div
              style={{
                position: "relative",
                zIndex: 1,
                color: "#d9e900",
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: "1px",
                marginBottom: 5,
                textTransform: "uppercase",
              }}
            >
              {course.module}
            </div>
          )}
          {/* Course title */}
          <div
            className="line-clamp-2"
            style={{
              position: "relative",
              zIndex: 1,
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: "-0.3px",
            }}
          >
            {course.title}
          </div>
          {/* Website */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              marginTop: 8,
              color: "#c5cbd0",
              fontSize: 5,
              letterSpacing: "1.5px",
            }}
          >
            WWW.TAMILBUSINESSTRIBE.COM
          </div>
        </div>

        {/* ── Details (96px) ─── */}
        <div
          className="relative flex flex-col justify-between"
          style={{ height: 96, padding: "10px 14px" }}
        >
          {/* Duration row */}
          <div style={{ color: "#8b8b93", fontSize: 13, lineHeight: 1.55 }}>
            Video Duration -{" "}
            <strong style={{ color: "#f4f4f6", fontWeight: 500 }}>
              {course.durationDisplay ?? "—"}
            </strong>
            <br />
            Task Duration -{" "}
            <strong style={{ color: "#f4f4f6", fontWeight: 500 }}>
              {course.taskDurationDisplay ?? "—"}
            </strong>
          </div>

          {/* Price chip — visible on paid locked courses */}
          {!course.hasAccess && !enrollment && course.price > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: "rgba(255,224,0,0.1)", border: "1px solid rgba(255,224,0,0.25)" }}>
              <span style={{ color: "#ffe000", fontSize: 11, fontWeight: 700 }}>
                ₹{(course.price as number).toLocaleString("en-IN")}
              </span>
            </div>
          )}

          {/* Status circle (absolute, top-right) */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: 10,
              right: 12,
              width: 33,
              height: 33,
              borderRadius: "50%",
              background: "transparent",
              border: "1px solid #a4a4aa",
              color: isCompleted ? "#22c55e" : isInProgress ? "#dc2626" : "#a4a4aa",
              fontSize: 18,
            }}
          >
            {isCompleted ? "⟲" : isInProgress ? "▶" : "!"}
          </div>

          {/* Progress bar */}
          <div>
            <div
              style={{
                width: "100%",
                height: 18,
                background: "#3b3b40",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, progressPct)}%`,
                  height: "100%",
                  borderRadius: 12,
                  background: isCompleted ? "#22c55e" : "#dc2626",
                  transition: "width 1s ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Lock overlay ─── */}
        {isLocked && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: "rgba(19,19,19,0.87)", zIndex: 10 }}
          >
            <div style={{ fontSize: 24 }}>🔒</div>
            <div
              style={{
                color: "#a0a0a0",
                fontSize: 11,
                textAlign: "center",
                padding: "0 20px",
                lineHeight: 1.4,
              }}
            >
              {course.price > 0 ? "Purchase this module to unlock" : "Request access to unlock"}
            </div>
            {course.price > 0 && (
              <div style={{ marginTop: 4, color: "#ffe000", fontSize: 13, fontWeight: 700 }}>
                ₹{(course.price as number).toLocaleString("en-IN")}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── SavedVideoCard ─────────────────────────────────────────────────────────────

function SavedVideoCard({ item }: { item: any }) {
  const href =
    item.type === "course"
      ? `/learning/${item.courseId}?lesson=${item.episodeId}`
      : `/workshop/${item.workshopSlug}`;

  return (
    <Link href={href} className="block">
      <div
        className="relative flex flex-col items-center justify-center text-center overflow-hidden"
        style={{
          height: 151,
          borderRadius: 12,
          padding: "12px 16px",
          border: "1px solid #414146",
          cursor: "pointer",
          background:
            "radial-gradient(ellipse at center, #10283b 0%, #071521 58%, #020508 100%)",
        }}
      >
        {/* Thumbnail */}
        {item.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.4,
            }}
          />
        )}
        {/* Dark overlay */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
        {/* Grid (no thumb) */}
        {!item.thumbnailUrl && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.22,
              background:
                "repeating-linear-gradient(25deg, transparent 0, transparent 18px, #42617b 19px, transparent 20px), repeating-linear-gradient(110deg, transparent 0, transparent 28px, #42617b 29px, transparent 30px)",
            }}
          />
        )}
        {/* Brand */}
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 9,
            zIndex: 1,
            color: "white",
            fontSize: 7,
            fontWeight: 800,
          }}
        >
          ✦ TBT BUSINESS
        </div>
        {/* Play icon */}
        <div
          className="relative flex items-center justify-center"
          style={{
            zIndex: 1,
            marginBottom: 8,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            color: "white",
            fontSize: 14,
          }}
        >
          ▶
        </div>
        {/* Title */}
        <div
          className="line-clamp-2 relative"
          style={{
            zIndex: 1,
            color: "white",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.3,
            padding: "0 4px",
          }}
        >
          {item.episodeTitle ?? item.workshopTitle ?? item.courseTitle}
        </div>
      </div>
    </Link>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────

function PageFooter() {
  return (
    <div style={{ paddingTop: 32, paddingBottom: 16, borderTop: "1px solid #2a2a2e" }}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-6 justify-between">
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f7", marginBottom: 8 }}>
            ✦ Tamil Business Tribe
          </div>
          <div style={{ fontSize: 12, color: "#92929b", maxWidth: 280, lineHeight: 1.6 }}>
            India&apos;s premier business mentorship community. Grow your business with expert
            guidance.
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#92929b" }}>
          <div style={{ marginBottom: 6 }}>📞 +91 80151 39542</div>
          <div style={{ marginBottom: 12 }}>✉ helpdesk@tamilbusinesstribe.com</div>
          <div style={{ fontSize: 10, color: "#55555b" }}>
            © {new Date().getFullYear()} Tamil Business Tribe. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const [search, setSearch]     = useState("");
  const [level, setLevel]       = useState("all");
  const [sort, setSort]         = useState<"newest" | "popular">("newest");
  const [category, setCategory] = useState("all");
  const [showAll, setShowAll]   = useState(false);

  // CF-03 — reset pagination when any filter changes
  useEffect(() => {
    setShowAll(false);
  }, [search, level, sort, category]);

  const { data: me }       = useMe();
  const updateProfile      = useUpdateProfile();
  const memberTrack        = (me as any)?.businessType as string | null | undefined;

  const { data: categories } = useCourseCategories();

  const { data: catalogData, isLoading: catalogLoading } = useCourses({
    search:      search || undefined,
    level:       level !== "all" ? level : undefined,
    sort,
    category:    category !== "all" ? category : undefined,
    moduleTitle: memberTrack ?? undefined,
    limit: 24,
  });
  const { data: enrollments, isLoading: enrollLoading } = useMyEnrollments();
  const { data: watchHistoryData } = useWatchHistory({ limit: 3 });

  const catalogCourses: any[]  = catalogData?.data ?? [];
  const myEnrollments: any[]   = enrollments ?? [];
  const savedVideos: any[]     = (watchHistoryData as any)?.data ?? [];

  const enrolledMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of myEnrollments) m.set(e.courseId, e);
    return m;
  }, [myEnrollments]);

  const visibleCourses = showAll ? catalogCourses : catalogCourses.slice(0, 6);

  return (
    <div className="space-y-8 pb-8">

      {/* ── Mentorship Dashboard ─────────────────────────────────────── */}
      <MentorshipDashboard />

      {/* ── Modules ──────────────────────────────────────────────────── */}
      <section>
        {/* Section header */}
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: "#f5f5f7" }}>Modules</h2>
          <div className="flex items-center gap-3">
            {!catalogLoading && catalogCourses.length > 0 && (
              <span style={{ fontSize: 11, color: "#92929b" }}>
                {catalogCourses.length} modules
              </span>
            )}
            <Link
              href="/learning/badges"
              style={{
                padding: "6px 16px",
                border: "1px solid #77777e",
                borderRadius: 9,
                color: "#a0a0a8",
                fontSize: 12,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              My Badges
            </Link>
          </div>
        </div>

        {/* Track selector */}

        {/* Active track badge + clear */}
        {memberTrack && (
          <div className="flex items-center gap-2 mb-4">
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 999,
                background: "rgba(220,38,38,0.12)",
                border: "1px solid rgba(220,38,38,0.28)",
                color: "#dc2626",
              }}
            >
              {memberTrack} Track
            </span>
            <button
              onClick={() => updateProfile.mutate({ businessType: null })}
              disabled={updateProfile.isPending}
              style={{
                fontSize: 11,
                textDecoration: "underline",
                color: "#92929b",
                background: "none",
                border: "none",
                cursor: "pointer",
                opacity: updateProfile.isPending ? 0.5 : 1,
              }}
            >
              Show all
            </button>
          </div>
        )}

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative" style={{ flex: 1, maxWidth: 320 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#92929b",
              }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules..."
              style={{
                width: "100%",
                paddingLeft: 36,
                paddingRight: 16,
                height: 40,
                fontSize: 13,
                color: "#f5f5f7",
                background: "#242428",
                border: "1px solid #414146",
                borderRadius: 9,
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#dc2626")}
              onBlur={(e) => (e.target.style.borderColor = "#414146")}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            {LEVELS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setLevel(value)}
                style={{
                  height: 40,
                  padding: "0 14px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: level === value ? "#dc2626" : "#242428",
                  color: level === value ? "white" : "#92929b",
                  border: `1px solid ${level === value ? "transparent" : "#414146"}`,
                }}
              >
                {label}
              </button>
            ))}
            {categories && (categories as any[]).length > 0 && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "#242428",
                  border: "1px solid #414146",
                  color: "#92929b",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Categories</option>
                {(categories as any[]).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "newest" | "popular")}
              style={{
                height: 40,
                padding: "0 12px",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 600,
                background: "#242428",
                border: "1px solid #414146",
                color: "#92929b",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Module grid */}
        {catalogLoading || enrollLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{ height: 248, borderRadius: 12, background: "#242428", border: "1px solid #414146" }}
              />
            ))}
          </div>
        ) : catalogCourses.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              background: "#242428",
              borderRadius: 12,
              border: "1px solid #414146",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
            <p style={{ color: "#92929b", fontSize: 14 }}>No modules found</p>
            {(search || level !== "all" || category !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setLevel("all");
                  setSort("newest");
                  setCategory("all");
                }}
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#dc2626",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleCourses.map((course: any, i) => (
                <ModuleCard
                  key={course.id}
                  course={course}
                  enrollment={enrolledMap.get(course.id)}
                  index={i}
                />
              ))}
            </div>
            {!showAll && catalogCourses.length > 6 && (
              <div style={{ textAlign: "center", marginTop: 24 }}>
                <button
                  onClick={() => setShowAll(true)}
                  style={{
                    padding: "10px 32px",
                    borderRadius: 9,
                    background: "#242428",
                    border: "1px solid #414146",
                    color: "#f5f5f7",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Load more ({catalogCourses.length - 6} more)
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Saved Videos ─────────────────────────────────────────────── */}
      {savedVideos.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#f5f5f7" }}>
              Saved Videos
            </h2>
            <Link href="/history" style={{ fontSize: 12, color: "#92929b", textDecoration: "underline" }}>
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedVideos.slice(0, 3).map((item: any, i) => (
              <SavedVideoCard key={item.episodeId ?? item.id ?? i} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <PageFooter />
    </div>
  );
}

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Lock, Play, BookOpen } from "lucide-react";
import { useCourses, useMyEnrollments } from "@/lib/hooks/useCourses";
import { useWatchHistory } from "@/lib/hooks/useDashboard";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import MentorshipDashboard from "@/components/features/mentorship/MentorshipDashboard";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModuleConfig {
  moduleName: string;
  displayName: string | null;
  tagline: string | null;
  description: string | null;
  bannerUrl: string | null;
  iconUrl: string | null;
  accentColor: string | null;
  sortOrder: number;
}

// ── ModuleCard ────────────────────────────────────────────────────────────────

type LockReason = "not_enrolled" | "plan_required" | "module_not_allowed" | "purchase_required" | null;

function ModuleCard({
  course,
  enrollment,
  index,
  lockReason,
}: {
  course: any;
  enrollment?: any;
  index: number;
  lockReason?: LockReason;
}) {
  const hasAccess = course.hasAccess;
  const isLocked = lockReason != null || (!hasAccess && !enrollment);
  const progressPct = enrollment?.progressPercent ?? 0;
  const isCompleted = enrollment?.completedAt != null;
  const isInProgress = !!enrollment && !isCompleted && progressPct > 0;

  const lockMessages: Record<NonNullable<LockReason>, string> = {
    module_not_allowed: "Not included in your program",
    purchase_required: course.price > 0 ? `Purchase to unlock — ₹${(course.price as number).toLocaleString("en-IN")}` : "Request access to unlock",
    plan_required: "Upgrade your plan to access",
    not_enrolled: "Enroll to get started",
  };

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
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.22,
              background:
                "repeating-linear-gradient(25deg, transparent 0, transparent 18px, #42617b 19px, transparent 20px), repeating-linear-gradient(110deg, transparent 0, transparent 28px, #42617b 29px, transparent 30px)",
            }}
          />
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

          {!course.hasAccess && !enrollment && course.price > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: "rgba(255,224,0,0.1)", border: "1px solid rgba(255,224,0,0.25)" }}>
              <span style={{ color: "#ffe000", fontSize: 11, fontWeight: 700 }}>
                ₹{(course.price as number).toLocaleString("en-IN")}
              </span>
            </div>
          )}

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
            <Lock size={24} style={{ color: "#a0a0a0" }} />
            <div
              style={{
                color: "#a0a0a0",
                fontSize: 11,
                textAlign: "center",
                padding: "0 20px",
                lineHeight: 1.4,
              }}
            >
              {lockReason ? lockMessages[lockReason] : (course.price > 0 ? "Purchase this module to unlock" : "Request access to unlock")}
            </div>
            {lockReason !== "module_not_allowed" && course.price > 0 && (
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

// ── ModuleHero (single-module dedicated banner) ───────────────────────────────

function ModuleHero({ cfg, programName, courseCount }: { cfg: ModuleConfig; programName: string | null; courseCount: number }) {
  const accent = cfg.accentColor ?? "var(--color-accent)";
  return (
    <div
      className="relative overflow-hidden rounded-2xl mb-8"
      style={{ minHeight: 180 }}
    >
      {cfg.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cfg.bannerUrl}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${accent}33 0%, #0a0a0a 70%)` }} />
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 100%)" }} />
      <div className="relative p-8 flex flex-col justify-center" style={{ minHeight: 180 }}>
        {programName && (
          <div
            style={{
              display: "inline-block",
              marginBottom: 10,
              padding: "3px 12px",
              borderRadius: 999,
              background: `${accent}22`,
              border: `1px solid ${accent}55`,
              color: accent,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            {programName}
          </div>
        )}
        <h1 className="overlay-text" style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, maxWidth: 480 }}>
          {cfg.displayName ?? cfg.moduleName}
        </h1>
        {cfg.tagline && (
          <p className="overlay-meta" style={{ fontSize: 14, maxWidth: 380, marginBottom: 16 }}>
            {cfg.tagline}
          </p>
        )}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5" style={{ color: "#ccc", fontSize: 12 }}>
            <BookOpen size={13} />
            <span>{courseCount} {courseCount === 1 ? "course" : "courses"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ModuleProgressBar ─────────────────────────────────────────────────────────

function ModuleProgressBar({ courses, enrolledMap }: { courses: any[]; enrolledMap: Map<string, any> }) {
  const total = courses.length;
  const completed = courses.filter(c => enrolledMap.get(c.id)?.completedAt).length;
  const inProgress = courses.filter(c => {
    const e = enrolledMap.get(c.id);
    return e && !e.completedAt && (e.progressPercent ?? 0) > 0;
  }).length;
  if (total === 0) return null;
  const pct = Math.round((completed / total) * 100);

  return (
    <div
      className="flex items-center gap-4 p-4 rounded-xl mb-6"
      style={{ background: "#1a1a1e", border: "1px solid #2a2a2e" }}
    >
      <div style={{ flex: 1 }}>
        <div className="flex justify-between items-center mb-2">
          <span style={{ fontSize: 12, fontWeight: 600, color: "#a0a0a8" }}>Your Progress</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f7" }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: "#2a2a2e", borderRadius: 6, overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: 6,
              background: "var(--color-accent)",
              transition: "width 1s ease",
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-4 text-center" style={{ fontSize: 11, color: "#a0a0a8" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e", lineHeight: 1 }}>{completed}</div>
          <div>Done</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-accent)", lineHeight: 1 }}>{inProgress}</div>
          <div>Active</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f7", lineHeight: 1 }}>{total}</div>
          <div>Total</div>
        </div>
      </div>
    </div>
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
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
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
          <Play size={14} />
        </div>
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

// ── CourseGrid ────────────────────────────────────────────────────────────────

function CourseGrid({
  courses,
  enrolledMap,
  allowedModules,
  isLoading,
  uiStrings,
}: {
  courses: any[];
  enrolledMap: Map<string, any>;
  allowedModules: string[];
  isLoading: boolean;
  uiStrings: any;
}) {
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { setShowAll(false); }, [courses]);

  const visibleCourses = showAll ? courses : courses.slice(0, 6);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{ height: 248, borderRadius: 12, background: "#242428", border: "1px solid #414146" }}
          />
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
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
        <p style={{ color: "#92929b", fontSize: 14 }}>{uiStrings?.coursesEmptyState ?? "No modules found"}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleCourses.map((course: any, i) => {
          let lockReason: LockReason = null;
          if (allowedModules.length > 0 && course.module && !allowedModules.includes(course.module)) {
            lockReason = "module_not_allowed";
          } else if (!course.hasAccess && !enrolledMap.has(course.id)) {
            lockReason = course.price > 0 ? "purchase_required" : "not_enrolled";
          }
          return (
            <ModuleCard
              key={course.id}
              course={course}
              enrollment={enrolledMap.get(course.id)}
              index={i}
              lockReason={lockReason}
            />
          );
        })}
      </div>
      {!showAll && courses.length > 6 && (
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
            {uiStrings?.coursesLoadMore ?? "Load more"} ({courses.length - 6} more)
          </button>
        </div>
      )}
    </>
  );
}

// ── NewMemberCoursesView ──────────────────────────────────────────────────────

function NewMemberCoursesView({ uiStrings }: { uiStrings: any }) {
  return (
    <div
      className="rounded-2xl p-8 text-center"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #0a0a0f 100%)", border: "1px solid #2a2a3a" }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#f5f5f7", marginBottom: 10 }}>
        {uiStrings?.coursesNewMemberTitle ?? "Your Learning Journey Starts Here"}
      </h2>
      <p style={{ fontSize: 14, color: "#92929b", maxWidth: 400, margin: "0 auto 24px" }}>
        {uiStrings?.coursesNewMemberDesc ?? "Join a program or purchase a course to access our library of business modules."}
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        <Link
          href="/programs"
          style={{
            padding: "10px 24px",
            borderRadius: 10,
            background: "var(--color-accent)",
            color: "white",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {uiStrings?.coursesExplorePrograms ?? "Explore Programs"}
        </Link>
        <Link
          href="/Products"
          style={{
            padding: "10px 24px",
            borderRadius: 10,
            background: "#242428",
            border: "1px solid #414146",
            color: "#f5f5f7",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {uiStrings?.coursesViewPlans ?? "View Plans"}
        </Link>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const { uiStrings } = useSiteConfig();

  const { data: enrollments } = useMyEnrollments();
  const { data: watchHistoryData } = useWatchHistory({ limit: 3 });

  const { data: catalogData, isLoading: catalogLoading } = useCourses({
    limit: 100,
  });

  const allCourses: any[]    = catalogData?.data ?? [];
  const meta: any            = (catalogData as any)?.meta ?? {};
  const personalizationState: "new" | "program" | "direct" = meta.personalizationState ?? "new";
  const allowedModules: string[]     = meta.allowedModules ?? [];
  const programName: string | null   = meta.programName ?? null;
  const moduleConfigs: ModuleConfig[] = meta.moduleConfigs ?? [];

  const myEnrollments: any[]  = enrollments ?? [];
  const savedVideos: any[]    = (watchHistoryData as any)?.data ?? [];

  const enrolledMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of myEnrollments) m.set(e.courseId, e);
    return m;
  }, [myEnrollments]);

  // Module tabs — when program has multiple allowed modules
  const availableModules = useMemo(() => {
    if (allowedModules.length <= 1) return [];
    return allowedModules.map(name => {
      const cfg = moduleConfigs.find(m => m.moduleName === name);
      return { name, displayName: cfg?.displayName ?? name };
    });
  }, [allowedModules, moduleConfigs]);

  // Initialize active tab when modules load
  useEffect(() => {
    if (availableModules.length > 0 && activeTab === null) {
      setActiveTab(availableModules[0].name);
    }
  }, [availableModules, activeTab]);

  // Filter courses by active tab (multi-module) or allowed module (single-module)
  const filteredCourses = useMemo(() => {
    if (availableModules.length > 1 && activeTab) {
      return allCourses.filter(c => c.module === activeTab);
    }
    if (allowedModules.length === 1) {
      return allCourses.filter(c => c.module === allowedModules[0] || !c.module);
    }
    return allCourses;
  }, [allCourses, availableModules, activeTab, allowedModules]);




  // Single-module config (used when allowedModules.length === 1)
  const singleModuleCfg = useMemo(() => {
    if (allowedModules.length !== 1) return null;
    return moduleConfigs.find(m => m.moduleName === allowedModules[0]) ?? null;
  }, [allowedModules, moduleConfigs]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-8">

      {/* ── Mentorship Dashboard ─────────────────────────────────────── */}
      <MentorshipDashboard />

      {/* ── New Member State ─────────────────────────────────────────── */}
      {personalizationState === "new" && !catalogLoading && allCourses.length === 0 && (
        <NewMemberCoursesView uiStrings={uiStrings} />
      )}

      {/* ── Single-Module Dedicated View (CP-16) ─────────────────────── */}
      {personalizationState === "program" && allowedModules.length === 1 && singleModuleCfg && (
        <section>
          <ModuleHero
            cfg={singleModuleCfg}
            programName={programName}
            courseCount={filteredCourses.length}
          />
          <ModuleProgressBar courses={filteredCourses} enrolledMap={enrolledMap} />
          <CourseGrid
            courses={filteredCourses}
            enrolledMap={enrolledMap}
            allowedModules={[]}
            isLoading={catalogLoading}
            uiStrings={uiStrings}
          />
        </section>
      )}

      {/* ── Multi-Module Program View ─────────────────────────────────── */}
      {personalizationState === "program" && allowedModules.length > 1 && (
        <section>
          {programName && (
            <div className="mb-6">
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  borderRadius: 999,
                  background: "rgba(220,38,38,0.1)",
                  border: "1px solid rgba(220,38,38,0.25)",
                  color: "var(--color-accent)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                {programName}
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#f5f5f7" }}>
                {uiStrings?.coursesProgramTitle ?? "Your Program Modules"}
              </h2>
            </div>
          )}

          {/* Module tabs */}
          {availableModules.length > 1 && (
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              {availableModules.map(({ name, displayName }) => (
                <button
                  key={name}
                  onClick={() => setActiveTab(name)}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 9,
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    background: activeTab === name ? "var(--color-accent)" : "#242428",
                    color: activeTab === name ? "white" : "#92929b",
                    border: `1px solid ${activeTab === name ? "transparent" : "#414146"}`,
                    transition: "all 0.15s",
                  }}
                >
                  {displayName}
                </button>
              ))}
            </div>
          )}

          <ModuleProgressBar courses={filteredCourses} enrolledMap={enrolledMap} />

          <CourseGrid
            courses={filteredCourses}
            enrolledMap={enrolledMap}
            allowedModules={[]}
            isLoading={catalogLoading}
            uiStrings={uiStrings}
          />
        </section>
      )}

      {/* ── Direct Access / General Catalog View ─────────────────────── */}
      {(personalizationState === "direct" || (personalizationState === "new" && (allCourses.length > 0 || catalogLoading))) && (
        <section>
          <div className="mb-5">
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: "#f5f5f7" }}>
              {uiStrings?.coursesCatalogTitle ?? "Modules"}
            </h2>
          </div>

          <CourseGrid
            courses={allCourses}
            enrolledMap={enrolledMap}
            allowedModules={[]}
            isLoading={catalogLoading}
            uiStrings={uiStrings}
          />
        </section>
      )}

      {/* ── Saved Videos ─────────────────────────────────────────────── */}
      {savedVideos.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#f5f5f7" }}>
              {uiStrings?.coursesSavedVideos ?? "Saved Videos"}
            </h2>
            <Link href="/history" style={{ fontSize: 12, color: "#92929b", textDecoration: "underline" }}>
              {uiStrings?.coursesViewAll ?? "View All"}
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
      <div style={{ paddingTop: 32, paddingBottom: 16, borderTop: "1px solid #2a2a2e" }}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-6 justify-between">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f7", marginBottom: 8 }}>
              ✦ Tamil Business Tribe
            </div>
            <div style={{ fontSize: 12, color: "#92929b", maxWidth: 280, lineHeight: 1.6 }}>
              {uiStrings?.footerTagline ?? "India's premier business mentorship community. Grow your business with expert guidance."}
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
    </div>
  );
}

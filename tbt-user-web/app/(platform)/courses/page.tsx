"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Play, BookOpen } from "lucide-react";
import { useCourses, useCourse, useMyEnrollments } from "@/lib/hooks/useCourses";
import { useWatchHistory } from "@/lib/hooks/useDashboard";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import MentorshipDashboard from "@/components/features/mentorship/MentorshipDashboard";
import CoursesPageRoadmap from "@/components/features/courses/CoursesPageRoadmap";
import ModulesFaqButton from "@/components/features/courses/ModulesFaq";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SectionCardData {
  id: string;
  title: string;
  sortOrder: number;
  totalEpisodes: number;
  completedEpisodes: number;
  firstLessonId: string | null;
  isLocked: boolean;
  thumbnail: string | null;
}

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

type LockReason = "join_program" | "not_enrolled" | "plan_required" | "module_not_allowed" | "purchase_required" | null;

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
  const hasThumbnail = !!course.thumbnailUrl;

  const { uiStrings: lockStrings } = useSiteConfig();
  const lockMessages: Record<NonNullable<LockReason>, string> = {
    join_program: lockStrings?.coursesLockJoinProgram ?? "Join a program to access this module",
    module_not_allowed: lockStrings?.coursesLockNotInProgram ?? "Not included in your program",
    purchase_required: course.price > 0 ? `${lockStrings?.coursesLockPurchase ?? "Purchase to unlock"} — ₹${(course.price as number).toLocaleString("en-IN")}` : (lockStrings?.coursesLockRequestAccess ?? "Request access to unlock"),
    plan_required: "Upgrade your plan to access",
    not_enrolled: lockStrings?.coursesLockRequestAccess ?? "Request access to unlock",
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
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#606066"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.4)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#414146"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
      >
        {/* ── Cover (151px) ─── */}
        <div
          className="relative flex flex-col items-center justify-center text-center"
          style={{
            height: 151,
            padding: "12px 16px",
            background: hasThumbnail
              ? `url(${JSON.stringify(course.thumbnailUrl)}) center / cover no-repeat`
              : "radial-gradient(ellipse at center, #10283b 0%, #071521 58%, #020508 100%)",
          }}
        >
          {/* Dark overlay for thumbnail readability */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: hasThumbnail
                ? "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.72) 100%)"
                : undefined,
              opacity: hasThumbnail ? 1 : undefined,
            }}
          />
          {/* Grid pattern (only when no thumbnail) */}
          {!hasThumbnail && (
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
              color: "rgba(255,255,255,0.7)",
              fontSize: 7,
              fontWeight: 800,
              letterSpacing: "0.5px",
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
              background: "rgba(50,27,29,0.85)",
              border: "1px solid rgba(73,41,44,0.9)",
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
              color: "rgba(197,203,208,0.7)",
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
          <div style={{ color: "#8b8b93", fontSize: 12, lineHeight: 1.6 }}>
            <span>Video </span>
            <strong style={{ color: "#f4f4f6", fontWeight: 500 }}>
              {course.durationDisplay ?? "—"}
            </strong>
            <span style={{ margin: "0 6px", color: "#414146" }}>·</span>
            <span>Tasks </span>
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

          {/* Status badge — top right */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: 10,
              right: 12,
              width: 33,
              height: 33,
              borderRadius: "50%",
              background: isCompleted
                ? "rgba(34,197,94,0.15)"
                : isInProgress
                ? "rgba(220,38,38,0.15)"
                : "rgba(164,164,170,0.1)",
              border: `1px solid ${isCompleted ? "rgba(34,197,94,0.5)" : isInProgress ? "rgba(220,38,38,0.5)" : "#a4a4aa"}`,
              color: isCompleted ? "#22c55e" : isInProgress ? "#dc2626" : "#a4a4aa",
              fontSize: isCompleted ? 16 : 18,
            }}
            title={isCompleted ? "Completed" : isInProgress ? "In progress" : "Not started"}
          >
            {isCompleted ? "✓" : isInProgress ? "▶" : "○"}
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span style={{ fontSize: 10, color: "#606066" }}>
                {isCompleted ? "Completed" : isInProgress ? `${Math.round(progressPct)}%` : "Not started"}
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 6,
                background: "#3b3b40",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, isCompleted ? 100 : progressPct)}%`,
                  height: "100%",
                  borderRadius: 6,
                  background: isCompleted ? "#22c55e" : "var(--color-accent)",
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

// ── SectionCard ───────────────────────────────────────────────────────────────

function SectionCard({
  section,
  courseId,
  courseThumbnail,
  index,
}: {
  section: SectionCardData;
  courseId: string;
  courseThumbnail?: string | null;
  index: number;
}) {
  const total = section.totalEpisodes;
  const completed = section.completedEpisodes;
  const progressPct = total > 0 ? (completed / total) * 100 : 0;
  const isCompleted = total > 0 && completed === total;
  const isInProgress = completed > 0 && !isCompleted;
  const thumbnail = section.thumbnail ?? courseThumbnail ?? null;
  const href = section.firstLessonId
    ? `/learning/${courseId}?lesson=${section.firstLessonId}`
    : `/learning/${courseId}`;

  return (
    <Link href={href} className="block">
      <div
        className="relative overflow-hidden"
        style={{
          height: 248,
          borderRadius: 12,
          background: "#242428",
          border: "1px solid #414146",
          cursor: "pointer",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "#606066";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.4)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = "#414146";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {/* Cover 151px */}
        <div
          className="relative flex flex-col items-center justify-center text-center"
          style={{
            height: 151,
            padding: "12px 16px",
            background: thumbnail
              ? `url(${JSON.stringify(thumbnail)}) center / cover no-repeat`
              : "radial-gradient(ellipse at center, #10283b 0%, #071521 58%, #020508 100%)",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: thumbnail ? "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.72) 100%)" : undefined }} />
          {!thumbnail && (
            <div style={{ position: "absolute", inset: 0, opacity: 0.22, background: "repeating-linear-gradient(25deg, transparent 0, transparent 18px, #42617b 19px, transparent 20px), repeating-linear-gradient(110deg, transparent 0, transparent 28px, #42617b 29px, transparent 30px)" }} />
          )}
          <div style={{ position: "absolute", top: 8, right: 9, zIndex: 1, color: "rgba(255,255,255,0.7)", fontSize: 7, fontWeight: 800, letterSpacing: "0.5px" }}>
            ✦ TBT BUSINESS
          </div>
          <div style={{ position: "relative", zIndex: 1, width: 79, padding: 3, marginBottom: 8, background: "rgba(50,27,29,0.85)", border: "1px solid rgba(73,41,44,0.9)", borderRadius: 5, color: "#ddd", fontSize: 6, textAlign: "center" }}>
            Module {index + 1}
          </div>
          <div
            className="line-clamp-2"
            style={{ position: "relative", zIndex: 1, color: "white", fontSize: 14, fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.3px" }}
          >
            {section.title}
          </div>
          <div style={{ position: "relative", zIndex: 1, marginTop: 8, color: "rgba(197,203,208,0.7)", fontSize: 5, letterSpacing: "1.5px" }}>
            WWW.TAMILBUSINESSTRIBE.COM
          </div>
        </div>

        {/* Details 96px */}
        <div className="relative flex flex-col justify-between" style={{ height: 96, padding: "10px 14px" }}>
          <div style={{ color: "#8b8b93", fontSize: 12, lineHeight: 1.6 }}>
            <span>Videos </span>
            <strong style={{ color: "#f4f4f6", fontWeight: 500 }}>{total}</strong>
            <span style={{ margin: "0 6px", color: "#414146" }}>·</span>
            <span style={{ color: isCompleted ? "#22c55e" : isInProgress ? "var(--color-accent)" : "#8b8b93" }}>
              {isCompleted ? "Completed" : isInProgress ? `${completed}/${total} done` : "Not started"}
            </span>
          </div>
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: 10, right: 12, width: 33, height: 33, borderRadius: "50%",
              background: isCompleted ? "rgba(34,197,94,0.15)" : isInProgress ? "rgba(220,38,38,0.15)" : "rgba(164,164,170,0.1)",
              border: `1px solid ${isCompleted ? "rgba(34,197,94,0.5)" : isInProgress ? "rgba(220,38,38,0.5)" : "#a4a4aa"}`,
              color: isCompleted ? "#22c55e" : isInProgress ? "var(--color-accent)" : "#a4a4aa",
              fontSize: isCompleted ? 16 : 18,
            }}
          >
            {isCompleted ? "✓" : isInProgress ? "▶" : "○"}
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span style={{ fontSize: 10, color: "#606066" }}>{Math.round(progressPct)}%</span>
            </div>
            <div style={{ width: "100%", height: 6, background: "#3b3b40", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, progressPct)}%`, height: "100%", borderRadius: 6, background: isCompleted ? "#22c55e" : "var(--color-accent)", transition: "width 1s ease" }} />
            </div>
          </div>
        </div>

        {/* Lock overlay */}
        {section.isLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: "rgba(19,19,19,0.87)", zIndex: 10 }}>
            <Lock size={24} style={{ color: "#a0a0a0" }} />
            <div style={{ color: "#a0a0a0", fontSize: 11, textAlign: "center", padding: "0 20px", lineHeight: 1.4 }}>
              Complete the previous module to unlock
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

// ── SectionGrid ───────────────────────────────────────────────────────────────

function SectionGrid({
  sections,
  courseId,
  courseThumbnail,
  isLoading,
  uiStrings,
}: {
  sections: SectionCardData[];
  courseId: string;
  courseThumbnail?: string | null;
  isLoading: boolean;
  uiStrings: any;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse" style={{ height: 248, borderRadius: 12, background: "#242428", border: "1px solid #414146" }} />
        ))}
      </div>
    );
  }
  if (sections.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", background: "#242428", borderRadius: 12, border: "1px solid #414146" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
        <p style={{ color: "#92929b", fontSize: 14 }}>{uiStrings?.coursesEmptyState ?? "No modules found"}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {sections.map((section, i) => (
        <SectionCard key={section.id} section={section} courseId={courseId} courseThumbnail={courseThumbnail} index={i} />
      ))}
    </div>
  );
}

// ── ModuleHero (single-module dedicated banner) ───────────────────────────────

function ModuleHero({
  cfg,
  programName,
  courseCount,
  memberBusinessType,
  primaryCourseTitle,
}: {
  cfg: ModuleConfig;
  programName: string | null;
  courseCount: number;
  memberBusinessType?: string | null;
  primaryCourseTitle?: string | null;
}) {
  const accent = cfg.accentColor ?? "var(--color-accent)";
  // When a single course dominates this module, show its title as the main heading.
  // The module displayName becomes a secondary label shown below.
  const mainTitle = primaryCourseTitle ?? cfg.displayName ?? cfg.moduleName;
  const subLabel = primaryCourseTitle ? (cfg.displayName ?? cfg.moduleName) : null;

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
        {/* Program badge */}
        {programName && (
          <div
            style={{
              display: "inline-block",
              marginBottom: 8,
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
        {/* Module label — shown as secondary text when a course title takes the h1 */}
        {subLabel && (
          <div
            style={{
              marginBottom: 6,
              color: "rgba(255,255,255,0.55)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            {subLabel}
          </div>
        )}
        <div className="flex items-start justify-between gap-3 flex-wrap" style={{ marginBottom: 8 }} data-testid="modules-heading-row">
          <h1 className="overlay-text min-w-0" style={{ fontSize: 26, fontWeight: 700, margin: 0, maxWidth: 520, lineHeight: 1.25 }}>
            {mainTitle}
          </h1>
          <ModulesFaqButton />
        </div>
        {cfg.tagline && (
          <p className="overlay-meta" style={{ fontSize: 14, maxWidth: 380, marginBottom: 16 }}>
            {cfg.tagline}
          </p>
        )}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5" style={{ color: "#ccc", fontSize: 12 }}>
            <BookOpen size={13} />
            <span>{courseCount} {courseCount === 1 ? "course" : "courses"}</span>
          </div>
          {memberBusinessType && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 11, fontWeight: 600 }}>
              <span style={{ opacity: 0.7 }}>For:</span>
              <span>{memberBusinessType}</span>
            </div>
          )}
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
  // Course: deep-link to the specific lesson.
  // Workshop: pass ?ep= so the workshop detail page can auto-play the right episode.
  const href =
    item.type === "course"
      ? `/learning/${item.courseId ?? ""}?lesson=${item.episodeId}`
      : `/workshop/${item.workshopSlug ?? ""}?ep=${item.episodeId}`;

  const isCompleted = item.isCompleted as boolean;
  const progressPct = Math.min(100, item.progressPercent ?? 0);
  const contextTitle: string =
    item.type === "course"
      ? (item.courseTitle ?? "")
      : (item.workshopTitle ?? "");

  return (
    <Link href={href} className="block">
      <div
        className="relative flex flex-col justify-end overflow-hidden"
        style={{
          height: 151,
          borderRadius: 12,
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
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
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

        {/* Play / Done badge */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            top: 8,
            left: 10,
            zIndex: 1,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: isCompleted ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.15)",
            border: `1px solid ${isCompleted ? "rgba(34,197,94,0.6)" : "rgba(255,255,255,0.3)"}`,
            color: isCompleted ? "#22c55e" : "white",
          }}
        >
          {isCompleted ? (
            <span style={{ fontSize: 13 }}>✓</span>
          ) : (
            <Play size={12} fill="white" />
          )}
        </div>

        {/* Type badge */}
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 9,
            zIndex: 1,
            padding: "2px 6px",
            borderRadius: 4,
            background: "rgba(0,0,0,0.5)",
            color: "#a0a0a8",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}
        >
          {item.type === "course" ? "Course" : "Workshop"}
        </div>

        {/* Text + progress at bottom */}
        <div className="relative" style={{ zIndex: 1, padding: "0 10px 10px" }}>
          {contextTitle && (
            <div
              className="truncate"
              style={{ color: "#a0a0b0", fontSize: 9, fontWeight: 600, marginBottom: 2, letterSpacing: "0.3px" }}
            >
              {contextTitle}
            </div>
          )}
          <div
            className="line-clamp-2"
            style={{
              color: "white",
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.3,
              marginBottom: 8,
            }}
          >
            {item.episodeTitle}
          </div>
          {/* Progress bar */}
          <div style={{ height: 3, background: "rgba(255,255,255,0.15)", borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                width: `${isCompleted ? 100 : progressPct}%`,
                height: "100%",
                borderRadius: 3,
                background: isCompleted ? "#22c55e" : "var(--color-accent)",
              }}
            />
          </div>
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
  isNewMember = false,
}: {
  courses: any[];
  enrolledMap: Map<string, any>;
  allowedModules: string[];
  isLoading: boolean;
  uiStrings: any;
  isNewMember?: boolean;
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
          if (isNewMember && !course.hasAccess && !enrolledMap.has(course.id)) {
            lockReason = "join_program";
          } else if (allowedModules.length > 0 && course.module && !allowedModules.includes(course.module)) {
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

  const { uiStrings, config } = useSiteConfig();
  const coursesBannerUrl = (config as any)?.coursesBannerUrl?.trim() || null;

  const { data: enrollments } = useMyEnrollments();
  const { data: watchHistoryData } = useWatchHistory({ limit: 3 });

  const { data: catalogData, isLoading: catalogLoading, isError: catalogError, refetch: refetchCatalog } = useCourses({
    limit: 100,
  });
  const allCourses: any[]    = catalogData?.data ?? [];
  const meta: any            = (catalogData as any)?.meta ?? {};
  const personalizationState: "new" | "program" | "direct" = meta.personalizationState ?? "new";
  const allowedModules: string[]     = meta.allowedModules ?? [];
  const programName: string | null   = meta.programName ?? null;
  const moduleConfigs: ModuleConfig[] = meta.moduleConfigs ?? [];
  const memberBusinessType: string | null = meta.memberBusinessType ?? null;

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

  // Dynamic page title: when a member sees exactly one course in their module,
  // use that course's actual title as the hero heading instead of the generic
  // module display name (e.g. "Product Mastery"). This surfaces the real course
  // name ("90-Day Product Business Program") for the member's business category.
  const primaryCourseTitle = useMemo(() => {
    if (allowedModules.length !== 1) return null;
    const accessible = filteredCourses.filter(c => c.hasAccess || enrolledMap.has(c.id));
    if (accessible.length >= 1) return accessible[0].title as string;
    if (filteredCourses.length >= 1) return filteredCourses[0].title as string;
    return null;
  }, [allowedModules, filteredCourses, enrolledMap]);

  // Primary course ID for section-card breakdown (single-module program view only)
  const primaryCourseId = useMemo(() => {
    if (allowedModules.length !== 1 || filteredCourses.length === 0) return null;
    const accessible = filteredCourses.filter((c: any) => c.hasAccess || enrolledMap.has(c.id));
    return (accessible.length >= 1 ? accessible[0].id : filteredCourses[0].id) as string;
  }, [allowedModules, filteredCourses, enrolledMap]);

  const shouldFetchSections = personalizationState === "program" && allowedModules.length === 1 && !!primaryCourseId;
  const { data: primaryCourseDetail, isLoading: courseDetailLoading } = useCourse(
    shouldFetchSections ? (primaryCourseId ?? "") : ""
  );

  const sectionCards = useMemo((): SectionCardData[] | null => {
    if (!primaryCourseDetail) return null;
    const lessons: any[] = (primaryCourseDetail as any).lessons ?? [];
    const sections: Array<{ id: string; title: string; sortOrder: number }> = (primaryCourseDetail as any).sections ?? [];
    if (sections.length === 0) return null;
    const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted.map(sec => {
      const secLessons = lessons.filter((l: any) => l.sectionId === sec.id);
      const completed = secLessons.filter((l: any) => l.isCompleted).length;
      return {
        id: sec.id,
        title: sec.title,
        sortOrder: sec.sortOrder,
        totalEpisodes: secLessons.length,
        completedEpisodes: completed,
        firstLessonId: secLessons[0]?.id ?? null,
        isLocked: secLessons[0]?.locked ?? false,
        thumbnail: secLessons.find((l: any) => l.thumbnailUrl)?.thumbnailUrl ?? null,
      };
    });
  }, [primaryCourseDetail]);

  // Learning Roadmap course: the most recently watched enrolled course that isn't
  // finished, else the latest unfinished enrollment. None → no roadmap.
  const roadmapCourseId: string | null = useMemo(() => {
    const unfinished = (id?: string | null) => !!id && !!enrolledMap.get(id) && !enrolledMap.get(id).completedAt;
    const watched = savedVideos.find((v: any) => v?.type === "course" && unfinished(v.courseId));
    if (watched) return watched.courseId;
    const latest = myEnrollments
      .filter((e: any) => !e.completedAt)
      .sort((a: any, b: any) => String(b.enrolledAt ?? "").localeCompare(String(a.enrolledAt ?? "")))[0];
    return latest?.courseId ?? null;
  }, [savedVideos, myEnrollments, enrolledMap]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-8">

      {/* ── Page banner (admin-configured) ──────────────────────────── */}
      {coursesBannerUrl && (
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: `url(${JSON.stringify(coursesBannerUrl)}) center / cover no-repeat`,
            minHeight: 120,
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.45) 100%)" }}
          />
        </div>
      )}

      {roadmapCourseId && <CoursesPageRoadmap courseId={roadmapCourseId} />}

      {/* ── Mentorship Dashboard ─────────────────────────────────────── */}
      <MentorshipDashboard titleOverride={primaryCourseTitle} />

      {/* ── Catalog failed to load — never fall back to the "new member" view ── */}
      {catalogError && !catalogLoading && (
        <div className="rounded-2xl p-6 flex items-center justify-between gap-4" style={{ background: "#1a1a1e", border: "1px solid #2a2a2e" }}>
          <span style={{ fontSize: 14, color: "#a0a0a8" }}>
            {uiStrings?.mentorshipModulesLoadError ?? "We couldn't load your mentorship modules."}
          </span>
          <button
            onClick={() => refetchCatalog()}
            style={{ padding: "8px 20px", borderRadius: 9, background: "var(--color-accent)", color: "white", fontSize: 13, fontWeight: 600 }}
          >
            {uiStrings?.mentorshipModulesRetry ?? "Retry"}
          </button>
        </div>
      )}

      {/* ── New Member State — CTA banner (always visible for new members) ── */}
      {personalizationState === "new" && !catalogLoading && !catalogError && (
        <NewMemberCoursesView uiStrings={uiStrings} />
      )}

      {/* ── Single-Module Dedicated View (CP-16) ─────────────────────── */}
      {personalizationState === "program" && allowedModules.length === 1 && (
        <section>
          <ModuleHero
            cfg={singleModuleCfg ?? { moduleName: allowedModules[0], displayName: allowedModules[0], tagline: null, description: null, bannerUrl: null, iconUrl: null, accentColor: null, sortOrder: 0 }}
            programName={programName}
            courseCount={sectionCards ? sectionCards.length : filteredCourses.length}
            memberBusinessType={memberBusinessType}
            primaryCourseTitle={primaryCourseTitle}
          />
          <ModuleProgressBar courses={filteredCourses} enrolledMap={enrolledMap} />
          {sectionCards && sectionCards.length > 0 ? (
            <>
              <SectionGrid
                sections={sectionCards}
                courseId={primaryCourseId!}
                courseThumbnail={(primaryCourseDetail as any)?.thumbnailUrl ?? null}
                isLoading={courseDetailLoading && !primaryCourseDetail}
                uiStrings={uiStrings}
              />
              {filteredCourses.length > 1 && (
                <div className="mt-8">
                  <div className="mb-4" style={{ color: "#92929b", fontSize: 13, fontWeight: 600 }}>Additional Courses</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredCourses.slice(1).map((course: any) => {
                      const enrollment = enrolledMap.get(course.id);
                      const lockReason: LockReason = (!course.hasAccess && !enrollment) ? (course.price > 0 ? "purchase_required" : "not_enrolled") : null;
                      return <ModuleCard key={course.id} course={course} enrollment={enrollment} index={filteredCourses.indexOf(course)} lockReason={lockReason} />;
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <CourseGrid
              courses={filteredCourses}
              enrolledMap={enrolledMap}
              allowedModules={[]}
              isLoading={catalogLoading || (courseDetailLoading && !primaryCourseDetail)}
              uiStrings={uiStrings}
            />
          )}
        </section>
      )}

      {/* ── Multi-Module Program View ─────────────────────────────────── */}
      {personalizationState === "program" && allowedModules.length > 1 && (
        <section>
          <div className="mb-6 flex items-end justify-between gap-3 flex-wrap" data-testid="modules-heading-row">
          {programName ? (
            <div className="min-w-0">
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
          ) : (
            <span />
          )}
            <ModulesFaqButton />
          </div>

          {/* Business type filter badge */}
          {memberBusinessType && (
            <div className="flex items-center gap-2 mb-4">
              <span style={{ fontSize: 12, color: "#92929b" }}>Filtered for:</span>
              <span style={{ padding: "2px 10px", borderRadius: 999, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "var(--color-accent)", fontSize: 12, fontWeight: 600 }}>
                {memberBusinessType}
              </span>
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

          {/* Dynamic course title for the active module tab */}
          {(() => {
            const accessible = filteredCourses.filter(c => c.hasAccess || enrolledMap.has(c.id));
            const tabCourseTitle = accessible.length >= 1 ? accessible[0].title
              : filteredCourses.length >= 1 ? filteredCourses[0].title
              : null;
            if (!tabCourseTitle) return null;
            return (
              <div className="mb-4 flex items-center gap-3">
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#f5f5f7" }}>
                  {tabCourseTitle as string}
                </h3>
                {activeTab && (
                  <span style={{ padding: "2px 10px", borderRadius: 999, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)", color: "var(--color-accent)", fontSize: 11, fontWeight: 600 }}>
                    {availableModules.find(m => m.name === activeTab)?.displayName ?? activeTab}
                  </span>
                )}
              </div>
            );
          })()}

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
      {(personalizationState === "direct" || personalizationState === "new") && (allCourses.length > 0 || catalogLoading) && (
        <section>
          {personalizationState === "direct" && (
            <div className="mb-5 flex items-center justify-between flex-wrap gap-3" data-testid="modules-heading-row">
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, color: "#f5f5f7" }}>
                {uiStrings?.coursesCatalogTitle ?? "Modules"}
              </h2>
              <div className="flex items-center gap-3 flex-wrap ml-auto">
                {memberBusinessType && (
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 12, color: "#92929b" }}>Filtered for:</span>
                    <span style={{ padding: "2px 10px", borderRadius: 999, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", color: "var(--color-accent)", fontSize: 12, fontWeight: 600 }}>
                      {memberBusinessType}
                    </span>
                  </div>
                )}
                <ModulesFaqButton />
              </div>
            </div>
          )}

          <CourseGrid
            courses={allCourses}
            enrolledMap={enrolledMap}
            allowedModules={[]}
            isLoading={catalogLoading}
            uiStrings={uiStrings}
            isNewMember={personalizationState === "new"}
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

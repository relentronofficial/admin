"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Lock, ChevronDown, ChevronUp, CheckCircle2,
  BookOpen, Clock, Zap, Award, ArrowRight, Users,
  ShoppingCart, Loader2, Star, ExternalLink, ChevronRight,
} from "lucide-react";
import { useCourse, useCreateRazorpayOrder, useVerifyRazorpayPayment } from "@/lib/hooks/useCourses";
import { useMe } from "@/lib/hooks/useUser";
import { toast } from "react-hot-toast";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtHours(h: number | null | undefined): string {
  if (!h) return "";
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

function fmtDurationSecs(s: number | null | undefined): string {
  if (!s || s <= 0) return "";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function isRazorpayEnabled(course: any): boolean {
  if (typeof course?.razorpayEnabled === "boolean") return course.razorpayEnabled;
  return Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
}

function levelLabel(level: string | null | undefined): string {
  if (!level) return "";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

// ── Marquee ──────────────────────────────────────────────────────────────────

const MARQUEE_ITEMS = [
  "LEARN THE SKILL",
  "✦",
  "BUILD YOUR PORTFOLIO",
  "✦",
  "GROW YOUR BUSINESS",
  "✦",
  "START IMMEDIATELY",
  "✦",
  "LEARN AT YOUR OWN PACE",
  "✦",
];

function MarqueeStrip() {
  const repeated = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div
      className="overflow-hidden py-4 select-none"
      style={{
        background: "var(--color-accent)",
        borderTop: "1px solid color-mix(in srgb, var(--color-accent) 70%, white)",
        borderBottom: "1px solid color-mix(in srgb, var(--color-accent) 70%, black)",
      }}
    >
      <motion.div
        className="flex gap-6 whitespace-nowrap"
        animate={{ x: [0, "-33.33%"] }}
        transition={{ duration: 20, ease: "linear", repeat: Infinity }}
      >
        {repeated.map((item, i) => (
          <span
            key={i}
            className="text-xs font-bold tracking-widest uppercase text-white"
          >
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ── Curriculum ───────────────────────────────────────────────────────────────

function LessonRow({ lesson, idx }: { lesson: any; idx: number }) {
  return (
    <div
      className="flex items-center gap-3 py-2.5 px-4"
      style={{ borderBottom: "1px solid var(--color-surface-overlay-xs)" }}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
        style={{
          background: lesson.isCompleted
            ? "color-mix(in srgb, var(--color-success, #22c55e) 20%, transparent)"
            : "var(--color-surface-overlay)",
          color: lesson.isCompleted ? "var(--color-success, #22c55e)" : "var(--color-text-subtle)",
        }}
      >
        {lesson.isCompleted ? <CheckCircle2 size={12} /> : idx + 1}
      </span>
      <span
        className="flex-1 text-sm leading-snug"
        style={{ color: lesson.locked ? "var(--color-text-subtle)" : "var(--color-text-normal)" }}
      >
        {lesson.title}
      </span>
      <span className="shrink-0 flex items-center gap-1.5">
        {lesson.locked && <Lock size={12} style={{ color: "var(--color-text-subtle)" }} />}
        {lesson.durationSeconds > 0 && (
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {fmtDurationSecs(lesson.durationSeconds)}
          </span>
        )}
        {lesson.hasQuiz && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)" }}
          >
            Quiz
          </span>
        )}
      </span>
    </div>
  );
}

function SectionItem({ section, lessons }: { section: any; lessons: any[] }) {
  const [open, setOpen] = useState(false);
  const totalSecs = lessons.reduce((a: number, l: any) => a + (l.durationSeconds || 0), 0);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-surface-overlay)" }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
        style={{ background: open ? "var(--color-surface-overlay-xs)" : "var(--color-bg-surface)" }}
      >
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm" style={{ color: "var(--color-text-normal)" }}>
            {section.title}
          </span>
          {section.description && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--color-text-subtle)" }}>
              {section.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
            {totalSecs > 0 && ` · ${fmtDurationSecs(totalSecs)}`}
          </span>
          {open ? (
            <ChevronUp size={16} style={{ color: "var(--color-text-subtle)" }} />
          ) : (
            <ChevronDown size={16} style={{ color: "var(--color-text-subtle)" }} />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden", background: "var(--color-bg-surface)" }}
          >
            {lessons.map((l: any, i: number) => (
              <LessonRow key={l.id} lesson={l} idx={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CurriculumSection({ course }: { course: any }) {
  const lessons: any[] = course.lessons ?? [];
  const sections: any[] = course.sections ?? [];
  const [showAll, setShowAll] = useState(false);

  const sectionGroups: Array<{ section: any; lessons: any[] }> = [];
  if (sections.length > 0) {
    sections
      .slice()
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
      .forEach((sec: any) => {
        const sl = lessons
          .filter((l: any) => l.sectionId === sec.id)
          .sort((a: any, b: any) => a.order - b.order);
        if (sl.length > 0) sectionGroups.push({ section: sec, lessons: sl });
      });
    const unsectioned = lessons.filter((l: any) => !l.sectionId).sort((a: any, b: any) => a.order - b.order);
    if (unsectioned.length > 0) {
      sectionGroups.push({ section: { id: "__general", title: "General" }, lessons: unsectioned });
    }
  }

  const totalSecs = lessons.reduce((a: number, l: any) => a + (l.durationSeconds || 0), 0);
  const PREVIEW_GROUPS = 3;
  const displayed = showAll ? sectionGroups : sectionGroups.slice(0, PREVIEW_GROUPS);

  if (lessons.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="py-14"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--color-text-normal)" }}>
            What&apos;s Inside
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
            {totalSecs > 0 && ` · ${fmtDurationSecs(totalSecs)} total`}
            {sections.length > 0 && ` · ${sections.length} section${sections.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {sectionGroups.length > 0 ? (
          <div className="space-y-3">
            {displayed.map(({ section, lessons: sl }) => (
              <SectionItem key={section.id} section={section} lessons={sl} />
            ))}
            {sectionGroups.length > PREVIEW_GROUPS && (
              <button
                onClick={() => setShowAll(o => !o)}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                style={{
                  background: "var(--color-surface-overlay)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-surface-overlay-md)",
                }}
              >
                {showAll ? (
                  <><ChevronUp size={15} /> Show Less</>
                ) : (
                  <><ChevronDown size={15} /> Show {sectionGroups.length - PREVIEW_GROUPS} More Sections</>
                )}
              </button>
            )}
          </div>
        ) : (
          // No sections — flat lesson list
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--color-surface-overlay)" }}
          >
            {(showAll ? lessons : lessons.slice(0, 6)).map((l: any, i: number) => (
              <LessonRow key={l.id} lesson={l} idx={i} />
            ))}
            {lessons.length > 6 && (
              <button
                onClick={() => setShowAll(o => !o)}
                className="w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                style={{
                  background: "var(--color-surface-overlay-xs)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {showAll ? (
                  <><ChevronUp size={15} /> Show Less</>
                ) : (
                  <><ChevronDown size={15} /> +{lessons.length - 6} More Lessons</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.section>
  );
}

// ── Buy Button (shared) ───────────────────────────────────────────────────────

function BuyButton({
  course,
  courseId,
  buying,
  onBuy,
  size = "md",
}: {
  course: any;
  courseId: string;
  buying: boolean;
  onBuy: () => void;
  size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  const hasAccess = course.hasAccess;
  const hasPrice = course.price != null && Number(course.price) > 0;
  const razorpayOn = isRazorpayEnabled(course);

  const px = size === "lg" ? "px-10 py-4 text-base" : size === "sm" ? "px-5 py-2.5 text-sm" : "px-7 py-3.5 text-sm";

  if (hasAccess) {
    return (
      <button
        onClick={() => router.push(`/learning/${courseId}`)}
        className={`${px} rounded-xl font-bold flex items-center gap-2 transition-all hover:opacity-90`}
        style={{ background: "var(--color-success, #22c55e)", color: "#fff" }}
      >
        <Play size={16} fill="currentColor" /> Continue Learning
      </button>
    );
  }

  if (hasPrice && razorpayOn && !course.pendingPayment) {
    return (
      <button
        onClick={onBuy}
        disabled={buying}
        className={`${px} rounded-xl font-bold flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-60`}
        style={{
          background: "var(--color-accent)",
          color: "#fff",
          boxShadow: "0 4px 20px color-mix(in srgb, var(--color-accent) 40%, transparent)",
        }}
      >
        {buying ? (
          <><Loader2 size={16} className="animate-spin" /> Processing…</>
        ) : (
          <><ShoppingCart size={16} /> Buy Now · ₹{Number(course.price).toLocaleString("en-IN")}</>
        )}
      </button>
    );
  }

  if (course.paymentLinkUrl) {
    return (
      <a
        href={course.paymentLinkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${px} rounded-xl font-bold flex items-center gap-2 transition-all hover:opacity-90`}
        style={{ background: "var(--color-accent)", color: "#fff" }}
      >
        <ExternalLink size={15} /> Buy Now
      </a>
    );
  }

  return (
    <button
      onClick={() => router.push(`/learning/${courseId}`)}
      className={`${px} rounded-xl font-bold flex items-center gap-2 transition-all hover:opacity-90`}
      style={{
        background: "transparent",
        border: "2px solid var(--color-accent)",
        color: "var(--color-accent)",
      }}
    >
      <ArrowRight size={15} /> View Course
    </button>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroSection({ course, courseId, buying, onBuy }: { course: any; courseId: string; buying: boolean; onBuy: () => void }) {
  const lessons: any[] = course.lessons ?? [];
  const totalSecs = lessons.reduce((a: number, l: any) => a + (l.durationSeconds || 0), 0);
  const hasPrice = course.price != null && Number(course.price) > 0;

  return (
    <section
      className="relative overflow-hidden pt-10 pb-16"
      style={{
        background: "var(--color-bg-surface)",
        borderBottom: "1px solid var(--color-surface-overlay)",
      }}
    >
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in srgb, var(--color-accent) 8%, transparent), transparent)",
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
          {/* Left col: info */}
          <div className="lg:col-span-3 space-y-5">
            {/* Breadcrumb */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2 text-xs"
              style={{ color: "var(--color-text-subtle)" }}
            >
              <span
                className="cursor-pointer hover:underline"
                onClick={() => window.history.back()}
              >
                Courses
              </span>
              <ChevronRight size={12} />
              <span className="line-clamp-1" style={{ color: "var(--color-text-secondary)" }}>
                {course.title}
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="text-3xl sm:text-4xl font-extrabold leading-tight"
              style={{ color: "var(--color-text-normal)" }}
            >
              {course.title}
            </motion.h1>

            {/* Description */}
            {course.description && (
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-base leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {course.description}
              </motion.p>
            )}

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="flex flex-wrap gap-3"
            >
              {lessons.length > 0 && (
                <StatBadge icon={<BookOpen size={13} />} label={`${lessons.length} lessons`} />
              )}
              {totalSecs > 0 && (
                <StatBadge icon={<Clock size={13} />} label={fmtDurationSecs(totalSecs)} />
              )}
              {course.level && (
                <StatBadge icon={<Award size={13} />} label={levelLabel(course.level)} />
              )}
              {course.xpPerEpisode > 0 && (
                <StatBadge icon={<Zap size={13} />} label={`${course.xpPerEpisode} XP / lesson`} />
              )}
              {course._count?.enrollments > 0 && (
                <StatBadge icon={<Users size={13} />} label={`${course._count.enrollments} enrolled`} />
              )}
            </motion.div>

            {/* Instructor */}
            {course.instructor && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex items-center gap-3"
              >
                {course.instructor.profilePhotoUrl ? (
                  <img
                    src={course.instructor.profilePhotoUrl}
                    alt={course.instructor.fullName}
                    className="w-9 h-9 rounded-full object-cover"
                    style={{ border: "2px solid var(--color-surface-overlay)" }}
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-secondary)" }}
                  >
                    {course.instructor.fullName?.charAt(0) ?? "?"}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text-normal)" }}>
                    {course.instructor.fullName}
                  </p>
                  {course.instructor.designation && (
                    <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                      {course.instructor.designation}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Mobile CTA */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="flex items-center gap-4 lg:hidden"
            >
              <BuyButton course={course} courseId={courseId} buying={buying} onBuy={onBuy} size="lg" />
              {hasPrice && !course.hasAccess && (
                <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  One-time payment
                </span>
              )}
            </motion.div>
          </div>

          {/* Right col: thumbnail + price card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2 space-y-4"
          >
            {/* Thumbnail */}
            <div
              className="relative rounded-2xl overflow-hidden aspect-video"
              style={{ border: "1px solid var(--color-surface-overlay)" }}
            >
              {course.thumbnailUrl ? (
                <img
                  src={course.thumbnailUrl}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "var(--color-surface-overlay)" }}
                >
                  <BookOpen size={48} style={{ color: "var(--color-text-subtle)" }} />
                </div>
              )}
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.3)" }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
                >
                  <Play size={24} className="text-white" fill="white" />
                </div>
              </div>
            </div>

            {/* Price card (desktop) */}
            <div
              className="hidden lg:block rounded-2xl p-5 space-y-4"
              style={{
                background: "var(--color-modal-bg, var(--color-bg-surface))",
                border: "1px solid var(--color-surface-overlay-md)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              <PriceDisplay course={course} />
              <BuyButton course={course} courseId={courseId} buying={buying} onBuy={onBuy} size="lg" />
              <p className="text-xs text-center" style={{ color: "var(--color-text-subtle)" }}>
                {course.hasAccess
                  ? "You have full access to this course"
                  : course.accessDurationDays
                  ? `Access valid for ${course.accessDurationDays} days after purchase`
                  : "Lifetime access after purchase"}
              </p>
              <div
                className="pt-3 space-y-2"
                style={{ borderTop: "1px solid var(--color-surface-overlay)" }}
              >
                {[
                  lessons.length > 0 && `${lessons.length} lessons`,
                  totalSecs > 0 && `${fmtDurationSecs(totalSecs)} of content`,
                  course.level && `${levelLabel(course.level)} level`,
                  "Learn at your own pace",
                ]
                  .filter(Boolean)
                  .map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      <CheckCircle2 size={12} style={{ color: "var(--color-accent)" }} />
                      {item}
                    </div>
                  ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StatBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        background: "var(--color-surface-overlay)",
        color: "var(--color-text-secondary)",
        border: "1px solid var(--color-surface-overlay-xs)",
      }}
    >
      {icon}
      {label}
    </div>
  );
}

function PriceDisplay({ course }: { course: any }) {
  const hasPrice = course.price != null && Number(course.price) > 0;
  if (!hasPrice) {
    return (
      <div>
        <span className="text-2xl font-extrabold" style={{ color: "var(--color-success, #22c55e)" }}>
          Free
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-3xl font-extrabold" style={{ color: "var(--color-text-normal)" }}>
        ₹{Number(course.price).toLocaleString("en-IN")}
      </span>
      <span
        className="text-xs font-semibold px-2 py-1 rounded-full"
        style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)" }}
      >
        One-time
      </span>
    </div>
  );
}

// ── Pricing Section ───────────────────────────────────────────────────────────

function PricingSection({ course, courseId, buying, onBuy }: { course: any; courseId: string; buying: boolean; onBuy: () => void }) {
  const lessons: any[] = course.lessons ?? [];
  const totalSecs = lessons.reduce((a: number, l: any) => a + (l.durationSeconds || 0), 0);
  const hasPrice = course.price != null && Number(course.price) > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="py-14"
      style={{ background: "var(--color-bg-surface)" }}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--color-text-normal)" }}>
          {course.hasAccess ? "You Have Access" : "Get Started Today"}
        </h2>
        <p className="text-sm mb-8" style={{ color: "var(--color-text-secondary)" }}>
          {course.hasAccess
            ? "Jump back into your learning journey."
            : "One-time payment. Learn at your own pace."}
        </p>

        <div
          className="relative rounded-2xl p-8 text-left space-y-5 mx-auto max-w-sm"
          style={{
            background: "var(--color-modal-bg, var(--color-bg-primary))",
            border: "1px solid var(--color-surface-overlay-md)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
          }}
        >
          {/* Badge */}
          {hasPrice && !course.hasAccess && (
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              {course.courseType === "mini_course" ? "Mini Course" : "Full Access"}
            </div>
          )}

          <div>
            <h3 className="font-bold text-lg mb-1" style={{ color: "var(--color-text-normal)" }}>
              {course.title}
            </h3>
            {course.description && (
              <p className="text-xs line-clamp-2" style={{ color: "var(--color-text-subtle)" }}>
                {course.description}
              </p>
            )}
          </div>

          <PriceDisplay course={course} />

          <div className="space-y-2.5">
            {[
              lessons.length > 0 && `${lessons.length} lesson${lessons.length !== 1 ? "s" : ""}`,
              totalSecs > 0 && `${fmtDurationSecs(totalSecs)} of content`,
              course.level && `${levelLabel(course.level)} level`,
              course.accessDurationDays
                ? `${course.accessDurationDays}-day access`
                : "Lifetime access",
              course.xpPerEpisode > 0 && `${course.xpPerEpisode} XP per lesson`,
              "Learn at your own pace",
              "Start immediately",
            ]
              .filter(Boolean)
              .map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  <CheckCircle2 size={14} style={{ color: "var(--color-accent)" }} className="shrink-0" />
                  {item}
                </div>
              ))}
          </div>

          <BuyButton course={course} courseId={courseId} buying={buying} onBuy={onBuy} size="lg" />

          <p className="text-xs text-center" style={{ color: "var(--color-text-subtle)" }}>
            {course.hasAccess ? "You have full access" : "Secure payment · Instant access"}
          </p>
        </div>
      </div>
    </motion.section>
  );
}

// ── Related Courses ───────────────────────────────────────────────────────────

function RelatedCourses({ courses }: { courses: any[] }) {
  const router = useRouter();
  if (!courses || courses.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="py-14"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--color-text-normal)" }}>
          You Might Also Like
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.slice(0, 3).map((c: any) => (
            <div
              key={c.id}
              className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02]"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-surface-overlay)",
              }}
              onClick={() => router.push(`/courses/${c.id}`)}
            >
              <div className="aspect-video bg-black/20 relative">
                {c.thumbnailUrl ? (
                  <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen size={28} style={{ color: "var(--color-text-subtle)" }} />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm line-clamp-2 mb-1" style={{ color: "var(--color-text-normal)" }}>
                  {c.title}
                </h3>
                {c.price > 0 ? (
                  <span className="text-sm font-bold" style={{ color: "var(--color-accent)" }}>
                    ₹{Number(c.price).toLocaleString("en-IN")}
                  </span>
                ) : (
                  <span className="text-sm font-bold" style={{ color: "var(--color-success, #22c55e)" }}>
                    Free
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

// ── Sticky Buy Bar ────────────────────────────────────────────────────────────

function StickyBuyBar({ course, courseId, buying, onBuy }: { course: any; courseId: string; buying: boolean; onBuy: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
          style={{
            background: "var(--color-modal-bg, var(--color-bg-surface))",
            borderTop: "1px solid var(--color-surface-overlay-md)",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.3)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text-normal)" }}>
                {course.title}
              </p>
              {course.price > 0 && !course.hasAccess && (
                <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  ₹{Number(course.price).toLocaleString("en-IN")} · One-time
                </p>
              )}
            </div>
            <BuyButton course={course} courseId={courseId} buying={buying} onBuy={onBuy} size="sm" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CoursePurchasePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const { data: course, isLoading } = useCourse(courseId);
  const { data: meData } = useMe();
  const createOrder = useCreateRazorpayOrder();
  const verifyPayment = useVerifyRazorpayPayment();
  const [buying, setBuying] = useState(false);

  // Pre-load Razorpay script
  useEffect(() => {
    if (!course?.price || Number((course as any).price) <= 0) return;
    if (document.getElementById("rzp-checkout-js")) return;
    const s = document.createElement("script");
    s.id = "rzp-checkout-js";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.body.appendChild(s);
  }, [(course as any)?.price]);

  const handleBuy = async () => {
    if (!(window as any).Razorpay) {
      toast.error("Payment system loading, please try again in a moment.");
      return;
    }
    setBuying(true);
    try {
      const orderRes = await createOrder.mutateAsync(courseId);
      const { orderId, amount, currency, keyId, paymentRecordId } = orderRes.data as any;

      const options: any = {
        key: keyId,
        amount,
        currency,
        order_id: orderId,
        name: "Tamil Business Tribe",
        description: (course as any)?.title ?? "Course Purchase",
        image: (course as any)?.thumbnailUrl ?? undefined,
        handler: async (response: any) => {
          setBuying(false);
          try {
            await verifyPayment.mutateAsync({
              courseId,
              razorpayOrderId: orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              paymentRecordId,
            });
            const paidAmount = `₹${(amount / 100).toLocaleString("en-IN")}`;
            toast.success(
              `Payment of ${paidAmount} successful! Check your WhatsApp for confirmation. Ref: ${response.razorpay_payment_id}`,
              { duration: 8000 }
            );
            router.push(`/learning/${courseId}`);
          } catch {
            toast.error(
              `Payment received but verification failed. Keep your payment ID ${response.razorpay_payment_id} and contact support.`,
              { duration: 10000 }
            );
            setBuying(false);
          }
        },
        prefill: {
          name: (meData as any)?.name ?? "",
          contact: (meData as any)?.phone ?? "",
        },
        theme: { color: "#dc2626" },
        modal: {
          ondismiss: () => setBuying(false),
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        setBuying(false);
        const reason =
          resp?.error?.description ??
          resp?.error?.reason ??
          "Payment failed. Please try a different card or contact your bank.";
        toast.error(reason, { duration: 6000 });
      });
      rzp.open();
    } catch (e: any) {
      setBuying(false);
      toast.error(e.message || "Could not initiate payment. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--color-bg-primary)" }}
      >
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-accent)" }} />
      </div>
    );
  }

  if (!course) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "var(--color-bg-primary)" }}
      >
        <BookOpen size={40} style={{ color: "var(--color-text-subtle)" }} />
        <p style={{ color: "var(--color-text-secondary)" }}>Course not found.</p>
        <button
          onClick={() => router.push("/courses")}
          className="text-sm font-semibold"
          style={{ color: "var(--color-accent)" }}
        >
          ← Back to Courses
        </button>
      </div>
    );
  }

  const c = course as any;
  const relatedCourses = [...(c.upsellCourses ?? []), ...(c.crossSellCourses ?? [])].filter(
    (x: any, i: number, arr: any[]) => arr.findIndex((y: any) => y.id === x.id) === i
  );

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <HeroSection course={c} courseId={courseId} buying={buying} onBuy={handleBuy} />
      <MarqueeStrip />
      <CurriculumSection course={c} />
      <PricingSection course={c} courseId={courseId} buying={buying} onBuy={handleBuy} />
      {relatedCourses.length > 0 && <RelatedCourses courses={relatedCourses} />}
      <StickyBuyBar course={c} courseId={courseId} buying={buying} onBuy={handleBuy} />

      {/* Bottom padding so the sticky bar doesn't cover content on mobile */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}

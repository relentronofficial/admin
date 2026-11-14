"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Lock, ChevronDown, ChevronUp, CheckCircle2,
  BookOpen, Clock, Zap, Award, ArrowRight, Users,
  ShoppingCart, Loader2, ChevronRight,
  Target, TrendingUp, Layers, Star, Flame, Badge,
} from "lucide-react";
import {
  useCourse, useCreateRazorpayOrder, useVerifyRazorpayPayment,
  useCreateBundleOrder, useVerifyBundlePayment,
  useCreateAllAccessOrder, useVerifyAllAccessPayment,
} from "@/lib/hooks/useCourses";
import { useMe } from "@/lib/hooks/useUser";
import { toast } from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDurationSecs(s: number): string {
  if (!s || s <= 0) return "";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function fmtHours(h: number | null | undefined): string {
  if (!h || h <= 0) return "";
  if (h < 1) return `${Math.round(h * 60)}m`;
  const whole = Math.floor(h);
  const frac = h - whole;
  return frac > 0.1 ? `${h.toFixed(1)}h` : `${whole}h`;
}

function isRazorpayEnabled(course: any): boolean {
  if (typeof course?.razorpayEnabled === "boolean") return course.razorpayEnabled;
  return Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
}

function levelLabel(l: string | null | undefined) {
  if (!l) return "";
  return l.charAt(0).toUpperCase() + l.slice(1);
}

function padNum(n: number) {
  return String(n).padStart(2, "0");
}

// ── Shared Buy Button ─────────────────────────────────────────────────────────

function BuyButton({
  course, courseId, buying, onBuy, size = "md",
}: {
  course: any; courseId: string; buying: boolean; onBuy: () => void; size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  const hasPrice = course.price != null && Number(course.price) > 0;
  const razorpayOn = isRazorpayEnabled(course);

  const cls =
    size === "lg"
      ? "px-10 py-4 text-base rounded-2xl"
      : size === "sm"
      ? "px-5 py-2.5 text-sm rounded-xl"
      : "px-7 py-3.5 text-sm rounded-xl";

  if (course.hasAccess) {
    return (
      <button
        onClick={() => router.push(`/learning/${courseId}`)}
        className={`${cls} font-bold flex items-center gap-2 transition-opacity hover:opacity-90`}
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
        className={`${cls} font-bold flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60`}
        style={{
          background: "var(--color-accent)",
          color: "#fff",
          boxShadow: "0 4px 24px color-mix(in srgb, var(--color-accent) 40%, transparent)",
        }}
      >
        {buying ? (
          <><Loader2 size={15} className="animate-spin" /> Processing…</>
        ) : (
          <><ShoppingCart size={15} /> Buy Now · ₹{Number(course.price).toLocaleString("en-IN")}</>
        )}
      </button>
    );
  }
  return (
    <button
      onClick={() => router.push(`/learning/${courseId}`)}
      className={`${cls} font-bold flex items-center gap-2 transition-opacity hover:opacity-90`}
      style={{ border: "2px solid var(--color-accent)", color: "var(--color-accent)", background: "transparent" }}
    >
      <ArrowRight size={15} /> View Course
    </button>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroSection({ course, courseId, buying, onBuy }: {
  course: any; courseId: string; buying: boolean; onBuy: () => void;
}) {
  const lessons: any[] = course.lessons ?? [];
  const totalSecs = lessons.reduce((a: number, l: any) => a + (l.durationSeconds || 0), 0);
  const hasPrice = course.price != null && Number(course.price) > 0;
  const price = hasPrice ? Number(course.price) : 0;
  const originalPrice = course.originalPrice != null ? Number(course.originalPrice) : null;
  const discountPct = originalPrice && originalPrice > price && price > 0
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : null;

  return (
    <section
      className="relative pt-10 pb-0 overflow-hidden"
      style={{ background: "var(--color-bg-surface)" }}
    >
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 30% 0%, color-mix(in srgb, var(--color-accent) 8%, transparent), transparent)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-2 text-xs mb-8"
          style={{ color: "var(--color-text-subtle)" }}
        >
          <span className="cursor-pointer hover:underline" onClick={() => window.history.back()}>
            Courses
          </span>
          <ChevronRight size={11} />
          <span className="truncate max-w-[200px]" style={{ color: "var(--color-text-secondary)" }}>{course.title}</span>
        </motion.div>

        {/* Two-column split */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-16 pb-0">

          {/* ── LEFT: Text Content ───────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="flex items-center gap-2 flex-wrap mb-5"
            >
              {course.courseType === "mini_course" && (
                <span
                  className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{
                    background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                    color: "var(--color-accent)",
                    border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                  }}
                >
                  Mini Course
                </span>
              )}
              {discountPct && (
                <span
                  className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{ background: "var(--color-accent)", color: "#fff" }}
                >
                  {discountPct}% OFF
                </span>
              )}
              <span
                className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{
                  background: "var(--color-surface-overlay)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-surface-overlay-xs)",
                }}
              >
                Self-Paced
              </span>
              {course.level && (
                <span
                  className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{
                    background: "var(--color-surface-overlay)",
                    color: "var(--color-text-secondary)",
                    border: "1px solid var(--color-surface-overlay-xs)",
                  }}
                >
                  {levelLabel(course.level)}
                </span>
              )}
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight mb-4"
              style={{ color: "var(--color-text-normal)" }}
            >
              {course.title}
            </motion.h1>

            {/* Description */}
            {course.description && (
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.14 }}
                className="text-base leading-relaxed mb-6 max-w-xl"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {course.description}
              </motion.p>
            )}

            {/* Price row */}
            {hasPrice && !course.hasAccess && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.18 }}
                className="flex items-baseline gap-3 mb-6"
              >
                <span
                  className="text-4xl font-black"
                  style={{ color: "var(--color-text-normal)" }}
                >
                  ₹{price.toLocaleString("en-IN")}
                </span>
                {originalPrice && originalPrice > price && (
                  <span
                    className="text-xl font-semibold line-through"
                    style={{ color: "var(--color-text-subtle)" }}
                  >
                    ₹{originalPrice.toLocaleString("en-IN")}
                  </span>
                )}
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: "color-mix(in srgb, var(--color-success, #22c55e) 12%, transparent)",
                    color: "var(--color-success, #22c55e)",
                    border: "1px solid color-mix(in srgb, var(--color-success, #22c55e) 25%, transparent)",
                  }}
                >
                  One-time
                </span>
              </motion.div>
            )}

            {/* CTA row */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.22 }}
              className="flex items-center gap-4 flex-wrap mb-6"
            >
              <BuyButton course={course} courseId={courseId} buying={buying} onBuy={onBuy} size="lg" />
              <a
                href="#curriculum"
                className="text-sm font-semibold flex items-center gap-1.5 transition-colors hover:opacity-80"
                style={{ color: "var(--color-text-secondary)" }}
              >
                See curriculum <ChevronDown size={14} />
              </a>
            </motion.div>

            {/* Enrollment count */}
            {(course._count?.enrollments ?? 0) > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.28 }}
                className="flex items-center gap-2 mb-6"
              >
                <div className="flex -space-x-1.5">
                  {[0,1,2].map(i => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-bold"
                      style={{
                        background: `hsl(${i * 40 + 10}, 60%, 55%)`,
                        borderColor: "var(--color-bg-surface)",
                        color: "#fff",
                      }}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  <span className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                    {course._count.enrollments.toLocaleString("en-IN")}
                  </span>{" "}
                  already enrolled
                </span>
              </motion.div>
            )}

            {/* Instructor */}
            {course.instructor && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="flex items-center gap-3"
              >
                {course.instructor.profilePhotoUrl ? (
                  <img
                    src={course.instructor.profilePhotoUrl}
                    alt={course.instructor.fullName}
                    className="w-9 h-9 rounded-full object-cover shrink-0"
                    style={{ border: "2px solid var(--color-surface-overlay-md)" }}
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
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
          </div>

          {/* ── RIGHT: Thumbnail ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 24, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="lg:w-[46%] lg:shrink-0 relative"
          >
            {/* Glow behind thumbnail */}
            <div
              className="pointer-events-none absolute -inset-6 rounded-3xl"
              style={{
                background: "radial-gradient(ellipse 80% 60% at 50% 50%, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent)",
                filter: "blur(24px)",
              }}
            />
            <div
              className="relative rounded-2xl overflow-hidden aspect-video"
              style={{
                border: "1px solid var(--color-surface-overlay-md)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3)",
              }}
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
                  <BookOpen size={64} style={{ color: "var(--color-text-subtle)" }} />
                </div>
              )}
              {/* Gradient overlay at bottom */}
              <div
                className="absolute inset-x-0 bottom-0 h-24"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}
              />
              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(255,255,255,0.35)" }}
                  onClick={() => { const el = document.getElementById("video-preview"); el?.scrollIntoView({ behavior: "smooth" }); }}
                >
                  <Play size={26} className="text-white ml-1" fill="white" />
                </motion.div>
              </div>
              {/* Discount badge on thumbnail */}
              {discountPct && (
                <div
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-black text-white"
                  style={{ background: "var(--color-accent)", boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
                >
                  {discountPct}% OFF
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* 4-col Details Strip */}
      <DetailsStrip course={course} lessons={[...(course.lessons ?? [])]} totalSecs={totalSecs} />
    </section>
  );
}

function DetailsStrip({ course, lessons, totalSecs }: { course: any; lessons: any[]; totalSecs: number }) {
  const items = [
    { label: "Learning Method", value: "Self-Paced" },
    { label: "Start", value: "Immediately" },
    {
      label: "Duration",
      value: totalSecs > 0
        ? fmtDurationSecs(totalSecs)
        : course.durationHours
        ? fmtHours(course.durationHours)
        : `${lessons.length} Lessons`,
    },
    { label: "Platform", value: "TBT Portal" },
  ];

  return (
    <div
      className="border-t"
      style={{
        background: "var(--color-bg-primary)",
        borderColor: "var(--color-surface-overlay-md)",
      }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x"
          style={{ borderColor: "var(--color-surface-overlay)" }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="px-6 py-5 text-center"
              style={{
                borderColor: "var(--color-surface-overlay)",
                borderRightWidth: i < 3 ? "1px" : "0",
                borderRightStyle: "solid",
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-widest mb-1"
                style={{ color: "var(--color-text-subtle)" }}
              >
                {item.label}
              </p>
              <p className="text-base font-bold" style={{ color: "var(--color-text-normal)" }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Marquee ───────────────────────────────────────────────────────────────────

function MarqueeStrip({ course }: { course?: any }) {
  const title = course?.title ? course.title.toUpperCase() : null;
  const module = course?.module ? course.module.toUpperCase() : null;
  const items = title
    ? [
        title, "✦", "LEARN THE SKILL", "✦",
        module ?? "BUILD YOUR BUSINESS", "✦", "START TODAY", "✦",
        "GROW FASTER", "✦", "SELF-PACED LEARNING", "✦",
      ]
    : [
        "LEARN THE SKILL", "✦", "BUILD YOUR PORTFOLIO", "✦",
        "SELL YOUR SERVICE", "✦", "START IMMEDIATELY", "✦",
        "GROW YOUR BUSINESS", "✦", "LEARN AT YOUR OWN PACE", "✦",
      ];
  const repeated = [...items, ...items, ...items];

  return (
    <div
      className="overflow-hidden py-4 select-none"
      style={{
        background: "var(--color-accent)",
        borderTop: "1px solid color-mix(in srgb, var(--color-accent) 70%, white 30%)",
        borderBottom: "1px solid color-mix(in srgb, var(--color-accent) 60%, black 40%)",
      }}
    >
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: [0, "-33.33%"] }}
        transition={{ duration: 22, ease: "linear", repeat: Infinity }}
      >
        {repeated.map((item, i) => (
          <span key={i} className="text-xs font-black tracking-[0.2em] uppercase text-white">
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ── Social Proof ─────────────────────────────────────────────────────────────

function SocialProofSection({ course }: { course: any }) {
  const count = course._count?.enrollments ?? 0;
  if (count === 0) return null;
  const lessons: any[] = course.lessons ?? [];
  const totalSecs = lessons.reduce((a: number, l: any) => a + (l.durationSeconds || 0), 0);

  const stats = [
    { icon: <Users size={18} />, value: `${count.toLocaleString("en-IN")}+`, label: "Students Enrolled" },
    { icon: <BookOpen size={18} />, value: `${lessons.length}`, label: "Lessons" },
    totalSecs > 0 && { icon: <Clock size={18} />, value: fmtDurationSecs(totalSecs), label: "Total Duration" },
    { icon: <Award size={18} />, value: "Certificate", label: "On Completion" },
  ].filter(Boolean) as { icon: React.ReactNode; value: string; label: string }[];

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="py-14"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="flex flex-col items-center text-center p-5 rounded-2xl"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-surface-overlay)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                  color: "var(--color-accent)",
                }}
              >
                {s.icon}
              </div>
              <p className="text-2xl font-black mb-0.5" style={{ color: "var(--color-text-normal)" }}>
                {s.value}
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                {s.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

// ── Curriculum ───────────────────────────────────────────────────────────────

function ModuleCard({
  num, title, description, lessons, defaultOpen,
}: {
  num: number; title: string; description?: string; lessons: any[]; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const totalSecs = lessons.reduce((a: number, l: any) => a + (l.durationSeconds || 0), 0);
  const completedCount = lessons.filter((l: any) => l.isCompleted).length;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-surface-overlay)",
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-4 p-5 text-left transition-colors"
        style={{ background: open ? "var(--color-surface-overlay-xs)" : "transparent" }}
      >
        {/* Number */}
        <span
          className="shrink-0 text-3xl font-black leading-none mt-0.5"
          style={{ color: "color-mix(in srgb, var(--color-accent) 25%, var(--color-text-subtle))" }}
        >
          {padNum(num)}
        </span>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-snug" style={{ color: "var(--color-text-normal)" }}>
            {title}
          </p>
          {description && (
            <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--color-text-subtle)" }}>
              {description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
              {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
              {totalSecs > 0 && ` · ${fmtDurationSecs(totalSecs)}`}
            </span>
            {completedCount > 0 && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--color-success, #22c55e) 12%, transparent)",
                  color: "var(--color-success, #22c55e)",
                }}
              >
                {completedCount}/{lessons.length} done
              </span>
            )}
          </div>
        </div>

        <span className="shrink-0 mt-1" style={{ color: "var(--color-text-subtle)" }}>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: "1px solid var(--color-surface-overlay)" }}>
              {lessons.map((l: any, i: number) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 px-5 py-3"
                  style={{
                    borderBottom: i < lessons.length - 1 ? "1px solid var(--color-surface-overlay-xs)" : "none",
                    background: "var(--color-bg-surface)",
                  }}
                >
                  <span
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: l.isCompleted
                        ? "color-mix(in srgb, var(--color-success, #22c55e) 20%, transparent)"
                        : "var(--color-surface-overlay)",
                      color: l.isCompleted ? "var(--color-success, #22c55e)" : "var(--color-text-subtle)",
                    }}
                  >
                    {l.isCompleted ? <CheckCircle2 size={11} /> : i + 1}
                  </span>
                  <span
                    className="flex-1 text-sm"
                    style={{ color: l.locked ? "var(--color-text-subtle)" : "var(--color-text-secondary)" }}
                  >
                    {l.title}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.locked && <Lock size={11} style={{ color: "var(--color-text-subtle)" }} />}
                    {l.durationSeconds > 0 && (
                      <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                        {fmtDurationSecs(l.durationSeconds)}
                      </span>
                    )}
                    {l.hasQuiz && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                          color: "var(--color-accent)",
                        }}
                      >
                        Quiz
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CurriculumSection({ course }: { course: any }) {
  const lessons: any[] = course.lessons ?? [];
  const sections: any[] = (course.sections ?? []).slice().sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  const [showAll, setShowAll] = useState(false);

  const groups: Array<{ title: string; description?: string; lessons: any[] }> = [];

  if (sections.length > 0) {
    sections.forEach((sec: any) => {
      const sl = lessons.filter((l: any) => l.sectionId === sec.id).sort((a: any, b: any) => a.order - b.order);
      if (sl.length > 0) groups.push({ title: sec.title, description: sec.description, lessons: sl });
    });
    const unsectioned = lessons.filter((l: any) => !l.sectionId).sort((a: any, b: any) => a.order - b.order);
    if (unsectioned.length > 0) groups.push({ title: "General", lessons: unsectioned });
  } else {
    // Treat each lesson as its own card
    lessons.slice().sort((a: any, b: any) => a.order - b.order).forEach((l: any) => {
      groups.push({ title: l.title, lessons: [l] });
    });
  }

  if (groups.length === 0) return null;

  const PREVIEW = 6;
  const displayed = showAll ? groups : groups.slice(0, PREVIEW);

  return (
    <motion.section
      id="curriculum"
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="py-20"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2
            className="text-3xl sm:text-4xl font-extrabold mb-3"
            style={{ color: "var(--color-text-normal)" }}
          >
            Everything You Need to{" "}
            <span style={{ color: "var(--color-accent)" }}>Start Earning</span>
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-subtle)" }}>
            {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
            {groups.length > 1 && ` · ${groups.length} modules`}
          </p>
        </div>

        {/* 2-column grid of module cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayed.map((g, i) => (
            <ModuleCard
              key={i}
              num={i + 1}
              title={g.title}
              description={g.description}
              lessons={g.lessons}
              defaultOpen={i === 0}
            />
          ))}
        </div>

        {groups.length > PREVIEW && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setShowAll(o => !o)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
              style={{
                background: "var(--color-surface-overlay)",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-surface-overlay-md)",
              }}
            >
              {showAll ? (
                <><ChevronUp size={15} /> Show Less</>
              ) : (
                <><ChevronDown size={15} /> Show {groups.length - PREVIEW} More Modules</>
              )}
            </button>
          </div>
        )}
      </div>
    </motion.section>
  );
}

// ── Video Preview ─────────────────────────────────────────────────────────────

function VideoPreviewSection({ videoUrl }: { videoUrl: string }) {
  const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");
  const isVimeo = videoUrl.includes("vimeo.com");

  let embedUrl = videoUrl;
  if (isYouTube) {
    const match = videoUrl.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (match) embedUrl = `https://www.youtube.com/embed/${match[1]}?rel=0`;
  } else if (isVimeo) {
    const match = videoUrl.match(/vimeo\.com\/(\d+)/);
    if (match) embedUrl = `https://player.vimeo.com/video/${match[1]}`;
  }

  const isEmbed = isYouTube || isVimeo;

  return (
    <motion.section
      id="video-preview"
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="py-16"
      style={{ background: "var(--color-bg-surface)" }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: "var(--color-text-normal)" }}>
            Preview the Course
          </h2>
        </div>
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            boxShadow: "0 8px 48px rgba(0,0,0,0.5)",
            border: "1px solid var(--color-surface-overlay)",
          }}
        >
          {isEmbed ? (
            <div className="aspect-video">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Course Preview"
              />
            </div>
          ) : (
            <div className="aspect-video">
              <video src={videoUrl} controls className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

// ── Key Highlights ────────────────────────────────────────────────────────────

function KeyHighlightsSection({ highlights }: { highlights: string[] }) {
  if (!highlights.length) return null;
  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="py-16"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: "var(--color-text-normal)" }}>
            What You&apos;ll <span style={{ color: "var(--color-accent)" }}>Walk Away With</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {highlights.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-surface-overlay)",
              }}
            >
              <div
                className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                  color: "var(--color-accent)",
                }}
              >
                <CheckCircle2 size={14} />
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {item}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

// ── Related Courses ───────────────────────────────────────────────────────────

function RelatedCourses({ courses }: { courses: any[] }) {
  const router = useRouter();
  if (!courses.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="py-20"
      style={{ background: "var(--color-bg-surface)" }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold" style={{ color: "var(--color-text-normal)" }}>
            Skills That Work Even Better Together.
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.slice(0, 3).map((c: any) => (
            <div
              key={c.id}
              className="rounded-2xl overflow-hidden cursor-pointer group transition-transform hover:scale-[1.02]"
              style={{ border: "1px solid var(--color-surface-overlay)", background: "var(--color-bg-primary)" }}
              onClick={() => router.push(`/courses/${c.id}`)}
            >
              <div className="aspect-video relative">
                {c.thumbnailUrl ? (
                  <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: "var(--color-surface-overlay)" }}
                  >
                    <BookOpen size={28} style={{ color: "var(--color-text-subtle)" }} />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-sm line-clamp-2 mb-2" style={{ color: "var(--color-text-normal)" }}>
                  {c.title}
                </h3>
                {c.description && (
                  <p className="text-xs line-clamp-2 mb-3" style={{ color: "var(--color-text-subtle)" }}>
                    {c.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  {c.price > 0 ? (
                    <span className="text-sm font-black" style={{ color: "var(--color-accent)" }}>
                      ₹{Number(c.price).toLocaleString("en-IN")}
                    </span>
                  ) : (
                    <span className="text-sm font-black" style={{ color: "var(--color-success, #22c55e)" }}>
                      Free
                    </span>
                  )}
                  <span
                    className="text-xs font-semibold flex items-center gap-1 transition-colors"
                    style={{ color: "var(--color-accent)" }}
                  >
                    View Course <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────

function PricingSection({
  course, courseId, buying, onBuy,
  buyingBundle, onBuyBundle,
  buyingAllAccess, onBuyAllAccess,
}: {
  course: any; courseId: string; buying: boolean; onBuy: () => void;
  buyingBundle: boolean; onBuyBundle: () => void;
  buyingAllAccess: boolean; onBuyAllAccess: () => void;
}) {
  const router = useRouter();
  const lessons: any[] = course.lessons ?? [];
  const totalSecs = lessons.reduce((a: number, l: any) => a + (l.durationSeconds || 0), 0);
  const hasPrice = course.price != null && Number(course.price) > 0;
  const hasBundlePrice = course.bundlePrice != null && Number(course.bundlePrice) > 0;
  const hasAllAccessPrice = course.allAccessPrice != null && Number(course.allAccessPrice) > 0;
  const isMultiTier = hasBundlePrice || hasAllAccessPrice;

  const basePerkItems = [
    lessons.length > 0 && `${lessons.length} lesson${lessons.length !== 1 ? "s" : ""}`,
    totalSecs > 0 && `${fmtDurationSecs(totalSecs)} of content`,
    course.level && `${levelLabel(course.level)} level`,
    course.accessDurationDays ? `${course.accessDurationDays}-day access` : "Lifetime access",
    course.xpPerEpisode > 0 && `${course.xpPerEpisode} XP per lesson`,
    "Start immediately",
    "Learn at your own pace",
  ].filter(Boolean) as string[];

  const headline = course.purchaseHeadline || "Choose Your Learning Plan";

  if (!isMultiTier) {
    // Single card centered (original layout)
    const perks = [
      hasPrice && `₹${Number(course.price).toLocaleString("en-IN")} one-time payment`,
      ...basePerkItems,
    ].filter(Boolean) as string[];

    return (
      <motion.section
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="py-20"
        style={{ background: "var(--color-bg-primary)" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: "var(--color-text-normal)" }}>
              {headline}
            </h2>
          </div>
          <div className="max-w-sm mx-auto">
            <div
              className="relative rounded-3xl p-8"
              style={{
                background: "var(--color-bg-surface)",
                border: "2px solid var(--color-accent)",
                boxShadow: "0 0 48px color-mix(in srgb, var(--color-accent) 15%, transparent), 0 24px 64px rgba(0,0,0,0.4)",
              }}
            >
              <div
                className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-xs font-black text-white uppercase tracking-widest"
                style={{ background: "var(--color-accent)" }}
              >
                {course.hasAccess ? "✓ Enrolled" : course.courseType === "mini_course" ? "Mini Course" : "Full Access"}
              </div>
              <div className="mt-2 mb-6">
                <h3 className="text-xl font-extrabold mb-1" style={{ color: "var(--color-text-normal)" }}>
                  {course.title}
                </h3>
                {course.description && (
                  <p className="text-xs line-clamp-2" style={{ color: "var(--color-text-subtle)" }}>
                    {course.description}
                  </p>
                )}
              </div>
              {hasPrice && !course.hasAccess ? (
                <div className="mb-6">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <div className="text-4xl font-black" style={{ color: "var(--color-text-normal)" }}>
                      ₹{Number(course.price).toLocaleString("en-IN")}
                    </div>
                    {course.originalPrice != null && Number(course.originalPrice) > Number(course.price) && (
                      <span className="text-lg font-semibold line-through" style={{ color: "var(--color-text-subtle)" }}>
                        ₹{Number(course.originalPrice).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-subtle)" }}>One-time · Instant access</p>
                </div>
              ) : course.hasAccess ? (
                <div className="mb-6">
                  <div className="text-2xl font-black" style={{ color: "var(--color-success, #22c55e)" }}>
                    You&apos;re Enrolled
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <div className="text-3xl font-black" style={{ color: "var(--color-success, #22c55e)" }}>
                    Free Access
                  </div>
                </div>
              )}
              <div className="space-y-2.5 mb-7">
                {perks.map((p, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    <CheckCircle2 size={14} style={{ color: "var(--color-accent)" }} className="shrink-0" />
                    {p}
                  </div>
                ))}
              </div>
              <BuyButton course={course} courseId={courseId} buying={buying} onBuy={onBuy} size="lg" />
            </div>
          </div>
        </div>
      </motion.section>
    );
  }

  // 3-tier layout
  const bundleCourses: any[] = course.bundleCourses ?? [];

  const origPrice = course.originalPrice != null ? Number(course.originalPrice) : null;
  const discountPct2 = origPrice && origPrice > Number(course.price ?? 0) && Number(course.price ?? 0) > 0
    ? Math.round(((origPrice - Number(course.price)) / origPrice) * 100)
    : null;

  const tiers = [
    {
      key: "single",
      label: "Single Course",
      badge: course.hasAccess ? "✓ Enrolled" : discountPct2 ? `${discountPct2}% OFF` : "Get Started",
      price: hasPrice ? `₹${Number(course.price).toLocaleString("en-IN")}` : "Free",
      originalPrice: origPrice && origPrice > Number(course.price ?? 0) ? `₹${origPrice.toLocaleString("en-IN")}` : null,
      priceNote: hasPrice ? "One-time · Instant access" : "No payment needed",
      perks: [`This course only`, ...basePerkItems],
      cta: course.hasAccess
        ? { label: "Continue Learning", action: () => router.push(`/learning/${courseId}`), loading: false, style: "success" }
        : { label: buying ? "Processing…" : hasPrice ? `Buy ₹${Number(course.price).toLocaleString("en-IN")}` : "Enroll Free", action: onBuy, loading: buying, style: "accent" },
      featured: false,
    },
    ...(hasBundlePrice ? [{
      key: "bundle",
      label: "Curated Bundle",
      badge: "Best Value",
      price: `₹${Number(course.bundlePrice).toLocaleString("en-IN")}`,
      originalPrice: null as string | null,
      priceNote: "One-time · All bundled courses",
      perks: [
        `${bundleCourses.length + 1} courses included`,
        ...basePerkItems,
        "Bundle discount applied",
      ],
      bundleCourses,
      cta: { label: buyingBundle ? "Processing…" : `Buy Bundle ₹${Number(course.bundlePrice).toLocaleString("en-IN")}`, action: onBuyBundle, loading: buyingBundle, style: "accent" },
      featured: true,
    }] : []),
    ...(hasAllAccessPrice ? [{
      key: "all_access",
      label: "All-Access",
      badge: "Maximum Value",
      price: `₹${Number(course.allAccessPrice).toLocaleString("en-IN")}`,
      originalPrice: null as string | null,
      priceNote: "One-time · Every mini course",
      perks: [
        "All published mini courses",
        "Future courses included",
        ...basePerkItems,
        "Best value for serious learners",
      ],
      cta: { label: buyingAllAccess ? "Processing…" : `Get All Access ₹${Number(course.allAccessPrice).toLocaleString("en-IN")}`, action: onBuyAllAccess, loading: buyingAllAccess, style: "gradient" },
      featured: false,
    }] : []),
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="py-20"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-3" style={{ color: "var(--color-text-normal)" }}>
            {headline}
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-subtle)" }}>
            Pick the plan that matches your learning ambition
          </p>
        </div>

        <div className={`grid gap-6 ${tiers.length === 3 ? "grid-cols-1 md:grid-cols-3" : tiers.length === 2 ? "grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto" : "grid-cols-1 max-w-sm mx-auto"}`}>
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="relative flex flex-col rounded-3xl p-7"
              style={{
                background: "var(--color-bg-surface)",
                border: tier.featured
                  ? "2px solid var(--color-accent)"
                  : "1px solid var(--color-surface-overlay)",
                boxShadow: tier.featured
                  ? "0 0 48px color-mix(in srgb, var(--color-accent) 15%, transparent), 0 24px 64px rgba(0,0,0,0.4)"
                  : "none",
              }}
            >
              {/* Badge */}
              <div
                className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap"
                style={{
                  background: tier.featured ? "var(--color-accent)" : "var(--color-surface-overlay-md)",
                  color: tier.featured ? "#fff" : "var(--color-text-secondary)",
                }}
              >
                {tier.badge}
              </div>

              {/* Plan name */}
              <div className="mt-3 mb-4">
                <h3 className="text-lg font-extrabold mb-1" style={{ color: "var(--color-text-normal)" }}>
                  {tier.label}
                </h3>
              </div>

              {/* Price */}
              <div className="mb-5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div
                    className="text-3xl font-black"
                    style={{ color: tier.featured ? "var(--color-accent)" : "var(--color-text-normal)" }}
                  >
                    {tier.price}
                  </div>
                  {(tier as any).originalPrice && (
                    <span className="text-sm font-semibold line-through" style={{ color: "var(--color-text-subtle)" }}>
                      {(tier as any).originalPrice}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle)" }}>{tier.priceNote}</p>
              </div>

              {/* Bundle course names */}
              {tier.bundleCourses && tier.bundleCourses.length > 0 && (
                <div className="mb-4 p-3 rounded-xl" style={{ background: "var(--color-surface-overlay-xs)" }}>
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--color-text-subtle)" }}>
                    Includes
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      <CheckCircle2 size={12} style={{ color: "var(--color-accent)" }} className="shrink-0" />
                      <span className="font-semibold">{course.title}</span>
                      <span style={{ color: "var(--color-text-subtle)" }}>(this course)</span>
                    </div>
                    {tier.bundleCourses.map((bc: any) => (
                      <div key={bc.id} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                        <CheckCircle2 size={12} style={{ color: "var(--color-accent)" }} className="shrink-0" />
                        {bc.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Perks */}
              <div className="space-y-2 mb-6 flex-1">
                {tier.perks.map((p, j) => (
                  <div key={j} className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    <CheckCircle2 size={13} style={{ color: "var(--color-accent)" }} className="shrink-0" />
                    {p}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={tier.cta.action}
                disabled={tier.cta.loading}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                style={
                  tier.cta.style === "success"
                    ? { background: "var(--color-success, #22c55e)", color: "#fff" }
                    : tier.cta.style === "gradient"
                    ? {
                        background: "linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, #7c3aed))",
                        color: "#fff",
                        boxShadow: "0 4px 20px color-mix(in srgb, var(--color-accent) 35%, transparent)",
                      }
                    : {
                        background: tier.featured ? "var(--color-accent)" : "transparent",
                        color: tier.featured ? "#fff" : "var(--color-accent)",
                        border: tier.featured ? "none" : "2px solid var(--color-accent)",
                        boxShadow: tier.featured
                          ? "0 4px 20px color-mix(in srgb, var(--color-accent) 35%, transparent)"
                          : "none",
                      }
                }
              >
                {tier.cta.loading && <Loader2 size={14} className="animate-spin" />}
                {tier.cta.label}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

// ── Journey Section ───────────────────────────────────────────────────────────

const JOURNEY_STEPS = [
  {
    num: "01",
    title: "Learn",
    desc: "Follow structured lessons designed to build your skills from the ground up.",
    icon: <BookOpen size={24} />,
  },
  {
    num: "02",
    title: "Practice",
    desc: "Apply what you've learned through quizzes and real-world exercises.",
    icon: <Target size={24} />,
  },
  {
    num: "03",
    title: "Apply",
    desc: "Use your new skills in your business or freelance projects immediately.",
    icon: <Layers size={24} />,
  },
  {
    num: "04",
    title: "Grow",
    desc: "Scale your results and unlock new opportunities with your expertise.",
    icon: <TrendingUp size={24} />,
  },
];

function JourneySection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="py-20"
      style={{ background: "var(--color-bg-surface)" }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-3" style={{ color: "var(--color-text-normal)" }}>
            Don&apos;t Just Learn the Skill.
            <br />
            <span style={{ color: "var(--color-accent)" }}>Learn How to Earn From It.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {JOURNEY_STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="relative rounded-2xl p-6"
              style={{
                background: "var(--color-bg-primary)",
                border: "1px solid var(--color-surface-overlay)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                  color: "var(--color-accent)",
                }}
              >
                {step.icon}
              </div>
              <div
                className="text-5xl font-black mb-2 leading-none"
                style={{ color: "color-mix(in srgb, var(--color-accent) 20%, var(--color-surface-overlay-md))" }}
              >
                {step.num}
              </div>
              <h3 className="text-lg font-extrabold mb-2" style={{ color: "var(--color-text-normal)" }}>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-subtle)" }}>
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

// ── Core Principle / Quote ────────────────────────────────────────────────────

function QuoteSection({ course, courseId, buying, onBuy }: {
  course: any; courseId: string; buying: boolean; onBuy: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="py-24"
      style={{
        background: "var(--color-bg-primary)",
        borderTop: "1px solid var(--color-surface-overlay)",
        borderBottom: "1px solid var(--color-surface-overlay)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div
          className="text-5xl font-black mb-8 leading-none"
          style={{ color: "color-mix(in srgb, var(--color-accent) 20%, var(--color-surface-overlay-md))" }}
        >
          &ldquo;
        </div>
        <blockquote
          className="text-2xl sm:text-3xl font-bold leading-snug mb-8"
          style={{ color: "var(--color-text-normal)" }}
        >
          You don&apos;t need to know everything before you start.
          <br />
          <span style={{ color: "var(--color-accent)" }}>
            Take the first step — the rest will follow.
          </span>
        </blockquote>
        <p
          className="text-xs font-bold uppercase tracking-widest mb-10"
          style={{ color: "var(--color-text-subtle)" }}
        >
          TBT Core Principle
        </p>
        <BuyButton course={course} courseId={courseId} buying={buying} onBuy={onBuy} size="lg" />
      </div>
    </motion.section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--color-surface-overlay)" }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors"
        style={{ background: open ? "var(--color-surface-overlay-xs)" : "var(--color-bg-surface)" }}
      >
        <span className="font-semibold text-sm" style={{ color: "var(--color-text-normal)" }}>
          {q}
        </span>
        {open
          ? <ChevronUp size={16} style={{ color: "var(--color-text-subtle)" }} className="shrink-0" />
          : <ChevronDown size={16} style={{ color: "var(--color-text-subtle)" }} className="shrink-0" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <p
              className="px-5 py-4 text-sm leading-relaxed"
              style={{
                color: "var(--color-text-secondary)",
                borderTop: "1px solid var(--color-surface-overlay)",
                background: "var(--color-bg-surface)",
              }}
            >
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FAQSection({ course }: { course: any }) {
  const faqs = [
    {
      q: "Who is this course for?",
      a: "This course is designed for anyone looking to build practical skills and apply them in their business or freelance career. Whether you're a beginner or looking to sharpen existing knowledge, you'll find value here.",
    },
    {
      q: `How long do I have access to ${course.title}?`,
      a: course.accessDurationDays
        ? `You will have access for ${course.accessDurationDays} days from the date of purchase.`
        : "You have lifetime access to this course. Learn at your own pace, revisit lessons anytime.",
    },
    {
      q: "What payment methods are accepted?",
      a: "We accept all major credit/debit cards, UPI, net banking, and wallets through our secure Razorpay payment gateway.",
    },
    {
      q: "Will I receive a certificate?",
      a: "Yes! Upon completing the course you can download your TBT completion certificate to showcase on LinkedIn and your portfolio.",
    },
    {
      q: "What if I have questions while learning?",
      a: "You can reach our support team anytime through the platform. For mentorship-level support, explore our TBT membership plans.",
    },
    {
      q: "Is there a refund policy?",
      a: "Please contact our support team within 7 days of purchase if you are unsatisfied. Refunds are assessed on a case-by-case basis.",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="py-20"
      style={{ background: "var(--color-bg-surface)" }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold mb-2" style={{ color: "var(--color-text-normal)" }}>
            Frequently Asked Questions
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-subtle)" }}>
            Everything you need to know before you enroll.
          </p>
        </div>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <FAQItem key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

// ── Final CTA Strip ───────────────────────────────────────────────────────────

function FinalCTAStrip({ course, courseId, buying, onBuy }: {
  course: any; courseId: string; buying: boolean; onBuy: () => void;
}) {
  const hasPrice = course.price != null && Number(course.price) > 0;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="py-20"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2
          className="text-3xl sm:text-4xl font-extrabold mb-4 leading-tight"
          style={{ color: "var(--color-text-normal)" }}
        >
          Ready to Get Started?
        </h2>
        <p className="text-base mb-8" style={{ color: "var(--color-text-secondary)" }}>
          {hasPrice && !course.hasAccess
            ? `Join for ₹${Number(course.price).toLocaleString("en-IN")} and start learning immediately.`
            : course.hasAccess
            ? "Jump back into your learning journey."
            : "Start learning for free today."}
        </p>
        <BuyButton course={course} courseId={courseId} buying={buying} onBuy={onBuy} size="lg" />
      </div>
    </motion.section>
  );
}

// ── Sticky Mobile Bar ─────────────────────────────────────────────────────────

function StickyBuyBar({ course, courseId, buying, onBuy }: {
  course: any; courseId: string; buying: boolean; onBuy: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="fixed bottom-0 inset-x-0 z-50 lg:hidden"
          style={{
            background: "var(--color-modal-bg, var(--color-bg-surface))",
            borderTop: "1px solid var(--color-surface-overlay-md)",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text-normal)" }}>
                {course.title}
              </p>
              {Number(course.price ?? 0) > 0 && !course.hasAccess && (
                <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--color-text-subtle)" }}>
                  <span className="font-semibold" style={{ color: "var(--color-text-normal)" }}>
                    ₹{Number(course.price).toLocaleString("en-IN")}
                  </span>
                  {course.originalPrice != null && Number(course.originalPrice) > Number(course.price) && (
                    <span className="line-through">₹{Number(course.originalPrice).toLocaleString("en-IN")}</span>
                  )}
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
  const createBundleOrder = useCreateBundleOrder();
  const verifyBundlePayment = useVerifyBundlePayment();
  const createAllAccessOrder = useCreateAllAccessOrder();
  const verifyAllAccessPayment = useVerifyAllAccessPayment();
  const [buying, setBuying] = useState(false);
  const [buyingBundle, setBuyingBundle] = useState(false);
  const [buyingAllAccess, setBuyingAllAccess] = useState(false);

  useEffect(() => {
    if (!course) return;
    const c = course as any;
    const needsRazorpay =
      (c.price && Number(c.price) > 0) ||
      (c.bundlePrice && Number(c.bundlePrice) > 0) ||
      (c.allAccessPrice && Number(c.allAccessPrice) > 0);
    if (!needsRazorpay) return;
    if (document.getElementById("rzp-checkout-js")) return;
    const s = document.createElement("script");
    s.id = "rzp-checkout-js";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.body.appendChild(s);
  }, [course]);

  const handleBuy = async () => {
    if (!(window as any).Razorpay) {
      toast.error("Payment system loading, please try again in a moment.");
      return;
    }
    setBuying(true);
    try {
      const orderRes = await createOrder.mutateAsync(courseId);
      const { orderId, amount, currency, keyId, paymentRecordId } = orderRes.data as any;
      const c = course as any;
      const options: any = {
        key: keyId, amount, currency, order_id: orderId,
        name: "Tamil Business Tribe",
        description: c?.title ?? "Course Purchase",
        image: c?.thumbnailUrl ?? undefined,
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
            const paid = `₹${(amount / 100).toLocaleString("en-IN")}`;
            toast.success(
              `Payment of ${paid} successful! Check your WhatsApp for confirmation. Ref: ${response.razorpay_payment_id}`,
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
        prefill: { name: (meData as any)?.name ?? "", contact: (meData as any)?.phone ?? "" },
        theme: { color: "#dc2626" },
        modal: { ondismiss: () => setBuying(false) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        setBuying(false);
        toast.error(
          resp?.error?.description ?? resp?.error?.reason ?? "Payment failed. Please try again.",
          { duration: 6000 }
        );
      });
      rzp.open();
    } catch (e: any) {
      setBuying(false);
      toast.error(e.message || "Could not initiate payment. Please try again.");
    }
  };

  const handleBundleBuy = async () => {
    if (!(window as any).Razorpay) {
      toast.error("Payment system loading, please try again in a moment.");
      return;
    }
    setBuyingBundle(true);
    try {
      const orderRes = await createBundleOrder.mutateAsync(courseId);
      const { orderId, amount, currency, keyId, paymentRecordId } = orderRes.data as any;
      const c = course as any;
      const options: any = {
        key: keyId, amount, currency, order_id: orderId,
        name: "Tamil Business Tribe",
        description: "Curated Bundle",
        image: c?.thumbnailUrl ?? undefined,
        handler: async (response: any) => {
          setBuyingBundle(false);
          try {
            await verifyBundlePayment.mutateAsync({
              courseId,
              razorpayOrderId: orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              paymentRecordId,
            });
            const paid = `₹${(amount / 100).toLocaleString("en-IN")}`;
            toast.success(
              `Bundle payment of ${paid} successful! Ref: ${response.razorpay_payment_id}`,
              { duration: 8000 }
            );
            router.push(`/learning/${courseId}`);
          } catch {
            toast.error(
              `Payment received but verification failed. Keep ID ${response.razorpay_payment_id} and contact support.`,
              { duration: 10000 }
            );
            setBuyingBundle(false);
          }
        },
        prefill: { name: (meData as any)?.name ?? "", contact: (meData as any)?.phone ?? "" },
        theme: { color: "#dc2626" },
        modal: { ondismiss: () => setBuyingBundle(false) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        setBuyingBundle(false);
        toast.error(
          resp?.error?.description ?? resp?.error?.reason ?? "Payment failed. Please try again.",
          { duration: 6000 }
        );
      });
      rzp.open();
    } catch (e: any) {
      setBuyingBundle(false);
      toast.error(e.message || "Could not initiate payment. Please try again.");
    }
  };

  const handleAllAccessBuy = async () => {
    if (!(window as any).Razorpay) {
      toast.error("Payment system loading, please try again in a moment.");
      return;
    }
    setBuyingAllAccess(true);
    try {
      const orderRes = await createAllAccessOrder.mutateAsync(courseId);
      const { orderId, amount, currency, keyId, paymentRecordId } = orderRes.data as any;
      const c = course as any;
      const options: any = {
        key: keyId, amount, currency, order_id: orderId,
        name: "Tamil Business Tribe",
        description: "All-Access Package",
        image: c?.thumbnailUrl ?? undefined,
        handler: async (response: any) => {
          setBuyingAllAccess(false);
          try {
            await verifyAllAccessPayment.mutateAsync({
              courseId,
              razorpayOrderId: orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              paymentRecordId,
            });
            const paid = `₹${(amount / 100).toLocaleString("en-IN")}`;
            toast.success(
              `All-Access payment of ${paid} successful! Ref: ${response.razorpay_payment_id}`,
              { duration: 8000 }
            );
            router.push(`/learning/${courseId}`);
          } catch {
            toast.error(
              `Payment received but verification failed. Keep ID ${response.razorpay_payment_id} and contact support.`,
              { duration: 10000 }
            );
            setBuyingAllAccess(false);
          }
        },
        prefill: { name: (meData as any)?.name ?? "", contact: (meData as any)?.phone ?? "" },
        theme: { color: "#dc2626" },
        modal: { ondismiss: () => setBuyingAllAccess(false) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        setBuyingAllAccess(false);
        toast.error(
          resp?.error?.description ?? resp?.error?.reason ?? "Payment failed. Please try again.",
          { duration: 6000 }
        );
      });
      rzp.open();
    } catch (e: any) {
      setBuyingAllAccess(false);
      toast.error(e.message || "Could not initiate payment. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg-primary)" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-accent)" }} />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--color-bg-primary)" }}>
        <BookOpen size={40} style={{ color: "var(--color-text-subtle)" }} />
        <p style={{ color: "var(--color-text-secondary)" }}>Course not found.</p>
        <button onClick={() => router.push("/courses")} className="text-sm font-semibold" style={{ color: "var(--color-accent)" }}>
          ← Back to Courses
        </button>
      </div>
    );
  }

  const c = course as any;
  const related = [...(c.upsellCourses ?? []), ...(c.crossSellCourses ?? [])].filter(
    (x: any, i: number, arr: any[]) => arr.findIndex((y: any) => y.id === x.id) === i
  );

  const highlights: string[] = Array.isArray(c.keyHighlights) ? c.keyHighlights : [];

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg-primary)" }}>
      <HeroSection course={c} courseId={courseId} buying={buying} onBuy={handleBuy} />
      <SocialProofSection course={c} />
      <MarqueeStrip course={c} />
      {c.videoPreviewUrl && <VideoPreviewSection videoUrl={c.videoPreviewUrl} />}
      {highlights.length > 0 && <KeyHighlightsSection highlights={highlights} />}
      <CurriculumSection course={c} />
      {related.length > 0 && <RelatedCourses courses={related} />}
      <PricingSection
        course={c} courseId={courseId} buying={buying} onBuy={handleBuy}
        buyingBundle={buyingBundle} onBuyBundle={handleBundleBuy}
        buyingAllAccess={buyingAllAccess} onBuyAllAccess={handleAllAccessBuy}
      />
      <JourneySection />
      <QuoteSection course={c} courseId={courseId} buying={buying} onBuy={handleBuy} />
      <FAQSection course={c} />
      <FinalCTAStrip course={c} courseId={courseId} buying={buying} onBuy={handleBuy} />
      <StickyBuyBar course={c} courseId={courseId} buying={buying} onBuy={handleBuy} />
      <div className="h-20 lg:hidden" />
    </div>
  );
}

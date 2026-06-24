"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock, Users, ChevronRight, Lock, Trophy, Zap, Star, TrendingUp, Layers, ShoppingCart } from "lucide-react";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { useCourse, useEnrollCourse, useMyEnrollments, useCourseLeaderboard, useRequestCourseAccess } from "@/lib/hooks/useCourses";
import { cn } from "@/lib/utils/cn";
import { toast } from "react-hot-toast";

export default function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: course, isLoading } = useCourse(id);
  const { data: enrollments } = useMyEnrollments();
  const enroll = useEnrollCourse();
  const requestAccess = useRequestCourseAccess();
  const { data: leaderboardData } = useCourseLeaderboard(id);
  const [activeSection, setActiveSection] = useState<"curriculum" | "leaderboard">("curriculum");

  if (isLoading) return <PageLoader />;
  if (!course) return <p className="text-center py-16 text-muted-foreground">Program not found.</p>;

  const isEnrolled = enrollments?.some((e) => e.courseId === id);
  const hasAccess = (course as any).hasAccess;
  const price = (course as any).price;
  const accessType = (course as any).accessType;
  const accessExpiresAt = (course as any).accessExpiresAt;
  const pendingPayment = (course as any).pendingPayment;

  const handleEnroll = async () => {
    try {
      await enroll.mutateAsync(id);
      toast.success("Enrolled successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to enroll");
    }
  };

  const handleBuyNow = async () => {
    try {
      const res = await requestAccess.mutateAsync(id);
      const paymentUrl = (res as any)?.data?.paymentUrl ?? (res as any)?.paymentUrl;
      if (paymentUrl) {
        window.open(paymentUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate payment");
    }
  };

  const leaderboard: any[] = (leaderboardData as any)?.leaderboard ?? [];
  const myRank = (leaderboardData as any)?.myRank ?? null;

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-8">
      {/* Left */}
      <div className="space-y-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>{course.level}</span>
          <h1 className="text-2xl font-bold mt-1 leading-tight">{course.title}</h1>
          {course.instructor && (
            <p className="text-muted-foreground text-sm mt-1">By {course.instructor.fullName}</p>
          )}
        </div>

        {course.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{course.description}</p>
        )}

        {/* Section toggle */}
        <div className="flex gap-1 border-b border-border">
          {(["curriculum", "leaderboard"] as const).map(s => (
            <button key={s} onClick={() => setActiveSection(s)}
              className={cn(
                "px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
                activeSection === s
                  ? "border-current text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              style={activeSection === s ? { borderColor: "var(--color-accent)", color: "var(--color-accent)" } : {}}>
              {s === "leaderboard" && <Trophy size={12} className="inline mr-1.5" />}
              {s}
            </button>
          ))}
        </div>

        {/* Curriculum */}
        {activeSection === "curriculum" && course.lessons && course.lessons.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
            {course.lessons.map((lesson: any, idx: number) => (
              <div key={lesson.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                <span className="text-xs text-muted-foreground font-mono w-6">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lesson.title}</p>
                  {lesson.duration && (
                    <p className="text-xs text-muted-foreground">{lesson.duration}m</p>
                  )}
                </div>
                {isEnrolled && hasAccess ? (
                  <Link
                    href={`/learning/${id}/${lesson.id}`}
                    className="text-xs font-semibold flex items-center gap-1 shrink-0"
                    style={{ color: "var(--color-accent)" }}
                  >
                    Watch <ChevronRight size={14} />
                  </Link>
                ) : (
                  <Lock size={14} className="text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard */}
        {activeSection === "leaderboard" && (
          <div className="space-y-3">
            {myRank && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium"
                style={{ borderColor: "var(--color-accent)", background: "color-mix(in srgb, var(--color-accent) 8%, transparent)" }}>
                <Star size={14} style={{ color: "var(--color-accent)" }} />
                <span>Your rank: <strong>#{myRank}</strong></span>
              </div>
            )}
            {leaderboard.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No leaderboard data yet.</p>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                {leaderboard.map((entry: any) => (
                  <div key={entry.memberId} className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    entry.isMe && "bg-muted/50"
                  )}>
                    <span className={cn(
                      "w-6 text-center text-xs font-bold font-mono",
                      entry.rank === 1 ? "text-yellow-500" : entry.rank === 2 ? "text-slate-400" : entry.rank === 3 ? "text-amber-600" : "text-muted-foreground"
                    )}>
                      {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {entry.member?.firstName} {entry.member?.lastName}
                        {entry.isMe && <span className="ml-1.5 text-[11px] text-muted-foreground">(you)</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Zap size={11} style={{ color: "var(--color-accent)" }} />
                      <span className="font-semibold">{entry.totalXp} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Upsell — suggest instead */}
        {((course as any).upsellCourses?.length > 0) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} style={{ color: "var(--color-accent)" }} />
              <h3 className="text-sm font-semibold">You Might Prefer</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {(course as any).upsellCourses.map((c: any) => (
                <Link key={c.id} href={`/programs/${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors">
                  {c.thumbnailUrl ? (
                    <img src={c.thumbnailUrl} alt={c.title} className="w-12 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <BookOpen size={14} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 leading-snug">{c.title}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{c.level}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Cross-sell — suggest in addition */}
        {((course as any).crossSellCourses?.length > 0) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers size={14} style={{ color: "var(--color-accent)" }} />
              <h3 className="text-sm font-semibold">Students Also Buy</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {(course as any).crossSellCourses.map((c: any) => (
                <Link key={c.id} href={`/programs/${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors">
                  {c.thumbnailUrl ? (
                    <img src={c.thumbnailUrl} alt={c.title} className="w-12 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <BookOpen size={14} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 leading-snug">{c.title}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{c.level}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right — Enroll / access card */}
      <div className="lg:sticky lg:top-6 self-start">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {course.thumbnailUrl && (
            <div className="relative aspect-video">
              <Image src={course.thumbnailUrl} alt={course.title} fill className="object-cover" />
              {!hasAccess && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Lock size={28} className="text-white/80" />
                </div>
              )}
            </div>
          )}
          <div className="p-5 space-y-4">
            {/* Price */}
            {price != null && price > 0 && (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">₹{price.toLocaleString()}</span>
                {accessType === "lifetime" && <span className="text-xs text-muted-foreground">Lifetime access</span>}
                {accessType === "duration" && accessExpiresAt && (
                  <span className="text-xs text-muted-foreground">until {new Date(accessExpiresAt).toLocaleDateString()}</span>
                )}
              </div>
            )}

            <div className="flex gap-4 text-sm text-muted-foreground">
              {course._count?.lessons != null && (
                <span className="flex items-center gap-1.5"><BookOpen size={14} />{course._count.lessons} lessons</span>
              )}
              {course.durationHours && (
                <span className="flex items-center gap-1.5"><Clock size={14} />{course.durationHours}h total</span>
              )}
            </div>

            {/* XP & quiz info */}
            {((course as any).xpPerEpisode || (course as any).passingScorePercent) && (
              <div className="flex gap-3 text-xs text-muted-foreground border-t border-border pt-3">
                {(course as any).xpPerEpisode && (
                  <span className="flex items-center gap-1"><Zap size={11} /> {(course as any).xpPerEpisode} XP/episode</span>
                )}
                {(course as any).passingScorePercent && (
                  <span className="flex items-center gap-1"><Trophy size={11} /> Pass at {(course as any).passingScorePercent}%</span>
                )}
              </div>
            )}

            {isEnrolled ? (
              <Link
                href={`/learning/${id}`}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ background: "var(--color-accent)" }}
              >
                Continue Learning
              </Link>
            ) : hasAccess ? (
              <button
                onClick={handleEnroll}
                disabled={enroll.isPending}
                className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: "var(--color-accent)" }}
              >
                {enroll.isPending ? "Enrolling..." : "Enroll Now"}
              </button>
            ) : pendingPayment ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold"
                  style={{ background: "color-mix(in srgb, #f59e0b 12%, var(--color-bg-surface))", color: "#f59e0b", border: "1px solid color-mix(in srgb, #f59e0b 25%, transparent)" }}>
                  <Clock size={14} />
                  <span>Payment submitted — awaiting approval</span>
                </div>
                <p className="text-xs text-center text-muted-foreground">Our team will verify and grant access shortly.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleBuyNow}
                  disabled={requestAccess.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ background: "var(--color-accent)" }}
                >
                  <ShoppingCart size={14} />
                  {requestAccess.isPending ? "Redirecting..." : price ? `Buy Now — ₹${price.toLocaleString()}` : "Buy Now"}
                </button>
                <p className="text-xs text-center text-muted-foreground">You'll be redirected to our payment page.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

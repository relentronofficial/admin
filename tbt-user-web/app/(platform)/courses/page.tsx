"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Search, Lock, Play, ShoppingCart, Loader2 } from "lucide-react";
import { useCourses, useMyEnrollments } from "@/lib/hooks/useCourses";
import { useMe } from "@/lib/hooks/useUser";
import { formatMinutes } from "@/lib/utils/courseDurations";

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
    if (c.hasAccess) {
      router.push(`/learning/${c.id}`);
    } else {
      router.push(`/courses/${c.id}`);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg-primary)" }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: "var(--color-surface-overlay)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-normal)" }}>
                {"Mini Courses"}
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
                {"Focused courses — buy once, learn at your own pace"}
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-subtle)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search courses…"
                className="w-full rounded-lg pl-10 pr-4 py-2.5 text-sm border outline-none focus:border-[var(--color-accent)]"
                style={{
                  background: "var(--color-bg-surface)",
                  borderColor: "var(--color-surface-overlay)",
                  color: "var(--color-text-normal)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-accent)" }} />
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <BookOpen size={40} className="mx-auto" style={{ color: "var(--color-text-subtle)" }} />
            <p className="font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              {search ? "No courses match your search" : "No mini courses available yet"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {courses.map((c: any) => {
              const hasAccess = c.hasAccess || enrolledIds.has(c.id);
              return (
                <div key={c.id} className="flex flex-col rounded-2xl overflow-hidden border transition-all"
                  style={{
                    background: "var(--color-bg-surface)",
                    borderColor: "var(--color-surface-overlay)",
                  }}>
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-black/30 cursor-pointer" onClick={() => handleCourseClick(c)}>
                    {c.thumbnailUrl ? (
                      <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen size={32} style={{ color: "var(--color-text-subtle)" }} />
                      </div>
                    )}
                    {/* Lock / Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                      {hasAccess ? (
                        <Play size={36} className="text-white" fill="white" />
                      ) : (
                        <Lock size={28} className="text-white" />
                      )}
                    </div>
                    {/* Price badge */}
                    {!hasAccess && c.price > 0 && (
                      <span className="absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-lg"
                        style={{ background: "var(--color-accent)", color: "#fff" }}>
                        ₹{c.price}
                      </span>
                    )}
                    {hasAccess && (
                      <span className="absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-lg bg-green-500/90 text-white">
                        Enrolled
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col flex-1 p-4 gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm leading-snug line-clamp-2" style={{ color: "var(--color-text-normal)" }}>
                        {c.title}
                      </h3>
                      {c.description && (
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>
                          {c.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--color-text-subtle)" }}>
                        {c.totalLessons > 0 && <span>{c.totalLessons} lessons</span>}
                        {c.durationHours != null && <span>{formatMinutes(Math.round(c.durationHours * 60))}</span>}
                      </div>
                    </div>

                    {/* CTA */}
                    {hasAccess ? (
                      <button
                        onClick={() => router.push(`/learning/${c.id}`)}
                        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
                        style={{ background: "var(--color-success)", color: "#fff" }}>
                        Continue Learning
                      </button>
                    ) : c.price > 0 ? (
                      <button
                        onClick={() => router.push(`/courses/${c.id}`)}
                        className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                        style={{ background: "var(--color-accent)", color: "#fff" }}>
                        <ShoppingCart size={15} /> Buy ₹{c.price}
                      </button>
                    ) : c.paymentLinkUrl ? (
                      <button
                        onClick={() => router.push(`/courses/${c.id}`)}
                        className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                        style={{ background: "var(--color-accent)", color: "#fff" }}>
                        <ShoppingCart size={15} /> Buy Now
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push(`/courses/${c.id}`)}
                        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all border"
                        style={{
                          background: "transparent",
                          borderColor: "var(--color-accent)",
                          color: "var(--color-accent)",
                        }}>
                        View Course
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

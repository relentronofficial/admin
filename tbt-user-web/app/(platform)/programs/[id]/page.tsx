"use client";

import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock, Users, ChevronRight, Lock } from "lucide-react";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { useCourse, useEnrollCourse, useMyEnrollments } from "@/lib/hooks/useCourses";
import { cn } from "@/lib/utils/cn";
import { toast } from "react-hot-toast";

export default function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: course, isLoading } = useCourse(id);
  const { data: enrollments } = useMyEnrollments();
  const enroll = useEnrollCourse();

  if (isLoading) return <PageLoader />;
  if (!course) return <p className="text-center py-16 text-muted-foreground">Program not found.</p>;

  const isEnrolled = enrollments?.some((e) => e.courseId === id);

  const handleEnroll = async () => {
    try {
      await enroll.mutateAsync(id);
      toast.success("Enrolled successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to enroll");
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-8">
      {/* Left */}
      <div className="space-y-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">{course.level}</span>
          <h1 className="text-2xl font-bold mt-1 leading-tight">{course.title}</h1>
          {course.instructor && (
            <p className="text-muted-foreground text-sm mt-1">By {course.instructor.fullName}</p>
          )}
        </div>

        {course.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{course.description}</p>
        )}

        {/* Lessons */}
        {course.lessons && course.lessons.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Curriculum</h2>
            <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
              {course.lessons.map((lesson, idx) => (
                <div key={lesson.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <span className="text-xs text-muted-foreground font-mono w-6">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lesson.title}</p>
                    {lesson.duration && (
                      <p className="text-xs text-muted-foreground">{lesson.duration}m</p>
                    )}
                  </div>
                  {isEnrolled || lesson.isFree ? (
                    <Link
                      href={`/learning/${id}/${lesson.id}`}
                      className="text-xs text-brand-600 font-semibold flex items-center gap-1 shrink-0"
                    >
                      Watch <ChevronRight size={14} />
                    </Link>
                  ) : (
                    <Lock size={14} className="text-muted-foreground shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right — Enroll card */}
      <div className="lg:sticky lg:top-6 self-start">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {course.thumbnailUrl && (
            <div className="relative aspect-video">
              <Image src={course.thumbnailUrl} alt={course.title} fill className="object-cover" />
            </div>
          )}
          <div className="p-5 space-y-4">
            <div className="flex gap-4 text-sm text-muted-foreground">
              {course._count?.lessons != null && (
                <span className="flex items-center gap-1.5"><BookOpen size={14} />{course._count.lessons} lessons</span>
              )}
              {course.durationHours && (
                <span className="flex items-center gap-1.5"><Clock size={14} />{course.durationHours}h total</span>
              )}
            </div>

            {isEnrolled ? (
              <Link
                href={`/learning/${id}`}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold",
                  "bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                )}
              >
                Continue Learning
              </Link>
            ) : (
              <button
                onClick={handleEnroll}
                disabled={enroll.isPending}
                className="w-full py-3 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-60"
              >
                {enroll.isPending ? "Enrolling..." : "Enroll Now"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

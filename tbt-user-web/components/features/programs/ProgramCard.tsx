import Link from "next/link";
import Image from "next/image";
import { Clock, Users, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Course } from "@/types";

interface ProgramCardProps {
  course: Course;
  enrolled?: boolean;
  progress?: number;
}

const levelColors: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  advanced: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

export function ProgramCard({ course, enrolled = false, progress }: ProgramCardProps) {
  return (
    <Link href={`/programs/${course.id}`} className="group block">
      <div className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-muted overflow-hidden">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={course.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen size={32} className="text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <span className={cn("text-[11px] font-semibold px-2 py-1 rounded-md uppercase tracking-wide", levelColors[course.level])}>
              {course.level}
            </span>
          </div>
          {enrolled && typeof progress === "number" && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors">
            {course.title}
          </h3>

          {course.instructor && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {course.instructor.fullName}
            </p>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            {course._count?.lessons != null && (
              <span className="flex items-center gap-1">
                <BookOpen size={12} /> {course._count.lessons} lessons
              </span>
            )}
            {course.durationHours && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> {course.durationHours}h
              </span>
            )}
            {course._count?.enrollments != null && (
              <span className="flex items-center gap-1">
                <Users size={12} /> {course._count.enrollments}
              </span>
            )}
          </div>

          {enrolled && typeof progress === "number" && (
            <p className="text-[11px] text-brand-600 font-medium mt-2">{progress}% complete</p>
          )}
        </div>
      </div>
    </Link>
  );
}

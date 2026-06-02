"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { ProgramCard } from "@/components/features/programs/ProgramCard";
import { CardSkeleton, PageLoader } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useCourses } from "@/lib/hooks/useCourses";
import { cn } from "@/lib/utils/cn";

const LEVELS = ["all", "beginner", "intermediate", "advanced"] as const;

export default function ProgramsPage() {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<string>("all");

  const { data, isLoading } = useCourses({
    search: search || undefined,
    level: level !== "all" ? level : undefined,
    limit: 24,
  });

  const courses = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Programs</h2>
        <p className="text-muted-foreground text-sm mt-1">Explore all available courses and programs.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search programs..."
            className="w-full pl-9 pr-4 h-10 bg-background border border-border rounded-lg text-sm outline-none focus:border-brand-600 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={cn(
                "px-4 h-10 rounded-lg text-sm font-medium capitalize transition-colors",
                level === l
                  ? "bg-brand-600 text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : courses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <ProgramCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No programs found"
          description="Try adjusting your search or filters."
        />
      )}
    </div>
  );
}

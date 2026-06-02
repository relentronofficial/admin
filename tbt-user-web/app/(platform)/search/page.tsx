"use client";

import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { ProgramCard } from "@/components/features/programs/ProgramCard";
import { EventCard } from "@/components/features/events/EventCard";
import { CardSkeleton } from "@/components/common/LoadingSpinner";
import { useCourses } from "@/lib/hooks/useCourses";
import { useEvents } from "@/lib/hooks/useEvents";
import { cn } from "@/lib/utils/cn";

type Tab = "programs" | "events";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("programs");

  const { data: coursesData, isLoading: loadingCourses } = useCourses({
    search: query || undefined,
    limit: 12,
  });
  const { data: eventsData, isLoading: loadingEvents } = useEvents({
    search: query || undefined,
    limit: 12,
  });

  const courses = coursesData?.data ?? [];
  const events = eventsData?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Search</h2>
      </div>

      {/* Search input */}
      <div className="relative max-w-xl">
        <SearchIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search programs, events..."
          className="w-full pl-11 pr-4 h-12 bg-background border border-border rounded-xl text-base outline-none focus:border-brand-600 transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        {(["programs", "events"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
            {t === "programs" && courses.length > 0 && (
              <span className="ml-2 text-xs bg-muted rounded-full px-1.5 py-0.5">{courses.length}</span>
            )}
            {t === "events" && events.length > 0 && (
              <span className="ml-2 text-xs bg-muted rounded-full px-1.5 py-0.5">{events.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Results */}
      {tab === "programs" && (
        loadingCourses ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((c) => <ProgramCard key={c.id} course={c} />)}
          </div>
        )
      )}
      {tab === "events" && (
        loadingEvents ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )
      )}

      {!query && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Start typing to search across programs and events.
        </p>
      )}
    </div>
  );
}

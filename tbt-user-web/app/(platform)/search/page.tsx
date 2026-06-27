"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search as SearchIcon, Lock } from "lucide-react";
import { ProgramCard } from "@/components/features/programs/ProgramCard";
import { EventCard } from "@/components/features/events/EventCard";
import { CardSkeleton } from "@/components/common/LoadingSpinner";
import { useCourses } from "@/lib/hooks/useCourses";
import { useEvents } from "@/lib/hooks/useEvents";
import { useAllWorkshops } from "@/lib/hooks/useConfig";
import { cn } from "@/lib/utils/cn";
import type { WorkshopListItem } from "@/types";

type Tab = "workshops" | "courses" | "events";

function WorkshopSearchCard({ item }: { item: WorkshopListItem }) {
  if (item.locked) {
    return (
      <div
        className="group block rounded-xl overflow-hidden border cursor-default opacity-60"
        style={{ background: "var(--color-bg-surface)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="aspect-video relative overflow-hidden" style={{ background: "var(--color-bg-primary)" }}>
          {item.thumbnailUrl && (
            <Image src={item.thumbnailUrl} alt={item.title} fill className="object-cover" />
          )}
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
            <Lock size={20} style={{ color: "var(--color-locked, #4a4a4a)" }} />
          </div>
        </div>
        <div className="p-3">
          <p className="text-sm font-semibold line-clamp-2" style={{ color: "rgba(255,255,255,0.9)" }}>{item.title}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-locked, #4a4a4a)" }}>Not available for your batch</p>
        </div>
      </div>
    );
  }
  return (
    <Link
      href={`/workshop/${item.slug}`}
      className="group block rounded-xl overflow-hidden border transition-colors"
      style={{ background: "var(--color-bg-surface)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div className="aspect-video relative overflow-hidden" style={{ background: "var(--color-bg-primary)" }}>
        {item.thumbnailUrl && (
          <Image src={item.thumbnailUrl} alt={item.title} fill className="object-cover group-hover:scale-[1.03] transition-transform duration-300" />
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold line-clamp-2 group-hover:opacity-80 transition-opacity" style={{ color: "rgba(255,255,255,0.9)" }}>{item.title}</p>
      </div>
    </Link>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("workshops");

  const { data: workshopsData, isLoading: loadingWorkshops } = useAllWorkshops();
  const { data: coursesData, isLoading: loadingCourses } = useCourses({
    search: query || undefined,
    limit: 12,
  });
  const { data: eventsData, isLoading: loadingEvents } = useEvents({
    search: query || undefined,
    limit: 12,
  });

  const q = query.toLowerCase().trim();
  const allWorkshops = workshopsData ?? [];
  const workshops = q
    ? allWorkshops.filter((w) => w.title.toLowerCase().includes(q))
    : allWorkshops;
  const courses = coursesData?.data ?? [];
  const events = eventsData?.data ?? [];

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "workshops", label: "Workshops", count: workshops.length },
    { id: "courses",   label: "Courses",   count: courses.length },
    { id: "events",    label: "Events",    count: events.length },
  ];

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
          placeholder="Search workshops, courses, events..."
          className="w-full pl-11 pr-4 h-12 bg-background border border-border rounded-xl text-base outline-none focus:border-brand-600 transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              tab === t.id ? "border-brand-600 text-brand-600" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-2 text-xs bg-muted rounded-full px-1.5 py-0.5">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Results */}
      {tab === "workshops" && (
        loadingWorkshops ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : workshops.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {workshops.map((w) => <WorkshopSearchCard key={w.id} item={w} />)}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">
            {query ? `No workshops matching "${query}"` : "No workshops available."}
          </p>
        )
      )}

      {tab === "courses" && (
        loadingCourses ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : courses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((c) => <ProgramCard key={c.id} course={c} />)}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">
            {query ? `No courses matching "${query}"` : "No courses available."}
          </p>
        )
      )}

      {tab === "events" && (
        loadingEvents ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">
            {query ? `No events matching "${query}"` : "No events available."}
          </p>
        )
      )}

      {!query && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Start typing to search across workshops, courses and events.
        </p>
      )}
    </div>
  );
}

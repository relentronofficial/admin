"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { EventCard } from "@/components/features/events/EventCard";
import { CardSkeleton } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useEvents } from "@/lib/hooks/useEvents";

export default function EventsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useEvents({ search: search || undefined, limit: 24 });
  const events = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Events</h2>
        <p className="text-muted-foreground text-sm mt-1">Workshops, meetups, and networking events.</p>
      </div>

      <div className="relative max-w-md">
        <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events..."
          className="w-full pl-9 pr-4 h-10 bg-background border border-border rounded-lg text-sm outline-none focus:border-brand-600 transition-colors"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : events.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((event) => <EventCard key={event.id} event={event} />)}
        </div>
      ) : (
        <EmptyState icon={Calendar} title="No events found" description="Check back soon for upcoming events." />
      )}
    </div>
  );
}

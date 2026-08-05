"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";

import {
  useContinueListening,
  useFeaturedPodcastSeries,
  usePodcastCategories,
  usePodcastEpisodes,
} from "@/lib/hooks/usePodcasts";

import {
  ContinueListeningCard,
  EpisodeRow,
  PodcastRow,
  SeriesCard,
} from "@/components/features/podcasts/PodcastCards";

export default function PodcastsHomePage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: categories = [] } = usePodcastCategories();
  const { data: featuredSeries = [] } = useFeaturedPodcastSeries();
  const { data: continueItems = [] } = useContinueListening();

  const { data: episodesData, isLoading: episodesLoading } = usePodcastEpisodes({
    limit: 30,
    category: selectedCategory || undefined,
    search: search || undefined,
  });

  const activeCategories = categories.filter((c) => c.status === "active");

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Podcasts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fresh conversations, short-form ideas, and long-form deep dives.
        </p>
      </div>

      {/* Featured series */}
      {featuredSeries.length > 0 && (
        <PodcastRow title="Featured series">
          {featuredSeries.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </PodcastRow>
      )}

      {/* Continue listening */}
      {continueItems.length > 0 && (
        <PodcastRow title="Continue listening">
          {continueItems.map((item) => (
            <ContinueListeningCard
              key={item.episode.id}
              episode={item.episode}
              currentPositionSeconds={item.currentPositionSeconds}
              totalDurationSeconds={item.totalDurationSeconds}
            />
          ))}
        </PodcastRow>
      )}

      {/* Category + search */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm sm:text-base font-bold text-foreground">Episodes</h2>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search episodes…"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-foreground outline-none"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
              }}
            />
          </div>
        </div>

        {activeCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <CategoryChip
              label="All"
              selected={!selectedCategory}
              onClick={() => setSelectedCategory(null)}
            />
            {activeCategories.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.name}
                selected={selectedCategory === c.slug}
                onClick={() => setSelectedCategory(c.slug)}
              />
            ))}
          </div>
        )}

        {episodesLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading episodes…
          </div>
        ) : (episodesData?.episodes ?? []).length === 0 ? (
          <div
            className="p-8 rounded-2xl text-center text-sm text-muted-foreground"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            {search || selectedCategory
              ? "No episodes match this filter yet."
              : "No episodes published yet."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(episodesData?.episodes ?? []).map((ep) => (
              <EpisodeRow key={ep.id} episode={ep} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CategoryChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors"
      style={{
        color: selected ? "#fff" : "var(--color-text-secondary)",
        background: selected ? "var(--color-accent)" : "var(--color-bg-surface)",
        border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
      }}
    >
      {label}
    </button>
  );
}

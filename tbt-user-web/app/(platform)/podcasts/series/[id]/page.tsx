"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Mic } from "lucide-react";

import { usePodcastSeries } from "@/lib/hooks/usePodcasts";
import { EpisodeRow } from "@/components/features/podcasts/PodcastCards";

export default function PodcastSeriesPage() {
  const params = useParams<{ id: string }>();
  const seriesId = params?.id ?? "";
  const { data, isLoading, isError } = usePodcastSeries(seriesId);

  return (
    <div className="max-w-3xl mx-auto pb-24 space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/podcasts"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <span className="text-xs text-muted-foreground">Podcasts / Series</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> Loading…
        </div>
      ) : isError || !data ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Could not load this series.
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-5">
            <div
              className="w-40 sm:w-52 aspect-square rounded-2xl overflow-hidden flex-shrink-0 mx-auto sm:mx-0"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              {data.series.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.series.coverImage}
                  alt={data.series.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Mic size={40} className="text-muted-foreground opacity-30" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <h1 className="text-2xl font-bold text-foreground">{data.series.title}</h1>
              <p className="text-xs text-muted-foreground">
                {data.episodes.length} episode{data.episodes.length === 1 ? "" : "s"}
              </p>
              {data.series.description && (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {data.series.description}
                </p>
              )}
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">Episodes</h2>
            {data.episodes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No episodes yet.
              </p>
            ) : (
              <div className="space-y-3">
                {data.episodes.map((ep) => (
                  <EpisodeRow key={ep.id} episode={ep} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

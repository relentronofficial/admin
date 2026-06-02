"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Volume2, VolumeX, ChevronLeft, ChevronRight, Play, Lock } from "lucide-react";
import { useHomeHero, useHomeSections } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useMe } from "@/lib/hooks/useUser";
import { cn } from "@/lib/utils/cn";
import type { HeroSlide, ContentSection, ContentItem, ContentEpisode } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(seconds: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Hero Carousel ────────────────────────────────────────────────────────────

function HeroCarousel({
  slides,
  autoPlayIntervalMs,
}: {
  slides: HeroSlide[];
  autoPlayIntervalMs: number;
}) {
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(slides[0]?.bgMuteDefault ?? true);
  const [transitioning, setTransitioning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (index: number) => {
      if (transitioning || index === current) return;
      setTransitioning(true);
      setTimeout(() => {
        setCurrent(index);
        setMuted(slides[index]?.bgMuteDefault ?? true);
        setTransitioning(false);
      }, 300);
    },
    [transitioning, current, slides]
  );

  const next = useCallback(
    () => goTo((current + 1) % slides.length),
    [goTo, current, slides.length]
  );
  const prev = useCallback(
    () => goTo((current - 1 + slides.length) % slides.length),
    [goTo, current, slides.length]
  );

  useEffect(() => {
    if (slides.length <= 1) return;
    timerRef.current = setInterval(next, autoPlayIntervalMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [next, autoPlayIntervalMs, slides.length]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (slides.length > 1) timerRef.current = setInterval(next, autoPlayIntervalMs);
  }, [next, autoPlayIntervalMs, slides.length]);

  if (!slides.length) return null;
  const slide = slides[current];

  return (
    <div className="relative w-full h-[60vh] min-h-[400px] overflow-hidden rounded-2xl select-none">
      {/* Background */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          transitioning ? "opacity-0" : "opacity-100"
        )}
      >
        {slide.bgVideoUrl ? (
          <video
            ref={videoRef}
            key={slide.bgVideoUrl}
            src={slide.bgVideoUrl}
            autoPlay
            loop
            muted={muted}
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : slide.bgImageUrl ? (
          <Image src={slide.bgImageUrl} alt={slide.title} fill className="object-cover" priority={current === 0} />
        ) : (
          <div className="absolute inset-0" style={{ background: "var(--color-bg-surface)" }} />
        )}
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />

      {/* Content */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 p-6 md:p-10 transition-all duration-300",
          transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        )}
      >
        {slide.badgeText && (
          <span
            className="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider mb-3 text-white"
            style={{ background: "var(--color-accent)" }}
          >
            {slide.badgeText}
          </span>
        )}
        <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-2 leading-tight max-w-2xl">
          {slide.title}
        </h2>
        {slide.description && (
          <p className="text-white/75 text-sm md:text-base mb-6 max-w-xl leading-relaxed">
            {slide.description}
          </p>
        )}
        {slide.ctaType === "internal" ? (
          <Link
            href={slide.ctaUrl}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: "var(--color-accent)" }}
          >
            <Play size={14} className="fill-current" />
            {slide.ctaLabel}
          </Link>
        ) : (
          <a
            href={slide.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: "var(--color-accent)" }}
          >
            {slide.ctaLabel}
          </a>
        )}
      </div>

      {/* Mute toggle */}
      {slide.bgVideoUrl && (
        <button
          onClick={() => setMuted((m) => !m)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      )}

      {/* Prev / Next */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => { prev(); resetTimer(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => { next(); resetTimer(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Indicator dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 right-6 flex gap-1.5 items-center">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i); resetTimer(); }}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === current ? "w-6" : "w-1.5 bg-white/40 hover:bg-white/70"
              )}
              style={i === current ? { background: "var(--color-accent)" } : {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Episode list in hover panel ──────────────────────────────────────────────

function EpisodeRow({ ep, index }: { ep: ContentEpisode; index: number }) {
  return (
    <Link
      href={`/watch/${ep.id}`}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors group/ep"
    >
      <span className="text-[11px] text-white/40 w-4 flex-shrink-0 text-center">
        {ep.order || index + 1}
      </span>
      {ep.thumbnailUrl ? (
        <div className="relative w-10 h-6 rounded overflow-hidden flex-shrink-0">
          <Image src={ep.thumbnailUrl} alt={ep.title} fill className="object-cover" />
        </div>
      ) : (
        <div
          className="w-10 h-6 rounded flex-shrink-0 flex items-center justify-center"
          style={{ background: "var(--color-bg-primary)" }}
        >
          <Play size={8} className="text-white/50 fill-current" />
        </div>
      )}
      <span className="flex-1 text-[11px] text-white/80 line-clamp-1 group-hover/ep:text-white transition-colors">
        {ep.title}
      </span>
      {ep.durationSeconds > 0 && (
        <span className="text-[10px] text-white/40 flex-shrink-0">
          {fmtDuration(ep.durationSeconds)}
        </span>
      )}
    </Link>
  );
}

// ─── Content Item Card ────────────────────────────────────────────────────────

function ContentItemCard({ item }: { item: ContentItem }) {
  const { uiStrings } = useSiteConfig();
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const episodes = item.episodes ?? [];
  const hasEpisodes = episodes.length > 0;

  return (
    <div
      ref={cardRef}
      className="relative flex-shrink-0 w-44 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Base card */}
      <div
        className={cn(
          "rounded-xl overflow-hidden bg-card border border-border transition-transform duration-200",
          hovered && !item.isLocked ? "scale-105 shadow-2xl" : ""
        )}
      >
        <div className="aspect-[2/3] relative">
          {item.thumbnailUrl ? (
            <Image src={item.thumbnailUrl} alt={item.title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: "var(--color-bg-surface)" }} />
          )}

          {/* Locked overlay */}
          {item.isLocked && (
            <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-1.5">
              <Lock size={18} className="text-white/60" />
              {item.lockBadgeText ?? uiStrings?.lockedContentMessage ? (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded text-white"
                  style={{ background: "var(--color-alert)" }}
                >
                  {item.lockBadgeText ?? uiStrings?.lockedContentMessage}
                </span>
              ) : null}
            </div>
          )}

          {/* Unlocked — quick play on hover (no episodes) */}
          {!item.isLocked && !hasEpisodes && item.playUrl && (
            <Link
              href={item.playUrl}
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-colors",
                hovered ? "bg-black/50" : "bg-black/0"
              )}
              tabIndex={hovered ? 0 : -1}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200",
                  hovered ? "opacity-100 scale-100" : "opacity-0 scale-75"
                )}
                style={{ background: "var(--color-accent)" }}
              >
                <Play size={16} className="text-white fill-current ml-0.5" />
              </div>
            </Link>
          )}
        </div>

        <div className="p-2">
          <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{item.title}</p>
          <div className="flex items-center gap-1 mt-1">
            {item.categoryTag && (
              <span className="text-[10px] font-medium" style={{ color: "var(--color-accent)" }}>
                {item.categoryTag}
              </span>
            )}
            {item.episodeCount != null && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {item.episodeCount} ep
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover episode panel — only for unlocked items with episodes */}
      {!item.isLocked && hasEpisodes && hovered && (
        <div
          className="absolute left-0 right-0 top-0 z-50 rounded-xl overflow-hidden shadow-2xl border border-white/10"
          style={{ background: "var(--color-bg-surface, #111)" }}
        >
          {/* Thumbnail + play */}
          <div className="relative aspect-video">
            {item.thumbnailUrl ? (
              <Image src={item.thumbnailUrl} alt={item.title} fill className="object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: "var(--color-bg-primary)" }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            {item.playUrl && (
              <Link
                href={item.playUrl}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "var(--color-accent)" }}
                >
                  <Play size={16} className="text-white fill-current ml-0.5" />
                </div>
              </Link>
            )}
          </div>

          {/* Meta */}
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-xs font-semibold text-white line-clamp-1">{item.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {item.categoryTag && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ color: "var(--color-accent)", background: "color-mix(in srgb, var(--color-accent) 15%, transparent)" }}
                >
                  {item.categoryTag}
                </span>
              )}
              {item.episodeCount != null && (
                <span className="text-[10px] text-white/50">{item.episodeCount} episodes</span>
              )}
            </div>
          </div>

          {/* Episode list */}
          <div className="max-h-52 overflow-y-auto py-1 scrollbar-hide">
            {episodes.map((ep, i) => (
              <EpisodeRow key={ep.id} ep={ep} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section Row ──────────────────────────────────────────────────────────────

function SectionRow({ section }: { section: ContentSection }) {
  const { uiStrings } = useSiteConfig();

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <h3 className="text-base font-bold text-foreground">{section.title}</h3>
        {section.isLocked && section.lockLabel && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white"
            style={{ background: "var(--color-alert)" }}
          >
            {section.lockLabel}
          </span>
        )}
      </div>

      {/* Locked section — show upgrade prompt */}
      {section.isLocked ? (
        <div
          className="rounded-xl px-6 py-8 flex flex-col items-center gap-2 border border-dashed"
          style={{
            borderColor: "var(--color-alert)",
            background: "color-mix(in srgb, var(--color-alert) 8%, transparent)",
          }}
        >
          <Lock size={20} style={{ color: "var(--color-alert)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--color-alert)" }}>
            {section.lockLabel ?? uiStrings?.lockedContentMessage}
          </p>
        </div>
      ) : (
        /* Card row — overflow-visible wrapper preserves hover panels above siblings */
        <div className="relative">
          <div
            className="flex gap-3 overflow-x-auto pb-2 -mb-2 scrollbar-hide"
            style={{ overflowY: "visible" }}
          >
            {section.items.map((item) => (
              <ContentItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div
      className="w-full h-[60vh] min-h-[400px] rounded-2xl animate-pulse"
      style={{ background: "var(--color-bg-surface)" }}
    />
  );
}

function SectionsSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map((n) => (
        <div key={n} className="space-y-3">
          <div className="h-5 w-44 rounded animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-44 aspect-[2/3] rounded-xl animate-pulse"
                style={{ background: "var(--color-bg-surface)" }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EiFlixPage() {
  const { data: me } = useMe();
  const { data: heroData, isLoading: heroLoading } = useHomeHero();
  const { uiStrings } = useSiteConfig();

  const memberTier = me?.currentTier ?? 1;

  const { data: sectionsData, isLoading: sectionsLoading } = useHomeSections(memberTier);

  return (
    <div className="space-y-10">
      {/* Hero */}
      {heroLoading ? (
        <HeroSkeleton />
      ) : heroData?.slides?.length ? (
        <HeroCarousel slides={heroData.slides} autoPlayIntervalMs={heroData.autoPlayIntervalMs} />
      ) : null}

      {/* Content Sections */}
      {sectionsLoading ? (
        <SectionsSkeleton />
      ) : sectionsData?.sections?.length ? (
        <div className="space-y-10">
          {sectionsData.sections.map((section) => (
            <SectionRow key={section.id} section={section} />
          ))}
        </div>
      ) : (
        !sectionsLoading && (
          <p className="text-sm text-muted-foreground text-center py-10">
            {uiStrings?.loading}
          </p>
        )
      )}

    </div>
  );
}

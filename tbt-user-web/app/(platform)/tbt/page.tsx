"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Volume2, VolumeX, ChevronLeft, ChevronRight, Play, Lock, PlayCircle, CheckCircle2, Clock } from "lucide-react";
import { useHomeHero, useHomeSections } from "@/lib/hooks/useConfig";
import { useContinueLearning, useWatchHistory } from "@/lib/hooks/useDashboard";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useMe } from "@/lib/hooks/useUser";
import { cn } from "@/lib/utils/cn";
import type { HeroSlide, ContentSection, ContentItem, ContinueLearningItem, WatchHistoryItem } from "@/types";

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
    <div className="relative w-full h-[55vh] md:h-[65vh] min-h-[300px] max-h-[680px] overflow-hidden select-none">
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/15 to-transparent pointer-events-none" />
      {/* Top vignette for navbar blending */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

      {/* Content */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 px-6 pb-12 md:px-14 md:pb-14 lg:px-20 lg:pb-16 transition-all duration-300",
          transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        )}
      >
        {slide.badgeText && (
          <span
            className="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wider mb-4 text-white"
            style={{ background: "var(--color-accent)" }}
          >
            {slide.badgeText}
          </span>
        )}
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-3 leading-tight max-w-2xl lg:max-w-3xl drop-shadow-2xl">
          {slide.title}
        </h2>
        {slide.description && (
          <p className="text-white/80 text-sm md:text-base mb-7 max-w-lg md:max-w-xl leading-relaxed drop-shadow">
            {slide.description}
          </p>
        )}
        {slide.ctaType === "internal" ? (
          <Link
            href={slide.ctaUrl}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-lg"
            style={{ background: "var(--color-accent)" }}
          >
            <Play size={15} className="fill-current" />
            {slide.ctaLabel}
          </Link>
        ) : (
          <a
            href={slide.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-lg"
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
          className="absolute top-4 right-4 md:top-6 md:right-6 w-9 h-9 flex items-center justify-center rounded-full text-white transition-all hover:scale-110"
          style={{
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
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
            className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full text-white transition-all hover:scale-110 active:scale-95"
            style={{
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
            aria-label="Previous slide"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => { next(); resetTimer(); }}
            className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full text-white transition-all hover:scale-110 active:scale-95"
            style={{
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
            aria-label="Next slide"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Indicator dots — centered at bottom */}
      {slides.length > 1 && (
        <div className="absolute bottom-5 md:bottom-7 left-1/2 -translate-x-1/2 flex gap-2 items-center">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i); resetTimer(); }}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === current ? "w-7" : "w-2 bg-white/35 hover:bg-white/65"
              )}
              style={i === current ? { background: "var(--color-accent)" } : {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Content Item Card ────────────────────────────────────────────────────────

function ContentItemCard({ item }: { item: ContentItem }) {
  const { uiStrings } = useSiteConfig();
  const [hovered, setHovered] = useState(false);

  const inner = (
    <div
      className={cn(
        "rounded-xl overflow-hidden bg-card border border-border transition-all duration-300",
        hovered && !item.isLocked
          ? "scale-[1.04] shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_24px_color-mix(in_srgb,var(--color-accent)_14%,transparent)]"
          : ""
      )}
    >
      <div className="aspect-[2/3] md:aspect-video relative overflow-hidden">
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={item.title}
            fill
            className={cn(
              "object-cover transition-transform duration-500",
              hovered && !item.isLocked ? "scale-110" : "scale-100"
            )}
          />
        ) : (
          <div className="w-full h-full" style={{ background: "var(--color-bg-surface)" }} />
        )}

        {item.isLocked ? (
          <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-1.5">
            <Lock size={18} className="text-white/60" />
            {(item.lockBadgeText ?? uiStrings?.lockedContentMessage) && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: "var(--color-alert)" }}
              >
                {item.lockBadgeText ?? uiStrings?.lockedContentMessage}
              </span>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-colors",
              hovered ? "bg-black/40" : "bg-black/0"
            )}
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
          </div>
        )}
      </div>

      <div className="p-2 md:p-3">
        <p className="text-xs md:text-sm font-medium text-foreground line-clamp-2 leading-snug">{item.title}</p>
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
  );

  return (
    <div
      className={cn(
        "flex-shrink-0 w-44 md:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)]",
        item.isLocked ? "cursor-not-allowed" : "cursor-pointer"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!item.isLocked && item.playUrl ? (
        <Link href={item.playUrl}>{inner}</Link>
      ) : (
        inner
      )}
    </div>
  );
}

// ─── Section Row ──────────────────────────────────────────────────────────────

function SectionRow({ section }: { section: ContentSection }) {
  const { uiStrings } = useSiteConfig();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const showArrows = section.items.length > 4;

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, section.items.length]);

  const scrollPage = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? el.clientWidth * 0.85 : -el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
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

        {showArrows && (
          <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => scrollPage("left")}
              disabled={!canScrollLeft}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-25 hover:scale-110 active:scale-95"
              style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.1)" }}
              aria-label="Scroll left"
            >
              <ChevronLeft size={15} className="text-white" />
            </button>
            <button
              onClick={() => scrollPage("right")}
              disabled={!canScrollRight}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-25 hover:scale-110 active:scale-95"
              style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.1)" }}
              aria-label="Scroll right"
            >
              <ChevronRight size={15} className="text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Cards — always render when items exist; locked items carry their own overlay */}
      {section.items.length > 0 ? (
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2 -mb-2 scrollbar-hide"
            style={{ overflowY: "visible" }}
          >
            {section.items.map((item) => (
              <ContentItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : section.isLocked ? (
        /* Fallback: locked section with no items from API */
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
      ) : null}
    </section>
  );
}

// ─── Continue Watching ────────────────────────────────────────────────────────

function ContinueWatchingCard({ item }: { item: ContinueLearningItem }) {
  const href = item.type === "workshop" ? `/workshop/${item.id}` : `/learning/${item.id}`;

  return (
    <Link
      href={href}
      className="group flex-shrink-0 w-72 rounded-xl border border-border overflow-hidden transition-all duration-200 hover:border-[var(--color-accent)] hover:shadow-[0_0_20px_color-mix(in_srgb,var(--color-accent)_12%,transparent)]"
      style={{ background: "var(--color-bg-surface)" }}
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="relative w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden">
          {item.thumbnailUrl ? (
            <Image src={item.thumbnailUrl} alt={item.title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
              <PlayCircle size={20} className="text-muted-foreground" />
            </div>
          )}
          {/* Play overlay on hover */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--color-accent)" }}>
              <Play size={10} className="text-white fill-current ml-0.5" />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium truncate">{item.title}</p>
            <p className="text-xs font-semibold text-foreground truncate mt-0.5 leading-tight">{item.lastLessonTitle}</p>
          </div>

          {/* Progress bar + % */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${item.progressPercent}%`, background: "var(--color-accent)" }}
              />
            </div>
            <span className="text-[10px] font-bold flex-shrink-0 tabular-nums" style={{ color: "var(--color-accent)" }}>
              {item.progressPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Continue button */}
      <div
        className="px-3 py-2 border-t border-border flex items-center justify-between"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <span className="text-[11px] text-muted-foreground">
          {item.progressPercent}% completed
        </span>
        <span
          className="flex items-center gap-1.5 text-[11px] font-bold transition-all group-hover:gap-2.5"
          style={{ color: "var(--color-accent)" }}
        >
          <Play size={9} fill="currentColor" /> Continue
        </span>
      </div>
    </Link>
  );
}

function ContinueWatchingSection() {
  const { uiStrings } = useSiteConfig();
  const { data, isLoading } = useContinueLearning();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, data]);

  const scrollPage = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? 320 : -320, behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <section className="space-y-3">
        <div className="h-5 w-44 rounded animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-72 h-24 rounded-xl animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
          ))}
        </div>
      </section>
    );
  }

  const items: ContinueLearningItem[] = Array.isArray(data) ? data : [];
  if (!items.length) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">
          {uiStrings?.continueWatchingLabel ?? "Continue Watching"}
        </h3>
        {items.length > 3 && (
          <div className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => scrollPage("left")}
              disabled={!canScrollLeft}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-25 hover:scale-110 active:scale-95"
              style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.1)" }}
              aria-label="Scroll left"
            >
              <ChevronLeft size={15} className="text-white" />
            </button>
            <button
              onClick={() => scrollPage("right")}
              disabled={!canScrollRight}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-25 hover:scale-110 active:scale-95"
              style={{ background: "var(--color-bg-surface)", border: "1px solid rgba(255,255,255,0.1)" }}
              aria-label="Scroll right"
            >
              <ChevronRight size={15} className="text-white" />
            </button>
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
        {items.map((item) => (
          <ContinueWatchingCard key={`${item.type}-${item.id}-${item.lessonId}`} item={item} />
        ))}
      </div>
    </section>
  );
}

// ─── Watch History ────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function WatchHistoryCard({ item }: { item: WatchHistoryItem }) {
  const href = `/workshop/${item.workshopSlug}`;

  return (
    <Link
      href={href}
      className="group flex items-start gap-3 px-3 py-3 rounded-xl border border-border transition-all duration-200 hover:border-[rgba(255,255,255,0.15)] hover:bg-white/[0.03]"
    >
      {/* Thumbnail */}
      <div className="relative w-14 h-10 flex-shrink-0 rounded-lg overflow-hidden mt-0.5">
        {item.thumbnailUrl ? (
          <Image src={item.thumbnailUrl} alt={item.workshopTitle} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
            <Clock size={14} className="text-muted-foreground" />
          </div>
        )}
        {item.isCompleted && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate leading-tight">{item.workshopTitle}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.episodeTitle}</p>
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
            {relativeTime(item.updatedAt)}
          </span>
        </div>

        {/* Progress + status */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${item.isCompleted ? 100 : item.progressPercent}%`,
                background: item.isCompleted ? "#22c55e" : "var(--color-accent)",
              }}
            />
          </div>
          {item.isCompleted ? (
            <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: "#22c55e" }}>
              Completed
            </span>
          ) : (
            <span className="text-[10px] font-bold whitespace-nowrap tabular-nums" style={{ color: "var(--color-accent)" }}>
              {item.progressPercent}%
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function RecentlyWatchedSection() {
  const { data, isLoading } = useWatchHistory({ limit: 6 });

  if (isLoading) {
    return (
      <section className="space-y-3">
        <div className="h-5 w-40 rounded animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--color-bg-surface)" }} />
          ))}
        </div>
      </section>
    );
  }

  const items: WatchHistoryItem[] = Array.isArray(data) ? data : [];
  if (!items.length) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-base font-bold text-foreground">Recently Watched</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map((item) => (
          <WatchHistoryCard key={`${item.workshopSlug}-${item.episodeId}`} item={item} />
        ))}
      </div>
    </section>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div
      className="w-full h-[55vh] md:h-[65vh] min-h-[300px] max-h-[680px] animate-pulse"
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
                className="flex-shrink-0 w-44 md:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)] aspect-[2/3] md:aspect-video rounded-xl animate-pulse"
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

export default function TBTHomePage() {
  const { data: me } = useMe();
  const { data: heroData, isLoading: heroLoading } = useHomeHero();
  const { uiStrings } = useSiteConfig();

  const memberTier = me?.currentTier ?? 1;

  const { data: sectionsData, isLoading: sectionsLoading } = useHomeSections(memberTier);

  return (
    <div>
      {/* Hero — full-bleed: breaks out of the max-w-7xl container */}
      <div
        className="-mt-6 mb-10"
        style={{
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          width: "100vw",
        }}
      >
        {heroLoading ? (
          <HeroSkeleton />
        ) : heroData?.slides?.length ? (
          <HeroCarousel slides={heroData.slides} autoPlayIntervalMs={heroData.autoPlayIntervalMs} />
        ) : null}
      </div>

      {/* Continue Watching — shown when user has in-progress episodes */}
      <div className="mb-10">
        <ContinueWatchingSection />
      </div>

      {/* Recently Watched — full history sorted by last watched */}
      <div className="mb-10">
        <RecentlyWatchedSection />
      </div>

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

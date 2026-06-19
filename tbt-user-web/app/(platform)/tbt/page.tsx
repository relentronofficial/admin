import { Suspense } from "react";
import type { HeroSlide, ContentSection } from "@/types";
import {
  HeroCarousel,
  TbtSections,
  ContinueWatchingSection,
  RecentlyWatchedSection,
  TierAwareSectionsRefetch,
} from "./TbtClient";
import { TierSectionsShell } from "./TierSectionsShell";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchPublicJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

export default async function TBTHomePage() {
  // Fetch hero and default (tier-1) sections in parallel — pure public data, no auth needed.
  // Server-to-server calls hit Vercel edge cache after the first request.
  const [heroData, sectionsData] = await Promise.all([
    fetchPublicJson<{ slides: HeroSlide[]; autoPlayIntervalMs: number }>("/api/pub/home/hero"),
    fetchPublicJson<{ sections: ContentSection[] }>("/api/pub/home/sections?memberTier=1"),
  ]);

  const slides = heroData?.slides ?? [];
  const autoPlayIntervalMs = heroData?.autoPlayIntervalMs ?? 5000;
  const sections = sectionsData?.sections ?? [];

  return (
    <div>
      {/* Hero — full-bleed, SSR data, renders with initial HTML */}
      <div
        className="-mt-6 mb-10"
        style={{ marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)", width: "100vw" }}
      >
        {slides.length > 0 && (
          <HeroCarousel slides={slides} autoPlayIntervalMs={autoPlayIntervalMs} />
        )}
      </div>

      <div
        className="px-4 md:px-6"
        style={{ marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)", width: "100vw" }}
      >
        {/* Personalized sections — client-side only, non-blocking */}
        <Suspense fallback={null}>
          <div className="mb-10">
            <ContinueWatchingSection />
          </div>
          <div className="mb-10">
            <RecentlyWatchedSection />
          </div>
        </Suspense>

        {/* Content sections — SSR data, renders with initial HTML.
            TierSectionsShell holds state so higher-tier users get accurate locking
            after hydration without a layout shift. */}
        <TierSectionsShell initialSections={sections} />
      </div>
    </div>
  );
}

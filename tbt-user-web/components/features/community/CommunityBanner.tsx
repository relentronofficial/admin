"use client";

import Link from "next/link";
import { Bookmark, RefreshCw } from "lucide-react";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";

/**
 * Community header band. Fixed proportions (3:1 phone → 4:1 tablet → 5:1 desktop,
 * capped at 180 px) so it never dominates the feed. Built from existing site config
 * (accent colour, logo, site name) — there is no admin-uploaded community banner.
 * Text sits on a dark gradient, so it uses the overlay-text / overlay-meta classes.
 */
export function CommunityBanner({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { config } = useSiteConfig();
  const siteName = config?.siteName ?? "TBT";
  // The admin logo is the white brand mark (see Navbar) — correct on this dark band.
  const logo = config?.logoUrl || "/tbt_logo.webp";

  return (
    <section
      className="relative w-full overflow-hidden rounded-2xl aspect-[3/1] sm:aspect-[4/1] lg:aspect-[5/1] max-h-[180px] min-h-[120px]"
      style={{
        background:
          "radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--color-accent) 70%, #000) 0%, #121212 55%, #0a0a0a 100%)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      {/* Soft accent glow, decorative */}
      <div
        aria-hidden
        className="absolute -right-16 -bottom-24 w-72 h-72 rounded-full blur-3xl opacity-40 pointer-events-none"
        style={{ background: "var(--color-accent)" }}
      />

      <div className="relative h-full flex items-end justify-between gap-4 p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center bg-black/40 border border-white/10 backdrop-blur-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt=""
              className="w-9 sm:w-12 h-auto object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="overlay-text text-xl sm:text-3xl font-black tracking-tight leading-tight">
              Community
            </h1>
            <p className="overlay-meta text-xs sm:text-sm opacity-80 line-clamp-2 sm:truncate">
              {siteName} members sharing wins, questions and lessons
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Link
            href="/community/saved"
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Saved posts"
            title="Saved posts"
          >
            <Bookmark size={18} />
          </Link>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    </section>
  );
}

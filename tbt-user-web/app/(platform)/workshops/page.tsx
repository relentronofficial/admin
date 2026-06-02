"use client";

import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { useMyWorkshops } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { WorkshopListItem } from "@/types";

// ─── Icon resolver ────────────────────────────────────────────────────────────
// Maps API icon-type strings to components; add entries as new types arrive.

function resolveCompletedIcon(iconType: string) {
  switch (iconType) {
    case "checkmark":
      return <CheckCircle2 size={13} className="text-white" />;
    default:
      return <CheckCircle2 size={13} className="text-white" />;
  }
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function WorkshopCard({ item }: { item: WorkshopListItem }) {
  return (
    <Link
      href={`/workshop/${item.slug}`}
      className="group block rounded-xl overflow-hidden bg-card border border-border hover:border-ring/50 transition-colors"
    >
      {/* Thumbnail */}
      <div className="aspect-video relative bg-background">
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={item.title}
            fill
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full" style={{ background: "var(--color-bg-surface)" }} />
        )}

        {/* Enrolled badge — label + color from API */}
        {item.enrolledBadge && (
          <span
            className="absolute top-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded text-white"
            style={{ background: item.enrolledBadge.color }}
          >
            {item.enrolledBadge.label}
          </span>
        )}

        {/* Completed badge — icon type from API, no hardcoded text */}
        {item.completedBadgeIconType && (
          <span
            className="absolute top-2 left-2 flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded text-white"
            style={{ background: "var(--color-success)" }}
          >
            {resolveCompletedIcon(item.completedBadgeIconType)}
          </span>
        )}

        {/* Delivery mode pill — bottom-right, label from API */}
        <span className="absolute bottom-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white/90 bg-black/50 backdrop-blur-sm">
          {item.deliveryModeLabel}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="font-semibold text-sm text-foreground line-clamp-2 group-hover:opacity-80 transition-opacity leading-snug">
          {item.title}
        </h3>
      </div>
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WorkshopsSkeleton() {
  return (
    <div className="space-y-10">
      {[1, 2].map((s) => (
        <div key={s} className="space-y-4">
          <div
            className="h-6 w-40 rounded animate-pulse"
            style={{ background: "var(--color-bg-surface)" }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden animate-pulse"
                style={{ background: "var(--color-bg-surface)" }}
              >
                <div className="aspect-video" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 rounded" style={{ background: "var(--color-bg-primary)" }} />
                  <div className="h-3 w-1/3 rounded" style={{ background: "var(--color-bg-primary)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkshopsPage() {
  const { data, isLoading } = useMyWorkshops();
  const { uiStrings } = useSiteConfig();

  if (isLoading) return <WorkshopsSkeleton />;

  const sections = data?.sections ?? [];

  if (!sections.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground text-sm">{uiStrings?.noWorkshops}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Section label and grid — both from API */}
      {sections.map((section) => (
        <section key={section.id} className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">{section.label}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.items.map((item) => (
              <WorkshopCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

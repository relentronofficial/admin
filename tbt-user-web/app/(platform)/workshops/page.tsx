"use client";

import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { useAllWorkshops } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { WorkshopListItem } from "@/types";

// ─── Card ─────────────────────────────────────────────────────────────────────

function WorkshopCard({ item }: { item: WorkshopListItem }) {
  return (
    <Link
      href={`/workshop/${item.slug}`}
      className="group block rounded-xl overflow-hidden border transition-colors"
      style={{
        background: "var(--color-bg-surface)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      {/* Thumbnail */}
      <div className="aspect-video relative overflow-hidden" style={{ background: "var(--color-bg-primary)" }}>
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={item.title}
            fill
            className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full" style={{ background: "var(--color-bg-surface)" }} />
        )}

        {/* Enrolled badge */}
        {item.enrolledBadge && !item.completedBadgeIconType && (
          <span
            className="absolute top-2 right-2 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: item.enrolledBadge.color }}
          >
            {item.enrolledBadge.label}
          </span>
        )}

        {/* Completed badge */}
        {item.completedBadgeIconType && (
          <span
            className="absolute top-2 right-2 flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: "var(--color-success)" }}
          >
            <CheckCircle2 size={12} className="text-white" />
            Done
          </span>
        )}

        {/* Delivery mode chip */}
        {item.deliveryModeLabel && (
          <span
            className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
            style={{
              background:
                item.deliveryMode === "online"
                  ? "var(--color-success)"
                  : "rgba(0,0,0,0.55)",
              backdropFilter: item.deliveryMode !== "online" ? "blur(4px)" : undefined,
            }}
          >
            {item.deliveryModeLabel}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <h3
          className="font-semibold text-sm line-clamp-2 leading-snug group-hover:opacity-80 transition-opacity"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          {item.title}
        </h3>
      </div>
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WorkshopsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
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
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkshopsPage() {
  const { data: workshops, isLoading } = useAllWorkshops();
  const { uiStrings } = useSiteConfig();

  if (isLoading) return <WorkshopsSkeleton />;

  if (!workshops?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          {uiStrings?.noWorkshops ?? "No workshops available yet."}
        </p>
      </div>
    );
  }

  // Split into enrolled/completed and others for visual grouping
  const enrolled = workshops.filter((w) => w.enrollmentStatus === "active");
  const completed = workshops.filter((w) => w.enrollmentStatus === "completed");
  const available = workshops.filter((w) => !w.enrollmentStatus);

  const groups = [
    enrolled.length > 0 && { label: "My Workshops", items: enrolled },
    completed.length > 0 && { label: "Completed", items: completed },
    available.length > 0 && { label: "All Workshops", items: available },
  ].filter(Boolean) as { label: string; items: WorkshopListItem[] }[];

  // If only one group, skip the label and show flat grid
  if (groups.length === 1) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workshops.map((w) => (
          <WorkshopCard key={w.id} item={w} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map((g) => (
        <section key={g.label} className="space-y-4">
          <h2 className="text-lg font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>
            {g.label}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {g.items.map((w) => (
              <WorkshopCard key={w.id} item={w} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

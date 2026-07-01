"use client";

import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Lock } from "lucide-react";
import { useAllWorkshops } from "@/lib/hooks/useConfig";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { WorkshopListItem } from "@/types";

// ─── Card ─────────────────────────────────────────────────────────────────────

function WorkshopCard({ item, priority }: { item: WorkshopListItem; priority: boolean }) {
  // All workshops are clickable — user browses first, enrolls at detail/player level
  return (
    <Link
      href={`/workshop/${item.slug}`}
      className="group block rounded-xl overflow-hidden border transition-colors"
      style={{
        background: "var(--color-bg-surface)",
        borderColor: "rgba(255,255,255,0.08)",
        opacity: item.locked ? 0.6 : 1,
      }}
    >
      {/* Thumbnail */}
      <div className="aspect-video relative overflow-hidden" style={{ background: "var(--color-bg-primary)" }}>
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={item.title}
            fill
            priority={priority}
            sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) calc(50vw - 32px), calc(33vw - 24px)"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full" style={{ background: "var(--color-bg-surface)" }} />
        )}

        {/* Batch-locked overlay */}
        {item.locked && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
            <Lock size={22} style={{ color: "var(--color-locked, #4a4a4a)" }} />
          </div>
        )}

        {/* Completed badge */}
        {item.completedBadgeIconType && (
          <span
            className="absolute top-2 right-2 flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: "var(--color-success)" }}
          >
            <CheckCircle2 size={12} />
            Done
          </span>
        )}

        {/* Enrolled badge (only when not completed) */}
        {!item.completedBadgeIconType && item.enrolledBadge && (
          <span
            className="absolute top-2 right-2 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: item.enrolledBadge.color }}
          >
            {item.enrolledBadge.label}
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
        {item.locked && (
          <p className="text-[11px] mt-1" style={{ color: "var(--color-locked, #4a4a4a)" }}>
            Not available for your batch
          </p>
        )}
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

  // Show the full catalog as a flat grid — enrolled/completed badges appear on
  // cards as context. Enrollment prompt is handled at the workshop detail/player level.
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {workshops.map((w, i) => (
        <WorkshopCard key={w.id} item={w} priority={i < 3} />
      ))}
    </div>
  );
}

// Server Component — no "use client".
// Workshops data is fetched server-side using the tbt_access cookie so the
// grid HTML arrives in the first byte, eliminating the client-side data waterfall
// that was causing LCP 5.7s.

import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { CheckCircle2, Lock } from "lucide-react";
import type { WorkshopListItem, UiStrings } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Card ─────────────────────────────────────────────────────────────────────

function WorkshopCard({ item, priority }: { item: WorkshopListItem; priority: boolean }) {
  const Wrapper = item.locked ? "div" : Link;
  const wrapperProps = item.locked ? {} : { href: `/workshop/${item.slug}` };

  return (
    <Wrapper
      {...(wrapperProps as any)}
      className={`group block rounded-xl overflow-hidden border transition-colors ${item.locked ? "cursor-default" : ""}`}
      style={{
        background: "var(--color-bg-surface)",
        borderColor: "rgba(255,255,255,0.08)",
        opacity: item.locked ? 0.65 : 1,
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
            className={`object-cover transition-transform duration-300 ${!item.locked ? "group-hover:scale-[1.03]" : ""}`}
          />
        ) : (
          <div className="w-full h-full" style={{ background: "var(--color-bg-surface)" }} />
        )}

        {/* Lock overlay */}
        {item.locked && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
            <Lock size={22} style={{ color: "var(--color-locked, #4a4a4a)" }} />
          </div>
        )}

        {/* Enrolled badge */}
        {!item.locked && item.enrolledBadge && !item.completedBadgeIconType && (
          <span
            className="absolute top-2 right-2 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: item.enrolledBadge.color }}
          >
            {item.enrolledBadge.label}
          </span>
        )}

        {/* Completed badge */}
        {!item.locked && item.completedBadgeIconType && (
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
          className={`font-semibold text-sm line-clamp-2 leading-snug transition-opacity ${!item.locked ? "group-hover:opacity-80" : ""}`}
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
    </Wrapper>
  );
}

// ─── Skeleton (still needed for Suspense boundaries in sibling routes) ─────────

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

// ─── Grid ─────────────────────────────────────────────────────────────────────

function WorkshopsGrid({ workshops }: { workshops: WorkshopListItem[] }) {
  const enrolled  = workshops.filter((w) => w.enrollmentStatus === "active");
  const completed = workshops.filter((w) => w.enrollmentStatus === "completed");
  const available = workshops.filter((w) => !w.enrollmentStatus);

  const groups = [
    enrolled.length  > 0 && { label: "My Workshops", items: enrolled  },
    completed.length > 0 && { label: "Completed",    items: completed },
    available.length > 0 && { label: "All Workshops", items: available },
  ].filter(Boolean) as { label: string; items: WorkshopListItem[] }[];

  if (groups.length === 1) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workshops.map((w, i) => (
          <WorkshopCard key={w.id} item={w} priority={i < 3} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map((g, gi) => (
        <section key={g.label} className="space-y-4">
          <h2 className="text-lg font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>
            {g.label}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {g.items.map((w, i) => (
              <WorkshopCard key={w.id} item={w} priority={gi === 0 && i < 3} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function WorkshopsPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tbt_access")?.value;

  // Both fetches run in parallel. ui-strings uses revalidate so Next.js
  // deduplicates it with the root layout's fetch of the same endpoint.
  const [workshopsResult, uiStringsResult] = await Promise.all([
    accessToken
      ? fetch(`${API_BASE}/api/user/workshops`, {
          headers: { Cookie: `tbt_access=${accessToken}` },
          cache: "no-store", // user-specific — must never be shared across users
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      : null,
    fetch(`${API_BASE}/api/pub/config/ui-strings`, {
      next: { revalidate: 300 },
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const workshops: WorkshopListItem[] = workshopsResult?.data ?? [];
  const uiStrings: UiStrings = uiStringsResult?.data ?? {};

  if (!workshops.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          {uiStrings?.noWorkshops ?? "No workshops available yet."}
        </p>
      </div>
    );
  }

  return <WorkshopsGrid workshops={workshops} />;
}

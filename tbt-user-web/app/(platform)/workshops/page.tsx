import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Lock } from "lucide-react";
import WorkshopsClient from "./WorkshopsClient";
import type { WorkshopListItem } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Server-rendered card (no hooks needed) ───────────────────────────────────

function WorkshopCard({ item, priority }: { item: WorkshopListItem; priority: boolean }) {
  return (
    <Link
      href={`/workshop/${item.slug}`}
      className="group block rounded-xl overflow-hidden border transition-colors"
      style={{
        background: "var(--color-bg-surface)",
        borderColor: "var(--color-border-subtle)",
        opacity: item.locked ? 0.6 : 1,
      }}
    >
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

        {item.locked && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
            <Lock size={22} style={{ color: "var(--color-locked, #4a4a4a)" }} />
          </div>
        )}

        {item.completedBadgeIconType && (
          <span
            className="absolute top-2 right-2 flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: "var(--color-success)" }}
          >
            <CheckCircle2 size={12} />
            Done
          </span>
        )}

        {!item.completedBadgeIconType && item.enrolledBadge && (
          <span
            className="absolute top-2 right-2 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: item.enrolledBadge.color }}
          >
            {item.enrolledBadge.label}
          </span>
        )}

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

      <div className="p-4">
        <h3
          className="font-semibold text-sm line-clamp-2 leading-snug group-hover:opacity-80 transition-opacity text-foreground"
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

// ─── Page (RSC — eliminates client waterfall for LCP) ─────────────────────────

export default async function WorkshopsPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("tbt_access")?.value;

  // No auth token — fall back to client component (handles its own loading state + token refresh)
  if (!accessToken) return <WorkshopsClient />;

  try {
    const res = await fetch(`${API_BASE}/api/user/workshops`, {
      headers: { Cookie: `tbt_access=${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) return <WorkshopsClient />;

    const json = await res.json();
    const workshops: WorkshopListItem[] = json?.data ?? [];

    // Empty list — let client component show the proper uiStrings empty state
    if (!workshops.length) return <WorkshopsClient />;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {workshops.map((w, i) => (
          <WorkshopCard key={w.id} item={w} priority={i < 3} />
        ))}
      </div>
    );
  } catch {
    return <WorkshopsClient />;
  }
}

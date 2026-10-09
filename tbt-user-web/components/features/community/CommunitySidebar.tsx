"use client";

import Link from "next/link";
import { Bookmark, Pencil, Trophy } from "lucide-react";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useLeaderboard } from "@/lib/hooks/useGamification";
import { memberDisplayName } from "@/lib/hooks/useCommunity";
import { MemberAvatar } from "./MemberAvatar";

const cardStyle = {
  background: "var(--color-bg-surface)",
  border: "1px solid var(--color-border-subtle)",
} as const;

// Host shown under the group name (Skool shows "skool.com/<group>"). From env so
// server and client render the same text.
const APP_HOST = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "https://app.tamilbusinesstribe.com",
    ).host;
  } catch {
    return "app.tamilbusinesstribe.com";
  }
})();

/** Right column on desktop: group card + 30-day points leaderboard. */
export function CommunitySidebar({ onCompose }: { onCompose: () => void }) {
  const { config } = useSiteConfig();
  const siteName = config?.siteName ?? "TBT";

  return (
    <aside className="space-y-4">
      {/* Group card */}
      <section className="rounded-2xl p-5 space-y-4" style={cardStyle}>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-foreground leading-snug">
            {siteName} Community
          </h2>
          <p className="text-xs text-muted-foreground">{APP_HOST}/community</p>
        </div>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          A space for members to share wins, ask questions and learn from
          mentors and each other.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCompose}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-accent)" }}
          >
            <Pencil size={13} /> Write a post
          </button>
          <Link
            href="/community/saved"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-foreground transition-colors hover:bg-[var(--color-surface-overlay)]"
            style={{ border: "1px solid var(--color-border-medium)" }}
          >
            <Bookmark size={13} /> Saved
          </Link>
        </div>
      </section>

      <LeaderboardCard />
    </aside>
  );
}

function LeaderboardCard() {
  const { data, isLoading, isError } = useLeaderboard("month", 5);
  const rows = data ?? [];

  return (
    <section className="rounded-2xl p-5 space-y-3" style={cardStyle}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Leaderboard</h2>
        <span className="text-[11px] text-muted-foreground">Last 30 days</span>
      </div>

      {isLoading ? (
        <div className="space-y-2.5" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 rounded-lg animate-pulse"
              style={{ background: "var(--color-surface-overlay)" }}
            />
          ))}
        </div>
      ) : isError ? (
        <p className="text-xs text-muted-foreground">
          Leaderboard is unavailable right now.
        </p>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Trophy size={14} /> No points earned in the last 30 days yet.
        </div>
      ) : (
        <ol className="space-y-1">
          {rows.map((r) => (
            <li
              key={r.memberId}
              className="flex items-center gap-3 px-2 py-1.5 rounded-lg"
              style={
                r.isMe
                  ? {
                      background:
                        "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                    }
                  : undefined
              }
            >
              <span className="w-4 text-xs font-bold text-muted-foreground tabular-nums text-right">
                {r.rank}
              </span>
              <MemberAvatar member={r.member} size={28} />
              <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                {memberDisplayName(r.member)}
                {r.isMe && (
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    (you)
                  </span>
                )}
              </span>
              <span
                className="text-xs font-bold tabular-nums"
                style={{ color: "var(--color-accent)" }}
              >
                +{r.totalPoints}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

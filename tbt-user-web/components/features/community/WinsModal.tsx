"use client";

import { useState, useEffect } from "react";
import { X, Crown, Trophy } from "lucide-react";
import type { LeaderboardPeriod } from "@/lib/hooks/useGamification";
import { useLeaderboard } from "@/lib/hooks/useGamification";
import { memberDisplayName } from "@/lib/hooks/useCommunity";
import { MemberAvatar } from "./MemberAvatar";

interface WinsModalProps {
  open: boolean;
  onClose: () => void;
}

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "week", label: "THIS WEEK" },
  { value: "month", label: "THIS MONTH" },
  { value: "all", label: "ALL TIME" },
];

const MEDAL_COLORS: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
};

const PEDESTAL_HEIGHTS: Record<number, number> = { 1: 90, 2: 68, 3: 52 };
const AVATAR_SIZES: Record<number, number> = { 1: 72, 2: 56, 3: 56 };

function formatPoints(n: number): string {
  return n.toLocaleString("en-IN");
}

export function WinsModal({ open, onClose }: WinsModalProps) {
  if (!open) return null;
  return <WinsModalContent onClose={onClose} />;
}

function WinsModalContent({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("month");
  const { data, isLoading } = useLeaderboard(period, 50);
  const rows = data ?? [];
  const top3 = rows.filter((r) => r.rank <= 3);
  const rest = rows.filter((r) => r.rank > 3);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Podium order: rank2 left, rank1 center, rank3 right
  const podiumOrder = [
    top3.find((r) => r.rank === 2),
    top3.find((r) => r.rank === 1),
    top3.find((r) => r.rank === 3),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Leaderboard"
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "var(--color-modal-bg, #181818)" }}
      >
        {/* Header */}
        <div
          className="relative flex items-center justify-center py-5 px-6 shrink-0"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 80%, #000) 0%, color-mix(in srgb, var(--color-accent) 40%, #000) 100%)",
          }}
        >
          <Trophy
            size={20}
            className="mr-2"
            style={{ color: "#FFD700" }}
          />
          <h2
            className="text-xl font-black uppercase"
            style={{ color: "#fff", letterSpacing: "0.25em" }}
          >
            WINS
          </h2>
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-opacity hover:opacity-70"
            style={{ color: "rgba(255,255,255,0.8)" }}
            aria-label="Close leaderboard"
          >
            <X size={18} />
          </button>
        </div>

        {/* Period selector */}
        <div className="flex gap-2 px-4 pt-4 pb-1 shrink-0">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-black tracking-widest transition-all"
              style={
                period === p.value
                  ? { background: "var(--color-accent)", color: "#fff" }
                  : {
                      background: "var(--color-surface-overlay)",
                      color: "var(--color-text-subtle)",
                    }
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div
                className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "var(--color-accent)" }}
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Trophy
                size={36}
                style={{ color: "var(--color-text-subtle)", opacity: 0.4 }}
              />
              <p
                className="text-sm"
                style={{ color: "var(--color-text-subtle)" }}
              >
                No rankings yet for this period.
              </p>
            </div>
          ) : (
            <>
              {/* Podium — top 3 */}
              {top3.length > 0 && (
                <div className="flex items-end justify-center gap-3 px-6 pt-6 pb-2">
                  {podiumOrder.map((entry, idx) => {
                    if (!entry) {
                      return (
                        <div key={`empty-${idx}`} className="flex-1" />
                      );
                    }
                    const rank = entry.rank;
                    const color = MEDAL_COLORS[rank] ?? "#888";
                    const pedestalH = PEDESTAL_HEIGHTS[rank] ?? 52;
                    const avatarSize = AVATAR_SIZES[rank] ?? 48;
                    const firstName = memberDisplayName(entry.member).split(" ")[0];

                    return (
                      <div
                        key={entry.memberId}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        {/* Crown for #1 */}
                        {rank === 1 && (
                          <Crown
                            size={20}
                            fill="#FFD700"
                            style={{ color: "#FFD700" }}
                          />
                        )}

                        {/* Avatar ring */}
                        <div
                          className="rounded-full p-0.5"
                          style={{ border: `2.5px solid ${color}` }}
                        >
                          <MemberAvatar
                            member={entry.member}
                            size={avatarSize}
                          />
                        </div>

                        {/* Name */}
                        <span
                          className="text-[11px] font-bold text-center truncate w-full px-1"
                          style={{
                            color: entry.isMe
                              ? "var(--color-accent)"
                              : "var(--color-text-normal)",
                          }}
                        >
                          {entry.isMe ? "YOU" : firstName}
                        </span>

                        {/* Points */}
                        <span
                          className="text-[10px] font-black tabular-nums"
                          style={{ color }}
                        >
                          {formatPoints(entry.totalPoints)} pts
                        </span>

                        {/* Pedestal */}
                        <div
                          className="w-full rounded-t-lg mt-1 flex items-center justify-center"
                          style={{
                            height: pedestalH,
                            background: `color-mix(in srgb, ${color} 18%, var(--color-surface-overlay))`,
                            borderTop: `2px solid ${color}`,
                          }}
                        >
                          <span
                            className="text-lg font-black"
                            style={{ color }}
                          >
                            #{rank}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ranked list: 4+ */}
              {rest.length > 0 && (
                <div className="px-4 pb-4 pt-2 space-y-1">
                  {rest.map((r) => (
                    <div
                      key={r.memberId}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={
                        r.isMe
                          ? {
                              background:
                                "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                              border:
                                "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
                            }
                          : {
                              background: "var(--color-surface-overlay-xs)",
                            }
                      }
                    >
                      <span
                        className="w-7 text-xs font-black tabular-nums text-center shrink-0"
                        style={{ color: "var(--color-text-subtle)" }}
                      >
                        #{r.rank}
                      </span>
                      <MemberAvatar member={r.member} size={34} />
                      <span
                        className="flex-1 min-w-0 truncate text-sm font-medium"
                        style={{
                          color: r.isMe
                            ? "var(--color-accent)"
                            : "var(--color-text-normal)",
                        }}
                      >
                        {r.isMe ? "YOU" : memberDisplayName(r.member)}
                      </span>
                      {r.isMe && (
                        <span
                          className="text-[10px] font-black px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background:
                              "color-mix(in srgb, var(--color-accent) 20%, transparent)",
                            color: "var(--color-accent)",
                          }}
                        >
                          YOU
                        </span>
                      )}
                      <span
                        className="text-xs font-black tabular-nums shrink-0"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {formatPoints(r.totalPoints)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ChatGroupMemberRef } from "@/lib/api/services/chatGroups.service";

interface ReactionEntry {
  emoji: string;
  memberId: string;
  /** Enriched by backend since Phase 5 — may be null for older payloads. */
  memberName?: string | null;
  profilePhotoUrl?: string | null;
}

interface ReactorsSheetProps {
  reactions: ReactionEntry[];
  /** Legacy fallback lookup for older reaction payloads without memberName. */
  members: ChatGroupMemberRef[];
  /**
   * The emoji that should be preselected when the sheet opens (i.e.
   * the one the user tapped). If null, "All" tab is shown.
   */
  initialEmoji?: string | null;
  onClose: () => void;
}

/**
 * Bottom sheet listing which group members reacted with each emoji.
 * Uses the client-side `reactions` array from the message payload —
 * no extra fetch is needed.
 */
export function ReactorsSheet({ reactions, members, initialEmoji, onClose }: ReactorsSheetProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of reactions) {
      const arr = map.get(r.emoji) ?? [];
      arr.push(r.memberId);
      map.set(r.emoji, arr);
    }
    return Array.from(map.entries());
  }, [reactions]);

  const tabs = useMemo(
    () => [{ emoji: "all" as const, memberIds: reactions.map((r) => r.memberId) }, ...grouped.map(([emoji, memberIds]) => ({ emoji, memberIds }))],
    [grouped, reactions],
  );

  const [activeTab, setActiveTab] = useState<string>(initialEmoji ?? "all");
  const active = tabs.find((t) => t.emoji === activeTab) ?? tabs[0];
  // De-duplicate members (someone can react with the same emoji only
  // once; but "all" tab may contain the same member multiple times
  // across different emojis — still show once per emoji).
  const displayList = useMemo(() => {
    const list = active?.memberIds ?? [];
    if (active?.emoji === "all") {
      // For the "all" tab, group by member so each shows all emojis they reacted with.
      const byMember = new Map<string, string[]>();
      for (const r of reactions) {
        const arr = byMember.get(r.memberId) ?? [];
        arr.push(r.emoji);
        byMember.set(r.memberId, arr);
      }
      return Array.from(byMember.entries()).map(([memberId, emojis]) => ({ memberId, emojis }));
    }
    return list.map((memberId) => ({ memberId, emojis: [active?.emoji ?? ""] }));
  }, [active, reactions]);

  function memberById(id: string) {
    return members.find((m) => m.id === id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md max-h-[70vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-medium)",
        }}
      >
        <div
          className="flex items-center justify-between p-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <h3 className="text-base font-bold text-foreground">Reactions</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div
          className="px-3 py-2 flex-shrink-0 flex gap-2 overflow-x-auto"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          {tabs.map((t) => {
            const label = t.emoji === "all" ? `All ${reactions.length}` : `${t.emoji} ${t.memberIds.length}`;
            const isActive = t.emoji === active?.emoji;
            return (
              <button
                key={t.emoji}
                onClick={() => setActiveTab(t.emoji)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-colors"
                style={{
                  background: isActive ? "var(--color-accent)" : "var(--color-bg-surface)",
                  color: isActive ? "white" : "var(--color-text-secondary)",
                  border: `1px solid ${isActive ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {displayList.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">No reactions.</div>
          ) : (
            displayList.map(({ memberId, emojis }) => {
              // Prefer the enriched fields on the reaction itself (Phase 5
              // backend); fall back to the group's member roster if the
              // reaction was posted before enrichment shipped.
              const reactorReactions = reactions.filter((r) => r.memberId === memberId);
              const enrichedName = reactorReactions.find((r) => r.memberName)?.memberName ?? null;
              const enrichedPhoto = reactorReactions.find((r) => r.profilePhotoUrl)?.profilePhotoUrl ?? null;
              const m = memberById(memberId);
              const name =
                enrichedName ??
                (m
                  ? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || "Member"
                  : "Member");
              const photo = enrichedPhoto ?? m?.profilePhotoUrl ?? null;
              return (
                <div
                  key={memberId}
                  className="flex items-center gap-3 p-2 rounded-xl"
                  style={{ background: "var(--color-bg-surface)" }}
                >
                  <div
                    className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                    style={{ background: "var(--color-accent)" }}
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-white">
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{name}</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {emojis.map((e, i) => (
                      <span key={`${e}-${i}`} className="text-base">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

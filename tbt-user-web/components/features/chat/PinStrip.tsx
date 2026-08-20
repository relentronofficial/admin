"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pin } from "lucide-react";
import type { PinnedMessage } from "@/lib/api/services/chatGroups.service";

interface PinStripProps {
  pinned: PinnedMessage[];
  onJumpTo: (messageId: string) => void;
}

/**
 * Small strip that sits below the chat header when the group has any
 * pinned messages. Shows the first pinned message as a compact preview;
 * clicking scrolls the message list to it. If there are multiple pinned
 * messages, a small caret toggles a scrollable list.
 */
export function PinStrip({ pinned, onJumpTo }: PinStripProps) {
  const [expanded, setExpanded] = useState(false);
  if (pinned.length === 0) return null;

  const first = pinned[0];
  const preview =
    first.body ||
    (first.mediaType ? `\u{1F4CE} ${first.mediaType}` : "…");
  const senderName =
    [first.sender?.firstName, first.sender?.lastName].filter(Boolean).join(" ") || "Member";

  return (
    <div
      className="flex-shrink-0"
      style={{
        background: "color-mix(in srgb, var(--color-accent) 6%, var(--color-bg-surface))",
        borderLeft: "1px solid var(--color-border-subtle)",
        borderRight: "1px solid var(--color-border-subtle)",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (pinned.length > 1) {
            setExpanded((v) => !v);
          } else {
            onJumpTo(first.id);
          }
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-surface-overlay)] transition-colors"
      >
        <Pin size={13} style={{ color: "var(--color-accent)" }} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
            Pinned{pinned.length > 1 ? ` · ${pinned.length}` : ""}
          </div>
          <div className="text-xs text-foreground truncate">
            <span className="font-semibold">{senderName}: </span>
            {preview}
          </div>
        </div>
        {pinned.length > 1 &&
          (expanded ? (
            <ChevronUp size={14} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={14} className="text-muted-foreground" />
          ))}
      </button>

      {expanded && pinned.length > 1 && (
        <div
          className="max-h-40 overflow-y-auto"
          style={{ borderTop: "1px solid var(--color-border-subtle)" }}
        >
          {pinned.slice(1).map((m) => {
            const text = m.body || (m.mediaType ? `\u{1F4CE} ${m.mediaType}` : "…");
            const sName =
              [m.sender?.firstName, m.sender?.lastName].filter(Boolean).join(" ") || "Member";
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onJumpTo(m.id);
                  setExpanded(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-surface-overlay)] transition-colors"
              >
                <Pin size={11} className="text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold" style={{ color: "var(--color-accent)" }}>
                    {sName}
                  </div>
                  <div className="text-xs text-foreground truncate">{text}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

/**
 * Parse post/comment content and render #hashtags and @mentions as
 * clickable links. Falls back to plain text for everything else so
 * a runaway parser can't crash the feed row.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const router = useRouter();

  const parts = useMemo(() => {
    if (!text) return [];
    // Split around #tag and @mention tokens while keeping the tokens themselves.
    const tokens = text.split(/(#[A-Za-z0-9_]+|@[A-Za-z0-9._]+)/g);
    return tokens.filter(Boolean);
  }, [text]);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.startsWith("#")) {
          const tag = part.slice(1);
          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/community/hashtag/${encodeURIComponent(tag)}`);
              }}
              className="font-semibold hover:underline"
              style={{ color: "var(--color-accent)" }}
            >
              {part}
            </button>
          );
        }
        if (part.startsWith("@")) {
          return (
            <span
              key={idx}
              className="font-semibold"
              style={{ color: "var(--color-accent)" }}
            >
              {part}
            </span>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
}

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Highlighter, Loader2 } from "lucide-react";

import { useAllHighlights } from "@/lib/hooks/useEbooks";
import type { EbookHighlight } from "@/types";

const HIGHLIGHT_HEX: Record<string, string> = {
  yellow: "#facc15",
  green: "#4ade80",
  blue: "#60a5fa",
  pink: "#f472b6",
  orange: "#fb923c",
};

export default function MyHighlightsPage() {
  const { data: highlights = [], isLoading, isError } = useAllHighlights();

  const groups = useMemo(() => {
    // Group highlights by bookId while preserving newest-first order.
    const byBook = new Map<string, EbookHighlight[]>();
    for (const h of highlights) {
      const arr = byBook.get(h.bookId) ?? [];
      arr.push(h);
      byBook.set(h.bookId, arr);
    }
    return Array.from(byBook.entries()).map(([bookId, list]) => {
      const sorted = [...list].sort((a, b) => a.pageNumber - b.pageNumber);
      return { bookId, book: list[0].book, highlights: sorted };
    });
  }, [highlights]);

  return (
    <div className="max-w-3xl mx-auto pb-16 space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/ebooks"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">My highlights</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> Loading…
        </div>
      ) : isError ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Could not load highlights.
        </div>
      ) : groups.length === 0 ? (
        <div
          className="p-10 rounded-2xl text-center space-y-2"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <Highlighter size={30} className="mx-auto text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            No highlights yet — save your first passage from inside a book&apos;s reader.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ bookId, book, highlights: bookHighlights }) => (
            <section key={bookId} className="space-y-3">
              <Link
                href={`/ebooks/book/${bookId}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-surface-overlay)]"
                style={{
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                {book?.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={book.coverImage}
                    alt=""
                    className="w-12 h-16 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-16 rounded flex-shrink-0 flex items-center justify-center" style={{ background: "var(--color-surface-overlay)" }}>
                    <BookOpen size={16} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">
                    {book?.title ?? "Book"}
                  </div>
                  {book?.author && (
                    <div className="text-xs text-muted-foreground truncate">{book.author}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {bookHighlights.length} highlight
                    {bookHighlights.length === 1 ? "" : "s"}
                  </div>
                </div>
              </Link>

              <div className="space-y-2 pl-4">
                {bookHighlights.map((h) => {
                  const hex = HIGHLIGHT_HEX[h.highlightColor] ?? "#facc15";
                  return (
                    <Link
                      key={h.id}
                      href={`/ebooks/book/${bookId}/read`}
                      className="block rounded-lg p-3 space-y-1.5 text-xs"
                      style={{
                        background: `color-mix(in srgb, ${hex} 6%, transparent)`,
                        borderLeft: `3px solid ${hex}`,
                      }}
                    >
                      <div className="text-[10px] font-bold tracking-wider" style={{ color: hex }}>
                        PAGE {h.pageNumber}
                      </div>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                        &ldquo;{h.selectedText}&rdquo;
                      </p>
                      {h.notes && (
                        <p className="text-muted-foreground italic">{h.notes}</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

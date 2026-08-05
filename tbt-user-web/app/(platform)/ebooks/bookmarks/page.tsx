"use client";

import Link from "next/link";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";

import { useBookmarks } from "@/lib/hooks/useEbooks";
import { BookCard } from "@/components/features/ebooks/BookCard";

export default function EbookBookmarksPage() {
  const { data: items = [], isLoading, isError } = useBookmarks();

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/ebooks"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Bookmarks</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> Loading…
        </div>
      ) : isError ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Could not load bookmarks.
        </div>
      ) : items.length === 0 ? (
        <div
          className="p-10 rounded-2xl text-center space-y-2"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <Bookmark size={30} className="mx-auto text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            No bookmarks yet — tap the bookmark icon on any book.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((i) => (
            <div key={i.id} className="space-y-1.5">
              <BookCard book={i.book} size="md" />
              {i.pageNumber != null && (
                <div className="text-[10px] text-muted-foreground text-center">
                  Page {i.pageNumber}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

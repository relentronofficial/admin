"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, Flame, Highlighter, Loader2, Search } from "lucide-react";

import {
  useContinueReading,
  useEbookBanners,
  useEbookCategories,
  useEbookLibrary,
  useFeaturedEbooks,
  useReadingStreak,
  useTrendingEbooks,
} from "@/lib/hooks/useEbooks";
import type { Ebook } from "@/types";

import { BookCard, BookRow } from "@/components/features/ebooks/BookCard";

export default function EbooksLibraryPage() {
  const { data: banners = [] } = useEbookBanners();
  const { data: categories = [] } = useEbookCategories();
  const { data: featured = [] } = useFeaturedEbooks();
  const { data: trending = [] } = useTrendingEbooks(10);
  const { data: streak } = useReadingStreak();
  const { data: continueItems = [] } = useContinueReading();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: library, isLoading: libLoading } = useEbookLibrary({
    limit: 24,
    category: selectedCategory || undefined,
    search: search || undefined,
  });

  const activeCategories = useMemo(
    () => categories.filter((c) => c.status === "active"),
    [categories],
  );

  const continueReadingBooks: Ebook[] = continueItems.map((c) => ({
    ...c.book,
    progress: {
      currentPage: c.currentPage,
      totalPages: c.totalPages,
      progressPercentage: c.progressPercentage,
      completed: c.completed,
      updatedAt: c.updatedAt,
    },
  }));

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read, bookmark, and highlight books from Tamil Business Tribe.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {streak && streak.currentStreak > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: "color-mix(in srgb, #f59e0b 8%, transparent)",
                border: "1px solid color-mix(in srgb, #f59e0b 30%, transparent)",
              }}
            >
              <Flame size={16} style={{ color: "#f59e0b" }} fill="#f59e0b" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground leading-none">
                  {streak.currentStreak}-day streak
                </span>
                {streak.longestStreak > streak.currentStreak && (
                  <span className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                    longest {streak.longestStreak}
                  </span>
                )}
              </div>
            </div>
          )}

          <Link
            href="/ebooks/bookmarks"
            className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
            }}
            aria-label="Bookmarks"
          >
            <Bookmark size={16} />
          </Link>
          <Link
            href="/ebooks/highlights"
            className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
            }}
            aria-label="My highlights"
          >
            <Highlighter size={16} />
          </Link>
        </div>
      </div>

      {/* Banners */}
      {banners.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {banners.map((b) => (
            <div
              key={b.id}
              className="relative flex-shrink-0 w-[85%] sm:w-[70%] max-w-2xl aspect-[16/6] rounded-2xl overflow-hidden"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              {b.backgroundImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.backgroundImage}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
              <div className="relative h-full flex flex-col justify-end p-5">
                <h3 className="overlay-text text-lg sm:text-xl font-bold leading-tight">
                  {b.title}
                </h3>
                {b.subtitle && (
                  <p className="overlay-meta text-sm mt-1">{b.subtitle}</p>
                )}
                {b.buttonText && b.buttonLink && (
                  <a
                    href={b.buttonLink}
                    className="mt-3 self-start px-4 py-2 rounded-lg text-xs font-bold text-white"
                    style={{ background: "var(--color-accent)" }}
                  >
                    {b.buttonText}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Continue reading */}
      {continueReadingBooks.length > 0 && (
        <BookRow title="Continue reading" books={continueReadingBooks} size="md" />
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <BookRow title="Featured" books={featured} size="md" />
      )}

      {/* Trending */}
      {trending.length > 0 && (
        <BookRow title="Trending" books={trending} size="md" />
      )}

      {/* Search + Category filter + full library */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm sm:text-base font-bold text-foreground">All books</h2>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search library…"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-foreground outline-none"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-subtle)",
              }}
            />
          </div>
        </div>

        {activeCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <CategoryChip
              label="All"
              selected={!selectedCategory}
              onClick={() => setSelectedCategory(null)}
            />
            {activeCategories.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.name}
                selected={selectedCategory === c.slug || selectedCategory === c.id}
                onClick={() => setSelectedCategory(c.slug)}
              />
            ))}
          </div>
        )}

        {libLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading library…
          </div>
        ) : (library?.books ?? []).length === 0 ? (
          <div
            className="p-8 rounded-2xl text-center text-sm text-muted-foreground"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            {search || selectedCategory
              ? "No books match this filter yet."
              : "No books in the library yet."}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {(library?.books ?? []).map((b) => (
              <BookCard key={b.id} book={b} size="md" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CategoryChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors"
      style={{
        color: selected ? "#fff" : "var(--color-text-secondary)",
        background: selected ? "var(--color-accent)" : "var(--color-bg-surface)",
        border: `1px solid ${
          selected ? "var(--color-accent)" : "var(--color-border-subtle)"
        }`,
      }}
    >
      {label}
    </button>
  );
}

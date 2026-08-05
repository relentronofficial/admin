"use client";

import Link from "next/link";
import { BookOpen, Lock, Star } from "lucide-react";

import type { Ebook } from "@/types";
import { cn } from "@/lib/utils/cn";

export interface BookCardProps {
  book: Ebook;
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
  showAuthor?: boolean;
}

const SIZE_MAP: Record<
  NonNullable<BookCardProps["size"]>,
  { width: string; cover: string; title: string; footer: string }
> = {
  sm: {
    width: "w-32 sm:w-36",
    cover: "aspect-[2/3]",
    title: "text-xs",
    footer: "text-[10px]",
  },
  md: {
    width: "w-40 sm:w-44",
    cover: "aspect-[2/3]",
    title: "text-sm",
    footer: "text-[11px]",
  },
  lg: {
    width: "w-48 sm:w-56",
    cover: "aspect-[2/3]",
    title: "text-base",
    footer: "text-xs",
  },
};

export function BookCard({
  book,
  size = "md",
  showProgress = true,
  showAuthor = true,
}: BookCardProps) {
  const s = SIZE_MAP[size];
  const author = book.authorRef?.name ?? book.author;
  const progressPct = book.progress?.progressPercentage ?? 0;

  return (
    <Link
      href={`/ebooks/book/${book.id}`}
      className={cn("group block flex-shrink-0", s.width)}
    >
      <div
        className={cn("relative rounded-xl overflow-hidden", s.cover)}
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        {book.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverImage}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={36} className="text-muted-foreground opacity-30" />
          </div>
        )}

        {/* Locked overlay */}
        {book.locked && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: "color-mix(in srgb, #4a4a4a 40%, transparent)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <Lock size={18} className="text-white" />
            </div>
          </div>
        )}

        {/* Badges */}
        {book.isFeatured && !book.locked && (
          <div
            className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
            style={{
              color: "var(--color-accent)",
              background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
              backdropFilter: "blur(4px)",
              border: "1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)",
            }}
          >
            Featured
          </div>
        )}
        {book.series && !book.locked && book.seriesNumber != null && (
          <div
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider text-white"
            style={{
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
            }}
          >
            Part {book.seriesNumber}
          </div>
        )}

        {/* Rating pill */}
        {book.averageRating && book.averageRating > 0 && (
          <div
            className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded flex items-center gap-0.5 text-[10px] font-bold text-white"
            style={{
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(4px)",
            }}
          >
            <Star size={9} fill="#facc15" color="#facc15" />
            {book.averageRating.toFixed(1)}
          </div>
        )}

        {/* Progress bar */}
        {showProgress && progressPct > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, progressPct)}%`,
                background: "var(--color-accent)",
              }}
            />
          </div>
        )}
      </div>

      <div className="mt-2 space-y-0.5">
        <div className={cn("font-bold text-foreground line-clamp-2 leading-tight", s.title)}>
          {book.title}
        </div>
        {showAuthor && author && (
          <div className={cn("text-muted-foreground line-clamp-1", s.footer)}>
            {author}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Horizontal book row ─────────────────────────────────────────────────────

export function BookRow({
  title,
  books,
  href,
  emptyLabel,
  size = "md",
}: {
  title: string;
  books: Ebook[];
  href?: string;
  emptyLabel?: string;
  size?: BookCardProps["size"];
}) {
  if (books.length === 0 && emptyLabel === undefined) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm sm:text-base font-bold text-foreground">{title}</h2>
        {href && books.length > 0 && (
          <Link
            href={href}
            className="text-[11px] font-bold tracking-wider"
            style={{ color: "var(--color-accent)" }}
          >
            VIEW ALL →
          </Link>
        )}
      </div>
      {books.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3">{emptyLabel}</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {books.map((b) => (
            <BookCard key={b.id} book={b} size={size} />
          ))}
        </div>
      )}
    </section>
  );
}

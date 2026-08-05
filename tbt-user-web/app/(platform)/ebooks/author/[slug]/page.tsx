"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, User } from "lucide-react";

import { useEbookAuthor } from "@/lib/hooks/useEbooks";
import { BookCard } from "@/components/features/ebooks/BookCard";

export default function EbookAuthorPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const { data, isLoading, isError } = useEbookAuthor(slug);

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/ebooks"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Author</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 size={18} className="animate-spin mr-2" /> Loading author…
        </div>
      ) : isError || !data ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Could not load this author.
        </div>
      ) : (
        <>
          <div className="flex items-start gap-4">
            {data.author.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.author.photoUrl}
                alt={data.author.name}
                className="w-24 h-24 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex-shrink-0 flex items-center justify-center text-white text-3xl font-bold"
                style={{ background: "var(--color-accent)" }}
              >
                {data.author.name.slice(0, 1).toUpperCase() || (
                  <User size={26} />
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground">{data.author.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {data.books.length} book{data.books.length === 1 ? "" : "s"} on TBT
              </p>
              {data.author.bio && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed whitespace-pre-wrap">
                  {data.author.bio}
                </p>
              )}
            </div>
          </div>

          {data.books.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              This author has no books yet.
            </p>
          ) : (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-foreground">Books</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {data.books.map((b) => (
                  <BookCard key={b.id} book={b} size="md" />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

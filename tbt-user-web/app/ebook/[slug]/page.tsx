import { BookOpen, Download, User, Clock, XCircle } from "lucide-react";

interface EbookPreview {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  author: string | null;
  coverImage: string | null;
  readingTime: string | null;
  totalPages: number;
  publishDate: string;
  category?: { name: string } | null;
  authorRef?: {
    name: string;
    slug: string;
    photoUrl: string | null;
  } | null;
  series?: { title: string; slug: string } | null;
  seriesNumber?: number | null;
}

async function fetchEbook(slug: string): Promise<EbookPreview | null> {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(
      `${api}/api/pub/ebooks/${encodeURIComponent(slug)}`,
      // Public endpoint sends its own Cache-Control (10min fresh, 1h SWR);
      // give Next matching ISR so a hot preview link stays fast without
      // going stale for hours.
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export default async function EbookPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await fetchEbook(slug);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{ background: "var(--color-bg-primary, #0f0f0f)" }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border overflow-hidden"
        style={{
          borderColor: book
            ? "color-mix(in srgb, var(--color-accent) 40%, transparent)"
            : "#333",
          background: "var(--color-bg-surface, #181818)",
        }}
      >
        {/* Header strip */}
        <div
          className="px-8 py-5 flex items-center gap-3"
          style={{
            background: book
              ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
              : "color-mix(in srgb, #ef4444 8%, transparent)",
            borderBottom:
              "1px solid " +
              (book
                ? "color-mix(in srgb, var(--color-accent) 25%, transparent)"
                : "color-mix(in srgb, #ef4444 25%, transparent)"),
          }}
        >
          {book ? (
            <BookOpen size={28} style={{ color: "var(--color-accent)" }} />
          ) : (
            <XCircle size={28} className="text-red-500" />
          )}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Tamil Business Tribe · E-Book
            </p>
            <h1 className="text-lg font-bold text-foreground leading-tight">
              {book ? book.title : "Book not found"}
            </h1>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-8">
          {book ? (
            <div className="flex flex-col md:flex-row gap-6">
              {book.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.coverImage}
                  alt=""
                  className="w-40 h-52 object-cover rounded-lg self-center md:self-start shadow-lg shrink-0"
                />
              )}
              <div className="flex-1 min-w-0 space-y-3">
                {book.series && book.seriesNumber != null && (
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Part {book.seriesNumber} of the{" "}
                    <span className="text-foreground font-medium">
                      {book.series.title}
                    </span>{" "}
                    series
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  {(book.authorRef?.name || book.author) && (
                    <span className="flex items-center gap-1.5">
                      <User size={13} />
                      <span className="text-foreground">
                        {book.authorRef?.name ?? book.author}
                      </span>
                    </span>
                  )}
                  {book.readingTime && (
                    <span className="flex items-center gap-1.5">
                      <Clock size={13} />
                      <span>{book.readingTime}</span>
                    </span>
                  )}
                  {book.totalPages > 0 && (
                    <span>{book.totalPages} pages</span>
                  )}
                </div>
                {book.category?.name && (
                  <span
                    className="inline-block text-[11px] uppercase tracking-widest font-bold px-2 py-1 rounded"
                    style={{
                      color: "var(--color-accent)",
                      background:
                        "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                    }}
                  >
                    {book.category.name}
                  </span>
                )}
                {book.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed pt-2">
                    {book.description}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4 py-4">
              <p className="text-muted-foreground text-sm leading-relaxed">
                This book link is invalid, has been unpublished, or is
                restricted to specific batches. If you were expecting to see a
                book here, open the Tamil Business Tribe app and browse the
                library directly.
              </p>
            </div>
          )}
        </div>

        {/* Footer / CTA */}
        <div
          className="px-8 py-5 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          style={{
            background:
              "color-mix(in srgb, var(--color-bg-primary, #0f0f0f) 60%, transparent)",
          }}
        >
          <span className="text-xs text-muted-foreground">
            app.tamilbusinesstribe.com
          </span>
          <a
            href="https://app.tamilbusinesstribe.com/tbt"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
            style={{ background: "var(--color-accent)" }}
          >
            <Download size={14} /> Open in TBT app
          </a>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await fetchEbook(slug);
  if (!book) return { title: "E-Book — Tamil Business Tribe" };
  const authorLine = book.authorRef?.name ?? book.author;
  return {
    title: `${book.title} — Tamil Business Tribe`,
    description: authorLine
      ? `${book.title} by ${authorLine} on Tamil Business Tribe.`
      : `${book.title} on Tamil Business Tribe.`,
    openGraph: {
      title: book.title,
      description: authorLine
        ? `${book.title} by ${authorLine}`
        : book.title,
      images: book.coverImage ? [book.coverImage] : undefined,
    },
  };
}

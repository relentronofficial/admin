"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  Clock,
  Layers,
  Loader2,
  Lock,
  Play,
  Star,
  User,
} from "lucide-react";

import {
  useEbook,
  useEbookReviews,
  useSubmitReview,
  useToggleBookmark,
} from "@/lib/hooks/useEbooks";
import { useMe } from "@/lib/hooks/useUser";
import type { EbookReview } from "@/types";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

import { BookCard } from "@/components/features/ebooks/BookCard";

export default function EbookDetailPage() {
  const params = useParams<{ id: string }>();
  const bookId = params?.id ?? "";
  const { data: book, isLoading, isError } = useEbook(bookId);
  const toggleBookmark = useToggleBookmark();
  const { data: reviews = [] } = useEbookReviews(bookId);

  const [reviewOpen, setReviewOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-16 text-muted-foreground text-sm">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <p className="text-sm text-muted-foreground">Book not found.</p>
        <Link
          href="/ebooks"
          className="inline-block mt-4 px-4 py-2 rounded-xl text-xs font-bold text-foreground"
          style={{ border: "1px solid var(--color-border-subtle)" }}
        >
          Back to Library
        </Link>
      </div>
    );
  }

  const author = book.authorRef?.name ?? book.author;
  const isBookmarked = !!book.bookmark;
  const canRead = !!(book.pdfUrl || book.contentUrl) && !book.locked;
  const progressPct = book.progress?.progressPercentage ?? 0;

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-6">
      {/* Back */}
      <div className="flex items-center gap-2">
        <Link
          href="/ebooks"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-overlay)]"
          aria-label="Back to library"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </Link>
        <span className="text-xs text-muted-foreground">Library / {book.title}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6">
        <div
          className="w-40 sm:w-48 mx-auto md:mx-0 aspect-[2/3] rounded-2xl overflow-hidden flex-shrink-0"
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
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen size={40} className="text-muted-foreground opacity-30" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          {book.category?.name && (
            <span
              className="inline-block text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded"
              style={{
                color: "var(--color-accent)",
                background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
              }}
            >
              {book.category.name}
            </span>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
            {book.title}
          </h1>
          {author && (
            <div className="flex items-center gap-2 text-sm">
              <User size={14} className="text-muted-foreground" />
              {book.authorRef ? (
                <Link
                  href={`/ebooks/author/${encodeURIComponent(book.authorRef.slug)}`}
                  className="text-foreground font-semibold hover:underline"
                >
                  {book.authorRef.name}
                </Link>
              ) : (
                <span className="text-foreground font-semibold">{author}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
            {book.readingTime && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> {book.readingTime}
              </span>
            )}
            {book.totalPages > 0 && <span>{book.totalPages} pages</span>}
            {book.averageRating != null && book.averageRating > 0 && (
              <span className="flex items-center gap-1 text-foreground">
                <Star size={12} fill="#facc15" color="#facc15" />
                {book.averageRating.toFixed(1)} ({book.reviewCount ?? 0} review
                {(book.reviewCount ?? 0) === 1 ? "" : "s"})
              </span>
            )}
          </div>

          {progressPct > 0 && (
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--color-bg-surface)" }}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(100, progressPct)}%`,
                    background: "var(--color-accent)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            {canRead ? (
              <Link
                href={`/ebooks/book/${book.id}/read`}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: "var(--color-accent)" }}
              >
                {progressPct > 0 ? (
                  <>
                    <Play size={14} fill="#fff" /> Continue reading
                  </>
                ) : (
                  <>
                    <BookOpen size={14} /> Start reading
                  </>
                )}
              </Link>
            ) : book.locked ? (
              <div
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
                style={{
                  color: "var(--color-locked, #4a4a4a)",
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                <Lock size={14} /> Locked
              </div>
            ) : null}

            <button
              onClick={() =>
                toggleBookmark.mutate({ bookId: book.id, alreadyBookmarked: isBookmarked })
              }
              disabled={toggleBookmark.isPending}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
              style={{
                color: isBookmarked ? "var(--color-accent)" : "var(--color-text-secondary)",
                background: "var(--color-bg-surface)",
                border: `1px solid ${
                  isBookmarked ? "var(--color-accent)" : "var(--color-border-subtle)"
                }`,
              }}
            >
              <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
              {isBookmarked ? "Bookmarked" : "Bookmark"}
            </button>
          </div>
        </div>
      </div>

      {/* Series banner + siblings */}
      {book.series && (book.seriesSiblings ?? []).length > 0 && (
        <section className="space-y-3">
          <div
            className="p-3 rounded-xl flex items-center gap-3"
            style={{
              background: "color-mix(in srgb, var(--color-accent) 6%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
            }}
          >
            <Layers size={18} style={{ color: "var(--color-accent)" }} />
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Part {book.seriesNumber} of the series
              </div>
              <div className="text-sm font-bold text-foreground">{book.series.title}</div>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {book.seriesSiblings?.map((sib) => {
              const isCurrent = sib.id === book.id;
              return (
                <Link
                  key={sib.id}
                  href={`/ebooks/book/${sib.id}`}
                  className={cn(
                    "flex-shrink-0 w-24 sm:w-28 aspect-[2/3] rounded-lg overflow-hidden relative",
                    isCurrent && "ring-2",
                  )}
                  style={{
                    background: "var(--color-bg-surface)",
                    ...(isCurrent ? { boxShadow: "0 0 0 2px var(--color-accent)" } : {}),
                  }}
                >
                  {sib.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sib.coverImage}
                      alt={sib.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen size={22} className="text-muted-foreground opacity-40" />
                    </div>
                  )}
                  {sib.seriesNumber != null && (
                    <div
                      className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
                      style={{ background: "rgba(0,0,0,0.7)" }}
                    >
                      Part {sib.seriesNumber}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Description */}
      {book.description && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-2">About this book</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {book.description}
          </p>
        </section>
      )}

      {/* Metadata */}
      {(book.isbn || book.language || book.publisher) && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-2">Publisher details</h2>
          <div
            className="p-4 rounded-xl grid grid-cols-2 gap-3 text-xs"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            {book.publisher?.name && (
              <MetaLine label="Publisher" value={book.publisher.name} />
            )}
            {book.isbn && <MetaLine label="ISBN" value={book.isbn} />}
            {book.language && <MetaLine label="Language" value={book.language} />}
            {book.publishDate && (
              <MetaLine
                label="Published"
                value={new Date(book.publishDate).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                })}
              />
            )}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Reviews</h2>
          <button
            onClick={() => setReviewOpen(true)}
            className="text-[11px] font-bold tracking-wider"
            style={{ color: "var(--color-accent)" }}
          >
            {book.myReview ? "EDIT YOUR REVIEW" : "WRITE A REVIEW"}
          </button>
        </div>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reviews yet — be the first.
          </p>
        ) : (
          <div className="space-y-3">
            {reviews.slice(0, 8).map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        )}
      </section>

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        bookId={book.id}
        existingRating={book.myReview?.rating}
        existingReviewText={book.myReview?.reviewText}
      />
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-foreground font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function ReviewCard({ review }: { review: EbookReview }) {
  return (
    <div
      className="p-3 rounded-xl"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {review.authorPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.authorPhotoUrl}
            alt=""
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
            style={{ background: "var(--color-accent)" }}
          >
            {(review.authorName ?? "M").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-foreground truncate">
            {review.authorName ?? "Member"}
          </div>
          <div className="text-[10px] text-muted-foreground">{timeAgo(review.updatedAt)}</div>
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={12}
              fill={i < review.rating ? "#facc15" : "none"}
              color={i < review.rating ? "#facc15" : "#666"}
            />
          ))}
        </div>
      </div>
      {review.reviewText && (
        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
          {review.reviewText}
        </p>
      )}
    </div>
  );
}

function ReviewModal({
  open,
  onClose,
  bookId,
  existingRating,
  existingReviewText,
}: {
  open: boolean;
  onClose: () => void;
  bookId: string;
  existingRating?: number;
  existingReviewText?: string | null;
}) {
  const [rating, setRating] = useState<number>(existingRating ?? 5);
  const [hover, setHover] = useState<number | null>(null);
  const [text, setText] = useState<string>(existingReviewText ?? "");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const submit = useSubmitReview(bookId);
  const { data: _me } = useMe();

  if (!open) return null;

  async function onSubmit() {
    setBanner(null);
    setBusy(true);
    try {
      await submit.mutateAsync({ rating, reviewText: text.trim() || undefined });
      onClose();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Could not submit review.");
    } finally {
      setBusy(false);
    }
  }

  const displayRating = hover ?? rating;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-medium)",
        }}
      >
        <div
          className="p-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
        >
          <h3 className="text-base font-bold text-foreground">
            {existingRating ? "Edit review" : "Write a review"}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm"
            disabled={busy}
          >
            Cancel
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Your rating
            </div>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHover(i)}
                >
                  <Star
                    size={30}
                    fill={i <= displayRating ? "#facc15" : "none"}
                    color={i <= displayRating ? "#facc15" : "#666"}
                  />
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="What did you take away? (optional)"
            className="w-full px-3 py-2 rounded-lg text-sm text-foreground outline-none resize-y"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
            }}
          />
          {banner && (
            <div
              className="text-xs px-3 py-2 rounded-lg"
              style={{
                color: "#ef4444",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.35)",
              }}
            >
              {banner}
            </div>
          )}
          <button
            onClick={onSubmit}
            disabled={busy}
            className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "var(--color-accent)" }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Submit review
          </button>
          <p className="text-[10px] text-muted-foreground text-center">
            Reviews are moderated before appearing publicly.
          </p>
        </div>
      </div>
    </div>
  );
}

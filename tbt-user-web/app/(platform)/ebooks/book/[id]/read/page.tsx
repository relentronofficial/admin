"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Loader2,
  Menu,
  Save,
  Trash2,
  X,
} from "lucide-react";

import {
  useCreateHighlight,
  useDeleteHighlight,
  useEbook,
  useHighlightsForBook,
  useSubmitProgress,
  useToggleBookmark,
  useUpdateHighlight,
} from "@/lib/hooks/useEbooks";
import type { EbookHighlight } from "@/types";
import { cn } from "@/lib/utils/cn";

const HIGHLIGHT_COLORS: Array<{ id: string; hex: string; label: string }> = [
  { id: "yellow", hex: "#facc15", label: "Yellow" },
  { id: "green", hex: "#4ade80", label: "Green" },
  { id: "blue", hex: "#60a5fa", label: "Blue" },
  { id: "pink", hex: "#f472b6", label: "Pink" },
  { id: "orange", hex: "#fb923c", label: "Orange" },
];

const PROGRESS_INTERVAL_MS = 30_000;

export default function EbookReaderPage() {
  const params = useParams<{ id: string }>();
  const bookId = params?.id ?? "";
  const { data: book, isLoading, isError } = useEbook(bookId);
  const submitProgress = useSubmitProgress();
  const toggleBookmark = useToggleBookmark();

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpDraft, setJumpDraft] = useState<string>("");
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const startPage = useMemo(
    () => Math.max(1, book?.progress?.currentPage ?? 1),
    [book?.progress?.currentPage],
  );
  const totalPages = book?.totalPages ?? 0;
  const isBookmarked = !!book?.bookmark;
  const pdfUrl = book?.pdfUrl ?? null;

  // Set the initial resume page once the book loads
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!book || hydratedRef.current) return;
    hydratedRef.current = true;
    setCurrentPage(startPage);
  }, [book, startPage]);

  // Periodic progress save while the reader is open
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  useEffect(() => {
    if (!bookId || !book || totalPages <= 0) return;
    const id = setInterval(() => {
      submitProgress.mutate({
        bookId,
        currentPage: currentPageRef.current,
        totalPages,
        completed: currentPageRef.current >= totalPages,
      });
    }, PROGRESS_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, book, totalPages]);

  // Also save when unmounting / on last page nav so the user's progress
  // doesn't lag by 30s on close.
  useEffect(() => {
    return () => {
      if (!bookId || totalPages <= 0) return;
      submitProgress.mutate({
        bookId,
        currentPage: currentPageRef.current,
        totalPages,
        completed: currentPageRef.current >= totalPages,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, totalPages]);

  function goToPage(p: number) {
    const clamped = Math.max(1, Math.min(totalPages || Infinity, p));
    setCurrentPage(clamped);
    // Save on navigation so pages the user manually flips through
    // don't get lost if they close the tab quickly.
    if (bookId && totalPages > 0) {
      submitProgress.mutate({
        bookId,
        currentPage: clamped,
        totalPages,
        completed: clamped >= totalPages,
      });
    }
  }

  const iframeSrc = useMemo(() => {
    if (!pdfUrl) return null;
    // # fragment tells the browser's built-in PDF viewer where to open.
    return `${pdfUrl}#page=${currentPage}&toolbar=1`;
  }, [pdfUrl, currentPage]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading book…
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <p className="text-sm text-muted-foreground">Could not open this book.</p>
        <Link
          href={`/ebooks/book/${bookId}`}
          className="inline-block mt-4 px-4 py-2 rounded-xl text-xs font-bold text-foreground"
          style={{ border: "1px solid var(--color-border-subtle)" }}
        >
          Back to details
        </Link>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          This book doesn&apos;t have a PDF file attached yet.
        </p>
        <Link
          href={`/ebooks/book/${bookId}`}
          className="inline-block px-4 py-2 rounded-xl text-xs font-bold text-foreground"
          style={{ border: "1px solid var(--color-border-subtle)" }}
        >
          Back to book details
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col gap-3">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 p-2 rounded-2xl flex-wrap flex-shrink-0"
        style={{
          background: "var(--color-bg-surface)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        <Link
          href={`/ebooks/book/${bookId}`}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Back"
        >
          <X size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-foreground truncate">{book.title}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            Page {currentPage}
            {totalPages > 0 ? ` / ${totalPages}` : ""}
          </div>
        </div>

        {/* Page navigator */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          <input
            type="number"
            min={1}
            max={totalPages || undefined}
            value={jumpDraft || currentPage}
            onChange={(e) => setJumpDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = Number(jumpDraft);
                if (Number.isFinite(n) && n > 0) {
                  goToPage(Math.floor(n));
                  setJumpDraft("");
                }
              }
            }}
            onBlur={() => {
              if (!jumpDraft) return;
              const n = Number(jumpDraft);
              if (Number.isFinite(n) && n > 0) goToPage(Math.floor(n));
              setJumpDraft("");
            }}
            className="w-14 px-2 py-1.5 text-center rounded-lg text-xs text-foreground outline-none"
            style={{
              background: "var(--color-bg-primary)",
              border: "1px solid var(--color-border-subtle)",
            }}
          />
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={totalPages > 0 && currentPage >= totalPages}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="w-px h-6 mx-1" style={{ background: "var(--color-border-subtle)" }} />

        {/* Bookmark */}
        <button
          onClick={() =>
            toggleBookmark.mutate({
              bookId,
              alreadyBookmarked: isBookmarked,
              pageNumber: currentPage,
            })
          }
          disabled={toggleBookmark.isPending}
          className="p-2 rounded-lg disabled:opacity-60"
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this page"}
          style={{
            color: isBookmarked ? "var(--color-accent)" : "var(--color-text-secondary)",
          }}
        >
          <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
        </button>

        {/* Highlights */}
        <button
          onClick={() => setHighlightsOpen((v) => !v)}
          className={cn(
            "p-2 rounded-lg",
            highlightsOpen
              ? "text-foreground bg-[var(--color-surface-overlay)]"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label="Highlights"
        >
          <Highlighter size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex gap-3">
        {/* PDF viewer */}
        <div
          className="flex-1 min-w-0 rounded-2xl overflow-hidden"
          style={{
            background: "#000",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <iframe
            key={iframeSrc /* remount on jump-to-page for browsers that ignore #page */}
            src={iframeSrc ?? undefined}
            className="w-full h-full"
            title={book.title}
          />
        </div>

        {/* Highlights sidebar */}
        {highlightsOpen && (
          <HighlightsSidebar
            bookId={bookId}
            currentPage={currentPage}
            onAdd={() => setAddOpen(true)}
            onJumpTo={(pageNumber) => goToPage(pageNumber)}
          />
        )}
      </div>

      {/* Add highlight modal */}
      {addOpen && (
        <AddHighlightModal
          bookId={bookId}
          pageNumber={currentPage}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

// ── Highlights sidebar ──────────────────────────────────────────────────────

function HighlightsSidebar({
  bookId,
  currentPage,
  onAdd,
  onJumpTo,
}: {
  bookId: string;
  currentPage: number;
  onAdd: () => void;
  onJumpTo: (page: number) => void;
}) {
  const { data: highlights = [], isLoading } = useHighlightsForBook(bookId);
  const del = useDeleteHighlight(bookId);
  const update = useUpdateHighlight(bookId);
  const [editing, setEditing] = useState<EbookHighlight | null>(null);

  return (
    <aside
      className="w-80 flex-shrink-0 flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <div
        className="p-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
      >
        <h3 className="text-sm font-bold text-foreground">Highlights</h3>
        <button
          onClick={onAdd}
          className="text-[11px] font-bold tracking-wider"
          style={{ color: "var(--color-accent)" }}
        >
          + ADD (p. {currentPage})
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            Loading…
          </div>
        ) : highlights.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            No highlights yet. Click <span className="font-bold">+ ADD</span> to save one.
          </div>
        ) : (
          highlights.map((h) => (
            <HighlightRow
              key={h.id}
              highlight={h}
              onJumpTo={() => onJumpTo(h.pageNumber)}
              onDelete={() => {
                if (confirm("Delete this highlight?")) del.mutate(h.id);
              }}
              onEdit={() => setEditing(h)}
            />
          ))
        )}
      </div>

      {editing && (
        <EditHighlightModal
          highlight={editing}
          onClose={() => setEditing(null)}
          onSave={(payload) =>
            update.mutate(
              { id: editing.id, ...payload },
              { onSettled: () => setEditing(null) },
            )
          }
        />
      )}
    </aside>
  );
}

function HighlightRow({
  highlight,
  onJumpTo,
  onDelete,
  onEdit,
}: {
  highlight: EbookHighlight;
  onJumpTo: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const swatch =
    HIGHLIGHT_COLORS.find((c) => c.id === highlight.highlightColor)?.hex ?? "#facc15";
  return (
    <div
      className="rounded-lg p-3 space-y-1.5 text-xs group"
      style={{
        background: `color-mix(in srgb, ${swatch} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${swatch} 25%, transparent)`,
      }}
    >
      <div className="flex items-center justify-between">
        <button
          onClick={onJumpTo}
          className="text-[10px] font-bold tracking-wider hover:underline"
          style={{ color: swatch }}
        >
          PAGE {highlight.pageNumber}
        </button>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1 rounded text-muted-foreground hover:text-foreground"
            aria-label="Edit"
          >
            <Menu size={12} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-red-400 hover:text-red-300"
            aria-label="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <p className="text-foreground leading-relaxed whitespace-pre-wrap">
        &ldquo;{highlight.selectedText}&rdquo;
      </p>
      {highlight.notes && (
        <p className="text-muted-foreground italic border-l-2 pl-2" style={{ borderColor: swatch }}>
          {highlight.notes}
        </p>
      )}
    </div>
  );
}

// ── Add highlight modal ─────────────────────────────────────────────────────

function AddHighlightModal({
  bookId,
  pageNumber,
  onClose,
}: {
  bookId: string;
  pageNumber: number;
  onClose: () => void;
}) {
  const [selectedText, setSelectedText] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState("yellow");
  const [busy, setBusy] = useState(false);
  const create = useCreateHighlight(bookId);

  async function onSubmit() {
    if (!selectedText.trim()) return;
    setBusy(true);
    try {
      await create.mutateAsync({
        pageNumber,
        selectedText: selectedText.trim(),
        highlightColor: color,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

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
            Add highlight · page {pageNumber}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            Cancel
          </button>
        </div>
        <div className="p-4 space-y-3">
          <textarea
            autoFocus
            value={selectedText}
            onChange={(e) => setSelectedText(e.target.value)}
            rows={4}
            placeholder="Paste or type the passage you want to save"
            className="w-full px-3 py-2 rounded-lg text-sm text-foreground outline-none resize-y"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
            }}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes (optional)"
            className="w-full px-3 py-2 rounded-lg text-sm text-foreground outline-none resize-y"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
            }}
          />
          <ColorPicker value={color} onChange={setColor} />
          <button
            onClick={onSubmit}
            disabled={busy || !selectedText.trim()}
            className="w-full py-2.5 rounded-xl font-bold text-white text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: "var(--color-accent)" }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save highlight
          </button>
        </div>
      </div>
    </div>
  );
}

function EditHighlightModal({
  highlight,
  onClose,
  onSave,
}: {
  highlight: EbookHighlight;
  onClose: () => void;
  onSave: (payload: { highlightColor?: string; notes?: string }) => void;
}) {
  const [color, setColor] = useState(highlight.highlightColor);
  const [notes, setNotes] = useState(highlight.notes ?? "");

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
            Edit highlight · page {highlight.pageNumber}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            Cancel
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground italic p-3 rounded-lg" style={{ background: "var(--color-bg-surface)" }}>
            &ldquo;{highlight.selectedText}&rdquo;
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes (optional)"
            className="w-full px-3 py-2 rounded-lg text-sm text-foreground outline-none resize-y"
            style={{
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border-subtle)",
            }}
          />
          <ColorPicker value={color} onChange={setColor} />
          <button
            onClick={() => onSave({ highlightColor: color, notes: notes.trim() || undefined })}
            className="w-full py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
            style={{ background: "var(--color-accent)" }}
          >
            <Save size={14} /> Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        Colour
      </div>
      <div className="flex gap-1.5">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: c.hex,
              boxShadow: value === c.id ? `0 0 0 2px var(--color-modal-bg), 0 0 0 4px ${c.hex}` : undefined,
            }}
            aria-label={c.label}
          />
        ))}
      </div>
    </div>
  );
}

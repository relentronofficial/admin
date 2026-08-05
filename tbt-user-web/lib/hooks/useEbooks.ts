"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ebooksService, type LibraryParams } from "@/lib/api/services/ebooks.service";
import type { EbookHighlight } from "@/types";

export const ebookKeys = {
  categories: ["ebooks", "categories"] as const,
  featured: ["ebooks", "featured"] as const,
  banners: ["ebooks", "banners"] as const,
  library: (params: LibraryParams) => ["ebooks", "library", params] as const,
  book: (id: string) => ["ebooks", "book", id] as const,
  bookmarks: ["ebooks", "bookmarks"] as const,
  progress: (bookId: string) => ["ebooks", "progress", bookId] as const,
  continueReading: ["ebooks", "continue-reading"] as const,
  reviews: (bookId: string) => ["ebooks", "reviews", bookId] as const,
  streak: ["ebooks", "streak"] as const,
  author: (slug: string) => ["ebooks", "author", slug] as const,
  trending: (limit: number) => ["ebooks", "trending", limit] as const,
  highlightsForBook: (bookId: string) => ["ebooks", "highlights", bookId] as const,
  allHighlights: ["ebooks", "highlights", "all"] as const,
};

// ── Categories / featured / banners / trending ─────────────────────────────

export function useEbookCategories() {
  return useQuery({
    queryKey: ebookKeys.categories,
    queryFn: async () => (await ebooksService.listCategories()).data ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

export function useFeaturedEbooks() {
  return useQuery({
    queryKey: ebookKeys.featured,
    queryFn: async () => (await ebooksService.listFeatured()).data ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

export function useEbookBanners() {
  return useQuery({
    queryKey: ebookKeys.banners,
    queryFn: async () => (await ebooksService.listBanners()).data ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

export function useTrendingEbooks(limit = 10) {
  return useQuery({
    queryKey: ebookKeys.trending(limit),
    queryFn: async () => (await ebooksService.listTrending(limit)).data ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

// ── Library / detail ────────────────────────────────────────────────────────

export function useEbookLibrary(params: LibraryParams = {}) {
  return useQuery({
    queryKey: ebookKeys.library(params),
    queryFn: async () => {
      const res = await ebooksService.listLibrary(params);
      return { books: res.data ?? [], total: res.meta?.total ?? 0 };
    },
    staleTime: 60 * 1000,
  });
}

export function useEbook(id: string) {
  return useQuery({
    queryKey: ebookKeys.book(id),
    queryFn: async () => (await ebooksService.getBook(id)).data,
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

// ── Bookmarks ───────────────────────────────────────────────────────────────

export function useBookmarks() {
  return useQuery({
    queryKey: ebookKeys.bookmarks,
    queryFn: async () => (await ebooksService.listBookmarks()).data ?? [],
    staleTime: 30 * 1000,
  });
}

/**
 * Toggle bookmark on a book. When `pageNumber` is supplied, the backend
 * stores it; passing `null` upgrades an existing bookmark's page while
 * keeping the row alive.
 */
type ToggleBookmarkResult = { removed: boolean; bookmark?: unknown };

export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation<
    ToggleBookmarkResult,
    Error,
    { bookId: string; alreadyBookmarked: boolean; pageNumber?: number }
  >({
    mutationFn: async (payload) => {
      if (payload.alreadyBookmarked) {
        await ebooksService.deleteBookmark(payload.bookId);
        return { removed: true };
      }
      const res = await ebooksService.upsertBookmark(payload.bookId, payload.pageNumber);
      return { removed: false, bookmark: res.data };
    },
    onSuccess: (_r, payload) => {
      qc.invalidateQueries({ queryKey: ebookKeys.bookmarks });
      qc.invalidateQueries({ queryKey: ebookKeys.book(payload.bookId) });
    },
  });
}

// ── Progress / continue reading ─────────────────────────────────────────────

export function useEbookProgress(bookId: string) {
  return useQuery({
    queryKey: ebookKeys.progress(bookId),
    queryFn: async () => (await ebooksService.getProgress(bookId)).data ?? null,
    enabled: !!bookId,
    staleTime: 15 * 1000,
  });
}

export function useSubmitProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      bookId: string;
      currentPage: number;
      totalPages: number;
      completed?: boolean;
    }) => ebooksService.submitProgress(payload),
    onSuccess: (_r, payload) => {
      qc.invalidateQueries({ queryKey: ebookKeys.progress(payload.bookId) });
      qc.invalidateQueries({ queryKey: ebookKeys.continueReading });
      qc.invalidateQueries({ queryKey: ebookKeys.book(payload.bookId) });
      qc.invalidateQueries({ queryKey: ebookKeys.streak });
    },
  });
}

export function useContinueReading() {
  return useQuery({
    queryKey: ebookKeys.continueReading,
    queryFn: async () => (await ebooksService.continueReading()).data ?? [],
    staleTime: 30 * 1000,
  });
}

// ── Reviews ────────────────────────────────────────────────────────────────

export function useEbookReviews(bookId: string) {
  return useQuery({
    queryKey: ebookKeys.reviews(bookId),
    queryFn: async () => (await ebooksService.listReviews(bookId)).data ?? [],
    enabled: !!bookId,
    staleTime: 60 * 1000,
  });
}

export function useSubmitReview(bookId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { rating: number; reviewText?: string }) =>
      ebooksService.submitReview(bookId, payload.rating, payload.reviewText),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ebookKeys.book(bookId) });
      qc.invalidateQueries({ queryKey: ebookKeys.reviews(bookId) });
    },
  });
}

// ── Streak / author ────────────────────────────────────────────────────────

export function useReadingStreak() {
  return useQuery({
    queryKey: ebookKeys.streak,
    queryFn: async () => (await ebooksService.readingStreak()).data,
    staleTime: 60 * 1000,
  });
}

export function useEbookAuthor(slug: string) {
  return useQuery({
    queryKey: ebookKeys.author(slug),
    queryFn: async () => (await ebooksService.getAuthor(slug)).data,
    enabled: !!slug,
    staleTime: 60 * 1000,
  });
}

// ── Highlights ─────────────────────────────────────────────────────────────

export function useHighlightsForBook(bookId: string, enabled = true) {
  return useQuery({
    queryKey: ebookKeys.highlightsForBook(bookId),
    queryFn: async () =>
      (await ebooksService.listHighlightsForBook(bookId)).data ?? [],
    enabled: enabled && !!bookId,
    staleTime: 30 * 1000,
  });
}

export function useAllHighlights() {
  return useQuery({
    queryKey: ebookKeys.allHighlights,
    queryFn: async () => (await ebooksService.listAllHighlights({ limit: 200 })).data ?? [],
    staleTime: 60 * 1000,
  });
}

export function useCreateHighlight(bookId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      pageNumber: number;
      selectedText: string;
      highlightColor?: string;
      notes?: string;
    }) => ebooksService.createHighlight({ bookId, ...payload }),
    onSuccess: (res) => {
      const created = res.data;
      if (created) {
        qc.setQueryData<EbookHighlight[]>(
          ebookKeys.highlightsForBook(bookId),
          (prev) => {
            const next = [...(prev ?? []), created];
            next.sort((a, b) => a.pageNumber - b.pageNumber);
            return next;
          },
        );
      }
      qc.invalidateQueries({ queryKey: ebookKeys.allHighlights });
    },
  });
}

export function useUpdateHighlight(bookId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; highlightColor?: string; notes?: string }) => {
      const { id, ...rest } = payload;
      return ebooksService.updateHighlight(id, rest);
    },
    onSuccess: (res, payload) => {
      const updated = res.data;
      if (updated) {
        qc.setQueryData<EbookHighlight[]>(
          ebookKeys.highlightsForBook(bookId),
          (prev) => prev?.map((h) => (h.id === payload.id ? updated : h)) ?? [],
        );
      }
      qc.invalidateQueries({ queryKey: ebookKeys.allHighlights });
    },
  });
}

export function useDeleteHighlight(bookId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ebooksService.deleteHighlight(id),
    onSuccess: (_r, id) => {
      qc.setQueryData<EbookHighlight[]>(
        ebookKeys.highlightsForBook(bookId),
        (prev) => prev?.filter((h) => h.id !== id) ?? [],
      );
      qc.invalidateQueries({ queryKey: ebookKeys.allHighlights });
    },
  });
}

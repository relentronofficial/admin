import apiClient from "../client";
import type {
  ApiResponse,
  BookmarkedItem,
  ContinueReadingItem,
  Ebook,
  EbookAuthorProfile,
  EbookBanner,
  EbookBookmark,
  EbookCategory,
  EbookHighlight,
  EbookProgress,
  EbookReadingStreak,
  EbookReview,
  EbookReviewSummary,
} from "@/types";

export interface LibraryParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  featured?: boolean;
}

export const ebooksService = {
  listCategories: () =>
    apiClient.get<never, ApiResponse<EbookCategory[]>>("/api/ebooks/categories"),

  listFeatured: () =>
    apiClient.get<never, ApiResponse<Ebook[]>>("/api/ebooks/featured"),

  listBanners: () =>
    apiClient.get<never, ApiResponse<EbookBanner[]>>("/api/ebooks/banners"),

  listLibrary: (params: LibraryParams = {}) => {
    const query: Record<string, string | number> = {};
    if (params.page) query.page = params.page;
    if (params.limit) query.limit = params.limit;
    if (params.category) query.category = params.category;
    if (params.search) query.search = params.search;
    if (params.featured) query.featured = "true";
    return apiClient.get<never, ApiResponse<Ebook[]>>("/api/ebooks/library", {
      params: query,
    });
  },

  getBook: (id: string) =>
    apiClient.get<never, ApiResponse<Ebook>>(`/api/ebooks/books/${id}`),

  // Bookmarks
  listBookmarks: () =>
    apiClient.get<never, ApiResponse<BookmarkedItem[]>>("/api/ebooks/bookmarks"),

  upsertBookmark: (bookId: string, pageNumber?: number) =>
    apiClient.post<never, ApiResponse<EbookBookmark>>("/api/ebooks/bookmarks", {
      bookId,
      ...(pageNumber != null ? { pageNumber } : {}),
    }),

  deleteBookmark: (bookId: string) =>
    apiClient.delete<never, ApiResponse<unknown>>(`/api/ebooks/bookmarks/${bookId}`),

  // Progress
  submitProgress: (payload: {
    bookId: string;
    currentPage: number;
    totalPages: number;
    completed?: boolean;
  }) =>
    apiClient.post<never, ApiResponse<EbookProgress>>("/api/ebooks/progress", {
      ...payload,
      completed: payload.completed ?? false,
    }),

  getProgress: (bookId: string) =>
    apiClient.get<never, ApiResponse<EbookProgress | null>>(
      `/api/ebooks/progress/${bookId}`,
    ),

  continueReading: () =>
    apiClient.get<never, ApiResponse<ContinueReadingItem[]>>(
      "/api/ebooks/continue-reading",
    ),

  // Reviews
  listReviews: (bookId: string) =>
    apiClient.get<never, ApiResponse<EbookReview[]>>(
      `/api/ebooks/books/${bookId}/reviews`,
    ),

  submitReview: (bookId: string, rating: number, reviewText?: string) =>
    apiClient.post<never, ApiResponse<EbookReviewSummary>>(
      `/api/ebooks/books/${bookId}/reviews`,
      { rating, ...(reviewText ? { reviewText } : {}) },
    ),

  // Streak
  readingStreak: () =>
    apiClient.get<never, ApiResponse<EbookReadingStreak>>("/api/ebooks/streak"),

  // Author
  getAuthor: (slug: string) =>
    apiClient.get<never, ApiResponse<EbookAuthorProfile>>(
      `/api/ebooks/authors/${encodeURIComponent(slug)}`,
    ),

  // Trending
  listTrending: (limit = 10) =>
    apiClient.get<never, ApiResponse<Ebook[]>>("/api/ebooks/trending", {
      params: { limit },
    }),

  // Highlights
  listHighlightsForBook: (bookId: string) =>
    apiClient.get<never, ApiResponse<EbookHighlight[]>>(
      `/api/ebooks/books/${bookId}/highlights`,
    ),

  listAllHighlights: (params: { page?: number; limit?: number } = {}) =>
    apiClient.get<never, ApiResponse<EbookHighlight[]>>("/api/ebooks/highlights", {
      params,
    }),

  createHighlight: (payload: {
    bookId: string;
    pageNumber: number;
    selectedText: string;
    highlightColor?: string;
    notes?: string;
  }) => {
    const { bookId, ...rest } = payload;
    return apiClient.post<never, ApiResponse<EbookHighlight>>(
      `/api/ebooks/books/${bookId}/highlights`,
      rest,
    );
  },

  updateHighlight: (id: string, payload: { highlightColor?: string; notes?: string }) =>
    apiClient.put<never, ApiResponse<EbookHighlight>>(
      `/api/ebooks/highlights/${id}`,
      payload,
    ),

  deleteHighlight: (id: string) =>
    apiClient.delete<never, ApiResponse<unknown>>(`/api/ebooks/highlights/${id}`),
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";

/** Admin hooks for /api/ebooks/admin/*. */

export interface EbookCategory {
  id: string;
  name: string;
  slug: string;
  status: string;
  sortOrder: number;
}
export interface EbookBanner {
  id: string;
  title: string;
  subtitle: string | null;
  backgroundImage: string | null;
  buttonText: string | null;
  buttonLink: string | null;
  status: string;
  sortOrder: number;
}
export interface EbookSeries {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: { books: number };
}

export interface EbookAuthor {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  photoUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: { books: number };
}

export interface EbookPublisher {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  country: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: { books: number };
}

export interface Ebook {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  author: string | null;
  categoryId: string | null;
  coverImage: string | null;
  pdfUrl: string | null;
  contentUrl: string | null;
  totalPages: number;
  readingTime: string | null;
  isFeatured: boolean;
  sortOrder: number;
  publishDate: string;
  status: string;
  // Multi-part series. seriesId is null for standalone books.
  seriesId?: string | null;
  seriesNumber?: number | null;
  series?: {
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
  } | null;
  // Optional managed-author link. Legacy `author` string stays for
  // rows that aren't linked yet.
  authorId?: string | null;
  authorRef?: {
    id: string;
    name: string;
    slug: string;
    photoUrl: string | null;
  } | null;
  // Publisher metadata.
  isbn?: string | null;
  language?: string | null;
  publisherId?: string | null;
  publisher?: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  } | null;
  // Per-batch access. null / omitted → all members; [id, ...] →
  // restrict to those batches only.
  batchIds?: string[] | null;
  // Admin pin. pinnedAt drives the sort order (nulls last, newest
  // first). pinnedUntil auto-hides the visual PINNED badge once past;
  // the row keeps its DB-ordered position until admin clears the pin.
  pinnedAt?: string | null;
  pinnedUntil?: string | null;
  category?: { id: string; name: string; slug: string } | null;
}
export interface EbookDashboard {
  totalBooks: number;
  activeBooks: number;
  inactiveBooks: number;
  categories: number;
  banners: number;
  bookmarks: number;
  activeReaders: number;
}

export interface EbookAnalytics {
  totalOpens: number;
  completedCount: number;
  completionRate: number;    // 0..1
  avgPageReached: number;
  totalBookmarks: number;
  activeReaders30d: number;
  viewCount: number;
}

export interface EbookReview {
  id: string;
  memberId: string;
  bookId: string;
  rating: number;
  reviewText: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
  member?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profilePhotoUrl: string | null;
  } | null;
  book?: { id: string; title: string; slug: string } | null;
}

// ── Dashboard ─────────────────────────────────────────────────────
export const useEbookDashboard = () =>
  useQuery({
    queryKey: ["ebooks", "dashboard"],
    queryFn: async (): Promise<EbookDashboard> => {
      const res: any = await apiClient.get("/api/ebooks/admin/dashboard");
      return res?.data;
    },
    staleTime: 30_000,
  });

// Per-book analytics — pull only when a modal actually needs them.
export const useEbookAnalytics = (bookId: string | null) =>
  useQuery({
    queryKey: ["ebooks", "analytics", bookId],
    queryFn: async (): Promise<EbookAnalytics> => {
      const res: any = await apiClient.get(
        `/api/ebooks/admin/books/${bookId}/analytics`,
      );
      return res?.data;
    },
    enabled: !!bookId,
    staleTime: 30_000,
  });

export interface EbookBookmarkRow {
  id: string;
  pageNumber: number | null;
  createdAt: string;
  member: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

// Members who bookmarked a specific book. Ordered newest first.
export const useEbookBookmarksForBook = (bookId: string | null) =>
  useQuery({
    queryKey: ["ebooks", "bookmarks", bookId],
    queryFn: async (): Promise<EbookBookmarkRow[]> => {
      const res: any = await apiClient.get(
        `/api/ebooks/admin/books/${bookId}/bookmarks`,
      );
      return res?.data ?? [];
    },
    enabled: !!bookId,
    staleTime: 30_000,
  });

// ── Reviews (moderation) ─────────────────────────────────────────
export const useListEbookReviews = (params: {
  status?: "pending" | "approved" | "rejected" | "all";
  page?: number;
  limit?: number;
  bookId?: string;
}) =>
  useQuery({
    queryKey: ["ebooks", "reviews", params],
    queryFn: async (): Promise<{
      data: EbookReview[];
      meta: { total: number; page: number; limit: number };
    }> => {
      const q = new URLSearchParams();
      if (params.status) q.set("status", params.status);
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      if (params.bookId) q.set("bookId", params.bookId);
      const res: any = await apiClient.get(
        `/api/ebooks/admin/reviews?${q.toString()}`,
      );
      return {
        data: res?.data ?? [],
        meta: res?.meta ?? { total: 0, page: 1, limit: 50 },
      };
    },
    staleTime: 20_000,
  });

export const useUpdateEbookReviewStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "pending" | "approved" | "rejected";
    }) => {
      const res: any = await apiClient.put(
        `/api/ebooks/admin/reviews/${id}/status`,
        { status },
      );
      return res?.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["ebooks", "reviews"] }),
  });
};

// ── Bulk CSV import ───────────────────────────────────────────────

export interface BulkImportRow {
  title: string;
  author?: string | null;
  category?: string | null;      // matched vs. slug then name
  totalPages?: number;
  pdfUrl?: string | null;
  coverUrl?: string | null;
}

export interface BulkImportDryRunResult {
  dryRun: true;
  willCreate: number;
  errors: Array<{ row: number; title: string; message: string }>;
  preview: Array<{
    row: number;
    title: string;
    slug: string;
    author: string | null;
    categoryId: string | null;
  }>;
}

export interface BulkImportCommitResult {
  dryRun: false;
  createdCount: number;
  errorCount: number;
  created: Array<{ id: string; title: string; slug: string }>;
  errors: Array<{ row: number; title: string; message: string }>;
}

export const useBulkImportEbooks = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rows,
      dryRun,
    }: {
      rows: BulkImportRow[];
      dryRun: boolean;
    }): Promise<BulkImportDryRunResult | BulkImportCommitResult> => {
      const res: any = await apiClient.post(
        `/api/ebooks/admin/books/bulk-import`,
        { rows, dryRun },
      );
      return res?.data;
    },
    onSuccess: (result, variables) => {
      // Only refresh the list on a real commit (dryRun changes nothing).
      if (!variables.dryRun) {
        qc.invalidateQueries({ queryKey: ["ebooks", "books"] });
        qc.invalidateQueries({ queryKey: ["ebooks", "dashboard"] });
      }
    },
  });
};

// ── Categories ────────────────────────────────────────────────────
export const useListEbookCategories = () =>
  useQuery({
    queryKey: ["ebooks", "categories"],
    queryFn: async (): Promise<EbookCategory[]> => {
      const res: any = await apiClient.get("/api/ebooks/admin/categories");
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });

export const useCreateEbookCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<EbookCategory>) => {
      const res: any = await apiClient.post("/api/ebooks/admin/categories", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ebooks"] }),
  });
};

export const useUpdateEbookCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EbookCategory> }) => {
      const res: any = await apiClient.put(`/api/ebooks/admin/categories/${id}`, data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ebooks"] }),
  });
};

export const useDeleteEbookCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/ebooks/admin/categories/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ebooks"] }),
  });
};

// ── Series ────────────────────────────────────────────────────────
export const useListEbookSeries = () =>
  useQuery({
    queryKey: ["ebooks", "series"],
    queryFn: async (): Promise<EbookSeries[]> => {
      const res: any = await apiClient.get("/api/ebooks/admin/series");
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });

export const useCreateEbookSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<EbookSeries>) => {
      const res: any = await apiClient.post(
        "/api/ebooks/admin/series",
        data,
      );
      return res?.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["ebooks", "series"] }),
  });
};

export const useUpdateEbookSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<EbookSeries>;
    }) => {
      const res: any = await apiClient.put(
        `/api/ebooks/admin/series/${id}`,
        data,
      );
      return res?.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["ebooks", "series"] }),
  });
};

export const useDeleteEbookSeries = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/ebooks/admin/series/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ebooks", "series"] });
      // Deleted series set-null-cascades on child books; refresh so
      // the books tab reflects the cleared seriesId.
      qc.invalidateQueries({ queryKey: ["ebooks", "books"] });
    },
  });
};

// ── Authors ───────────────────────────────────────────────────────
export const useListEbookAuthors = () =>
  useQuery({
    queryKey: ["ebooks", "authors"],
    queryFn: async (): Promise<EbookAuthor[]> => {
      const res: any = await apiClient.get("/api/ebooks/admin/authors");
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });

export const useCreateEbookAuthor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<EbookAuthor>) => {
      const res: any = await apiClient.post(
        "/api/ebooks/admin/authors",
        data,
      );
      return res?.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["ebooks", "authors"] }),
  });
};

export const useUpdateEbookAuthor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<EbookAuthor>;
    }) => {
      const res: any = await apiClient.put(
        `/api/ebooks/admin/authors/${id}`,
        data,
      );
      return res?.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["ebooks", "authors"] }),
  });
};

export const useDeleteEbookAuthor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/ebooks/admin/authors/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ebooks", "authors"] });
      qc.invalidateQueries({ queryKey: ["ebooks", "books"] });
    },
  });
};

// ── Publishers ────────────────────────────────────────────────────
export const useListEbookPublishers = () =>
  useQuery({
    queryKey: ["ebooks", "publishers"],
    queryFn: async (): Promise<EbookPublisher[]> => {
      const res: any = await apiClient.get("/api/ebooks/admin/publishers");
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });

export const useCreateEbookPublisher = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<EbookPublisher>) => {
      const res: any = await apiClient.post(
        "/api/ebooks/admin/publishers",
        data,
      );
      return res?.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["ebooks", "publishers"] }),
  });
};

export const useUpdateEbookPublisher = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<EbookPublisher>;
    }) => {
      const res: any = await apiClient.put(
        `/api/ebooks/admin/publishers/${id}`,
        data,
      );
      return res?.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["ebooks", "publishers"] }),
  });
};

export const useDeleteEbookPublisher = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/ebooks/admin/publishers/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ebooks", "publishers"] });
      qc.invalidateQueries({ queryKey: ["ebooks", "books"] });
    },
  });
};

// ── Books ─────────────────────────────────────────────────────────
export const useListEbooks = (params: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: string;
} = {}) =>
  useQuery({
    queryKey: ["ebooks", "books", params],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      if (params.search) q.set("search", params.search);
      if (params.categoryId) q.set("categoryId", params.categoryId);
      if (params.status) q.set("status", params.status);
      const res: any = await apiClient.get(`/api/ebooks/admin/books?${q.toString()}`);
      return res as { data: Ebook[]; meta: { total: number; page: number; limit: number } };
    },
    placeholderData: (prev) => prev,
  });

export const useCreateEbook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Ebook>) => {
      const res: any = await apiClient.post("/api/ebooks/admin/books", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ebooks"] }),
  });
};

export const useUpdateEbook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Ebook> }) => {
      const res: any = await apiClient.put(`/api/ebooks/admin/books/${id}`, data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ebooks"] }),
  });
};

export const useToggleEbookStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res: any = await apiClient.put(`/api/ebooks/admin/books/${id}/toggle-status`);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ebooks"] }),
  });
};

export const useDeleteEbook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/ebooks/admin/books/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ebooks"] }),
  });
};

// ── Banners ───────────────────────────────────────────────────────
export const useListEbookBanners = () =>
  useQuery({
    queryKey: ["ebooks", "banners"],
    queryFn: async (): Promise<EbookBanner[]> => {
      const res: any = await apiClient.get("/api/ebooks/admin/banners");
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });

export const useCreateEbookBanner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<EbookBanner>) => {
      const res: any = await apiClient.post("/api/ebooks/admin/banners", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ebooks"] }),
  });
};

export const useUpdateEbookBanner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EbookBanner> }) => {
      const res: any = await apiClient.put(`/api/ebooks/admin/banners/${id}`, data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ebooks"] }),
  });
};

export const useDeleteEbookBanner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/ebooks/admin/banners/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ebooks"] }),
  });
};

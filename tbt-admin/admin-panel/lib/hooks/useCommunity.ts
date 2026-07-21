import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";

// ── Types ─────────────────────────────────────────────────────────

export interface CommunityMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
}

export interface CommunityPost {
  id: string;
  memberId: string;
  content: string;
  postType: string;
  mediaUrls: string[];
  isPinned: boolean;
  isAnnouncement: boolean;
  isMentor: boolean;
  isApproved: boolean;
  likesCount: number;
  commentsCount: number;
  status: string;
  createdAt: string;
  member: CommunityMember | null;
}

export interface CommunityListPage {
  data: CommunityPost[];
  meta: { total: number; page: number; limit: number };
}

// ── List posts (admin) ────────────────────────────────────────────

export const useListCommunityPosts = (params: {
  page?: number;
  limit?: number;
  memberId?: string;
}) =>
  useQuery({
    queryKey: ["community", "posts", params],
    queryFn: async (): Promise<CommunityListPage> => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      if (params.memberId) q.set("memberId", params.memberId);
      const res: any = await apiClient.get(
        `/api/community/admin/posts?${q.toString()}`,
      );
      return {
        data: res?.data ?? [],
        meta: res?.meta ?? { total: 0, page: 1, limit: 20 },
      };
    },
    staleTime: 20_000,
  });

// ── Approve / reject ──────────────────────────────────────────────

export const useApproveCommunityPost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      isApproved,
    }: {
      id: string;
      isApproved: boolean;
    }) => {
      const res: any = await apiClient.put(
        `/api/community/admin/posts/${id}/approve`,
        { isApproved },
      );
      return res?.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["community", "posts"] }),
  });
};

// ── Pin / unpin ───────────────────────────────────────────────────

export const usePinCommunityPost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      isPinned,
    }: {
      id: string;
      isPinned: boolean;
    }) => {
      const res: any = await apiClient.put(
        `/api/community/admin/posts/${id}/pin`,
        { isPinned },
      );
      return res?.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["community", "posts"] }),
  });
};

// ── Delete ────────────────────────────────────────────────────────

export const useDeleteCommunityPost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/community/admin/posts/${id}`);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["community", "posts"] }),
  });
};

// ── Comments (admin can view any post's) ──────────────────────────

export interface CommunityComment {
  id: string;
  postId: string;
  memberId: string;
  content: string;
  createdAt: string;
  member: CommunityMember | null;
}

// ── Reports (item #25) ────────────────────────────────────────────

export interface CommunityReport {
  id: string;
  postId: string;
  reporterId: string;
  reason: string;
  detail: string | null;
  status: string; // "pending" | "resolved" | "dismissed"
  createdAt: string;
  resolvedAt: string | null;
  reporter: CommunityMember | null;
  post: {
    id: string;
    content: string;
    mediaUrls: string[];
    createdAt: string;
    member: CommunityMember | null;
  } | null;
}

export const useListCommunityReports = (params: {
  status?: "pending" | "resolved" | "dismissed" | "all";
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: ["community", "reports", params],
    queryFn: async (): Promise<{
      data: CommunityReport[];
      meta: { total: number; page: number; limit: number };
    }> => {
      const q = new URLSearchParams();
      if (params.status) q.set("status", params.status);
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      const res: any = await apiClient.get(
        `/api/community/admin/reports?${q.toString()}`,
      );
      return {
        data: res?.data ?? [],
        meta: res?.meta ?? { total: 0, page: 1, limit: 50 },
      };
    },
    staleTime: 20_000,
  });

export const useUpdateCommunityReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "resolved" | "dismissed" | "pending";
    }) => {
      const res: any = await apiClient.put(
        `/api/community/admin/reports/${id}`,
        { status },
      );
      return res?.data;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["community", "reports"] }),
  });
};

export const useListPostComments = (postId: string | null) =>
  useQuery({
    queryKey: ["community", "comments", postId],
    queryFn: async (): Promise<CommunityComment[]> => {
      if (!postId) return [];
      const res: any = await apiClient.get(
        `/api/community/admin/posts/${postId}/comments`,
      );
      return res?.data ?? [];
    },
    enabled: !!postId,
    staleTime: 30_000,
  });

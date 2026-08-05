import apiClient from "../client";
import type {
  ApiResponse,
  CommunityComment,
  CommunityFilter,
  CommunityMemberProfile,
  CommunityMemberRef,
  CommunityPost,
  ReportReason,
} from "@/types";

export interface FeedParams {
  page?: number;
  limit?: number;
  filter?: CommunityFilter;
}

export interface SubmitPostBody {
  content: string;
  mediaUrls?: string[];
}

export const communityService = {
  // Feed
  listFeed: (params: FeedParams = {}) => {
    const { filter, ...rest } = params;
    const query: Record<string, string | number> = { ...rest };
    if (filter && filter !== "all") query.filter = filter;
    return apiClient.get<never, ApiResponse<CommunityPost[]>>(
      "/api/community/feed",
      { params: query },
    );
  },

  submitPost: (body: SubmitPostBody) =>
    apiClient.post<never, ApiResponse<CommunityPost>>("/api/community/feed", body),

  deleteOwnPost: (id: string) =>
    apiClient.delete<never, ApiResponse<unknown>>(`/api/community/posts/${id}`),

  // Likes
  toggleLike: (postId: string) =>
    apiClient.post<never, ApiResponse<{ liked: boolean; likesCount: number }>>(
      `/api/community/posts/${postId}/like`,
    ),

  listLikers: (postId: string, params: { page?: number; limit?: number } = {}) =>
    apiClient.get<never, ApiResponse<CommunityMemberRef[]>>(
      `/api/community/posts/${postId}/likers`,
      { params },
    ),

  // Bookmarks
  toggleBookmark: (postId: string) =>
    apiClient.post<never, ApiResponse<{ bookmarked: boolean }>>(
      `/api/community/posts/${postId}/bookmark`,
    ),

  listBookmarks: (params: { page?: number; limit?: number } = {}) =>
    apiClient.get<never, ApiResponse<CommunityPost[]>>("/api/community/bookmarks", {
      params,
    }),

  // Comments
  listComments: (postId: string) =>
    apiClient.get<never, ApiResponse<CommunityComment[]>>(
      `/api/community/posts/${postId}/comments`,
    ),

  addComment: (postId: string, content: string, parentCommentId?: string) =>
    apiClient.post<never, ApiResponse<CommunityComment>>(
      `/api/community/posts/${postId}/comments`,
      { content, ...(parentCommentId ? { parentCommentId } : {}) },
    ),

  deleteComment: (postId: string, commentId: string) =>
    apiClient.delete<never, ApiResponse<unknown>>(
      `/api/community/posts/${postId}/comments/${commentId}`,
    ),

  toggleCommentLike: (commentId: string) =>
    apiClient.post<never, ApiResponse<{ liked: boolean; likesCount: number }>>(
      `/api/community/comments/${commentId}/like`,
    ),

  // Members / follow
  getMemberProfile: (memberId: string) =>
    apiClient.get<never, ApiResponse<CommunityMemberProfile>>(
      `/api/community/members/${memberId}/profile`,
    ),

  toggleFollow: (memberId: string) =>
    apiClient.post<never, ApiResponse<{ following: boolean }>>(
      `/api/community/members/${memberId}/follow`,
    ),

  listFollowers: (memberId: string, params: { page?: number; limit?: number } = {}) =>
    apiClient.get<never, ApiResponse<CommunityMemberRef[]>>(
      `/api/community/members/${memberId}/followers`,
      { params },
    ),

  listMyFollowing: (params: { page?: number; limit?: number } = {}) =>
    apiClient.get<never, ApiResponse<CommunityMemberRef[]>>(
      "/api/community/members/me/following",
      { params },
    ),

  searchMembers: (q: string, limit = 10) =>
    apiClient.get<never, ApiResponse<CommunityMemberRef[]>>(
      "/api/community/members/search",
      { params: { q, limit } },
    ),

  // Reports
  reportPost: (postId: string, reason: ReportReason, detail?: string) =>
    apiClient.post<never, ApiResponse<{ alreadyReported: boolean }>>(
      `/api/community/posts/${postId}/report`,
      { reason, ...(detail ? { detail } : {}) },
    ),

  // Hashtag
  hashtagFeed: (tag: string, params: { page?: number; limit?: number } = {}) =>
    apiClient.get<never, ApiResponse<CommunityPost[]>>(
      `/api/community/hashtag/${encodeURIComponent(tag)}/feed`,
      { params },
    ),
};

/**
 * Upload a post media file through /api/upload/image. Accepts any file type
 * (Bunny-first, R2 fallback). Returns the public URL or null on failure.
 */
export async function uploadPostMedia(file: File): Promise<string | null> {
  try {
    const contentType = file.type || "application/octet-stream";
    const buffer = await file.arrayBuffer();
    const res = await apiClient.post<never, ApiResponse<{ publicUrl: string }>>(
      "/api/upload/image",
      buffer,
      {
        params: { pathPrefix: "community", filename: file.name },
        headers: { "Content-Type": contentType },
        transformRequest: [(data) => data],
      },
    );
    return res.data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

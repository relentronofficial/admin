import { useQuery, useMutation } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import type {
  HeroSlide,
  ContentSection,
  WorkshopSection,
  WorkshopListItem,
  Product,
  Resource,
  EpisodePlayback,
  WorkshopDetail,
  CertificateDetails,
  QAResponse,
  AssignmentsResponse,
} from "@/types";

export const useHomeHero = () =>
  useQuery({
    queryKey: ["home-hero"],
    queryFn: async () => {
      const res: any = await apiClient.get("/api/user/home/hero");
      return res?.data as { slides: HeroSlide[]; autoPlayIntervalMs: number };
    },
  });

export const useHomeSections = (memberTier?: number) =>
  useQuery({
    queryKey: ["home-sections", memberTier],
    queryFn: async () => {
      const res: any = await apiClient.get(
        `/api/user/home/sections${memberTier ? `?memberTier=${memberTier}` : ""}`
      );
      return res?.data as { sections: ContentSection[] };
    },
  });

export const useAllWorkshops = () =>
  useQuery({
    queryKey: ["all-workshops"],
    queryFn: async () => {
      const res: any = await apiClient.get("/api/user/workshops");
      return res?.data as WorkshopListItem[];
    },
  });

export const useMyWorkshops = () =>
  useQuery({
    queryKey: ["my-workshops"],
    queryFn: async () => {
      const res: any = await apiClient.get("/api/user/workshops/my");
      return res?.data as { sections: WorkshopSection[] };
    },
  });

export const useWorkshopDetail = (slug: string) =>
  useQuery({
    queryKey: ["workshop-detail", slug],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/user/workshops/${slug}/detail`);
      return res?.data as WorkshopDetail;
    },
    enabled: !!slug,
  });

export const useWorkshopFlow = (slug: string) =>
  useQuery({
    queryKey: ["workshop-flow", slug],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/user/workshops/${slug}/flow`);
      return res?.data;
    },
    enabled: !!slug,
  });

export const useWorkshopQa = (slug: string, page = 1) =>
  useQuery({
    queryKey: ["workshop-qa", slug, page],
    queryFn: async () => {
      const res: any = await apiClient.get(
        `/api/user/workshops/${slug}/qa?page=${page}&limit=20`
      );
      return res?.data as QAResponse;
    },
    enabled: !!slug,
  });

export const usePostQa = () =>
  useMutation({
    mutationFn: async ({ slug, questionText }: { slug: string; questionText: string }) => {
      const res: any = await apiClient.post(`/api/user/workshops/${slug}/qa`, { questionText });
      return res?.data;
    },
  });

export const usePostQaReply = () =>
  useMutation({
    mutationFn: async ({ postId, replyText }: { postId: string; replyText: string }) => {
      const res: any = await apiClient.post(`/api/user/qa/${postId}/reply`, { replyText });
      return res?.data;
    },
  });

export const useWorkshopAssignments = (slug: string) =>
  useQuery({
    queryKey: ["workshop-assignments", slug],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/user/workshops/${slug}/assignments`);
      return res?.data as AssignmentsResponse;
    },
    enabled: !!slug,
  });

export const useSubmitAssignment = () =>
  useMutation({
    mutationFn: async ({ id, answerText }: { id: string; answerText: string }) => {
      const res: any = await apiClient.post(`/api/user/assignments/${id}/submit`, { answerText });
      return res?.data;
    },
  });

export const useEpisodePlayback = (episodeId: string) =>
  useQuery({
    queryKey: ["episode-playback", episodeId],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/user/episodes/${episodeId}/playback`);
      return res?.data as EpisodePlayback;
    },
    enabled: !!episodeId,
  });

export const usePostEpisodeProgress = () =>
  useMutation({
    mutationFn: async ({
      episodeId,
      watchedSeconds,
      deltaSeconds,
      isCompleted,
    }: {
      episodeId: string;
      watchedSeconds?: number;
      deltaSeconds?: number;
      isCompleted?: boolean;
    }) => {
      const res: any = await apiClient.post(`/api/user/episodes/${episodeId}/progress`, {
        watchedSeconds,
        deltaSeconds,
        isCompleted,
      });
      return res?.data;
    },
  });

export const useUserProducts = () =>
  useQuery({
    queryKey: ["user-products"],
    queryFn: async () => {
      const res: any = await apiClient.get("/api/user/products");
      return res?.data as { pageTitle: string; pageBg: string; products: Product[] };
    },
  });

export const useUserResources = (search = "", view = "list", page = 1) =>
  useQuery({
    queryKey: ["user-resources", search, view, page],
    queryFn: async () => {
      const res: any = await apiClient.get(
        `/api/user/resources?search=${encodeURIComponent(search)}&view=${view}&page=${page}&limit=20`
      );
      return res?.data;
    },
  });

export const useWorkshopChallenges = (slug: string) =>
  useQuery({
    queryKey: ["workshop-challenges", slug],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/user/workshops/${slug}/challenges`);
      return res?.data as { challenges: any[] };
    },
    enabled: !!slug,
  });

// Aggregated endpoint — replaces useWorkshopDetail + useWorkshopFlow + useWorkshopChallenges
// with a single round-trip, cutting the workshop page from 3 parallel requests to 1.
export const useWorkshopOverview = (slug: string) =>
  useQuery({
    queryKey: ["workshop-overview", slug],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/user/workshops/${slug}/overview`);
      return res?.data as {
        detail: any;
        flow: { flowItems: any[] };
        challenges: { challenges: any[] };
      };
    },
    enabled: !!slug,
    staleTime: 30 * 1000,
  });

export const useCompleteChallenge = () =>
  useMutation({
    mutationFn: async ({ challengeId, answersData }: { challengeId: string; answersData?: any }) => {
      const res: any = await apiClient.post(`/api/user/challenges/${challengeId}/complete`, { answersData });
      return res?.data;
    },
  });

export const useCompleteWorkshopEpisode = () =>
  useMutation({
    mutationFn: async (episodeId: string) => {
      const res: any = await apiClient.post(`/api/user/workshop-episodes/${episodeId}/complete`, {});
      return res?.data;
    },
  });

export const useWorkshopCertificate = (slug: string) =>
  useQuery({
    queryKey: ["workshop-certificate", slug],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/user/workshops/${slug}/certificate`);
      return res?.data as CertificateDetails;
    },
    enabled: false, // only fetched on demand (when user clicks Download)
    retry: false,
  });

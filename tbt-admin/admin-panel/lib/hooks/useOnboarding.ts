import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

// Application review reuses the existing /api/members list/detail/approve
// endpoints (useListMembers with a verificationStatus facet, useGetMember,
// useApproveMember from useMembers.ts) — see SELF_ONBOARDING_SPECKIT.md §8.1.
// Only the genuinely new admin actions/content-management live here.

export const useRejectOnboarding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res: any = await apiClient.post(`/api/members/${id}/reject`, { reason });
      return res.data || res;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member', id] });
    },
  });
};

export const useRequestOnboardingChanges = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const res: any = await apiClient.post(`/api/members/${id}/request-changes`, { note });
      return res.data || res;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member', id] });
    },
  });
};

export const useListOnboardingContent = () =>
  useQuery({
    queryKey: ['onboarding-content'],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/onboarding/admin/content');
      return res;
    },
  });

export const useCreateOnboardingContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res: any = await apiClient.post('/api/onboarding/admin/content', data);
      return res.data || res;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-content'] }),
  });
};

export const useUpdateOnboardingContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res: any = await apiClient.put(`/api/onboarding/admin/content/${id}`, data);
      return res.data || res;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-content'] }),
  });
};

export const useDeleteOnboardingContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/onboarding/admin/content/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-content'] }),
  });
};

export const useReorderOnboardingContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await apiClient.put('/api/onboarding/admin/content/reorder', { ids });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-content'] }),
  });
};

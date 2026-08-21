import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

// Admin-side hooks for /api/onboarding-meetings/admin — the centralized
// Live Meetings dashboard + per-application scheduling. See
// ONBOARDING_LIVE_MEETING_SPECKIT.md.

export interface ListOnboardingMeetingsParams {
  status?: string;
  memberId?: string;
  page?: number;
  limit?: number;
}

export const useListOnboardingMeetings = (params: ListOnboardingMeetingsParams = {}) =>
  useQuery({
    queryKey: ['onboarding-meetings', params],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/onboarding-meetings/admin', { params });
      return res;
    },
  });

export const useGetOnboardingMeeting = (id: string | null) =>
  useQuery({
    queryKey: ['onboarding-meeting', id],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/onboarding-meetings/admin/${id}`);
      return res;
    },
    enabled: !!id,
  });

export const useCreateOnboardingMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      memberId: string;
      hostAdminId?: string;
      title?: string;
      description?: string;
      scheduledAt: string;
      durationMinutes?: number;
      participantMemberIds?: string[];
      participantAdminIds?: string[];
    }) => {
      const res: any = await apiClient.post('/api/onboarding-meetings/admin', data);
      return res.data || res;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-meetings'] }),
  });
};

export const useUpdateOnboardingMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res: any = await apiClient.put(`/api/onboarding-meetings/admin/${id}`, data);
      return res.data || res;
    },
    onSuccess: (_d, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-meeting', id] });
    },
  });
};

export const useStartOnboardingMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res: any = await apiClient.post(`/api/onboarding-meetings/admin/${id}/start`);
      return res.data || res;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-meetings'] }),
  });
};

export const useEndOnboardingMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res: any = await apiClient.post(`/api/onboarding-meetings/admin/${id}/end`);
      return res.data || res;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-meetings'] }),
  });
};

export const useCancelOnboardingMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res: any = await apiClient.post(`/api/onboarding-meetings/admin/${id}/cancel`, { reason });
      return res.data || res;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-meetings'] }),
  });
};

export const useOnboardingMeetingStatus = (id: string | null, enabled: boolean) =>
  useQuery({
    queryKey: ['onboarding-meeting-status', id],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/onboarding-meetings/admin/${id}/status`);
      return res;
    },
    enabled: !!id && enabled,
    refetchInterval: 10_000,
  });

export const useGetOnboardingMeetingHostToken = () =>
  useMutation({
    mutationFn: async (id: string) => {
      const res: any = await apiClient.post(`/api/onboarding-meetings/admin/${id}/host-token`);
      return res.data || res;
    },
  });

export const useRemoveOnboardingMeetingParticipant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId, participantId }: { meetingId: string; participantId: string }) => {
      const res: any = await apiClient.post(`/api/onboarding-meetings/admin/${meetingId}/participants/${participantId}/remove`);
      return res.data || res;
    },
    onSuccess: (_d, { meetingId }) => queryClient.invalidateQueries({ queryKey: ['onboarding-meeting', meetingId] }),
  });
};

export const useMuteOnboardingMeetingParticipant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId, participantId }: { meetingId: string; participantId: string }) => {
      const res: any = await apiClient.post(`/api/onboarding-meetings/admin/${meetingId}/participants/${participantId}/mute`);
      return res.data || res;
    },
    onSuccess: (_d, { meetingId }) => queryClient.invalidateQueries({ queryKey: ['onboarding-meeting', meetingId] }),
  });
};

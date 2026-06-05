import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export const useGetMember = (id: string) =>
  useQuery({
    queryKey: ['member', id],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/members/${id}`);
      return res;
    },
    enabled: !!id,
  });

export const useListMembers = (params: { page?: number; limit?: number; search?: string } = {}) => {
  return useQuery({
    queryKey: ['members', params],
    queryFn: async () => {
      const { page = 1, limit = 10, search = '' } = params;
      const res: any = await apiClient.get(`/api/members?page=${page}&limit=${limit}&search=${search}`);
      return res;
    },
  });
};

export const useCreateMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res: any = await apiClient.post('/api/members', data);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
};

export const useUpdateMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res: any = await apiClient.put(`/api/members/${id}`, data);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
};

export const useDeleteMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res: any = await apiClient.delete(`/api/members/${id}`);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
};

export const useGetManagers = () => {
  return useQuery({
    queryKey: ['managers'],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/members/managers');
      return res.data || res;
    },
  });
};

export const useCreateManager = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { fullName: string; email: string; phone?: string; designation?: string }) => {
      const res: any = await apiClient.post('/api/members/managers', data);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managers'] });
    },
  });
};

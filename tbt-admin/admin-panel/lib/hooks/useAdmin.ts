import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';
import { CreateAdminInput } from '../validators/admin';

export const useMe = () => {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/auth/me');
      return res.data;
    },
  });
};

export const useGenerateAdminId = () => {
  return useQuery({
    queryKey: ['admin-id'],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/admins/generate-id');
      return res.data;
    },
    staleTime: Infinity,
  });
};

export const useCheckUsername = () => {
  return useMutation({
    mutationFn: async (username: string) => {
      const res: any = await apiClient.get(`/api/admins/check-username?username=${username}`);
      return res.available ?? res.data?.available;
    },
  });
};

export const useCheckEmail = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      const res: any = await apiClient.get(`/api/admins/check-email?email=${email}`);
      return res.available ?? res.data?.available;
    },
  });
};

export const useSearchManagers = (q: string) => {
  return useQuery({
    queryKey: ['managers', q],
    queryFn: async () => {
      if (!q) return [];
      const res: any = await apiClient.get(`/api/admins/search?q=${q}&role=account_manager,super_admin`);
      return Array.isArray(res) ? res : (res.data || []);
    },
    enabled: q.length > 2,
  });
};

export const useGetCountries = () => {
  return useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      try {
        const res: any = await apiClient.get('/api/location/countries');
        const data = res?.data || res;
        if (Array.isArray(data) && data.length > 0) return data;
        return [{ name: "India", isoCode: "IN" }];
      } catch (err) {
        console.error('Error fetching countries:', err);
        return [{ name: "India", isoCode: "IN" }];
      }
    },
    initialData: [{ name: "India", isoCode: "IN" }]
  });
};

export const useGetStates = (countryCode: string) => {
  return useQuery({
    queryKey: ['states', countryCode],
    queryFn: async () => {
      if (!countryCode) return [];
      try {
        const res: any = await apiClient.get(`/api/location/states?countryCode=${countryCode}`);
        const data = res?.data || res;
        if (Array.isArray(data) && data.length > 0) return data;
        return countryCode === 'IN' ? [{ name: "Tamil Nadu", isoCode: "TN" }] : [];
      } catch (err) {
        console.error('Error fetching states:', err);
        return countryCode === 'IN' ? [{ name: "Tamil Nadu", isoCode: "TN" }] : [];
      }
    },
    enabled: !!countryCode,
    initialData: countryCode === 'IN' ? [{ name: "Tamil Nadu", isoCode: "TN" }] : []
  });
};

export const useGetDistricts = (countryCode: string, stateCode: string) => {
  return useQuery({
    queryKey: ['districts', countryCode, stateCode],
    queryFn: async () => {
      if (!countryCode || !stateCode) return [];
      try {
        const res: any = await apiClient.get(`/api/location/districts?countryCode=${countryCode}&stateCode=${stateCode}`);
        const data = res?.data || res;
        if (Array.isArray(data) && data.length > 0) return data;
        return stateCode === 'TN' ? ["Chennai", "Coimbatore", "Madurai"] : [];
      } catch (err) {
        return stateCode === 'TN' ? ["Chennai", "Coimbatore", "Madurai"] : [];
      }
    },
    enabled: !!countryCode && !!stateCode,
    initialData: stateCode === 'TN' ? ["Chennai", "Coimbatore", "Madurai"] : []
  });
};

export const useGetCities = (countryCode: string, stateCode: string) => {
  return useQuery({
    queryKey: ['cities', countryCode, stateCode],
    queryFn: async () => {
      if (!countryCode || !stateCode) return [];
      try {
        const res: any = await apiClient.get(`/api/location/cities?countryCode=${countryCode}&stateCode=${stateCode}`);
        const data = res?.data || res;
        if (Array.isArray(data) && data.length > 0) return data;
        return stateCode === 'TN' ? ["Chennai", "Madurai", "Coimbatore"] : [];
      } catch (err) {
        console.error('Error fetching cities:', err);
        return stateCode === 'TN' ? ["Chennai", "Madurai", "Coimbatore"] : [];
      }
    },
    enabled: !!countryCode && !!stateCode,
    initialData: stateCode === 'TN' ? ["Chennai", "Madurai", "Coimbatore"] : []
  });
};

export const useGeneratePassword = () => {
  return useMutation({
    mutationFn: async () => {
      const res: any = await apiClient.get('/api/auth/generate-password');
      return res.data || res;
    },
  });
};

export const useCreateAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAdminInput) => {
      const res: any = await apiClient.post('/api/admins', data);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
  });
};

export const useListAdmins = (params: { page?: number; limit?: number; search?: string } = {}) => {
  return useQuery({
    queryKey: ['admins', params],
    queryFn: async () => {
      const { page = 1, limit = 10, search = '' } = params;
      const res: any = await apiClient.get(`/api/admins?page=${page}&limit=${limit}&search=${search}`);
      return res; // Return the full response object { success, data, meta }
    },
  });
};

export const useGetPresignedUrl = () => {
  return useMutation({
    mutationFn: async ({ filename, contentType, bucket, pathPrefix }: { filename: string; contentType: string; bucket?: string; pathPrefix?: string }) => {
      const res: any = await apiClient.post('/api/upload/presigned-url', { filename, contentType, bucket, pathPrefix });
      return res.data || res;
    },
  });
};

export const useUploadImage = () => {
  return useMutation({
    mutationFn: async ({ file, pathPrefix }: { file: File; pathPrefix: string }) => {
      const params = new URLSearchParams({ pathPrefix, filename: file.name }).toString();
      const res: any = await apiClient.post(`/api/upload/image?${params}`, file, {
        headers: { 'Content-Type': file.type },
      });
      return (res.data || res) as { publicUrl: string };
    },
  });
};

export const useCreateBunnyVideo = () => {
  return useMutation({
    mutationFn: async ({ title }: { title: string }) => {
      const res: any = await apiClient.post('/api/upload/bunny-video-create', { title });
      return res.data || res;
    },
  });
};

export const useDeleteBunnyVideo = () => {
  return useMutation({
    mutationFn: async (videoId: string) => {
      const res: any = await apiClient.delete(`/api/upload/bunny-video/${videoId}`);
      return res.data || res;
    },
  });
};

export const useSendDirectMessage = () => {
  return useMutation({
    mutationFn: async (payload: { memberId: string; subject: string; body: string }) => {
      const res: any = await apiClient.post('/api/messages/send', payload);
      return res.data || res;
    },
  });
};

export const useAdminConversations = () => {
  return useQuery({
    queryKey: ['admin', 'conversations'],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/conversations');
      return res;
    },
  });
};

export const useAdminConversationMessages = (id: string | null) => {
  return useQuery({
    queryKey: ['admin', 'conversations', id, 'messages'],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/conversations/${id}/messages`);
      return res;
    },
    enabled: !!id,
  });
};

export const useSendAdminChatMessage = () => {
  return useMutation({
    mutationFn: async ({ conversationId, body }: { conversationId: string; body: string }) => {
      const res: any = await apiClient.post(`/api/conversations/${conversationId}/messages`, { body });
      return res.data || res;
    },
  });
};

export const useCloseConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res: any = await apiClient.patch(`/api/conversations/${id}/close`);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'conversations'] });
    },
  });
};

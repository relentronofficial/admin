import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

// ── WORKSHOPS ─────────────────────────────────────────────────────────

export const useListWorkshops = (params: any = {}) =>
  useQuery({
    queryKey: ['workshops', params],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/workshops', { params });
      return res;
    },
  });

export const useGetWorkshop = (id: string) =>
  useQuery({
    queryKey: ['workshop', id],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/workshops/${id}`);
      return res;
    },
    enabled: !!id,
  });

export const useCreateWorkshop = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res: any = await apiClient.post('/api/workshops', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshops'] }),
  });
};

export const useUpdateWorkshop = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: any) => {
      const res: any = await apiClient.put(`/api/workshops/${id}`, data);
      return res.data;
    },
    onSuccess: (_: any, { id }: any) => {
      qc.invalidateQueries({ queryKey: ['workshops'] });
      qc.invalidateQueries({ queryKey: ['workshop', id] });
    },
  });
};

export const useDeleteWorkshop = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/api/workshops/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshops'] }),
  });
};

export const useWorkshopFlow = (id: string) =>
  useQuery({
    queryKey: ['workshop-flow', id],
    queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/${id}/flow`); return res; },
    enabled: !!id,
  });

export const useWorkshopChallenges = (id: string) =>
  useQuery({
    queryKey: ['workshop-challenges', id],
    queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/${id}/challenges`); return res; },
    enabled: !!id,
  });

export const useWorkshopLiveCalls = (id: string) =>
  useQuery({
    queryKey: ['workshop-live-calls', id],
    queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/${id}/live-calls`); return res; },
    enabled: !!id,
  });

export const useWorkshopAssignments = (id: string) =>
  useQuery({
    queryKey: ['workshop-assignments', id],
    queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/${id}/assignments`); return res; },
    enabled: !!id,
  });

export const useWorkshopQA = (id: string, page = 1, limit = 20) =>
  useQuery({
    queryKey: ['workshop-qa', id, page, limit],
    queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/${id}/qa`, { params: { page, limit } }); return res; },
    enabled: !!id,
  });

export const useWorkshopEnrollments = (id: string) =>
  useQuery({
    queryKey: ['workshop-enrollments', id],
    queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/${id}/enrollments`); return res; },
    enabled: !!id,
  });

export const useEnrollMembers = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberIds: string[]) => {
      const res: any = await apiClient.post(`/api/workshops/${workshopId}/enroll`, { memberIds });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-enrollments', workshopId] }),
  });
};

export const useCreateChallenge = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => { const res: any = await apiClient.post(`/api/workshops/${workshopId}/challenges`, data); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-challenges', workshopId] }),
  });
};

export const useUpdateChallenge = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/workshops/challenges/${id}`, data); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-challenges', workshopId] }),
  });
};

export const useDeleteChallenge = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/api/workshops/challenges/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-challenges', workshopId] }),
  });
};

export const useCreateEpisode = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ challengeId, data }: any) => { const res: any = await apiClient.post(`/api/workshops/challenges/${challengeId}/episodes`, data); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-challenges', workshopId] }),
  });
};

export const useUpdateEpisode = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/workshops/episodes/${id}`, data); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-challenges', workshopId] }),
  });
};

export const useDeleteEpisode = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/api/workshops/episodes/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-challenges', workshopId] }),
  });
};

export const useCreateLiveCall = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => { const res: any = await apiClient.post(`/api/workshops/${workshopId}/live-calls`, data); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-live-calls', workshopId] }),
  });
};

export const useUpdateLiveCall = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/workshops/live-calls/${id}`, data); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-live-calls', workshopId] }),
  });
};

export const useDeleteLiveCall = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/api/workshops/live-calls/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-live-calls', workshopId] }),
  });
};

export const useCreateAssignment = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => { const res: any = await apiClient.post(`/api/workshops/${workshopId}/assignments`, data); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-assignments', workshopId] }),
  });
};

export const useUpdateAssignment = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/workshops/assignments/${id}`, data); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-assignments', workshopId] }),
  });
};

export const useDeleteAssignment = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/api/workshops/assignments/${id}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-assignments', workshopId] }),
  });
};

export const useReplyQA = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, replyText }: any) => { const res: any = await apiClient.post(`/api/workshops/qa/${postId}/reply`, { replyText }); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-qa', workshopId] }),
  });
};

export const useDeleteQAPost = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => { await apiClient.delete(`/api/workshops/qa/${postId}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-qa', workshopId] }),
  });
};

export const useUpdateEnrollment = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ enrollmentId, status }: any) => {
      const res: any = await apiClient.put(`/api/workshops/${workshopId}/enrollments/${enrollmentId}`, { status });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-enrollments', workshopId] }),
  });
};

export const useAddFlowItem = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => { const res: any = await apiClient.post(`/api/workshops/${workshopId}/flow`, data); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-flow', workshopId] }),
  });
};

export const useUpdateFlowItem = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, data }: any) => { const res: any = await apiClient.put(`/api/workshops/${workshopId}/flow/${itemId}`, data); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-flow', workshopId] }),
  });
};

export const useDeleteFlowItem = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => { await apiClient.delete(`/api/workshops/${workshopId}/flow/${itemId}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-flow', workshopId] }),
  });
};

export const useReorderFlowItems = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => { await apiClient.put(`/api/workshops/${workshopId}/flow/reorder`, { ids }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-flow', workshopId] }),
  });
};

// ── HERO SLIDES ───────────────────────────────────────────────────────

export const useListHeroSlides = () =>
  useQuery({ queryKey: ['hero-slides'], queryFn: async () => { const res: any = await apiClient.get('/api/hero-slides'); return res; } });

export const useCreateHeroSlide = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post('/api/hero-slides', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['hero-slides'] }) });
};

export const useUpdateHeroSlide = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/hero-slides/${id}`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['hero-slides'] }) });
};

export const useDeleteHeroSlide = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/api/hero-slides/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['hero-slides'] }) });
};

export const useReorderHeroSlides = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (ids: string[]) => { await apiClient.put('/api/hero-slides/reorder', { ids }); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['hero-slides'] }) });
};

// ── CONTENT SECTIONS ─────────────────────────────────────────────────

export const useListContentSections = () =>
  useQuery({ queryKey: ['content-sections'], queryFn: async () => { const res: any = await apiClient.get('/api/content-sections'); return res; } });

export const useCreateContentSection = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post('/api/content-sections', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['content-sections'] }) });
};

export const useUpdateContentSection = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/content-sections/${id}`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['content-sections'] }) });
};

export const useDeleteContentSection = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/api/content-sections/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['content-sections'] }) });
};

export const useContentSectionItems = (sectionId: string) =>
  useQuery({ queryKey: ['content-items', sectionId], queryFn: async () => { const res: any = await apiClient.get(`/api/content-sections/${sectionId}/items`); return res; }, enabled: !!sectionId });

export const useCreateContentItem = (sectionId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post(`/api/content-sections/${sectionId}/items`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['content-items', sectionId] }) });
};

export const useUpdateContentItem = (sectionId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/content-sections/items/${id}`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['content-items', sectionId] }) });
};

export const useDeleteContentItem = (sectionId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/api/content-sections/items/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['content-items', sectionId] }) });
};

export const useReorderContentSections = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (ids: string[]) => { await apiClient.put('/api/content-sections/reorder', { ids }); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['content-sections'] }) });
};

export const useReorderContentItems = (sectionId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (ids: string[]) => { await apiClient.put(`/api/content-sections/${sectionId}/items/reorder`, { ids }); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['content-items', sectionId] }) });
};

// ── TIERS ─────────────────────────────────────────────────────────────

export const useListTiers = () =>
  useQuery({ queryKey: ['tiers'], queryFn: async () => { const res: any = await apiClient.get('/api/tiers'); return res; } });

export const useCreateTier = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post('/api/tiers', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['tiers'] }) });
};

export const useUpdateTier = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/tiers/${id}`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['tiers'] }) });
};

export const useDeleteTier = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/api/tiers/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['tiers'] }) });
};

// ── DISPLAY BADGES ───────────────────────────────────────────────────

export const useListDisplayBadges = () =>
  useQuery({ queryKey: ['display-badges'], queryFn: async () => { const res: any = await apiClient.get('/api/display-badges'); return res; } });

export const useCreateDisplayBadge = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post('/api/display-badges', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['display-badges'] }) });
};

export const useUpdateDisplayBadge = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/display-badges/${id}`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['display-badges'] }) });
};

export const useDeleteDisplayBadge = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/api/display-badges/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['display-badges'] }) });
};

// ── PRODUCTS ─────────────────────────────────────────────────────────

export const useListProducts = () =>
  useQuery({ queryKey: ['products'], queryFn: async () => { const res: any = await apiClient.get('/api/products'); return res; } });

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post('/api/products', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/products/${id}`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/api/products/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) });
};

// ── APP RESOURCES ─────────────────────────────────────────────────────

export const useListAppResources = (search?: string) =>
  useQuery({ queryKey: ['app-resources', search], queryFn: async () => { const res: any = await apiClient.get('/api/app-resources', { params: { search } }); return res; } });

export const useCreateAppResource = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post('/api/app-resources', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['app-resources'] }) });
};

export const useUpdateAppResource = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/app-resources/${id}`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['app-resources'] }) });
};

export const useDeleteAppResource = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/api/app-resources/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['app-resources'] }) });
};

// ── APP NOTIFICATIONS ─────────────────────────────────────────────────

export const useListAppNotifications = () =>
  useQuery({ queryKey: ['app-notifications'], queryFn: async () => { const res: any = await apiClient.get('/api/app-notifications'); return res; } });

export const useSendAppNotification = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post('/api/app-notifications', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['app-notifications'] }) });
};

export const useDeleteAppNotification = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/api/app-notifications/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['app-notifications'] }) });
};

// ── SITE CONFIG ───────────────────────────────────────────────────────

export const useGetSiteConfig = () =>
  useQuery({ queryKey: ['site-config'], queryFn: async () => { const res: any = await apiClient.get('/api/config/site'); return res; } });

export const useUpdateSiteConfig = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.put('/api/config/site', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['site-config'] }) });
};

// ── UI STRINGS ────────────────────────────────────────────────────────

export const useGetUiStrings = () =>
  useQuery({ queryKey: ['ui-strings'], queryFn: async () => { const res: any = await apiClient.get('/api/config/ui-strings'); return res; } });

export const useUpdateUiStrings = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.put('/api/config/ui-strings', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['ui-strings'] }) });
};

// ── NAV ITEMS ─────────────────────────────────────────────────────────

export const useListNavItems = () =>
  useQuery({ queryKey: ['nav-items'], queryFn: async () => { const res: any = await apiClient.get('/api/config/nav'); return res; } });

export const useCreateNavItem = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post('/api/config/nav', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['nav-items'] }) });
};

export const useUpdateNavItem = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/config/nav/${id}`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['nav-items'] }) });
};

export const useDeleteNavItem = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/api/config/nav/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['nav-items'] }) });
};

export const useReorderNavItems = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (ids: string[]) => { await apiClient.put('/api/config/nav/reorder', { ids }); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['nav-items'] }) });
};

// ── PRODUCTS PAGE CONFIG ──────────────────────────────────────────────

export const useGetProductsPageConfig = () =>
  useQuery({ queryKey: ['products-page-config'], queryFn: async () => { const res: any = await apiClient.get('/api/config/products-page'); return res; } });

export const useUpdateProductsPageConfig = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.put('/api/config/products-page', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['products-page-config'] }) });
};

// ── VOD COURSES ───────────────────────────────────────────────────────

export const useListVodCourses = (params: any = {}) =>
  useQuery({ queryKey: ['vod-courses', params], queryFn: async () => { const res: any = await apiClient.get('/api/courses', { params }); return res; } });

export const useCreateVodCourse = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post('/api/courses', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['vod-courses'] }) });
};

export const useUpdateVodCourse = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/courses/${id}`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['vod-courses'] }) });
};

export const useDeleteVodCourse = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/api/courses/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['vod-courses'] }) });
};

// ── COURSE EPISODES ───────────────────────────────────────────────────

export const useListCourseEpisodes = (courseId: string) =>
  useQuery({ queryKey: ['course-episodes', courseId], queryFn: async () => { const res: any = await apiClient.get(`/api/courses/${courseId}/episodes`); return res; }, enabled: !!courseId });

export const useCreateCourseEpisode = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post(`/api/courses/${courseId}/episodes`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['course-episodes', courseId] }) });
};

export const useUpdateCourseEpisode = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ id, data }: any) => { const res: any = await apiClient.put(`/api/courses/episodes/${id}`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['course-episodes', courseId] }) });
};

export const useDeleteCourseEpisode = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => { await apiClient.delete(`/api/courses/episodes/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['course-episodes', courseId] }) });
};

export const useReorderCourseEpisodes = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (ids: string[]) => { await apiClient.put(`/api/courses/${courseId}/episodes/reorder`, { ids }); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['course-episodes', courseId] }) });
};

// ── MISSING WORKSHOP HOOKS ────────────────────────────────────────────

export const useDeleteEnrollment = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (enrollmentId: string) => { await apiClient.delete(`/api/workshops/${workshopId}/enrollments/${enrollmentId}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-enrollments', workshopId] }) });
};

export const useDeleteQAReply = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (replyId: string) => { await apiClient.delete(`/api/workshops/qa/replies/${replyId}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-qa', workshopId] }) });
};

export const useReorderChallengeEpisodes = (workshopId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ challengeId, ids }: any) => { await apiClient.put(`/api/workshops/challenges/${challengeId}/episodes/reorder`, { ids }); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['workshop-challenges', workshopId] }) });
};

// ── MEMBER PROGRESS ───────────────────────────────────────────────────

export const useMemberProgress = (memberId: string) =>
  useQuery({ queryKey: ['member-progress', memberId], queryFn: async () => { const res: any = await apiClient.get(`/api/members/${memberId}/progress`); return res; }, enabled: !!memberId });

// ── ASSIGNMENT SUBMISSIONS ────────────────────────────────────────────

export const useListSubmissions = (assignmentId: string) =>
  useQuery({ queryKey: ['submissions', assignmentId], queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/assignments/${assignmentId}/submissions`); return res; }, enabled: !!assignmentId });

// ── NOTIFICATION STATS ────────────────────────────────────────────────

export const useGetNotificationStats = (notifId: string) =>
  useQuery({ queryKey: ['notif-stats', notifId], queryFn: async () => { const res: any = await apiClient.get(`/api/app-notifications/${notifId}/stats`); return res; }, enabled: !!notifId });

// ── MEMBER BADGES ─────────────────────────────────────────────────────

export const useListAllBadges = () =>
  useQuery({ queryKey: ['all-badges'], queryFn: async () => { const res: any = await apiClient.get('/api/members/badges/all'); return res; } });

export const useListMemberBadges = (memberId: string) =>
  useQuery({ queryKey: ['member-badges', memberId], queryFn: async () => { const res: any = await apiClient.get(`/api/members/${memberId}/badges`); return res; }, enabled: !!memberId });

export const useAssignBadge = (memberId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (badgeId: string) => { const res: any = await apiClient.post(`/api/members/${memberId}/badges`, { badgeId }); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['member-badges', memberId] }) });
};

export const useRemoveBadge = (memberId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (badgeId: string) => { await apiClient.delete(`/api/members/${memberId}/badges/${badgeId}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['member-badges', memberId] }) });
};

// ── REORDER ───────────────────────────────────────────────────────────

export const useReorderAppResources = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (ids: string[]) => { await apiClient.put('/api/app-resources/reorder', { ids }); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['app-resources'] }) });
};

export const useReorderProducts = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (ids: string[]) => { await apiClient.put('/api/products/reorder', { ids }); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }) });
};

// ── RESOURCES PAGE CONFIG ─────────────────────────────────────────────

export const useGetResourcesPageConfig = () =>
  useQuery({ queryKey: ['resources-page-config'], queryFn: async () => { const res: any = await apiClient.get('/api/config/resources-page'); return res; } });

export const useUpdateResourcesPageConfig = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.put('/api/config/resources-page', data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['resources-page-config'] }) });
};

export const useListBatches = () =>
  useQuery({ queryKey: ['batches'], queryFn: async () => { const res: any = await apiClient.get('/api/batches'); return res; } });

// ── MEMBER ENROLLMENTS ────────────────────────────────────────────────

export const useMemberEnrollments = (memberId: string) =>
  useQuery({ queryKey: ['member-enrollments', memberId], queryFn: async () => { const res: any = await apiClient.get(`/api/members/${memberId}/enrollments`); return res; }, enabled: !!memberId });

export const useEnrollMemberInWorkshop = (memberId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workshopId: string) => { const res: any = await apiClient.post(`/api/members/${memberId}/enrollments`, { workshopId }); return res.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member-enrollments', memberId] }); qc.invalidateQueries({ queryKey: ['member-progress', memberId] }); },
  });
};

export const useRemoveMemberEnrollment = (memberId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workshopId: string) => { await apiClient.delete(`/api/members/${memberId}/enrollments/${workshopId}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member-enrollments', memberId] }); qc.invalidateQueries({ queryKey: ['member-progress', memberId] }); },
  });
};

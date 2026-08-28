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

export const useWorkshopFlow = (id: string, tabActive = true) =>
  useQuery({
    queryKey: ['workshop-flow', id],
    queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/${id}/flow`); return res; },
    enabled: !!id && tabActive,
  });

export const useWorkshopChallenges = (id: string, tabActive = true) =>
  useQuery({
    queryKey: ['workshop-challenges', id],
    queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/${id}/challenges`); return res; },
    enabled: !!id && tabActive,
  });

export const useWorkshopLiveCalls = (id: string, tabActive = true) =>
  useQuery({
    queryKey: ['workshop-live-calls', id],
    queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/${id}/live-calls`); return res; },
    enabled: !!id && tabActive,
  });

export const useWorkshopAssignments = (id: string, tabActive = true) =>
  useQuery({
    queryKey: ['workshop-assignments', id],
    queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/${id}/assignments`); return res; },
    enabled: !!id && tabActive,
  });

export const useWorkshopQA = (id: string, page = 1, limit = 20, tabActive = true) =>
  useQuery({
    queryKey: ['workshop-qa', id, page, limit],
    queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/${id}/qa`, { params: { page, limit } }); return res; },
    enabled: !!id && tabActive,
  });

export const useWorkshopEnrollments = (id: string, tabActive = true) =>
  useQuery({
    queryKey: ['workshop-enrollments', id],
    queryFn: async () => { const res: any = await apiClient.get(`/api/workshops/${id}/enrollments`); return res; },
    enabled: !!id && tabActive,
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

// ── COURSE ACCESS & PAYMENTS (admin) ──────────────────────────────────

export const useListCourseAccess = (courseId: string) =>
  useQuery({ queryKey: ['course-access', courseId], queryFn: async () => { const res: any = await apiClient.get(`/api/courses/${courseId}/access`); return res; }, enabled: !!courseId });

export const useGrantCourseAccess = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post(`/api/courses/${courseId}/grant-access`, data); return res.data; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['course-access', courseId] }); qc.invalidateQueries({ queryKey: ['vod-courses'] }); } });
};

export const useRevokeCourseAccess = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (accessId: string) => { await apiClient.delete(`/api/courses/${courseId}/access/${accessId}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['course-access', courseId] }) });
};

export const useCourseAnalyticsAdmin = (courseId: string) =>
  useQuery({ queryKey: ['course-analytics', courseId], queryFn: async () => { const res: any = await apiClient.get(`/api/courses/${courseId}/analytics`); return res; }, enabled: !!courseId });

export const useListCoursePayments = (params: any = {}) =>
  useQuery({ queryKey: ['course-payments', params], queryFn: async () => { const res: any = await apiClient.get('/api/courses/payments', { params }); return res; } });

export const useApproveCoursePayment = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (paymentId: string) => { await apiClient.post(`/api/courses/${courseId}/payments/${paymentId}/approve`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-payments'] });
      qc.invalidateQueries({ queryKey: ['course-access', courseId] });
    },
  });
};

// ── Per-member progression admin controls ─────────────────────────────
// Two mutations for the sequential-unlock feature. Both call
// backend endpoints under /api/courses/:id/members/:memberId/... —
// see backend/src/modules/courses/controller.ts.

/** Wipes every CourseEpisodeProgress row for (member, course) so the
 *  member restarts from lesson 1. Idempotent. */
export const useResetMemberCourseProgress = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const res: any = await apiClient.post(
        `/api/courses/${courseId}/members/${memberId}/reset-progress`,
      );
      return res?.data ?? null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-enrollments', courseId] });
      qc.invalidateQueries({ queryKey: ['member-progress'] });
    },
  });
};

/** Grants "all lessons unlocked" for the target member on this course
 *  by writing completed=true rows for every episode. Effectively an
 *  admin override of the sequential gate. */
export const useUnlockAllLessonsForMember = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const res: any = await apiClient.post(
        `/api/courses/${courseId}/members/${memberId}/unlock-all`,
      );
      return res?.data ?? null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-enrollments', courseId] });
      qc.invalidateQueries({ queryKey: ['member-progress'] });
    },
  });
};

// ── COURSE BADGES (admin) ─────────────────────────────────────────────

export const useListCourseBadges = (courseId: string) =>
  useQuery({ queryKey: ['course-badges', courseId], queryFn: async () => { const res: any = await apiClient.get(`/api/courses/${courseId}/badges`); return res; }, enabled: !!courseId });

export const useCreateCourseBadge = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (data: any) => { const res: any = await apiClient.post(`/api/courses/${courseId}/badges`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['course-badges', courseId] }) });
};

export const useUpdateCourseBadge = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ badgeId, data }: { badgeId: string; data: any }) => { const res: any = await apiClient.put(`/api/courses/${courseId}/badges/${badgeId}`, data); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['course-badges', courseId] }) });
};

export const useDeleteCourseBadge = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (badgeId: string) => { await apiClient.delete(`/api/courses/${courseId}/badges/${badgeId}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['course-badges', courseId] }) });
};

export const useAwardCourseBadge = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async ({ badgeId, memberId }: { badgeId: string; memberId: string }) => { const res: any = await apiClient.post(`/api/courses/${courseId}/badges/${badgeId}/award`, { memberId }); return res.data; }, onSuccess: () => qc.invalidateQueries({ queryKey: ['course-badges', courseId] }) });
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

export const useListBatches = (params?: { status?: string }) =>
  useQuery({ queryKey: ['batches', params], queryFn: async () => { const res: any = await apiClient.get('/api/batches', { params }); return res; } });

export const useGetBatch = (id: string) =>
  useQuery({ queryKey: ['batch', id], queryFn: async () => { const res: any = await apiClient.get(`/api/batches/${id}`); return res; }, enabled: !!id });

export const useCreateBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => { const res: any = await apiClient.post('/api/batches', data); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
};

export const useUpdateBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => { const res: any = await apiClient.put(`/api/batches/${id}`, data); return res.data; },
    onSuccess: (_: any, vars: any) => {
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['batch', vars.id] });
    },
  });
};

export const useDeleteBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const res: any = await apiClient.delete(`/api/batches/${id}`); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
};

// ── BATCH PROGRAM (DAYS + PROGRESS) ──────────────────────────────────

export const useListBatchDays = (batchId: string) =>
  useQuery({
    queryKey: ['batch-days', batchId],
    queryFn: async () => { const res: any = await apiClient.get(`/api/batches/${batchId}/days`); return res; },
    enabled: !!batchId,
    staleTime: 30_000,
  });

export const useGetBatchDayDetail = (batchId: string, dayNumber: number | null) =>
  useQuery({
    queryKey: ['batch-day-detail', batchId, dayNumber],
    queryFn: async () => { const res: any = await apiClient.get(`/api/batches/${batchId}/days/${dayNumber}`); return res; },
    enabled: !!batchId && dayNumber !== null,
    staleTime: 10_000,
  });

export const useUpsertBatchDay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, dayNumber, ...data }: { batchId: string; dayNumber: number; title?: string; notes?: string; resourceUrl?: string; tasks?: any[]; category?: string }) => {
      const res: any = await apiClient.put(`/api/batches/${batchId}/days/${dayNumber}`, data);
      return res.data;
    },
    onSuccess: (_: any, vars: any) => {
      qc.invalidateQueries({ queryKey: ['batch-days', vars.batchId] });
      qc.invalidateQueries({ queryKey: ['batch-day-detail', vars.batchId, vars.dayNumber] });
    },
  });
};

export const useGetBatchProgress = (
  batchId: string,
  params?: { page?: number; limit?: number; memberId?: string; status?: string; dayNumber?: number },
) =>
  useQuery({
    queryKey: ['batch-progress', batchId, params],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/batches/${batchId}/progress`, { params });
      return res;
    },
    enabled: !!batchId,
    staleTime: 15_000,
  });

export const useGetMemberProgress = (batchId: string, memberId: string | null) =>
  useQuery({
    queryKey: ['member-day-progress', batchId, memberId],
    queryFn: async () => { const res: any = await apiClient.get(`/api/batches/${batchId}/progress/${memberId}`); return res; },
    enabled: !!batchId && !!memberId,
    staleTime: 10_000,
  });

export const useUpsertMemberProgress = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, memberId, dayNumber, ...data }: {
      batchId: string; memberId: string; dayNumber: number;
      isCompleted?: boolean; journalEntry?: string; journalFileUrl?: string; completedTaskIds?: string[];
    }) => {
      const res: any = await apiClient.put(`/api/batches/${batchId}/progress/${memberId}/${dayNumber}`, data);
      return res.data;
    },
    onSuccess: (_: any, vars: any) => {
      qc.invalidateQueries({ queryKey: ['batch-progress', vars.batchId] });
      qc.invalidateQueries({ queryKey: ['member-day-progress', vars.batchId, vars.memberId] });
      qc.invalidateQueries({ queryKey: ['batch-day-detail', vars.batchId, vars.dayNumber] });
    },
  });
};

export const useApproveBatchDay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, memberId, dayNumber }: { batchId: string; memberId: string; dayNumber: number }) => {
      const res: any = await apiClient.put(`/api/batches/${batchId}/progress/${memberId}/${dayNumber}/approve`);
      return res.data;
    },
    onSuccess: (_: any, vars: any) => {
      qc.invalidateQueries({ queryKey: ['batch-progress', vars.batchId] });
      qc.invalidateQueries({ queryKey: ['batch-pending', vars.batchId] });
      qc.invalidateQueries({ queryKey: ['member-day-progress', vars.batchId, vars.memberId] });
    },
  });
};

export const useRejectBatchDay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, memberId, dayNumber, reviewNote }: { batchId: string; memberId: string; dayNumber: number; reviewNote: string }) => {
      const res: any = await apiClient.put(`/api/batches/${batchId}/progress/${memberId}/${dayNumber}/reject`, { reviewNote });
      return res.data;
    },
    onSuccess: (_: any, vars: any) => {
      qc.invalidateQueries({ queryKey: ['batch-progress', vars.batchId] });
      qc.invalidateQueries({ queryKey: ['batch-pending', vars.batchId] });
      qc.invalidateQueries({ queryKey: ['member-day-progress', vars.batchId, vars.memberId] });
    },
  });
};

export const useGetBatchPending = (batchId: string) =>
  useQuery({
    queryKey: ['batch-pending', batchId],
    queryFn: async () => { const res: any = await apiClient.get(`/api/batches/${batchId}/pending`); return res; },
    enabled: !!batchId,
    staleTime: 10_000,
  });

export const useListPrograms = () =>
  useQuery({
    queryKey: ['programs'],
    queryFn: async () => { const res: any = await apiClient.get('/api/batches/programs'); return res; },
    staleTime: 60_000,
  });

export const useCreateProgram = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; durationDays?: number }) => {
      const res: any = await apiClient.post('/api/batches/programs', data);
      return res.data || res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
  });
};

export const useUpdateProgram = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; durationDays?: number } }) => {
      const res: any = await apiClient.put(`/api/batches/programs/${id}`, data);
      return res.data || res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
  });
};

export const useDeleteProgram = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/batches/programs/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['programs'] }),
  });
};

export const useGetBatchMemberAttendance = (batchId: string, memberId: string | null) =>
  useQuery({
    queryKey: ['batch-attendance', batchId, memberId],
    queryFn: async () => { const res: any = await apiClient.get(`/api/batches/${batchId}/attendance/${memberId}`); return res; },
    enabled: !!batchId && !!memberId,
    staleTime: 15_000,
  });

export const useUpsertBatchAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, memberId, dayNumber, status, notes }: { batchId: string; memberId: string; dayNumber: number; status: string; notes?: string }) => {
      const res: any = await apiClient.put(`/api/batches/${batchId}/attendance/${memberId}/${dayNumber}`, { status, notes });
      return res.data;
    },
    onSuccess: (_: any, vars: any) => qc.invalidateQueries({ queryKey: ['batch-attendance', vars.batchId, vars.memberId] }),
  });
};

export const useGetBatchBreaks = (batchId: string) =>
  useQuery({
    queryKey: ['batch-breaks', batchId],
    queryFn: async () => { const res: any = await apiClient.get(`/api/batches/${batchId}/breaks`); return res; },
    enabled: !!batchId,
    staleTime: 15_000,
  });

export const useApproveBreak = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, reqId }: { batchId: string; reqId: string }) => {
      const res: any = await apiClient.put(`/api/batches/${batchId}/breaks/${reqId}/approve`);
      return res.data;
    },
    onSuccess: (_: any, vars: any) => qc.invalidateQueries({ queryKey: ['batch-breaks', vars.batchId] }),
  });
};

export const useRejectBreak = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, reqId, adminNote }: { batchId: string; reqId: string; adminNote?: string }) => {
      const res: any = await apiClient.put(`/api/batches/${batchId}/breaks/${reqId}/reject`, { adminNote });
      return res.data;
    },
    onSuccess: (_: any, vars: any) => qc.invalidateQueries({ queryKey: ['batch-breaks', vars.batchId] }),
  });
};

export const useUpsertMemberBatchSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, memberId, extendedDays, notes }: { batchId: string; memberId: string; extendedDays: number; notes?: string }) => {
      const res: any = await apiClient.put(`/api/batches/${batchId}/members/${memberId}/settings`, { extendedDays, notes });
      return res.data;
    },
    onSuccess: (_: any, vars: any) => {
      qc.invalidateQueries({ queryKey: ['batch-progress', vars.batchId] });
      qc.invalidateQueries({ queryKey: ['member-day-progress', vars.batchId, vars.memberId] });
    },
  });
};

export const useBulkApproveBatchDays = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, items }: { batchId: string; items: Array<{ memberId: string; dayNumber: number }> }) => {
      const res: any = await apiClient.post(`/api/batches/${batchId}/pending/bulk-approve`, { items });
      return res.data;
    },
    onSuccess: (_: any, vars: any) => {
      qc.invalidateQueries({ queryKey: ['batch-pending', vars.batchId] });
      qc.invalidateQueries({ queryKey: ['batch-progress', vars.batchId] });
    },
  });
};

export const useBatchDayAnalytics = (batchId: string) =>
  useQuery({
    queryKey: ['batch-day-analytics', batchId],
    queryFn: async () => { const res: any = await apiClient.get(`/api/batches/${batchId}/day-analytics`); return res; },
    enabled: !!batchId,
    staleTime: 5 * 60 * 1_000,
  });

export const useCloneBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, startsAt }: { id: string; name: string; startsAt: string }) => {
      const res: any = await apiClient.post(`/api/batches/${id}/clone`, { name, startsAt });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
};

export const useMarkBatchComplete = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const res: any = await apiClient.post(`/api/batches/${id}/complete`); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
};

export const useArchiveBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const res: any = await apiClient.post(`/api/batches/${id}/archive`); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
};

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

// ── SECURITY LOGS ─────────────────────────────────────────────────────

export const useSecurityLogs = (params: { page?: number; limit?: number; eventType?: string; memberId?: string; search?: string } = {}) =>
  useQuery({
    queryKey: ['security-logs', params],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/security-logs', { params });
      return res;
    },
    staleTime: 30_000,
  });

export const useSecurityLogStats = () =>
  useQuery({
    queryKey: ['security-logs-stats'],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/security-logs/stats');
      return res;
    },
    staleTime: 60_000,
  });

// ── ANALYTICS ─────────────────────────────────────────────────────────

export const useMemberWatchAnalytics = (memberId: string, page = 1) =>
  useQuery({
    queryKey: ['member-watch-analytics', memberId, page],
    queryFn: async () => { const res: any = await apiClient.get(`/api/members/${memberId}/watch-analytics`, { params: { page, limit: 25 } }); return res; },
    enabled: !!memberId,
    staleTime: 30_000,
  });

export const useMemberActivityTimeline = (memberId: string, page = 1) =>
  useQuery({
    queryKey: ['member-activity-timeline', memberId, page],
    queryFn: async () => { const res: any = await apiClient.get(`/api/members/${memberId}/activity-timeline`, { params: { page, limit: 30 } }); return res; },
    enabled: !!memberId,
    staleTime: 30_000,
  });

export const useAnalyticsOverview = () =>
  useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => { const res: any = await apiClient.get('/api/members/analytics/overview'); return res; },
    staleTime: 60_000,
  });

export const useAtRiskMembers = (params: { inactiveDays?: number; completionThreshold?: number; page?: number; limit?: number } = {}) =>
  useQuery({
    queryKey: ['at-risk-members', params],
    queryFn: async () => { const res: any = await apiClient.get('/api/members/analytics/at-risk', { params }); return res; },
    staleTime: 60_000,
  });

export const useCompletionMatrix = (workshopId: string, page = 1) =>
  useQuery({
    queryKey: ['completion-matrix', workshopId, page],
    queryFn: async () => { const res: any = await apiClient.get(`/api/members/analytics/workshop/${workshopId}/matrix`, { params: { page, limit: 50 } }); return res; },
    enabled: !!workshopId,
    staleTime: 30_000,
  });

export const useAllAssignmentSubmissions = (params: { page?: number; limit?: number; reviewed?: string; workshopId?: string } = {}) =>
  useQuery({
    queryKey: ['assignment-submissions', params],
    queryFn: async () => { const res: any = await apiClient.get('/api/members/assignments', { params }); return res; },
    staleTime: 30_000,
  });

export const useReviewAssignment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ submissionId, reviewNote }: { submissionId: string; reviewNote?: string }) => {
      const res: any = await apiClient.patch(`/api/members/assignments/${submissionId}/review`, { reviewNote });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignment-submissions'] }),
  });
};

export const useGetLiveCallHostToken = () =>
  useMutation({
    mutationFn: async (liveCallId: string) => {
      const res: any = await apiClient.post(`/api/workshops/live-calls/${liveCallId}/host-token`);
      return res.data as { token: string; wsUrl: string; roomName: string };
    },
  });

export const useEndLiveCall = () =>
  useMutation({
    mutationFn: async (liveCallId: string) => {
      await apiClient.post(`/api/workshops/live-calls/${liveCallId}/end`);
    },
  });

export const useLiveCallAdminStatus = (liveCallId: string, enabled = true) =>
  useQuery({
    queryKey: ['live-call-status', liveCallId],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/workshops/live-calls/${liveCallId}/status`);
      return res.data as { isLive: boolean; participantCount: number; startedAt: string | null; endedAt: string | null };
    },
    enabled: !!liveCallId && enabled,
    refetchInterval: 10_000,
    staleTime: 8_000,
  });

// ── Host Controls ──────────────────────────────────────────────────────────────

export const useMuteParticipant = () =>
  useMutation({
    mutationFn: async ({ liveCallId, identity, trackSid, muted = true }: { liveCallId: string; identity: string; trackSid: string; muted?: boolean }) => {
      await apiClient.post(`/api/workshops/live-calls/${liveCallId}/participants/${identity}/mute`, { trackSid, muted });
    },
  });

export const useRemoveParticipant = () =>
  useMutation({
    mutationFn: async ({ liveCallId, identity }: { liveCallId: string; identity: string }) => {
      await apiClient.delete(`/api/workshops/live-calls/${liveCallId}/participants/${identity}`);
    },
  });

export const useMuteAll = () =>
  useMutation({
    mutationFn: async (liveCallId: string) => {
      await apiClient.post(`/api/workshops/live-calls/${liveCallId}/mute-all`);
    },
  });

export const useLockRoom = () =>
  useMutation({
    mutationFn: async ({ liveCallId, locked }: { liveCallId: string; locked: boolean }) => {
      await apiClient.post(`/api/workshops/live-calls/${liveCallId}/lock`, { locked });
    },
  });

export const useAdmitParticipant = () =>
  useMutation({
    mutationFn: async ({ liveCallId, memberId }: { liveCallId: string; memberId: string }) => {
      await apiClient.post(`/api/workshops/live-calls/${liveCallId}/admit`, { memberId });
    },
  });

// ── Recording ─────────────────────────────────────────────────────────────────

export const useStartRecording = () =>
  useMutation({
    mutationFn: async (liveCallId: string) => {
      const res: any = await apiClient.post(`/api/workshops/live-calls/${liveCallId}/recording/start`);
      return res.data as { egressId: string };
    },
  });

export const useStopRecording = () =>
  useMutation({
    mutationFn: async (liveCallId: string) => {
      await apiClient.post(`/api/workshops/live-calls/${liveCallId}/recording/stop`);
    },
  });

// ── Polls (admin) ─────────────────────────────────────────────────────────────

export const useGetAdminPolls = (liveCallId: string, enabled = true) =>
  useQuery({
    queryKey: ['admin-polls', liveCallId],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/workshops/live-calls/${liveCallId}/polls`);
      return res.data as Array<{ id: string; question: string; isActive: boolean; options: Array<{ id: string; optionText: string; _count: { votes: number } }> }>;
    },
    enabled: !!liveCallId && enabled,
    refetchInterval: 8_000,
  });

export const useCreatePoll = () =>
  useMutation({
    mutationFn: async ({ liveCallId, question, options }: { liveCallId: string; question: string; options: string[] }) => {
      const res: any = await apiClient.post(`/api/workshops/live-calls/${liveCallId}/polls`, { question, options });
      return res.data;
    },
  });

export const useClosePoll = () =>
  useMutation({
    mutationFn: async (pollId: string) => {
      await apiClient.post(`/api/workshops/polls/${pollId}/close`);
    },
  });

// ── Attendance ────────────────────────────────────────────────────────────────

export const useGetAttendance = (liveCallId: string, enabled = true) =>
  useQuery({
    queryKey: ['attendance', liveCallId],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/workshops/live-calls/${liveCallId}/attendance`);
      return res.data as Array<{ id: string; identity: string; joinedAt: string; leftAt: string | null; durationSec: number | null; member: { firstName: string; lastName: string; email: string; memberId: string } | null }>;
    },
    enabled: !!liveCallId && enabled,
  });

// ── Reminders ─────────────────────────────────────────────────────────────────

export const useSendReminders = () =>
  useMutation({
    mutationFn: async (liveCallId: string) => {
      const res: any = await apiClient.post(`/api/workshops/live-calls/${liveCallId}/reminders`);
      return res.data as { emailsSent: number; smsSent: number; notified: number };
    },
  });

// ── PRODUCT INQUIRIES ─────────────────────────────────────────────────────────

export const useListProductInquiries = (params: { status?: string; page?: number; limit?: number } = {}) =>
  useQuery({
    queryKey: ['product-inquiries', params],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/products/inquiries', { params });
      return res;
    },
    staleTime: 30_000,
  });

export const useUpdateInquiryStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res: any = await apiClient.patch(`/api/products/inquiries/${id}`, { status });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-inquiries'] }),
  });
};

export const useSyncEpisodeDurations = () =>
  useMutation({
    mutationFn: async () => {
      const res: any = await apiClient.post('/api/workshops/sync-durations');
      return res.data as { total: number; updated: number };
    },
  });

// ── Pre-Session Resources (admin) ─────────────────────────────────────────────

export type LiveCallResource = { id: string; liveCallId: string; title: string; url: string; type: string; order: number };

export const useListLiveCallResources = (lcid: string, enabled = true) =>
  useQuery({
    queryKey: ['live-call-resources', lcid],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/workshops/live-calls/${lcid}/resources`);
      return res.data as LiveCallResource[];
    },
    enabled: !!lcid && enabled,
  });

export const useCreateLiveCallResource = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lcid, title, url, type }: { lcid: string; title: string; url: string; type: string }) => {
      const res: any = await apiClient.post(`/api/workshops/live-calls/${lcid}/resources`, { title, url, type });
      return res.data as LiveCallResource;
    },
    onSuccess: (_d, { lcid }) => qc.invalidateQueries({ queryKey: ['live-call-resources', lcid] }),
  });
};

export const useUpdateLiveCallResource = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lcid, rid, ...fields }: { lcid: string; rid: string; title?: string; url?: string; type?: string }) => {
      const res: any = await apiClient.put(`/api/workshops/live-calls/${lcid}/resources/${rid}`, fields);
      return res.data as LiveCallResource;
    },
    onSuccess: (_d, { lcid }) => qc.invalidateQueries({ queryKey: ['live-call-resources', lcid] }),
  });
};

export const useDeleteLiveCallResource = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lcid, rid }: { lcid: string; rid: string }) => {
      await apiClient.delete(`/api/workshops/live-calls/${lcid}/resources/${rid}`);
    },
    onSuccess: (_d, { lcid }) => qc.invalidateQueries({ queryKey: ['live-call-resources', lcid] }),
  });
};

export const useReorderLiveCallResources = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lcid, ids }: { lcid: string; ids: string[] }) => {
      await apiClient.put(`/api/workshops/live-calls/${lcid}/resources/reorder`, { ids });
    },
    onSuccess: (_d, { lcid }) => qc.invalidateQueries({ queryKey: ['live-call-resources', lcid] }),
  });
};

// ── Live Call RSVPs ────────────────────────────────────────────────────────────

export const useLiveCallRsvps = (lcid: string, enabled = true) =>
  useQuery({
    queryKey: ['live-call-rsvps', lcid],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/workshops/live-calls/${lcid}/rsvps`);
      return res.data as {
        confirmed: number;
        declined: number;
        members: Array<{ id: string; status: string; confirmedAt: string; member: { id: string; firstName: string; lastName: string; email: string; memberId: string } }>;
      };
    },
    enabled: !!lcid && enabled,
  });

// ── Live Call Analytics ────────────────────────────────────────────────────────

export const useLiveCallAnalytics = (lcid: string, enabled = true) =>
  useQuery({
    queryKey: ['live-call-analytics', lcid],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/workshops/live-calls/${lcid}/analytics`);
      return res.data as {
        totalAttendees: number;
        avgStaySeconds: number;
        sessionDurationSeconds: number | null;
        pollParticipation: number;
        polls: Array<{ question: string; totalVotes: number; options: Array<{ text: string; votes: number }> }>;
      };
    },
    enabled: !!lcid && enabled,
  });

// ── AI Summary ─────────────────────────────────────────────────────────────────

export const useSummarizeLiveCall = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lcid: string) => {
      await apiClient.post(`/api/workshops/live-calls/${lcid}/summarize`);
    },
    onSuccess: (_data, lcid) => qc.invalidateQueries({ queryKey: ['live-calls', lcid] }),
  });
};

// ── Live Call Q&A (admin) ─────────────────────────────────────────────────────

export const useGetAdminLiveCallQuestions = (lcid: string, enabled = true) =>
  useQuery({
    queryKey: ['admin-live-call-questions', lcid],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/workshops/live-calls/${lcid}/questions`);
      return (res.data ?? []) as Array<{
        id: string; question: string; isAnswered: boolean; isHidden: boolean;
        answeredAt: string | null; submittedAt: string;
        member: { id: string; firstName: string | null; lastName: string | null; memberId: string };
      }>;
    },
    enabled: !!lcid && enabled,
  });

export const useUpdateLiveCallQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lcid, qid, isAnswered, isHidden }: { lcid: string; qid: string; isAnswered?: boolean; isHidden?: boolean }) => {
      const res: any = await apiClient.put(`/api/workshops/live-calls/${lcid}/questions/${qid}`, { isAnswered, isHidden });
      return res.data;
    },
    onSuccess: (_data, { lcid }) => qc.invalidateQueries({ queryKey: ['admin-live-call-questions', lcid] }),
  });
};

// ── Recording Chapters (admin) ────────────────────────────────────────────────

export type RecordingChapter = { id: string; liveCallId: string; label: string; timestampSeconds: number; order: number };

export const useGetChapters = (lcid: string, enabled = true) =>
  useQuery({
    queryKey: ['recording-chapters', lcid],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/workshops/live-calls/${lcid}/chapters`);
      return (res.data ?? []) as RecordingChapter[];
    },
    enabled: !!lcid && enabled,
  });

export const useCreateChapter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lcid, label, timestampSeconds }: { lcid: string; label: string; timestampSeconds: number }) => {
      const res: any = await apiClient.post(`/api/workshops/live-calls/${lcid}/chapters`, { label, timestampSeconds });
      return res.data as RecordingChapter;
    },
    onSuccess: (_data, { lcid }) => qc.invalidateQueries({ queryKey: ['recording-chapters', lcid] }),
  });
};

export const useDeleteChapter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lcid, chapterId }: { lcid: string; chapterId: string }) => {
      await apiClient.delete(`/api/workshops/live-calls/${lcid}/chapters/${chapterId}`);
    },
    onSuccess: (_data, { lcid }) => qc.invalidateQueries({ queryKey: ['recording-chapters', lcid] }),
  });
};

export const useReorderChapters = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lcid, ids }: { lcid: string; ids: string[] }) => {
      await apiClient.put(`/api/workshops/live-calls/${lcid}/chapters/reorder`, { ids });
    },
    onSuccess: (_data, { lcid }) => qc.invalidateQueries({ queryKey: ['recording-chapters', lcid] }),
  });
};

// ── Live Call Feedback (admin) ────────────────────────────────────────────────

export const useGetLiveCallFeedbackAdmin = (lcid: string, enabled = true) =>
  useQuery({
    queryKey: ['live-call-feedback-admin', lcid],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/workshops/live-calls/${lcid}/feedback`);
      return res.data as {
        avgRating: number; totalResponses: number;
        breakdown: Record<string, number>;
        comments: Array<{ memberName: string; comment: string | null; rating: number; submittedAt: string }>;
      };
    },
    enabled: !!lcid && enabled,
  });

// ── Co-host Promotion ─────────────────────────────────────────────────────────

export const usePromoteCoHost = () =>
  useMutation({
    mutationFn: async ({ lcid, memberId }: { lcid: string; memberId: string }) => {
      await apiClient.post(`/api/workshops/live-calls/${lcid}/co-host/${memberId}`);
    },
  });

// ── Attendance Certificates ───────────────────────────────────────────────────

export const useGenerateCertificates = () =>
  useMutation({
    mutationFn: async ({ lcid, minAttendancePercent }: { lcid: string; minAttendancePercent: number }) => {
      const res: any = await apiClient.post(`/api/workshops/live-calls/${lcid}/certificates/generate`, { minAttendancePercent });
      return res.data as { generated: number; errors: number };
    },
  });

// ── Breakout Rooms ────────────────────────────────────────────────────────────

export const useGetBreakoutRooms = (lcid: string, enabled = true) =>
  useQuery({
    queryKey: ['breakout-rooms', lcid],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/workshops/live-calls/${lcid}/breakout-rooms`);
      return (res.data ?? []) as Array<{ id: string; liveCallId: string; name: string; roomName: string; isActive: boolean; createdAt: string }>;
    },
    enabled: !!lcid && enabled,
  });

export const useCreateBreakoutRooms = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lcid, count, names }: { lcid: string; count: number; names?: string[] }) => {
      const res: any = await apiClient.post(`/api/workshops/live-calls/${lcid}/breakout-rooms`, { count, names });
      return res.data;
    },
    onSuccess: (_d, { lcid }) => qc.invalidateQueries({ queryKey: ['breakout-rooms', lcid] }),
  });
};

export const useAssignToBreakout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lcid, brid, identity }: { lcid: string; brid: string; identity: string }) => {
      const res: any = await apiClient.post(`/api/workshops/live-calls/${lcid}/breakout-rooms/${brid}/assign`, { identity });
      return res.data;
    },
    onSuccess: (_d, { lcid }) => qc.invalidateQueries({ queryKey: ['breakout-rooms', lcid] }),
  });
};

export const useRecallAll = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lcid: string) => {
      await apiClient.post(`/api/workshops/live-calls/${lcid}/breakout-rooms/recall-all`);
    },
    onSuccess: (_d, lcid) => qc.invalidateQueries({ queryKey: ['breakout-rooms', lcid] }),
  });
};

export const useDeleteBreakoutRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lcid, brid }: { lcid: string; brid: string }) => {
      await apiClient.delete(`/api/workshops/live-calls/${lcid}/breakout-rooms/${brid}`);
    },
    onSuccess: (_d, { lcid }) => qc.invalidateQueries({ queryKey: ['breakout-rooms', lcid] }),
  });
};

// ── Live Call Templates ───────────────────────────────────────────────────────

export interface LiveCallTemplate {
  id: string;
  workshopId: string;
  title: string;
  label: string;
  labelColor: string;
  recurrence: string;
  dayOfWeek: number;
  timeHour: number;
  timeMinute: number;
  durationMinutes: number;
  liveUrlUnlocksMinutesBefore: number;
  facilitatorName: string | null;
  stayTunedMessage: string;
  stayTunedColor: string;
  isActive: boolean;
  lastGeneratedAt: string | null;
  weeksAhead: number;
  createdAt: string;
}

export const useListLiveCallTemplates = (workshopId: string, enabled = true) =>
  useQuery({
    queryKey: ['live-call-templates', workshopId],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/workshops/${workshopId}/live-call-templates`);
      return (res.data ?? []) as LiveCallTemplate[];
    },
    enabled: !!workshopId && enabled,
  });

export const useCreateLiveCallTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workshopId, ...body }: Partial<LiveCallTemplate> & { workshopId: string }) => {
      const res: any = await apiClient.post(`/api/workshops/${workshopId}/live-call-templates`, body);
      return res.data as LiveCallTemplate;
    },
    onSuccess: (_d, { workshopId }) => qc.invalidateQueries({ queryKey: ['live-call-templates', workshopId] }),
  });
};

export const useUpdateLiveCallTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tid, workshopId, ...body }: Partial<LiveCallTemplate> & { tid: string; workshopId: string }) => {
      const res: any = await apiClient.put(`/api/workshops/live-call-templates/${tid}`, body);
      return res.data as LiveCallTemplate;
    },
    onSuccess: (_d, { workshopId }) => qc.invalidateQueries({ queryKey: ['live-call-templates', workshopId] }),
  });
};

export const useDeleteLiveCallTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tid, workshopId }: { tid: string; workshopId: string }) => {
      await apiClient.delete(`/api/workshops/live-call-templates/${tid}`);
    },
    onSuccess: (_d, { workshopId }) => qc.invalidateQueries({ queryKey: ['live-call-templates', workshopId] }),
  });
};

export const useGenerateNow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tid, workshopId }: { tid: string; workshopId: string }) => {
      const res: any = await apiClient.post(`/api/workshops/live-call-templates/${tid}/generate-now`);
      return res.data as { created: number };
    },
    onSuccess: (_d, { workshopId }) => {
      qc.invalidateQueries({ queryKey: ['live-call-templates', workshopId] });
      qc.invalidateQueries({ queryKey: ['workshop-live-calls'] });
    },
  });
};

export const useCourseLeaderboardAdmin = (courseId: string, limit = 20) =>
  useQuery({
    queryKey: ['course-leaderboard', courseId, limit],
    queryFn: async () => { const res: any = await apiClient.get(`/api/courses/${courseId}/leaderboard`, { params: { limit } }); return res; },
    enabled: !!courseId,
    staleTime: 60_000,
  });

// ── Admin Notifications ───────────────────────────────────────────────────────

export const useAdminNotifications = (page = 1, limit = 30) =>
  useQuery({
    queryKey: ['admin-notifications', page, limit],
    queryFn: async () => { const res: any = await apiClient.get('/api/admin-notifications', { params: { page, limit } }); return res; },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

export const useAdminUnreadCount = () =>
  useQuery({
    queryKey: ['admin-notifications-unread'],
    queryFn: async () => { const res: any = await apiClient.get('/api/admin-notifications/unread-count'); return (res?.data?.count ?? 0) as number; },
    staleTime: 0,
    refetchInterval: 30_000,
  });

export const useMarkAdminNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await apiClient.put(`/api/admin-notifications/${id}/read`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] });
      qc.invalidateQueries({ queryKey: ['admin-notifications-unread'] });
    },
  });
};

export const useMarkAllAdminNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => { await apiClient.put('/api/admin-notifications/read-all'); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] });
      qc.invalidateQueries({ queryKey: ['admin-notifications-unread'] });
    },
  });
};

// ── Ad Campaigns (TBT_ADS_SPECKIT.md §8.1) ────────────────────────────────────
//
// Client routes live at /api/ads/* and are optional-auth; everything below is
// the ADMIN scope at /api/ads/admin/* behind Clerk. Getting the prefix wrong is
// the easiest mistake here — it 401s rather than 404s, which reads like an auth
// bug instead of a wrong path.

const ADS_ADMIN = '/api/ads/admin';

export type AdCampaignStatus =
  | 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived';

export interface AdCampaignListParams {
  page?: number;
  limit?: number;
  status?: AdCampaignStatus;
  mediaType?: 'image' | 'video';
  platform?: 'web' | 'mobile';
  placement?: string;
  triggerType?: string;
  search?: string;
  startFrom?: string;
  startTo?: string;
  includeDeleted?: boolean;
}

export const useListAdCampaigns = (params: AdCampaignListParams = {}) =>
  useQuery({
    queryKey: ['ad-campaigns', params],
    queryFn: async () => {
      const res: any = await apiClient.get(`${ADS_ADMIN}/campaigns`, { params });
      return res;
    },
  });

export const useGetAdCampaign = (id: string) =>
  useQuery({
    queryKey: ['ad-campaign', id],
    queryFn: async () => {
      const res: any = await apiClient.get(`${ADS_ADMIN}/campaigns/${id}`);
      return res;
    },
    enabled: !!id,
  });

export const useCreateAdCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: any) => {
      const res: any = await apiClient.post(`${ADS_ADMIN}/campaigns`, body);
      return res;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ad-campaigns'] }); },
  });
};

export const useUpdateAdCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const res: any = await apiClient.put(`${ADS_ADMIN}/campaigns/${id}`, body);
      return res;
    },
    onSuccess: (_res, vars: any) => {
      qc.invalidateQueries({ queryKey: ['ad-campaigns'] });
      qc.invalidateQueries({ queryKey: ['ad-campaign', vars.id] });
    },
  });
};

/**
 * Status is its own endpoint, not part of the update payload — the backend
 * runs the activation gate here and rejects an incoherent campaign going live.
 * A failed activation returns NOT_ACTIVATABLE with the specific reason; surface
 * `error.message` rather than a generic toast.
 */
export const useUpdateAdCampaignStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AdCampaignStatus }) => {
      const res: any = await apiClient.patch(`${ADS_ADMIN}/campaigns/${id}/status`, { status });
      return res;
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['ad-campaigns'] });
      qc.invalidateQueries({ queryKey: ['ad-campaign', vars.id] });
    },
  });
};

export const useDuplicateAdCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res: any = await apiClient.post(`${ADS_ADMIN}/campaigns/${id}/duplicate`);
      return res;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ad-campaigns'] }); },
  });
};

/** Soft delete by default; `hard: true` also reaps the Bunny creative when no
 *  other campaign still references it. */
export const useDeleteAdCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hard }: { id: string; hard?: boolean }) => {
      const res: any = await apiClient.delete(`${ADS_ADMIN}/campaigns/${id}`, {
        params: hard ? { hard: 'true' } : undefined,
      });
      return res;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ad-campaigns'] }); },
  });
};

export const useAdCampaignAnalytics = (id: string, range?: { from?: string; to?: string }) =>
  useQuery({
    queryKey: ['ad-campaign-analytics', id, range],
    queryFn: async () => {
      const res: any = await apiClient.get(`${ADS_ADMIN}/campaigns/${id}/analytics`, { params: range });
      return res;
    },
    enabled: !!id,
  });

export const useAdAnalyticsOverview = (range?: { from?: string; to?: string }) =>
  useQuery({
    queryKey: ['ad-analytics-overview', range],
    queryFn: async () => {
      const res: any = await apiClient.get(`${ADS_ADMIN}/analytics/overview`, { params: range });
      return res;
    },
  });

// ── Batch reports (weekly/monthly WhatsApp delivery) ──────────────────

export const useReportDeliveryHistory = (params: { page?: number; limit?: number; reportType?: string; status?: string; memberId?: string } = {}) =>
  useQuery({
    queryKey: ['batch-report-history', params],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/batches/reports/history', { params });
      return res;
    },
    staleTime: 30_000,
  });

export const usePreviewBatchReport = () =>
  useMutation({
    mutationFn: async (data: { memberId: string; reportType: 'weekly' | 'monthly' }) => {
      const res: any = await apiClient.post('/api/batches/reports/preview', data);
      return res.data;
    },
  });

export const useSendTestBatchReport = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { memberId: string; reportType: 'weekly' | 'monthly'; force?: boolean }) => {
      const res: any = await apiClient.post('/api/batches/reports/send-test', data);
      return res.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['batch-report-history'] }); },
  });
};

// ── Episode Resources & Tasks ──────────────────────────────────────────

export const useListEpisodeResources = (episodeId: string) =>
  useQuery({
    queryKey: ['episode-resources', episodeId],
    queryFn: async () => { const res: any = await apiClient.get(`/api/courses/episodes/${episodeId}/resources`); return res; },
    enabled: !!episodeId,
  });

export const useCreateEpisodeResource = (episodeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => { const res: any = await apiClient.post(`/api/courses/episodes/${episodeId}/resources`, data); return res.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['episode-resources', episodeId] }); },
  });
};

export const useUpdateEpisodeResource = (episodeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const res: any = await apiClient.put(`/api/courses/episodes/${episodeId}/resources/${id}`, data); return res.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['episode-resources', episodeId] }); },
  });
};

export const useDeleteEpisodeResource = (episodeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const res: any = await apiClient.delete(`/api/courses/episodes/${episodeId}/resources/${id}`); return res.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['episode-resources', episodeId] }); },
  });
};

export const useReorderEpisodeResources = (episodeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => { const res: any = await apiClient.put(`/api/courses/episodes/${episodeId}/resources/reorder`, { ids }); return res.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['episode-resources', episodeId] }); },
  });
};

export const useListEpisodeTasks = (episodeId: string) =>
  useQuery({
    queryKey: ['episode-tasks', episodeId],
    queryFn: async () => { const res: any = await apiClient.get(`/api/courses/episodes/${episodeId}/tasks`); return res; },
    enabled: !!episodeId,
  });

export const useCreateEpisodeTask = (episodeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => { const res: any = await apiClient.post(`/api/courses/episodes/${episodeId}/tasks`, data); return res.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['episode-tasks', episodeId] }); },
  });
};

export const useUpdateEpisodeTask = (episodeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const res: any = await apiClient.put(`/api/courses/episodes/${episodeId}/tasks/${id}`, data); return res.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['episode-tasks', episodeId] }); },
  });
};

export const useDeleteEpisodeTask = (episodeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const res: any = await apiClient.delete(`/api/courses/episodes/${episodeId}/tasks/${id}`); return res.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['episode-tasks', episodeId] }); },
  });
};

export const useReorderEpisodeTasks = (episodeId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => { const res: any = await apiClient.put(`/api/courses/episodes/${episodeId}/tasks/reorder`, { ids }); return res.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['episode-tasks', episodeId] }); },
  });
};

// ── VIDEO FEEDBACK (admin) ─────────────────────────────────────────────

export const useVideoFeedbackQuestions = (episodeId: string, episodeType = 'course') =>
  useQuery({
    queryKey: ['vf-questions', episodeId, episodeType],
    queryFn: async () => { const res: any = await apiClient.get(`/api/video-feedback/admin/episodes/${episodeId}/questions`, { params: { episodeType } }); return res; },
    enabled: !!episodeId,
  });

export const useCreateVideoFeedbackQuestion = (episodeId: string, episodeType = 'course') => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { questionText: string; questionType: string; sortOrder?: number }) => {
      const res: any = await apiClient.post(`/api/video-feedback/admin/episodes/${episodeId}/questions`, { ...data, episodeType });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vf-questions', episodeId, episodeType] }),
  });
};

export const useUpdateVideoFeedbackQuestion = (episodeId: string, episodeType = 'course') => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, ...data }: { questionId: string; questionText?: string; questionType?: string; sortOrder?: number; isActive?: boolean }) => {
      const res: any = await apiClient.put(`/api/video-feedback/admin/questions/${questionId}`, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vf-questions', episodeId, episodeType] }),
  });
};

export const useDeleteVideoFeedbackQuestion = (episodeId: string, episodeType = 'course') => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => { await apiClient.delete(`/api/video-feedback/admin/questions/${questionId}`); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vf-questions', episodeId, episodeType] }),
  });
};

export const useReorderVideoFeedbackQuestions = (episodeId: string, episodeType = 'course') => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => { const res: any = await apiClient.put(`/api/video-feedback/admin/episodes/${episodeId}/questions/reorder`, { ids }); return res.data; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vf-questions', episodeId, episodeType] }),
  });
};

export const useVideoFeedbackResponses = (episodeId: string, episodeType = 'course') =>
  useQuery({
    queryKey: ['vf-responses', episodeId, episodeType],
    queryFn: async () => { const res: any = await apiClient.get(`/api/video-feedback/admin/episodes/${episodeId}/responses`, { params: { episodeType } }); return res; },
    enabled: !!episodeId,
  });

// ── COURSE SECTIONS ───────────────────────────────────────────────────

export const useListCourseSections = (courseId: string) =>
  useQuery({
    queryKey: ['course-sections', courseId],
    queryFn: async () => { const res: any = await apiClient.get(`/api/courses/${courseId}/sections`); return res?.data ?? []; },
    enabled: !!courseId,
  });

export const useCreateCourseSection = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; description?: string; timerSeconds?: number | null }) => {
      const res: any = await apiClient.post(`/api/courses/${courseId}/sections`, body); return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-sections', courseId] }),
  });
};

export const useUpdateCourseSection = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectionId, ...body }: { sectionId: string; title?: string; description?: string; timerSeconds?: number | null }) => {
      const res: any = await apiClient.put(`/api/courses/${courseId}/sections/${sectionId}`, body); return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-sections', courseId] }),
  });
};

export const useDeleteCourseSection = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sectionId: string) => {
      const res: any = await apiClient.delete(`/api/courses/${courseId}/sections/${sectionId}`); return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-sections', courseId] });
      qc.invalidateQueries({ queryKey: ['course-episodes', courseId] });
    },
  });
};

export const useReorderCourseSections = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res: any = await apiClient.put(`/api/courses/${courseId}/sections/reorder`, { ids }); return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-sections', courseId] }),
  });
};

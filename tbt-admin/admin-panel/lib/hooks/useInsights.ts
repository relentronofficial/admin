import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

/** Range sent to every /api/insights endpoint (IST dates). */
export interface InsightsRange {
  range: '7d' | '30d' | '90d' | 'custom';
  from?: string;
  to?: string;
}

const params = (r: InsightsRange) => (r.range === 'custom' ? { range: 'custom', from: r.from, to: r.to } : { range: r.range });
const enabled = (r: InsightsRange) => r.range !== 'custom' || (!!r.from && !!r.to);

function useInsight<T = any>(path: string, r: InsightsRange, opts: { enabled?: boolean; extra?: Record<string, unknown> } = {}) {
  return useQuery({
    queryKey: ['insights', path, r, opts.extra ?? null],
    queryFn: async () => {
      const res: any = await apiClient.get(`/api/insights/${path}`, { params: { ...params(r), ...(opts.extra ?? {}) } });
      return res?.data as T;
    },
    enabled: enabled(r) && (opts.enabled ?? true),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export const useInsightsOverview = (r: InsightsRange) => useInsight('overview', r);
export const useInsightsFunnels = (r: InsightsRange, on = true) => useInsight('funnels', r, { enabled: on });
export const useInsightsFunnelStuck = (r: InsightsRange, funnel: string, step: string | null) =>
  useInsight<any[]>('funnels/stuck', r, { enabled: !!step, extra: { funnel, step } });
export const useInsightsCourses = (r: InsightsRange, on = true) => useInsight<any[]>('courses', r, { enabled: on });
export const useInsightsMentorship = (r: InsightsRange, on = true) => useInsight('mentorship', r, { enabled: on });
export const useInsightsSupport = (r: InsightsRange, on = true) => useInsight('support', r, { enabled: on });
export const useInsightsRevenue = (r: InsightsRange, on = true) => useInsight('revenue', r, { enabled: on });
export const useInsightsUsage = (r: InsightsRange, on = true) => useInsight('usage', r, { enabled: on });

export const useInsightsCohorts = (months: number, on = true) =>
  useQuery({
    queryKey: ['insights', 'cohorts', months],
    queryFn: async () => ((await apiClient.get('/api/insights/cohorts', { params: { months } })) as any)?.data,
    enabled: on,
    staleTime: 5 * 60_000,
  });

export const useInsightsCourseLessons = (courseId: string | null) =>
  useQuery({
    queryKey: ['insights', 'lessons', courseId],
    queryFn: async () => ((await apiClient.get(`/api/insights/courses/${courseId}/lessons`)) as any)?.data,
    enabled: !!courseId,
    staleTime: 60_000,
  });

export const useInsightsRisk = (p: { level?: string; search?: string; page?: number; limit?: number }, on = true) =>
  useQuery({
    queryKey: ['insights', 'risk', p],
    queryFn: async () => (await apiClient.get('/api/insights/risk', { params: p })) as any,
    enabled: on,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

export const useInsightsDigestPreview = (on: boolean) =>
  useQuery({
    queryKey: ['insights', 'digest-preview'],
    queryFn: async () => ((await apiClient.get('/api/insights/digest/preview')) as any)?.data,
    enabled: on,
    staleTime: 60_000,
  });

export const useSendInsightsDigest = () =>
  useMutation({
    mutationFn: async () => ((await apiClient.post('/api/insights/digest/send')) as any)?.data,
  });

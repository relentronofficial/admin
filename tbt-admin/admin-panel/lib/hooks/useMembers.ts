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

/**
 * Multi-dimensional facets for the Members list. Every dimension is
 * optional and combinable; empty array or empty string = no filter on
 * that dimension. Mirrors the backend's [buildMembersWhereClause].
 */
export interface MemberFilters {
  batchId?: string[];
  membershipPlan?: string[];
  verificationStatus?: string[];
  gender?: string[];
  state?: string[];
  city?: string[];
  businessType?: string[];
  businessStage?: string[];
  churnRisk?: string[];
  currentTier?: number[];
  sector?: string[];
  industry?: string[];
  joinedFrom?: string;   // ISO YYYY-MM-DD
  joinedTo?: string;
  hasMarketingTeam?: boolean;
  hasVideoEditing?: boolean;
}

/**
 * Encode facet filters into repeated query params
 * (e.g. `?batchId=a&batchId=b`). Backend accepts either that shape or
 * comma-separated — repeated params round-trip cleanly through URL
 * parsers on both sides. Empty arrays / undefined / empty strings are
 * dropped so the URL only carries what's actually applied.
 */
export function encodeMemberFilters(f: MemberFilters | undefined): string {
  if (!f) return '';
  const parts: string[] = [];
  const pushArr = (key: string, arr?: Array<string | number>) => {
    if (!arr || arr.length === 0) return;
    for (const v of arr) parts.push(`${key}=${encodeURIComponent(String(v))}`);
  };
  pushArr('batchId', f.batchId);
  pushArr('membershipPlan', f.membershipPlan);
  pushArr('verificationStatus', f.verificationStatus);
  pushArr('gender', f.gender);
  pushArr('state', f.state);
  pushArr('city', f.city);
  pushArr('businessType', f.businessType);
  pushArr('businessStage', f.businessStage);
  pushArr('churnRisk', f.churnRisk);
  pushArr('currentTier', f.currentTier);
  pushArr('sector', f.sector);
  pushArr('industry', f.industry);
  if (f.joinedFrom) parts.push(`joinedFrom=${encodeURIComponent(f.joinedFrom)}`);
  if (f.joinedTo) parts.push(`joinedTo=${encodeURIComponent(f.joinedTo)}`);
  if (f.hasMarketingTeam !== undefined) parts.push(`hasMarketingTeam=${f.hasMarketingTeam}`);
  if (f.hasVideoEditing !== undefined) parts.push(`hasVideoEditing=${f.hasVideoEditing}`);
  return parts.join('&');
}

/** Count active facet dimensions — used for the badge on the Filter button. */
export function countActiveFacets(f: MemberFilters | undefined): number {
  if (!f) return 0;
  let n = 0;
  if (f.batchId?.length) n++;
  if (f.membershipPlan?.length) n++;
  if (f.verificationStatus?.length) n++;
  if (f.gender?.length) n++;
  if (f.state?.length) n++;
  if (f.city?.length) n++;
  if (f.businessType?.length) n++;
  if (f.businessStage?.length) n++;
  if (f.churnRisk?.length) n++;
  if (f.currentTier?.length) n++;
  if (f.sector?.length) n++;
  if (f.industry?.length) n++;
  if (f.joinedFrom || f.joinedTo) n++;
  if (f.hasMarketingTeam !== undefined) n++;
  if (f.hasVideoEditing !== undefined) n++;
  return n;
}

export const useListMembers = (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  showArchived?: boolean;
  facets?: MemberFilters;
} = {}) => {
  return useQuery({
    queryKey: ['members', params],
    queryFn: async () => {
      const { page = 1, limit = 10, search = '', status = '', showArchived = false, facets } = params;
      let url = `/api/members?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
      if (status && !showArchived) url += `&status=${status}`;
      if (showArchived) url += `&showArchived=true`;
      const facetQs = encodeMemberFilters(facets);
      if (facetQs) url += `&${facetQs}`;
      const res: any = await apiClient.get(url);
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

export const useApproveMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res: any = await apiClient.post(`/api/members/${id}/approve`, data);
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

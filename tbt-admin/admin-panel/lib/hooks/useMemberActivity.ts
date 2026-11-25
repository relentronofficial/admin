import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/apiClient";

export interface MemberActivityItem {
  kind: string;
  at: string;
  ref: string;
  title: string;
  detail: string | null;
  memberId: string;
  memberName: string;
  photoUrl: string | null;
  batchName: string | null;
  isNew: boolean;
}
interface ActivityPage { data: MemberActivityItem[]; meta: { asOf: string; nextBefore: string | null } }

const BASE = "/api/my-workspace/activity";
const UNREAD_KEY = ["my-workspace", "activity-unread"];

export const useMemberActivity = (params: { group?: string; memberId?: string }) =>
  useInfiniteQuery({
    queryKey: ["my-workspace", "activity", params],
    queryFn: async ({ pageParam }) =>
      (await apiClient.get(BASE, { params: { ...params, before: pageParam ?? undefined } })) as unknown as ActivityPage,
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.meta.nextBefore,
    staleTime: 0,
  });

export const useMemberActivityUnread = () =>
  useQuery({
    queryKey: UNREAD_KEY,
    queryFn: async () => ((await apiClient.get(`${BASE}/unread`)) as any).data.count as number,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

export function useMarkMemberActivitySeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (upTo: string) => apiClient.post(`${BASE}/seen`, { upTo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: UNREAD_KEY }),
  });
}

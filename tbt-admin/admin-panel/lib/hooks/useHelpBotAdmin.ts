import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/apiClient";

export type HelpBotAudience = "testers" | "all";

export interface HelpBotOverview {
  ready: boolean;
  audience: HelpBotAudience;
  dailyLimit: number;
  testers: Array<{ id: string; name: string; status: string }>;
  stats: { questions: number; members: number; up: number; down: number; offline: number; faq: number; costUsd: number };
  poor: Array<{ id: string; question: string | null; answer: string; createdAt: string }>;
}

const KEY = ["help-bot-admin"];
const BASE = "/api/help-bot/admin";

export function useHelpBotOverview() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res: any = await apiClient.get(`${BASE}/`);
      return res.data as HelpBotOverview;
    },
    retry: false,
  });
}

function useChange<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}

export const useSaveHelpBotSettings = () =>
  useChange((b: { audience: HelpBotAudience; dailyLimit: number }) => apiClient.put(`${BASE}/settings`, b));
export const useAddHelpBotTester = () => useChange((memberId: string) => apiClient.post(`${BASE}/testers`, { memberId }));
export const useRemoveHelpBotTester = () => useChange((memberId: string) => apiClient.delete(`${BASE}/testers/${memberId}`));

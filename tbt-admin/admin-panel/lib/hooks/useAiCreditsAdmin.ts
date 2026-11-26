import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/apiClient";

/** AI credits that members spend on TBT Assistant (backend: /api/ai-credits/admin). */
export interface AiCreditPack {
  id: string;
  label: string;
  credits: number;
  priceInr: number;
  isActive: boolean;
  sortOrder: number;
}

export interface AiCreditSettings {
  chargingEnabled: boolean;
  usdToInr: number;
  rateMultiplier: number;
  inrPerCredit: number;
  minCreditsToAsk: number;
  maxCreditsPerQuestion: number;
}

export interface AiCreditOrder {
  id: string;
  memberId: string;
  memberName: string | null;
  packLabel: string | null;
  credits: number;
  amountInr: number;
  status: "created" | "paid" | "failed";
  razorpayOrderId: string;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
}

const BASE = "/api/ai-credits/admin";
const PACKS = ["ai-credits-admin", "packs"];
const SETTINGS = ["ai-credits-admin", "settings"];

export const useAiCreditPacks = () =>
  useQuery({ queryKey: PACKS, queryFn: async () => ((await apiClient.get(`${BASE}/packs`)) as any).data as AiCreditPack[], retry: false });

export const useAiCreditSettings = () =>
  useQuery({ queryKey: SETTINGS, queryFn: async () => ((await apiClient.get(`${BASE}/settings`)) as any).data as AiCreditSettings, retry: false });

export const useAiCreditOrders = (status: string) =>
  useQuery({
    queryKey: ["ai-credits-admin", "orders", status],
    queryFn: async () => ((await apiClient.get(`${BASE}/orders`, { params: status ? { status } : {} })) as any).data as AiCreditOrder[],
    retry: false,
  });

export function useSaveAiCreditPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Omit<AiCreditPack, "id"> & { id?: string }) =>
      id ? apiClient.put(`${BASE}/packs/${id}`, body) : apiClient.post(`${BASE}/packs`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: PACKS }),
  });
}

export function useDeleteAiCreditPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`${BASE}/packs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: PACKS }),
  });
}

export function useSaveAiCreditSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AiCreditSettings) => apiClient.put(`${BASE}/settings`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS }),
  });
}

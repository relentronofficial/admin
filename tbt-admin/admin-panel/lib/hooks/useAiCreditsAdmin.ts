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

// ── Refunds, members, usage summary, provider balance ───────────────────────

export interface AiCreditMemberRow {
  id: string;
  name: string | null;
  phone: string | null;
  balance: number;
  lastActivityAt: string | null;
}

export interface AiCreditMemberDetail {
  member: { id: string; name: string | null; phone: string | null };
  balance: number;
  available: number;
  entries: Array<{ id: string; delta: number; source: "purchase" | "usage" | "refund" | "grant" | "adjust"; note: string | null; createdAt: string; byName: string | null }>;
  answers: Array<{ messageId: string; createdAt: string; credits: number; question: string; answer: string; refunded: boolean }>;
}

export interface AiCreditSummary {
  days: number;
  memberAnswers: number;
  chargedAnswers: number;
  memberCostUsd: number;
  chargedAnswersCostUsd: number;
  adminAnswers: number;
  adminCostUsd: number;
  creditsUsed: number;
  creditsUsedInr: number;
  creditsRefunded: number;
  creditsGranted: number;
  creditsAdjusted: number;
  paidOrders: number;
  salesInr: number;
  creditsSold: number;
  creditsOutstanding: number;
  creditsOutstandingInr: number;
  usdToInr: number;
  series: Array<{ date: string; costUsd: number; creditsUsed: number; salesInr: number }>;
}

export interface ProviderBalance {
  remainingUsd: number | null;
  limitUsd: number | null;
  usageDailyUsd: number | null;
  usageMonthlyUsd: number | null;
  source: "account" | "key_limit" | "unknown";
  error?: string;
  thresholdUsd: number;
  checkedAt: string;
  alerted: boolean;
}

const MEMBERS = ["ai-credits-admin", "members"];

export const useAiCreditMembers = (q: string) =>
  useQuery({
    queryKey: [...MEMBERS, q],
    queryFn: async () => ((await apiClient.get(`${BASE}/members`, { params: q ? { q } : {} })) as any).data as AiCreditMemberRow[],
    retry: false,
  });

export const useAiCreditMember = (id: string | null) =>
  useQuery({
    queryKey: ["ai-credits-admin", "member", id],
    queryFn: async () => ((await apiClient.get(`${BASE}/members/${id}`)) as any).data as AiCreditMemberDetail,
    enabled: !!id,
    retry: false,
  });

export const useAiCreditSummary = (days: number) =>
  useQuery({
    queryKey: ["ai-credits-admin", "summary", days],
    queryFn: async () => ((await apiClient.get(`${BASE}/summary`, { params: { days } })) as any).data as AiCreditSummary,
    retry: false,
  });

export const useProviderBalance = () =>
  useQuery({
    queryKey: ["ai-credits-admin", "provider-balance"],
    queryFn: async () => ((await apiClient.get(`${BASE}/provider-balance`)) as any).data as ProviderBalance | null,
    retry: false,
    staleTime: 60_000,
  });

export function useAdjustAiCredits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { memberId: string; kind: "grant" | "refund" | "adjust"; credits: number; note: string; messageId?: string }) =>
      apiClient.post(`${BASE}/adjust`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-credits-admin"] }),
  });
}

export function useSaveBalanceAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lowBalanceAlertUsd: number) => apiClient.put(`${BASE}/alert`, { lowBalanceAlertUsd }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-credits-admin", "provider-balance"] }),
  });
}

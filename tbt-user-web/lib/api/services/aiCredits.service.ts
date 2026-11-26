import apiClient from "../client";
import type { ApiResponse } from "@/types";

/** AI credits: the member's paid wallet for TBT Assistant answers (backend /api/ai-credits). */
export interface AiCreditWallet {
  balance: number;
  /** Balance minus credits set aside for questions still being answered. */
  available: number;
  purchaseAvailable: boolean;
  chargingEnabled: boolean;
  minCreditsToAsk: number;
  inrPerCredit: number;
}

export interface AiCreditPack {
  id: string;
  label: string;
  credits: number;
  priceInr: number;
}

export interface AiCreditEntry {
  id: string;
  delta: number;
  source: "purchase" | "usage" | "refund" | "grant" | "adjust";
  note: string | null;
  createdAt: string;
}

export interface AiCreditOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  credits: number;
  packId: string;
}

export const aiCreditsService = {
  wallet: () => apiClient.get<never, ApiResponse<AiCreditWallet>>("/api/ai-credits"),

  packs: () => apiClient.get<never, ApiResponse<{ packs: AiCreditPack[]; purchaseAvailable: boolean }>>("/api/ai-credits/packs"),

  history: (before?: string | null) =>
    apiClient.get<never, ApiResponse<AiCreditEntry[]> & { meta?: { nextBefore: string | null } }>("/api/ai-credits/history", {
      params: before ? { before } : {},
    }),

  createOrder: (packId: string) =>
    apiClient.post<never, ApiResponse<AiCreditOrder>>("/api/ai-credits/razorpay/create-order", { packId }),

  verify: (params: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    apiClient.post<never, ApiResponse<{ creditsAdded: number; balance: number; alreadyProcessed: boolean }>>(
      "/api/ai-credits/razorpay/verify",
      params,
    ),
};

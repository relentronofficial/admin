import apiClient from "../client";
import type { ApiResponse } from "@/types";

/** A TBT coin package sold via Razorpay. `id: null` is the original built-in package. */
export interface CoinPackage {
  id: string | null;
  label: string;
  coins: number;
  priceInr: number;
}

export interface CoinOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  coins: number;
  packageId: string | null;
}

export interface CoinVerifyResult {
  coinsAdded: number;
  totalCoins: number;
  alreadyProcessed: boolean;
}

export const coinsService = {
  /** Spendable TBT coins — the server's ledger sum, the same number coin spends check. */
  balance: () =>
    apiClient.get<never, ApiResponse<{ balance: number }>>("/api/user/coins/balance"),

  packages: () =>
    apiClient.get<never, ApiResponse<{ packages: CoinPackage[]; purchaseAvailable: boolean }>>("/api/user/coins/packages"),

  createOrder: (packageId: string | null) =>
    apiClient.post<never, ApiResponse<CoinOrder>>("/api/user/coins/razorpay/create-order", packageId ? { packageId } : {}),

  verify: (params: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    apiClient.post<never, ApiResponse<CoinVerifyResult>>("/api/user/coins/razorpay/verify", params),
};

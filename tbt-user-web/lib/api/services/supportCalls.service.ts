import apiClient from "../client";
import type { ApiResponse } from "@/types";

/** The six Expert Support Call categories (backend support_usage types). */
export type SupportCallCategory =
  | "sales_support"
  | "tech_support"
  | "content_support"
  | "ad_support"
  | "one_to_one"
  | "group_call";

export interface SupportCallQuota {
  allocated: number;
  used: number;
  reserved: number;
  remaining: number;
  /** Calls the plan includes (allocated minus calls unlocked with coins). */
  included?: number;
  /** Extra calls unlocked with TBT coins that are still live. */
  unlocked?: number;
}

/** The one next step a call card offers — decided by the server. */
export type SupportCallAction = "book" | "unlock_with_coins" | "purchase_coins" | "locked";
export type SupportCallLockedReason = "not_included" | "quota_exhausted" | null;

export interface SupportCallCoinInfo {
  /** Coins for one extra call once the included calls are used; null = not offered. */
  cost: number | null;
  balance: number;
  purchaseAvailable: boolean;
  action: SupportCallAction;
  lockedReason: SupportCallLockedReason;
}

export interface SupportCallSession {
  id: string;
  title: string;
  description: string | null;
  hostName: string | null;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  seatsLeft: number;
  myBooking: {
    id: string;
    status: "booked" | "attended" | "no_show";
    /** Coins this booking was paid with; null = used an included call. */
    coinCost?: number | null;
    canCancel: boolean;
    canJoin: boolean;
    joinMessage: string | null;
  } | null;
}

export interface SupportCallHistoryItem {
  bookingId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  status: "booked" | "attended" | "no_show" | "cancelled" | "session_cancelled";
  coinCost?: number | null;
}

export interface SupportCallsView {
  category: SupportCallCategory;
  quota: SupportCallQuota;
  coin?: SupportCallCoinInfo;
  sessions: SupportCallSession[];
  history: SupportCallHistoryItem[];
}

/** What the server committed — shown to the member as the booking confirmation. */
export interface SupportCallBookingConfirmation {
  id: string;
  sessionId: string;
  status: "booked";
  bookedAt: string;
  category: SupportCallCategory;
  title: string;
  startsAt: string;
  durationMinutes: number;
  hostName: string | null;
  paidWithCoins: boolean;
  coinsSpent: number;
  coinBalance: number | null;
}

export interface SupportCallsSummary {
  coinBalance: number;
  coinPurchaseAvailable: boolean;
  categories: Array<{
    category: SupportCallCategory;
    quota: SupportCallQuota;
    coinCost: number | null;
    action: SupportCallAction;
    lockedReason: SupportCallLockedReason;
  }>;
}

export interface BookSupportCallInput {
  sessionId: string;
  /** Only with an explicit member confirmation of `expectedCoinCost`. */
  payWithCoins?: boolean;
  expectedCoinCost?: number;
}

export const supportCallsService = {
  summary: () => apiClient.get<never, ApiResponse<SupportCallsSummary>>("/api/user/support-calls/summary"),

  list: (category: SupportCallCategory) =>
    apiClient.get<never, ApiResponse<SupportCallsView>>("/api/user/support-calls", {
      params: { category },
    }),

  book: ({ sessionId, payWithCoins, expectedCoinCost }: BookSupportCallInput) =>
    apiClient.post<never, ApiResponse<SupportCallBookingConfirmation>>(
      `/api/user/support-calls/sessions/${sessionId}/book`,
      payWithCoins ? { payWithCoins: true, expectedCoinCost } : {},
    ),

  cancel: (bookingId: string) =>
    apiClient.post<never, ApiResponse<{ id: string; status: string; coinsRefunded?: number }>>(
      `/api/user/support-calls/bookings/${bookingId}/cancel`,
    ),

  join: (bookingId: string) =>
    apiClient.get<never, ApiResponse<{ meetingUrl: string }>>(
      `/api/user/support-calls/bookings/${bookingId}/join`,
    ),
};

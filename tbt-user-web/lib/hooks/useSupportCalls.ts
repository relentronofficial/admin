"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket/client";
import {
  supportCallsService,
  type BookSupportCallInput,
  type SupportCallCategory,
} from "@/lib/api/services/supportCalls.service";
import { invalidateCoinBalance } from "./useCoins";

export const supportCallKeys = {
  category: (category: SupportCallCategory) => ["user", "support-calls", category] as const,
  summary: ["user", "support-calls", "summary"] as const,
  all: ["user", "support-calls"] as const,
};

/**
 * Sessions, quota (incl. reservations) and the member's own call history for one category.
 * Stays in sync with the admin's availability: the server broadcasts
 * `support_calls:changed` whenever a slot is published, edited, cancelled, removed,
 * booked or freed, and the calendar refetches. A slow poll covers missed events.
 */
export function useSupportCalls(category: SupportCallCategory | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!category) return;
    let mounted = true;
    let off: (() => void) | null = null;
    const onChanged = (p: { category?: string } | undefined) => {
      if (p?.category && p.category !== category) return;
      void qc.invalidateQueries({ queryKey: supportCallKeys.category(category) });
      void qc.invalidateQueries({ queryKey: supportCallKeys.summary });
    };
    getSocket()
      .then((socket) => {
        if (!mounted) return;
        socket.on("support_calls:changed", onChanged);
        off = () => socket.off("support_calls:changed", onChanged);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      off?.();
    };
  }, [category, qc]);

  return useQuery({
    queryKey: category ? supportCallKeys.category(category) : supportCallKeys.all,
    queryFn: async () => (await supportCallsService.list(category!)).data,
    enabled: !!category,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}


/** Per-card quota, coin price, coin balance and next action for all six call types. */
export function useSupportCallsSummary() {
  return useQuery({
    queryKey: supportCallKeys.summary,
    queryFn: async () => (await supportCallsService.summary()).data,
    staleTime: 15_000,
  });
}

// Booking or cancelling changes the category view, the dashboard tiles/summary
// and, for coin-paid calls, the member's coin balance.
function useInvalidateSupportCalls() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: supportCallKeys.all });
    void qc.invalidateQueries({ queryKey: ["user", "support-quota"] });
    void qc.invalidateQueries({ queryKey: ["user", "me"] });
    void invalidateCoinBalance(qc);
  };
}

export function useBookSupportCall() {
  const invalidate = useInvalidateSupportCalls();
  return useMutation({
    mutationFn: async (input: BookSupportCallInput) => (await supportCallsService.book(input)).data,
    onSettled: invalidate,
  });
}

export function useCancelSupportCallBooking() {
  const invalidate = useInvalidateSupportCalls();
  return useMutation({
    mutationFn: async (bookingId: string) => (await supportCallsService.cancel(bookingId)).data,
    onSettled: invalidate,
  });
}

/** Fetches the private meeting link; the server only returns it inside the join window. */
export function useJoinSupportCall() {
  return useMutation({
    mutationFn: async (bookingId: string) => (await supportCallsService.join(bookingId)).data.meetingUrl,
  });
}

/**
 * Pre-purchase N extra call slots for a category using TBT coins.
 * Coins are deducted immediately; the purchased quota is added to the member's
 * allocation so future slot bookings don't require per-slot coin payment.
 */
export function useBuyExtraSupportCalls() {
  const invalidate = useInvalidateSupportCalls();
  return useMutation({
    mutationFn: async (input: { category: SupportCallCategory; quantity: number; expectedCoinCostEach: number }) =>
      (await supportCallsService.buyExtra(input)).data,
    onSettled: invalidate,
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supportCallsService,
  type BookSupportCallInput,
  type SupportCallCategory,
} from "@/lib/api/services/supportCalls.service";

export const supportCallKeys = {
  category: (category: SupportCallCategory) => ["user", "support-calls", category] as const,
  summary: ["user", "support-calls", "summary"] as const,
  all: ["user", "support-calls"] as const,
};

/** Sessions, quota (incl. reservations) and the member's own call history for one category. */
export function useSupportCalls(category: SupportCallCategory | null) {
  return useQuery({
    queryKey: category ? supportCallKeys.category(category) : supportCallKeys.all,
    queryFn: async () => (await supportCallsService.list(category!)).data,
    enabled: !!category,
    staleTime: 15_000,
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

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supportService,
  type SubmitFeedbackBody,
  type SubmitTicketBody,
} from "@/lib/api/services/support.service";

export const supportKeys = {
  settings: ["support", "settings"] as const,
  categories: ["support", "categories"] as const,
  faqs: (params: { categoryId?: string; search?: string } = {}) =>
    ["support", "faqs", params] as const,
  faq: (id: string) => ["support", "faq", id] as const,
  tickets: ["support", "tickets"] as const,
  ticket: (id: string) => ["support", "ticket", id] as const,
};

export function useHelpdeskSettings() {
  return useQuery({
    queryKey: supportKeys.settings,
    queryFn: async () => (await supportService.getSettings()).data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSupportCategories() {
  return useQuery({
    queryKey: supportKeys.categories,
    queryFn: async () => (await supportService.listCategories()).data ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

export function useFaqs(params: { categoryId?: string; search?: string } = {}) {
  return useQuery({
    queryKey: supportKeys.faqs(params),
    queryFn: async () => (await supportService.listFaqs(params)).data ?? [],
    staleTime: 60 * 1000,
  });
}

export function useFaqById(id: string | null | undefined) {
  return useQuery({
    queryKey: supportKeys.faq(id ?? ""),
    queryFn: async () => (await supportService.getFaq(id!)).data,
    enabled: !!id,
  });
}

export function useMyTickets() {
  return useQuery({
    queryKey: supportKeys.tickets,
    queryFn: async () => (await supportService.myTickets()).data ?? [],
    staleTime: 30 * 1000,
  });
}

export function useTicketDetail(id: string) {
  return useQuery({
    queryKey: supportKeys.ticket(id),
    queryFn: async () => (await supportService.myTicketDetail(id)).data,
    enabled: !!id,
    staleTime: 15 * 1000,
  });
}

export function useSubmitTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitTicketBody) => supportService.submitTicket(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supportKeys.tickets });
    },
  });
}

export function usePostTicketReply(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => supportService.postReply(ticketId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supportKeys.ticket(ticketId) });
      qc.invalidateQueries({ queryKey: supportKeys.tickets });
    },
  });
}

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (body: SubmitFeedbackBody) => supportService.submitFeedback(body),
  });
}

/** Display helper — `#TBT-1234` or short-uuid fallback. */
export function ticketDisplayId(t: { id: string; displayNumber?: number | null }): string {
  if (t.displayNumber != null) return `#TBT-${t.displayNumber}`;
  const short = t.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `#TBT-${short}`;
}

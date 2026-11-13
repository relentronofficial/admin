"use client";

import { useQuery } from "@tanstack/react-query";
import { moduleFaqsService } from "@/lib/api/services/moduleFaqs.service";

/** Published Modules page FAQs in admin display order. Fetched only once the FAQ is opened. */
export function useModuleFaqs(enabled: boolean) {
  return useQuery({
    queryKey: ["pub", "module-faqs"],
    queryFn: async () => (await moduleFaqsService.list()).data ?? [],
    enabled,
    staleTime: 60_000,
  });
}

import apiClient from "../client";
import type { ApiResponse } from "@/types";

/** A published Modules page FAQ (the server never sends drafts). */
export interface ModuleFaq {
  id: string;
  question: string;
  answer: string;
  videoUrl?: string | null;
  bunnyVideoId?: string | null;
  /** Admin-chosen section: "ecommerce" | "service" | "coachx"; null for older FAQs. */
  category?: "ecommerce" | "service" | "coachx" | null;
}

export const moduleFaqsService = {
  list: () => apiClient.get<never, ApiResponse<ModuleFaq[]>>("/api/pub/module-faqs"),
};

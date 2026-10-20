import apiClient from "../client";
import type { ApiResponse } from "@/types";

/** A published Modules page FAQ (the server never sends drafts). */
export interface ModuleFaq {
  id: string;
  question: string;
  answer: string;
}

export const moduleFaqsService = {
  list: () => apiClient.get<never, ApiResponse<ModuleFaq[]>>("/api/pub/module-faqs"),
};

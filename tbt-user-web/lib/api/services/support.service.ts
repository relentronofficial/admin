import apiClient from "../client";
import type {
  ApiResponse,
  Faq,
  HelpdeskSettings,
  SupportCategory,
  SupportPreferredContact,
  SupportTicket,
  SupportTicketPriority,
} from "@/types";

export interface SubmitTicketBody {
  name: string;
  email: string;
  subject: string;
  message: string;
  phone?: string;
  categoryId?: string | null;
  priority?: SupportTicketPriority;
  preferredContact?: SupportPreferredContact | null;
  attachmentUrls?: string[];
}

export interface SubmitFeedbackBody {
  message: string;
  rating?: number;
  name?: string;
  email?: string;
}

export const supportService = {
  getSettings: () =>
    apiClient.get<never, ApiResponse<HelpdeskSettings>>("/api/helpdesk/settings"),

  listCategories: () =>
    apiClient.get<never, ApiResponse<SupportCategory[]>>("/api/helpdesk/categories"),

  listFaqs: (params: { categoryId?: string; search?: string } = {}) =>
    apiClient.get<never, ApiResponse<Faq[]>>("/api/helpdesk/faqs", { params }),

  getFaq: (id: string) =>
    apiClient.get<never, ApiResponse<Faq>>(`/api/helpdesk/faqs/${id}`),

  submitTicket: (body: SubmitTicketBody) =>
    apiClient.post<never, ApiResponse<SupportTicket>>("/api/helpdesk/tickets", body),

  myTickets: () =>
    apiClient.get<never, ApiResponse<SupportTicket[]>>("/api/helpdesk/tickets/mine"),

  myTicketDetail: (id: string) =>
    apiClient.get<never, ApiResponse<SupportTicket>>(`/api/helpdesk/tickets/mine/${id}`),

  postReply: (id: string, body: string) =>
    apiClient.post<never, ApiResponse<unknown>>(`/api/helpdesk/tickets/mine/${id}/replies`, {
      body,
    }),

  submitFeedback: (body: SubmitFeedbackBody) =>
    apiClient.post<never, ApiResponse<unknown>>("/api/helpdesk/feedback", body),
};

/**
 * Upload a ticket attachment through the shared `/api/upload/image` endpoint
 * (Bunny-first, R2 fallback — same flow the mobile app uses). Returns the
 * public URL on success, `null` on failure. Despite the endpoint name it
 * accepts arbitrary files thanks to the catch-all content-type parser on
 * the backend.
 */
export async function uploadTicketAttachment(file: File): Promise<string | null> {
  try {
    const contentType = file.type || "application/octet-stream";
    const buffer = await file.arrayBuffer();
    const res = await apiClient.post<never, ApiResponse<{ publicUrl: string }>>(
      "/api/upload/image",
      buffer,
      {
        params: { pathPrefix: "tickets", filename: file.name },
        headers: { "Content-Type": contentType },
        transformRequest: [(data) => data],
      },
    );
    return res.data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

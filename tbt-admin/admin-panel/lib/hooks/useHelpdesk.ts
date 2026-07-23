import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";

// ── Types ─────────────────────────────────────────────────────────
export interface HelpdeskCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  status: string;
  sortOrder: number;
}
export interface HelpdeskFaq {
  id: string;
  question: string;
  answer: string;
  categoryId: string | null;
  status: string;
  sortOrder: number;
  category?: { id: string; name: string; slug: string } | null;
}
export interface HelpdeskSettings {
  id: string;
  title: string;
  subtitle: string | null;
  whatsappNumber: string | null;
  phoneNumber: string | null;
  email: string | null;
  websiteUrl: string | null;
  supportTiming: string | null;
  address: string | null;
  buttonText: string;
  bannerImage: string | null;
  status: string;
}
export interface HelpdeskTicket {
  id: string;
  memberId: string | null;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  categoryId: string | null;
  message: string;
  attachmentUrl: string | null;
  adminNotes: string | null;
  adminReply: string | null;
  adminRepliedAt: string | null;
  status: "new" | "in_progress" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string; slug: string } | null;
  member?: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
}
export interface HelpdeskFeedback {
  id: string;
  memberId: string | null;
  name: string | null;
  email: string | null;
  rating: number | null;
  message: string;
  status: "new" | "in_progress" | "resolved" | "closed";
  createdAt: string;
  member?: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
}
export interface HelpdeskDashboard {
  tickets: { new: number; inProgress: number; resolved: number; closed: number; total: number };
  feedback: { total: number; averageRating: number | null };
  faqs: number;
  categories: number;
}

// ── Dashboard ─────────────────────────────────────────────────────
export const useHelpdeskDashboard = () =>
  useQuery({
    queryKey: ["helpdesk", "dashboard"],
    queryFn: async (): Promise<HelpdeskDashboard> => {
      const res: any = await apiClient.get("/api/helpdesk/admin/dashboard");
      return res?.data;
    },
    staleTime: 30_000,
  });

// ── Categories ────────────────────────────────────────────────────
export const useListHelpdeskCategories = () =>
  useQuery({
    queryKey: ["helpdesk", "categories"],
    queryFn: async (): Promise<HelpdeskCategory[]> => {
      const res: any = await apiClient.get("/api/helpdesk/admin/categories");
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });
export const useCreateHelpdeskCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<HelpdeskCategory>) => {
      const res: any = await apiClient.post("/api/helpdesk/admin/categories", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
};
export const useUpdateHelpdeskCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<HelpdeskCategory> }) => {
      const res: any = await apiClient.put(`/api/helpdesk/admin/categories/${id}`, data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
};
export const useDeleteHelpdeskCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/helpdesk/admin/categories/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
};

// ── FAQs ──────────────────────────────────────────────────────────
export const useListHelpdeskFaqs = () =>
  useQuery({
    queryKey: ["helpdesk", "faqs"],
    queryFn: async (): Promise<HelpdeskFaq[]> => {
      const res: any = await apiClient.get("/api/helpdesk/admin/faqs");
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });
export const useCreateHelpdeskFaq = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<HelpdeskFaq>) => {
      const res: any = await apiClient.post("/api/helpdesk/admin/faqs", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
};
export const useUpdateHelpdeskFaq = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<HelpdeskFaq> }) => {
      const res: any = await apiClient.put(`/api/helpdesk/admin/faqs/${id}`, data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
};
export const useDeleteHelpdeskFaq = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/helpdesk/admin/faqs/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
};

// ── Settings ──────────────────────────────────────────────────────
export const useGetHelpdeskSettings = () =>
  useQuery({
    queryKey: ["helpdesk", "settings"],
    queryFn: async (): Promise<HelpdeskSettings> => {
      const res: any = await apiClient.get("/api/helpdesk/admin/settings");
      return res?.data;
    },
  });
export const useUpdateHelpdeskSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<HelpdeskSettings>) => {
      const res: any = await apiClient.put("/api/helpdesk/admin/settings", data);
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
};

// ── Tickets ───────────────────────────────────────────────────────
export const useListHelpdeskTickets = (params: {
  page?: number;
  limit?: number;
  status?: string;
  categoryId?: string;
  search?: string;
} = {}) =>
  useQuery({
    queryKey: ["helpdesk", "tickets", params],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      if (params.status && params.status !== "all") q.set("status", params.status);
      if (params.categoryId) q.set("categoryId", params.categoryId);
      if (params.search) q.set("search", params.search);
      const res: any = await apiClient.get(`/api/helpdesk/admin/tickets?${q.toString()}`);
      return res as {
        data: HelpdeskTicket[];
        meta: { total: number; page: number; limit: number };
      };
    },
    placeholderData: (prev) => prev,
  });

export const useGetHelpdeskTicket = (id: string | null) =>
  useQuery({
    queryKey: ["helpdesk", "ticket", id],
    queryFn: async (): Promise<HelpdeskTicket> => {
      const res: any = await apiClient.get(`/api/helpdesk/admin/tickets/${id}`);
      return res?.data;
    },
    enabled: !!id,
  });

export const useUpdateTicketStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      adminNotes,
    }: {
      id: string;
      status: HelpdeskTicket["status"];
      adminNotes?: string | null;
    }) => {
      const res: any = await apiClient.patch(`/api/helpdesk/admin/tickets/${id}/status`, {
        status,
        adminNotes,
      });
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
};

export const useReplyHelpdeskTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      const res: any = await apiClient.post(
        `/api/helpdesk/admin/tickets/${id}/reply`,
        { reply },
      );
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
};

export const useDeleteHelpdeskTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/helpdesk/admin/tickets/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
};

// ── Feedback ──────────────────────────────────────────────────────
export const useListHelpdeskFeedback = (params: {
  page?: number;
  limit?: number;
  status?: string;
} = {}) =>
  useQuery({
    queryKey: ["helpdesk", "feedback", params],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      if (params.status && params.status !== "all") q.set("status", params.status);
      const res: any = await apiClient.get(`/api/helpdesk/admin/feedback?${q.toString()}`);
      return res as {
        data: HelpdeskFeedback[];
        meta: { total: number; page: number; limit: number };
      };
    },
    placeholderData: (prev) => prev,
  });

export const useUpdateFeedbackStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: HelpdeskFeedback["status"] }) => {
      const res: any = await apiClient.patch(`/api/helpdesk/admin/feedback/${id}/status`, { status });
      return res?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
};

export const useDeleteHelpdeskFeedback = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/helpdesk/admin/feedback/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["helpdesk"] }),
  });
};

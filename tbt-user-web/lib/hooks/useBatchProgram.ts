"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { batchProgramService } from "@/lib/api/services/batchProgram.service";

export type TaskSubmissionProof = { value?: string; url?: string; type: string };

export const useMyBatchProgram = () =>
  useQuery({
    queryKey: ["my-batch"],
    queryFn: async () => {
      const res: any = await apiClient.get("/api/user-batch");
      return res.data as {
        batch: any;
        days: any[];
        progress: any[];
        attendance?: any[];
        breaks?: any[];
        totalDays?: number;
        programName?: string | null;
        lifelinesTotal?: number;
        lifelinesUsed?: number;
        lifelinesRemaining?: number;
        processes?: {
          id: string;
          title: string;
          description?: string | null;
          position: number;
          dayNumber?: number | null;
        }[];
        programTasks?: {
          id: string;
          dayNumber: number;
          title: string;
          description?: string | null;
          deliverables?: string | null;
          contentUrl?: string | null;
          basePoints: number;
          bonusPoints: number;
          proofType: string;
          estimatedMinutes: number;
          timerSeconds?: number | null;
          isMilestone: boolean;
          milestoneLabel?: string | null;
          sortOrder: number;
          processId?: string | null;
          processTitle?: string | null;
          stagePosition?: number | null;
          stageLocked?: boolean;
          totalStagesInProcess?: number;
        }[];
        mySubmissions?: {
          id: string;
          taskId: string;
          dayNumber: number;
          status: string;
          responseValue?: string | null;
          proofUrl?: string | null;
          proofType?: string | null;
        }[];
      } | null;
    },
    staleTime: 30_000,
  });

// Keyed under ["my-batch", ...] so every mutation and socket handler that
// already invalidates ["my-batch"] refreshes the graph too (prefix match).
export const weeklyGraphQueryKey = ["my-batch", "weekly-graph"] as const;

export const useMyWeeklyGraph = () =>
  useQuery({
    queryKey: weeklyGraphQueryKey,
    queryFn: async () => {
      const res = await batchProgramService.getMyWeeklyGraph();
      if (!res?.success) throw new Error(res?.error?.message ?? "Failed to load weekly graph");
      return res.data ?? null;
    },
    staleTime: 30_000,
  });

export const useSaveBatchDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      dayNumber,
      journalEntry,
      journalFileUrl,
      completedTaskIds,
      taskSubmissions,
    }: {
      dayNumber: number;
      journalEntry?: string;
      journalFileUrl?: string;
      completedTaskIds?: string[];
      taskSubmissions?: Record<string, TaskSubmissionProof>;
    }) => {
      const res: any = await apiClient.put(`/api/user-batch/${dayNumber}`, {
        journalEntry,
        journalFileUrl,
        completedTaskIds,
        taskSubmissions,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-batch"] }),
  });
};

export const useUploadTaskProof = () => {
  const upload = async (file: File, batchId: string, dayNumber: number): Promise<string> => {
    const res: any = await apiClient.post('/api/upload/presigned-url', {
      filename: file.name,
      contentType: file.type,
      bucket: 'batch-proofs',
      pathPrefix: `${batchId}/day-${dayNumber}`,
    });
    const { uploadUrl, publicUrl } = res.data;
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    return publicUrl;
  };
  return { upload };
};

export const useSubmitBatchDay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dayNumber: number) => {
      const res: any = await apiClient.post(`/api/user-batch/${dayNumber}/submit`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-batch"] });
      qc.invalidateQueries({ queryKey: ["user", "streak"] });
      qc.invalidateQueries({ queryKey: ["user", "mentorship-stats"] }); // Tier Access active days
    },
  });
};

export const useMarkAttendance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dayNumber: number; notes?: string }) =>
      apiClient.post('/api/user-batch/attendance', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-batch'] }),
  });
};

export const useRequestBreak = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { startDay: number; endDay: number; reason?: string }) =>
      apiClient.post('/api/user-batch/break', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-batch'] }),
  });
};

export const useSpendCoins = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ amount, taskId, dayNumber }: { amount: number; taskId?: string; dayNumber?: number }) => {
      const res: any = await apiClient.post('/api/user-batch/spend-coins', { amount, taskId, dayNumber });
      return res.data as { remainingCoins: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user", "me"] }),
  });
};

// ── MG-02: Program-Wide Lifeline Use ─────────────────────────────────────────

export const useUseProgramLifeline = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { batchId: string; taskId?: string; episodeId?: string; context: 'task' | 'episode' }) => {
      const res: any = await apiClient.post('/api/user-batch/lifeline/use', body);
      // The backend answers "exhausted" with HTTP 200 + success:false, which the response
      // interceptor resolves — surface it as a rejection carrying the error code.
      if (!res?.success || !res.data) {
        const err: any = new Error(res?.error ?? 'Failed to use lifeline');
        err.code = res?.error;
        throw err;
      }
      return res.data as { lifelinesRemaining: number; lifelinesTotal: number; lifelinesUsed: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-batch'] }),
  });
};

export const useDownloadBatchCertificate = () => {
  return useMutation({
    mutationFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const deviceId = typeof window !== 'undefined' ? (localStorage.getItem('tbt_device_id') ?? '') : '';
      const response = await fetch(`${baseUrl}/api/user-batch/certificate`, {
        credentials: 'include',
        headers: { 'x-device-id': deviceId },
      });
      if (!response.ok) {
        let msg = 'Failed to download certificate';
        try { const j = await response.json(); msg = j.error ?? j.message ?? msg; } catch {}
        throw new Error(msg);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'batch-certificate.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
};

// ── Extra Lifeline purchase (Razorpay) ─────────────────────────────────────────
// One program lifeline at the admin-configured price. The browser only opens
// checkout; the lifeline is added by the backend after it verifies the payment
// (POST /api/user/lifelines/razorpay/verify), and the hearts are then refreshed
// from GET /api/user-batch — never from the checkout callback alone.

export type ExtraLifelineOutcome = "success" | "cancelled" | "failed" | "pending" | "error" | "busy";

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as any).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve(!!(window as any).Razorpay));
    s.addEventListener("error", () => resolve(false));
    if (!existing) {
      s.src = RAZORPAY_CHECKOUT_SRC;
      s.async = true;
      document.body.appendChild(s);
    }
  });
}

type CheckoutResult = { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string } | "cancelled" | "failed";

export const useBuyExtraLifeline = ({ pendingRetryDelayMs = 3000, pendingRetries = 2 } = {}) => {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const buy = useCallback(async (): Promise<ExtraLifelineOutcome> => {
    if (busyRef.current) return "busy";
    busyRef.current = true;
    setBusy(true);
    try {
      if (!(await loadRazorpayCheckout())) return "error";
      let order;
      try {
        const res = await batchProgramService.createLifelineOrder();
        if (!res?.success || !res.data) return "error";
        order = res.data;
      } catch {
        return "error";
      }

      const paid = await new Promise<CheckoutResult>((resolve) => {
        let settled = false;
        let attemptFailed = false;
        const done = (v: CheckoutResult) => {
          if (settled) return;
          settled = true;
          resolve(v);
        };
        const rzp = new (window as any).Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: "Tamil Business Tribe",
          description: order.label,
          handler: (r: any) =>
            done({ razorpayOrderId: r.razorpay_order_id ?? order.orderId, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature }),
          // A failed attempt keeps checkout open for a retry; it only counts once the member closes it.
          modal: { ondismiss: () => done(attemptFailed ? "failed" : "cancelled") },
        });
        rzp.on("payment.failed", () => {
          attemptFailed = true;
        });
        rzp.open();
      });
      if (paid === "cancelled" || paid === "failed") return paid;

      for (let attempt = 0; ; attempt++) {
        try {
          const res: any = await batchProgramService.verifyLifelinePayment(paid);
          if (res?.success) {
            await Promise.all([
              qc.invalidateQueries({ queryKey: ["my-batch"] }),
              qc.invalidateQueries({ queryKey: ["user", "support-quota"] }),
            ]);
            return "success";
          }
          // 202 PAYMENT_PENDING: captured money not settled yet — ask again shortly.
          if (res?.error?.message !== "PAYMENT_PENDING" || attempt >= pendingRetries) return res?.error?.message === "PAYMENT_PENDING" ? "pending" : "error";
        } catch (err: any) {
          return err?.response?.status === 402 ? "failed" : "error";
        }
        await new Promise((r) => setTimeout(r, pendingRetryDelayMs));
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [qc, pendingRetryDelayMs, pendingRetries]);

  return { buy, busy };
};

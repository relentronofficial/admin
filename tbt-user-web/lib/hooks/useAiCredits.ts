"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiCreditsService, type AiCreditPack } from "@/lib/api/services/aiCredits.service";
import { loadRazorpayCheckout, openRazorpayCheckout } from "@/lib/razorpayCheckout";

const WALLET_KEY = ["user", "ai-credits", "wallet"] as const;
const HISTORY_KEY = ["user", "ai-credits", "history"] as const;

/** The member's AI credits, straight from the server's ledger. */
export function useAiCreditWallet(enabled = true) {
  return useQuery({
    queryKey: WALLET_KEY,
    queryFn: async () => (await aiCreditsService.wallet()).data,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useAiCreditPacks(enabled = true) {
  return useQuery({
    queryKey: ["user", "ai-credits", "packs"],
    queryFn: async () => (await aiCreditsService.packs()).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useAiCreditHistory() {
  return useInfiniteQuery({
    queryKey: HISTORY_KEY,
    queryFn: async ({ pageParam }) => {
      const res = await aiCreditsService.history(pageParam);
      return { items: res.data ?? [], nextBefore: res.meta?.nextBefore ?? null };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
  });
}

/** Refresh the wallet and history after something earned or spent credits (e.g. an assistant answer). */
export function useRefreshAiCredits() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: WALLET_KEY });
    void qc.invalidateQueries({ queryKey: HISTORY_KEY });
  };
}

export type AiCreditPurchaseState =
  | { status: "idle" }
  | { status: "working"; step: "order" | "checkout" | "verifying" }
  | { status: "success"; creditsAdded: number; balance: number }
  | { status: "failed"; message: string }
  | { status: "cancelled" }
  /** Paid, but the confirmation didn't come back; the Razorpay webhook still credits it. */
  | { status: "pending"; message: string };

/** Buys one pack: create order → Razorpay checkout → server verify. */
export function useAiCreditPurchase() {
  const refresh = useRefreshAiCredits();
  const [state, setState] = useState<AiCreditPurchaseState>({ status: "idle" });
  const busy = state.status === "working";

  const buy = async (pack: AiCreditPack) => {
    if (busy) return;
    setState({ status: "working", step: "order" });
    if (!(await loadRazorpayCheckout())) {
      setState({ status: "failed", message: "The payment window couldn't load. Check your connection and try again." });
      return;
    }
    let order;
    try {
      order = (await aiCreditsService.createOrder(pack.id)).data;
    } catch (err: any) {
      setState({
        status: "failed",
        message: err?.message === "RAZORPAY_NOT_CONFIGURED" ? "Buying credits isn't available right now." : "Couldn't start the payment. Please try again.",
      });
      return;
    }
    setState({ status: "working", step: "checkout" });
    const outcome = await openRazorpayCheckout({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      orderId: order.orderId,
      description: `${order.credits} AI credits`,
    });
    if (outcome.kind === "dismissed") {
      setState({ status: "cancelled" });
      return;
    }
    if (outcome.kind === "failed") {
      setState({ status: "failed", message: outcome.reason });
      return;
    }
    setState({ status: "working", step: "verifying" });
    try {
      const res = (
        await aiCreditsService.verify({
          razorpayOrderId: outcome.razorpayOrderId,
          razorpayPaymentId: outcome.razorpayPaymentId,
          razorpaySignature: outcome.razorpaySignature,
        })
      ).data;
      setState({ status: "success", creditsAdded: res.creditsAdded || order.credits, balance: res.balance });
    } catch {
      setState({
        status: "pending",
        message: "Payment received. We're still confirming it, and your credits will appear automatically shortly. Please don't pay again.",
      });
    } finally {
      refresh();
    }
  };

  return { state, busy, buy, reset: () => setState({ status: "idle" }) };
}

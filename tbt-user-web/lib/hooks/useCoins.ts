"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { coinsService, type CoinPackage } from "@/lib/api/services/coins.service";
import { loadRazorpayCheckout, openRazorpayCheckout } from "@/lib/razorpayCheckout";

export function useCoinPackages(enabled = true) {
  return useQuery({
    queryKey: ["user", "coin-packages"],
    queryFn: async () => (await coinsService.packages()).data,
    enabled,
    staleTime: 60_000,
  });
}

export type CoinPurchaseState =
  | { status: "idle" }
  | { status: "working"; step: "order" | "checkout" | "verifying" }
  | { status: "success"; coinsAdded: number; balance: number }
  | { status: "failed"; message: string }
  | { status: "cancelled" }
  /** Paid, but the confirmation didn't come back; the Razorpay webhook still credits it. */
  | { status: "pending"; message: string };

/**
 * Buys one coin package: create order → Razorpay checkout → server verify.
 * It only adds coins — it never books a call or spends the new coins.
 */
export function useCoinPurchase() {
  const qc = useQueryClient();
  const [state, setState] = useState<CoinPurchaseState>({ status: "idle" });
  const busy = state.status === "working";

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["user", "support-calls"] });
    void qc.invalidateQueries({ queryKey: ["user", "me"] });
  };

  const buy = async (pkg: CoinPackage) => {
    if (busy) return;
    setState({ status: "working", step: "order" });
    const loaded = await loadRazorpayCheckout();
    if (!loaded) {
      setState({ status: "failed", message: "The payment window couldn't load. Check your connection and try again." });
      return;
    }
    let order;
    try {
      order = (await coinsService.createOrder(pkg.id)).data;
    } catch (err: any) {
      setState({
        status: "failed",
        message: err?.message === "RAZORPAY_NOT_CONFIGURED" ? "Coin purchase isn't available right now." : "Couldn't start the payment. Please try again.",
      });
      return;
    }
    setState({ status: "working", step: "checkout" });
    const outcome = await openRazorpayCheckout({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      orderId: order.orderId,
      description: `${order.coins} TBT Coins`,
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
        await coinsService.verify({
          razorpayOrderId: outcome.razorpayOrderId,
          razorpayPaymentId: outcome.razorpayPaymentId,
          razorpaySignature: outcome.razorpaySignature,
        })
      ).data;
      setState({ status: "success", coinsAdded: res.coinsAdded || order.coins, balance: res.totalCoins });
    } catch {
      setState({
        status: "pending",
        message: "Payment received. We're still confirming it, and your coins will appear automatically shortly. Please don't pay again.",
      });
    } finally {
      refresh();
    }
  };

  return { state, busy, buy, reset: () => setState({ status: "idle" }) };
}

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const svc = vi.hoisted(() => ({
  createLifelineOrder: vi.fn(),
  verifyLifelinePayment: vi.fn(),
}));
vi.mock("@/lib/api/services/batchProgram.service", () => ({ batchProgramService: svc }));

import { useBuyExtraLifeline, extraLifelineMessage, type ExtraLifelineResult } from "./useBatchProgram";

const ORDER = { orderId: "order_1", amount: 19900, currency: "INR", keyId: "rzp_test_key", label: "Extra Lifeline" };
const PAID = { razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "sig" };
/**
 * How the REAL apiClient (lib/api/client.ts) rejects a 4xx/5xx from our backend:
 * its interceptor throws new Error(body.error.message) — the HTTP status is dropped.
 */
const httpError = (_status: number, code: string) => new Error(code);
/** A raw axios error, in case a caller bypasses the interceptor. */
const rawAxiosError = (status: number, code: string) => ({ response: { status, data: { success: false, data: null, error: { code: "ERROR", message: code } } } });

/** Fake Razorpay checkout: the test decides what the member does once it opens. */
let checkout: { options: any; events: Record<string, () => void>; opened: boolean } | null;
let memberAction: (c: NonNullable<typeof checkout>) => void;
class FakeRazorpay {
  constructor(options: any) {
    checkout = { options, events: {}, opened: false };
  }
  on(event: string, cb: () => void) {
    checkout!.events[event] = cb;
  }
  open() {
    checkout!.opened = true;
    memberAction(checkout!);
  }
}

let qc: QueryClient;
let invalidated: unknown[][];
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
const run = async () => {
  const { result } = renderHook(() => useBuyExtraLifeline({ pendingRetryDelayMs: 0, pendingRetries: 2 }), { wrapper });
  let res: ExtraLifelineResult | undefined;
  await act(async () => {
    res = await result.current.buy();
  });
  return res!;
};

beforeEach(() => {
  qc = new QueryClient();
  invalidated = [];
  vi.spyOn(qc, "invalidateQueries").mockImplementation(async (f: any) => {
    invalidated.push(f.queryKey);
  });
  checkout = null;
  (window as any).Razorpay = FakeRazorpay;
  svc.createLifelineOrder.mockReset().mockResolvedValue({ success: true, data: ORDER });
  svc.verifyLifelinePayment.mockReset().mockResolvedValue({
    success: true,
    data: { lifelineAdded: true, alreadyProcessed: false, lifelinesTotal: 4, lifelinesUsed: 3, lifelinesRemaining: 1 },
  });
  memberAction = (c) => c.options.handler(PAID);
});
afterEach(() => {
  delete (window as any).Razorpay;
  document.querySelectorAll('script[src*="checkout.razorpay.com"]').forEach((s) => s.remove());
});

describe("useBuyExtraLifeline", () => {
  it("opens checkout for the server-created order and succeeds only after server verification, then refreshes the hearts", async () => {
    expect(await run()).toEqual({ outcome: "success" });
    expect(svc.createLifelineOrder).toHaveBeenCalledTimes(1);
    expect(checkout!.options).toMatchObject({ key: "rzp_test_key", order_id: "order_1", amount: 19900, currency: "INR", description: "Extra Lifeline" });
    expect(svc.verifyLifelinePayment).toHaveBeenCalledWith({ razorpayOrderId: "order_1", razorpayPaymentId: "pay_1", razorpaySignature: "sig" });
    expect(invalidated).toContainEqual(["my-batch"]);
  });

  it("the checkout callback alone is not success: a rejected verification adds nothing and refreshes nothing", async () => {
    svc.verifyLifelinePayment.mockRejectedValue(httpError(400, "SIGNATURE_INVALID"));
    expect(await run()).toEqual({ outcome: "error", stage: "verify", code: "SIGNATURE_INVALID" });
    expect(invalidated).toEqual([]);
  });

  it("closing checkout without paying is a cancellation — nothing is verified", async () => {
    memberAction = (c) => c.options.modal.ondismiss();
    expect(await run()).toEqual({ outcome: "cancelled" });
    expect(svc.verifyLifelinePayment).not.toHaveBeenCalled();
    expect(invalidated).toEqual([]);
  });

  it("a failed payment attempt followed by closing checkout is a failure", async () => {
    memberAction = (c) => {
      c.events["payment.failed"]();
      c.options.modal.ondismiss();
    };
    expect((await run()).outcome).toBe("failed");
    expect(svc.verifyLifelinePayment).not.toHaveBeenCalled();
  });

  it("a failed attempt then a successful retry in the same checkout still succeeds", async () => {
    memberAction = (c) => {
      c.events["payment.failed"]();
      c.options.handler(PAID);
    };
    expect((await run()).outcome).toBe("success");
  });

  it("the server reporting the payment failed (402) is a failure", async () => {
    svc.verifyLifelinePayment.mockRejectedValue(httpError(402, "PAYMENT_FAILED"));
    expect(await run()).toEqual({ outcome: "failed", stage: "verify", code: "PAYMENT_FAILED" });
  });

  it("a pending payment is re-checked, and succeeds once the server confirms it", async () => {
    svc.verifyLifelinePayment
      .mockResolvedValueOnce({ success: false, data: null, error: { code: "ERROR", message: "PAYMENT_PENDING" } })
      .mockResolvedValueOnce({ success: true, data: { lifelineAdded: true } });
    expect((await run()).outcome).toBe("success");
    expect(svc.verifyLifelinePayment).toHaveBeenCalledTimes(2);
  });

  it("a payment still pending after the retries is reported as pending, not success", async () => {
    svc.verifyLifelinePayment.mockResolvedValue({ success: false, data: null, error: { code: "ERROR", message: "PAYMENT_PENDING" } });
    expect((await run()).outcome).toBe("pending");
    expect(svc.verifyLifelinePayment).toHaveBeenCalledTimes(3);
    expect(invalidated).toEqual([]);
  });

  it("an order-creation error keeps the backend reason code and never opens checkout", async () => {
    for (const [status, code] of [[503, "PRICE_NOT_CONFIGURED"], [400, "NOT_IN_BATCH"], [503, "LIFELINE_TABLE_MISSING"], [502, "ORDER_CREATE_FAILED"]] as const) {
      checkout = null;
      svc.createLifelineOrder.mockRejectedValueOnce(httpError(status, code));
      expect(await run()).toEqual({ outcome: "error", stage: "order", code });
      expect(checkout).toBeNull();
    }
    svc.createLifelineOrder.mockRejectedValueOnce(rawAxiosError(503, "PRICE_NOT_CONFIGURED"));
    expect(await run()).toEqual({ outcome: "error", stage: "order", code: "PRICE_NOT_CONFIGURED" });
    svc.createLifelineOrder.mockRejectedValueOnce(new Error("Network Error")); // no backend response at all → no code
    expect(await run()).toEqual({ outcome: "error", stage: "order", code: undefined });
  });

  it("a checkout script that fails to load is reported as such — no order is created", async () => {
    delete (window as any).Razorpay;
    const { result } = renderHook(() => useBuyExtraLifeline(), { wrapper });
    let pending!: Promise<ExtraLifelineResult>;
    act(() => {
      pending = result.current.buy();
    });
    await vi.waitFor(() => expect(document.querySelector('script[src*="checkout.razorpay.com"]')).toBeTruthy());
    document.querySelector('script[src*="checkout.razorpay.com"]')!.dispatchEvent(new Event("error"));
    let res!: ExtraLifelineResult;
    await act(async () => {
      res = await pending;
    });
    expect(res).toEqual({ outcome: "error", stage: "checkout", code: "CHECKOUT_LOAD_FAILED" });
    expect(svc.createLifelineOrder).not.toHaveBeenCalled();
  });

  it("ignores a second click while a purchase is in progress", async () => {
    let finish!: () => void;
    memberAction = (c) => {
      finish = () => c.options.handler(PAID);
    };
    const { result } = renderHook(() => useBuyExtraLifeline({ pendingRetryDelayMs: 0 }), { wrapper });
    let first!: Promise<ExtraLifelineResult>;
    await act(async () => {
      first = result.current.buy();
      await Promise.resolve();
    });
    expect(result.current.busy).toBe(true);
    let second: ExtraLifelineResult | undefined;
    await act(async () => {
      second = await result.current.buy();
    });
    expect(second).toEqual({ outcome: "busy" });
    await act(async () => {
      finish();
      await first;
    });
    expect(result.current.busy).toBe(false);
    expect(svc.createLifelineOrder).toHaveBeenCalledTimes(1);
  });
});

describe("extraLifelineMessage", () => {
  it("keeps the success / cancel / failure messages", () => {
    expect(extraLifelineMessage({ outcome: "success" })).toEqual({ kind: "success", text: "Extra lifeline added!" });
    expect(extraLifelineMessage({ outcome: "cancelled" })).toEqual({ kind: "info", text: "Payment cancelled — no lifeline added." });
    expect(extraLifelineMessage({ outcome: "failed" })).toEqual({ kind: "error", text: "Payment failed — no lifeline added." });
    expect(extraLifelineMessage({ outcome: "busy" })).toBeNull();
  });

  it("order errors say no payment was taken and carry a safe reference code", () => {
    const unavailable = extraLifelineMessage({ outcome: "error", stage: "order", code: "PRICE_NOT_CONFIGURED" })!;
    expect(unavailable.text).toContain("temporarily unavailable");
    expect(unavailable.text).toContain("no payment was taken");
    expect(unavailable.text).toContain("ref: PRICE_NOT_CONFIGURED");
    expect(extraLifelineMessage({ outcome: "error", stage: "order", code: "NOT_IN_BATCH" })!.text).toContain("batch program members");
    expect(extraLifelineMessage({ outcome: "error", stage: "order", code: "ORDER_CREATE_FAILED" })!.text).toContain("Couldn't start the payment");
    expect(extraLifelineMessage({ outcome: "error", stage: "order" })!.text).not.toContain("ref:");
    expect(extraLifelineMessage({ outcome: "error", stage: "checkout", code: "CHECKOUT_LOAD_FAILED" })!.text).toContain("payment window");
  });

  it("errors after payment explain that a charged payment is credited automatically", () => {
    const m = extraLifelineMessage({ outcome: "error", stage: "verify", code: "RAZORPAY_UNAVAILABLE" })!;
    expect(m.kind).toBe("error");
    expect(m.text).toContain("added automatically");
    expect(m.text).toContain("ref: RAZORPAY_UNAVAILABLE");
    expect(extraLifelineMessage({ outcome: "pending", stage: "verify" })!.text).toContain("added automatically");
  });
});

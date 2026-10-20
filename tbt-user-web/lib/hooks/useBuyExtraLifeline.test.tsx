import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const svc = vi.hoisted(() => ({
  createLifelineOrder: vi.fn(),
  verifyLifelinePayment: vi.fn(),
}));
vi.mock("@/lib/api/services/batchProgram.service", () => ({ batchProgramService: svc }));

import { useBuyExtraLifeline } from "./useBatchProgram";

const ORDER = { orderId: "order_1", amount: 19900, currency: "INR", keyId: "rzp_test_key", label: "Extra Lifeline" };
const PAID = { razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "sig" };

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
  let outcome: string | undefined;
  await act(async () => {
    outcome = await result.current.buy();
  });
  return outcome;
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
    data: { lifelineAdded: true, alreadyProcessed: false, lifelinesTotal: 4, lifelinesUsed: 1, lifelinesRemaining: 3 },
  });
  memberAction = (c) => c.options.handler(PAID);
});
afterEach(() => {
  delete (window as any).Razorpay;
});

describe("useBuyExtraLifeline", () => {
  it("opens checkout for the server-created order and succeeds only after server verification, then refreshes the hearts", async () => {
    expect(await run()).toBe("success");
    expect(svc.createLifelineOrder).toHaveBeenCalledTimes(1);
    expect(checkout!.options).toMatchObject({ key: "rzp_test_key", order_id: "order_1", amount: 19900, currency: "INR", description: "Extra Lifeline" });
    expect(svc.verifyLifelinePayment).toHaveBeenCalledWith({ razorpayOrderId: "order_1", razorpayPaymentId: "pay_1", razorpaySignature: "sig" });
    expect(invalidated).toContainEqual(["my-batch"]);
  });

  it("the checkout callback alone is not success: a rejected verification adds nothing and refreshes nothing", async () => {
    svc.verifyLifelinePayment.mockRejectedValue({ response: { status: 400 } });
    expect(await run()).toBe("error");
    expect(invalidated).toEqual([]);
  });

  it("closing checkout without paying is a cancellation — nothing is verified", async () => {
    memberAction = (c) => c.options.modal.ondismiss();
    expect(await run()).toBe("cancelled");
    expect(svc.verifyLifelinePayment).not.toHaveBeenCalled();
  });

  it("a failed payment attempt followed by closing checkout is a failure", async () => {
    memberAction = (c) => {
      c.events["payment.failed"]();
      c.options.modal.ondismiss();
    };
    expect(await run()).toBe("failed");
    expect(svc.verifyLifelinePayment).not.toHaveBeenCalled();
  });

  it("a failed attempt then a successful retry in the same checkout still succeeds", async () => {
    memberAction = (c) => {
      c.events["payment.failed"]();
      c.options.handler(PAID);
    };
    expect(await run()).toBe("success");
  });

  it("the server reporting the payment failed (402) is a failure", async () => {
    svc.verifyLifelinePayment.mockRejectedValue({ response: { status: 402 } });
    expect(await run()).toBe("failed");
  });

  it("a pending payment is re-checked, and succeeds once the server confirms it", async () => {
    svc.verifyLifelinePayment
      .mockResolvedValueOnce({ success: false, error: { message: "PAYMENT_PENDING" } })
      .mockResolvedValueOnce({ success: true, data: { lifelineAdded: true } });
    expect(await run()).toBe("success");
    expect(svc.verifyLifelinePayment).toHaveBeenCalledTimes(2);
  });

  it("a payment still pending after the retries is reported as pending, not success", async () => {
    svc.verifyLifelinePayment.mockResolvedValue({ success: false, error: { message: "PAYMENT_PENDING" } });
    expect(await run()).toBe("pending");
    expect(svc.verifyLifelinePayment).toHaveBeenCalledTimes(3);
    expect(invalidated).toEqual([]);
  });

  it("if the order can't be created, checkout never opens", async () => {
    svc.createLifelineOrder.mockRejectedValue(new Error("503"));
    expect(await run()).toBe("error");
    expect(checkout).toBeNull();
  });

  it("ignores a second click while a purchase is in progress", async () => {
    let finish!: () => void;
    memberAction = (c) => {
      finish = () => c.options.handler(PAID);
    };
    const { result } = renderHook(() => useBuyExtraLifeline({ pendingRetryDelayMs: 0 }), { wrapper });
    let first!: Promise<string>;
    await act(async () => {
      first = result.current.buy();
      await Promise.resolve();
    });
    let second: string | undefined;
    await act(async () => {
      second = await result.current.buy();
    });
    expect(second).toBe("busy");
    await act(async () => {
      finish();
      await first;
    });
    expect(svc.createLifelineOrder).toHaveBeenCalledTimes(1);
  });
});

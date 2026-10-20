// Loads Razorpay Checkout.js once and opens it as a promise, so callers can
// tell a completed payment, a failed one and a closed checkout apart.
const SCRIPT_ID = "rzp-checkout-js";
const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loading: Promise<boolean> | null = null;

export function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as any).Razorpay) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const s = existing ?? document.createElement("script");
    const done = (ok: boolean) => {
      if (!ok) loading = null;
      resolve(ok && !!(window as any).Razorpay);
    };
    s.addEventListener("load", () => done(true), { once: true });
    s.addEventListener("error", () => done(false), { once: true });
    if (!existing) {
      s.id = SCRIPT_ID;
      s.src = SCRIPT_SRC;
      s.async = true;
      document.body.appendChild(s);
    }
  });
  return loading;
}

export type CheckoutOutcome =
  | { kind: "paid"; razorpayPaymentId: string; razorpayOrderId: string; razorpaySignature: string }
  | { kind: "failed"; reason: string }
  | { kind: "dismissed" };

export function openRazorpayCheckout(options: {
  key: string;
  amount: number;
  currency: string;
  orderId: string;
  description: string;
}): Promise<CheckoutOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (o: CheckoutOutcome) => {
      if (settled) return;
      settled = true;
      resolve(o);
    };
    let lastFailure: string | null = null;
    const rzp = new (window as any).Razorpay({
      key: options.key,
      amount: options.amount,
      currency: options.currency,
      order_id: options.orderId,
      name: "Tamil Business Tribe",
      description: options.description,
      handler: (response: any) =>
        finish({
          kind: "paid",
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id ?? options.orderId,
          razorpaySignature: response.razorpay_signature,
        }),
      modal: {
        // Razorpay lets the member retry inside the modal after a failure, so a
        // failure only counts once they close the checkout.
        ondismiss: () => finish(lastFailure ? { kind: "failed", reason: lastFailure } : { kind: "dismissed" }),
      },
    });
    rzp.on("payment.failed", (resp: any) => {
      lastFailure = resp?.error?.description || "The payment did not go through.";
    });
    rzp.open();
  });
}

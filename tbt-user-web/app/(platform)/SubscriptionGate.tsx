"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMe } from "@/lib/hooks/useUser";
import { useSubmitTicket } from "@/lib/hooks/useSupport";
import { Lock, X, Clock, CheckCircle2, Loader2 } from "lucide-react";
import apiClient from "@/lib/api/client";
import { useSuppressAds } from "@/lib/ads/useRegisterMedia";

// Paths where the free-plan / expired-subscription interceptors are suspended
const EXEMPT_PATHS = ["/Products", "/profile"];

// A pending member must be able to reach the self-onboarding wizard —
// otherwise there's no way for them to ever get out of "pending". See
// SELF_ONBOARDING_SPECKIT.md §7.1 (D2).
const PENDING_EXEMPT_PATHS = ["/onboarding"];

function PendingInterceptor() {
  const [showPopup, setShowPopup] = useState(false);
  const [requested, setRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const router = useRouter();
  const { data: me } = useMe();
  const submitTicket = useSubmitTicket();

  // The user is already gated behind a click-blocker; stacking a fullscreen ad
  // on top of it is incoherent (TBT_ADS_SPECKIT.md §7.4). Suppression lasts as
  // long as this component is mounted, and is ref-counted, so it composes with
  // whatever else is suppressing at the same time.
  useSuppressAds("pending-interceptor");

  const handleLogout = async () => {
    try { await apiClient.post("/api/user-auth/logout", {}); } catch (_) {}
    router.push("/login");
  };

  const handleRequestApproval = async () => {
    if (requesting || requested) return;
    setRequesting(true);
    try {
      const name = [(me as any)?.firstName, (me as any)?.lastName].filter(Boolean).join(" ") || "Member";
      await submitTicket.mutateAsync({
        name,
        email: (me as any)?.email || "",
        phone: (me as any)?.phone,
        subject: "Account Approval Request",
        message: `Hi, I have completed my registration and would like to request approval to access the TBT platform. Please review and approve my account.\n\nName: ${name}\nPhone: ${(me as any)?.phone || "-"}`,
        priority: "high",
      });
    } catch {
      // silent — still mark sent so user gets feedback and doesn't spam
    } finally {
      setRequested(true);
      setRequesting(false);
    }
  };

  return (
    <>
      {/* Transparent overlay — sits above all content and the navbar, intercepts every click */}
      <div
        className="fixed inset-0 z-[9998] cursor-pointer"
        onClick={() => setShowPopup(true)}
        aria-hidden="true"
      />

      {showPopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "var(--color-backdrop)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPopup(false); }}
        >
          <div
            className="relative max-w-sm w-full rounded-2xl p-8 text-center"
            style={{
              background: "var(--color-modal-bg)",
              border: "1px solid var(--color-border-subtle)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 var(--color-surface-overlay-md)",
            }}
          >
            <button
              onClick={() => setShowPopup(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>

            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
              }}
            >
              <Clock size={22} style={{ color: "var(--color-accent)" }} />
            </div>

            <h2 className="text-foreground text-[18px] font-bold mb-3 leading-snug">
              Approval Pending
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              Your account is awaiting admin approval. Tap below to notify our team and we&apos;ll review your account shortly.
            </p>

            {requested ? (
              <div
                className="w-full py-3 rounded-xl text-sm font-semibold mb-3 flex items-center justify-center gap-2"
                style={{
                  background: "color-mix(in srgb, var(--color-success, #22c55e) 12%, transparent)",
                  color: "var(--color-success, #22c55e)",
                  border: "1px solid color-mix(in srgb, var(--color-success, #22c55e) 25%, transparent)",
                }}
              >
                <CheckCircle2 size={16} /> Request Sent
              </div>
            ) : (
              <button
                onClick={handleRequestApproval}
                disabled={requesting}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white mb-3 transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 80%, white) 0%, var(--color-accent) 100%)",
                  boxShadow: "0 4px 16px color-mix(in srgb, var(--color-accent) 35%, transparent)",
                }}
              >
                {requesting ? <><Loader2 size={15} className="animate-spin" /> Sending...</> : "Request Approval"}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              style={{
                background: "var(--color-surface-overlay)",
                border: "1px solid var(--color-border-subtle)",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function FreeInterceptor() {
  const [showPopup, setShowPopup] = useState(false);

  // Same reasoning as PendingInterceptor (§7.4) — the user is already blocked.
  useSuppressAds("free-interceptor");

  return (
    <>
      {/* Transparent overlay — intercepts every click for free-plan users */}
      <div
        className="fixed inset-0 z-[9998] cursor-pointer"
        onClick={() => setShowPopup(true)}
        aria-hidden="true"
      />

      {showPopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "var(--color-backdrop)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPopup(false); }}
        >
          <div
            className="relative max-w-sm w-full rounded-2xl p-8 text-center"
            style={{
              background: "var(--color-modal-bg)",
              border: "1px solid var(--color-border-subtle)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 var(--color-surface-overlay-md)",
            }}
          >
            <button
              onClick={() => setShowPopup(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>

            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
              }}
            >
              <Lock size={22} style={{ color: "var(--color-accent)" }} />
            </div>

            <h2 className="text-foreground text-[18px] font-bold mb-3 leading-snug">
              Access Restricted
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              You are not approved by admin. Kindly contact admin to unlock full access.
            </p>

            <button
              onClick={() => setShowPopup(false)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 80%, white) 0%, var(--color-accent) 100%)",
                boxShadow: "0 4px 16px color-mix(in srgb, var(--color-accent) 35%, transparent)",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading, isError, isFetching } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  const isExempt = EXEMPT_PATHS.some((p) => pathname.startsWith(p));
  const isPendingExempt = PENDING_EXEMPT_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (isLoading || isFetching || isError || isExempt || !me) return;
    if ((me as any).status === "pending") {
      // pending + awaiting_kyc → must reach the self-onboarding wizard.
      // All other pending states (under_review, changes_requested, etc.) stay
      // on their current page behind the PendingInterceptor.
      if ((me as any).verificationStatus === "awaiting_kyc" && !isPendingExempt) {
        router.replace("/onboarding");
      }
      return;
    }

    const sub = (me as any).subscription;
    // Only redirect when a subscription existed but has since expired.
    // No subscription at all (free plan) is handled by FreeInterceptor below.
    if (sub && new Date(sub.endDate) < new Date()) {
      router.replace("/Products");
    }
  }, [me, isLoading, isFetching, isError, isExempt, isPendingExempt, router]);

  // Pending users: page content visible, but every click opens the pending popup —
  // except awaiting_kyc (redirected above) and the onboarding wizard itself.
  if (!isLoading && !isFetching && me && (me as any).status === "pending" && !isPendingExempt) {
    return (
      <>
        {children}
        <PendingInterceptor />
      </>
    );
  }

  // Free-plan users with no active subscription: block with upgrade prompt.
  // Members with any paid membershipPlan assigned by admin pass through even
  // if no Subscription row exists yet (admin sets plan directly on the member).
  const hasPaidPlan = (me as any)?.membershipPlan && (me as any).membershipPlan !== "free";
  if (!isLoading && !isFetching && me && (me as any).status !== "pending" && !(me as any).subscription && !hasPaidPlan && !isExempt) {
    return (
      <>
        {children}
        <FreeInterceptor />
      </>
    );
  }

  return <>{children}</>;
}

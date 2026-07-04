"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMe } from "@/lib/hooks/useUser";
import { Lock, X } from "lucide-react";
import apiClient from "@/lib/api/client";

// Paths where the free-plan / expired-subscription interceptors are suspended
const EXEMPT_PATHS = ["/Products", "/profile"];

function PendingInterceptor() {
  const [showPopup, setShowPopup] = useState(false);

  const handleLogout = async () => {
    try { await apiClient.post("/api/user-auth/logout", {}); } catch (_) {}
    window.location.href = "/login";
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
              <Lock size={22} style={{ color: "var(--color-accent)" }} />
            </div>

            <h2 className="text-foreground text-[18px] font-bold mb-3 leading-snug">
              Not Approved Yet
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              You are not approved by admin. Contact admin to unlock the full potential.
            </p>

            <button
              onClick={() => setShowPopup(false)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white mb-3 transition-opacity hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 80%, white) 0%, var(--color-accent) 100%)",
                boxShadow: "0 4px 16px color-mix(in srgb, var(--color-accent) 35%, transparent)",
              }}
            >
              Got it
            </button>
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

  useEffect(() => {
    if (isLoading || isFetching || isError || isExempt || !me) return;
    if ((me as any).status === "pending") return;

    const sub = (me as any).subscription;
    // Only redirect when a subscription existed but has since expired
    // No subscription at all (free plan) is handled by FreeInterceptor below
    if (sub && new Date(sub.endDate) < new Date()) {
      router.replace("/Products");
    }
  }, [me, isLoading, isFetching, isError, isExempt, router]);

  // Pending users: page content visible, but every click opens the pending popup
  if (!isLoading && !isFetching && me && (me as any).status === "pending") {
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

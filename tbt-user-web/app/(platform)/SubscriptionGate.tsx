"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMe } from "@/lib/hooks/useUser";
import { Lock, X } from "lucide-react";
import apiClient from "@/lib/api/client";

// Paths where expired subscribers still need access (renewal + sign-out)
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
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPopup(false); }}
        >
          <div
            className="relative max-w-sm w-full rounded-2xl p-8 text-center"
            style={{
              background: "rgba(12,12,16,0.97)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <button
              onClick={() => setShowPopup(false)}
              className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors"
            >
              <X size={18} />
            </button>

            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)" }}
            >
              <Lock size={22} style={{ color: "#dc2626" }} />
            </div>

            <h2 className="text-white text-[18px] font-bold mb-3 leading-snug">
              Not Approved Yet
            </h2>
            <p className="text-white/50 text-sm leading-relaxed mb-6">
              You are not approved by admin. Contact admin to unlock the full potential.
            </p>

            <button
              onClick={() => setShowPopup(false)}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white mb-3 transition-opacity hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                boxShadow: "0 4px 16px rgba(220,38,38,0.35)",
              }}
            >
              Got it
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white/60 transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              Sign Out
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
    // Never redirect while data is in-flight, on error, or on exempt pages
    if (isLoading || isFetching || isError || isExempt || !me) return;

    // Pending users stay on whatever page they landed on — PendingInterceptor handles blocking
    if ((me as any).status === "pending") return;

    const sub = (me as any).subscription;
    const isExpired = !sub || new Date(sub.endDate) < new Date();
    if (isExpired) {
      router.replace("/Products");
    }
  }, [me, isLoading, isFetching, isError, isExempt, router]);

  // Pending users: render page content so all menus are visible, but intercept every interaction
  if (!isLoading && !isFetching && me && (me as any).status === "pending") {
    return (
      <>
        {children}
        <PendingInterceptor />
      </>
    );
  }

  return <>{children}</>;
}

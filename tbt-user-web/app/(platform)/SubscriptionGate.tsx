"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMe } from "@/lib/hooks/useUser";
import { Clock } from "lucide-react";
import apiClient from "@/lib/api/client";

// Paths where expired subscribers still need access (renewal + sign-out)
const EXEMPT_PATHS = ["/Products", "/profile"];

function PendingApprovalScreen() {
  const handleLogout = async () => {
    try { await apiClient.post("/api/user-auth/logout", {}); } catch (_) {}
    window.location.href = "/login";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 px-4">
      <div className="max-w-md w-full text-center">
        <div
          className="rounded-2xl p-8"
          style={{
            background: "rgba(20,20,20,0.95)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)" }}
          >
            <Clock size={28} style={{ color: "#dc2626" }} />
          </div>
          <h2 className="text-white text-xl font-bold mb-3">Pending Approval</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-6">
            Your registration has been submitted. Our admin team will review and
            approve your account shortly. You&apos;ll receive access once approved.
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
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

    // Pending users: block at gate level (PendingApprovalScreen renders below)
    if ((me as any).status === "pending") return;

    const sub = (me as any).subscription;
    const isExpired = !sub || new Date(sub.endDate) < new Date();
    if (isExpired) {
      router.replace("/Products");
    }
  }, [me, isLoading, isFetching, isError, isExempt, router]);

  // Show pending overlay — renders over children so routing still works but content is blocked
  if (!isLoading && !isFetching && me && (me as any).status === "pending") {
    return <PendingApprovalScreen />;
  }

  return <>{children}</>;
}

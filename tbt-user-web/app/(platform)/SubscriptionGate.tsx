"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMe } from "@/lib/hooks/useUser";

// Paths where expired subscribers still need access (renewal + sign-out)
const EXEMPT_PATHS = ["/Products", "/profile"];

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  const isExempt = EXEMPT_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (isLoading || isExempt || !me) return;

    const sub = me.subscription;
    const isExpired = !sub || new Date(sub.endDate) < new Date();
    if (isExpired) {
      router.replace("/Products");
    }
  }, [me, isLoading, isExempt, router]);

  return <>{children}</>;
}

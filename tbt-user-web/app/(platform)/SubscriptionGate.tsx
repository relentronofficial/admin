"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMe } from "@/lib/hooks/useUser";

// Paths where expired subscribers still need access (renewal + sign-out)
const EXEMPT_PATHS = ["/Products", "/profile"];

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading, isError, isFetching } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  const isExempt = EXEMPT_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    // Never redirect while data is in-flight, on error, or on exempt pages
    if (isLoading || isFetching || isError || isExempt || !me) return;

    const sub = me.subscription;
    const isExpired = !sub || new Date(sub.endDate) < new Date();
    if (isExpired) {
      router.replace("/Products");
    }
  }, [me, isLoading, isFetching, isError, isExempt, router]);

  return <>{children}</>;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";

export default function LoadingPage() {
  const router = useRouter();
  const { isLoading, config } = useSiteConfig();

  useEffect(() => {
    if (isLoading) return;
    const delay = config?.splashDurationMs ?? 1500;
    const t = setTimeout(() => router.replace("/tbt"), delay);
    return () => clearTimeout(t);
  }, [isLoading, config, router]);

  // SiteConfigProvider's SplashOverlay renders above this while splash is active.
  // This div ensures the background matches during any gap.
  return (
    <div
      className="fixed inset-0"
      style={{ background: "var(--color-bg-primary, #000)" }}
    />
  );
}

"use client";

import { useSiteConfig } from "@/lib/context/SiteConfigContext";

export function Footer() {
  const { config } = useSiteConfig();

  if (!config?.footerText) return null;

  return (
    <footer className="border-t border-border px-4 md:px-6 py-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/tbt_logo.webp" alt={config.siteName ?? "TBT"} width={120} height={28} className="h-7 w-auto object-contain mx-auto mb-2" />
      <p className="text-xs text-muted-foreground">{config.footerText}</p>
    </footer>
  );
}

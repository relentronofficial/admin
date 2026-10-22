"use client";

import { useSiteConfig } from "@/lib/context/SiteConfigContext";

export function Footer() {
  const { config } = useSiteConfig();

  if (!config?.footerText) return null;

  return (
    <footer className="border-t border-border px-4 md:px-6 py-4 text-center">
      <p className="text-xs text-muted-foreground">{config.footerText}</p>
    </footer>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";

// /mentorship and /courses (catalog + course pages) render their own BrandFooter.
const PAGES_WITH_OWN_FOOTER = ["/mentorship", "/courses"];

export function Footer() {
  const { config } = useSiteConfig();
  const pathname = usePathname();

  if (!config?.footerText || PAGES_WITH_OWN_FOOTER.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <footer className="border-t border-border px-4 md:px-6 py-4 text-center">
      <p className="text-xs text-muted-foreground">{config.footerText}</p>
    </footer>
  );
}

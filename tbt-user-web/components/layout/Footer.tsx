"use client";

import { usePathname } from "next/navigation";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";

// /courses renders its own footer, with the copyright in its main row.
const PAGES_WITH_OWN_FOOTER = ["/courses"];

export function Footer() {
  const { config } = useSiteConfig();
  const pathname = usePathname();

  if (!config?.footerText || PAGES_WITH_OWN_FOOTER.includes(pathname)) return null;

  return (
    <footer className="border-t border-border px-4 md:px-6 py-4 text-center">
      <p className="text-xs text-muted-foreground">{config.footerText}</p>
    </footer>
  );
}

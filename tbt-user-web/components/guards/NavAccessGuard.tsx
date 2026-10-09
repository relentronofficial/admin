"use client";

import { useEffect } from "react";
import { notFound, usePathname, useRouter } from "next/navigation";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { firstEnabledHref, isPathDisabled } from "@/lib/utils/navAccess";

/**
 * Blocks direct visits to pages the admin disabled in Admin → Navigation (a hidden
 * nav item, or a hidden Platform Section). The member is sent to the first enabled
 * nav item — the same page the navbar logo links to; if nothing is enabled, the
 * app's not-found page is shown.
 *
 * Rendered in (platform)/layout.tsx around page content. Auth is client-side in
 * this app (middleware can't see the cookies), so this runs client-side too and
 * re-evaluates whenever SiteConfigContext refreshes the nav.
 */
export function NavAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { nav, hiddenHrefs, hiddenMenuKeys } = useSiteConfig();

  const cfg = { nav, hiddenHrefs, hiddenMenuKeys };
  const disabled = isPathDisabled(pathname, cfg);
  const fallback = disabled ? firstEnabledHref(cfg) : null;

  useEffect(() => {
    if (disabled && fallback) router.replace(fallback);
  }, [disabled, fallback, router]);

  if (!disabled) return <>{children}</>;
  if (!fallback) notFound();
  // Render nothing while the redirect happens — the disabled page never paints.
  return null;
}

import type { NavItem } from "@/types";

// Route of each admin "Platform Section" (Admin → Navigation → Header Menu Visibility,
// persisted as site_configs.hidden_menu_keys). These sections are fixed pages rather
// than nav_items rows, so their path lives here; whether they are shown is always read
// from hiddenMenuKeys. Keys with no web page (streak, wins, ai_content) are omitted.
export const FIXED_SECTION_ROUTES: Record<string, string> = {
  community: "/community",
  ebooks: "/ebooks",
  podcasts: "/podcasts",
  support: "/support",
};

// Pages SubscriptionGate force-redirects members to (expired subscription → /Products,
// pending KYC → /onboarding). Hiding their nav item removes the link but must not
// block the page, or the two guards would bounce the member back and forth.
export const ACCOUNT_FLOW_PATHS = ["/Products", "/onboarding"];

export interface NavAccessConfig {
  /** Visible nav_items, in admin order. */
  nav: Pick<NavItem, "href">[];
  /** hrefs of nav_items the admin hid. */
  hiddenHrefs: string[];
  /** site_configs.hidden_menu_keys. */
  hiddenMenuKeys: string[];
}

// Strips query/hash and trailing slashes. Returns null for anything that isn't an
// in-app page path — external URLs, protocol-relative URLs, and "/" (which would
// otherwise match every route).
function toInternalPath(href: string | null | undefined): string | null {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null;
  const path = href.replace(/[?#].*$/, "").replace(/\/+$/, "");
  return path || null;
}

function matches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

// Length of the most specific path in `paths` that matches `pathname`, or -1.
function longestMatch(pathname: string, paths: (string | null)[]): number {
  let best = -1;
  for (const p of paths) {
    if (p && matches(pathname, p) && p.length > best) best = p.length;
  }
  return best;
}

/**
 * True when the admin has disabled the page that `pathname` belongs to (the page
 * itself or any sub-route). The most specific match wins, so an enabled item at
 * "/learning/x" stays reachable even if "/learning" is disabled, and a path that is
 * both visible and hidden (duplicate rows) stays reachable.
 */
export function isPathDisabled(pathname: string, cfg: NavAccessConfig): boolean {
  const current = toInternalPath(pathname);
  if (!current) return false;
  if (ACCOUNT_FLOW_PATHS.some((p) => matches(current, p))) return false;

  const disabled = [
    ...cfg.hiddenHrefs,
    ...cfg.hiddenMenuKeys.map((k) => FIXED_SECTION_ROUTES[k]),
  ].map(toInternalPath);
  const disabledMatch = longestMatch(current, disabled);
  if (disabledMatch < 0) return false;

  const enabled = [
    ...cfg.nav.map((n) => n.href),
    ...Object.entries(FIXED_SECTION_ROUTES)
      .filter(([key]) => !cfg.hiddenMenuKeys.includes(key))
      .map(([, route]) => route),
  ].map(toInternalPath);
  return longestMatch(current, enabled) < disabledMatch;
}

/**
 * Where to send a member who opened a disabled page: the first enabled nav item in
 * admin order — the same "first nav item" the navbar logo already links to. Returns
 * null when no in-app nav item is enabled.
 */
export function firstEnabledHref(cfg: NavAccessConfig): string | null {
  for (const item of cfg.nav) {
    const path = toInternalPath(item.href);
    if (path && !isPathDisabled(path, cfg)) return item.href;
  }
  return null;
}

import type { NavItem } from "@/types";

// Platform Sections rendered as nav links (Admin → Navigation). Visibility comes from
// hiddenMenuKeys; position comes from navOrder via their "section:<key>" token.
export const NAV_SECTIONS = [
  { key: "community", href: "/community", label: "Community" },
  { key: "ebooks", href: "/ebooks", label: "Ebooks" },
  { key: "podcasts", href: "/podcasts", label: "Podcasts" },
] as const;

export const sectionToken = (key: string) => `section:${key}`;

export interface NavMenuEntry {
  id: string;
  href: string;
  label: string;
}

/**
 * The web nav bar's links, in the admin's order: visible nav items plus the
 * non-hidden Platform Sections, sorted by their position in `navOrder` (nav item ids
 * and "section:<key>" tokens, from site_configs.nav_order). Entries missing from
 * `navOrder` — or all of them when it's null — keep the default order: nav items
 * first (already sorted by nav_items.order), then sections.
 */
export function buildNavMenu(params: {
  nav: Pick<NavItem, "id" | "href" | "label">[];
  hiddenMenuKeys: string[];
  navOrder: string[] | null;
}): NavMenuEntry[] {
  const { nav, hiddenMenuKeys, navOrder } = params;
  const entries = [
    ...nav.map((n) => ({ token: n.id, entry: { id: n.id, href: n.href, label: n.label } })),
    ...NAV_SECTIONS.filter((s) => !hiddenMenuKeys.includes(s.key)).map((s) => ({
      token: sectionToken(s.key),
      entry: { id: `__${s.key}`, href: s.href, label: s.label },
    })),
  ];
  if (!navOrder?.length) return entries.map((e) => e.entry);

  const rank = new Map(navOrder.map((token, i) => [token, i]));
  return entries
    .map((e, i) => ({ e, i, r: rank.get(e.token) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ e }) => e.entry);
}

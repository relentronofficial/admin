import { describe, it, expect } from "vitest";
import { firstEnabledHref, isPathDisabled, type NavAccessConfig } from "./navAccess";

// Mirrors the live setup: Home and Mentorship are nav_items rows; Community, Ebooks
// and Podcasts are Platform Sections controlled by hiddenMenuKeys.
const HOME = { href: "/tbt" };
const MENTORSHIP = { href: "/courses" };

function cfg(over: Partial<NavAccessConfig> = {}): NavAccessConfig {
  return { nav: [HOME, MENTORSHIP], hiddenHrefs: [], hiddenMenuKeys: [], ...over };
}

describe("isPathDisabled", () => {
  it("allows every page when nothing is disabled", () => {
    for (const p of ["/tbt", "/courses", "/community", "/ebooks", "/podcasts", "/profile"]) {
      expect(isPathDisabled(p, cfg())).toBe(false);
    }
  });

  it("blocks a hidden nav item and its sub-routes (Home disabled)", () => {
    const c = cfg({ nav: [MENTORSHIP], hiddenHrefs: ["/tbt"] });
    expect(isPathDisabled("/tbt", c)).toBe(true);
    expect(isPathDisabled("/tbt/some-show", c)).toBe(true);
    expect(isPathDisabled("/courses", c)).toBe(false);
    // prefix only matches whole segments
    expect(isPathDisabled("/tbtx", c)).toBe(false);
  });

  it("unblocks a nav item once the admin re-enables it", () => {
    expect(isPathDisabled("/tbt", cfg({ nav: [HOME, MENTORSHIP], hiddenHrefs: [] }))).toBe(false);
  });

  it.each([
    ["community", "/community"],
    ["ebooks", "/ebooks/abc"],
    ["podcasts", "/podcasts"],
  ])("blocks the %s section when its key is hidden", (key, path) => {
    expect(isPathDisabled(path, cfg({ hiddenMenuKeys: [key] }))).toBe(true);
    expect(isPathDisabled(path, cfg())).toBe(false);
  });

  it("ignores keys with no web page and paths that aren't in-app routes", () => {
    const c = cfg({ hiddenMenuKeys: ["streak", "wins"], hiddenHrefs: ["https://example.com", "/", "//cdn.x"] });
    expect(isPathDisabled("/tbt", c)).toBe(false);
    expect(isPathDisabled("/dashboard", c)).toBe(false);
  });

  it("normalises trailing slashes and query strings on hidden hrefs", () => {
    const c = cfg({ nav: [MENTORSHIP], hiddenHrefs: ["/tbt/?tab=1"] });
    expect(isPathDisabled("/tbt", c)).toBe(true);
  });

  it("lets a more specific enabled item win over a disabled parent", () => {
    const c = cfg({ nav: [{ href: "/learning/badges" }], hiddenHrefs: ["/learning"] });
    expect(isPathDisabled("/learning/badges", c)).toBe(false);
    expect(isPathDisabled("/learning/abc", c)).toBe(true);
  });

  it("keeps a path reachable when it is both visible and hidden (duplicate rows)", () => {
    expect(isPathDisabled("/tbt", cfg({ hiddenHrefs: ["/tbt"] }))).toBe(false);
  });

  it("never blocks the account-flow pages SubscriptionGate redirects to", () => {
    const c = cfg({ hiddenHrefs: ["/Products", "/onboarding"] });
    expect(isPathDisabled("/Products", c)).toBe(false);
    expect(isPathDisabled("/onboarding", c)).toBe(false);
  });
});

describe("firstEnabledHref", () => {
  it("returns the first enabled nav item in admin order", () => {
    expect(firstEnabledHref(cfg({ nav: [MENTORSHIP, HOME] }))).toBe("/courses");
  });

  it("skips external links", () => {
    expect(firstEnabledHref(cfg({ nav: [{ href: "https://example.com" }, MENTORSHIP] }))).toBe("/courses");
  });

  it("treats a visible nav link as enabled even if its Platform Section is hidden", () => {
    // The admin explicitly kept a visible nav row for the page; the navbar shows it,
    // so the page must stay reachable.
    const c = cfg({ nav: [{ href: "/community" }, MENTORSHIP], hiddenMenuKeys: ["community"] });
    expect(isPathDisabled("/community", c)).toBe(false);
    expect(firstEnabledHref(c)).toBe("/community");
  });

  it("returns null when no in-app nav item is enabled", () => {
    expect(firstEnabledHref(cfg({ nav: [], hiddenHrefs: ["/tbt", "/courses"] }))).toBeNull();
  });
});

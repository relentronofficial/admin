import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { Providers } from "@/components/Providers";
import "./globals.css";
import type { SiteConfig, UiStrings } from "@/types";
import type { NavConfigPayload } from "@/lib/context/SiteConfigContext";

// Note: @livekit/components-styles is imported only in WorkshopLiveCall.tsx

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Tamil Business Tribe",
    template: "%s | TBT",
  },
  description: "Tamil Business Tribe — business education, workshops, and community for Tamil entrepreneurs.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://app.tamilbusinesstribe.com"),
  openGraph: {
    type: "website",
    siteName: "Tamil Business Tribe",
    title: "Tamil Business Tribe",
    description: "Business education, workshops, and community for Tamil entrepreneurs.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tamil Business Tribe",
    description: "Business education, workshops, and community for Tamil entrepreneurs.",
  },
  icons: {
    icon: [
      { url: "/favicon.webp", type: "image/webp" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.webp",
    apple: "/favicon.webp",
  },
  robots: {
    index: false,
    follow: false,
  },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchPublicJson<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    // Public config changes rarely — 5-minute revalidate reduces TTFB by
    // serving from Next.js data cache instead of cold-fetching the backend
    // on every request. Next.js also deduplicates same-URL fetches within
    // a single render pass (e.g. workshops/page.tsx fetches ui-strings too).
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

// Minified anti-flash script — runs synchronously before React hydration to apply
// the theme class on <html> without a flash of the wrong theme.
// The theme is set by the admin (Admin → Navigation → Dark / Light Mode) and
// arrives as `themeMode` on the site config. `tbt_theme` (localStorage + cookie)
// only caches the last admin value, used when the config fetch failed.
function themeScript(serverMode: "light" | "dark" | null) {
  return `(function(){try{var a=${JSON.stringify(serverMode)};var s=localStorage.getItem('tbt_theme');var t=a||(s==='light'||s==='dark'?s:'light');document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.classList.toggle('light',t==='light');localStorage.setItem('tbt_theme',t);var m=365*24*60*60;document.cookie='tbt_theme='+t+'; path=/; max-age='+m+'; SameSite=Lax';}catch(e){document.documentElement.classList.add('light');}})();`;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("tbt_theme")?.value;

  const [initialConfig, initialNav, initialUiStrings] = await Promise.all([
    // Short revalidate: site config carries the admin-controlled themeMode, so a
    // Dark/Light change in Admin must reach new page loads within seconds.
    fetchPublicJson<SiteConfig>("/api/pub/config/site", 30),
    // Short revalidate: nav carries the admin's page visibility, which also gates
    // direct URL access — a Navigation change must reach new page loads quickly.
    fetchPublicJson<NavConfigPayload>("/api/pub/config/nav", 30),
    fetchPublicJson<UiStrings>("/api/pub/config/ui-strings"),
  ]);

  // Admin-selected mode wins; the cookie (last admin value) is only a fallback.
  const adminThemeMode = initialConfig?.themeMode === "dark" || initialConfig?.themeMode === "light" ? initialConfig.themeMode : null;
  const initialThemeClass = adminThemeMode ?? (themeCookie === "dark" ? "dark" : "light");

  // Inject theme CSS variables into <head> server-side — zero flash, zero layout shift.
  // In light mode, skip --color-bg-primary/surface (dark API values would override light CSS vars).
  // Only accent/alert/success are injected via <style> tag — these are theme-stable and safe
  // to set as stylesheet rules. --color-bg-primary and --color-bg-surface are intentionally
  // excluded: the <style> tag creates a :root rule that survives removeProperty() in
  // SiteConfigContext (which only clears inline styles), so those two must be managed
  // exclusively via element.style.setProperty/removeProperty in SiteConfigContext.
  const themeCSS = initialConfig?.theme
    ? `:root{--color-accent:${initialConfig.theme.accentColor};--color-alert:${initialConfig.theme.alertColor};--color-success:${initialConfig.theme.successColor};}`
    : "";

  // Derive CDN origin from the first available media URL — works across all environments
  // without touching env files. Falls back to null (no preconnect emitted) if config is absent.
  const cdnOrigin = (() => {
    const url = initialConfig?.logoUrl || initialConfig?.faviconUrl;
    if (!url) return null;
    try { return new URL(url).origin; } catch { return null; }
  })();

  return (
    <html lang="en" className={initialThemeClass} suppressHydrationWarning>
      <head>
        {/* Anti-flash script must be first — runs before any CSS or React hydration */}
        <script dangerouslySetInnerHTML={{ __html: themeScript(adminThemeMode) }} />
        {themeCSS && <style dangerouslySetInnerHTML={{ __html: themeCSS }} />}
        {initialConfig?.faviconUrl && (
          <link rel="icon" href={initialConfig.faviconUrl} />
        )}
        <link rel="preconnect" href={API_BASE} />
        {cdnOrigin && (
          <>
            <link rel="preconnect" href={cdnOrigin} crossOrigin="" />
            <link rel="dns-prefetch" href={cdnOrigin} />
          </>
        )}
      </head>
      <body
        className={`${inter.variable} antialiased min-h-screen bg-background`}
        suppressHydrationWarning
      >
        <Providers
          initialConfig={initialConfig}
          initialNav={initialNav}
          initialUiStrings={initialUiStrings}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}

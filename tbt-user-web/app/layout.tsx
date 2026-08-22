import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { Providers } from "@/components/Providers";
import "./globals.css";
import type { SiteConfig, NavItem, UiStrings } from "@/types";
import type { RightIcons } from "@/lib/context/SiteConfigContext";

// Note: @livekit/components-styles is imported only in WorkshopLiveCall.tsx

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TBT",
    template: "%s | TBT",
  },
  description: "Your learning platform.",
  icons: {
    icon: [
      { url: "/favicon.webp", type: "image/webp" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.webp",
    apple: "/favicon.webp",
  },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchPublicJson<T>(path: string): Promise<T | null> {
  try {
    // Public config changes rarely — 5-minute revalidate reduces TTFB by
    // serving from Next.js data cache instead of cold-fetching the backend
    // on every request. Next.js also deduplicates same-URL fetches within
    // a single render pass (e.g. workshops/page.tsx fetches ui-strings too).
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

// Minified anti-flash script — runs synchronously before React hydration to apply
// the saved theme class on <html> without a flash of the wrong theme.
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('tbt_theme');var t=s==='light'||s==='dark'?s:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.classList.toggle('light',t==='light');var m=365*24*60*60;document.cookie='tbt_theme='+t+'; path=/; max-age='+m+'; SameSite=Lax';}catch(e){document.documentElement.classList.add('dark');}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("tbt_theme")?.value;
  const initialThemeClass = themeCookie === "light" ? "light" : "dark";

  const [initialConfig, initialNav, initialUiStrings] = await Promise.all([
    fetchPublicJson<SiteConfig>("/api/pub/config/site"),
    fetchPublicJson<{ items: NavItem[]; rightIcons: RightIcons }>("/api/pub/config/nav"),
    fetchPublicJson<UiStrings>("/api/pub/config/ui-strings"),
  ]);

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
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
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

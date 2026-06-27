import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
    const res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [initialConfig, initialNav, initialUiStrings] = await Promise.all([
    fetchPublicJson<SiteConfig>("/api/pub/config/site"),
    fetchPublicJson<{ items: NavItem[]; rightIcons: RightIcons }>("/api/pub/config/nav"),
    fetchPublicJson<UiStrings>("/api/pub/config/ui-strings"),
  ]);

  // Inject theme CSS variables into <head> server-side — zero flash, zero layout shift.
  // These are available before any JavaScript runs.
  const themeCSS = initialConfig?.theme
    ? `:root{--color-accent:${initialConfig.theme.accentColor};--color-alert:${initialConfig.theme.alertColor};--color-success:${initialConfig.theme.successColor};--color-bg-primary:${initialConfig.theme.bgPrimary};--color-bg-surface:${initialConfig.theme.bgSurface};}`
    : "";

  // Derive CDN origin from the first available media URL — works across all environments
  // without touching env files. Falls back to null (no preconnect emitted) if config is absent.
  const cdnOrigin = (() => {
    const url = initialConfig?.logoUrl || initialConfig?.faviconUrl;
    if (!url) return null;
    try { return new URL(url).origin; } catch { return null; }
  })();

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
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

"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { SiteConfig, NavItem, UiStrings } from "@/types";

export interface RightIcons {
  notifications: boolean;
  messages: boolean;
  profile: boolean;
}

interface SiteConfigContextValue {
  config: SiteConfig | null;
  nav: NavItem[];
  rightIcons: RightIcons;
  uiStrings: UiStrings | null;
  /** True while the initial bootstrap fetch is in-flight */
  isLoading: boolean;
}

const DEFAULT_RIGHT_ICONS: RightIcons = { notifications: true, messages: true, profile: true };

export const SiteConfigContext = createContext<SiteConfigContextValue>({
  config: null,
  nav: [],
  rightIcons: DEFAULT_RIGHT_ICONS,
  uiStrings: null,
  isLoading: true,
});

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

/** Apply theme CSS variables to :root from the nested theme object. */
function applyTheme(theme: SiteConfig["theme"]) {
  const root = document.documentElement;
  root.style.setProperty("--color-accent", theme.accentColor);
  root.style.setProperty("--color-alert", theme.alertColor);
  root.style.setProperty("--color-success", theme.successColor);
  root.style.setProperty("--color-bg-primary", theme.bgPrimary);
  root.style.setProperty("--color-bg-surface", theme.bgSurface);
}

function setFavicon(url: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [nav, setNav] = useState<NavItem[]>([]);
  const [rightIcons, setRightIcons] = useState<RightIcons>(DEFAULT_RIGHT_ICONS);
  const [uiStrings, setUiStrings] = useState<UiStrings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const bootStart = useRef(Date.now());

  useEffect(() => {
    async function bootstrap() {
      const [cfg, navData, strings] = await Promise.all([
        fetchJson<SiteConfig>("/api/pub/config/site"),
        fetchJson<{ items: NavItem[]; rightIcons: RightIcons }>("/api/pub/config/nav"),
        fetchJson<UiStrings>("/api/pub/config/ui-strings"),
      ]);

      if (cfg) {
        setConfig(cfg);
        applyTheme(cfg.theme);
        if (cfg.faviconUrl) setFavicon(cfg.faviconUrl);

        // Honour splashDurationMs: keep splash until the full duration has elapsed
        const elapsed = Date.now() - bootStart.current;
        const remaining = Math.max(0, cfg.splashDurationMs - elapsed);
        setTimeout(() => setSplashDone(true), remaining);
      } else {
        // No config available — dismiss splash immediately so the app isn't blocked
        setSplashDone(true);
      }

      if (navData?.items?.length) setNav(navData.items);
      if (navData?.rightIcons) setRightIcons(navData.rightIcons);
      if (strings) setUiStrings(strings);

      setIsLoading(false);
    }

    bootstrap();
  }, []);

  return (
    <SiteConfigContext.Provider value={{ config, nav, rightIcons, uiStrings, isLoading }}>
      {!splashDone
        ? // Splash is shown by the provider so it blocks ALL child rendering —
          // this is the "before any page renders" requirement from §2
          children  // We render children behind it; the actual overlay is in SplashOverlay
        : children}
      {!splashDone && <SplashOverlay config={config} />}
    </SiteConfigContext.Provider>
  );
}

/** Full-screen overlay rendered above everything until splash is dismissed. */
function SplashOverlay({ config }: { config: SiteConfig | null }) {
  const logoUrl = config?.splashLogoUrl ?? config?.logoUrl ?? null;
  const siteName = config?.siteName ?? null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500"
      style={{ background: "var(--color-bg-primary, #000)" }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={siteName ?? ""}
          className="w-40 h-40 object-contain"
        />
      ) : (
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-black"
          style={{ background: "var(--color-accent, #00c4cc)" }}
        >
          {siteName ? siteName[0].toUpperCase() : "E"}
        </div>
      )}
    </div>
  );
}

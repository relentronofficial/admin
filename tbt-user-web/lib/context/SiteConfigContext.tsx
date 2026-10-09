"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { SiteConfig, NavItem, UiStrings } from "@/types";
import { useUIStore } from "@/lib/stores/useUIStore";

export interface RightIcons {
  notifications: boolean;
  messages: boolean;
  profile: boolean;
}

// GET /api/pub/config/nav payload. `items` is visible nav_items only; `hiddenHrefs`
// lists the paths of admin-hidden nav_items (used to block direct visits).
export interface NavConfigPayload {
  items: NavItem[];
  rightIcons: RightIcons;
  hiddenMenuKeys?: string[];
  hiddenHrefs?: string[];
  /** Admin's combined nav bar order (nav item ids + "section:<key>"); null = default. */
  navOrder?: string[] | null;
}

interface SiteConfigContextValue {
  config: SiteConfig | null;
  nav: NavItem[];
  rightIcons: RightIcons;
  hiddenMenuKeys: string[];
  hiddenHrefs: string[];
  navOrder: string[] | null;
  uiStrings: UiStrings | null;
  isLoading: boolean;
}

const DEFAULT_RIGHT_ICONS: RightIcons = { notifications: true, messages: true, profile: true };

export const SiteConfigContext = createContext<SiteConfigContextValue>({
  config: null,
  nav: [],
  rightIcons: DEFAULT_RIGHT_ICONS,
  hiddenMenuKeys: [],
  hiddenHrefs: [],
  navOrder: null,
  uiStrings: null,
  isLoading: true,
});

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

function applyTheme(theme: SiteConfig["theme"], currentTheme: "light" | "dark") {
  const root = document.documentElement;
  root.style.setProperty("--color-accent", theme.accentColor);
  root.style.setProperty("--color-alert", theme.alertColor);
  root.style.setProperty("--color-success", theme.successColor);
  if (currentTheme === "dark") {
    root.style.setProperty("--color-bg-primary", theme.bgPrimary);
    root.style.setProperty("--color-bg-surface", theme.bgSurface);
  } else {
    // Remove inline overrides so light CSS vars take effect via fallback chain
    root.style.removeProperty("--color-bg-primary");
    root.style.removeProperty("--color-bg-surface");
  }
}

// The admin's Dark / Light Mode choice (Admin → Navigation) is the only source
// of the light/dark mode — members have no toggle.
function applyAdminThemeMode(cfg: SiteConfig | null | undefined) {
  const mode = cfg?.themeMode;
  if ((mode === "light" || mode === "dark") && useUIStore.getState().theme !== mode) {
    useUIStore.getState().setTheme(mode);
  }
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

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, init);
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

interface SiteConfigProviderProps {
  children: React.ReactNode;
  initialConfig?: SiteConfig | null;
  initialNav?: NavConfigPayload | null;
  initialUiStrings?: UiStrings | null;
}

export function SiteConfigProvider({
  children,
  initialConfig,
  initialNav,
  initialUiStrings,
}: SiteConfigProviderProps) {
  const [config, setConfig] = useState<SiteConfig | null>(initialConfig ?? null);
  const [nav, setNav] = useState<NavItem[]>(initialNav?.items ?? []);
  const [rightIcons, setRightIcons] = useState<RightIcons>(initialNav?.rightIcons ?? DEFAULT_RIGHT_ICONS);
  const [hiddenMenuKeys, setHiddenMenuKeys] = useState<string[]>(initialNav?.hiddenMenuKeys ?? []);
  const [hiddenHrefs, setHiddenHrefs] = useState<string[]>(initialNav?.hiddenHrefs ?? []);
  const [navOrder, setNavOrder] = useState<string[] | null>(initialNav?.navOrder ?? null);
  const [uiStrings, setUiStrings] = useState<UiStrings | null>(initialUiStrings ?? null);
  const [isLoading, setIsLoading] = useState(!(initialConfig && initialNav && initialUiStrings));

  const theme = useUIStore((s) => s.theme);

  // Replace state only when the value changed, so a refresh that returns the same
  // nav doesn't re-render every consumer.
  function applyNav(navData: NavConfigPayload) {
    const keep = <T,>(next: T) => (prev: T) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
    if (Array.isArray(navData.items)) setNav(keep(navData.items));
    if (navData.rightIcons) setRightIcons(keep(navData.rightIcons));
    setHiddenMenuKeys(keep(Array.isArray(navData.hiddenMenuKeys) ? navData.hiddenMenuKeys : []));
    setHiddenHrefs(keep(Array.isArray(navData.hiddenHrefs) ? navData.hiddenHrefs : []));
    setNavOrder(keep(Array.isArray(navData.navOrder) ? navData.navOrder : null));
  }

  useEffect(() => {
    // If server already provided full initial data, just apply theme and stop.
    if (initialConfig && initialNav && initialUiStrings) {
      applyAdminThemeMode(initialConfig);
      if (initialConfig.theme) applyTheme(initialConfig.theme, useUIStore.getState().theme);
      if (initialConfig.faviconUrl) setFavicon(initialConfig.faviconUrl);
      setIsLoading(false);
      return;
    }

    // Fallback: client-side bootstrap (used when server data unavailable, e.g. local dev cold start)
    async function bootstrap() {
      const [cfg, navData, strings] = await Promise.all([
        fetchJson<SiteConfig>("/api/pub/config/site"),
        fetchJson<NavConfigPayload>("/api/pub/config/nav"),
        fetchJson<UiStrings>("/api/pub/config/ui-strings"),
      ]);

      if (cfg) {
        setConfig(cfg);
        applyAdminThemeMode(cfg);
        applyTheme(cfg.theme, useUIStore.getState().theme);
        if (cfg.faviconUrl) setFavicon(cfg.faviconUrl);
      }
      if (navData) applyNav(navData);
      if (strings) setUiStrings(strings);
      setIsLoading(false);
    }

    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the admin-controlled theme and navigation current without a hard reload:
  // re-read the site config + nav shortly after load and whenever the tab becomes
  // visible again. `no-store` bypasses the browser HTTP cache (the endpoints send
  // max-age=300); the backend clears its own cache when the admin saves. A failed
  // fetch keeps the current values rather than guessing.
  useEffect(() => {
    let lastFetch = 0;
    async function refresh() {
      if (Date.now() - lastFetch < 15_000) return;
      lastFetch = Date.now();
      const [cfg, navData] = await Promise.all([
        fetchJson<SiteConfig>("/api/pub/config/site", { cache: "no-store" }),
        fetchJson<NavConfigPayload>("/api/pub/config/nav", { cache: "no-store" }),
      ]);
      if (navData) applyNav(navData);
      if (!cfg) return;
      setConfig((prev) => (JSON.stringify(prev) === JSON.stringify(cfg) ? prev : cfg));
      applyAdminThemeMode(cfg);
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const initial = setTimeout(() => void refresh(), 1500);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearTimeout(initial);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply theme vars whenever the admin theme mode or config refreshes
  useEffect(() => {
    if (config?.theme) {
      applyTheme(config.theme, theme);
    }
  }, [theme, config]);

  return (
    <SiteConfigContext.Provider value={{ config, nav, rightIcons, hiddenMenuKeys, hiddenHrefs, navOrder, uiStrings, isLoading }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

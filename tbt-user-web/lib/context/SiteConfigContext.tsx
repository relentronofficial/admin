"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { SiteConfig, NavItem, UiStrings } from "@/types";
import { useUIStore } from "@/lib/stores/useUIStore";

export interface RightIcons {
  notifications: boolean;
  messages: boolean;
  profile: boolean;
}

interface SiteConfigContextValue {
  config: SiteConfig | null;
  nav: NavItem[];
  rightIcons: RightIcons;
  hiddenMenuKeys: string[];
  uiStrings: UiStrings | null;
  isLoading: boolean;
}

const DEFAULT_RIGHT_ICONS: RightIcons = { notifications: true, messages: true, profile: true };

export const SiteConfigContext = createContext<SiteConfigContextValue>({
  config: null,
  nav: [],
  rightIcons: DEFAULT_RIGHT_ICONS,
  hiddenMenuKeys: [],
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
    const res = await fetch(`${API_BASE}${path}`);
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
  initialNav?: { items: NavItem[]; rightIcons: RightIcons; hiddenMenuKeys?: string[] } | null;
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
  const [uiStrings, setUiStrings] = useState<UiStrings | null>(initialUiStrings ?? null);
  const [isLoading, setIsLoading] = useState(!(initialConfig && initialNav && initialUiStrings));

  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    // If server already provided full initial data, just apply theme and stop.
    if (initialConfig && initialNav && initialUiStrings) {
      if (initialConfig.theme) applyTheme(initialConfig.theme, useUIStore.getState().theme);
      if (initialConfig.faviconUrl) setFavicon(initialConfig.faviconUrl);
      setIsLoading(false);
      return;
    }

    // Fallback: client-side bootstrap (used when server data unavailable, e.g. local dev cold start)
    async function bootstrap() {
      const [cfg, navData, strings] = await Promise.all([
        fetchJson<SiteConfig>("/api/pub/config/site"),
        fetchJson<{ items: NavItem[]; rightIcons: RightIcons; hiddenMenuKeys?: string[] }>("/api/pub/config/nav"),
        fetchJson<UiStrings>("/api/pub/config/ui-strings"),
      ]);

      if (cfg) {
        setConfig(cfg);
        applyTheme(cfg.theme, useUIStore.getState().theme);
        if (cfg.faviconUrl) setFavicon(cfg.faviconUrl);
      }
      if (navData?.items?.length) setNav(navData.items);
      if (navData?.rightIcons) setRightIcons(navData.rightIcons);
      if (navData?.hiddenMenuKeys) setHiddenMenuKeys(navData.hiddenMenuKeys);
      if (strings) setUiStrings(strings);
      setIsLoading(false);
    }

    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply theme vars whenever user toggles or config refreshes
  useEffect(() => {
    if (config?.theme) {
      applyTheme(config.theme, theme);
    }
  }, [theme, config]);

  return (
    <SiteConfigContext.Provider value={{ config, nav, rightIcons, hiddenMenuKeys, uiStrings, isLoading }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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
  initialNav?: { items: NavItem[]; rightIcons: RightIcons } | null;
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
  const [uiStrings, setUiStrings] = useState<UiStrings | null>(initialUiStrings ?? null);
  const [isLoading, setIsLoading] = useState(!(initialConfig && initialNav && initialUiStrings));

  useEffect(() => {
    // If server already provided full initial data, just apply theme and stop.
    if (initialConfig && initialNav && initialUiStrings) {
      if (initialConfig.theme) applyTheme(initialConfig.theme);
      if (initialConfig.faviconUrl) setFavicon(initialConfig.faviconUrl);
      setIsLoading(false);
      return;
    }

    // Fallback: client-side bootstrap (used when server data unavailable, e.g. local dev cold start)
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
      }
      if (navData?.items?.length) setNav(navData.items);
      if (navData?.rightIcons) setRightIcons(navData.rightIcons);
      if (strings) setUiStrings(strings);
      setIsLoading(false);
    }

    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SiteConfigContext.Provider value={{ config, nav, rightIcons, uiStrings, isLoading }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

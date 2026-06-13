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

        const elapsed = Date.now() - bootStart.current;
        const remaining = Math.max(0, cfg.splashDurationMs - elapsed);
        setTimeout(() => setSplashDone(true), remaining);
      } else {
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
      {children}
      <SplashOverlay config={config} splashDone={splashDone} />
    </SiteConfigContext.Provider>
  );
}

/** Full-screen overlay with fade/slide-in entrance and fade-out exit. */
function SplashOverlay({
  config,
  splashDone,
}: {
  config: SiteConfig | null;
  splashDone: boolean;
}) {
  // `entered` drives the slide-in: false → true on first paint tick
  const [entered, setEntered] = useState(false);
  // `dismissed` removes the node after the exit fade completes
  const [dismissed, setDismissed] = useState(false);
  // `videoEnded` fires when the logo video finishes playing
  const [videoEnded, setVideoEnded] = useState(false);

  const logoUrl = config?.splashLogoUrl ?? config?.logoUrl ?? null;
  const siteName = config?.siteName ?? "TBT";

  // In image mode exit is controlled by splashDone; in video mode by videoEnded
  const shouldExit = logoUrl ? splashDone : videoEnded;

  // Trigger entrance animation on next paint
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // When exit condition fires, wait for fade-out transition then unmount
  useEffect(() => {
    if (!shouldExit) return;
    const t = setTimeout(() => setDismissed(true), 500);
    return () => clearTimeout(t);
  }, [shouldExit]);

  if (dismissed) return null;

  const exiting = shouldExit && !dismissed;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: "var(--color-bg-primary, #000)",
        opacity: exiting ? 0 : entered ? 1 : 0,
        transition: "opacity 500ms ease",
        pointerEvents: shouldExit ? "none" : "auto",
      }}
    >
      {/* Logo / wordmark — slides up while fading in */}
      <div
        style={{
          transform: entered && !exiting ? "translateY(0)" : "translateY(24px)",
          opacity: entered && !exiting ? 1 : 0,
          transition: "transform 700ms cubic-bezier(0.16,1,0.3,1), opacity 600ms ease",
        }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={siteName}
            className="object-contain"
            style={{ width: "min(480px, 85vw)", height: "min(480px, 85vw)" }}
          />
        ) : (
          <video
            autoPlay
            muted
            playsInline
            onEnded={() => setVideoEnded(true)}
            className="object-contain"
            style={{ width: "min(480px, 85vw)", height: "min(480px, 85vw)", background: "transparent" }}
          >
            <source src="/tbt-logo.webm" type="video/webm" />
            <source src="/tbt-logo.mp4" type="video/mp4" />
          </video>
        )}
      </div>
    </div>
  );
}

import { create } from "zustand";

type Theme = "light" | "dark";

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  // Admin-controlled (Admin → Navigation → Dark / Light Mode). Members cannot
  // change it; SiteConfigProvider calls setTheme with the site config's themeMode.
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    // Written by the anti-flash script in app/layout.tsx from the admin's themeMode.
    const saved = localStorage.getItem("tbt_theme");
    if (saved === "light" || saved === "dark") return saved;
    return "light";
  } catch {
    return "light";
  }
}

function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
  try { localStorage.setItem("tbt_theme", theme); } catch {}
  try {
    document.cookie = `tbt_theme=${theme}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
  } catch {}
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  theme: getInitialTheme(),
  setTheme: (theme) => {
    applyThemeClass(theme);
    set({ theme });
  },
}));

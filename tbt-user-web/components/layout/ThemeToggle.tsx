"use client";

import { Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { useUIStore } from "@/lib/stores/useUIStore";

export function ThemeToggle() {
  const { theme, toggleTheme } = useUIStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // Default to dark before mount so SSR and initial client render match
  const isDark = !mounted || theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-xl transition-colors duration-200 group flex-shrink-0 text-muted-foreground hover:text-foreground overflow-hidden"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span
        className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: "var(--color-surface-overlay-md)" }}
      />
      {isDark
        ? <Sun size={17} className="relative z-10" />
        : <Moon size={17} className="relative z-10" />
      }
    </button>
  );
}

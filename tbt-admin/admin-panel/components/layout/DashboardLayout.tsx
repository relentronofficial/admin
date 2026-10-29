"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  // Below md the sidebar is an off-canvas drawer opened from the Topbar's menu
  // button; from md up it is always visible, exactly as before.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#f0f0f0] font-sans">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="md:pl-[220px] flex flex-col min-h-screen w-full min-w-0">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="p-4 md:p-7 flex-1 w-full">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

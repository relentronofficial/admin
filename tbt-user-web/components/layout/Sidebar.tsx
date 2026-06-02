"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Radio,
  Search,
  User,
  Bell,
  Zap,
  X,
} from "lucide-react";
import { useUIStore } from "@/lib/stores/useUIStore";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/learning", label: "My Learning", icon: BookOpen },
  { href: "/programs", label: "Programs", icon: Zap },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/live", label: "Live Sessions", icon: Radio },
  { href: "/search", label: "Search", icon: Search },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "My Profile", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full z-50 w-64 bg-background border-r border-border flex flex-col transition-transform duration-300",
          "lg:relative lg:translate-x-0 lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-black text-sm">
              T
            </div>
            <span className="font-bold text-sm tracking-tight leading-tight">
              Tamil Business<br />
              <span className="text-brand-600">Tribe</span>
            </span>
          </Link>
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-accent"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-600 text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom badge */}
        <div className="p-4 border-t border-border">
          <div className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-3 text-center">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
              Tamil Business Tribe
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Member Platform</p>
          </div>
        </div>
      </aside>
    </>
  );
}

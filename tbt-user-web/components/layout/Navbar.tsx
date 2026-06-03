"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, MessageSquare, Menu, X } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useNotifications, useMessages } from "@/lib/hooks/useDashboard";
import { cn } from "@/lib/utils/cn";

export function Navbar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useUIStore();
  const { config, nav, rightIcons } = useSiteConfig();

  const { data: unreadData } = useNotifications({ unread: true, limit: 1 });
  const unreadCount = unreadData?.meta?.total ?? 0;

  const { data: unreadMsgData } = useMessages({ unread: true, limit: 1 });
  const unreadMsgCount = unreadMsgData?.meta?.total ?? 0;

  const siteName = config?.siteName ?? "TBT";
  const logoUrl = config?.logoUrl ?? null;
  const homeHref = nav[0]?.href ?? "/tbt";

  return (
    <>
      {/* Mobile drawer backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-64 z-50 flex flex-col border-r border-border transition-transform duration-300 lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "var(--color-bg-surface)" }}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
          <Link
            href={homeHref}
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2.5"
          >
            {logoUrl ? (
              <Image src={logoUrl} alt={siteName} width={28} height={28} className="rounded-lg object-contain" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
                style={{ background: "var(--color-accent)" }}
              >
                {siteName[0]}
              </div>
            )}
            <span className="font-bold text-sm text-foreground">{siteName}</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {nav.map(({ id, href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={id}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                style={active ? { background: "var(--color-accent)" } : {}}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {config?.footerText && (
          <div className="p-4 border-t border-border flex-shrink-0">
            <p className="text-[11px] text-muted-foreground text-center">{config.footerText}</p>
          </div>
        )}
      </div>

      {/* Top navbar — fixed so it stays visible while the page scrolls */}
      <header
        className="h-16 border-b border-border backdrop-blur-md fixed top-0 left-0 right-0 z-40 flex items-center px-4 gap-4"
        style={{ background: "color-mix(in srgb, var(--color-bg-surface) 85%, transparent)" }}
      >
        {/* Mobile: hamburger */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-accent/50 transition-colors flex-shrink-0"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        {/* Logo — always visible */}
        <Link href={homeHref} className="flex items-center gap-2.5 flex-shrink-0">
          {logoUrl ? (
            <Image src={logoUrl} alt={siteName} width={28} height={28} className="rounded-lg object-contain" />
          ) : (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: "var(--color-accent)" }}
            >
              {siteName[0]}
            </div>
          )}
          <span className="font-bold text-sm text-foreground">{siteName}</span>
        </Link>

        {/* Desktop: inline nav items */}
        <nav className="hidden lg:flex items-center gap-1 flex-1">
          {nav.map(({ id, href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={id}
                href={href}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
                  active
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                style={active ? { background: "var(--color-accent)" } : {}}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right icons */}
        <div className="flex items-center gap-2 ml-auto lg:ml-0">
          {rightIcons.notifications && (
            <Link
              href="/notifications"
              className={cn(
                "p-2 rounded-lg hover:bg-accent/50 transition-colors relative",
                pathname === "/notifications" && "bg-accent/50"
              )}
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5"
                  style={{ background: "var(--color-accent)" }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}

          {rightIcons.messages && (
            <Link
              href="/messages"
              className={cn(
                "p-2 rounded-lg hover:bg-accent/50 transition-colors relative",
                pathname === "/messages" && "bg-accent/50"
              )}
              aria-label="Messages"
            >
              <MessageSquare size={18} />
              {unreadMsgCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5"
                  style={{ background: "var(--color-accent)" }}
                >
                  {unreadMsgCount > 99 ? "99+" : unreadMsgCount}
                </span>
              )}
            </Link>
          )}

          {rightIcons.profile && (
            <UserButton
              userProfileUrl="/profile"
              userProfileMode="navigation"
              appearance={{ elements: { avatarBox: "w-8 h-8" } }}
            />
          )}
        </div>
      </header>
    </>
  );
}

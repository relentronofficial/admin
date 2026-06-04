"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, MessageSquare, Menu, X } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useNotifications, useMessages } from "@/lib/hooks/useDashboard";
import { getSocket } from "@/lib/socket/client";
import { cn } from "@/lib/utils/cn";

// ── Reusable glass button background spans ────────────────────────────────────

function GlowBg({ active }: { active: boolean }) {
  if (active) {
    return (
      <span
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: "color-mix(in srgb, var(--color-accent) 18%, rgba(0,0,0,0.25))",
          border: "1px solid color-mix(in srgb, var(--color-accent) 32%, transparent)",
          boxShadow: "0 0 16px color-mix(in srgb, var(--color-accent) 24%, transparent)",
        }}
      />
    );
  }
  return (
    <span
      className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      style={{
        background: "color-mix(in srgb, var(--color-accent) 9%, rgba(255,255,255,0.03))",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useUIStore();
  const { config, nav, rightIcons } = useSiteConfig();
  const queryClient = useQueryClient();

  const { data: unreadData } = useNotifications({ unread: true, limit: 1 });
  const unreadCount = unreadData?.meta?.total ?? 0;

  const { data: unreadMsgData } = useMessages({ unread: true, limit: 1 });
  const unreadMsgCount = unreadMsgData?.meta?.total ?? 0;

  useEffect(() => {
    let mounted = true;
    getSocket().then((socket) => {
      if (!mounted) return;
      socket.on("notification", () => {
        queryClient.invalidateQueries({ queryKey: ["user", "notifications"] });
      });
      socket.on("notification:broadcast", () => {
        queryClient.invalidateQueries({ queryKey: ["user", "notifications"] });
      });
    });
    return () => {
      mounted = false;
      getSocket().then((s) => {
        s.off("notification");
        s.off("notification:broadcast");
      });
    };
  }, [queryClient]);

  useEffect(() => {
    let mounted = true;
    getSocket().then((socket) => {
      if (!mounted) return;
      socket.on("message:new", () => {
        queryClient.invalidateQueries({ queryKey: ["user", "messages"] });
      });
    });
    return () => {
      mounted = false;
      getSocket().then((s) => s.off("message:new"));
    };
  }, [queryClient]);

  const siteName = config?.siteName ?? "TBT";
  const logoUrl = config?.logoUrl ?? null;
  const homeHref = nav[0]?.href ?? "/tbt";

  return (
    <>
      {/* ── Mobile drawer backdrop ────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-72 z-50 flex flex-col border-r transition-transform duration-300 ease-out lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          background: "rgba(8, 8, 8, 0.94)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderColor: "rgba(255,255,255,0.07)",
          boxShadow: "4px 0 40px rgba(0,0,0,0.7)",
        }}
      >
        {/* Drawer header */}
        <div
          className="h-16 flex items-center justify-between px-4 border-b flex-shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <Link
            href={homeHref}
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2.5"
          >
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={siteName}
                width={28}
                height={28}
                className="rounded-lg object-contain"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
                style={{ background: "var(--color-accent)" }}
              >
                {siteName[0]}
              </div>
            )}
            <span className="font-bold text-sm text-white">{siteName}</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-[#666] hover:text-white transition-colors duration-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer nav items */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ id, href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={id}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "relative flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group overflow-hidden",
                  active ? "text-white" : "text-[#888] hover:text-white"
                )}
              >
                <GlowBg active={active} />
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </nav>

        {config?.footerText && (
          <div
            className="p-4 border-t flex-shrink-0"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            <p className="text-[11px] text-[#444] text-center">{config.footerText}</p>
          </div>
        )}
      </div>

      {/* ── Floating top navbar ───────────────────────────────────────────── */}
      <header
        className="fixed top-3 left-4 right-4 z-40 h-14 flex items-center px-3 gap-3 rounded-2xl"
        style={{
          background: "rgba(10, 10, 10, 0.72)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: [
            "0 4px 24px rgba(0,0,0,0.55)",
            "0 1px 0 rgba(255,255,255,0.04) inset",
            "0 0 60px color-mix(in srgb, var(--color-accent) 5%, transparent)",
          ].join(", "),
        }}
      >
        {/* Mobile: hamburger */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden relative p-2 rounded-xl text-[#888] hover:text-white transition-colors duration-200 flex-shrink-0 group overflow-hidden"
          aria-label="Toggle menu"
        >
          <GlowBg active={false} />
          <Menu size={18} className="relative z-10" />
        </button>

        {/* Logo */}
        <Link href={homeHref} className="flex items-center gap-2.5 flex-shrink-0">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={siteName}
              width={26}
              height={26}
              className="rounded-lg object-contain"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0"
              style={{ background: "var(--color-accent)" }}
            >
              {siteName[0]}
            </div>
          )}
          <span className="font-bold text-sm text-white">{siteName}</span>
        </Link>

        {/* Visual separator (desktop) */}
        <div
          className="hidden lg:block w-px h-5 flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.1)" }}
        />

        {/* Desktop: inline nav */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1">
          {nav.map(({ id, href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={id}
                href={href}
                className={cn(
                  "relative px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors duration-200 group overflow-hidden flex-shrink-0",
                  active ? "text-white" : "text-[#888] hover:text-white"
                )}
              >
                <GlowBg active={active} />
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right icons */}
        <div className="flex items-center gap-1 ml-auto lg:ml-0">
          {/* Notifications */}
          {rightIcons.notifications && (
            <Link
              href="/notifications"
              className={cn(
                "relative p-2 rounded-xl transition-colors duration-200 group overflow-hidden flex-shrink-0",
                pathname === "/notifications" ? "text-white" : "text-[#888] hover:text-white"
              )}
              aria-label="Notifications"
            >
              <GlowBg active={pathname === "/notifications"} />
              <Bell size={17} className="relative z-10" />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 z-20"
                  style={{ background: "var(--color-accent)" }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}

          {/* Messages */}
          {rightIcons.messages && (
            <Link
              href="/messages"
              className={cn(
                "relative p-2 rounded-xl transition-colors duration-200 group overflow-hidden flex-shrink-0",
                pathname === "/messages" ? "text-white" : "text-[#888] hover:text-white"
              )}
              aria-label="Messages"
            >
              <GlowBg active={pathname === "/messages"} />
              <MessageSquare size={17} className="relative z-10" />
              {unreadMsgCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 z-20"
                  style={{ background: "var(--color-accent)" }}
                >
                  {unreadMsgCount > 99 ? "99+" : unreadMsgCount}
                </span>
              )}
            </Link>
          )}

          {/* Profile avatar */}
          {rightIcons.profile && (
            <div className="pl-0.5">
              <UserButton
                userProfileUrl="/profile"
                userProfileMode="navigation"
                appearance={{ elements: { avatarBox: "w-7 h-7" } }}
              />
            </div>
          )}
        </div>
      </header>
    </>
  );
}

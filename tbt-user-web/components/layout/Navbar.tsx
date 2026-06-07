"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, MessageSquare, Menu, X,
  PlayCircle, ClipboardList, Video, Trophy, Megaphone, Settings2,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import {
  useNotificationUnreadCount,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useMessages,
} from "@/lib/hooks/useDashboard";
import { getSocket } from "@/lib/socket/client";
import { cn } from "@/lib/utils/cn";
import toast from "react-hot-toast";
import type { Notification } from "@/types";

// ── Notification type icon config ─────────────────────────────────────────────

const NOTIF_ICONS = {
  video:        { Icon: PlayCircle,    color: "#dc2626", bg: "rgba(220,38,38,0.15)" },
  assignment:   { Icon: ClipboardList, color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  live_call:    { Icon: Video,         color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  achievement:  { Icon: Trophy,        color: "#eab308", bg: "rgba(234,179,8,0.15)" },
  announcement: { Icon: Megaphone,     color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" },
  system:       { Icon: Settings2,     color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
} as const;

function getNotifIcon(iconType?: string | null) {
  return NOTIF_ICONS[iconType as keyof typeof NOTIF_ICONS]
    ?? { Icon: Bell, color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
}

// ── Notification dropdown ─────────────────────────────────────────────────────

function NotifDropdown({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data, isLoading } = useNotifications({ limit: 5 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const notifications: Notification[] = data?.data ?? [];
  const unreadInList = notifications.filter((n) => !n.isRead).length;

  function handleClick(n: Notification) {
    onClose();
    if (!n.isRead) markRead.mutate(n.id);
    if (n.actionUrl) router.push(n.actionUrl);
    else router.push("/notifications");
  }

  return (
    <div
      className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden z-50 flex flex-col"
      style={{
        background: "rgba(10,10,10,0.97)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
        maxHeight: "420px",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-sm font-bold text-white">Notifications</span>
        {unreadInList > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="text-[11px] font-bold disabled:opacity-50 transition-opacity"
            style={{ color: "var(--color-accent)" }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="space-y-1 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <Bell size={22} className="text-muted-foreground opacity-30" />
            <p className="text-xs text-muted-foreground">You&apos;re all caught up</p>
          </div>
        ) : (
          <div className="py-1">
            {notifications.map((n) => {
              const { Icon, color, bg } = getNotifIcon(n.iconType);
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                  style={!n.isRead ? { background: "rgba(255,255,255,0.02)" } : undefined}
                >
                  {/* Type icon */}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: bg }}
                  >
                    <Icon size={14} style={{ color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white leading-snug truncate">{n.title}</p>
                    <p className="text-[11px] text-[#888] mt-0.5 line-clamp-2 leading-snug">{n.body}</p>
                  </div>

                  {/* Unread dot */}
                  {!n.isRead && (
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: "var(--color-accent)" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 text-center flex-shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link
          href="/notifications"
          onClick={onClose}
          className="text-[11px] font-bold transition-colors"
          style={{ color: "var(--color-accent)" }}
        >
          View all notifications →
        </Link>
      </div>
    </div>
  );
}

// ── Glass button glow background ──────────────────────────────────────────────

function GlowBg({ active }: { active: boolean }) {
  const accentRed = "#dc2626";
  if (active) {
    return (
      <span
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: `color-mix(in srgb, ${accentRed} 18%, rgba(0,0,0,0.25))`,
          border: `1px solid color-mix(in srgb, ${accentRed} 32%, transparent)`,
          boxShadow: `0 0 16px color-mix(in srgb, ${accentRed} 24%, transparent)`,
        }}
      />
    );
  }
  return (
    <span
      className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      style={{
        background: `color-mix(in srgb, ${accentRed} 9%, rgba(255,255,255,0.03))`,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useUIStore();
  const { config, nav, rightIcons } = useSiteConfig();
  const queryClient = useQueryClient();

  const [notifOpen, setNotifOpen] = useState(false);

  const { data: unreadCount = 0 } = useNotificationUnreadCount();
  const { data: unreadMsgData } = useMessages({ unread: true, limit: 1 });
  const unreadMsgCount = unreadMsgData?.meta?.total ?? 0;

  // ── Socket: invalidate + toast on new notification ────────────────────────
  useEffect(() => {
    let mounted = true;
    getSocket().then((socket) => {
      if (!mounted) return;

      function showNotifToast(payload: { title: string; body?: string; type?: string; actionUrl?: string }) {
        queryClient.invalidateQueries({ queryKey: ["user", "notifications"] });
        const { Icon, color, bg } = getNotifIcon(payload.type);
        toast.custom(
          (t) => (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-2xl cursor-pointer select-none"
              style={{
                background: "rgba(12,12,12,0.97)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.65)",
                minWidth: 280,
                maxWidth: 340,
                opacity: t.visible ? 1 : 0,
                transition: "opacity 0.2s",
              }}
              onClick={() => {
                toast.dismiss(t.id);
                if (payload.actionUrl) routerRef.current.push(payload.actionUrl);
                else routerRef.current.push("/notifications");
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: bg }}
              >
                <Icon size={14} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">{payload.title}</p>
                {payload.body && (
                  <p className="text-xs text-[#a0a0a0] mt-0.5 line-clamp-2">{payload.body}</p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
                className="p-0.5 text-[#555] hover:text-[#999] flex-shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          ),
          { duration: 5000, position: "bottom-right" }
        );
      }

      socket.on("notification", showNotifToast);
      socket.on("notification:broadcast", showNotifToast);
    });

    return () => {
      mounted = false;
      getSocket().then((s) => {
        s.off("notification");
        s.off("notification:broadcast");
      });
    };
  }, [queryClient]);

  // ── Socket: messages ──────────────────────────────────────────────────────
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

      {/* ── Notification dropdown backdrop ───────────────────────────────── */}
      {notifOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
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
              <Image src={logoUrl} alt={siteName} width={28} height={28} className="rounded-lg object-contain" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs"
                style={{ background: "#dc2626" }}
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
          <div className="p-4 border-t flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
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
            "0 0 60px color-mix(in srgb, #dc2626 5%, transparent)",
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
            <Image src={logoUrl} alt={siteName} width={26} height={26} className="rounded-lg object-contain" />
          ) : (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0"
              style={{ background: "#dc2626" }}
            >
              {siteName[0]}
            </div>
          )}
          <span className="font-bold text-sm text-white">{siteName}</span>
        </Link>

        {/* Visual separator (desktop) */}
        <div className="hidden lg:block w-px h-5 flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} />

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

          {/* ── Notifications (dropdown) ────────────────────────────── */}
          {rightIcons.notifications && (
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className={cn(
                  "relative p-2 rounded-xl transition-colors duration-200 group flex-shrink-0 overflow-hidden",
                  notifOpen || pathname === "/notifications" ? "text-white" : "text-[#888] hover:text-white"
                )}
                aria-label="Notifications"
              >
                <GlowBg active={notifOpen || pathname === "/notifications"} />
                <Bell size={17} className="relative z-10" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 z-20"
                    style={{ background: "#dc2626" }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && <NotifDropdown onClose={() => setNotifOpen(false)} />}
            </div>
          )}

          {/* Messages */}
          {rightIcons.messages && (
            <Link
              href="/messages"
              className={cn(
                "relative p-2 rounded-xl transition-colors duration-200 group flex-shrink-0",
                pathname === "/messages" ? "text-white" : "text-[#888] hover:text-white"
              )}
              aria-label="Messages"
            >
              <GlowBg active={pathname === "/messages"} />
              <MessageSquare size={17} className="relative z-10" />
              {unreadMsgCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 z-20"
                  style={{ background: "#dc2626" }}
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

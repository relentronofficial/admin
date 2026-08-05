"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, LifeBuoy, MessageSquare, Menu, X,
  PlayCircle, ClipboardList, Video, Trophy, Megaphone, Settings2, Film,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import {
  useNotificationUnreadCount,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useConversationUnreadCount,
} from "@/lib/hooks/useDashboard";
import { getSocket } from "@/lib/socket/client";
import { cn } from "@/lib/utils/cn";
import toast from "react-hot-toast";
import apiClient from "@/lib/api/client";
import { useMe } from "@/lib/hooks/useUser";
import { ThemeToggle } from "./ThemeToggle";
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
        background: "var(--color-notif-bg)",
        border: "1px solid var(--color-border-medium)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
        maxHeight: "420px",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
      >
        <span className="text-sm font-bold text-foreground">Notifications</span>
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
              <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "var(--color-surface-overlay)" }} />
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
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-overlay)]"
                  style={!n.isRead ? { background: "var(--color-surface-overlay-xs)" } : undefined}
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
                    <p className="text-xs font-semibold text-foreground leading-snug truncate">{n.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{n.body}</p>
                  </div>

                  {/* Media thumbnail */}
                  {n.mediaType === "image" && n.mediaUrl && (
                    <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={n.mediaUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {n.mediaType === "video" && n.mediaUrl && (
                    <div
                      className="w-11 h-11 rounded-lg flex-shrink-0 flex items-center justify-center"
                      style={{ background: "var(--color-surface-overlay-md)" }}
                    >
                      <Film size={14} className="text-muted-foreground" />
                    </div>
                  )}

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
        style={{ borderTop: "1px solid var(--color-border-subtle)" }}
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
  if (active) {
    return (
      <span
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: `color-mix(in srgb, var(--color-accent) 18%, var(--color-surface-overlay-md))`,
          border: `1px solid color-mix(in srgb, var(--color-accent) 32%, transparent)`,
          boxShadow: `0 0 16px color-mix(in srgb, var(--color-accent) 24%, transparent)`,
        }}
      />
    );
  }
  return (
    <span
      className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      style={{
        background: `color-mix(in srgb, var(--color-accent) 9%, var(--color-surface-overlay))`,
      }}
    />
  );
}

// ── Profile / Logout button ───────────────────────────────────────────────────

function ProfileButton() {
  const { data: me } = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await apiClient.post("/api/user-auth/logout").catch(() => {});
    queryClient.clear();
    router.replace("/login");
  };

  const initials = me
    ? (
        `${me.firstName?.[0] ?? ""}${me.lastName?.[0] ?? ""}`.toUpperCase() ||
        (me as any).name?.[0]?.toUpperCase() ||
        "?"
      )
    : "?";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white overflow-hidden flex-shrink-0"
        style={{ background: (me as any)?.avatarGradient || "var(--color-accent, #dc2626)" }}
        aria-label="Account menu"
      >
        {(me as any)?.profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(me as any).profilePhotoUrl} alt="" width={28} height={28} className="w-full h-full object-cover" />
        ) : initials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-44 rounded-xl z-50 py-1 overflow-hidden"
            style={{
              background: "var(--color-modal-bg)",
              backdropFilter: "blur(16px)",
              border: "1px solid var(--color-border-medium)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}
          >
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] transition-colors"
            >
              Profile
            </Link>
            <Link
              href="/community"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] transition-colors"
            >
              Community
            </Link>
            <Link
              href="/ebooks"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] transition-colors"
            >
              Ebooks
            </Link>
            <Link
              href="/podcasts"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] transition-colors"
            >
              Podcasts
            </Link>
            <Link
              href="/support"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] transition-colors"
            >
              Support
            </Link>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-[var(--color-surface-overlay)] transition-colors"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const { sidebarOpen, setSidebarOpen, toggleSidebar, theme } = useUIStore();
  const { config, nav, rightIcons } = useSiteConfig();
  const queryClient = useQueryClient();

  const [notifOpen, setNotifOpen] = useState(false);

  const { data: unreadCount = 0 } = useNotificationUnreadCount();
  const { data: unreadMsgCount = 0 } = useConversationUnreadCount();

  // ── Socket: invalidate + toast on new notification ────────────────────────
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;

    // Defer socket connection — keeps socket.io-client off the critical paint path.
    timer = setTimeout(() => {
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
                  background: "var(--color-modal-bg)",
                  border: "1px solid var(--color-border-medium)",
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
                  <p className="text-sm font-bold text-foreground leading-tight">{payload.title}</p>
                  {payload.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{payload.body}</p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
                  className="p-0.5 text-muted-foreground hover:text-foreground flex-shrink-0"
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
    }, 4000);

    return () => {
      mounted = false;
      clearTimeout(timer);
      getSocket().then((s) => {
        s.off("notification");
        s.off("notification:broadcast");
      });
    };
  }, [queryClient]);

  // ── Socket: messages ──────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;

    timer = setTimeout(() => {
      getSocket().then((socket) => {
        if (!mounted) return;
        socket.on("message:new", () => {
          queryClient.invalidateQueries({ queryKey: ["user", "conversations"] });
        });
      });
    }, 4000);

    return () => {
      mounted = false;
      clearTimeout(timer);
      getSocket().then((s) => s.off("message:new"));
    };
  }, [queryClient]);

  const siteName = config?.siteName ?? "TBT";
  const logoUrl = config?.logoUrl ?? null;
  const homeHref = nav[0]?.href ?? "/tbt";

  // Dark mode: use admin-configured logoUrl (white brand logo) or default white logo.
  // Light mode: always use the black logo — admin's logoUrl is the white version.
  const darkLogoSrc = logoUrl || "/tbt_logo.webp";
  const lightLogoSrc = "/tbt_logo_black.png";
  // Use a mounted guard so the SSR-rendered dark logo doesn't flash during hydration
  // when the saved theme is "light" (Zustand reads localStorage on client only).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const activeLogo = mounted && theme === "light" ? lightLogoSrc : darkLogoSrc;

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
          background: "var(--color-drawer-bg)",
          borderColor: "var(--color-border-subtle)",
          boxShadow: "4px 0 40px rgba(0,0,0,0.7)",
        }}
      >
        {/* Drawer header */}
        <div
          className="h-16 flex items-center justify-between px-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--color-border-subtle)" }}
        >
          <Link
            href={homeHref}
            onClick={() => setSidebarOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeLogo} alt={siteName} width={120} height={28} className="h-7 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).src = darkLogoSrc; }} />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer nav items */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ id, href, label }) => {
            const active =
              pathname === href ||
              pathname.startsWith(`${href}/`) ||
              (href === "/workshops" && pathname.startsWith("/workshop"));
            return (
              <Link
                key={id}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "relative flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group overflow-hidden",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <GlowBg active={active} />
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}

          {/* Utility links (separated) */}
          <div
            className="my-2 border-t"
            style={{ borderColor: "var(--color-border-subtle)" }}
          />
          {(() => {
            const communityActive = pathname === "/community" || pathname.startsWith("/community/");
            const ebooksActive = pathname === "/ebooks" || pathname.startsWith("/ebooks/");
            const podcastsActive = pathname === "/podcasts" || pathname.startsWith("/podcasts/");
            const supportActive = pathname === "/support" || pathname.startsWith("/support/");
            return (
              <>
                <Link
                  href="/community"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "relative flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group overflow-hidden",
                    communityActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <GlowBg active={communityActive} />
                  <span className="relative z-10">Community</span>
                </Link>
                <Link
                  href="/ebooks"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "relative flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group overflow-hidden",
                    ebooksActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <GlowBg active={ebooksActive} />
                  <span className="relative z-10">Ebooks</span>
                </Link>
                <Link
                  href="/podcasts"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "relative flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group overflow-hidden",
                    podcastsActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <GlowBg active={podcastsActive} />
                  <span className="relative z-10">Podcasts</span>
                </Link>
                <Link
                  href="/support"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "relative flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group overflow-hidden",
                    supportActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <GlowBg active={supportActive} />
                  <span className="relative z-10">Support</span>
                </Link>
              </>
            );
          })()}
        </nav>

      </div>

      {/* ── Floating top navbar ───────────────────────────────────────────── */}
      <header
        className="fixed top-3 left-4 right-4 z-40 h-14 flex items-center px-3 gap-3 rounded-2xl supports-[backdrop-filter]:md:backdrop-blur-xl"
        style={{
          background: "var(--color-navbar-bg)",
          border: "1px solid var(--color-border-subtle)",
          boxShadow: [
            "0 4px 24px rgba(0,0,0,0.55)",
            "0 1px 0 var(--color-surface-overlay) inset",
            "0 0 60px color-mix(in srgb, var(--color-accent) 5%, transparent)",
          ].join(", "),
        }}
      >
        {/* Mobile: hamburger */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden relative p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors duration-200 flex-shrink-0 group overflow-hidden"
          aria-label="Toggle menu"
        >
          <GlowBg active={false} />
          <Menu size={18} className="relative z-10" />
        </button>

        {/* Logo */}
        <Link href={homeHref} className="flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeLogo} alt={siteName} width={120} height={28} className="h-7 w-auto object-contain" fetchPriority="high" onError={(e) => { (e.target as HTMLImageElement).src = darkLogoSrc; }} />
        </Link>

        {/* Visual separator (desktop) */}
        <div className="hidden lg:block w-px h-5 flex-shrink-0" style={{ background: "var(--color-border-medium)" }} />

        {/* Desktop: inline nav */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1">
          {[
            // Messages and Notifications are already right-side icons;
            // drop them here to avoid duplication.
            ...nav.filter((n) => n.href !== "/messages" && n.href !== "/notifications"),
            { id: "__community", href: "/community", label: "Community" },
            { id: "__ebooks", href: "/ebooks", label: "Ebooks" },
            { id: "__podcasts", href: "/podcasts", label: "Podcasts" },
          ].map(({ id, href, label }) => {
            const active =
              pathname === href ||
              pathname.startsWith(`${href}/`) ||
              (href === "/workshops" && pathname.startsWith("/workshop"));
            return (
              <Link
                key={id}
                href={href}
                className={cn(
                  "relative px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors duration-200 group overflow-hidden flex-shrink-0",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
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

          {/* Theme toggle */}
          <ThemeToggle />

          {/* ── Notifications (dropdown) ────────────────────────────── */}
          {rightIcons.notifications && (
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className={cn(
                  "relative p-2 rounded-xl transition-colors duration-200 group flex-shrink-0",
                  notifOpen || pathname === "/notifications" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Notifications"
              >
                <GlowBg active={notifOpen || pathname === "/notifications"} />
                <Bell size={17} className="relative z-10" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 z-20"
                    style={{ background: "var(--color-accent)" }}
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
                pathname === "/messages" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Messages"
            >
              <GlowBg active={pathname === "/messages"} />
              <MessageSquare size={17} className="relative z-10" />
              {unreadMsgCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 z-20"
                  style={{ background: "var(--color-accent)" }}
                >
                  {unreadMsgCount > 99 ? "99+" : unreadMsgCount}
                </span>
              )}
            </Link>
          )}

          {/* Support */}
          <Link
            href="/support"
            className={cn(
              "relative p-2 rounded-xl transition-colors duration-200 group flex-shrink-0",
              pathname === "/support" || pathname.startsWith("/support/")
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Support"
            title="Support"
          >
            <GlowBg active={pathname === "/support" || pathname.startsWith("/support/")} />
            <LifeBuoy size={17} className="relative z-10" />
          </Link>

          {/* Profile avatar */}
          {rightIcons.profile && (
            <div className="pl-0.5">
              <ProfileButton />
            </div>
          )}
        </div>
      </header>
    </>
  );
}

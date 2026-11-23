"use client";

import { START_TOUR_EVENT } from "@/components/features/onboarding-tour/OnboardingTour";
import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, LifeBuoy, MessageSquare, Menu, X, Film, CheckCheck, ArrowRight,
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
import { StreakButton } from "./StreakButton";
import { TierAccessIndicator } from "./TierAccessIndicator";
import { CoinBalanceIndicator } from "./CoinBalanceIndicator";
import { getNotifIcon, normalizeNotifUrl } from "@/lib/utils/notifications";
import { timeAgo } from "@/lib/utils/format";
import { buildNavMenu } from "@/lib/utils/navOrder";
import type { Notification } from "@/types";

// ── Notification dropdown ─────────────────────────────────────────────────────
// A frosted-glass panel. It is portalled to <body> and pinned under the bell:
// the header itself has a backdrop blur, and a blur nested inside another blur
// can't see the page behind it, so the glass would render flat in place.

function NotifDropdown({ onClose, anchorRef }: { onClose: () => void; anchorRef: RefObject<HTMLElement | null> }) {
  const router = useRouter();
  const { data, isLoading } = useNotifications({ limit: 5 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const notifications: Notification[] = data?.data ?? [];
  const unreadInList = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    function place() {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef]);

  function handleClick(n: Notification) {
    onClose();
    if (!n.isRead) markRead.mutate(n.id);
    router.push(n.actionUrl ? normalizeNotifUrl(n.actionUrl) : "/notifications");
  }

  if (!pos) return null;

  return createPortal(
    <div
      role="dialog"
      aria-label="Notifications"
      className="notif-glass fixed z-50 w-[min(340px,calc(100vw-24px))] rounded-2xl overflow-hidden flex flex-col"
      style={{ top: pos.top, right: pos.right, maxHeight: "min(460px, calc(100dvh - 96px))" }}
    >
      {/* Header */}
      <div className="notif-glass-divider flex items-center justify-between gap-2 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">Notifications</span>
          {unreadInList > 0 && (
            <span className="notif-glass-count text-[10px] font-bold px-1.5 py-px rounded-full">{unreadInList} new</span>
          )}
        </div>
        {unreadInList > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="notif-glass-link inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg disabled:opacity-50"
          >
            <CheckCheck size={12} /> Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="notif-glass-item h-16 rounded-xl animate-pulse" />)
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2">
            <div className="notif-glass-icon w-11 h-11 rounded-2xl flex items-center justify-center">
              <Bell size={18} className="text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">You&apos;re all caught up</p>
          </div>
        ) : (
          notifications.map((n) => {
            const { Icon, color } = getNotifIcon(n.iconType);
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                data-unread={!n.isRead || undefined}
                className="notif-glass-item group w-full flex items-start gap-3 p-3 rounded-xl text-left"
              >
                {/* Type icon in a tinted glass tile */}
                <div
                  className="notif-glass-icon w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ ["--notif-tint" as string]: color }}
                >
                  <Icon size={15} style={{ color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 min-w-0 text-[13px] font-semibold text-foreground leading-snug truncate">{n.title}</p>
                    {!n.isRead && <span className="notif-glass-dot w-2 h-2 rounded-full flex-shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground opacity-80 mt-1">{timeAgo(n.createdAt)}</p>
                </div>

                {/* Media thumbnail */}
                {n.mediaType === "image" && n.mediaUrl && (
                  <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={n.mediaUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                {n.mediaType === "video" && n.mediaUrl && (
                  <div className="notif-glass-icon w-11 h-11 rounded-lg flex-shrink-0 flex items-center justify-center">
                    <Film size={14} className="text-muted-foreground" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="notif-glass-divider notif-glass-divider-top px-3 py-2.5 flex-shrink-0">
        <Link
          href="/notifications"
          onClick={onClose}
          className="notif-glass-link flex items-center justify-center gap-1 w-full py-2 rounded-xl text-[12px] font-semibold"
        >
          View all notifications <ArrowRight size={13} />
        </Link>
      </div>
    </div>,
    document.body,
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
  const { hiddenMenuKeys, uiStrings } = useSiteConfig();
  const [open, setOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const avatarUrl = (me as any)?.avatarUrl ?? null;
  useEffect(() => { setAvatarError(false); }, [avatarUrl]);

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
        className="-m-2 p-2 rounded-full flex items-center justify-center flex-shrink-0"
        aria-label="Account menu"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white overflow-hidden pointer-events-none"
          style={{ background: (me as any)?.avatarGradient || "var(--color-accent, #dc2626)" }}
        >
          {avatarUrl && !avatarError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              width={28}
              height={28}
              className="w-full h-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : initials}
        </div>
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
            {!hiddenMenuKeys.includes("community") && (
              <Link
                href="/community"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] transition-colors"
              >
                Community
              </Link>
            )}
            {!hiddenMenuKeys.includes("ebooks") && (
              <Link
                href="/ebooks"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] transition-colors"
              >
                Ebooks
              </Link>
            )}
            {!hiddenMenuKeys.includes("podcasts") && (
              <Link
                href="/podcasts"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] transition-colors"
              >
                Podcasts
              </Link>
            )}
            {!hiddenMenuKeys.includes("support") && (
              <Link
                href="/support"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] transition-colors"
              >
                Support
              </Link>
            )}
            <button
              type="button"
              onClick={() => { setOpen(false); window.dispatchEvent(new Event(START_TOUR_EVENT)); }}
              className="w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] transition-colors"
            >
              {(uiStrings as any)?.tourReplayLabel || "Take the tour"}
            </button>
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

// ── Mobile drawer (extracted to allow useMe() call) ──────────────────────────

interface DrawerContentProps {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  pathname: string;
  navMenu: { id: string; href: string; label: string }[];
  homeHref: string;
  siteName: string;
  lightLogoSrc: string;
  darkLogoSrc: string;
}

// Messages and Notifications are top-bar icons on every screen size, so neither
// menu repeats them. The desktop bar and the mobile drawer both render exactly
// this list, so phones show the same menu items as laptops.
function menuItems<T extends { href: string }>(navMenu: T[]): T[] {
  return navMenu.filter((n) => n.href !== "/messages" && n.href !== "/notifications");
}

function DrawerContent({
  sidebarOpen, setSidebarOpen, pathname, navMenu,
  homeHref, siteName, lightLogoSrc, darkLogoSrc,
}: DrawerContentProps) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [avatarError, setAvatarError] = useState(false);
  const avatarUrl = (me as any)?.avatarUrl ?? null;
  useEffect(() => { setAvatarError(false); }, [avatarUrl]);

  const handleLogout = async () => {
    setSidebarOpen(false);
    await apiClient.post("/api/user-auth/logout").catch(() => {});
    queryClient.clear();
    router.replace("/login");
  };

  const initials = me
    ? (`${me.firstName?.[0] ?? ""}${me.lastName?.[0] ?? ""}`.toUpperCase() || (me as any).name?.[0]?.toUpperCase() || "?")
    : "?";

  const memberName = me ? ((me as any).name || `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || "Member") : "";
  const memberPlan = (me as any)?.membershipPlan;


  return (
    <div
      className={cn(
        "fixed top-0 left-0 h-full w-[85vw] max-w-[320px] z-50 flex flex-col border-r transition-transform duration-300 ease-out lg:hidden",
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
        <Link href={homeHref} onClick={() => setSidebarOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightLogoSrc} alt={siteName} width={120} height={28} className="h-7 w-auto object-contain block dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={darkLogoSrc} alt={siteName} width={120} height={28} className="h-7 w-auto object-contain hidden dark:block" />
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors duration-200"
        >
          <X size={16} />
        </button>
      </div>

      {/* Profile mini card */}
      {me && (
        <div
          className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: "var(--color-border-subtle)" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white overflow-hidden flex-shrink-0"
            style={{ background: (me as any)?.avatarGradient || "var(--color-accent)" }}
          >
            {avatarUrl && !avatarError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" onError={() => setAvatarError(true)} />
            ) : initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{memberName}</p>
            {memberPlan && memberPlan !== "free" && (
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)" }}
              >
                {memberPlan}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {menuItems(navMenu).map(({ id, href, label }) => {
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

        {/* Sign out */}
        <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-[var(--color-surface-overlay)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useUIStore();
  const { config, nav, rightIcons, hiddenMenuKeys, navOrder } = useSiteConfig();
  const queryClient = useQueryClient();
  // Nav items + Community/Ebooks/Podcasts in the order set in Admin → Navigation.
  const navMenu = buildNavMenu({ nav, hiddenMenuKeys, navOrder });

  const [notifOpen, setNotifOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

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
                  routerRef.current.push(payload.actionUrl ? normalizeNotifUrl(payload.actionUrl) : "/notifications");
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
  const homeHref = nav[0]?.href ?? "/community";

  // Dark mode: use admin-configured logoUrl (white brand logo) or default white logo.
  // Light mode: always use the black logo — admin's logoUrl is the white version.
  // Both logos are always in the DOM; CSS dark:/light: classes show the correct one
  // immediately based on the <html> theme class set server-side (no JS, no flash).
  const darkLogoSrc = logoUrl || "/tbt_logo.webp";
  const lightLogoSrc = "/tbt_logo_black.png";

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
      <DrawerContent
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        pathname={pathname}
        navMenu={navMenu}
        homeHref={homeHref}
        siteName={siteName}
        lightLogoSrc={lightLogoSrc}
        darkLogoSrc={darkLogoSrc}
      />

      {/* ── Floating top navbar ───────────────────────────────────────────── */}
      <header
        className="fixed top-3 left-4 right-4 z-40 h-14 flex items-center px-2 gap-2 sm:px-3 sm:gap-3 rounded-2xl supports-[backdrop-filter]:md:backdrop-blur-xl"
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
          className="lg:hidden relative p-1.5 sm:p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors duration-200 flex-shrink-0 group overflow-hidden"
          aria-label="Toggle menu"
          data-tour="menu"
        >
          <GlowBg active={false} />
          <Menu size={18} className="relative z-10" />
        </button>

        {/* Logo — CSS-driven light/dark swap, no JS state, no flash */}
        <Link href={homeHref} className="flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightLogoSrc} alt={siteName} width={120} height={28} className="h-7 w-auto object-contain block dark:hidden" fetchPriority="high" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={darkLogoSrc} alt={siteName} width={120} height={28} className="h-7 w-auto object-contain hidden dark:block" fetchPriority="high" />
        </Link>

        {/* Visual separator (desktop) */}
        <div className="hidden lg:block w-px h-5 flex-shrink-0" style={{ background: "var(--color-border-medium)" }} />

        {/* Desktop: inline nav */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1" data-tour="nav">
          {menuItems(navMenu).map(({ id, href, label }) => {
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
        <div className="flex items-center gap-0.5 sm:gap-1 ml-auto lg:ml-0">

          {/* Streak, Coins, Tier — hidden on mobile to prevent navbar overflow */}
          <div className="hidden lg:flex items-center gap-1 sm:gap-2 sm:mr-1" data-tour="progress">
            {!hiddenMenuKeys.includes("streak") && <StreakButton />}
            <CoinBalanceIndicator />
            <TierAccessIndicator />
          </div>

          {/* ── Notifications (dropdown) ────────────────────────────── */}
          {rightIcons.notifications && (
            <div className="relative" data-tour="notifications">
              <button
                ref={bellRef}
                onClick={() => setNotifOpen((v) => !v)}
                className={cn(
                  "relative p-1.5 sm:p-2 rounded-xl transition-colors duration-200 group flex-shrink-0",
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
              {notifOpen && <NotifDropdown onClose={() => setNotifOpen(false)} anchorRef={bellRef} />}
            </div>
          )}

          {/* Messages */}
          {rightIcons.messages && (
            <Link
              href="/messages"
              className={cn(
                "relative p-1.5 sm:p-2 rounded-xl transition-colors duration-200 group flex-shrink-0",
                pathname === "/messages" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Messages"
              data-tour="messages"
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

          {/* Support — top-bar icon on every screen size (the mobile drawer shows only the desktop menu items). */}
          {!hiddenMenuKeys.includes("support") && (
            <Link
              href="/support"
              className={cn(
                "relative p-1.5 sm:p-2 rounded-xl transition-colors duration-200 group flex-shrink-0",
                pathname === "/support" || pathname.startsWith("/support/")
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Support"
              title="Support"
              data-tour="support"
            >
              <GlowBg active={pathname === "/support" || pathname.startsWith("/support/")} />
              <LifeBuoy size={17} className="relative z-10" />
            </Link>
          )}

          {/* Profile avatar */}
          {rightIcons.profile && (
            <div className="pl-0.5" data-tour="profile">
              <ProfileButton />
            </div>
          )}
        </div>
      </header>
    </>
  );
}

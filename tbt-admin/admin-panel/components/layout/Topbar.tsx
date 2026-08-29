"use client";

import { UserButton } from "@clerk/nextjs";
import { Bell, BellRing, Settings, Check, CheckCheck, Megaphone, Users, ShoppingBag, Video, BookOpen, Info, ClipboardList } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  useAdminNotifications,
  useAdminUnreadCount,
  useMarkAdminNotificationRead,
  useMarkAllAdminNotificationsRead,
} from "@/lib/hooks/useTbt";
import { getAdminSocket } from "@/lib/socket/client";
import { toast } from "react-hot-toast";
import { resolveNotificationRoute } from "@/lib/utils/notificationRouter";
import { useUnacknowledgedTicketsCount } from "@/components/support/HelpdeskAlarmProvider";

// ── Type icon map ─────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { Icon: React.ElementType; color: string; bg: string }> = {
  member_pending:          { Icon: Users,         color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  member_joined:           { Icon: Users,         color: "#22c55e", bg: "rgba(34,197,94,0.15)"  },
  workshop_access_request: { Icon: Video,         color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  course_access_request:   { Icon: BookOpen,      color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" },
  product_inquiry:         { Icon: ShoppingBag,   color: "#ec4899", bg: "rgba(236,72,153,0.15)" },
  announcement:            { Icon: Megaphone,     color: "#dc2626", bg: "rgba(220,38,38,0.15)"  },
  day_submitted:           { Icon: ClipboardList, color: "#f97316", bg: "rgba(249,115,22,0.15)" },
};

function typeConfig(type: string) {
  return TYPE_CONFIG[type] ?? { Icon: Info, color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
}

function timeAgo(dateStr: string | Date) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Notification dropdown ─────────────────────────────────────────────────────

function NotifPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data, isLoading } = useAdminNotifications(1, 30);
  const markRead   = useMarkAdminNotificationRead();
  const markAll    = useMarkAllAdminNotificationsRead();

  const notifications: any[] = data?.data ?? [];
  const hasUnread = notifications.some((n: any) => !n.isRead);

  function handleClick(n: any) {
    if (!n.isRead) markRead.mutate(n.id);
    const route = resolveNotificationRoute({ type: n.type, metadata: n.metadata });
    onClose();
    router.push(route);
  }

  return (
    <div
      className="absolute right-0 top-full mt-2 w-[360px] rounded-xl overflow-hidden z-[200] flex flex-col"
      style={{
        background: "#141414",
        border: "1px solid #2a2a2a",
        boxShadow: "0 16px 48px rgba(0,0,0,0.75)",
        maxHeight: "480px",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid #222" }}
      >
        <span className="text-[13px] font-bold text-[#f0f0f0] font-rajdhani tracking-wide uppercase">
          Notifications
        </span>
        {hasUnread && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#a0a0a0] hover:text-[#dc2626] disabled:opacity-40 transition-colors"
          >
            <CheckCheck size={12} />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="space-y-1 p-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: "#1e1e1e" }} />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Bell size={24} className="text-[#444]" />
            <p className="text-[12px] text-[#555]">No notifications yet</p>
          </div>
        ) : (
          <div className="py-1">
            {notifications.map((n: any) => {
              const { Icon, color, bg } = typeConfig(n.type);
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] cursor-pointer"
                  style={!n.isRead ? { background: "rgba(220,38,38,0.04)" } : undefined}
                >
                  {/* Icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: bg }}
                  >
                    <Icon size={14} style={{ color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#f0f0f0] leading-snug truncate">{n.title}</p>
                    <p className="text-[11px] text-[#888] mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-[#555] mt-1">{timeAgo(n.createdAt)}</p>
                  </div>

                  {/* Unread dot */}
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 bg-[#dc2626]" />
                  )}

                  {/* Read checkmark */}
                  {n.isRead && (
                    <Check size={11} className="flex-shrink-0 mt-1.5 text-[#444]" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────

export function Topbar() {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState(0);
  const panelRef  = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useAdminUnreadCount();
  const router = useRouter();
  const unacknowledgedTickets = useUnacknowledgedTicketsCount();

  // Listen for day submissions from members
  useEffect(() => {
    let mounted = true;
    function onDaySubmitted(data: { dayNumber: number; memberName?: string; batchName?: string }) {
      if (!mounted) return;
      setPendingSubmissions(n => n + 1);
      const who = data.memberName ?? "A member";
      const where = data.batchName ? ` (${data.batchName})` : "";
      toast(`${who} submitted Day ${data.dayNumber}${where}`, {
        icon: "📋",
        style: { background: "#1a1a1a", color: "#f0f0f0", border: "1px solid #2a2a2a" },
      });
    }
    getAdminSocket().then(socket => {
      if (!mounted) return;
      socket.on("admin:day_submitted", onDaySubmitted);
    });
    return () => {
      mounted = false;
      getAdminSocket().then(socket => socket.off("admin:day_submitted", onDaySubmitted));
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  // Breadcrumbs
  const paths = (pathname || "").split("/").filter(Boolean);
  const formatted = paths.map(p => p.charAt(0).toUpperCase() + p.slice(1));

  const displayCount = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <header className="h-[54px] bg-[#111] border-b border-[#2a2a2a] px-7 flex items-center sticky top-0 z-[50] font-sans">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5">
        <span className="font-rajdhani font-bold text-[17px] text-[#e02020] tracking-tight">TBT</span>
        <span className="text-[#666] mx-1">|</span>
        <nav className="flex items-center gap-1.5">
          <span className="text-[13px] text-[#a0a0a0] hover:text-[#f0f0f0] cursor-pointer transition-colors font-medium">Dashboard</span>
          {formatted.length > 1 && (
            <>
              <span className="text-[#666] mx-0.5 text-xs">›</span>
              <span className="text-[13px] text-[#a0a0a0] hover:text-[#f0f0f0] cursor-pointer transition-colors font-medium">
                {formatted[0]}
              </span>
              <span className="text-[#666] mx-0.5 text-xs">›</span>
              <span className="text-[13px] text-[#f0f0f0] font-semibold tracking-tight">
                {formatted[formatted.length - 1]}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-3.5">

        {/* Unacknowledged support tickets — pulsing, distinct from the
            regular (non-pulsing) admin-notifications bell below */}
        {unacknowledgedTickets > 0 && (
          <button
            onClick={() => router.push("/support?tab=tickets&status=new")}
            className="relative w-8 h-8 bg-[#1f1f1f] border border-[#dc2626] rounded-md flex items-center justify-center text-[#dc2626] hover:bg-[#2a2a2a] transition-all shadow-sm animate-pulse"
            aria-label="Unacknowledged support tickets"
            title="Unacknowledged support tickets — click to view"
          >
            <BellRing size={15} strokeWidth={2} />
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-1 leading-none"
              style={{ background: "#dc2626", boxShadow: "0 0 0 2px #111" }}
            >
              {unacknowledgedTickets > 99 ? "99+" : unacknowledgedTickets}
            </span>
          </button>
        )}

        {/* Pending submissions badge */}
        <button
          onClick={() => setPendingSubmissions(0)}
          className="relative w-8 h-8 bg-[#1f1f1f] border border-[#2a2a2a] rounded-md flex items-center justify-center text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#f0f0f0] transition-all shadow-sm"
          aria-label="Pending submissions"
          title="Pending day submissions"
        >
          <ClipboardList size={15} strokeWidth={2} />
          {pendingSubmissions > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-1 leading-none"
              style={{ background: "#f59e0b", boxShadow: "0 0 0 2px #111" }}
            >
              {pendingSubmissions > 99 ? "99+" : pendingSubmissions}
            </span>
          )}
        </button>

        {/* Bell + dropdown */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative w-8 h-8 bg-[#1f1f1f] border border-[#2a2a2a] rounded-md flex items-center justify-center text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#f0f0f0] transition-all shadow-sm"
            aria-label="Notifications"
          >
            <Bell size={15} strokeWidth={2} />

            {/* Unread badge */}
            {displayCount && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-1 leading-none"
                style={{ background: "#dc2626", boxShadow: "0 0 0 2px #111" }}
              >
                {displayCount}
              </span>
            )}
          </button>

          {notifOpen && <NotifPanel onClose={() => setNotifOpen(false)} />}
        </div>

        <button className="w-8 h-8 bg-[#1f1f1f] border border-[#2a2a2a] rounded-md flex items-center justify-center text-[#a0a0a0] hover:bg-[#2a2a2a] hover:text-[#f0f0f0] transition-all shadow-sm">
          <Settings size={15} strokeWidth={2} />
        </button>

        <div className="flex items-center border-l border-[#2a2a2a] pl-4 ml-1">
          <UserButton
            appearance={{
              elements: { userButtonAvatarBox: "w-8 h-8 border border-[#333]" },
            }}
          />
        </div>
      </div>
    </header>
  );
}

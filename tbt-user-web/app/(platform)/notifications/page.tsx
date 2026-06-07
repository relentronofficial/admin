"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Check, X,
  PlayCircle, ClipboardList, Video, Trophy, Megaphone, Settings2,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageLoader } from "@/components/common/LoadingSpinner";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDismissNotification,
  useClearReadNotifications,
} from "@/lib/hooks/useDashboard";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { Notification } from "@/types";

// ── Type icon config ──────────────────────────────────────────────────────────

const NOTIF_ICONS = {
  video:        { Icon: PlayCircle,    color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
  assignment:   { Icon: ClipboardList, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  live_call:    { Icon: Video,         color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  achievement:  { Icon: Trophy,        color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  announcement: { Icon: Megaphone,     color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  system:       { Icon: Settings2,     color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
} as const;

function getNotifIcon(iconType?: string | null) {
  return NOTIF_ICONS[iconType as keyof typeof NOTIF_ICONS]
    ?? { Icon: Bell, color: "#6b7280", bg: "rgba(107,114,128,0.10)" };
}

// ── Date grouping ─────────────────────────────────────────────────────────────

const DATE_ORDER = ["Today", "Yesterday", "This Week", "Older"] as const;
type DateGroup = (typeof DATE_ORDER)[number];

function getDateGroup(iso: string): DateGroup {
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  return "Older";
}

function groupByDate(items: Notification[]): { group: DateGroup; items: Notification[] }[] {
  const map = new Map<DateGroup, Notification[]>(DATE_ORDER.map((g) => [g, []]));
  for (const item of items) map.get(getDateGroup(item.createdAt))!.push(item);
  return DATE_ORDER.filter((g) => map.get(g)!.length > 0).map((g) => ({ group: g, items: map.get(g)! }));
}

// ── Filter types ──────────────────────────────────────────────────────────────

type NotifFilter = "all" | "unread";
const LIMIT = 30;

// ─────────────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<NotifFilter>("all");

  const { data, isLoading } = useNotifications({
    page,
    limit: LIMIT,
    unread: filter === "unread" ? true : undefined,
  });

  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();
  const clearRead = useClearReadNotifications();
  const { uiStrings } = useSiteConfig();

  const notifications: Notification[] = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const hasRead = notifications.some((n) => n.isRead);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function handleClick(n: Notification) {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.actionUrl) router.push(n.actionUrl);
  }

  const groups = groupByDate(notifications);

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{uiStrings?.notificationsPageTitle}</h2>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount} {uiStrings?.notificationsUnreadSuffix}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasRead && filter === "all" && (
            <button
              onClick={() => clearRead.mutate()}
              disabled={clearRead.isPending}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Clear read
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
              style={{ color: "var(--color-accent)" }}
            >
              <Check size={14} />
              {uiStrings?.notificationsMarkAllLabel}
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex rounded-lg overflow-hidden border border-border w-fit">
        {(["all", "unread"] as NotifFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className="text-xs font-bold px-4 py-1.5 capitalize transition-colors"
            style={{
              background: filter === f ? "var(--color-accent)" : "transparent",
              color: filter === f ? "#fff" : "#a0a0a0",
            }}
          >
            {f === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <PageLoader />
      ) : notifications.length > 0 ? (
        <div className="space-y-6">
          {groups.map(({ group, items }) => (
            <div key={group} className="space-y-1.5">
              {/* Date group label */}
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground font-rajdhani px-1 mb-2">
                {group}
              </p>

              {items.map((n) => {
                const { Icon, color, bg } = getNotifIcon(n.iconType);
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "group relative flex items-start gap-3 rounded-xl border p-4 transition-all cursor-pointer",
                      n.isRead
                        ? "border-border bg-card"
                        : "border-transparent hover:border-[rgba(255,255,255,0.08)]"
                    )}
                    style={
                      !n.isRead
                        ? {
                            borderColor: "color-mix(in srgb, var(--color-accent) 25%, transparent)",
                            background: "color-mix(in srgb, var(--color-accent) 5%, transparent)",
                          }
                        : undefined
                    }
                    onClick={() => handleClick(n)}
                  >
                    {/* Type icon badge */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: bg }}
                    >
                      <Icon size={16} style={{ color }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug">{n.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {!n.isRead && (
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: "var(--color-accent)" }}
                          />
                        )}
                        <p className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                        {n.actionUrl && (
                          <span className="text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
                            View →
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dismiss button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); dismiss.mutate(n.id); }}
                      className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground flex-shrink-0"
                      title="Dismiss"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title={filter === "unread" ? "No unread notifications" : (uiStrings?.notificationsEmptyTitle ?? "")}
          description={filter === "unread" ? "You're all caught up!" : (uiStrings?.notificationsEmptyDesc ?? "")}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            className="text-sm font-medium disabled:opacity-40"
            style={{ color: page > 1 ? "var(--color-accent)" : undefined }}
          >
            {uiStrings?.paginationPrevLabel}
          </button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="text-sm font-medium disabled:opacity-40"
            style={{ color: page < totalPages ? "var(--color-accent)" : undefined }}
          >
            {uiStrings?.paginationNextLabel}
          </button>
        </div>
      )}
    </div>
  );
}

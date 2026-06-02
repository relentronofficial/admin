"use client";

import { Bell, Check } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/lib/hooks/useDashboard";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications({ limit: 50 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const notifications = data?.data ?? [];
  const unread = notifications.filter((n) => !n.isRead);

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
          {unread.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{unread.length} unread</p>
          )}
        </div>
        {unread.length > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="text-sm text-brand-600 font-medium hover:text-brand-700 transition-colors flex items-center gap-1.5"
          >
            <Check size={14} /> Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <PageLoader />
      ) : notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.isRead && markRead.mutate(n.id)}
              className={cn(
                "w-full text-left rounded-xl border p-4 transition-colors",
                n.isRead
                  ? "border-border bg-card"
                  : "border-brand-200 bg-brand-50/50 dark:bg-brand-900/10 dark:border-brand-800"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-2 shrink-0",
                  n.isRead ? "bg-transparent" : "bg-brand-600"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon={Bell} title="No notifications yet" description="We'll notify you about events, course updates, and more." />
      )}
    </div>
  );
}

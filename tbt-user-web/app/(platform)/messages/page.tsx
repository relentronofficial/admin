"use client";

import { useState } from "react";
import { MessageSquare, Check } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { useMessages, useMarkMessageRead, useMarkAllMessagesRead } from "@/lib/hooks/useDashboard";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";

const LIMIT = 20;

export default function MessagesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMessages({ page, limit: LIMIT });
  const { data: unreadData } = useMessages({ unread: true, limit: 1 });

  const markRead = useMarkMessageRead();
  const markAll = useMarkAllMessagesRead();
  const { uiStrings } = useSiteConfig();

  const messages = data?.data ?? [];
  const total: number = data?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const totalUnread: number = unreadData?.meta?.total ?? 0;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{uiStrings?.messagesPageTitle}</h2>
          {totalUnread > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalUnread} {uiStrings?.messagesUnreadSuffix}
            </p>
          )}
        </div>
        {totalUnread > 0 && (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
            style={{ color: "var(--color-accent)" }}
          >
            <Check size={14} />
            {uiStrings?.messagesMarkAllLabel}
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <PageLoader />
      ) : messages.length > 0 ? (
        <div className="space-y-2">
          {messages.map((m) => (
            <button
              key={m.id}
              onClick={() => !m.isRead && markRead.mutate(m.id)}
              className={cn(
                "w-full text-left rounded-xl border p-4 transition-colors",
                m.isRead && "bg-card"
              )}
              style={
                !m.isRead
                  ? {
                      borderColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
                      background: "color-mix(in srgb, var(--color-accent) 5%, transparent)",
                    }
                  : undefined
              }
            >
              <div className="flex items-start gap-3">
                {/* Sender avatar or fallback initial */}
                {m.senderAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.senderAvatarUrl}
                    alt={m.senderName}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-xs font-bold"
                    style={{ background: "var(--color-accent)" }}
                  >
                    {m.senderName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-muted-foreground truncate">{m.senderName}</p>
                    {!m.isRead && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: "var(--color-accent)" }}
                      />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{m.subject}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{m.body}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">{timeAgo(m.createdAt)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title={uiStrings?.messagesEmptyTitle ?? ""}
          description={uiStrings?.messagesEmptyDesc ?? ""}
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

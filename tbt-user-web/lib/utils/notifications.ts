import {
  Bell, PlayCircle, ClipboardList, Video, Trophy, Megaphone, Settings2, MessageSquare,
  type LucideIcon,
} from "lucide-react";

// ── URL normalisation ───────────────────────────────────────────────────────
// Older AppNotification rows (created before actionUrl generation was fixed
// at the source — see backend lib/notifications.ts and courseNotifications.ts)
// may still carry stale shapes. New rows are already correct; this only
// patches historical data so old notifications keep working.
export function normalizeNotifUrl(url: string): string {
  // /messages/{id} → /messages?conversation={id}  (no dedicated [id] route)
  if (/^\/messages\/[^/]+$/.test(url)) return url.replace(/^\/messages\/([^/]+)$/, "/messages?conversation=$1");
  // /tbt/learning/{id} and /tbt/programs/{id} → /learning/{id}  (wrong /tbt prefix)
  if (/^\/tbt\/(learning|programs)\//.test(url)) return url.replace(/^\/tbt\/(learning|programs)\//, "/learning/");
  return url;
}

// ── Type → icon config ──────────────────────────────────────────────────────

export const NOTIF_ICONS: Record<string, { Icon: LucideIcon; color: string; bg: string }> = {
  video:        { Icon: PlayCircle,    color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
  assignment:   { Icon: ClipboardList, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  live_call:    { Icon: Video,         color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  achievement:  { Icon: Trophy,        color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  announcement: { Icon: Megaphone,     color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  message:      { Icon: MessageSquare, color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  system:       { Icon: Settings2,     color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
};

export function getNotifIcon(iconType?: string | null) {
  return NOTIF_ICONS[iconType as keyof typeof NOTIF_ICONS]
    ?? { Icon: Bell, color: "#6b7280", bg: "rgba(107,114,128,0.10)" };
}

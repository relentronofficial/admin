import { format, formatDistanceToNow } from "date-fns";

export const formatDate = (date: string | Date, pattern = "MMM d, yyyy") =>
  format(new Date(date), pattern);

export const formatDateTime = (date: string | Date) =>
  format(new Date(date), "MMM d, yyyy 'at' h:mm a");

export const timeAgo = (date: string | Date) =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const formatPoints = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

// Converts Bunny Stream standalone player URLs to embeddable iframe URLs.
// player.mediadelivery.net/play/{lib}/{id} → iframe.mediadelivery.net/embed/{lib}/{id}
// Adds fullscreen=false to hide Bunny's native FS button in favor of our watermark wrapper.
export const normalizeBunnyUrl = (url: string): string => {
  if (!url) return url;
  const normalized = url.replace(
    /https?:\/\/player\.mediadelivery\.net\/play\/(\d+)\/([\w-]+)/,
    "https://iframe.mediadelivery.net/embed/$1/$2"
  );
  const sep = normalized.includes("?") ? "&" : "?";
  return `${normalized}${sep}fullscreen=false`;
};

// Appends ?t=N (or &t=N) to a Bunny Stream iframe embed URL.
// Always sets an explicit start time — including t=0 — so Bunny's own smart-resume
// (which stores position in the iframe's localStorage) is always overridden.
export const withResumeTime = (url: string, seconds: number): string => {
  const t = Math.max(0, Math.floor(seconds ?? 0));
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${t}`;
};

export const planLabel: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  premium: "Premium",
  vip: "VIP",
  enterprise: "Enterprise",
};

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
export const normalizeBunnyUrl = (url: string): string => {
  if (!url) return url;
  return url.replace(
    /https?:\/\/player\.mediadelivery\.net\/play\/(\d+)\/([\w-]+)/,
    "https://iframe.mediadelivery.net/embed/$1/$2"
  );
};

// Appends ?t=N (or &t=N) to a Bunny Stream iframe embed URL for resume-from-position.
export const withResumeTime = (url: string, seconds: number): string => {
  if (!seconds || seconds <= 0) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${Math.floor(seconds)}`;
};

export const planLabel: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  premium: "Premium",
  vip: "VIP",
  enterprise: "Enterprise",
};

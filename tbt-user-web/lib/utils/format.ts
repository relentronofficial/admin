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

export const planLabel: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  premium: "Premium",
  vip: "VIP",
  enterprise: "Enterprise",
};

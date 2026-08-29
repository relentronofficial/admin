import type { SupportTicketStatus } from "@/types";

/**
 * Shared ticket-status → { color, label } map. Was previously duplicated
 * across support/page.tsx, support/tickets/page.tsx and
 * support/tickets/[id]/page.tsx — consolidated here when the two new
 * lifecycle states (acknowledged, waiting_for_user) were added so all three
 * surfaces stay in sync automatically.
 */
export const SUPPORT_STATUS_MAP: Record<SupportTicketStatus, { color: string; label: string }> = {
  new: { color: "#60a5fa", label: "New" },
  acknowledged: { color: "#a78bfa", label: "Being Reviewed" },
  in_progress: { color: "#facc15", label: "In Progress" },
  waiting_for_user: { color: "#fb923c", label: "Waiting for Your Reply" },
  resolved: { color: "#4ade80", label: "Resolved" },
  closed: { color: "#a0a0a0", label: "Closed" },
};

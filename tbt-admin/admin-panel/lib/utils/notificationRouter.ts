export function resolveNotificationRoute(notification: {
  type: string;
  metadata?: unknown;
}): string {
  // Defensive: JSONB from pg comes back as a parsed object, but historical
  // records stored before the ::jsonb cast may be raw strings.
  let m: Record<string, unknown> = {};
  if (notification.metadata && typeof notification.metadata === "object") {
    m = notification.metadata as Record<string, unknown>;
  } else if (typeof notification.metadata === "string") {
    try { m = JSON.parse(notification.metadata); } catch { /* ignore */ }
  }

  switch (notification.type) {
    case "member_pending":
    case "member_joined":
      return m.memberId ? `/members/${m.memberId}` : "/members";

    case "workshop_access_request":
      return m.workshopId ? `/workshops/${m.workshopId}` : "/workshops";

    // Navigates to /courses and auto-opens the specific course's detail panel
    case "course_access_request":
      return m.courseId ? `/courses?open=${m.courseId}` : "/courses";

    // Navigates to /products and auto-switches to the Purchase Inquiries tab
    case "product_inquiry":
      return "/products?tab=inquiries";

    case "day_submitted":
      return m.batchId ? `/batches/${m.batchId}` : "/batches";

    case "announcement":
      return "/app-notifications";

    // WhatsApp OTP wallet is empty on the @zacx BSP. No dedicated
    // billing page in the admin panel — surface the full notification
    // detail so ops can read the description and act (top up on
    // zacx.com). Sits alongside `announcement` in behaviour.
    case "whatsapp_low_balance":
      return "/app-notifications";

    default:
      return "/dashboard";
  }
}

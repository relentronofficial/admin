export function resolveNotificationRoute(notification: {
  type: string;
  metadata?: Record<string, unknown> | null;
}): string {
  const m = (notification.metadata ?? {}) as Record<string, unknown>;
  switch (notification.type) {
    case "member_pending":
    case "member_joined":
      return m.memberId ? `/members/${m.memberId}` : "/members";
    case "workshop_access_request":
      return m.workshopId ? `/workshops/${m.workshopId}` : "/workshops";
    case "course_access_request":
      return m.courseId ? `/courses?highlight=${m.courseId}` : "/courses";
    case "product_inquiry":
      return "/products";
    case "day_submitted":
      return m.batchId ? `/batches/${m.batchId}` : "/batches";
    case "announcement":
      return "/app-notifications";
    default:
      return "/dashboard";
  }
}

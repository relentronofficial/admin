"use client";

import NotificationBell from "@/components/psychometric/NotificationBell";

// The signed-in admin (and sign-out) is shown by TBT Admin's own top bar; the
// standalone app's Psychometric account avatar and logout are gone because
// there is no separate Psychometric session.
export default function PageHeader({
  title,
  breadcrumb,
  actions,
}: {
  title: string;
  breadcrumb?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {breadcrumb && <p className="breadcrumb">{breadcrumb}</p>}
        <h1>{title}</h1>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {actions}
        <NotificationBell />
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MessageSquare, Menu } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { cn } from "@/lib/utils/cn";

export function Navbar() {
  const pathname = usePathname();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { nav, rightIcons } = useSiteConfig();

  const activeNav = nav.find(
    (n) => pathname === n.href || pathname.startsWith(`${n.href}/`)
  );
  const pageTitle = activeNav?.label ?? "";

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 flex items-center px-4 gap-4">
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-2 rounded-lg hover:bg-accent transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <h1 className="font-semibold text-base flex-1 truncate">{pageTitle}</h1>

      <div className="flex items-center gap-2">
        {rightIcons.notifications && (
          <Link
            href="/notifications"
            className={cn(
              "p-2 rounded-lg hover:bg-accent transition-colors relative",
              pathname === "/notifications" && "bg-accent"
            )}
            aria-label="Notifications"
          >
            <Bell size={18} />
          </Link>
        )}

        {rightIcons.messages && (
          <Link
            href="/messages"
            className={cn(
              "p-2 rounded-lg hover:bg-accent transition-colors relative",
              pathname === "/messages" && "bg-accent"
            )}
            aria-label="Messages"
          >
            <MessageSquare size={18} />
          </Link>
        )}

        {rightIcons.profile && (
          <UserButton
            appearance={{
              elements: { avatarBox: "w-8 h-8" },
            }}
          />
        )}
      </div>
    </header>
  );
}

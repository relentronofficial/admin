"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useUIStore } from "@/lib/stores/useUIStore";
import { cn } from "@/lib/utils/cn";

export function Navbar() {
  const pathname = usePathname();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const getTitle = () => {
    if (pathname.startsWith("/dashboard")) return "Dashboard";
    if (pathname.startsWith("/learning")) return "My Learning";
    if (pathname.startsWith("/programs")) return "Programs";
    if (pathname.startsWith("/events")) return "Events";
    if (pathname.startsWith("/live")) return "Live Session";
    if (pathname.startsWith("/search")) return "Search";
    if (pathname.startsWith("/profile")) return "My Profile";
    if (pathname.startsWith("/notifications")) return "Notifications";
    return "Tamil Business Tribe";
  };

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 flex items-center px-4 gap-4">
      <button
        onClick={toggleSidebar}
        className="lg:hidden p-2 rounded-lg hover:bg-accent transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      <h1 className="font-semibold text-base flex-1 truncate">{getTitle()}</h1>

      <div className="flex items-center gap-2">
        <Link
          href="/search"
          className={cn(
            "p-2 rounded-lg hover:bg-accent transition-colors",
            pathname === "/search" && "bg-accent"
          )}
          aria-label="Search"
        >
          <Search size={18} />
        </Link>

        <Link
          href="/notifications"
          className={cn(
            "p-2 rounded-lg hover:bg-accent transition-colors relative",
            pathname === "/notifications" && "bg-accent"
          )}
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-600" />
        </Link>

        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            },
          }}
        />
      </div>
    </header>
  );
}

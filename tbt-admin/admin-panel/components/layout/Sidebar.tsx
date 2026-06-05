"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCog,
  BookOpen,
  MessageSquare,
  Layers,
  Clapperboard,
  ShoppingBag,
  FileText,
  Bell,
  Trophy,
  Award,
  Tv2,
  Settings,
  Navigation,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMe } from "@/lib/hooks/useAdmin";

const navGroups: { label: string | null; items: { name: string; href: string; icon: any }[] }[] = [
  {
    label: null,
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Admins", href: "/admins", icon: UserCog },
      { name: "Members", href: "/members", icon: Users },
    ],
  },
  {
    label: "Content",
    items: [
      { name: "Hero Carousel", href: "/hero-carousel", icon: Tv2 },
      { name: "Content Sections", href: "/content-sections", icon: Layers },
      { name: "Courses", href: "/courses", icon: BookOpen },
      { name: "Workshops", href: "/workshops", icon: Clapperboard },
      { name: "Resources", href: "/app-resources", icon: FileText },
      { name: "Products", href: "/products", icon: ShoppingBag },
    ],
  },
  {
    label: "Communication",
    items: [
      { name: "Notifications", href: "/app-notifications", icon: Bell },
      { name: "Messages",      href: "/messages",          icon: MessageSquare },
    ],
  },
  {
    label: "Settings",
    items: [
      { name: "Site Config", href: "/settings/site", icon: Settings },
      { name: "Navigation", href: "/settings/navigation", icon: Navigation },
      { name: "UI Strings", href: "/settings/ui-strings", icon: Type },
      { name: "Tiers", href: "/tiers", icon: Trophy },
      { name: "Badges", href: "/display-badges", icon: Award },
    ],
  },
  {
    label: "Support",
    items: [
      { name: "Support", href: "/support", icon: MessageSquare },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: me } = useMe();
  const displayName = me?.fullName || "Admin";
  const initial = displayName.charAt(0).toUpperCase();
  const roleLabel = me?.role
    ? me.role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : "Admin";

  return (
    <aside className="w-[220px] bg-[#111] border-r border-[#2a2a2a] flex flex-col fixed inset-y-0 left-0 z-[100] font-sans">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#2a2a2a]">
        <div
          className="w-9 h-9 bg-[#e02020] flex items-center justify-center font-rajdhani font-bold text-[15px] text-white tracking-tighter"
          style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
        >
          TT
        </div>
        <div className="font-rajdhani text-[13px] font-semibold leading-[1.3] text-[#a0a0a0] tracking-wider">
          <span className="block text-[#f0f0f0] text-[15px]">Tamil Business</span>
          Tribe
        </div>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.label && (
              <p className="px-5 py-1.5 text-[9px] font-bold uppercase tracking-[2px] text-[#444]">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname?.startsWith(item.href) ?? false;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-5 py-2 text-[13px] font-normal transition-all border-l-2",
                    isActive
                      ? "text-[#e02020] border-[#e02020] bg-[rgba(224,32,32,0.08)]"
                      : "text-[#a0a0a0] border-transparent hover:bg-[#1f1f1f] hover:text-[#f0f0f0]"
                  )}
                >
                  <Icon
                    size={15}
                    className={cn("opacity-70", isActive && "opacity-100")}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className="tracking-wide">{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3.5 border-t border-[#2a2a2a] flex items-center gap-2.5 bg-[#111]">
        <div className="w-8 h-8 rounded-full bg-[#1f1f1f] border border-[#333] flex items-center justify-center text-xs font-bold text-[#e02020] uppercase shadow-sm flex-shrink-0">
          {initial}
        </div>
        <div className="leading-tight min-w-0">
          <div className="text-[13px] font-medium text-[#f0f0f0] truncate">{displayName}</div>
          <div className="text-[11px] text-[#606060] mt-0.5 uppercase tracking-tighter truncate">{roleLabel}</div>
        </div>
      </div>
    </aside>
  );
}

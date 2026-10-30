"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  ShieldAlert,
  BarChart2,
  BarChart3,
  Target,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  CheckSquare,
  Bot,
  Headphones,
  Sun,
  Megaphone,
  MessageSquareText,
  UserCheck,
  HelpCircle,
  Shield,
  ShoppingCart,
  Coins,
  CreditCard,
  Terminal,
  PhoneCall,
  Brain,
  LayoutGrid,
  KeyRound,
  FolderKanban,
  ListChecks,
  RefreshCcw,
  Grid3x3,
  Volume2,
  SlidersHorizontal,
  ChevronDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMe } from "@/lib/hooks/useAdmin";

type NavItem = { name: string; href: string; icon: any };
// `collapsible` groups render as a dropdown: the label toggles the items open
// and closed. Groups without it keep the plain label + always-visible items.
// `basePath` marks pages that belong to the group without a menu item of their
// own (e.g. the /psychometric index), so the group still opens and highlights there.
type NavGroup = { label: string | null; collapsible?: boolean; basePath?: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Admins", href: "/admins", icon: UserCog },
      { name: "Members", href: "/members", icon: Users },
      { name: "Onboarding", href: "/onboarding", icon: UserCheck },
      { name: "Batches", href: "/batches", icon: GraduationCap },
      { name: "Weekly Graph", href: "/weekly-graph", icon: BarChart3 },
      { name: "Tasks", href: "/tasks", icon: CheckSquare },
    ],
  },
  {
    label: "Content",
    collapsible: true,
    items: [
      { name: "Hero Carousel", href: "/hero-carousel", icon: Tv2 },
      { name: "Content Sections", href: "/content-sections", icon: Layers },
      { name: "Courses", href: "/courses", icon: BookOpen },
      { name: "Modules FAQ", href: "/module-faqs", icon: HelpCircle },
      { name: "Payments", href: "/payments", icon: CreditCard },
      { name: "Workshops", href: "/workshops", icon: Clapperboard },
      { name: "Podcasts", href: "/podcasts", icon: Headphones },
      { name: "E-Books", href: "/ebooks", icon: BookOpen },
      { name: "Resources", href: "/app-resources", icon: FileText },
      { name: "Products", href: "/products", icon: ShoppingBag },
    ],
  },
  {
    label: "Communication",
    collapsible: true,
    items: [
      { name: "Community",     href: "/community",         icon: Users },
      { name: "Notifications", href: "/app-notifications", icon: Bell },
      { name: "Batch Reports", href: "/batch-reports",     icon: MessageSquareText },
      { name: "Messages",      href: "/messages",          icon: MessageSquare },
      { name: "Group Chats",   href: "/groups",            icon: Users },
      { name: "Ad Campaigns",  href: "/ads",               icon: Megaphone },
      { name: "AI Content",    href: "/ai-content",        icon: Bot },
    ],
  },
  {
    // Psychometric Admin (ported from the standalone Psychometric platform —
    // its own API and admin sign-in), plus TBT's built-in onboarding quiz.
    label: "Psychometric",
    collapsible: true,
    basePath: "/psychometric",
    items: [
      { name: "Dashboard", href: "/psychometric/dashboard", icon: LayoutGrid },
      { name: "Users", href: "/psychometric/users", icon: Users },
      { name: "Access Codes", href: "/psychometric/shared-ids", icon: KeyRound },
      { name: "Question Types", href: "/psychometric/question-types", icon: FolderKanban },
      { name: "Questions", href: "/psychometric/questions", icon: HelpCircle },
      { name: "Question Sets", href: "/psychometric/question-sets", icon: Layers },
      { name: "Answer Options", href: "/psychometric/answer-options", icon: ListChecks },
      { name: "Results", href: "/psychometric/results", icon: BarChart3 },
      { name: "Retest Requests", href: "/psychometric/retest-requests", icon: RefreshCcw },
      { name: "Reports", href: "/psychometric/reports", icon: FileText },
      { name: "Settings", href: "/psychometric/settings", icon: SlidersHorizontal },
      { name: "Business Matrix", href: "/psychometric/business-matrix", icon: Grid3x3 },
      { name: "Voice / Audio", href: "/psychometric/voice", icon: Volume2 },
      { name: "Onboarding Quiz", href: "/onboarding-quiz", icon: Brain },
    ],
  },
  {
    label: "Settings",
    collapsible: true,
    items: [
      { name: "Site Config", href: "/settings/site", icon: Settings },
      { name: "Navigation", href: "/settings/navigation", icon: Navigation },
      { name: "UI Strings", href: "/settings/ui-strings", icon: Type },
      { name: "Plan Entitlements", href: "/settings/entitlements", icon: Shield },
      { name: "Tiers", href: "/tiers", icon: Trophy },
      { name: "Badges", href: "/display-badges", icon: Award },
      { name: "TBT Gamification", href: "/gamification", icon: Award },
      { name: "Morning Ritual", href: "/rituals", icon: Sun },
    ],
  },
  {
    label: "Billing",
    collapsible: true,
    items: [
      { name: "Credits", href: "/credits", icon: ShoppingCart },
      { name: "Grant Coins", href: "/grant-coins", icon: Coins },
    ],
  },
  {
    label: "Support",
    collapsible: true,
    items: [
      { name: "Support", href: "/support", icon: MessageSquare },
      { name: "Support Calls", href: "/support-calls", icon: PhoneCall },
    ],
  },
  {
    label: "Analytics",
    collapsible: true,
    items: [
      { name: "Analytics", href: "/analytics", icon: BarChart2 },
      { name: "Challenges", href: "/analytics/challenges", icon: Target },
      { name: "Assignments", href: "/assignments", icon: ClipboardCheck },
      { name: "Weekly Course Reports", href: "/course-weekly-reports", icon: ClipboardList },
    ],
  },
  {
    label: "Security",
    items: [
      { name: "Security Logs", href: "/security-logs", icon: ShieldAlert },
    ],
  },
  {
    label: "System",
    items: [
      { name: "Dev Control", href: "/devops", icon: Terminal },
    ],
  },
];

const isItemActive = (pathname: string | null, href: string) =>
  !!pathname && (pathname === href || pathname.startsWith(`${href}/`));

// The highlighted item of a group: its most specific match, so a parent route
// (/analytics) isn't lit alongside its child (/analytics/challenges).
const activeHrefIn = (pathname: string | null, group: NavGroup) =>
  group.items.filter((i) => isItemActive(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

const isGroupActive = (pathname: string | null, group: NavGroup) =>
  (!!group.basePath && isItemActive(pathname, group.basePath)) ||
  group.items.some((i) => isItemActive(pathname, i.href));

// Open dropdowns are remembered per browser. Every page renders its own
// DashboardLayout, so the sidebar remounts on navigation and would otherwise
// forget which groups the admin had opened.
const OPEN_GROUPS_KEY = "tbt_admin_sidebar_open_groups";

function readSavedOpenGroups(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveOpenGroups(groups: string[]) {
  try {
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(groups));
  } catch {
    /* storage unavailable (private mode etc.) — dropdowns just won't be remembered */
  }
}

interface SidebarProps {
  /** Mobile only: whether the off-canvas sidebar is open. Ignored from md up. */
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const activeGroup = navGroups.find((g) => g.collapsible && isGroupActive(pathname, g))?.label ?? null;
  // Server render and first client render use only the active group, so they
  // match; saved groups are merged in after mount.
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroup ? [activeGroup] : []);

  useEffect(() => {
    setOpenGroups((prev) => Array.from(new Set([...prev, ...readSavedOpenGroups()])));
  }, []);

  // Navigating to a child page always opens its parent group.
  useEffect(() => {
    if (activeGroup) setOpenGroups((prev) => (prev.includes(activeGroup) ? prev : [...prev, activeGroup]));
  }, [activeGroup]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label];
      saveOpenGroups(next);
      return next;
    });
  };

  const { data: me } = useMe();
  const displayName = me?.fullName || "Admin";
  const initial = displayName.charAt(0).toUpperCase();
  const roleLabel = me?.role
    ? me.role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : "Admin";

  return (
    <>
      {/* Mobile backdrop — tapping it closes the sidebar. */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-[99] md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={cn(
          "w-[220px] bg-[#111] border-r border-[#2a2a2a] flex flex-col fixed inset-y-0 left-0 z-[100] font-sans",
          "transition-transform duration-200 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="relative flex items-center justify-center px-5 py-4 border-b border-[#2a2a2a]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tbt_logo.png" alt="Tamil Business Tribe" className="h-9 w-auto object-contain" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="md:hidden absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#a0a0a0] hover:text-[#f0f0f0]"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navGroups.map((group, gi) => {
            const isOpen = !group.collapsible || (!!group.label && openGroups.includes(group.label));
            const panelId = `sidebar-group-${gi}`;
            return (
              <div key={gi} className="mb-1">
                {group.label && !group.collapsible && (
                  <p className="px-5 py-1.5 text-[9px] font-bold uppercase tracking-[2px] text-[#777]">
                    {group.label}
                  </p>
                )}
                {group.label && group.collapsible && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label!)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className={cn(
                      "w-full flex items-center justify-between px-5 py-2 md:py-1.5 text-[9px] font-bold uppercase tracking-[2px] transition-colors",
                      isGroupActive(pathname, group) ? "text-[#e02020]" : "text-[#777] hover:text-[#a0a0a0]"
                    )}
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      size={12}
                      strokeWidth={2.5}
                      className={cn("transition-transform duration-200", !isOpen && "-rotate-90")}
                    />
                  </button>
                )}
                <div id={panelId} hidden={!isOpen}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href === activeHrefIn(pathname, group);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={onClose}
                        aria-current={isActive ? "page" : undefined}
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
              </div>
            );
          })}
        </nav>

        <div className="p-3.5 border-t border-[#2a2a2a] flex items-center gap-2.5 bg-[#111]">
          <div className="w-8 h-8 rounded-full bg-[#1f1f1f] border border-[#333] flex items-center justify-center text-xs font-bold text-[#e02020] uppercase shadow-sm flex-shrink-0">
            {initial}
          </div>
          <div className="leading-tight min-w-0">
            <div className="text-[13px] font-medium text-[#f0f0f0] truncate">{displayName}</div>
            <div className="text-[11px] text-[#888] mt-0.5 uppercase tracking-tighter truncate">{roleLabel}</div>
          </div>
        </div>
      </aside>
    </>
  );
}

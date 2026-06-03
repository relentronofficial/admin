"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { cn } from "@/lib/utils/cn";

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { config, nav } = useSiteConfig();

  const siteName = config?.siteName ?? "TBT";
  const logoUrl = config?.logoUrl ?? null;
  const footerText = config?.footerText ?? "";

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full z-50 w-64 border-r border-border flex flex-col transition-transform duration-300",
          "lg:relative lg:translate-x-0 lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "var(--color-bg-surface)" }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link href={nav[0]?.href ?? "/tbt"} className="flex items-center gap-2.5">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={siteName}
                width={32}
                height={32}
                className="rounded-lg object-contain"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
                style={{ background: "var(--color-accent)" }}
              >
                {siteName[0]}
              </div>
            )}
            <span className="font-bold text-sm tracking-tight text-foreground leading-tight">
              {siteName}
            </span>
          </Link>
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-accent"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {nav.map(({ id, href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={id}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                style={active ? { background: "var(--color-accent)" } : {}}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer text */}
        {footerText && (
          <div className="p-4 border-t border-border">
            <p className="text-[11px] text-muted-foreground text-center">{footerText}</p>
          </div>
        )}
      </aside>
    </>
  );
}

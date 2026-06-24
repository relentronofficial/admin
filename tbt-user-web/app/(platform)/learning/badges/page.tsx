"use client";

import Link from "next/link";
import { Award, ChevronLeft, BookOpen } from "lucide-react";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { useUserBadges } from "@/lib/hooks/useCourses";

export default function BadgesPage() {
  const { data: badges, isLoading } = useUserBadges();

  if (isLoading) return <PageLoader />;

  const list: any[] = badges ?? [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/learning" className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-100" style={{ color: "rgba(255,255,255,0.45)" }}>
          <ChevronLeft size={16} /> Learning
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white">My Badges</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
          {list.length > 0 ? `${list.length} badge${list.length !== 1 ? "s" : ""} earned` : "Complete courses to earn badges"}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-surface))" }}>
            <Award size={36} style={{ color: "var(--color-accent)", opacity: 0.5 }} />
          </div>
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
            No badges yet — keep learning!
          </p>
          <Link href="/programs"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--color-accent)" }}>
            <BookOpen size={14} /> Browse Courses
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {list.map((item: any) => {
            const badge = item.badge ?? item;
            return (
              <div key={item.id}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border text-center transition-all hover:scale-105"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-surface))",
                  borderColor: "color-mix(in srgb, var(--color-accent) 20%, transparent)",
                }}>
                {badge.iconUrl ? (
                  <img src={badge.iconUrl} alt={badge.label} className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: "color-mix(in srgb, var(--color-accent) 20%, transparent)" }}>
                    <Award size={32} style={{ color: "var(--color-accent)" }} />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-white leading-snug">{badge.label}</p>
                  {item.earnedAt && (
                    <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {new Date(item.earnedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

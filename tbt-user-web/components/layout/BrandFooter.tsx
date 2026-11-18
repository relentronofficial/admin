"use client";

import { useSiteConfig } from "@/lib/context/SiteConfigContext";

/** TBT logo with the footer tagline below it (one sentence per line). Used by /mentorship and /courses. */
export function BrandFooter() {
  const { uiStrings } = useSiteConfig();
  return (
    <div style={{ paddingTop: 32, paddingBottom: 32, borderTop: "1px solid #2a2a2e" }}>
      <div className="flex flex-col items-center text-center px-4">
        <div className="flex items-center justify-center gap-2" style={{ fontSize: 18, fontWeight: 700, color: "#f5f5f7", marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tbt_logo.webp" alt="" width={120} height={28} className="h-6 sm:h-7 w-auto shrink-0 object-contain" />
        </div>
        <div style={{ fontSize: 12, color: "#92929b", lineHeight: 1.6 }}>
          {((uiStrings as any)?.footerTagline ?? "India's premier business mentorship community. Grow your business with expert guidance.")
            .split(/(?<=\.)\s+/)
            .map((sentence: string, i: number) => <div key={i}>{sentence}</div>)}
        </div>
      </div>
    </div>
  );
}

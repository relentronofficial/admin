"use client";

import Image from "next/image";

interface SplashScreenProps {
  logoUrl?: string | null;
  siteName?: string | null;
}

export function SplashScreen({ logoUrl, siteName }: SplashScreenProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: "var(--color-bg-primary, #000)" }}
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={siteName ?? ""}
          width={160}
          height={160}
          className="object-contain animate-pulse"
          priority
        />
      ) : (
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-black animate-pulse"
          style={{ background: "var(--color-accent, #00c4cc)" }}
        >
          {siteName ? siteName[0].toUpperCase() : "E"}
        </div>
      )}
    </div>
  );
}

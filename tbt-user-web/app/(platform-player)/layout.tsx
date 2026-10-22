import { Suspense } from "react";
import { SubscriptionGate } from "@/app/(platform)/SubscriptionGate";
import { AudioController } from "@/components/features/podcasts/AudioController";
import { MiniPlayer } from "@/components/features/podcasts/MiniPlayer";
import { AdHost } from "@/components/features/ads/AdHost";
import { SessionRevocationGuard } from "@/components/guards/SessionRevocationGuard";
import { NavAccessGuard } from "@/components/guards/NavAccessGuard";
import { ActivityHeartbeat } from "@/components/guards/ActivityHeartbeat";

export default function PlatformPlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <SessionRevocationGuard />
      <ActivityHeartbeat />
      <main className="flex-1">
        <SubscriptionGate>
          <NavAccessGuard>
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </NavAccessGuard>
        </SubscriptionGate>
      </main>
      <AudioController />
      <MiniPlayer />
      <AdHost />
    </div>
  );
}

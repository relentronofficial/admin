import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SubscriptionGate } from "./SubscriptionGate";
import { AudioController } from "@/components/features/podcasts/AudioController";
import { MiniPlayer } from "@/components/features/podcasts/MiniPlayer";
import { AdHost } from "@/components/features/ads/AdHost";
import { SessionRevocationGuard } from "@/components/guards/SessionRevocationGuard";
import { NavAccessGuard } from "@/components/guards/NavAccessGuard";
import { ActivityHeartbeat } from "@/components/guards/ActivityHeartbeat";
import { OnboardingTour } from "@/components/features/onboarding-tour/OnboardingTour";
import { WeeklyReportReminder } from "@/components/features/reports/WeeklyReportReminder";
import { HelpBotWidget } from "@/components/features/help-bot/HelpBotWidget";
import { Suspense } from "react";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <SessionRevocationGuard />
      <ActivityHeartbeat />
      <Navbar />
      <main className="flex-1 pt-20">
        <SubscriptionGate>
          <NavAccessGuard>
            <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 pb-24 lg:pb-6">
              {children}
            </div>
          </NavAccessGuard>
        </SubscriptionGate>
        <Footer />
      </main>
      <AudioController />
      <MiniPlayer />
      {/* Portals to document.body, so it sits above Navbar and MiniPlayer
          regardless of this container's stacking context. */}
      <AdHost />
      {/* First-login guided tour (reads ?tour=1, so it needs a Suspense boundary). */}
      <Suspense fallback={null}>
        <OnboardingTour />
      </Suspense>
      {/* Mandatory weekly report: Fri/Sat popup + Saturday 6 PM video lock nudge. */}
      <Suspense fallback={null}>
        <WeeklyReportReminder />
      </Suspense>
      {/* TBT Assistant — floating AI help chat (hidden when the backend has no AI key). */}
      <HelpBotWidget />
    </div>
  );
}

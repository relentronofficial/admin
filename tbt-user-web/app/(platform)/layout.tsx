import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SubscriptionGate } from "./SubscriptionGate";
import { AudioController } from "@/components/features/podcasts/AudioController";
import { MiniPlayer } from "@/components/features/podcasts/MiniPlayer";
import { AdHost } from "@/components/features/ads/AdHost";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 pt-20">
        <SubscriptionGate>
          <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6">
            {children}
          </div>
        </SubscriptionGate>
        <Footer />
      </main>
      <AudioController />
      <MiniPlayer />
      {/* Portals to document.body, so it sits above Navbar and MiniPlayer
          regardless of this container's stacking context. */}
      <AdHost />
    </div>
  );
}

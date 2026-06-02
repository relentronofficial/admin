"use client";

import { use } from "react";
import { Video, Users } from "lucide-react";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { useWebinar } from "@/lib/hooks/useEvents";
import { formatDateTime } from "@/lib/utils/format";

export default function LiveSessionPage({ params }: { params: Promise<{ webinarId: string }> }) {
  const { webinarId } = use(params);
  const { data: webinar, isLoading } = useWebinar(webinarId);

  if (isLoading) return <PageLoader />;
  if (!webinar) return <p className="text-center py-16 text-muted-foreground">Session not found.</p>;

  const isLive = webinar.status === "live";
  const hasRecording = !!webinar.recordingUrl;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-rose-600 bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" /> Live
            </span>
          )}
          <span className="text-xs text-muted-foreground">{formatDateTime(webinar.scheduledAt)}</span>
        </div>
        <h1 className="text-2xl font-bold">{webinar.title}</h1>
        {webinar.host && (
          <p className="text-sm text-muted-foreground mt-1">Hosted by {webinar.host.fullName}</p>
        )}
      </div>

      {/* Stream / Recording */}
      <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video flex items-center justify-center">
        {isLive && webinar.streamUrl ? (
          <video src={webinar.streamUrl} autoPlay controls className="w-full h-full object-contain" />
        ) : hasRecording ? (
          <video src={webinar.recordingUrl!} controls className="w-full h-full object-contain" />
        ) : (
          <div className="text-center text-white/50 space-y-3">
            <Video size={48} className="mx-auto opacity-40" />
            <p className="text-sm">
              {webinar.status === "scheduled"
                ? `Stream starts at ${formatDateTime(webinar.scheduledAt)}`
                : "Recording not available yet"}
            </p>
          </div>
        )}
      </div>

      {webinar.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{webinar.description}</p>
      )}
    </div>
  );
}

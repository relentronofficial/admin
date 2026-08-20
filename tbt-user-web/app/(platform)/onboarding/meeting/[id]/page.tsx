"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Video, Calendar, ArrowLeft, Users } from "lucide-react";
import { useMyOnboardingMeetings, useJoinOnboardingMeeting } from "@/lib/hooks/useOnboardingMeetings";
import { OnboardingLiveMeeting } from "@/components/features/live/OnboardingLiveMeeting";

// Pre-join screen: meeting details + a Join button. No LiveKit connection is
// made until the member explicitly clicks Join *and* confirms their camera
// choices on the LiveKit PreJoin step inside OnboardingLiveMeeting.
export default function OnboardingMeetingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: meetings, isLoading } = useMyOnboardingMeetings();
  const join = useJoinOnboardingMeeting();
  const [creds, setCreds] = useState<{ token: string; wsUrl: string; title: string; startedAt: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meeting = meetings?.find((m) => m.id === params.id);

  const handleJoin = async () => {
    setError(null);
    try {
      const res = await join.mutateAsync(params.id);
      setCreds({ token: res.data.token, wsUrl: res.data.wsUrl, title: res.data.title, startedAt: res.data.startedAt });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Couldn't join this meeting. Please try again.");
    }
  };

  if (creds) {
    return (
      <OnboardingLiveMeeting
        meetingId={params.id}
        token={creds.token}
        wsUrl={creds.wsUrl}
        title={creds.title}
        startedAt={creds.startedAt}
        onLeave={() => router.push("/onboarding")}
      />
    );
  }

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!meeting) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-lg font-bold text-foreground mb-2">Meeting Not Found</h1>
        <p className="text-sm text-muted-foreground mb-6">This meeting doesn&apos;t exist or you don&apos;t have access to it.</p>
        <button onClick={() => router.push("/onboarding")} className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
          Back to onboarding
        </button>
      </div>
    );
  }

  const joinable = meeting.status === "scheduled" || meeting.status === "live";

  return (
    <div className="max-w-md mx-auto py-12 px-4 text-center">
      <button onClick={() => router.push("/onboarding")} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft size={13} /> Back
      </button>

      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)" }}>
        <Video size={26} style={{ color: "var(--color-accent)" }} />
      </div>
      <h1 className="text-lg font-bold text-foreground mb-1">{meeting.title}</h1>
      {meeting.hostAdmin && <p className="text-sm text-muted-foreground mb-1">Host: {meeting.hostAdmin.fullName}</p>}
      <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mb-1">
        <Calendar size={13} />
        {new Date(meeting.scheduledAt).toLocaleString()}
      </p>
      {typeof meeting._count?.participants === "number" && (
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mb-6">
          <Users size={13} />
          {meeting._count.participants} invited
        </p>
      )}

      {meeting.status === "completed" && <p className="text-sm text-muted-foreground mb-4">This meeting has already ended.</p>}
      {meeting.status === "cancelled" && (
        <p className="text-sm mb-4" style={{ color: "var(--color-alert)" }}>
          This meeting was cancelled{meeting.cancelReason ? `: ${meeting.cancelReason}` : "."}
        </p>
      )}
      {error && <p className="text-sm mb-4" style={{ color: "var(--color-alert)" }}>{error}</p>}

      {joinable && (
        <button
          onClick={handleJoin}
          disabled={join.isPending}
          className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--color-accent)" }}
        >
          {join.isPending ? "Connecting…" : meeting.status === "live" ? "Join Meeting" : "Join When Ready"}
        </button>
      )}
    </div>
  );
}

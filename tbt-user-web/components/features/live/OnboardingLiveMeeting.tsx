"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference, PreJoin, type LocalUserChoices } from "@livekit/components-react";
import "@livekit/components-styles";
import { DisconnectReason } from "livekit-client";
import { MessageSquare, Users, PhoneOff, X } from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import { ParticipantListPanel } from "./ParticipantListPanel";
import { useLeaveOnboardingMeeting } from "@/lib/hooks/useOnboardingMeetings";

/**
 * Member-facing Virtual Self Onboarding verification call. A new, lean
 * component rather than a reuse of WorkshopLiveCall.tsx — that component's
 * waiting-room polling, RSVP/polls/Q&A/breakout-room socket wiring, and
 * co-host-promotion logic are all workshop-specific and don't apply to a
 * 1:1(-few) onboarding call. It DOES reuse ChatPanel and
 * ParticipantListPanel as-is (both are self-contained LiveKit-hook
 * consumers with zero workshop coupling) and the same
 * PreJoin -> LiveKitRoom -> VideoConference connection pattern.
 */

interface Props {
  meetingId: string;
  token: string;
  wsUrl: string;
  title: string;
  /** Authoritative meeting start time from the backend — null before the meeting has actually started. */
  startedAt: string | null;
  onLeave: () => void;
}

// Ticks off the *real* elapsed meeting duration (backend startedAt), not
// "time since this client connected" — a late joiner must see the true
// elapsed time, and it must not reset on component rebuild.
function DurationTicker({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return <span className="text-xs font-mono text-[#606060]">Not started</span>;
  const secs = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return <span className="text-xs font-mono text-[#a0a0a0]">{mm}:{ss}</span>;
}

export function OnboardingLiveMeeting({ meetingId, token, wsUrl, title, startedAt, onLeave }: Props) {
  const [stage, setStage] = useState<"pre" | "live" | "ended">("pre");
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [panel, setPanel] = useState<"chat" | "participants" | null>(null);
  const leaveMeeting = useLeaveOnboardingMeeting();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleDisconnected = (reason?: DisconnectReason) => {
    void leaveMeeting.mutateAsync(meetingId).catch(() => {});
    if (reason === DisconnectReason.CLIENT_INITIATED) {
      onLeave();
    } else {
      setStage("ended");
    }
  };

  const handleLeaveClick = async () => {
    await leaveMeeting.mutateAsync(meetingId).catch(() => {});
    onLeave();
  };

  if (stage === "pre") {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="w-full max-w-md px-4">
          <PreJoin onSubmit={(c) => { setChoices(c); setStage("live"); }} data-lk-theme="default" />
        </div>
      </div>
    );
  }

  if (stage === "ended") {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-8 text-center max-w-sm mx-4">
          <h2 className="text-lg font-bold text-white mb-2">Meeting Ended</h2>
          <p className="text-xs text-[#888] mb-6">The verification call has ended.</p>
          <button onClick={onLeave} className="px-5 h-10 text-xs font-semibold rounded-xl text-white" style={{ background: "var(--color-accent, #dc2626)" }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      <LiveKitRoom
        serverUrl={wsUrl}
        token={token}
        connect
        audio={choices?.audioEnabled ?? true}
        video={choices?.videoEnabled ?? true}
        onDisconnected={handleDisconnected}
        data-lk-theme="default"
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#1e1e1e] bg-[#111] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-semibold text-white truncate">{title}</span>
            <DurationTicker startedAt={startedAt} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPanel(panel === "chat" ? null : "chat")} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#a0a0a0] hover:bg-[#1a1a1a]">
              <MessageSquare size={16} />
            </button>
            <button onClick={() => setPanel(panel === "participants" ? null : "participants")} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#a0a0a0] hover:bg-[#1a1a1a]">
              <Users size={16} />
            </button>
            <button onClick={handleLeaveClick} className="px-3 h-9 flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-[#7f1d1d] hover:bg-[#991b1b] text-white">
              <PhoneOff size={13} /> Leave
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0">
            <VideoConference />
          </div>
          {panel && (
            <div className="w-[300px] border-l border-[#2a2a2a] hidden sm:block">
              {panel === "chat" ? <ChatPanel onClose={() => setPanel(null)} /> : <ParticipantListPanel onClose={() => setPanel(null)} />}
            </div>
          )}
        </div>
      </LiveKitRoom>
      {panel && (
        <div className="sm:hidden fixed inset-0 z-[10000] bg-black/90 flex flex-col">
          <button onClick={() => setPanel(null)} className="self-end m-3 text-white"><X size={20} /></button>
          <div className="flex-1">{panel === "chat" ? <ChatPanel onClose={() => setPanel(null)} /> : <ParticipantListPanel onClose={() => setPanel(null)} />}</div>
        </div>
      )}
    </div>
  );
}

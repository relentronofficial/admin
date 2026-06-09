"use client";

import { useRef, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  PreJoin,
  useRemoteParticipants,
  type LocalUserChoices,
} from "@livekit/components-react";
import { DisconnectReason } from "livekit-client";
import { PhoneOff, Users, Clock } from "lucide-react";
import { getServerNow } from "@/lib/api/client";

interface WorkshopLiveCallProps {
  token: string;
  wsUrl: string;
  roomName: string;
  defaultName?: string;
  startedAt?: string | null;
  onLeave: () => void;
  onLeaveByChoice?: () => void;
}

function WaitingForHostOverlay() {
  const participants = useRemoteParticipants();
  const hasHost = participants.some(p => p.identity.startsWith("user_"));
  if (hasHost) return null;
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-30 pointer-events-none"
      style={{ background: "rgba(0,0,0,0.65)" }}
    >
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(220,38,38,0.15)" }}>
        <Users size={22} style={{ color: "#dc2626" }} />
      </div>
      <p className="text-white font-semibold text-sm">Waiting for the host to join…</p>
      <p className="text-xs" style={{ color: "#a0a0a0" }}>The session will begin when the host enters the room.</p>
    </div>
  );
}

function LateJoinBanner({ startedAt }: { startedAt: string }) {
  const startMs = new Date(startedAt).getTime();
  const minutesIn = Math.floor((getServerNow() - startMs) / 60000);
  if (minutesIn < 5) return null;
  return (
    <div
      className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold pointer-events-none"
      style={{ background: "rgba(0,0,0,0.75)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
    >
      <Clock size={12} />
      You joined {minutesIn} minute{minutesIn !== 1 ? "s" : ""} in
    </div>
  );
}

export function WorkshopLiveCall({
  token,
  wsUrl,
  defaultName = "",
  startedAt,
  onLeave,
  onLeaveByChoice,
}: WorkshopLiveCallProps) {
  const [stage, setStage] = useState<"pre" | "live" | "ended">("pre");
  const [userChoices, setUserChoices] = useState<LocalUserChoices>({
    username: defaultName,
    videoEnabled: true,
    audioEnabled: true,
    videoDeviceId: "",
    audioDeviceId: "",
  });
  const leftByChoiceRef = useRef(false);

  const handleLeave = () => {
    leftByChoiceRef.current = true;
    onLeaveByChoice?.();
    onLeave();
  };

  const handleDisconnected = (reason?: DisconnectReason) => {
    if (leftByChoiceRef.current || reason === DisconnectReason.CLIENT_INITIATED) {
      onLeave();
    } else {
      setStage("ended");
    }
  };

  if (stage === "pre") {
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "#111", minHeight: 420 }}
        data-lk-theme="default"
      >
        <PreJoin
          defaults={userChoices}
          onSubmit={(choices) => {
            // Lock username to the member's actual name — ignore whatever they typed
            setUserChoices({ ...choices, username: defaultName || choices.username });
            setStage("live");
          }}
          style={{ height: 420, width: "100%" }}
        />
      </div>
    );
  }

  if (stage === "ended") {
    return (
      <div
        className="rounded-xl flex flex-col items-center justify-center gap-4 text-center"
        style={{ height: 420, background: "#111" }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "rgba(220,38,38,0.15)" }}
        >
          <PhoneOff size={26} style={{ color: "#dc2626" }} />
        </div>
        <p className="text-white font-semibold text-lg">Meeting ended by the host</p>
        <p className="text-sm" style={{ color: "#a0a0a0" }}>
          The host has ended this session for everyone.
        </p>
        <button
          onClick={onLeave}
          className="mt-2 px-5 py-2 rounded-lg text-sm font-bold"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{ height: 560, background: "#000" }}
      data-lk-theme="default"
    >
      <LiveKitRoom
        serverUrl={wsUrl}
        token={token}
        connect={true}
        audio={userChoices.audioEnabled}
        video={userChoices.videoEnabled}
        onDisconnected={handleDisconnected}
        style={{ height: "100%", width: "100%" }}
      >
        <VideoConference />
        <WaitingForHostOverlay />
        {startedAt && <LateJoinBanner startedAt={startedAt} />}
        <button
          onClick={handleLeave}
          className="absolute top-3 right-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          style={{ background: "var(--color-accent)", color: "#fff" }}
          aria-label="Leave call"
        >
          <PhoneOff size={13} />
          Leave
        </button>
      </LiveKitRoom>
    </div>
  );
}

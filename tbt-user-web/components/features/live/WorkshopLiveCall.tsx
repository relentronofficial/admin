"use client";

import { useRef, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  PreJoin,
  type LocalUserChoices,
} from "@livekit/components-react";
import { DisconnectReason } from "livekit-client";
import { PhoneOff } from "lucide-react";

interface WorkshopLiveCallProps {
  token: string;
  wsUrl: string;
  roomName: string;
  defaultName?: string;
  onLeave: () => void;
}

export function WorkshopLiveCall({
  token,
  wsUrl,
  defaultName = "",
  onLeave,
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
            setUserChoices(choices);
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
          style={{ background: "#dc2626", color: "#fff" }}
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
      </LiveKitRoom>

      <button
        onClick={handleLeave}
        className="absolute top-3 right-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
        style={{ background: "#dc2626", color: "#fff" }}
        aria-label="Leave call"
      >
        <PhoneOff size={13} />
        Leave
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  PreJoin,
  type LocalUserChoices,
} from "@livekit/components-react";
import { PhoneOff } from "lucide-react";

interface AdminLiveCallProps {
  token: string;
  wsUrl: string;
  roomName: string;
  onLeave: () => void;
}

export function AdminLiveCall({ token, wsUrl, onLeave }: AdminLiveCallProps) {
  const [stage, setStage] = useState<"pre" | "live">("pre");
  const [userChoices, setUserChoices] = useState<LocalUserChoices>({
    username: "Host",
    videoEnabled: true,
    audioEnabled: true,
    videoDeviceId: "",
    audioDeviceId: "",
  });

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

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{ height: 600, background: "#000" }}
      data-lk-theme="default"
    >
      <LiveKitRoom
        serverUrl={wsUrl}
        token={token}
        connect={true}
        audio={userChoices.audioEnabled}
        video={userChoices.videoEnabled}
        onDisconnected={onLeave}
        style={{ height: "100%", width: "100%" }}
      >
        <VideoConference />
      </LiveKitRoom>

      <button
        onClick={onLeave}
        className="absolute top-3 right-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
        style={{ background: "#dc2626", color: "#fff" }}
      >
        <PhoneOff size={13} /> Leave
      </button>
    </div>
  );
}

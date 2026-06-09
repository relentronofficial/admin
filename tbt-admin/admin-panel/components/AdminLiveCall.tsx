"use client";

import { useRef, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  PreJoin,
  type LocalUserChoices,
} from "@livekit/components-react";
import { DisconnectReason } from "livekit-client";
import { PhoneOff, Users } from "lucide-react";
import { useEndLiveCall } from "@/lib/hooks/useTbt";

interface AdminLiveCallProps {
  token: string;
  wsUrl: string;
  roomName: string;
  liveCallId: string;
  onLeave: () => void;
}

export function AdminLiveCall({ token, wsUrl, liveCallId, onLeave }: AdminLiveCallProps) {
  const [stage, setStage] = useState<"pre" | "live">("pre");
  const [userChoices, setUserChoices] = useState<LocalUserChoices>({
    username: "Host",
    videoEnabled: true,
    audioEnabled: true,
    videoDeviceId: "",
    audioDeviceId: "",
  });
  const leftByChoiceRef = useRef(false);
  const endCall = useEndLiveCall();

  const handleLeave = () => {
    leftByChoiceRef.current = true;
    onLeave();
  };

  const handleEndForAll = async () => {
    if (!confirm("End this meeting for all participants?")) return;
    try {
      await endCall.mutateAsync(liveCallId);
    } catch {
      // Room may already be closed
    }
    leftByChoiceRef.current = true;
    onLeave();
  };

  const handleDisconnected = (reason?: DisconnectReason) => {
    if (leftByChoiceRef.current || reason === DisconnectReason.CLIENT_INITIATED) {
      onLeave();
    } else {
      // Host shouldn't see an "ended by host" screen — just leave
      onLeave();
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
        onDisconnected={handleDisconnected}
        style={{ height: "100%", width: "100%" }}
      >
        <VideoConference />
      </LiveKitRoom>

      <div className="absolute top-3 right-3 z-50 flex items-center gap-2">
        <button
          onClick={handleEndForAll}
          disabled={endCall.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          style={{ background: "#7f1d1d", color: "#fff" }}
        >
          <Users size={13} />
          {endCall.isPending ? "Ending…" : "End for All"}
        </button>
        <button
          onClick={handleLeave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          style={{ background: "#dc2626", color: "#fff" }}
        >
          <PhoneOff size={13} /> Leave
        </button>
      </div>
    </div>
  );
}

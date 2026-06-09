"use client";

import { useRef, useState, useEffect } from "react";
import {
  LiveKitRoom,
  VideoConference,
  PreJoin,
  useRemoteParticipants,
  type LocalUserChoices,
} from "@livekit/components-react";
import { DisconnectReason } from "livekit-client";
import { PhoneOff, Users, Clock, CheckCircle2 } from "lucide-react";
import { useEndLiveCall } from "@/lib/hooks/useTbt";

interface AdminLiveCallProps {
  token: string;
  wsUrl: string;
  roomName: string;
  liveCallId: string;
  hostName?: string;
  onLeave: () => void;
}

function DurationTicker({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const fmt = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="font-mono text-xs font-bold" style={{ color: "#a0a0a0" }}>
      <Clock size={11} className="inline mr-1" />
      {h > 0 ? `${fmt(h)}:` : ""}{fmt(m)}:{fmt(s)}
    </span>
  );
}

function ParticipantCountBadge() {
  const participants = useRemoteParticipants();
  return (
    <span className="flex items-center gap-1 text-xs font-bold" style={{ color: "#a0a0a0" }}>
      <Users size={11} />
      {participants.length + 1}
    </span>
  );
}

interface ConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function ConfirmEndModal({ onConfirm, onCancel, isPending }: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="rounded-xl p-6 w-80 space-y-4 border"
        style={{ background: "#181818", borderColor: "#2a2a2a" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(220,38,38,0.15)" }}>
            <Users size={18} style={{ color: "#dc2626" }} />
          </div>
          <div>
            <p className="font-bold text-white text-sm">End for everyone?</p>
            <p className="text-xs mt-0.5" style={{ color: "#a0a0a0" }}>
              All participants will be removed from the call.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-sm font-bold border transition-colors"
            style={{ borderColor: "#333", color: "#a0a0a0", background: "transparent" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-60"
            style={{ background: "#7f1d1d", color: "#fff" }}
          >
            {isPending ? "Ending…" : "End for All"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminLiveCall({ token, wsUrl, liveCallId, hostName, onLeave }: AdminLiveCallProps) {
  const [stage, setStage] = useState<"pre" | "live" | "summary">("pre");
  const [userChoices, setUserChoices] = useState<LocalUserChoices>({
    username: hostName || "Host",
    videoEnabled: true,
    audioEnabled: true,
    videoDeviceId: "",
    audioDeviceId: "",
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [summaryData, setSummaryData] = useState<{ duration: number; endedAt: Date } | null>(null);
  const leftByChoiceRef = useRef(false);
  const entryTimeRef = useRef<number>(0);
  const endCall = useEndLiveCall();

  const handleLeave = () => {
    leftByChoiceRef.current = true;
    onLeave();
  };

  const handleEndForAll = async () => {
    try {
      await endCall.mutateAsync(liveCallId);
    } catch {
      // Room may already be closed
    }
    const duration = Math.floor((Date.now() - entryTimeRef.current) / 1000);
    leftByChoiceRef.current = true;
    setShowConfirm(false);
    setSummaryData({ duration, endedAt: new Date() });
    setStage("summary");
  };

  const handleDisconnected = (reason?: DisconnectReason) => {
    if (leftByChoiceRef.current || reason === DisconnectReason.CLIENT_INITIATED) {
      onLeave();
    } else {
      onLeave();
    }
  };

  if (stage === "summary" && summaryData) {
    const { duration, endedAt } = summaryData;
    const h = Math.floor(duration / 3600);
    const m = Math.floor((duration % 3600) / 60);
    const s = duration % 60;
    const fmt = (n: number) => String(n).padStart(2, "0");
    const durationStr = h > 0 ? `${fmt(h)}h ${fmt(m)}m ${fmt(s)}s` : `${fmt(m)}m ${fmt(s)}s`;
    return (
      <div
        className="rounded-xl flex flex-col items-center justify-center gap-4 text-center border"
        style={{ height: 280, background: "#111", borderColor: "#2a2a2a" }}
      >
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)" }}>
          <CheckCircle2 size={28} style={{ color: "#22c55e" }} />
        </div>
        <div>
          <p className="font-bold text-white text-lg">Session Ended</p>
          <p className="text-sm mt-1" style={{ color: "#a0a0a0" }}>
            Duration: <span className="font-bold text-white">{durationStr}</span>
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#606060" }}>
            Ended at {endedAt.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={onLeave}
          className="mt-2 px-6 py-2 rounded-lg text-sm font-bold"
          style={{ background: "#dc2626", color: "#fff" }}
        >
          Close
        </button>
      </div>
    );
  }

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
            const locked = { ...choices, username: hostName || choices.username };
            setUserChoices(locked);
            entryTimeRef.current = Date.now();
            setStage("live");
          }}
          style={{ height: 420, width: "100%" }}
        />
      </div>
    );
  }

  return (
    <>
      {showConfirm && (
        <ConfirmEndModal
          onConfirm={handleEndForAll}
          onCancel={() => setShowConfirm(false)}
          isPending={endCall.isPending}
        />
      )}
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
          <div className="absolute top-3 right-3 z-50 flex items-center gap-2">
            <DurationTicker startedAt={entryTimeRef.current} />
            <ParticipantCountBadge />
            <button
              onClick={() => setShowConfirm(true)}
              disabled={endCall.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              style={{ background: "#7f1d1d", color: "#fff" }}
            >
              <Users size={13} />
              End for All
            </button>
            <button
              onClick={handleLeave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              style={{ background: "#dc2626", color: "#fff" }}
            >
              <PhoneOff size={13} /> Leave
            </button>
          </div>
        </LiveKitRoom>
      </div>
    </>
  );
}

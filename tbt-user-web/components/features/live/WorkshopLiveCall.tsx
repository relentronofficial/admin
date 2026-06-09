"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  PreJoin,
  useRemoteParticipants,
  useIsRecording,
  type LocalUserChoices,
} from "@livekit/components-react";
import { DisconnectReason } from "livekit-client";
import {
  PhoneOff, Users, Clock, MessageSquare, BarChart2,
  Smile, Settings, Disc,
} from "lucide-react";
import { getServerNow } from "@/lib/api/client";
import { ChatPanel } from "./ChatPanel";
import { ParticipantListPanel } from "./ParticipantListPanel";
import { EmojiReactionOverlay } from "./EmojiReactionOverlay";
import { CaptionStrip } from "./CaptionStrip";
import { PollPanel } from "./PollPanel";
import { WaitingRoomOverlay } from "./WaitingRoomOverlay";
import { BackgroundSettingsModal } from "./BackgroundSettingsModal";

interface WorkshopLiveCallProps {
  token: string;
  wsUrl: string;
  roomName: string;
  defaultName?: string;
  startedAt?: string | null;
  isWebinar?: boolean;
  liveCallId?: string;
  onLeave: () => void;
  onLeaveByChoice?: () => void;
  waitingRoomActive?: boolean;
  onAdmitted?: (newToken: string) => void;
}

type SidePanel = "chat" | "participants" | "polls" | null;

// Headless — syncs LiveKit hook state into parent
function RoomSyncLayer({ onRecording }: { onRecording: (v: boolean) => void }) {
  const isRecording = useIsRecording();
  useEffect(() => { onRecording(isRecording); }, [isRecording, onRecording]);
  return null;
}

function WaitingForHostOverlay() {
  const participants = useRemoteParticipants();
  const hasHost = participants.some(p => p.identity.startsWith("user_"));
  if (hasHost) return null;
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-30 pointer-events-none"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(220,38,38,0.15)" }}>
        <Users size={22} style={{ color: "#dc2626" }} />
      </div>
      <p className="text-white font-semibold text-sm">Waiting for the host to join…</p>
      <p className="text-xs" style={{ color: "#a0a0a0" }}>The session will begin when the host enters the room.</p>
    </div>
  );
}

export function WorkshopLiveCall({
  token,
  wsUrl,
  defaultName = "",
  startedAt,
  isWebinar = false,
  liveCallId,
  onLeave,
  onLeaveByChoice,
  waitingRoomActive = false,
  onAdmitted,
}: WorkshopLiveCallProps) {
  const [stage, setStage] = useState<"pre" | "live" | "ended">("pre");
  const [userChoices, setUserChoices] = useState<LocalUserChoices>({
    username: defaultName,
    videoEnabled: !isWebinar,
    audioEnabled: true,
    videoDeviceId: "",
    audioDeviceId: "",
  });
  const leftByChoiceRef = useRef(false);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [showBgSettings, setShowBgSettings] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const handleRecording = useCallback((v: boolean) => setIsRecording(v), []);

  // Lock body scroll for the duration of the overlay
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleLeave = useCallback(() => {
    leftByChoiceRef.current = true;
    onLeaveByChoice?.();
    onLeave();
  }, [onLeave, onLeaveByChoice]);

  const handleDisconnected = useCallback((reason?: DisconnectReason) => {
    if (leftByChoiceRef.current || reason === DisconnectReason.CLIENT_INITIATED) {
      onLeave();
    } else {
      setStage("ended");
    }
  }, [onLeave]);

  const togglePanel = (panel: SidePanel) => {
    setSidePanel(prev => prev === panel ? null : panel);
  };

  const minutesIn = startedAt
    ? Math.floor((getServerNow() - new Date(startedAt).getTime()) / 60000)
    : 0;

  // ── Pre-join ──────────────────────────────────────────────────────────────────
  if (stage === "pre") {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.92)" }}
        data-lk-theme="default"
      >
        <div className="w-full max-w-xl mx-4 rounded-2xl overflow-hidden" style={{ background: "#111" }}>
          <div className="px-6 py-4" style={{ borderBottom: "1px solid #222" }}>
            <p className="text-white font-bold text-base">Ready to join?</p>
            <p className="text-xs mt-0.5" style={{ color: "#a0a0a0" }}>Check your camera and mic before entering</p>
          </div>
          <PreJoin
            defaults={userChoices}
            onSubmit={(choices) => {
              setUserChoices({ ...choices, username: defaultName || choices.username });
              setStage("live");
            }}
            style={{ width: "100%" }}
          />
        </div>
      </div>
    );
  }

  // ── Ended ─────────────────────────────────────────────────────────────────────
  if (stage === "ended") {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.92)" }}
      >
        <div
          className="rounded-2xl flex flex-col items-center gap-4 text-center p-8 w-80"
          style={{ background: "#111" }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(220,38,38,0.15)" }}>
            <PhoneOff size={26} style={{ color: "#dc2626" }} />
          </div>
          <p className="text-white font-semibold text-lg">Meeting ended by the host</p>
          <p className="text-sm" style={{ color: "#a0a0a0" }}>The host has ended this session for everyone.</p>
          <button
            onClick={onLeave}
            className="mt-2 px-6 py-2.5 rounded-lg text-sm font-bold w-full"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            Back to Workshop
          </button>
        </div>
      </div>
    );
  }

  // ── Live ──────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: "#0a0a0a" }}
      data-lk-theme="default"
    >
      {/* Top bar — outside LiveKitRoom, no LiveKit hooks */}
      <div
        className="shrink-0 flex items-center gap-2 px-4"
        style={{ height: 52, background: "#111111", borderBottom: "1px solid #1e1e1e" }}
      >
        {/* Left: status badges */}
        <span
          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
          style={{ background: "rgba(220,38,38,0.2)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.4)" }}
        >
          LIVE
        </span>
        {isRecording && (
          <span
            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ background: "rgba(220,38,38,0.15)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" }}
          >
            <Disc size={8} className="animate-pulse" /> REC
          </span>
        )}
        {minutesIn >= 5 && (
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
            style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <Clock size={9} /> Joined {minutesIn}m in
          </span>
        )}

        <div className="flex-1" />

        {/* Panel toggles */}
        <TopBarBtn
          icon={<MessageSquare size={13} />}
          label="Chat"
          active={sidePanel === "chat"}
          onClick={() => togglePanel("chat")}
        />
        <TopBarBtn
          icon={<Users size={13} />}
          label="People"
          active={sidePanel === "participants"}
          onClick={() => togglePanel("participants")}
        />
        {liveCallId && (
          <TopBarBtn
            icon={<BarChart2 size={13} />}
            label="Polls"
            active={sidePanel === "polls"}
            onClick={() => togglePanel("polls")}
          />
        )}

        <div style={{ width: 1, height: 20, background: "#2a2a2a", margin: "0 4px" }} />

        <button
          onClick={() => setShowBgSettings(true)}
          className="p-2 rounded-lg transition-colors"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          title="Background & audio settings"
        >
          <Settings size={13} style={{ color: "#a0a0a0" }} />
        </button>

        <button
          onClick={() => setShowReactions(v => !v)}
          className="p-2 rounded-lg transition-colors"
          style={{
            background: showReactions ? "rgba(220,38,38,0.2)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${showReactions ? "rgba(220,38,38,0.4)" : "rgba(255,255,255,0.08)"}`,
          }}
          title="Reactions"
        >
          <Smile size={13} style={{ color: showReactions ? "#dc2626" : "#a0a0a0" }} />
        </button>

        <button
          onClick={handleLeave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold ml-1"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          <PhoneOff size={14} /> Leave
        </button>
      </div>

      {/* Body — LiveKitRoom fills remaining height */}
      <div className="flex-1 relative min-h-0">
        <LiveKitRoom
          serverUrl={wsUrl}
          token={token}
          connect={true}
          audio={userChoices.audioEnabled}
          video={userChoices.videoEnabled}
          onDisconnected={handleDisconnected}
          style={{ height: "100%", width: "100%" }}
        >
          <RoomSyncLayer onRecording={handleRecording} />
          <VideoConference />
          <WaitingForHostOverlay />
          <CaptionStrip />

          {waitingRoomActive && liveCallId && (
            <WaitingRoomOverlay
              liveCallId={liveCallId}
              onAdmitted={() => onAdmitted?.(token)}
            />
          )}

          {showReactions && <EmojiReactionOverlay />}

          {/* Side panel — overlays video, doesn't push it */}
          {sidePanel && (
            <div
              className="absolute top-0 right-0 h-full z-50 flex flex-col"
              style={{
                width: 300,
                background: "#141414",
                borderLeft: "1px solid #2a2a2a",
                boxShadow: "-8px 0 32px rgba(0,0,0,0.6)",
              }}
            >
              {sidePanel === "chat" && <ChatPanel onClose={() => setSidePanel(null)} />}
              {sidePanel === "participants" && <ParticipantListPanel onClose={() => setSidePanel(null)} />}
              {sidePanel === "polls" && liveCallId && (
                <PollPanel liveCallId={liveCallId} onClose={() => setSidePanel(null)} />
              )}
            </div>
          )}

          {showBgSettings && <BackgroundSettingsModal onClose={() => setShowBgSettings(false)} />}
        </LiveKitRoom>
      </div>
    </div>
  );
}

function TopBarBtn({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
      style={{
        background: active ? "rgba(220,38,38,0.15)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${active ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.08)"}`,
        color: active ? "#dc2626" : "#a0a0a0",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

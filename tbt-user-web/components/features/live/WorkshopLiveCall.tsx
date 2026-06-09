"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  PreJoin,
  useRemoteParticipants,
  type LocalUserChoices,
} from "@livekit/components-react";
import { DisconnectReason } from "livekit-client";
import {
  PhoneOff, Users, Clock, MessageSquare, BarChart2,
  Smile, Settings, ChevronRight, ChevronLeft,
} from "lucide-react";
import { getServerNow } from "@/lib/api/client";
import { ChatPanel } from "./ChatPanel";
import { ParticipantListPanel } from "./ParticipantListPanel";
import { EmojiReactionOverlay } from "./EmojiReactionOverlay";
import { RecordingIndicator } from "./RecordingIndicator";
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
  /** Passed when member was admitted after waiting room */
  onLeave: () => void;
  onLeaveByChoice?: () => void;
  /** If set, member was in waiting room and this triggers refresh */
  waitingRoomActive?: boolean;
  onAdmitted?: (newToken: string) => void;
}

type SidePanel = "chat" | "participants" | "polls" | null;

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
      className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold pointer-events-none"
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

  // Socket: listen for live_call:admitted event
  useEffect(() => {
    // The waiting-room admission flow polls in WaitingRoomOverlay
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
        <p className="text-sm" style={{ color: "#a0a0a0" }}>The host has ended this session for everyone.</p>
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

  const sidebarWidth = 280;
  const hasSide = !!sidePanel;

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{ height: 580, background: "#000" }}
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
        {/* Inner flex — everything inside LiveKitRoom context so hooks work in all panels */}
        <div style={{ display: "flex", height: "100%", width: "100%" }}>
          {/* Main video area */}
          <div className="relative flex-1 min-w-0" style={{ height: "100%", overflow: "hidden" }}>
            <VideoConference />
            <WaitingForHostOverlay />
            <CaptionStrip />
            {startedAt && <LateJoinBanner startedAt={startedAt} />}

            {/* Waiting room overlay */}
            {waitingRoomActive && liveCallId && (
              <WaitingRoomOverlay
                liveCallId={liveCallId}
                onAdmitted={() => onAdmitted?.(token)}
              />
            )}

            {/* Emoji reactions */}
            {showReactions && <EmojiReactionOverlay />}

            {/* Top-right controls */}
            <div className="absolute top-3 right-3 z-50 flex items-center gap-1.5">
              <RecordingIndicator />

              <button
                onClick={() => setShowBgSettings(true)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
                title="Background & audio settings"
              >
                <Settings size={13} style={{ color: "#f0f0f0" }} />
              </button>

              <button
                onClick={() => setShowReactions(v => !v)}
                className="p-1.5 rounded-lg transition-colors"
                style={{
                  background: showReactions ? "rgba(220,38,38,0.3)" : "rgba(0,0,0,0.6)",
                  border: `1px solid ${showReactions ? "rgba(220,38,38,0.5)" : "rgba(255,255,255,0.1)"}`,
                }}
                title="Reactions"
              >
                <Smile size={13} style={{ color: "#f0f0f0" }} />
              </button>

              <button
                onClick={handleLeave}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                style={{ background: "var(--color-accent)", color: "#fff" }}
                aria-label="Leave call"
              >
                <PhoneOff size={13} />
                Leave
              </button>
            </div>

            {/* Bottom panel tabs */}
            <div className="absolute bottom-3 left-3 z-50 flex items-center gap-1.5">
              <PanelTab icon={<MessageSquare size={13} />} label="Chat" active={sidePanel === "chat"} onClick={() => togglePanel("chat")} />
              <PanelTab icon={<Users size={13} />} label="People" active={sidePanel === "participants"} onClick={() => togglePanel("participants")} />
              {liveCallId && (
                <PanelTab icon={<BarChart2 size={13} />} label="Polls" active={sidePanel === "polls"} onClick={() => togglePanel("polls")} />
              )}
            </div>

            {showBgSettings && <BackgroundSettingsModal onClose={() => setShowBgSettings(false)} />}
          </div>

          {/* Side panel — inside LiveKitRoom so useChat/useParticipants have context */}
          {hasSide && (
            <div
              className="shrink-0 flex flex-col"
              style={{ width: sidebarWidth, borderLeft: "1px solid #2a2a2a", background: "#181818", height: "100%" }}
            >
              {sidePanel === "chat" && <ChatPanel onClose={() => setSidePanel(null)} />}
              {sidePanel === "participants" && <ParticipantListPanel onClose={() => setSidePanel(null)} />}
              {sidePanel === "polls" && liveCallId && <PollPanel liveCallId={liveCallId} onClose={() => setSidePanel(null)} />}
            </div>
          )}
        </div>
      </LiveKitRoom>

      {/* Collapse chevron — absolutely positioned on the outer relative container */}
      {hasSide && (
        <button
          onClick={() => setSidePanel(null)}
          className="absolute right-[280px] top-1/2 -translate-y-1/2 z-50 w-5 h-10 flex items-center justify-center rounded-l-lg"
          style={{ background: "#2a2a2a" }}
        >
          <ChevronRight size={12} style={{ color: "#a0a0a0" }} />
        </button>
      )}
    </div>
  );
}

function PanelTab({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
      style={{
        background: active ? "rgba(220,38,38,0.2)" : "rgba(0,0,0,0.6)",
        border: `1px solid ${active ? "rgba(220,38,38,0.4)" : "rgba(255,255,255,0.1)"}`,
        color: active ? "#dc2626" : "#f0f0f0",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

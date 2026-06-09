"use client";

import { useParticipants, ConnectionQualityIndicator } from "@livekit/components-react";
import { Mic, MicOff, Video, VideoOff, X, Users } from "lucide-react";
import { Track } from "livekit-client";

interface ParticipantListPanelProps {
  onClose?: () => void;
  /** When provided, shows remove/mute buttons for the host UI */
  onMuteParticipant?: (identity: string, trackSid: string) => void;
  onRemoveParticipant?: (identity: string) => void;
}

export function ParticipantListPanel({ onClose, onMuteParticipant, onRemoveParticipant }: ParticipantListPanelProps) {
  const participants = useParticipants();
  const isHostView = !!(onMuteParticipant || onRemoveParticipant);

  return (
    <div
      className="flex flex-col"
      style={{ height: "100%", background: "#181818" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid #2a2a2a" }}
      >
        <div className="flex items-center gap-2">
          <Users size={14} style={{ color: "#a0a0a0" }} />
          <span className="text-xs font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#a0a0a0" }}>
            Participants ({participants.length})
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-[#2a2a2a] transition-colors">
            <X size={14} style={{ color: "#606060" }} />
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1" style={{ minHeight: 0 }}>
        {participants.map((p) => {
          const audioTrack = p.getTrackPublication(Track.Source.Microphone);
          const videoTrack = p.getTrackPublication(Track.Source.Camera);
          const audioMuted = !audioTrack || audioTrack.isMuted;
          const videoMuted = !videoTrack || videoTrack.isMuted;
          const isHost = p.identity.startsWith("user_");

          return (
            <div
              key={p.identity}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg group"
              style={{ background: "#1a1a1a" }}
            >
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: isHost ? "rgba(220,38,38,0.2)" : "#2a2a2a", color: isHost ? "#dc2626" : "#a0a0a0" }}
              >
                {(p.name ?? p.identity).slice(0, 1).toUpperCase()}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "#f0f0f0" }}>
                  {p.name ?? p.identity}
                </p>
                {isHost && (
                  <span className="text-[10px] font-bold uppercase" style={{ color: "#dc2626" }}>Host</span>
                )}
              </div>

              {/* Track indicators */}
              <div className="flex items-center gap-1 shrink-0">
                {audioMuted ? <MicOff size={12} style={{ color: "#dc2626" }} /> : <Mic size={12} style={{ color: "#a0a0a0" }} />}
                {videoMuted ? <VideoOff size={12} style={{ color: "#dc2626" }} /> : <Video size={12} style={{ color: "#a0a0a0" }} />}
                <ConnectionQualityIndicator participant={p} className="w-3 h-3" />
              </div>

              {/* Host controls (only when isHostView and not the host themselves) */}
              {isHostView && !isHost && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onMuteParticipant && audioTrack?.trackSid && !audioMuted && (
                    <button
                      onClick={() => onMuteParticipant(p.identity, audioTrack.trackSid!)}
                      className="p-1 rounded hover:bg-[#2a2a2a] transition-colors"
                      title="Mute"
                    >
                      <MicOff size={11} style={{ color: "#f59e0b" }} />
                    </button>
                  )}
                  {onRemoveParticipant && (
                    <button
                      onClick={() => onRemoveParticipant(p.identity)}
                      className="p-1 rounded hover:bg-[#2a2a2a] transition-colors"
                      title="Remove"
                    >
                      <X size={11} style={{ color: "#dc2626" }} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

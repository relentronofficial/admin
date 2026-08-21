"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  PreJoin,
  useChat,
  useParticipants,
  type LocalUserChoices,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { MessageSquare, Users, PhoneOff, X, Send, Mic, MicOff, Video, VideoOff, UserX } from "lucide-react";
import {
  useEndOnboardingMeeting,
  useGetOnboardingMeeting,
  useRemoveOnboardingMeetingParticipant,
  useMuteOnboardingMeetingParticipant,
} from "@/lib/hooks/useOnboardingMeetings";

/**
 * Centralized admin/host view of a Virtual Self Onboarding verification
 * call. Deliberately a new, lean component rather than a reuse of
 * AdminLiveCall.tsx — that component's panels (Polls/Q&A/Breakout/Hand
 * Raise) are hard-wired to /api/workshops/live-calls/... hooks and none of
 * those extras apply to a 1:1(or few) onboarding verification call. This
 * reuses the same underlying LiveKit library and dark-theme design tokens
 * instead. See ONBOARDING_LIVE_MEETING_SPECKIT.md.
 */

interface Props {
  token: string;
  wsUrl: string;
  meetingId: string;
  hostName?: string;
  memberName?: string;
  meetingTitle?: string;
  /** Authoritative meeting start time from the backend (host-token response) — null before the meeting has actually started. */
  startedAt?: string | null;
  onLeave: () => void;
}

// Ticks off the *real* elapsed meeting duration (backend startedAt), not
// "time since this client connected" — a late joiner (or a host who joins
// after the member has been waiting) must see the true elapsed time.
function DurationTicker({ startedAt }: { startedAt: string | null | undefined }) {
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

function ChatPanel({ onClose }: { onClose: () => void }) {
  const { chatMessages, send, isSending } = useChat();
  const [text, setText] = useState("");
  const handleSend = () => {
    if (!text.trim()) return;
    send(text.trim());
    setText("");
  };
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">Chat</h3>
        <button onClick={onClose} className="text-[#888] hover:text-[#f0f0f0]"><X size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {chatMessages.length === 0 ? (
          <p className="text-xs text-[#606060]">No messages yet</p>
        ) : (
          chatMessages.map((m, i) => (
            <div key={i} className="text-xs">
              <span className="text-[#dc2626] font-semibold">{(m as any).from?.name || "Participant"}: </span>
              <span className="text-[#a0a0a0]">{m.message}</span>
            </div>
          ))
        )}
      </div>
      <div className="p-3 border-t border-[#2a2a2a] flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message…"
          className="flex-1 h-9 px-3 text-xs bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#f0f0f0] placeholder-[#606060] outline-none focus:border-[#dc2626]"
        />
        <button onClick={handleSend} disabled={isSending} className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#dc2626] text-white disabled:opacity-40">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

// identityToParticipantId: LiveKit identity -> OnboardingMeetingParticipant.id,
// resolved from the meeting-detail fetch — the remove/mute APIs are keyed by
// the DB participant row id (not the LiveKit identity), matching the
// existing handler's signature exactly rather than adding an identity-keyed
// variant. See ONBOARDING_LIVE_MEETING_SPECKIT.md (host controls fix).
function ParticipantsPanel({
  onClose,
  meetingId,
  identityToParticipantId,
}: {
  onClose: () => void;
  meetingId: string;
  identityToParticipantId: Map<string, string>;
}) {
  const participants = useParticipants();
  const removeParticipant = useRemoveOnboardingMeetingParticipant();
  const muteParticipant = useMuteOnboardingMeetingParticipant();
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRemove = async (identity: string, name: string) => {
    const participantId = identityToParticipantId.get(identity);
    if (!participantId) return;
    if (!window.confirm(`Remove ${name} from this meeting?`)) return;
    setActionError(null);
    setActioning(`remove:${identity}`);
    try {
      await removeParticipant.mutateAsync({ meetingId, participantId });
    } catch {
      setActionError(`Couldn't remove ${name}. Please try again.`);
    } finally {
      setActioning(null);
    }
  };

  const handleMute = async (identity: string, name: string) => {
    const participantId = identityToParticipantId.get(identity);
    if (!participantId) return;
    setActionError(null);
    setActioning(`mute:${identity}`);
    try {
      await muteParticipant.mutateAsync({ meetingId, participantId });
    } catch {
      setActionError(`Couldn't mute ${name}. Please try again.`);
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
          Participants ({participants.length})
        </h3>
        <button onClick={onClose} className="text-[#888] hover:text-[#f0f0f0]"><X size={14} /></button>
      </div>
      {actionError && <div className="px-4 py-2 text-[11px] text-[#dc2626] bg-[rgba(220,38,38,0.08)]">{actionError}</div>}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {participants.map((p) => {
          const isHost = p.identity.startsWith("user_");
          const canManage = !isHost && identityToParticipantId.has(p.identity);
          return (
            <div key={p.identity} className="flex items-center justify-between text-xs py-1.5 gap-2">
              <span className="text-[#f0f0f0] truncate">
                {p.name || p.identity} {isHost && <span className="text-[#dc2626] text-[10px] uppercase ml-1">Host</span>}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1.5 text-[#606060]">
                  {p.isMicrophoneEnabled ? <Mic size={12} /> : <MicOff size={12} className="text-[#888]" />}
                  {p.isCameraEnabled ? <Video size={12} /> : <VideoOff size={12} className="text-[#888]" />}
                </span>
                {canManage && (
                  <>
                    <button
                      onClick={() => handleMute(p.identity, p.name || p.identity)}
                      disabled={actioning === `mute:${p.identity}`}
                      title="Mute participant"
                      className="text-[#888] hover:text-[#f59e0b] disabled:opacity-40 transition-colors"
                    >
                      {p.isMicrophoneEnabled ? <Mic size={13} /> : <MicOff size={13} />}
                    </button>
                    <button
                      onClick={() => handleRemove(p.identity, p.name || p.identity)}
                      disabled={actioning === `remove:${p.identity}`}
                      title="Remove participant"
                      className="text-[#888] hover:text-[#dc2626] disabled:opacity-40 transition-colors"
                    >
                      <UserX size={13} />
                    </button>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminOnboardingMeetingRoom({ token, wsUrl, meetingId, hostName, memberName, meetingTitle, startedAt, onLeave }: Props) {
  const [stage, setStage] = useState<"pre" | "live" | "summary">("pre");
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [panel, setPanel] = useState<"chat" | "participants" | null>(null);
  const endMeeting = useEndOnboardingMeeting();
  const { data: meetingDetail } = useGetOnboardingMeeting(meetingId);
  const meeting = meetingDetail?.data;

  const identityToParticipantId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of meeting?.participants ?? []) {
      if (p.identity) map.set(p.identity, p.id);
    }
    return map;
  }, [meeting]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleEnd = async () => {
    if (!window.confirm("End this meeting for everyone? This cannot be undone.")) return;
    try { await endMeeting.mutateAsync(meetingId); } catch { /* still leave locally even if the API call fails */ }
    setStage("summary");
  };

  if (stage === "pre") {
    const participantCount = meeting?.participants?.length;
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-center justify-center gap-5 px-4">
        <div className="text-center">
          <h2 className="text-lg font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest">{meetingTitle || "Onboarding Verification Call"}</h2>
          <div className="flex items-center justify-center gap-4 text-xs text-[#888] mt-1.5">
            {memberName && <span>with {memberName}</span>}
            {typeof participantCount === "number" && (
              <span className="flex items-center gap-1"><Users size={11} /> {participantCount} invited</span>
            )}
          </div>
        </div>
        <div className="w-full max-w-md">
          <PreJoin
            defaults={{ username: hostName || "Host" }}
            onSubmit={(c) => { setChoices(c); setStage("live"); }}
            data-lk-theme="default"
          />
        </div>
      </div>
    );
  }

  if (stage === "summary") {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex items-center justify-center">
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-8 text-center max-w-sm">
          <h2 className="text-lg font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest mb-2">Meeting Ended</h2>
          <p className="text-xs text-[#888] mb-6">The verification call has ended.</p>
          <button onClick={onLeave} className="px-5 h-10 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#dc2626] hover:bg-red-700 text-white">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col">
      <LiveKitRoom
        serverUrl={wsUrl}
        token={token}
        connect
        audio={choices?.audioEnabled ?? true}
        video={choices?.videoEnabled ?? true}
        onDisconnected={onLeave}
        data-lk-theme="default"
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#1e1e1e] bg-[#111]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold text-[#f0f0f0] truncate">{meetingTitle || "Onboarding Verification Call"}</span>
            {memberName && <span className="text-xs text-[#606060] hidden sm:inline">with {memberName}</span>}
            <DurationTicker startedAt={startedAt} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPanel(panel === "chat" ? null : "chat")} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#a0a0a0] hover:bg-[#1a1a1a]">
              <MessageSquare size={16} />
            </button>
            <button onClick={() => setPanel(panel === "participants" ? null : "participants")} className="w-9 h-9 flex items-center justify-center rounded-lg text-[#a0a0a0] hover:bg-[#1a1a1a]">
              <Users size={16} />
            </button>
            <button onClick={handleEnd} disabled={endMeeting.isPending} className="px-3 h-9 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#7f1d1d] hover:bg-[#991b1b] text-white disabled:opacity-40">
              <PhoneOff size={13} /> End Meeting
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0">
            <VideoConference />
          </div>
          {panel && (
            <div className="w-[300px] border-l border-[#2a2a2a] bg-[#141414]">
              {panel === "chat" ? (
                <ChatPanel onClose={() => setPanel(null)} />
              ) : (
                <ParticipantsPanel onClose={() => setPanel(null)} meetingId={meetingId} identityToParticipantId={identityToParticipantId} />
              )}
            </div>
          )}
        </div>
      </LiveKitRoom>
    </div>
  );
}

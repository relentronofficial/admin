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
  Smile, Settings, Disc, HelpCircle, Send, CheckCircle2,
} from "lucide-react";
import { getServerNow } from "@/lib/api/client";
import { getSocket } from "@/lib/socket/client";
import { useGetLiveCallQuestions, usePostLiveCallQuestion, useGetMyLiveCallFeedback, usePostLiveCallFeedback } from "@/lib/hooks/useConfig";
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

type SidePanel = "chat" | "participants" | "polls" | "qa" | null;

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

// ── Post-session feedback overlay ────────────────────────────────────────────

function FeedbackOverlay({ liveCallId, onDone, onLeave }: { liveCallId: string; onDone: () => void; onLeave: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const postFeedback = usePostLiveCallFeedback();

  const persist = () => {
    try { localStorage.setItem(`feedback_${liveCallId}`, "1"); } catch {}
  };

  const handleSubmit = async () => {
    if (!rating) return;
    await postFeedback.mutateAsync({ liveCallId, rating, comment: comment.trim() || undefined });
    persist();
    onDone();
  };

  const handleSkip = () => { persist(); onDone(); };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.92)" }}>
      <div className="rounded-2xl flex flex-col items-center gap-5 text-center p-8 w-80" style={{ background: "#111" }}>
        <div>
          <p className="text-white font-bold text-lg">How was the session?</p>
          <p className="text-sm mt-1" style={{ color: "#a0a0a0" }}>Your feedback helps us improve</p>
        </div>
        {/* Star picker */}
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="text-3xl leading-none transition-transform hover:scale-110"
              style={{ color: star <= (hover || rating) ? "#f59e0b" : "#333" }}
            >
              ★
            </button>
          ))}
        </div>
        {rating > 0 && (
          <textarea
            className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
            style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#f0f0f0" }}
            placeholder="Any comments? (optional)"
            rows={3}
            maxLength={300}
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
        )}
        <button
          onClick={handleSubmit}
          disabled={!rating || postFeedback.isPending}
          className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          {postFeedback.isPending ? "Submitting…" : "Submit Feedback"}
        </button>
        <button onClick={handleSkip} className="text-xs underline" style={{ color: "#606060" }}>Skip</button>
      </div>
    </div>
  );
}

// ── Member Q&A panel ──────────────────────────────────────────────────────────

function MemberQaPanel({ liveCallId, onClose }: { liveCallId: string; onClose: () => void }) {
  const { data: questions = [] } = useGetLiveCallQuestions(liveCallId, true);
  const postQuestion = usePostLiveCallQuestion();
  const [text, setText] = useState("");

  const handleSubmit = async () => {
    const q = text.trim();
    if (!q || postQuestion.isPending) return;
    await postQuestion.mutateAsync({ liveCallId, question: q });
    setText("");
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#141414" }}>
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid #2a2a2a" }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#a0a0a0", fontFamily: "Rajdhani, sans-serif" }}>Q&amp;A</span>
        <button onClick={onClose} className="p-1 rounded" style={{ color: "#606060" }}>✕</button>
      </div>

      {/* Submit input */}
      <div className="shrink-0 px-3 py-2.5" style={{ borderBottom: "1px solid #2a2a2a" }}>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "#222", border: "1px solid #333", color: "#f0f0f0" }}
            placeholder="Ask a question…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || postQuestion.isPending}
            className="p-2 rounded-lg shrink-0 disabled:opacity-40"
            style={{ background: text.trim() ? "var(--color-accent)" : "#2a2a2a", color: "#fff" }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5" style={{ minHeight: 0 }}>
        {questions.length === 0 && (
          <p className="text-center text-xs mt-8" style={{ color: "#606060" }}>No questions yet. Be the first!</p>
        )}
        {questions.map(q => (
          <div
            key={q.id}
            className="rounded-xl p-3 space-y-1.5"
            style={{ background: q.isAnswered ? "#0f2318" : "#1a1a1a", border: `1px solid ${q.isAnswered ? "rgba(34,197,94,0.2)" : "#2a2a2a"}` }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold" style={{ color: q.isOwn ? "var(--color-accent)" : "#606060" }}>
                {q.isOwn ? "You" : q.memberName}
              </p>
              {q.isAnswered && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: "#22c55e" }}>
                  <CheckCircle2 size={9} /> Answered
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: q.isAnswered ? "#a0a0a0" : "#f0f0f0" }}>{q.question}</p>
          </div>
        ))}
      </div>
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
  const [feedbackDone, setFeedbackDone] = useState(() => {
    if (!liveCallId) return true;
    try { return !!localStorage.getItem(`feedback_${liveCallId}`); } catch { return false; }
  });

  // Check if feedback was already submitted server-side (avoids re-prompt after refresh)
  const { data: existingFeedback } = useGetMyLiveCallFeedback(liveCallId ?? "", !!liveCallId && stage === "ended" && !feedbackDone);
  useEffect(() => {
    if (existingFeedback) setFeedbackDone(true);
  }, [existingFeedback]);
  const [showBgSettings, setShowBgSettings] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const handleRecording = useCallback((v: boolean) => setIsRecording(v), []);

  // Listen for admin clearing this member's hand
  useEffect(() => {
    if (!liveCallId) return;
    let mounted = true;
    const onCleared = (data: { liveCallId: string }) => {
      if (data.liveCallId === liveCallId) setIsHandRaised(false);
    };
    getSocket().then((s) => {
      if (!mounted) return;
      s.on('live_call:hand_cleared', onCleared);
    });
    return () => {
      mounted = false;
      getSocket().then((s) => s.off('live_call:hand_cleared', onCleared));
    };
  }, [liveCallId]);

  const toggleHand = useCallback(async () => {
    if (!liveCallId) return;
    const s = await getSocket();
    if (isHandRaised) {
      s.emit('live_call:hand_lowered', { liveCallId });
      setIsHandRaised(false);
    } else {
      s.emit('live_call:hand_raised', { liveCallId, memberName: defaultName || 'Member' });
      setIsHandRaised(true);
    }
  }, [liveCallId, isHandRaised, defaultName]);

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
    if (liveCallId && !feedbackDone) {
      return <FeedbackOverlay liveCallId={liveCallId} onDone={() => setFeedbackDone(true)} onLeave={onLeave} />;
    }
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
        {liveCallId && (
          <TopBarBtn
            icon={<span className="text-sm leading-none">✋</span>}
            label={isHandRaised ? "Lower Hand" : "Raise Hand"}
            active={isHandRaised}
            onClick={toggleHand}
          />
        )}
        {liveCallId && (
          <TopBarBtn
            icon={<HelpCircle size={13} />}
            label="Q&A"
            active={sidePanel === "qa"}
            onClick={() => togglePanel("qa")}
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
              {sidePanel === "qa" && liveCallId && (
                <MemberQaPanel liveCallId={liveCallId} onClose={() => setSidePanel(null)} />
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

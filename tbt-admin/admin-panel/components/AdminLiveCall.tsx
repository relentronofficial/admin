"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  PreJoin,
  useParticipants,
  useIsRecording,
  useChat,
  type LocalUserChoices,
} from "@livekit/components-react";
import { DisconnectReason, Track } from "livekit-client";
import {
  PhoneOff, Users, Clock, CheckCircle2, MessageSquare,
  BarChart2, MicOff, XCircle, Lock, Unlock, Disc, StopCircle,
  Bell, Plus, X, Send, HelpCircle, Check, EyeOff, Mic2, LayoutGrid, ArrowLeftToLine,
} from "lucide-react";
import { getAdminSocket } from "@/lib/socket/client";
import toast from "react-hot-toast";
import {
  useEndLiveCall,
  useMuteAll,
  useRemoveParticipant,
  useMuteParticipant,
  useLockRoom,
  useAdmitParticipant,
  useStartRecording,
  useStopRecording,
  useCreatePoll,
  useClosePoll,
  useGetAdminPolls,
  useSendReminders,
  useGetAdminLiveCallQuestions,
  useUpdateLiveCallQuestion,
  usePromoteCoHost,
  useGetBreakoutRooms,
  useCreateBreakoutRooms,
  useAssignToBreakout,
  useRecallAll,
  useDeleteBreakoutRoom,
} from "@/lib/hooks/useTbt";
import { useQueryClient } from "@tanstack/react-query";

// ── Shared helpers ─────────────────────────────────────────────────────────────

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
    <span className="font-mono text-xs font-bold flex items-center gap-1" style={{ color: "#a0a0a0" }}>
      <Clock size={11} />
      {h > 0 ? `${fmt(h)}:` : ""}{fmt(m)}:{fmt(s)}
    </span>
  );
}

// Headless — syncs LiveKit recording state into parent
function RoomSyncLayer({ onRecording }: { onRecording: (v: boolean) => void }) {
  const isRecording = useIsRecording();
  useEffect(() => { onRecording(isRecording); }, [isRecording, onRecording]);
  return null;
}

function ConfirmEndModal({ onConfirm, onCancel, isPending }: { onConfirm: () => void; onCancel: () => void; isPending: boolean }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-xl p-6 w-80 space-y-4 border" style={{ background: "#181818", borderColor: "#2a2a2a" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(220,38,38,0.15)" }}>
            <Users size={18} style={{ color: "#dc2626" }} />
          </div>
          <div>
            <p className="font-bold text-white text-sm">End for everyone?</p>
            <p className="text-xs mt-0.5" style={{ color: "#a0a0a0" }}>All participants will be disconnected.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm font-bold border transition-colors" style={{ borderColor: "#333", color: "#a0a0a0", background: "transparent" }}>Cancel</button>
          <button onClick={onConfirm} disabled={isPending} className="flex-1 py-2 rounded-lg text-sm font-bold disabled:opacity-60" style={{ background: "#7f1d1d", color: "#fff" }}>
            {isPending ? "Ending…" : "End for All"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Participants panel (must be inside LiveKitRoom) ────────────────────────────

function ParticipantsPanel({ liveCallId, onClose }: { liveCallId: string; onClose: () => void }) {
  const participants = useParticipants();
  const muteParticipant = useMuteParticipant();
  const removeParticipant = useRemoveParticipant();
  const promoteCoHost = usePromoteCoHost();
  const [promoted, setPromoted] = useState<Set<string>>(new Set());

  return (
    <div className="flex flex-col h-full" style={{ background: "#181818" }}>
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid #2a2a2a" }}>
        <span className="text-xs font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#a0a0a0" }}>
          Participants ({participants.length})
        </span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#2a2a2a]"><X size={13} style={{ color: "#606060" }} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1" style={{ minHeight: 0 }}>
        {participants.map((p) => {
          const audioTrack = p.getTrackPublication(Track.Source.Microphone);
          const isHost = p.identity.startsWith("user_");
          const audioMuted = !audioTrack || audioTrack.isMuted;
          const isPromoted = promoted.has(p.identity);
          return (
            <div key={p.identity} className="flex items-center gap-2 px-3 py-2 rounded-lg group" style={{ background: "#1a1a1a" }}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: isHost ? "rgba(220,38,38,0.2)" : "#2a2a2a", color: isHost ? "#dc2626" : "#a0a0a0" }}
              >
                {(p.name ?? p.identity).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: "#f0f0f0" }}>{p.name ?? p.identity}</p>
                {isHost && <span className="text-[10px] font-bold uppercase" style={{ color: "#dc2626" }}>You (Host)</span>}
                {isPromoted && <span className="text-[10px] font-bold uppercase" style={{ color: "#f59e0b" }}>Co-host</span>}
              </div>
              {!isHost && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isPromoted && (
                    <button
                      disabled={promoteCoHost.isPending}
                      onClick={async () => {
                        try {
                          await promoteCoHost.mutateAsync({ lcid: liveCallId, memberId: p.identity });
                          setPromoted(prev => new Set([...prev, p.identity]));
                        } catch (err: any) {
                          toast.error(err.message || "Failed to promote");
                        }
                      }}
                      className="p-1 rounded hover:bg-[#2a2a2a] disabled:opacity-40" title="Promote to presenter"
                    >
                      <Mic2 size={11} style={{ color: "#22c55e" }} />
                    </button>
                  )}
                  {!audioMuted && audioTrack?.trackSid && (
                    <button
                      onClick={() => muteParticipant.mutate({ liveCallId, identity: p.identity, trackSid: audioTrack.trackSid! })}
                      className="p-1 rounded hover:bg-[#2a2a2a]" title="Mute mic"
                    >
                      <MicOff size={11} style={{ color: "#f59e0b" }} />
                    </button>
                  )}
                  <button
                    onClick={() => removeParticipant.mutate({ liveCallId, identity: p.identity })}
                    className="p-1 rounded hover:bg-[#2a2a2a]" title="Remove"
                  >
                    <XCircle size={11} style={{ color: "#dc2626" }} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Chat panel (must be inside LiveKitRoom) ────────────────────────────────────

function AdminChatPanel({ onClose }: { onClose: () => void }) {
  const { chatMessages, send } = useChat();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | undefined>(undefined);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  const handleSend = () => {
    const msg = text.trim();
    if (!msg) return;
    send(msg);
    setText("");
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#181818" }}>
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid #2a2a2a" }}>
        <span className="text-xs font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#a0a0a0" }}>Chat</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#2a2a2a]"><X size={13} style={{ color: "#606060" }} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ minHeight: 0 }}>
        {chatMessages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold" style={{ color: "#606060" }}>{msg.from?.name ?? "Unknown"}</span>
            <p className="text-sm px-3 py-2 rounded-xl rounded-tl-sm break-words" style={{ background: "#2a2a2a", color: "#f0f0f0" }}>
              {msg.message}
            </p>
          </div>
        ))}
        <div ref={bottomRef as React.RefObject<HTMLDivElement>} />
      </div>
      <div className="shrink-0 px-3 pb-3 pt-2" style={{ borderTop: "1px solid #2a2a2a" }}>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "#222", border: "1px solid #333", color: "#f0f0f0" }}
            placeholder="Message everyone…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button
            onClick={handleSend}
            className="p-2 rounded-lg shrink-0"
            style={{ background: text.trim() ? "#dc2626" : "#2a2a2a", color: "#fff" }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Poll panel (admin) ─────────────────────────────────────────────────────────

function AdminPollPanel({ liveCallId, onClose }: { liveCallId: string; onClose: () => void }) {
  const { data: polls = [] } = useGetAdminPolls(liveCallId, true);
  const createPoll = useCreatePoll();
  const closePoll = useClosePoll();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [creating, setCreating] = useState(false);

  const addOption = () => setOptions(o => [...o, ""]);
  const removeOption = (i: number) => setOptions(o => o.filter((_, idx) => idx !== i));
  const setOption = (i: number, v: string) => setOptions(o => o.map((x, idx) => idx === i ? v : x));

  const handleCreate = async () => {
    const valid = options.filter(o => o.trim());
    if (!question.trim() || valid.length < 2) return;
    setCreating(false);
    await createPoll.mutateAsync({ liveCallId, question: question.trim(), options: valid });
    setQuestion(""); setOptions(["", ""]);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#181818" }}>
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid #2a2a2a" }}>
        <span className="text-xs font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#a0a0a0" }}>Polls</span>
        <div className="flex gap-2">
          <button onClick={() => setCreating(v => !v)} className="p-1 rounded hover:bg-[#2a2a2a]">
            <Plus size={13} style={{ color: creating ? "#dc2626" : "#a0a0a0" }} />
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#2a2a2a]"><X size={13} style={{ color: "#606060" }} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4" style={{ minHeight: 0 }}>
        {creating && (
          <div className="rounded-xl p-3 space-y-2.5" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#222", border: "1px solid #333", color: "#f0f0f0" }}
              placeholder="Poll question…"
              value={question}
              onChange={e => setQuestion(e.target.value)}
            />
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
                  style={{ background: "#222", border: "1px solid #333", color: "#f0f0f0" }}
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={e => setOption(i, e.target.value)}
                />
                {options.length > 2 && (
                  <button onClick={() => removeOption(i)} className="p-1"><X size={12} style={{ color: "#606060" }} /></button>
                )}
              </div>
            ))}
            {options.length < 5 && (
              <button onClick={addOption} className="text-xs flex items-center gap-1" style={{ color: "#a0a0a0" }}>
                <Plus size={11} /> Add option
              </button>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setCreating(false)} className="flex-1 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: "#333", color: "#a0a0a0", background: "transparent" }}>Cancel</button>
              <button
                onClick={handleCreate}
                disabled={createPoll.isPending}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60"
                style={{ background: "#dc2626", color: "#fff" }}
              >
                Launch Poll
              </button>
            </div>
          </div>
        )}

        {polls.length === 0 && !creating && (
          <p className="text-center text-xs mt-8" style={{ color: "#606060" }}>No polls yet. Click + to create one.</p>
        )}

        {polls.map((poll) => {
          const totalVotes = poll.options.reduce((s, o) => s + o._count.votes, 0);
          return (
            <div key={poll.id} className="rounded-xl p-3 space-y-2" style={{ background: "#1a1a1a", border: `1px solid ${poll.isActive ? "#2a2a2a" : "#222"}` }}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: poll.isActive ? "#f0f0f0" : "#606060" }}>{poll.question}</p>
                {poll.isActive && (
                  <button onClick={() => closePoll.mutate(poll.id)} className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0" style={{ background: "rgba(220,38,38,0.15)", color: "#dc2626" }}>
                    End
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {poll.options.map((opt) => {
                  const pct = totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0;
                  return (
                    <div key={opt.id} className="relative rounded-lg px-3 py-1.5 overflow-hidden" style={{ background: "#222" }}>
                      <div className="absolute inset-0 rounded-lg" style={{ width: `${pct}%`, background: "rgba(220,38,38,0.15)" }} />
                      <div className="relative flex justify-between">
                        <span className="text-xs" style={{ color: "#f0f0f0" }}>{opt.optionText}</span>
                        <span className="text-xs font-bold" style={{ color: "#a0a0a0" }}>{opt._count.votes} ({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px]" style={{ color: "#606060" }}>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Hand raise panel ──────────────────────────────────────────────────────────

interface RaisedHand { memberId: string; memberName: string; raisedAt: string; }

function HandsPanel({ liveCallId, hands, onClear, onClose }: {
  liveCallId: string;
  hands: RaisedHand[];
  onClear: (memberId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#181818" }}>
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid #2a2a2a" }}>
        <span className="text-xs font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#a0a0a0" }}>
          Raised Hands ({hands.length})
        </span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#2a2a2a]"><X size={13} style={{ color: "#606060" }} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1" style={{ minHeight: 0 }}>
        {hands.length === 0 && (
          <p className="text-center text-xs mt-8" style={{ color: "#606060" }}>No hands raised yet.</p>
        )}
        {hands.map((h) => (
          <div key={h.memberId} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#1a1a1a" }}>
            <span className="text-lg leading-none">✋</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate" style={{ color: "#f0f0f0" }}>{h.memberName}</p>
              <p className="text-[10px]" style={{ color: "#606060" }}>
                {new Date(h.raisedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <button
              onClick={() => onClear(h.memberId)}
              className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
              style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}
            >
              Clear
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Q&A moderation panel ──────────────────────────────────────────────────────

function AdminQaPanel({ liveCallId, onClose }: { liveCallId: string; onClose: () => void }) {
  const { data: questions = [], refetch } = useGetAdminLiveCallQuestions(liveCallId, true);
  const updateQuestion = useUpdateLiveCallQuestion();
  const qc = useQueryClient();

  useEffect(() => {
    let socket: Awaited<ReturnType<typeof getAdminSocket>> | null = null;
    let mounted = true;
    const onNew = (data: any) => {
      if (data.liveCallId === liveCallId) qc.invalidateQueries({ queryKey: ['admin-live-call-questions', liveCallId] });
    };
    getAdminSocket().then((s) => {
      if (!mounted) return;
      socket = s;
      s.on('live_call:question_new', onNew);
    });
    return () => {
      mounted = false;
      if (socket) socket.off('live_call:question_new', onNew);
    };
  }, [liveCallId, qc]);

  const visible = questions.filter(q => !q.isHidden);
  const unanswered = visible.filter(q => !q.isAnswered);
  const answered = visible.filter(q => q.isAnswered);

  return (
    <div className="flex flex-col h-full" style={{ background: "#181818" }}>
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid #2a2a2a" }}>
        <span className="text-xs font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#a0a0a0" }}>
          Q&amp;A ({unanswered.length} pending)
        </span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#2a2a2a]"><X size={13} style={{ color: "#606060" }} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5" style={{ minHeight: 0 }}>
        {visible.length === 0 && (
          <p className="text-center text-xs mt-8" style={{ color: "#606060" }}>No questions yet.</p>
        )}
        {unanswered.map(q => (
          <div key={q.id} className="rounded-xl p-3 space-y-2" style={{ background: "#1a1a1a", border: "1px solid #333" }}>
            <p className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
              {[q.member.firstName, q.member.lastName].filter(Boolean).join(' ') || 'Member'}
            </p>
            <p className="text-sm" style={{ color: "#f0f0f0" }}>{q.question}</p>
            <div className="flex gap-1.5 pt-0.5">
              <button
                onClick={() => updateQuestion.mutate({ lcid: liveCallId, qid: q.id, isAnswered: true })}
                disabled={updateQuestion.isPending}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold disabled:opacity-40"
                style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                <Check size={10} /> Mark Answered
              </button>
              <button
                onClick={() => updateQuestion.mutate({ lcid: liveCallId, qid: q.id, isHidden: true })}
                disabled={updateQuestion.isPending}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold disabled:opacity-40"
                style={{ background: "rgba(96,96,96,0.12)", color: "#606060", border: "1px solid rgba(96,96,96,0.3)" }}
              >
                <EyeOff size={10} /> Hide
              </button>
            </div>
          </div>
        ))}
        {answered.length > 0 && (
          <p className="text-[10px] uppercase tracking-widest font-rajdhani font-bold px-1 pt-2" style={{ color: "#444" }}>Answered</p>
        )}
        {answered.map(q => (
          <div key={q.id} className="rounded-xl p-3 space-y-1" style={{ background: "#141414", border: "1px solid #222", opacity: 0.6 }}>
            <p className="text-xs font-semibold" style={{ color: "#606060" }}>
              {[q.member.firstName, q.member.lastName].filter(Boolean).join(' ') || 'Member'}
            </p>
            <p className="text-sm" style={{ color: "#a0a0a0" }}>{q.question}</p>
            <p className="text-[10px] flex items-center gap-1" style={{ color: "#22c55e" }}><Check size={9} /> Answered</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Breakout rooms panel ──────────────────────────────────────────────────────

function BreakoutPanel({ liveCallId, onClose }: { liveCallId: string; onClose: () => void }) {
  const participants = useParticipants();
  const { data: rooms = [], isLoading } = useGetBreakoutRooms(liveCallId, true);
  const createRooms = useCreateBreakoutRooms();
  const assignTo = useAssignToBreakout();
  const recallAll = useRecallAll();
  const deleteRoom = useDeleteBreakoutRoom();
  const [count, setCount] = useState(2);
  const [assigning, setAssigning] = useState<string | null>(null); // brid being assigned

  const handleCreate = async () => {
    try {
      await createRooms.mutateAsync({ lcid: liveCallId, count });
    } catch (err: any) {
      toast.error(err.message || "Failed to create breakout rooms");
    }
  };

  const handleAssign = async (brid: string, identity: string) => {
    await assignTo.mutateAsync({ lcid: liveCallId, brid, identity });
    setAssigning(null);
  };

  const activeRooms = rooms.filter(r => r.isActive);
  const nonHostParticipants = participants.filter(p => !p.identity.startsWith("user_"));

  return (
    <div className="flex flex-col h-full" style={{ background: "#181818" }}>
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: "1px solid #2a2a2a" }}>
        <span className="text-xs font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#a0a0a0" }}>
          Breakout Rooms
        </span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#2a2a2a]"><X size={13} style={{ color: "#606060" }} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ minHeight: 0 }}>
        {/* Create rooms */}
        {activeRooms.length === 0 && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
            <p className="text-xs font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#606060" }}>Create Rooms</p>
            <div className="flex gap-2 items-center">
              <input
                type="number" min={1} max={20} value={count}
                onChange={e => setCount(Math.min(20, Math.max(1, Number(e.target.value))))}
                className="w-16 rounded-lg px-2 py-1.5 text-sm text-center outline-none"
                style={{ background: "#222", border: "1px solid #333", color: "#f0f0f0" }}
              />
              <span className="text-xs" style={{ color: "#a0a0a0" }}>rooms</span>
              <button
                onClick={handleCreate}
                disabled={createRooms.isPending}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold disabled:opacity-60"
                style={{ background: "#dc2626", color: "#fff" }}
              >
                {createRooms.isPending ? "Creating…" : "Create Breakouts"}
              </button>
            </div>
          </div>
        )}

        {/* Active rooms */}
        {activeRooms.map(room => (
          <div key={room.id} className="rounded-xl p-3 space-y-2" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold" style={{ color: "#f0f0f0" }}>{room.name}</p>
              <button
                disabled={deleteRoom.isPending}
                onClick={async () => {
                  try {
                    await deleteRoom.mutateAsync({ lcid: liveCallId, brid: room.id });
                  } catch (err: any) {
                    toast.error(err.message || "Failed to delete room");
                  }
                }}
                className="p-1 rounded hover:bg-[#2a2a2a] disabled:opacity-40"
                title="Delete room"
              >
                <X size={11} style={{ color: "#606060" }} />
              </button>
            </div>
            <div className="space-y-1">
              {nonHostParticipants.map(p => (
                <div key={p.identity} className="flex items-center gap-2">
                  <span className="text-xs flex-1 truncate" style={{ color: "#a0a0a0" }}>{p.name ?? p.identity}</span>
                  <button
                    onClick={() => handleAssign(room.id, p.identity)}
                    disabled={assignTo.isPending}
                    className="text-[10px] font-bold px-2 py-0.5 rounded disabled:opacity-40"
                    style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}
                  >
                    Move Here
                  </button>
                </div>
              ))}
              {nonHostParticipants.length === 0 && (
                <p className="text-[10px]" style={{ color: "#606060" }}>No participants to assign</p>
              )}
            </div>
          </div>
        ))}

        {/* Recall all */}
        {activeRooms.length > 0 && (
          <button
            onClick={() => recallAll.mutateAsync(liveCallId)}
            disabled={recallAll.isPending}
            className="w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
            style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <ArrowLeftToLine size={12} />
            {recallAll.isPending ? "Recalling…" : "Recall All to Main Room"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main AdminLiveCall ────────────────────────────────────────────────────────

interface AdminLiveCallProps {
  token: string;
  wsUrl: string;
  roomName: string;
  liveCallId: string;
  hostName?: string;
  onLeave: () => void;
}

type SidePanel = "participants" | "polls" | "chat" | "hands" | "qa" | "breakout" | null;

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
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [raisedHands, setRaisedHands] = useState<RaisedHand[]>([]);
  const handleRecording = useCallback((v: boolean) => setIsRecording(v), []);

  const leftByChoiceRef = useRef(false);
  const entryTimeRef = useRef<number>(0);

  const endCall = useEndLiveCall();
  const muteAll = useMuteAll();
  const lockRoom = useLockRoom();
  const startRecording = useStartRecording();
  const stopRecording = useStopRecording();
  const sendReminders = useSendReminders();

  // Lock body scroll while the overlay is mounted
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Hand raise socket listeners
  useEffect(() => {
    let socket: Awaited<ReturnType<typeof getAdminSocket>> | null = null;
    let mounted = true;

    const onHandRaised = (data: RaisedHand & { liveCallId: string }) => {
      if (data.liveCallId !== liveCallId) return;
      setRaisedHands(prev =>
        prev.some(h => h.memberId === data.memberId)
          ? prev
          : [...prev, { memberId: data.memberId, memberName: data.memberName, raisedAt: data.raisedAt }]
      );
    };
    const onHandLowered = (data: { liveCallId: string; memberId: string }) => {
      if (data.liveCallId !== liveCallId) return;
      setRaisedHands(prev => prev.filter(h => h.memberId !== data.memberId));
    };

    getAdminSocket().then((s) => {
      if (!mounted) return;
      socket = s;
      s.on('live_call:hand_raised', onHandRaised);
      s.on('live_call:hand_lowered', onHandLowered);
    });

    return () => {
      mounted = false;
      if (socket) {
        socket.off('live_call:hand_raised', onHandRaised);
        socket.off('live_call:hand_lowered', onHandLowered);
      }
    };
  }, [liveCallId]);

  const clearHand = useCallback(async (memberId: string) => {
    const s = await getAdminSocket();
    s.emit('live_call:hand_cleared', { liveCallId, memberId });
    setRaisedHands(prev => prev.filter(h => h.memberId !== memberId));
  }, [liveCallId]);

  const handleEndForAll = async () => {
    try { await endCall.mutateAsync(liveCallId); } catch {}
    const duration = Math.floor((Date.now() - entryTimeRef.current) / 1000);
    leftByChoiceRef.current = true;
    setShowConfirm(false);
    setSummaryData({ duration, endedAt: new Date() });
    setStage("summary");
  };

  const handleDisconnected = useCallback((reason?: DisconnectReason) => {
    onLeave();
  }, [onLeave]);

  const toggleLock = async () => {
    const next = !isLocked;
    setIsLocked(next);
    await lockRoom.mutateAsync({ liveCallId, locked: next });
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording.mutateAsync(liveCallId);
    } else {
      await startRecording.mutateAsync(liveCallId);
    }
  };

  const togglePanel = (panel: SidePanel) => {
    setSidePanel(prev => prev === panel ? null : panel);
  };

  // ── Summary screen ──────────────────────────────────────────────────────────

  if (stage === "summary" && summaryData) {
    const { duration, endedAt } = summaryData;
    const h = Math.floor(duration / 3600);
    const m = Math.floor((duration % 3600) / 60);
    const s = duration % 60;
    const fmt = (n: number) => String(n).padStart(2, "0");
    const durationStr = h > 0 ? `${fmt(h)}h ${fmt(m)}m ${fmt(s)}s` : `${fmt(m)}m ${fmt(s)}s`;
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.92)" }}
      >
        <div className="rounded-2xl flex flex-col items-center gap-4 text-center p-8 w-80" style={{ background: "#111" }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)" }}>
            <CheckCircle2 size={28} style={{ color: "#22c55e" }} />
          </div>
          <div>
            <p className="font-bold text-white text-lg">Session Ended</p>
            <p className="text-sm mt-1" style={{ color: "#a0a0a0" }}>Duration: <span className="font-bold text-white">{durationStr}</span></p>
            <p className="text-xs mt-0.5" style={{ color: "#606060" }}>Ended at {endedAt.toLocaleTimeString()}</p>
          </div>
          <button onClick={onLeave} className="mt-2 px-6 py-2.5 rounded-lg text-sm font-bold w-full" style={{ background: "#dc2626", color: "#fff" }}>Close</button>
        </div>
      </div>
    );
  }

  // ── Pre-join screen ─────────────────────────────────────────────────────────

  if (stage === "pre") {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.92)" }}
        data-lk-theme="default"
      >
        <div className="w-full max-w-xl mx-4 rounded-2xl overflow-hidden" style={{ background: "#111" }}>
          <div className="px-6 py-4" style={{ borderBottom: "1px solid #222" }}>
            <p className="text-white font-bold text-base">Host Preview</p>
            <p className="text-xs mt-0.5" style={{ color: "#a0a0a0" }}>Check your camera and mic before going live</p>
          </div>
          <PreJoin
            defaults={userChoices}
            onSubmit={(choices) => {
              setUserChoices({ ...choices, username: hostName || choices.username });
              entryTimeRef.current = Date.now();
              setStage("live");
            }}
            style={{ width: "100%" }}
          />
        </div>
      </div>
    );
  }

  // ── Live screen ─────────────────────────────────────────────────────────────

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
        className="fixed inset-0 z-[9999] flex flex-col"
        style={{ background: "#0a0a0a" }}
        data-lk-theme="default"
      >
        {/* Top bar — outside LiveKitRoom */}
        <div
          className="shrink-0 flex items-center gap-1.5 px-4"
          style={{ height: 56, background: "#111111", borderBottom: "1px solid #1e1e1e" }}
        >
          {/* Left: duration + REC badge */}
          <DurationTicker startedAt={entryTimeRef.current} />
          {isRecording && (
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ background: "rgba(220,38,38,0.15)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" }}
            >
              <Disc size={8} className="animate-pulse" /> REC
            </span>
          )}

          <div style={{ width: 1, height: 20, background: "#2a2a2a", margin: "0 6px" }} />

          {/* Host controls with labels */}
          <CtrlBtn onClick={() => muteAll.mutate(liveCallId)} label="Mute All" title="Mute all participants">
            <MicOff size={12} />
          </CtrlBtn>
          <CtrlBtn onClick={toggleLock} label={isLocked ? "Unlock" : "Lock"} active={isLocked}>
            {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
          </CtrlBtn>
          <CtrlBtn
            onClick={toggleRecording}
            label={isRecording ? "Stop Rec" : "Record"}
            active={isRecording}
            activeColor="#dc2626"
          >
            {isRecording ? <StopCircle size={12} /> : <Disc size={12} />}
          </CtrlBtn>
          <CtrlBtn onClick={() => sendReminders.mutate(liveCallId)} label="Remind" title="Send reminder to all members">
            <Bell size={12} />
          </CtrlBtn>

          <div className="flex-1" />

          {/* Panel toggles */}
          <CtrlBtn onClick={() => togglePanel("chat")} label="Chat" active={sidePanel === "chat"}>
            <MessageSquare size={12} />
          </CtrlBtn>
          <CtrlBtn onClick={() => togglePanel("participants")} label="People" active={sidePanel === "participants"}>
            <Users size={12} />
          </CtrlBtn>
          <CtrlBtn onClick={() => togglePanel("polls")} label="Polls" active={sidePanel === "polls"}>
            <BarChart2 size={12} />
          </CtrlBtn>
          <CtrlBtn
            onClick={() => togglePanel("hands")}
            label={raisedHands.length > 0 ? `Hands (${raisedHands.length})` : "Hands"}
            active={sidePanel === "hands"}
            activeColor={raisedHands.length > 0 ? "#f59e0b" : "#f59e0b"}
          >
            <span className="text-sm leading-none">✋</span>
          </CtrlBtn>
          <CtrlBtn onClick={() => togglePanel("qa")} label="Q&A" active={sidePanel === "qa"}>
            <HelpCircle size={12} />
          </CtrlBtn>
          <CtrlBtn onClick={() => togglePanel("breakout")} label="Breakout" active={sidePanel === "breakout"}>
            <LayoutGrid size={12} />
          </CtrlBtn>

          <div style={{ width: 1, height: 20, background: "#2a2a2a", margin: "0 6px" }} />

          {/* Action buttons — Leave neutral, End All dark red */}
          <button
            onClick={() => { leftByChoiceRef.current = true; onLeave(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: "#2a2a2a", color: "#a0a0a0", border: "1px solid #333" }}
          >
            <PhoneOff size={13} /> Leave
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: "#7f1d1d", color: "#fff" }}
          >
            <Users size={13} /> End All
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

            {/* Side panel — overlay, all panels inside LiveKitRoom context */}
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
                {sidePanel === "chat" && <AdminChatPanel onClose={() => setSidePanel(null)} />}
                {sidePanel === "participants" && (
                  <ParticipantsPanel liveCallId={liveCallId} onClose={() => setSidePanel(null)} />
                )}
                {sidePanel === "polls" && (
                  <AdminPollPanel liveCallId={liveCallId} onClose={() => setSidePanel(null)} />
                )}
                {sidePanel === "hands" && (
                  <HandsPanel
                    liveCallId={liveCallId}
                    hands={raisedHands}
                    onClear={clearHand}
                    onClose={() => setSidePanel(null)}
                  />
                )}
                {sidePanel === "qa" && (
                  <AdminQaPanel liveCallId={liveCallId} onClose={() => setSidePanel(null)} />
                )}
                {sidePanel === "breakout" && (
                  <BreakoutPanel liveCallId={liveCallId} onClose={() => setSidePanel(null)} />
                )}
              </div>
            )}
          </LiveKitRoom>
        </div>
      </div>
    </>
  );
}

// ── CtrlBtn ───────────────────────────────────────────────────────────────────

function CtrlBtn({
  children, onClick, title, label, active = false, activeColor = "#f59e0b",
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  label?: string;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-semibold"
      style={{
        background: active ? `${activeColor}26` : "rgba(255,255,255,0.06)",
        border: `1px solid ${active ? activeColor + "50" : "rgba(255,255,255,0.1)"}`,
        color: active ? activeColor : "#a0a0a0",
      }}
    >
      {children}
      {label && <span>{label}</span>}
    </button>
  );
}

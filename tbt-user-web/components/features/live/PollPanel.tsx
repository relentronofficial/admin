"use client";

import { BarChart2, X, CheckCircle2 } from "lucide-react";
import { useGetLiveCallPolls, useVotePoll } from "@/lib/hooks/useConfig";
import { useQueryClient } from "@tanstack/react-query";

interface PollPanelProps {
  liveCallId: string;
  onClose?: () => void;
}

export function PollPanel({ liveCallId, onClose }: PollPanelProps) {
  const { data: polls = [] } = useGetLiveCallPolls(liveCallId, true);
  const voteMutation = useVotePoll();
  const qc = useQueryClient();

  const handleVote = async (pollId: string, optionId: string) => {
    await voteMutation.mutateAsync({ pollId, optionId });
    qc.invalidateQueries({ queryKey: ["live-call-polls", liveCallId] });
  };

  return (
    <div className="flex flex-col" style={{ height: "100%", background: "#181818" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid #2a2a2a" }}
      >
        <div className="flex items-center gap-2">
          <BarChart2 size={14} style={{ color: "#a0a0a0" }} />
          <span className="text-xs font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#a0a0a0" }}>
            Polls
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-[#2a2a2a] transition-colors">
            <X size={14} style={{ color: "#606060" }} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4" style={{ minHeight: 0 }}>
        {polls.length === 0 && (
          <p className="text-center text-xs mt-8" style={{ color: "#606060" }}>
            No active polls right now.
          </p>
        )}
        {polls.map((poll) => {
          const totalVotes = poll.options.reduce((s, o) => s + o._count.votes, 0);
          const myVoteOptionId = poll.options.find((o) => o.votes.length > 0)?.id ?? null;
          const hasVoted = !!myVoteOptionId;

          return (
            <div
              key={poll.id}
              className="rounded-xl p-4 space-y-3"
              style={{ background: "#1a1a1a", border: "1px solid #2a2a2a" }}
            >
              <p className="text-sm font-semibold" style={{ color: "#f0f0f0" }}>
                {poll.question}
              </p>

              <div className="space-y-2">
                {poll.options.map((opt) => {
                  const pct = totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0;
                  const isMyVote = opt.id === myVoteOptionId;

                  return (
                    <button
                      key={opt.id}
                      className="relative w-full text-left px-3 py-2 rounded-lg overflow-hidden transition-colors"
                      style={{
                        background: "#222",
                        border: isMyVote ? "1px solid var(--color-accent)" : "1px solid #333",
                        cursor: hasVoted ? "default" : "pointer",
                      }}
                      disabled={hasVoted || voteMutation.isPending}
                      onClick={() => !hasVoted && handleVote(poll.id, opt.id)}
                    >
                      {/* Progress bar fill */}
                      {hasVoted && (
                        <div
                          className="absolute inset-0 z-0 transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: isMyVote
                              ? "color-mix(in srgb, var(--color-accent) 20%, transparent)"
                              : "rgba(255,255,255,0.05)",
                          }}
                        />
                      )}
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="text-sm" style={{ color: "#f0f0f0" }}>{opt.optionText}</span>
                        <div className="flex items-center gap-1.5">
                          {isMyVote && <CheckCircle2 size={13} style={{ color: "var(--color-accent)" }} />}
                          {hasVoted && (
                            <span className="text-xs font-bold" style={{ color: "#a0a0a0" }}>{pct}%</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px]" style={{ color: "#606060" }}>
                {totalVotes} vote{totalVotes !== 1 ? "s" : ""}{hasVoted ? "" : " · Tap to vote"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

/**
 * AI Content Buddy — admin moderation.
 *
 * Read-mostly view of member AI conversations. Admins can browse,
 * inspect messages, and delete abuse. We deliberately don't expose an
 * edit/reply UI — admins moderate, they don't ghost-write on members'
 * behalf.
 */

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useAIStats,
  useAIConversations,
  useAIConversationDetail,
  useDeleteAIConversation,
  type AIConversationAdmin,
  type AIMessage,
} from "@/lib/hooks/useAI";
import {
  Bot,
  MessageSquare,
  Bookmark,
  Users,
  Search,
  Trash2,
  Loader2,
  X,
  ImageIcon,
  Mic,
  Type,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";

const inputCls =
  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626] transition-all text-sm";

function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[#888] uppercase tracking-widest font-rajdhani">
          {label}
        </span>
        <div className="text-[#dc2626]">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      {hint && <div className="text-[10px] text-[#666] mt-1">{hint}</div>}
    </div>
  );
}

function inputTypeIcon(t: string) {
  if (t === "image") return <ImageIcon size={11} />;
  if (t === "voice") return <Mic size={11} />;
  return <Type size={11} />;
}

function memberName(m: AIConversationAdmin["member"]) {
  if (!m) return "Unknown";
  const n = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
  return n || m.email || m.id.slice(0, 8);
}

export default function AIContentPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: stats } = useAIStats();
  const { data, isLoading } = useAIConversations({ page, limit: 25, search });
  const detail = useAIConversationDetail(selectedId);
  const deleteMut = useDeleteAIConversation();

  const conversations = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  const onDelete = async (id: string) => {
    if (!confirm("Delete this conversation and all its messages? This cannot be undone.")) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Conversation deleted");
      if (selectedId === id) setSelectedId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? "Delete failed");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white font-rajdhani uppercase tracking-wider flex items-center gap-3">
              <Bot className="text-[#dc2626]" size={26} />
              AI Content Buddy — Moderation
            </h1>
            <p className="text-[12px] text-[#888] mt-1">
              Browse member conversations with the Claude-powered content assistant. Delete abuse.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Conversations"
            value={stats?.conversations ?? "—"}
            icon={<MessageSquare size={14} />}
          />
          <StatCard
            label="Messages"
            value={stats?.messages ?? "—"}
            icon={<MessageSquare size={14} />}
          />
          <StatCard
            label="Saved Snippets"
            value={stats?.savedContent ?? "—"}
            icon={<Bookmark size={14} />}
          />
          <StatCard
            label="Active Members"
            value={stats?.activeMembers ?? "—"}
            icon={<Users size={14} />}
            hint={
              stats
                ? `Limits: ${stats.limits.dailyPerMember}/day · ${stats.limits.perMinutePerMember}/min`
                : undefined
            }
          />
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title, member name, or email…"
            className={`${inputCls} pl-9`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
          {/* Conversations list */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#888] uppercase tracking-widest font-rajdhani">
                {total} conversation{total === 1 ? "" : "s"}
              </span>
              {isLoading && <Loader2 size={12} className="animate-spin text-[#666]" />}
            </div>

            <div className="divide-y divide-[#2a2a2a] max-h-[70vh] overflow-y-auto">
              {conversations.length === 0 && !isLoading && (
                <div className="p-6 text-center text-[#666] text-[12px]">
                  No conversations yet.
                </div>
              )}
              {conversations.map((c) => {
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={
                      "w-full text-left px-4 py-3 transition-colors " +
                      (active ? "bg-[#dc2626]/10" : "hover:bg-white/5")
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-white truncate">
                          {c.title || "Untitled"}
                        </div>
                        <div className="text-[11px] text-[#888] truncate">
                          {memberName(c.member)}
                          {c.member?.email && <> · {c.member.email}</>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[10px] text-[#666]">
                          {format(new Date(c.updatedAt), "d MMM, HH:mm")}
                        </div>
                        {c._count && (
                          <div className="text-[10px] text-[#666] mt-0.5">
                            {c._count.messages} msg
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-[#2a2a2a] px-4 py-2 flex items-center justify-between">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] disabled:opacity-40 disabled:cursor-not-allowed hover:text-white"
                >
                  ← Prev
                </button>
                <span className="text-[10px] text-[#666]">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#a0a0a0] disabled:opacity-40 disabled:cursor-not-allowed hover:text-white"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl overflow-hidden flex flex-col">
            {!selectedId ? (
              <div className="flex-1 flex items-center justify-center p-10 text-[#666] text-[12px]">
                Select a conversation on the left to view its messages.
              </div>
            ) : detail.isLoading ? (
              <div className="flex-1 flex items-center justify-center p-10">
                <Loader2 className="animate-spin text-[#666]" />
              </div>
            ) : !detail.data ? (
              <div className="flex-1 flex items-center justify-center p-10 text-[#666] text-[12px]">
                Conversation not found.
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-white truncate">
                      {detail.data.conversation.title || "Untitled"}
                    </div>
                    <div className="text-[11px] text-[#888] truncate">
                      {memberName(detail.data.conversation.member)}
                      {detail.data.conversation.member?.email && (
                        <> · {detail.data.conversation.member.email}</>
                      )}
                    </div>
                    <div className="text-[10px] text-[#666] mt-0.5">
                      Started {format(new Date(detail.data.conversation.createdAt), "d MMM yyyy, HH:mm")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onDelete(detail.data!.conversation.id)}
                      disabled={deleteMut.isPending}
                      className="p-1.5 rounded hover:bg-red-500/10 text-red-400 disabled:opacity-50"
                      title="Delete conversation"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="p-1.5 rounded hover:bg-white/5 text-[#a0a0a0]"
                      title="Close"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[65vh] p-4 space-y-3">
                  {detail.data.messages.map((m: AIMessage) => (
                    <div
                      key={m.id}
                      className={
                        "rounded-lg p-3 border " +
                        (m.sender === "user"
                          ? "bg-[#1f1f1f] border-[#2a2a2a] ml-8"
                          : "bg-[#dc2626]/5 border-[#dc2626]/20 mr-8")
                      }
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest font-rajdhani text-[#dc2626]">
                            {m.sender === "user" ? "Member" : "Content Buddy"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] text-[#666] uppercase tracking-wider">
                            {inputTypeIcon(m.inputType)} {m.inputType}
                          </span>
                        </div>
                        <span className="text-[9px] text-[#666]">
                          {format(new Date(m.createdAt), "HH:mm")}
                        </span>
                      </div>
                      {m.imageUrl && (
                        <a
                          href={m.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block mb-2"
                        >
                          <img
                            src={m.imageUrl}
                            alt=""
                            className="max-h-48 rounded border border-[#2a2a2a]"
                          />
                        </a>
                      )}
                      <div className="text-[13px] text-[#f0f0f0] whitespace-pre-wrap leading-relaxed">
                        {m.message}
                      </div>
                      {(m.contentType || m.tone || m.language) && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.contentType && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[#a0a0a0] uppercase tracking-wider">
                              {m.contentType}
                            </span>
                          )}
                          {m.tone && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[#a0a0a0] uppercase tracking-wider">
                              {m.tone}
                            </span>
                          )}
                          {m.language && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[#a0a0a0] uppercase tracking-wider">
                              {m.language}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

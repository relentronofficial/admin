"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Search, Send, Loader2, X, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useAdminConversations,
  useAdminConversationMessages,
  useSendAdminChatMessage,
  useCloseConversation,
} from "@/lib/hooks/useAdmin";
import { getAdminSocket } from "@/lib/socket/client";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

const TYPING_DEBOUNCE_MS = 2000;
type FilterTab = "all" | "open" | "closed";

export default function AdminMessagesPage() {
  const queryClient = useQueryClient();

  const [activeId, setActiveId]   = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState<FilterTab>("all");
  const [input, setInput]         = useState("");
  const [isTyping, setIsTyping]   = useState(false);
  const [typingName, setTypingName] = useState("");
  const typingTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef            = useRef<HTMLDivElement>(null);

  const { data: convoData, isLoading: convoLoading } = useAdminConversations();
  const { data: msgData }   = useAdminConversationMessages(activeId);
  const sendMessage         = useSendAdminChatMessage();
  const closeConvo          = useCloseConversation();

  const allConversations: any[] = (convoData as any)?.data ?? [];
  const messages: any[]         = (msgData as any)?.data ?? [];
  const activeMeta              = (msgData as any)?.meta ?? null;
  const activeConvo             = allConversations.find((c: any) => c.id === activeId) ?? null;

  const filtered = allConversations
    .filter((c: any) => {
      if (filter === "open")   return c.status === "open";
      if (filter === "closed") return c.status === "closed";
      return true;
    })
    .filter((c: any) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.member?.name?.toLowerCase().includes(q) ||
        c.subject?.toLowerCase().includes(q)
      );
    });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Global socket: new conversation notifications
  useEffect(() => {
    let mounted = true;
    getAdminSocket().then((s) => {
      if (!mounted) return;
      s.on("chat:conversation_new", ({ memberName, subject }: any) => {
        queryClient.invalidateQueries({ queryKey: ["admin", "conversations"] });
        toast(`New chat from ${memberName}: ${subject}`, { icon: "💬" });
      });
    });
    return () => {
      mounted = false;
      getAdminSocket().then((s) => s.off("chat:conversation_new"));
    };
  }, [queryClient]);

  // Per-conversation socket: messages + typing
  useEffect(() => {
    if (!activeId) return;
    let mounted = true;

    getAdminSocket().then((s) => {
      if (!mounted) return;
      s.emit("chat:join", { conversationId: activeId });

      s.on("chat:message", ({ conversationId }: any) => {
        if (conversationId !== activeId) return;
        queryClient.invalidateQueries({ queryKey: ["admin", "conversations", activeId, "messages"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "conversations"] });
      });

      s.on("chat:typing", ({ senderType, isTyping: t }: any) => {
        if (senderType !== "member") return;
        setIsTyping(t);
        if (t) setTypingName(activeConvo?.member?.name ?? "Member");
      });

      s.on("chat:conversation_closed", ({ conversationId: cid }: any) => {
        if (cid !== activeId) return;
        queryClient.invalidateQueries({ queryKey: ["admin", "conversations"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "conversations", activeId, "messages"] });
      });
    });

    return () => {
      mounted = false;
      getAdminSocket().then((s) => {
        s.emit("chat:leave", { conversationId: activeId });
        s.off("chat:message");
        s.off("chat:typing");
        s.off("chat:conversation_closed");
      });
    };
  }, [activeId, queryClient, activeConvo?.member?.name]);

  const handleInputChange = useCallback(async (value: string) => {
    setInput(value);
    if (!activeId) return;
    const s = await getAdminSocket();
    s.emit("chat:typing", { conversationId: activeId, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(async () => {
      const s2 = await getAdminSocket();
      s2.emit("chat:typing", { conversationId: activeId, isTyping: false });
    }, TYPING_DEBOUNCE_MS);
  }, [activeId]);

  const handleSend = async () => {
    if (!activeId || !input.trim()) return;
    const body = input.trim();
    setInput("");
    try {
      await sendMessage.mutateAsync({ conversationId: activeId, body });
      queryClient.invalidateQueries({ queryKey: ["admin", "conversations", activeId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "conversations"] });
    } catch {
      toast.error("Failed to send message");
    }
  };

  const handleClose = async () => {
    if (!activeId) return;
    try {
      await closeConvo.mutateAsync(activeId);
      queryClient.invalidateQueries({ queryKey: ["admin", "conversations", activeId, "messages"] });
      toast.success("Conversation closed");
    } catch {
      toast.error("Failed to close conversation");
    }
  };

  const TAB_CLS = (t: FilterTab) =>
    `px-3 py-1 rounded text-[11px] font-bold uppercase tracking-widest font-rajdhani transition-colors ${
      filter === t
        ? "bg-[#dc2626] text-white"
        : "text-[#606060] hover:text-[#a0a0a0]"
    }`;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-80px)]">

        {/* Page header */}
        <div className="flex gap-3 items-start mb-4">
          <div className="w-1 bg-[#dc2626] rounded-full min-h-[44px]" />
          <div>
            <h1 className="font-rajdhani text-2xl font-bold tracking-tight text-[#f0f0f0] uppercase">
              Direct Messages
            </h1>
            <p className="text-[12px] text-[#606060] font-medium uppercase tracking-[1px] font-rajdhani">
              Live chat with members
            </p>
          </div>
        </div>

        {/* Two-pane layout */}
        <div className="flex flex-1 min-h-0 border border-[#2a2a2a] rounded-xl overflow-hidden bg-[#181818]">

          {/* ── Left pane ──────────────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 border-r border-[#2a2a2a] flex flex-col bg-[#141414]">

            {/* Search */}
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-9 px-3 focus-within:border-[#dc2626] transition-all">
                <Search size={12} className="text-[#444] shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or subject..."
                  className="flex-1 bg-transparent text-[#f0f0f0] text-xs outline-none placeholder:text-[#444]"
                />
                {search && (
                  <button onClick={() => setSearch("")}>
                    <X size={11} className="text-[#444] hover:text-[#a0a0a0]" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 px-3 pb-2">
              <button className={TAB_CLS("all")}    onClick={() => setFilter("all")}>All</button>
              <button className={TAB_CLS("open")}   onClick={() => setFilter("open")}>Open</button>
              <button className={TAB_CLS("closed")} onClick={() => setFilter("closed")}>Closed</button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#222]">
              {convoLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin text-[#444]" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center">
                  <MessageSquare size={24} className="mx-auto mb-2 text-[#333]" />
                  <p className="text-[11px] text-[#606060]">No conversations</p>
                </div>
              ) : (
                filtered.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-white/[0.03] ${
                      activeId === c.id ? "bg-[#dc2626]/10 border-l-2 border-[#dc2626]" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[#f0f0f0] truncate leading-tight">
                        {c.member?.name ?? "Member"}
                      </p>
                      {c.adminUnreadCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-[#dc2626] flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#a0a0a0] truncate mt-0.5">{c.subject}</p>
                    {c.lastMessage && (
                      <p className="text-[11px] text-[#606060] truncate mt-0.5">
                        {c.lastMessage.senderType === "admin" ? "You: " : ""}
                        {c.lastMessage.body}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-[#444]">
                        {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true })}
                      </p>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-widest font-rajdhani px-1.5 py-0.5 rounded ${
                          c.status === "open"
                            ? "text-[#dc2626] bg-[#dc2626]/10"
                            : "text-[#444] bg-[#222]"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Right pane ─────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0">
            {activeId && activeMeta ? (
              <>
                {/* Thread header */}
                <div className="px-5 py-3 border-b border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#f0f0f0] truncate">{activeConvo?.member?.name ?? "Member"}</p>
                    <p className="text-[11px] text-[#606060] truncate">{activeMeta.subject}</p>
                  </div>
                  {activeMeta.status === "open" && (
                    <button
                      onClick={handleClose}
                      disabled={closeConvo.isPending}
                      className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest font-rajdhani text-[#606060] hover:text-[#dc2626] disabled:opacity-40 transition-colors"
                    >
                      {closeConvo.isPending
                        ? <Loader2 size={12} className="animate-spin" />
                        : <X size={12} />}
                      Close Chat
                    </button>
                  )}
                  {activeMeta.status === "closed" && (
                    <span className="flex-shrink-0 text-[11px] font-bold uppercase tracking-widest font-rajdhani text-[#444]">
                      Closed
                    </span>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-[#0f0f0f]">
                  {messages.map((m: any) => {
                    const isAdmin = m.senderType === "admin";
                    return (
                      <div key={m.id} className={`flex gap-2.5 ${isAdmin ? "flex-row-reverse" : ""}`}>
                        <div
                          className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                          style={{ background: isAdmin ? "#dc2626" : "#333" }}
                        >
                          {isAdmin ? "A" : (m.senderName?.[0]?.toUpperCase() ?? "M")}
                        </div>
                        <div
                          className={`max-w-[65%] rounded-2xl px-3.5 py-2.5 ${isAdmin ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                          style={{ background: isAdmin ? "rgba(220,38,38,0.15)" : "#1f1f1f" }}
                        >
                          <p className="text-[11px] font-semibold mb-1 text-[#a0a0a0]">
                            {isAdmin ? "You" : m.senderName}
                          </p>
                          <p className="text-sm text-[#f0f0f0] leading-relaxed">{m.body}</p>
                          <p className="text-[10px] text-[#444] mt-1 text-right">
                            {format(new Date(m.createdAt), "HH:mm")}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {isTyping && (
                    <p className="text-xs text-[#606060] pl-10 italic animate-pulse">
                      {typingName} is typing...
                    </p>
                  )}

                  {activeMeta.status === "closed" && (
                    <div className="flex items-center justify-center gap-2 py-3">
                      <AlertCircle size={13} className="text-[#444]" />
                      <p className="text-[11px] text-[#444] italic">This conversation is closed</p>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                {activeMeta.status === "open" ? (
                  <div className="px-4 py-3 border-t border-[#2a2a2a] bg-[#1a1a1a] flex items-end gap-2">
                    <textarea
                      value={input}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      rows={1}
                      placeholder="Type a reply..."
                      className="flex-1 resize-none bg-transparent text-sm text-[#f0f0f0] outline-none placeholder:text-[#444] leading-relaxed"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || sendMessage.isPending}
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[#dc2626] hover:bg-red-700 disabled:opacity-40 transition-colors"
                    >
                      {sendMessage.isPending
                        ? <Loader2 size={13} className="animate-spin text-white" />
                        : <Send size={13} className="text-white" />}
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-3 border-t border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-center">
                    <p className="text-[11px] text-[#444] font-rajdhani uppercase tracking-widest font-bold">
                      Conversation closed — read only
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-[#0f0f0f]">
                <MessageSquare size={36} className="mb-3 text-[#333]" />
                <p className="text-sm text-[#606060]">Select a conversation to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

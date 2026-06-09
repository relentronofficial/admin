"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@livekit/components-react";
import { Send, X, MessageSquare } from "lucide-react";

interface ChatPanelProps {
  onClose?: () => void;
  compact?: boolean;
}

export function ChatPanel({ onClose, compact = false }: ChatPanelProps) {
  const { chatMessages, send, isSending } = useChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    await send(text).catch(() => {});
  };

  return (
    <div
      className="flex flex-col"
      style={{
        height: compact ? 320 : "100%",
        background: "#181818",
        borderRadius: compact ? "0.75rem" : 0,
        border: compact ? "1px solid #2a2a2a" : undefined,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid #2a2a2a" }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={14} style={{ color: "#a0a0a0" }} />
          <span className="text-xs font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#a0a0a0" }}>
            Live Chat
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-[#2a2a2a] transition-colors">
            <X size={14} style={{ color: "#606060" }} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2" style={{ minHeight: 0 }}>
        {chatMessages.length === 0 && (
          <p className="text-center text-xs mt-8" style={{ color: "#606060" }}>
            No messages yet. Say hello!
          </p>
        )}
        {chatMessages.map((msg, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold" style={{ color: "#a0a0a0" }}>
              {msg.from?.name ?? msg.from?.identity ?? "Unknown"}
            </span>
            <p
              className="text-sm px-2.5 py-1.5 rounded-lg break-words"
              style={{ background: "#222", color: "#f0f0f0", maxWidth: "90%" }}
            >
              {msg.message}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 shrink-0"
        style={{ borderTop: "1px solid #2a2a2a" }}
      >
        <input
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: "#1a1a1a",
            border: "1px solid #333",
            color: "#f0f0f0",
          }}
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isSending}
          className="p-2 rounded-lg transition-colors flex items-center justify-center"
          style={{
            background: input.trim() ? "var(--color-accent)" : "#2a2a2a",
            color: input.trim() ? "#fff" : "#606060",
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

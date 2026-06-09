"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDataChannel } from "@livekit/components-react";

const EMOJIS = ["👏", "❤️", "😂", "🔥", "👍", "🎉", "🙏", "😮"];
const DATA_TOPIC = "reactions";

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
}

export function EmojiReactionOverlay() {
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);
  const counterRef = useRef(0);

  const addFloating = useCallback((emoji: string) => {
    const id = ++counterRef.current;
    const x = 10 + Math.random() * 80;
    setFloating((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloating((prev) => prev.filter((f) => f.id !== id)), 2800);
  }, []);

  const { send } = useDataChannel(DATA_TOPIC, (msg) => {
    try {
      const { emoji } = JSON.parse(new TextDecoder().decode(msg.payload));
      if (emoji) addFloating(emoji);
    } catch {}
  });

  const sendReaction = useCallback((emoji: string) => {
    addFloating(emoji);
    send(new TextEncoder().encode(JSON.stringify({ emoji })), { reliable: false });
  }, [addFloating, send]);

  return (
    <>
      {/* Floating emojis */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {floating.map((f) => (
          <div
            key={f.id}
            className="absolute bottom-16 text-2xl animate-float-up select-none"
            style={{ left: `${f.x}%` }}
          >
            {f.emoji}
          </div>
        ))}
      </div>

      {/* Reaction bar */}
      <div
        className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-3 py-1.5 rounded-2xl"
        style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="text-xl leading-none p-1 rounded-lg hover:bg-white/10 transition-colors active:scale-125"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-180px) scale(1.4); opacity: 0; }
        }
        .animate-float-up { animation: float-up 2.8s ease-out forwards; }
      `}</style>
    </>
  );
}

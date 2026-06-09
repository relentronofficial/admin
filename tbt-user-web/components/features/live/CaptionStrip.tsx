"use client";

import { useTranscriptions } from "@livekit/components-react";

export function CaptionStrip() {
  const transcriptions = useTranscriptions();

  // Show only the most recent segment
  const latest = transcriptions.at(-1) as any;
  if (!latest?.text) return null;

  return (
    <div
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 max-w-xl w-[90%] pointer-events-none"
    >
      <div
        className="px-4 py-2 rounded-lg text-center text-sm font-medium"
        style={{
          background: "rgba(0,0,0,0.75)",
          color: "#f0f0f0",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {latest.participantInfo && (
          <span className="text-[10px] font-bold mr-2" style={{ color: "#a0a0a0" }}>
            {latest.participantInfo.name ?? latest.participantInfo.identity ?? "Speaker"}:
          </span>
        )}
        {latest.text}
      </div>
    </div>
  );
}

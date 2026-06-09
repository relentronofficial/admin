"use client";

import { useIsRecording } from "@livekit/components-react";
import { Disc } from "lucide-react";

export function RecordingIndicator() {
  const isRecording = useIsRecording();
  if (!isRecording) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg z-40 pointer-events-none"
      style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(220,38,38,0.4)" }}
    >
      <Disc size={10} className="animate-pulse" style={{ color: "#dc2626" }} />
      <span className="text-[10px] font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#dc2626" }}>
        REC
      </span>
    </div>
  );
}

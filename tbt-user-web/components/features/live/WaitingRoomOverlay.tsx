"use client";

import { useEffect, useRef } from "react";
import { Clock, Loader2 } from "lucide-react";
import apiClient from "@/lib/api/client";

interface WaitingRoomOverlayProps {
  liveCallId: string;
  onAdmitted: () => void;
}

export function WaitingRoomOverlay({ liveCallId, onAdmitted }: WaitingRoomOverlayProps) {
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Poll the token endpoint — once we get status=joined the admin admitted us
    pollingRef.current = setInterval(async () => {
      try {
        const res: any = await apiClient.post(`/api/user/workshop/live-calls/${liveCallId}/token`);
        if (res?.data?.status === "joined") {
          clearInterval(pollingRef.current!);
          onAdmitted();
        }
      } catch {}
    }, 5000);

    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [liveCallId, onAdmitted]);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-40"
      style={{ background: "rgba(0,0,0,0.92)" }}
    >
      {/* Icon */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)" }}
      >
        <Clock size={28} style={{ color: "#dc2626" }} />
      </div>

      <div className="text-center space-y-2">
        <p className="text-white font-bold text-lg">Waiting Room</p>
        <p className="text-sm" style={{ color: "#a0a0a0" }}>
          The host will admit you shortly.
        </p>
      </div>

      <div className="flex items-center gap-2 mt-2" style={{ color: "#606060" }}>
        <Loader2 size={14} className="animate-spin" />
        <span className="text-xs">Checking for admission…</span>
      </div>
    </div>
  );
}

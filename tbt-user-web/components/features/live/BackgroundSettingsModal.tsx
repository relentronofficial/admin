"use client";

import { useState, useCallback } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { X, Loader2 } from "lucide-react";

type BgMode = "none" | "blur" | "virtual";

interface BackgroundSettingsModalProps {
  onClose: () => void;
}

export function BackgroundSettingsModal({ onClose }: BackgroundSettingsModalProps) {
  const { localParticipant } = useLocalParticipant();
  const [mode, setMode] = useState<BgMode>("none");
  const [applying, setApplying] = useState(false);
  const [noiseFilter, setNoiseFilter] = useState(false);

  const applyBackground = useCallback(async (newMode: BgMode) => {
    setApplying(true);
    setMode(newMode);
    try {
      const pub = localParticipant.getTrackPublication(Track.Source.Camera);
      const track = pub?.track;
      if (!track) return;

      if (newMode === "none") {
        await track.stopProcessor();
      } else if (newMode === "blur") {
        const { BackgroundBlur } = await import("@livekit/track-processors");
        await track.setProcessor(BackgroundBlur(15));
      } else if (newMode === "virtual") {
        const { VirtualBackground } = await import("@livekit/track-processors");
        await track.setProcessor(VirtualBackground("/backgrounds/office.jpg"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setApplying(false);
    }
  }, [localParticipant]);

  const toggleNoise = useCallback(async () => {
    // Noise suppression via @livekit/track-processors is not available in this version.
    // This toggle is a no-op placeholder until the package is updated.
    setNoiseFilter(v => !v);
  }, []);

  const BG_OPTIONS: { id: BgMode; label: string; preview: string }[] = [
    { id: "none", label: "None", preview: "bg-[#181818]" },
    { id: "blur", label: "Blur", preview: "bg-gradient-to-br from-[#1a1a2e] to-[#2a2a4a]" },
    { id: "virtual", label: "Office", preview: "bg-gradient-to-br from-[#1a3a2a] to-[#2a5a3a]" },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-5"
        style={{ background: "#141414", border: "1px solid #2a2a2a" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base" style={{ color: "#f0f0f0" }}>Visual & Audio Settings</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#2a2a2a] transition-colors">
            <X size={16} style={{ color: "#606060" }} />
          </button>
        </div>

        {/* Background */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest font-rajdhani" style={{ color: "#606060" }}>Background</p>
          <div className="flex gap-2">
            {BG_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => applyBackground(opt.id)}
                disabled={applying}
                className={`flex-1 h-16 rounded-xl relative overflow-hidden transition-all ${opt.preview}`}
                style={{
                  border: mode === opt.id ? "2px solid var(--color-accent)" : "2px solid #2a2a2a",
                }}
              >
                {applying && mode === opt.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 size={14} className="animate-spin text-white" />
                  </div>
                )}
                <span className="absolute bottom-1 w-full text-center text-[10px] font-bold text-white/70">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Noise suppression */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "#f0f0f0" }}>Noise Suppression</p>
            <p className="text-xs mt-0.5" style={{ color: "#606060" }}>Filter background noise from your mic</p>
          </div>
          <button
            onClick={toggleNoise}
            disabled={applying}
            className="relative w-11 h-6 rounded-full transition-colors"
            style={{ background: noiseFilter ? "var(--color-accent)" : "#333" }}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
              style={{ transform: noiseFilter ? "translateX(1.25rem)" : "translateX(0.125rem)" }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

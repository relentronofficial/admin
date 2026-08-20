"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Trash2 } from "lucide-react";

interface VoiceRecorderProps {
  disabled?: boolean;
  /**
   * Called with the recorded audio blob when the user releases the button.
   * The recorder handles the entire lifecycle (permission prompt → record
   * → stop) internally.
   */
  onRecorded: (blob: Blob, durationSeconds: number) => void;
  /**
   * Show a spinner instead of the mic when a previous recording is
   * still uploading. Prevents double-tap during upload.
   */
  uploading?: boolean;
}

/**
 * WhatsApp-style hold-to-record voice note button.
 *
 * Interaction:
 *   pointerdown → request mic permission → start MediaRecorder
 *   during hold → show floating "0:03 ● Recording" bar with slide-left-to-cancel
 *   pointerup   → stop recording and pass blob to onRecorded
 *   pointerleave/cancel-drag → discard recording
 *
 * We use `pointer` events (not touch/mouse separately) so a single
 * handler covers desktop + mobile. The MediaRecorder mime type is
 * negotiated at runtime — Chromium picks `audio/webm;codecs=opus`,
 * Safari picks `audio/mp4`. Either is acceptable to R2/Bunny.
 */
export function VoiceRecorder({ disabled, onRecorded, uploading }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointerDownXRef = useRef<number>(0);
  // Track whether the caller's onRecorded should fire on stop. Because
  // we use pointerleave to signal cancel, and MediaRecorder.onstop fires
  // asynchronously, we need a ref (not state) to read at the moment of
  // the actual stop event.
  const shouldEmitRef = useRef<boolean>(true);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const stopRecording = useCallback(
    (emit: boolean) => {
      shouldEmitRef.current = emit;
      const r = recorderRef.current;
      if (!r) {
        setRecording(false);
        cleanupStream();
        return;
      }
      if (r.state !== "inactive") {
        try {
          r.stop();
        } catch {
          /* already stopped */
        }
      }
      // The rest is finalised in the MediaRecorder.onstop handler set at
      // start time.
    },
    [cleanupStream],
  );

  const startRecording = useCallback(async () => {
    if (recording || uploading) return;
    setPermissionDenied(false);
    chunksRef.current = [];
    shouldEmitRef.current = true;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPermissionDenied(true);
      // Reset the visual state after 2s so users see the reason briefly
      // before the button becomes tappable again.
      setTimeout(() => setPermissionDenied(false), 2000);
      return;
    }

    streamRef.current = stream;

    // Prefer opus/webm; fall back to whatever the browser will accept.
    const preferred = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
    ];
    let mimeType: string | undefined;
    for (const mt of preferred) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mt)) {
        mimeType = mt;
        break;
      }
    }
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      clearTick();
      const emit = shouldEmitRef.current;
      const durationSec = Math.max(1, Math.round((Date.now() - startAtRef.current) / 1000));
      // Collect the recorded audio into a single blob. Use whatever
      // mime type the recorder was actually configured with (may
      // differ from what we requested on some browsers).
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      chunksRef.current = [];
      cleanupStream();
      recorderRef.current = null;
      setRecording(false);
      setSeconds(0);
      setCancelling(false);
      if (emit && blob.size > 0) onRecorded(blob, durationSec);
    };

    recorderRef.current = recorder;
    startAtRef.current = Date.now();
    recorder.start();
    setRecording(true);
    setSeconds(0);
    tickRef.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startAtRef.current) / 1000));
    }, 250);
  }, [cleanupStream, clearTick, onRecorded, recording, uploading]);

  useEffect(() => {
    return () => {
      // Component unmount — make sure the stream is released so the tab
      // isn't holding the microphone indefinitely.
      clearTick();
      cleanupStream();
      recorderRef.current = null;
    };
  }, [cleanupStream, clearTick]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || uploading) return;
    e.preventDefault();
    (e.target as HTMLButtonElement).setPointerCapture?.(e.pointerId);
    pointerDownXRef.current = e.clientX;
    void startRecording();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!recording) return;
    // Slide-left-to-cancel: 80 px of leftward drag flags the recording
    // as cancelled visually. Actual cancellation happens on pointerup.
    const dx = e.clientX - pointerDownXRef.current;
    setCancelling(dx < -80);
  };

  const onPointerUp = () => {
    if (!recording) return;
    stopRecording(!cancelling);
  };

  const onPointerCancel = () => {
    if (!recording) return;
    stopRecording(false);
  };

  const displaySeconds = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;

  return (
    <>
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerCancel}
        onPointerCancel={onPointerCancel}
        disabled={disabled || uploading}
        className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--color-surface-overlay)] disabled:opacity-40 flex-shrink-0 touch-none"
        aria-label="Hold to record voice note"
        title={permissionDenied ? "Microphone permission denied" : "Hold to record"}
      >
        {uploading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Mic size={16} className={recording ? "text-red-500" : undefined} />
        )}
      </button>

      {recording && (
        <div
          className="fixed inset-x-0 bottom-24 mx-auto max-w-md z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-full shadow-2xl"
          style={{
            background: "var(--color-modal-bg)",
            border: "1px solid var(--color-border-medium)",
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: cancelling ? "#6b7280" : "#ef4444" }}
            />
            <span
              className="text-sm font-semibold"
              style={{ color: cancelling ? "var(--color-text-secondary)" : "var(--color-text-normal)" }}
            >
              {displaySeconds}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {cancelling ? "Release to cancel" : "Slide left to cancel"}
            </span>
          </div>
          {cancelling ? (
            <Trash2 size={16} className="text-muted-foreground" />
          ) : (
            <Mic size={16} className="text-red-500" />
          )}
        </div>
      )}

      {permissionDenied && (
        <div
          className="fixed inset-x-0 bottom-24 mx-auto max-w-md z-50 text-center text-xs px-4 py-2 rounded-full"
          style={{
            background: "var(--color-modal-bg)",
            border: "1px solid var(--color-border-medium)",
            color: "var(--color-text-secondary)",
          }}
        >
          Microphone permission denied.
        </div>
      )}
    </>
  );
}

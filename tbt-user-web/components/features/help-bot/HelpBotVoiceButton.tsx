"use client";

/**
 * WhatsApp-style voice note for TBT Assistant: press and hold the mic to
 * record, release to send, slide left to cancel. The note is turned into text
 * on the server and asked like a typed question; the audio is not kept.
 * Keyboard: Enter or Space starts recording, pressing again sends it.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { transcribeHelpBotVoice } from "@/lib/api/services/helpBot.service";
import { VOICE_MAX_SECONDS, VoiceNoteError, startVoiceRecording, type VoiceRecording } from "@/lib/audio/voiceNote";
import type { T } from "./ActionCard";

const CANCEL_DRAG_PX = 90;
const MIN_HOLD_MS = 600;

type Phase = "idle" | "starting" | "recording" | "sending";

export function HelpBotVoiceButton({ t, disabled, onText, onError }: {
  t: T;
  disabled?: boolean;
  /** The transcript, ready to ask. */
  onText: (text: string) => void;
  /** A message to show, or null to clear. */
  onError: (message: string | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [drag, setDrag] = useState(0);
  const phaseRef = useRef<Phase>("idle");
  const recRef = useRef<VoiceRecording | null>(null);
  const startXRef = useRef(0);
  const startedAtRef = useRef(0);
  const releasedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // A function, so TypeScript doesn't narrow it across awaits.
  const current = (): Phase => phaseRef.current;
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const message = (code: VoiceNoteError["code"]) => ({
    unsupported: t("helpBotVoiceNoteUnsupported", "This browser can't record voice notes. Please type your question."),
    blocked: t("helpBotVoiceNoteBlocked", "Microphone access is blocked. Allow it in your browser's site settings and try again."),
    no_mic: t("helpBotVoiceNoteNoMic", "No microphone was found."),
    mic_busy: t("helpBotVoiceNoteMicBusy", "The microphone could not be started. Another app may be using it."),
    empty: t("helpBotVoiceNoteEmpty", "Nothing was recorded. Hold the mic a moment longer."),
    too_short: t("helpBotVoiceNoteShort", "Hold the mic to record, and release to send."),
    silent: t("helpBotVoiceNoteSilent", "No sound was recorded. Check your microphone."),
  })[code];

  function cancel(note?: string) {
    stopTimer();
    recRef.current?.cancel();
    recRef.current = null;
    setDrag(0);
    go("idle");
    if (note) onError(note);
  }

  async function start(clientX: number) {
    if (phaseRef.current !== "idle" || disabled) return;
    onError(null);
    releasedRef.current = false;
    startXRef.current = clientX;
    setDrag(0);
    setSeconds(0);
    go("starting");
    let rec: VoiceRecording;
    try {
      rec = await startVoiceRecording();
    } catch (e) {
      go("idle");
      onError(e instanceof VoiceNoteError ? message(e.code) : message("unsupported"));
      return;
    }
    // Let go (or cancelled) while the browser was still opening the microphone.
    if (releasedRef.current || current() !== "starting") {
      rec.cancel();
      if (current() === "starting") go("idle");
      if (releasedRef.current) onError(message("too_short"));
      return;
    }
    recRef.current = rec;
    startedAtRef.current = Date.now();
    go("recording");
    timerRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setSeconds(s);
      if (s >= VOICE_MAX_SECONDS) void send();
    }, 250);
  }

  async function send() {
    const rec = recRef.current;
    if (phaseRef.current !== "recording" || !rec) return;
    stopTimer();
    recRef.current = null;
    setDrag(0);
    if (Date.now() - startedAtRef.current < MIN_HOLD_MS) {
      rec.cancel();
      go("idle");
      onError(message("too_short"));
      return;
    }
    go("sending");
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const text = await transcribeHelpBotVoice(await rec.finish(), abort.signal);
      if (!abort.signal.aborted) onText(text);
    } catch (e) {
      if (abort.signal.aborted) return;
      onError(e instanceof VoiceNoteError ? message(e.code) : (e as Error)?.message || t("helpBotVoiceNoteFailed", "The voice note could not be understood. Please try again or type your question."));
    } finally {
      if (abortRef.current === abort) abortRef.current = null;
      if (current() === "sending") go("idle");
    }
  }

  // Closing the assistant mid-recording must release the microphone.
  useEffect(() => () => {
    stopTimer();
    recRef.current?.cancel();
    abortRef.current?.abort();
  }, []);

  const active = phase !== "idle";
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <>
      {active && (
        <div
          className="absolute inset-0 z-0 flex items-center gap-3 pl-4 pr-16 text-sm select-none"
          style={{ background: "var(--color-modal-bg)", borderTop: "1px solid var(--color-border-medium)" }}
          aria-live="polite"
        >
          {phase === "sending" ? (
            <span className="inline-flex items-center gap-2" style={{ color: "var(--color-text-secondary)" }}>
              <Loader2 size={15} className="animate-spin" /> {t("helpBotVoiceNoteSending", "Turning your voice into text…")}
            </span>
          ) : (
            <>
              <span className="h-2.5 w-2.5 rounded-full animate-pulse shrink-0" style={{ background: "var(--color-alert)" }} />
              <span className="tabular-nums font-medium" style={{ color: "var(--color-text-normal)" }}>{time}</span>
              <span
                className="flex-1 text-center truncate"
                style={{ color: "var(--color-text-secondary)", transform: `translateX(${Math.max(drag, -CANCEL_DRAG_PX)}px)`, opacity: 1 + Math.max(drag, -CANCEL_DRAG_PX) / (CANCEL_DRAG_PX * 1.5) }}
              >
                {phase === "starting" ? t("helpBotVoiceNoteStarting", "Starting microphone…") : `‹ ${t("helpBotVoiceNoteSlide", "Slide to cancel")}`}
              </span>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        disabled={disabled || phase === "sending"}
        aria-label={phase === "recording" ? t("helpBotVoiceNoteRelease", "Release to send") : t("helpBotVoiceNoteHold", "Hold to record a voice note")}
        title={t("helpBotVoiceNoteHold", "Hold to record a voice note")}
        aria-pressed={phase === "recording"}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          void start(e.clientX);
        }}
        onPointerMove={(e) => {
          if (phaseRef.current !== "recording" && phaseRef.current !== "starting") return;
          const dx = Math.min(0, e.clientX - startXRef.current);
          setDrag(dx);
          if (dx <= -CANCEL_DRAG_PX) {
            releasedRef.current = false;
            cancel(t("helpBotVoiceNoteCancelled", "Voice note cancelled."));
          }
        }}
        onPointerUp={() => {
          if (phaseRef.current === "starting") releasedRef.current = true;
          else void send();
        }}
        onPointerCancel={() => {
          if (phaseRef.current === "starting") releasedRef.current = true;
          else if (phaseRef.current === "recording") cancel();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          if (e.repeat) return;
          if (phaseRef.current === "idle") void start(0);
          else if (phaseRef.current === "recording") void send();
        }}
        className={`relative z-10 h-11 w-11 shrink-0 rounded-xl grid place-items-center disabled:opacity-40 transition-transform ${phase === "recording" ? "scale-125" : ""}`}
        style={{
          background: phase === "recording" ? "var(--color-alert)" : "var(--color-accent)",
          color: "#fff",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
      >
        {phase === "sending" || phase === "starting" ? <Loader2 size={16} className="animate-spin" /> : <Mic size={17} />}
      </button>
    </>
  );
}

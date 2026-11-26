// Voice-note recording for TBT Assistant: record in whatever format the
// browser offers (webm/opus on Chrome, mp4 on Safari), then convert to 16 kHz
// mono WAV, which the backend requires. Errors carry a code so the UI can show
// its own (uiStrings) wording.

export const VOICE_MAX_SECONDS = 60;
const RATE = 16_000;

export type VoiceNoteErrorCode = "unsupported" | "blocked" | "no_mic" | "mic_busy" | "empty" | "too_short" | "silent";

export class VoiceNoteError extends Error {
  constructor(public code: VoiceNoteErrorCode) {
    super(code);
  }
}

export interface VoiceRecording {
  /** Stops and returns base64 WAV. */
  finish: () => Promise<string>;
  /** Stops and discards. */
  cancel: () => void;
}

export async function startVoiceRecording(): Promise<VoiceRecording> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new VoiceNoteError("unsupported");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    const name = (e as Error)?.name;
    throw new VoiceNoteError(name === "NotAllowedError" ? "blocked" : name === "NotFoundError" ? "no_mic" : "mic_busy");
  }
  const release = () => stream.getTracks().forEach((t) => t.stop());
  let rec: MediaRecorder;
  const chunks: Blob[] = [];
  try {
    rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.start();
  } catch {
    release();
    throw new VoiceNoteError("unsupported");
  }
  const stopped = new Promise<void>((resolve) => rec.addEventListener("stop", () => resolve(), { once: true }));
  const stop = () => {
    if (rec.state !== "inactive") rec.stop();
  };
  return {
    cancel: () => {
      stop();
      release();
    },
    finish: async () => {
      stop();
      await stopped;
      release();
      return toWavBase64(new Blob(chunks, { type: rec.mimeType }));
    },
  };
}

async function toWavBase64(blob: Blob): Promise<string> {
  let decoded: AudioBuffer;
  const ctx = new AudioContext();
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new VoiceNoteError("empty");
  } finally {
    void ctx.close();
  }
  const seconds = Math.min(decoded.duration, VOICE_MAX_SECONDS);
  if (seconds < 0.5) throw new VoiceNoteError("too_short");
  const off = new OfflineAudioContext(1, Math.floor(seconds * RATE), RATE);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const samples = (await off.startRendering()).getChannelData(0);
  if (!samples.some((s) => Math.abs(s) > 0.01)) throw new VoiceNoteError("silent");

  const bytes = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(bytes.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s * 0x7fff, true);
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(bin);
}

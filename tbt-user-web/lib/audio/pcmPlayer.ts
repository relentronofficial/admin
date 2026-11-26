// Plays 16-bit mono PCM while it is still arriving.

const RATE = 24_000;

let shared: AudioContext | null = null;

/** Call from a click or key press: browsers only start sound after one. */
export function unlockAudio(): AudioContext {
  if (!shared || shared.state === "closed") shared = new AudioContext();
  void shared.resume();
  return shared;
}

/** Resolves when everything has been heard, or at once when aborted. */
export async function playPcm(body: ReadableStream<Uint8Array>, signal: AbortSignal, onStart: () => void): Promise<void> {
  const ctx = unlockAudio();
  const reader = body.getReader();
  const playing = new Set<AudioBufferSourceNode>();
  let at = 0;
  let odd: number | null = null;
  let finish: () => void = () => {};
  const stop = () => {
    void reader.cancel().catch(() => {});
    playing.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    playing.clear();
    finish();
  };
  signal.addEventListener("abort", stop);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done || signal.aborted) break;
      // A sample is two bytes and a chunk may end between them.
      const bytes: Uint8Array = new Uint8Array(value.length + (odd === null ? 0 : 1));
      if (odd !== null) bytes[0] = odd;
      bytes.set(value, odd === null ? 0 : 1);
      odd = bytes.length % 2 ? bytes[bytes.length - 1] : null;
      const n = bytes.length >> 1;
      if (!n) continue;
      const view = new DataView(bytes.buffer);
      const buf = ctx.createBuffer(1, n, RATE);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = view.getInt16(i * 2, true) / 32768;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      if (at === 0) onStart();
      // A small lead so a slow chunk doesn't leave a gap.
      at = Math.max(at, ctx.currentTime + 0.15);
      src.start(at);
      at += buf.duration;
      playing.add(src);
      src.onended = () => {
        playing.delete(src);
        if (!playing.size) finish();
      };
    }
    if (!signal.aborted && playing.size) await new Promise<void>((r) => (finish = r));
  } finally {
    signal.removeEventListener("abort", stop);
  }
}

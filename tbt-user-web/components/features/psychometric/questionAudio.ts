"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { psychometricService } from "@/lib/api/services/psychometric.service";
import type { AssessmentQuestion } from "@/lib/psychometric/assessmentFlow";
import { detectTanglish, hasTamilVoice, pickSpeech, tanglishToTamil } from "@/lib/psychometric/speech";

/**
 * One audio/speech player for the whole assessment, ported from the former
 * standalone page. Only one question can be live at a time (stopAll() is the
 * single choke point). Sources, in priority order:
 *   Tamil question with a spoken explanation → neural explanation mp3, else
 *     browser speech (Tanglish → Tamil script when a Tamil voice exists);
 *   otherwise → uploaded clip → cached neural mp3 → browser speech of the text.
 */
export type ButtonState = "play" | "pause" | "resume" | "replay" | "loading";

const TTS_RATE = 0.9;
const TTS_PITCH = 1.0;

class QuestionAudioPlayer {
  private questions = new Map<string, AssessmentQuestion>();
  private neuralUrls = new Map<string, string | "none">();
  private explanationUrls = new Map<string, string | "none">();
  private audio: HTMLAudioElement | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private ttsTick: ReturnType<typeof setInterval> | null = null;
  private activeQid: string | null = null;
  private activeMode: "audio" | "tts" | null = null;
  private activeState: "idle" | "playing" | "paused" | "ended" = "idle";
  private playToken = 0;
  private voices: SpeechSynthesisVoice[] = [];
  private buttons = new Map<string, ButtonState>();
  private errors = new Map<string, string>();
  private listeners = new Set<() => void>();
  private version = 0;
  readonly ttsOk = typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";

  constructor() {
    if (this.ttsOk) {
      const refresh = () => { try { this.voices = window.speechSynthesis.getVoices() || []; } catch { this.voices = []; } };
      refresh();
      try { window.speechSynthesis.onvoiceschanged = refresh; } catch { /* ignore */ }
    }
  }

  // ── store for React ─────────────────────────────────────────────────────
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  snapshot = () => this.version;
  private emit() { this.version++; this.listeners.forEach((f) => f()); }
  buttonOf = (qid: string): ButtonState => this.buttons.get(qid) ?? "play";
  errorOf = (qid: string) => this.errors.get(qid);
  private setButton(qid: string, s: ButtonState) { this.buttons.set(qid, s); this.emit(); }
  private showError(qid: string, msg = "Audio could not be played. Please try again.") { this.errors.set(qid, msg); this.emit(); }
  private hideError(qid: string) { if (this.errors.delete(qid)) this.emit(); }

  setQuestions(qs: AssessmentQuestion[]) { this.questions = new Map(qs.map((q) => [q._id, q])); }

  private allVoices() {
    if (this.voices.length) return this.voices;
    return this.ttsOk ? window.speechSynthesis.getVoices() || [] : [];
  }

  /** Stop and release any live playback and reset its button. */
  stopAll() {
    const prev = this.activeQid;
    if (this.ttsTick) { clearInterval(this.ttsTick); this.ttsTick = null; }
    if (this.audio) { const a = this.audio; this.audio = null; try { a.pause(); } catch { /* ignore */ } a.src = ""; }
    if (this.ttsOk) {
      // Cancel only when something is queued/speaking: an unconditional cancel()
      // right before speak() makes Chrome drop the new utterance.
      const ss = window.speechSynthesis;
      if (this.utterance || ss.speaking || ss.pending) { this.utterance = null; try { ss.cancel(); } catch { /* ignore */ } }
    }
    this.activeQid = null;
    this.activeMode = null;
    this.activeState = "idle";
    if (prev) this.setButton(prev, "play");
  }

  /** Invalidate in-flight audio fetches (navigation). */
  bumpToken() { this.playToken++; }

  private startAudio(qid: string, url: string) {
    const audio = new Audio(url);
    this.audio = audio;
    this.activeQid = qid;
    this.activeMode = "audio";
    this.activeState = "playing";
    // Guard on identity: stopping sets src='' which fires a spurious 'error'.
    audio.addEventListener("ended", () => { if (this.audio === audio) { this.activeState = "ended"; this.setButton(qid, "replay"); } });
    audio.addEventListener("error", () => {
      if (this.audio !== audio) return;
      this.audio = null; this.activeQid = null; this.activeMode = null; this.activeState = "idle";
      this.setButton(qid, "play"); this.showError(qid);
    });
    this.setButton(qid, "pause");
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(() => { if (this.audio === audio) { this.activeState = "idle"; this.setButton(qid, "play"); this.showError(qid); } });
  }

  private startTts(qid: string, rawText: string, forceLang: "en" | "ta") {
    const text = (rawText || "").trim();
    if (!this.ttsOk) { this.setButton(qid, "play"); this.showError(qid, "Audio is not supported in this browser."); return; }
    if (!text) { this.showError(qid, "No text to read."); return; }
    const ss = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    const { lang, voice } = pickSpeech(text, this.allVoices(), forceLang);
    u.lang = lang;
    if (voice) u.voice = voice;
    u.rate = TTS_RATE; u.pitch = TTS_PITCH; u.volume = 1;
    this.utterance = u; this.activeQid = qid; this.activeMode = "tts"; this.activeState = "playing";
    let started = false;
    const fail = (msg: string) => {
      if (this.utterance !== u) return;
      if (this.ttsTick) { clearInterval(this.ttsTick); this.ttsTick = null; }
      this.utterance = null; this.activeQid = null; this.activeMode = null; this.activeState = "idle";
      this.setButton(qid, "play"); this.showError(qid, msg);
    };
    u.onstart = () => { if (this.utterance === u) { started = true; this.activeState = "playing"; this.setButton(qid, "pause"); } };
    u.onend = () => {
      if (this.utterance !== u) return;
      if (this.ttsTick) { clearInterval(this.ttsTick); this.ttsTick = null; }
      this.utterance = null; this.activeMode = null; this.activeState = "ended"; this.setButton(qid, "replay");
    };
    u.onerror = () => fail("Speech could not be played on this device.");
    this.setButton(qid, "pause");
    const speak = () => {
      if (this.utterance !== u) return;
      try {
        ss.speak(u);
        if (ss.paused) ss.resume();
        // Keep-alive: Chrome auto-pauses long utterances after ~15 s.
        if (this.ttsTick) clearInterval(this.ttsTick);
        this.ttsTick = setInterval(() => {
          if (this.utterance === u && this.activeState === "playing" && ss.speaking && !ss.paused) { try { ss.resume(); } catch { /* ignore */ } }
          else if (this.utterance !== u && this.ttsTick) { clearInterval(this.ttsTick); this.ttsTick = null; }
        }, 8000);
      } catch { fail("Speech could not be played on this device."); }
    };
    if (ss.speaking || ss.pending) { try { ss.cancel(); } catch { /* ignore */ } setTimeout(speak, 90); } else speak();
    setTimeout(() => { if (this.utterance === u && !started && !ss.paused && !ss.speaking) fail("No speech voice is available on this device or browser."); }, 2500);
  }

  private async fetchCached(cache: Map<string, string | "none">, qid: string, kind: "audio" | "explanation-audio") {
    const known = cache.get(qid);
    if (known !== undefined) return known;
    try {
      const blob = await psychometricService.audio(qid, kind);
      const url = URL.createObjectURL(blob);
      cache.set(qid, url);
      return url;
    } catch {
      cache.set(qid, "none");
      return "none";
    }
  }

  /** Warm the cached neural audio for questions about to be shown. */
  prefetch(qs: AssessmentQuestion[]) {
    for (const q of qs) {
      if (q.neuralAudio && !this.neuralUrls.has(q._id)) void this.fetchCached(this.neuralUrls, q._id, "audio");
      if (q.neuralExplanationAudio && !this.explanationUrls.has(q._id)) void this.fetchCached(this.explanationUrls, q._id, "explanation-audio");
    }
  }

  private async start(qid: string) {
    this.stopAll();
    const token = ++this.playToken;
    this.hideError(qid);
    const q = this.questions.get(qid);
    if (!q) return;
    const lang = q.language === "ta" ? "ta" : "en";
    const explanation = (q.explanationAudioText || "").trim();
    // A spoken explanation is a Tamil helper — only for Tamil-language questions.
    if (explanation && lang === "ta") {
      if (q.neuralExplanationAudio) {
        if (!this.explanationUrls.has(qid)) this.setButton(qid, "loading");
        const url = await this.fetchCached(this.explanationUrls, qid, "explanation-audio");
        if (token !== this.playToken) return;
        if (url !== "none") { this.startAudio(qid, url); return; }
      }
      const tanglish = q.explanationIsTanglish || detectTanglish(explanation);
      this.startTts(qid, tanglish && hasTamilVoice(this.allVoices()) ? tanglishToTamil(explanation) : explanation, "ta");
      return;
    }
    if (q.hasAudio && q.audioUrl) { this.startAudio(qid, q.audioUrl); return; }
    if (q.neuralAudio) {
      if (!this.neuralUrls.has(qid)) this.setButton(qid, "loading");
      const url = await this.fetchCached(this.neuralUrls, qid, "audio");
      if (token !== this.playToken) return;
      if (url !== "none") { this.startAudio(qid, url); return; }
    }
    this.startTts(qid, q.text, lang);
  }

  /** Primary button: play / pause / resume / replay. */
  toggle(qid: string) {
    if (this.activeQid !== qid) return void this.start(qid);
    if (this.activeState === "playing") {
      if (this.activeMode === "audio" && this.audio) { try { this.audio.pause(); } catch { /* ignore */ } }
      else if (this.activeMode === "tts" && this.ttsOk) { try { window.speechSynthesis.pause(); } catch { /* ignore */ } }
      this.activeState = "paused";
      return this.setButton(qid, "resume");
    }
    if (this.activeState === "paused") {
      if (this.activeMode === "audio" && this.audio) {
        const p = this.audio.play();
        if (p && typeof p.catch === "function") p.catch(() => { this.setButton(qid, "play"); this.showError(qid); });
      } else if (this.activeMode === "tts" && this.ttsOk) { try { window.speechSynthesis.resume(); } catch { /* ignore */ } }
      this.activeState = "playing";
      return this.setButton(qid, "pause");
    }
    void this.start(qid);
  }

  stop(qid: string) { this.stopAll(); this.setButton(qid, "play"); }

  dispose() {
    this.stopAll();
    // Clear as well as revoke: React's dev double-mount reuses this player afterwards.
    for (const m of [this.neuralUrls, this.explanationUrls]) {
      for (const u of m.values()) if (u !== "none") URL.revokeObjectURL(u);
      m.clear();
    }
  }
}

/** The page's single player; re-renders subscribers when any button/error changes. */
export function useQuestionAudio() {
  const ref = useRef<QuestionAudioPlayer | null>(null);
  if (!ref.current && typeof window !== "undefined") ref.current = new QuestionAudioPlayer();
  const player = ref.current;
  useSyncExternalStore(player?.subscribe ?? (() => () => {}), player?.snapshot ?? (() => 0), () => 0);
  useEffect(() => {
    const stop = () => player?.stopAll();
    window.addEventListener("pagehide", stop);
    window.addEventListener("beforeunload", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("beforeunload", stop);
      player?.dispose();
    };
  }, [player]);
  return player;
}

export type QuestionAudio = QuestionAudioPlayer;

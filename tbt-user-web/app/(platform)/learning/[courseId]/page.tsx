"use client";

import React, { use, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Play, Loader2, X, Zap, Award,
  Lock, Trophy, ChevronDown, ChevronUp, Copy, Check,
  AlertTriangle, ExternalLink, Clock, TrendingUp, RotateCcw, SkipForward,
  Brain, RefreshCw, PenLine, Timer, Coins, Download, ClipboardList, FileText,
} from "lucide-react";
import { VideoPlayer } from "@/components/features/video/VideoPlayer";
import { PlyrPlayer } from "@/components/features/video/PlyrPlayer";
import type { PlyrPlayerHandle } from "@/components/features/video/PlyrPlayer";
import { PageLoader } from "@/components/common/LoadingSpinner";
import { useRegisterMedia, useSuppressAds } from "@/lib/ads/useRegisterMedia";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCourse, useLessonProgress, useMarkLessonComplete,
  useSubmitCourseQuiz, useCourseXp, useCertificateEligibility,
  useCourseLeaderboard, useRequestCourseAccess,
  useSaveReflection, useReflections,
  useEpisodeResources, useEpisodeTasks,
  type EpisodeResource, type EpisodeTask,
} from "@/lib/hooks/useCourses";
import { useSpendCoins } from "@/lib/hooks/useBatchProgram";
import { useMe } from "@/lib/hooks/useUser";
import { getSocket } from "@/lib/socket/client";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { normalizeBunnyUrl, withResumeTime } from "@/lib/utils/format";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils/cn";
import { VideoWatermark } from "@/components/features/video/VideoWatermark";
import { FeedbackModal } from "@/components/features/video/FeedbackModal";
import { useVideoFeedbackQuestions } from "@/lib/hooks/useVideoFeedback";
import type { Lesson } from "@/types";

type WatchState = "not_started" | "watching" | "paused" | "completed";

function isBunnyEmbed(url: string) {
  return url.includes("mediadelivery.net");
}

// Unified "lesson already done" check used in every place resumeAtSeconds is decided.
// Three signals, any one is sufficient:
//   1. completedIds (from progress query) — authoritative DB state
//   2. lesson.isCompleted (from course query) — may be stale but usually correct
//   3. durationSeconds threshold — 85% of stored duration
// NOTE: there is intentionally NO position proximity heuristic — it was removed because
// |resumeAtSeconds - actualWatchedSecs| < 5 caused false positives for partially-watched lessons.
function lessonAlreadyDone(
  lessonId: string,
  completedIds: Set<string>,
  isCompleted: boolean | null | undefined,
  durationSeconds: number | null | undefined,
  actualWatchedSecs: number | null | undefined,
  resumeAtSeconds: number | null | undefined,
): boolean {
  if (completedIds.has(lessonId) || !!isCompleted) return true;
  const dur = durationSeconds ?? 0;
  const watched = actualWatchedSecs ?? 0;
  const resume = resumeAtSeconds ?? 0;
  if (dur > 0 && watched >= dur * 0.85) return true;
  return false;
}

function fmtTime(secs: number): string {
  return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;
}

function fmtDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

interface SelectedLesson {
  id: string;
  title: string;
  description?: string | null;
  videoUrl: string;
  hlsUrl?: string | null;
  durationSeconds: number;
  resumeAtSeconds?: number;
  actualWatchedSecs?: number;
  isCompleted?: boolean;
  sectionId?: string | null;
}

// ── Practice Arena Modal (Retrieval Practice + Interleaving) ─────────────────
// Science: Testing yourself on mixed material from all lessons is more effective
// than re-watching. Each retrieval attempt strengthens the memory trace.
// (Roediger & Karpicke, 2006; Kornell & Bjork, 2008)
// Only pulls questions from lessons the member has already completed — showing
// questions from unseen lessons spoils content and confuses learners.
function PracticeArenaModal({ course, completedIds, onClose }: { course: any; completedIds: Set<string>; onClose: () => void }) {
  const questions = useMemo<Array<{ q: any; lessonTitle: string }>>(() => {
    const qs: Array<{ q: any; lessonTitle: string }> = [];
    for (const lesson of course?.lessons ?? []) {
      if (!completedIds.has(lesson.id)) continue;
      const qd = (lesson as any).quizData;
      if (!qd?.questions?.length) continue;
      for (const q of qd.questions) {
        qs.push({ q, lessonTitle: lesson.title });
      }
    }
    const arr = [...qs];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [course, completedIds]);

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-2xl p-8 text-center space-y-4 shadow-2xl"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-medium)" }}
        >
          <Brain size={40} className="mx-auto" style={{ color: "var(--color-text-disabled)" }} />
          <p className="text-foreground font-semibold">No quiz questions yet</p>
          <p className="text-sm" style={{ color: "var(--color-text-subtle)" }}>
            Complete lessons that have quizzes to unlock the Practice Arena. The more lessons you finish, the richer the practice session.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: "var(--color-accent)" }}
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  const current = questions[idx];
  const correctOption = current.q.options?.find((o: any) => o.correct);

  const handleSelect = (optId: string) => { if (!revealed) setSelected(optId); };

  const handleReveal = () => {
    if (!selected) return;
    setRevealed(true);
    if (selected === correctOption?.id) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (idx + 1 >= questions.length) { setDone(true); }
    else { setIdx((i) => i + 1); setSelected(null); setRevealed(false); }
  };

  const pct = Math.round((score / questions.length) * 100);

  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-medium)" }}
        >
          <div className="px-6 py-5 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>Practice Complete</p>
          </div>
          <div className="p-6 text-center space-y-4">
            <div className="text-5xl font-bold" style={{ color: pct >= (course?.passingScorePercent ?? 70) ? "var(--color-success)" : "var(--color-accent)" }}>
              {pct}%
            </div>
            <p className="font-semibold text-foreground">{score} / {questions.length} correct</p>
            <div
              className="flex items-start gap-2 px-3 py-3 rounded-lg text-xs text-left"
              style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-subtle)" }}
            >
              <Brain size={13} className="shrink-0 mt-0.5" />
              <span>Each retrieval attempt strengthens the memory trace — even getting an answer wrong helps. Come back tomorrow for another round. <em>(Roediger & Karpicke, 2006)</em></span>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setIdx(0); setScore(0); setSelected(null); setRevealed(false); setDone(false); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-opacity hover:opacity-80"
                style={{ borderColor: "var(--color-border-strong)", color: "var(--color-text-normal)" }}
              >
                Practice Again
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--color-accent)" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-medium)" }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--color-border-subtle)" }}>
          <div>
            <div className="flex items-center gap-2">
              <Brain size={13} style={{ color: "var(--color-accent)" }} />
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>
                Practice Arena
              </p>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--color-surface-overlay-md)", color: "var(--color-text-subtle)" }}>
                Retrieval Practice
              </span>
            </div>
            <p className="text-[11px] mt-0.5 truncate max-w-xs" style={{ color: "var(--color-text-subtle)" }}>
              {current.lessonTitle}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-bold" style={{ color: "var(--color-text-subtle)" }}>{idx + 1}/{questions.length}</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="h-1" style={{ background: "var(--color-surface-overlay-md)" }}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${((idx) / questions.length) * 100}%`, background: "var(--color-accent)" }}
          />
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm font-semibold text-foreground leading-snug">{current.q.question}</p>
          <div className="space-y-2">
            {current.q.options?.map((opt: any) => {
              let bg = "transparent";
              let borderColor = "var(--color-border-medium)";
              let color = "var(--color-text-normal)";
              if (revealed) {
                if (opt.correct) { bg = "color-mix(in srgb, var(--color-success) 18%, transparent)"; borderColor = "var(--color-success)"; color = "var(--color-text-strong)"; }
                else if (opt.id === selected) { bg = "color-mix(in srgb, var(--color-accent) 15%, transparent)"; borderColor = "var(--color-accent)"; color = "var(--color-text-normal)"; }
              } else if (selected === opt.id) {
                borderColor = "var(--color-accent)"; bg = "color-mix(in srgb, var(--color-accent) 15%, transparent)"; color = "var(--color-text-strong)";
              }
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelect(opt.id)}
                  className="w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all border"
                  style={{ background: bg, borderColor, color }}
                >
                  {opt.text}
                </button>
              );
            })}
          </div>
          {!revealed ? (
            <button
              onClick={handleReveal}
              disabled={!selected}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
              style={{ background: "var(--color-accent)" }}
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--color-accent)" }}
            >
              {idx + 1 >= questions.length ? "See Results" : "Next →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reflection Modal (Elaborative Interrogation) ──────────────────────────────
// Science: Generating explanations in your own words improves comprehension and
// long-term retention by ~40% vs. passive review.
// (Pressley, McDaniel, Turnure, Wood & Ahmad, 1987)
function ReflectionModal({ lessonId, lessonTitle, courseId, onClose }: {
  lessonId: string; lessonTitle: string; courseId: string; onClose: (saved?: boolean) => void;
}) {
  const { uiStrings } = useSiteConfig();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const saveReflection = useSaveReflection(courseId);

  const title        = uiStrings?.reflectTitle        ?? "Reflect & Retain";
  const prefix       = uiStrings?.reflectPromptPrefix ?? "What's one thing from";
  const suffix       = uiStrings?.reflectPromptSuffix ?? "you'll actually apply?";
  const placeholder  = uiStrings?.reflectPlaceholder  ?? "Write in your own words — 2-3 sentences is enough…";
  const skipLabel    = uiStrings?.reflectSkipLabel    ?? "Skip";
  const saveLabel    = uiStrings?.reflectSaveLabel    ?? "Save Reflection";
  const savedLabel   = uiStrings?.reflectSavedLabel   ?? "✓ Saved!";

  const handleSave = () => {
    try {
      const all = JSON.parse(localStorage.getItem("tbt_reflections") || "{}");
      all[`${courseId}:${lessonId}`] = { text, savedAt: Date.now(), lessonTitle };
      localStorage.setItem("tbt_reflections", JSON.stringify(all));
    } catch {}
    saveReflection.mutate({ lessonId, text });
    setSaved(true);
    setTimeout(() => onClose(true), 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-medium)" }}
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
          <div className="flex items-center gap-2 mb-1">
            <PenLine size={13} style={{ color: "var(--color-accent)" }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>{title}</p>
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">
            {prefix} <span className="italic" style={{ color: "var(--color-text-normal)" }}>"{lessonTitle}"</span> {suffix}
          </p>
        </div>
        <div className="p-5 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            autoFocus
            rows={4}
            className="w-full rounded-xl p-3.5 text-sm text-foreground resize-none outline-none placeholder:opacity-40"
            style={{
              background: "var(--color-surface-overlay)",
              border: "1px solid var(--color-border-medium)",
            }}
          />
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
            style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-subtle)" }}
          >
            <Brain size={13} className="shrink-0 mt-0.5" />
            <span>
              Explaining concepts in your own words (Elaborative Interrogation) boosts retention by ~40% compared to re-watching.{" "}
              <em>Pressley et al., 1992</em>
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onClose(false)}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-opacity hover:opacity-80"
              style={{ borderColor: "var(--color-border-medium)", color: "var(--color-text-subtle)" }}
            >
              {skipLabel}
            </button>
            <button
              onClick={handleSave}
              disabled={!text.trim() || saved}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ background: saved ? "var(--color-success)" : "var(--color-accent)" }}
            >
              {saved ? savedLabel : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reflections Viewer Modal ──────────────────────────────────────────────────
function ReflectionsViewerModal({ reflections, lessons, onClose }: {
  reflections: Array<{ lessonId: string; text: string; savedAt: string }>;
  lessons: any[];
  onClose: () => void;
}) {
  const lessonMap = new Map(lessons.map((l: any) => [l.id, l.title]));
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-medium)", maxHeight: "80vh" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--color-border-subtle)" }}>
          <div className="flex items-center gap-2">
            <PenLine size={14} style={{ color: "var(--color-accent)" }} />
            <p className="text-sm font-bold text-foreground">My Reflections</p>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)" }}>
              {reflections.length}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70 transition-opacity">
            <X size={16} style={{ color: "var(--color-text-subtle)" }} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 divide-y" style={{ borderColor: "var(--color-border-subtle)" }}>
          {reflections.map((r) => (
            <div key={r.lessonId} className="px-6 py-4">
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-accent)" }}>
                {lessonMap.get(r.lessonId) ?? "Lesson"}
              </p>
              <p className="text-sm text-foreground leading-relaxed">{r.text}</p>
              <p className="text-xs mt-1.5" style={{ color: "var(--color-text-disabled)" }}>
                {new Date(r.savedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Mid-Video Cue Quiz Modal ──────────────────────────────────────────────────
// Science: Interleaved testing during learning improves retention more than
// end-of-lesson testing alone. (Kornell & Bjork, 2008; Roediger et al., 2011)
function CueQuizModal({ questions, onClose }: { questions: any[]; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);

  const allAnswered = questions.length > 0 && questions.every((q: any) => answers[q.id]);
  const correctCount = revealed
    ? questions.filter((q: any) => answers[q.id] === q.options?.find((o: any) => o.correct)?.id).length
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/88 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-medium)" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: "var(--color-border-subtle)" }}>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: "color-mix(in srgb, var(--color-alert) 15%, transparent)", color: "var(--color-alert)" }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Video paused
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>Quick Check</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-subtle)" }}>Answer to continue watching</p>
          </div>
        </div>

        {/* Questions */}
        <div className="p-5 space-y-5 max-h-[55vh] overflow-y-auto">
          {questions.map((q: any, qi: number) => (
            <div key={q.id}>
              <p className="text-sm font-semibold text-foreground leading-snug mb-3">{qi + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options?.map((opt: any) => {
                  let bg = "transparent";
                  let borderColor = "var(--color-border-medium)";
                  let color = "var(--color-text-normal)";
                  if (revealed) {
                    if (opt.correct) { bg = "color-mix(in srgb, var(--color-success) 15%, transparent)"; borderColor = "var(--color-success)"; color = "var(--color-text-strong)"; }
                    else if (opt.id === answers[q.id]) { bg = "color-mix(in srgb, var(--color-accent) 12%, transparent)"; borderColor = "var(--color-accent)"; }
                  } else if (answers[q.id] === opt.id) {
                    bg = "color-mix(in srgb, var(--color-accent) 15%, transparent)"; borderColor = "var(--color-accent)"; color = "var(--color-text-strong)";
                  }
                  return (
                    <button
                      key={opt.id}
                      onClick={() => !revealed && setAnswers(prev => ({ ...prev, [q.id]: opt.id }))}
                      className="w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all"
                      style={{ background: bg, borderColor, color }}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2">
          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              disabled={!allAnswered}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
              style={{ background: "var(--color-accent)" }}
            >
              Check Answers
            </button>
          ) : (
            <div className="space-y-3">
              <div className="text-center py-1">
                <p className="text-2xl font-bold" style={{ color: correctCount === questions.length ? "var(--color-success)" : "var(--color-accent)" }}>
                  {correctCount}/{questions.length}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle)" }}>correct</p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--color-accent)" }}
              >
                Continue Watching →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Instructor Card ───────────────────────────────────────────────────────────
function InstructorCard({ instructor }: { instructor: { fullName: string; designation?: string | null; profilePhotoUrl?: string | null } }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      {instructor.profilePhotoUrl ? (
        <img src={instructor.profilePhotoUrl} alt={instructor.fullName} className="w-10 h-10 rounded-full object-cover shrink-0" />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-foreground"
          style={{ background: "color-mix(in srgb, var(--color-accent) 25%, var(--color-surface-overlay-md))" }}
        >
          {instructor.fullName[0]}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>Instructor</p>
        <p className="text-sm font-semibold text-foreground truncate">{instructor.fullName}</p>
        {instructor.designation && (
          <p className="text-xs truncate" style={{ color: "var(--color-text-subtle)" }}>{instructor.designation}</p>
        )}
      </div>
    </div>
  );
}

// ── Access Expiry Warning ─────────────────────────────────────────────────────
function ExpiryWarning({ expiresAt }: { expiresAt: string }) {
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft > 7) return null;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
      style={{
        background: "color-mix(in srgb, var(--color-alert) 12%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-alert) 30%, transparent)",
      }}
    >
      <AlertTriangle size={16} style={{ color: "var(--color-alert)", flexShrink: 0 }} />
      <p className="text-foreground">
        Your access expires in{" "}
        <strong>{daysLeft <= 0 ? "less than a day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}</strong>. Complete it before it expires!
      </p>
    </div>
  );
}

// ── XP + Streak Widget ────────────────────────────────────────────────────────
function XpStreakWidget({ courseId }: { courseId: string }) {
  const { data: xp, isLoading } = useCourseXp(courseId);
  const hasActivity = xp && (xp.totalXp > 0 || xp.currentStreak > 0);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--color-border-subtle)" }}>
        <Zap size={13} style={{ color: "var(--color-accent)" }} />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>Your Stats</span>
      </div>
      <div className="p-3 grid grid-cols-3 gap-3">
        {[
          { label: "Total XP", value: isLoading ? "—" : (xp?.totalXp ?? 0), icon: <Zap size={16} />, accent: true },
          { label: "Streak", value: isLoading ? "—" : `${xp?.currentStreak ?? 0}d`, icon: <TrendingUp size={16} />, accent: false },
          { label: "Best", value: isLoading ? "—" : `${xp?.longestStreak ?? 0}d`, icon: <Trophy size={16} />, accent: false },
        ].map(({ label, value, icon, accent }) => (
          <div
            key={label}
            className="rounded-xl p-3 text-center"
            style={{ background: "var(--color-surface-overlay)" }}
          >
            <div className="flex justify-center mb-1" style={{ color: accent ? "var(--color-accent)" : "var(--color-text-subtle)" }}>
              {icon}
            </div>
            <p className="text-base font-bold text-foreground">{value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle)" }}>{label}</p>
          </div>
        ))}
      </div>
      {!hasActivity && !isLoading && (
        <p className="text-xs text-center pb-3 px-4" style={{ color: "var(--color-text-disabled)" }}>
          Complete lessons to start earning XP and building your streak!
        </p>
      )}
    </div>
  );
}

// ── Leaderboard Widget ────────────────────────────────────────────────────────
function LeaderboardWidget({ courseId }: { courseId: string }) {
  const { data: lb } = useCourseLeaderboard(courseId);
  const [open, setOpen] = useState(true);
  const top5 = lb?.leaderboard?.slice(0, 5) ?? [];
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <Trophy size={15} style={{ color: "var(--color-accent)" }} />
          Leaderboard
          {lb?.myRank && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-bold"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              #{lb.myRank}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp size={14} style={{ color: "var(--color-text-subtle)" }} />
          : <ChevronDown size={14} style={{ color: "var(--color-text-subtle)" }} />}
      </button>
      {open && (
        <div className="border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
          {top5.length === 0 ? (
            <div className="py-6 text-center space-y-1">
              <Trophy size={22} className="mx-auto text-muted-foreground opacity-20" />
              <p className="text-xs mt-2" style={{ color: "var(--color-text-subtle)" }}>
                No one has earned XP yet — be the first!
              </p>
            </div>
          ) : (
            top5.map((entry: any, i: number) => {
              const isMe = !!entry.isMe;
              const name = entry.member
                ? [entry.member.firstName, entry.member.lastName].filter(Boolean).join(" ") || "Member"
                : "Member";
              return (
                <div
                  key={entry.memberId ?? i}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm border-b last:border-b-0"
                  style={{
                    borderColor: "var(--color-border-subtle)",
                    background: isMe ? "color-mix(in srgb, var(--color-accent) 10%, transparent)" : "transparent",
                  }}
                >
                  <span
                    className="w-5 text-xs font-bold text-center shrink-0"
                    style={{ color: i < 3 ? "var(--color-accent)" : "var(--color-text-subtle)" }}
                  >
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <span className="flex-1 truncate" style={{ color: isMe ? "var(--color-accent)" : "var(--color-text-normal)" }}>
                    {name}
                    {isMe && <span className="ml-1 text-[10px]" style={{ color: "var(--color-accent)" }}>(you)</span>}
                  </span>
                  <span className="text-xs font-bold flex items-center gap-1" style={{ color: "var(--color-accent)" }}>
                    <Zap size={11} />{entry.totalXp ?? 0}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Related Courses ───────────────────────────────────────────────────────────
function RelatedCourses({ courses, title }: { courses: any[]; title: string }) {
  if (!courses?.length) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-foreground mb-3">{title}</p>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {courses.map((c: any) => (
          <a
            key={c.id}
            href={`/learning/${c.id}`}
            className="shrink-0 w-48 rounded-xl overflow-hidden group"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
          >
            <div className="aspect-video relative overflow-hidden">
              {c.thumbnailUrl ? (
                <img
                  src={c.thumbnailUrl}
                  alt={c.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--color-surface-overlay)" }}>
                  <Play size={20} style={{ color: "var(--color-accent)" }} />
                </div>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{c.title}</p>
              {c.price != null && Number(c.price) > 0 && (
                <p className="text-xs mt-1 font-semibold" style={{ color: "var(--color-accent)" }}>
                  ₹{Number(c.price).toLocaleString("en-IN")}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Paywall View ──────────────────────────────────────────────────────────────
function PaywallView({ course: courseRaw, courseId }: { course: any; courseId: string }) {
  const course = courseRaw as any;
  const requestAccess = useRequestCourseAccess();
  const lessons = course.lessons ?? [];

  const handleGetAccess = async () => {
    if (course.paymentLinkUrl) {
      window.open(course.paymentLinkUrl, "_blank");
      return;
    }
    try {
      const res = await requestAccess.mutateAsync(courseId);
      const { paymentUrl } = (res as any).data ?? res;
      if (paymentUrl) window.open(paymentUrl, "_blank");
      else toast.success("Access request sent! We'll notify you shortly.");
    } catch (e: any) {
      toast.error(e.message || "Failed to request access.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div
        className="relative w-full aspect-video rounded-xl overflow-hidden"
        style={{ background: "var(--color-bg-surface)" }}
      >
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Lock size={48} style={{ color: "var(--color-text-disabled)" }} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6">
          <h1 className="text-2xl font-bold leading-tight overlay-text">{course.title}</h1>
          {course.description && (
            <p className="text-sm mt-1 line-clamp-2 overlay-meta">
              {course.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-3">
            {course.level && (
              <span
                className="text-xs capitalize px-2.5 py-1 rounded-full font-medium overlay-meta"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
              >
                {course.level}
              </span>
            )}
            {lessons.length > 0 && (
              <span className="text-xs overlay-meta">
                {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Instructor */}
      {course.instructor && <InstructorCard instructor={course.instructor} />}

      {/* Purchase CTA */}
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-medium)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>
              Get Access
            </p>
            {course.price != null && Number(course.price) > 0 ? (
              <p className="text-3xl font-bold text-foreground mt-1">
                ₹{Number(course.price).toLocaleString("en-IN")}
              </p>
            ) : (
              <p className="text-lg font-semibold text-foreground mt-1">Contact us for pricing</p>
            )}
            {course.accessType === "lifetime" ? (
              <p className="text-xs mt-1" style={{ color: "var(--color-text-subtle)" }}>Lifetime access</p>
            ) : course.accessDurationDays ? (
              <p className="text-xs mt-1" style={{ color: "var(--color-text-subtle)" }}>
                {course.accessDurationDays}-day access
              </p>
            ) : null}
          </div>
          <Lock size={32} style={{ color: "var(--color-text-disabled)", flexShrink: 0 }} />
        </div>

        {course.pendingPayment ? (
          <div className="space-y-3">
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
              style={{
                background: "color-mix(in srgb, var(--color-alert) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-alert) 25%, transparent)",
              }}
            >
              <Loader2 size={14} style={{ color: "var(--color-alert)" }} className="animate-spin" />
              <span style={{ color: "var(--color-text-normal)" }}>Payment pending — awaiting confirmation</span>
            </div>
            {course.pendingPayment.paymentUrl && (
              <button
                onClick={() => window.open(course.pendingPayment.paymentUrl, "_blank")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ border: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)", color: "var(--color-accent)" }}
              >
                <ExternalLink size={14} /> Complete Payment
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={handleGetAccess}
            disabled={requestAccess.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--color-accent)" }}
          >
            {requestAccess.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Processing...</>
            ) : (
              <>{course.paymentLinkUrl ? <ExternalLink size={14} /> : <Lock size={14} />} Get Access</>
            )}
          </button>
        )}
      </div>

      {/* Locked lesson preview */}
      {lessons.length > 0 && (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--color-border-subtle)" }}>
          <div
            className="px-4 py-3 border-b text-sm font-semibold"
            style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-bg-surface)", color: "var(--color-text-normal)" }}
          >
            {lessons.length} {lessons.length === 1 ? "Lesson" : "Lessons"} — Preview
          </div>
          <div>
            {(() => {
              const previewSections: any[] = course.sections ?? [];
              let lastSectionId: string | null = null;
              return lessons.map((lesson: any, idx: number) => {
                const sid = previewSections.length > 0 ? ((lesson as any).sectionId ?? null) : null;
                const showHeader = previewSections.length > 0 && sid !== lastSectionId;
                const sec = sid ? previewSections.find((s: any) => s.id === sid) : null;
                lastSectionId = sid;
                return (
                  <React.Fragment key={lesson.id}>
                    {showHeader && (
                      <div className="px-4 py-2 border-b text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--color-text-subtle)", background: "var(--color-bg-surface)", borderColor: "var(--color-border-subtle)" }}>
                        {sec?.title ?? "General"}
                      </div>
                    )}
                    <div
                      className="flex items-center gap-4 px-4 py-4 border-b last:border-b-0"
                      style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-bg-surface)" }}
                    >
                      <span
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: "var(--color-surface-overlay-md)", color: "var(--color-text-disabled)" }}
                      >
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-normal)" }}>
                          {lesson.title}
                        </p>
                        {lesson.durationSeconds > 0 && (
                          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--color-text-disabled)" }}>
                            <Clock size={10} /> {fmtDuration(lesson.durationSeconds)}
                          </p>
                        )}
                      </div>
                      <Lock size={13} style={{ color: "var(--color-text-disabled)", flexShrink: 0 }} />
                    </div>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Upsell */}
      {course.upsellCourses?.length > 0 && (
        <RelatedCourses courses={course.upsellCourses} title="You might also like" />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const courseIdRef = useRef(courseId);
  courseIdRef.current = courseId;
  const searchParams = useSearchParams();
  const targetLessonId = searchParams.get("lesson");
  const { uiStrings, config } = useSiteConfig();
  const qc = useQueryClient();
  const { data: course, isLoading } = useCourse(courseId);
  const { data: progressList } = useLessonProgress(courseId);
  const markComplete = useMarkLessonComplete(courseId);
  const { data: me } = useMe();

  // Real-time: when admin grants course access, invalidate so PaywallView disappears
  useEffect(() => {
    if (!courseId) return;
    let mounted = true;
    getSocket().then((socket) => {
      if (!mounted) return;
      const onAccessGranted = ({ courseId: grantedId }: { courseId: string }) => {
        if (grantedId !== courseId) return;
        void qc.invalidateQueries({ queryKey: ["courses", courseId] });
        void qc.invalidateQueries({ queryKey: ["user", "progress", courseId] });
      };
      socket.on("course:access_granted", onAccessGranted);
      return () => { socket.off("course:access_granted", onAccessGranted); };
    });
    return () => { mounted = false; };
  }, [courseId, qc]);

  const [selectedLesson, setSelectedLesson] = useState<SelectedLesson | null>(null);
  const [watchState, setWatchState] = useState<WatchState>("not_started");
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [liveWatched, setLiveWatched] = useState<number>(0);
  const [liveRealDuration, setLiveRealDuration] = useState<number>(0);
  const [hlsFailed, setHlsFailed] = useState(false);
  const [upNextCountdown, setUpNextCountdown] = useState<number | null>(null);
  const [upNextVisible, setUpNextVisible] = useState(false);
  const [videoKey, setVideoKey] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = parseFloat(localStorage.getItem("tbt_speed") ?? "1");
      return [0.5, 0.75, 1, 1.25, 1.5, 2].includes(saved) ? saved : 1;
    }
    return 1;
  });
  const [quizHintShown, setQuizHintShown] = useState(false);
  const topRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<PlyrPlayerHandle | null>(null);
  const [certCopied, setCertCopied] = useState(false);

  // Quiz modal state
  const [quizModal, setQuizModal] = useState<{ episodeId: string; questions: any[] } | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [xpFlash, setXpFlash] = useState<number | null>(null);
  const [downloadingCert, setDownloadingCert] = useState(false);
  const submitQuiz = useSubmitCourseQuiz(courseId, quizModal?.episodeId ?? "");
  const { data: certData } = useCertificateEligibility(courseId);
  const { data: episodeResources = [] } = useEpisodeResources(selectedLesson?.id);
  const { data: episodeTasks = [] } = useEpisodeTasks(selectedLesson?.id);

  // ── Focus-mode gamification (per-lesson timer) ───────────────────────────────
  const MAX_FREE_LIFELINES = 3;
  const LIFELINE_COIN_COST = 50;
  const [focusLockedIds, setFocusLockedIds] = useState<Set<string>>(new Set());
  const [lifelinesLeft, setLifelinesLeft] = useState(MAX_FREE_LIFELINES);
  const [focusDialog, setFocusDialog] = useState<{ lesson: any; duration: number } | null>(null);
  const [coinDialog, setCoinDialog] = useState<{ lesson: any; duration: number } | null>(null);
  const [lessonTimers, setLessonTimers] = useState<Record<string, number>>({});
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const timerLessonRef = useRef<string | null>(null);
  const spendCoins = useSpendCoins();
  useEffect(() => () => { clearInterval(timerIntervalRef.current); }, []);

  // "Don't show again" per-course focus dialog acknowledgement
  const [focusAcknowledged, setFocusAcknowledged] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(`tbt_focus_ack_${courseId}`);
  });
  const toggleFocusAck = (checked: boolean) => {
    setFocusAcknowledged(checked);
    if (checked) localStorage.setItem(`tbt_focus_ack_${courseId}`, "1");
    else localStorage.removeItem(`tbt_focus_ack_${courseId}`);
  };

  // Gamification: Practice Arena + Reflection + Spaced Repetition
  const { data: savedReflections } = useReflections(courseId);
  const localReflections = useMemo(() => {
    if (savedReflections && savedReflections.length > 0) return [];
    try {
      const all = JSON.parse(localStorage.getItem("tbt_reflections") || "{}");
      return Object.entries(all)
        .filter(([k]) => k.startsWith(`${courseId}:`))
        .map(([k, v]: [string, any]) => ({
          lessonId: k.split(":")[1],
          text: v.text as string,
          savedAt: typeof v.savedAt === "number"
            ? new Date(v.savedAt).toISOString()
            : (v.savedAt as string),
        }));
    } catch { return []; }
  }, [courseId, savedReflections]);
  const visibleReflections = (savedReflections && savedReflections.length > 0)
    ? savedReflections
    : localReflections;
  const [reflectionsOpen, setReflectionsOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [pendingReflection, setPendingReflection] = useState<{ lessonId: string; title: string } | null>(null);
  const [feedbackEpisodeId, setFeedbackEpisodeId] = useState<string | null>(null);
  const feedbackShownRef = useRef<Set<string>>(new Set());
  const { data: feedbackQuestions = [] } = useVideoFeedbackQuestions(feedbackEpisodeId);
  const [completionTimes, setCompletionTimes] = useState<Record<string, number>>({});
  const [reflectionCount, setReflectionCount] = useState(0);
  const reflectedRef = useRef<Set<string>>(new Set());
  // Tracks whether completion happened during THIS session (vs. pre-existing when lesson loaded).
  // Reflection modal should only fire for fresh completions, not for already-done lessons.
  const justCompletedInSessionRef = useRef(false);
  // Prevents double XP flash when both lesson completion and quiz pass fire for the same lesson.
  const xpFlashedRef = useRef<string | null>(null);

  // Section accordion state — start all sections expanded; collapse all except the active lesson's section
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Mid-video cue quizzes
  const [cueQuizModal, setCueQuizModal] = useState<{ questions: any[] } | null>(null);
  const firedCuesRef = useRef<Set<string>>(new Set());
  const cueQuizActiveRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Pause/resume helpers — assigned each render so they always read fresh refs
  const hlsFailedRef = useRef(false);
  hlsFailedRef.current = hlsFailed;
  const pausePlayerRef = useRef<() => void>(() => {});
  const resumePlayerRef = useRef<() => void>(() => {});
  pausePlayerRef.current = () => {
    if (selectedLessonRef.current?.hlsUrl && !hlsFailedRef.current) {
      playerRef.current?.pause();
    } else {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ context: "player.js", method: "pause" }),
        "https://iframe.mediadelivery.net"
      );
    }
  };
  resumePlayerRef.current = () => {
    if (selectedLessonRef.current?.hlsUrl && !hlsFailedRef.current) {
      playerRef.current?.play();
    } else {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ context: "player.js", method: "play" }),
        "https://iframe.mediadelivery.net"
      );
    }
  };

  // Let the ad system interrupt and restore this lesson (TBT_ADS_SPECKIT.md §7).
  // Reuses the pause/resume refs already built above for cue quizzes — those
  // handle the HLS-vs-iframe split, so the ad path gets it for free.
  useRegisterMedia("course-lesson-player", "video", {
    isPlaying: () => isPlayingRef.current,
    getPosition: () => lastPlayheadRef.current,
    pause: () => pausePlayerRef.current(),
    resume: () => resumePlayerRef.current(),
    // Intentionally a no-op: both transports preserve the playhead across
    // pause/play, so restoring position needs no seek. The registry's seek is
    // a safety net for players that DO reset, and PlyrPlayerHandle exposes no
    // seek — adding one just for this would widen a shared player interface
    // for a case that cannot occur here.
    seek: () => {},
  });

  // An open cue quiz is already a modal interruption; stacking a fullscreen ad
  // on top of it is incoherent (speckit §7.4).
  useSuppressAds("course-cue-quiz", !!cueQuizModal);

  // Auto-select lesson from URL parameter once course data loads
  useEffect(() => {
    if (course?.lessons && targetLessonId && !selectedLesson) {
      const target = course.lessons.find((l: any) => l.id === targetLessonId);
      if (target && target.videoUrl) {
        const alreadyDone = lessonAlreadyDone(
          target.id, completedIds, (target as any).isCompleted,
          target.durationSeconds, (target as any).actualWatchedSecs, (target as any).resumeAtSeconds,
        );
        setSelectedLesson({
          id: target.id,
          title: target.title,
          description: (target as any).description ?? null,
          videoUrl: target.videoUrl,
          hlsUrl: (target as any).hlsUrl ?? null,
          durationSeconds: target.durationSeconds ?? 0,
          resumeAtSeconds: alreadyDone ? 0 : ((target as any).resumeAtSeconds ?? 0),
          actualWatchedSecs: (target as any).actualWatchedSecs ?? 0,
          isCompleted: alreadyDone,
          sectionId: (target as any).sectionId ?? null,
        });
      }
    }
  }, [course, targetLessonId, selectedLesson]);

  // Show quiz modal on first episode completion
  const quizTriggeredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedLesson || watchState !== "completed") return;
    if (quizTriggeredForRef.current === selectedLesson.id) return;
    const lesson = course?.lessons?.find((l: any) => l.id === selectedLesson.id);
    if (!lesson?.hasQuiz) return;
    quizTriggeredForRef.current = selectedLesson.id;
    // Ensure the video is paused before showing the quiz. The video has usually already ended
    // naturally (safe), but in the 85%-threshold-completion edge case it may still be playing.
    pausePlayerRef.current();
    setQuizModal({ episodeId: selectedLesson.id, questions: (lesson as any).quizData?.questions ?? [] });
    setQuizAnswers({});
    setQuizResult(null);
  }, [watchState, selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset quiz trigger guard only when the lesson changes, not on every watchState transition.
  useEffect(() => {
    quizTriggeredForRef.current = null;
  }, [selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load completion timestamps from localStorage on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`tbt_cr_${courseId}`) || "{}");
      setCompletionTimes(stored);
    } catch {}
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync reflection count: prefer backend total, fall back to localStorage count
  useEffect(() => {
    if (savedReflections && savedReflections.length > 0) {
      setReflectionCount(savedReflections.length);
      return;
    }
    try {
      const all = JSON.parse(localStorage.getItem("tbt_reflections") || "{}");
      const count = Object.keys(all).filter(k => k.startsWith(`${courseId}:`)).length;
      setReflectionCount(count);
    } catch {}
  }, [courseId, savedReflections]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save completion timestamp + trigger reflection for no-quiz lessons
  useEffect(() => {
    if (watchState !== "completed" || !selectedLesson) return;
    const lid = selectedLesson.id;
    const title = selectedLesson.title;
    setCompletionTimes(prev => {
      if (prev[lid]) return prev;
      const next = { ...prev, [lid]: Date.now() };
      try { localStorage.setItem(`tbt_cr_${courseId}`, JSON.stringify(next)); } catch {}
      return next;
    });
    const lesson = courseRef.current?.lessons?.find((l: any) => l.id === lid);
    // Only show reflection for completions that happened in this session, not pre-existing ones.
    if (!lesson?.hasQuiz && !reflectedRef.current.has(lid) && justCompletedInSessionRef.current) {
      reflectedRef.current.add(lid);
      setTimeout(() => setPendingReflection({ lessonId: lid, title }), 1200);
    }
    // Trigger feedback modal for fresh completions (after reflection if applicable)
    if (justCompletedInSessionRef.current && !feedbackShownRef.current.has(lid)) {
      feedbackShownRef.current.add(lid);
      const delay = (!lesson?.hasQuiz && !reflectedRef.current.has(lid)) ? 1200 : 400;
      setTimeout(() => setFeedbackEpisodeId(lid), delay);
    }
  }, [watchState, selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tracking refs ────────────────────────────────────────────────────────────
  const markCalledRef = useRef(false);
  const selectedLessonRef = useRef<SelectedLesson | null>(null);
  selectedLessonRef.current = selectedLesson;
  const courseRef = useRef<any>(null);
  courseRef.current = course;

  const realDurationRef = useRef<number>(0);
  const liveWatchedRef = useRef<number>(0);
  const lastHeartbeatWatchedRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isHiddenRef = useRef<boolean>(false);
  const isSeekingRef = useRef<boolean>(false);
  const seekClearRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastPlayheadRef = useRef<number>(0);
  const speedRef = useRef<number>(1);
  const doMarkCompleteRef = useRef<boolean>(false);
  const upNextTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Auto-advance preference — persisted to localStorage
  const [autoAdvance, setAutoAdvance] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("tbt_autoadvance");
    return v === null ? true : v === "1";
  });
  const autoAdvanceRef = useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;
  const toggleAutoAdvance = () => {
    const next = !autoAdvance;
    setAutoAdvance(next);
    localStorage.setItem("tbt_autoadvance", next ? "1" : "0");
  };

  // Stable up-next trigger via ref to avoid stale closures inside intervals
  const triggerUpNextRef = useRef<() => void>(() => {});
  triggerUpNextRef.current = useCallback(() => {
    clearInterval(upNextTimerRef.current);
    const lessons = courseRef.current?.lessons ?? [];
    const currentIdx = lessons.findIndex((l: any) => l.id === selectedLessonRef.current?.id);
    if (currentIdx < 0 || currentIdx >= lessons.length - 1) return;
    const next = lessons[currentIdx + 1];
    if (!next?.videoUrl) return;
    setUpNextVisible(true);
    if (!autoAdvanceRef.current) return; // banner shows but no countdown
    let n = 5;
    setUpNextCountdown(n);
    upNextTimerRef.current = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(upNextTimerRef.current);
        setUpNextCountdown(null);
        setUpNextVisible(false);
        const nextDone = lessonAlreadyDone(
          next.id, completedIdsRef.current, (next as any).isCompleted,
          next.durationSeconds, (next as any).actualWatchedSecs, (next as any).resumeAtSeconds,
        );
        setSelectedLesson({
          id: next.id,
          title: next.title,
          description: (next as any).description ?? null,
          videoUrl: next.videoUrl,
          hlsUrl: (next as any).hlsUrl ?? null,
          durationSeconds: next.durationSeconds ?? 0,
          resumeAtSeconds: nextDone ? 0 : ((next as any).resumeAtSeconds ?? 0),
          actualWatchedSecs: (next as any).actualWatchedSecs ?? 0,
          isCompleted: nextDone,
          sectionId: (next as any).sectionId ?? null,
        });
        routerRef.current.replace(`/learning/${courseIdRef.current}?lesson=${next.id}`, { scroll: false });
        topRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        setUpNextCountdown(n);
      }
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const completedIds = new Set(
    progressList?.filter((p) => p.completed).map((p) => p.lessonId) ?? []
  );
  const completedIdsRef = useRef<Set<string>>(new Set());
  completedIdsRef.current = completedIds;

  // Stop focus timer when active lesson completes
  useEffect(() => {
    const active = timerLessonRef.current;
    if (active && completedIdsRef.current.has(active)) {
      clearInterval(timerIntervalRef.current);
      timerLessonRef.current = null;
      setLessonTimers(prev => { const n = { ...prev }; delete n[active]; return n; });
    }
  }, [completedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spaced repetition: lessons completed 3+ days ago (Ebbinghaus forgetting curve)
  const reviewDueIds = useMemo(() => {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return Array.from(completedIds).filter(id => {
      const t = completionTimes[id];
      return t !== undefined && (now - t) >= threeDaysMs;
    });
  }, [progressList, completionTimes]); // eslint-disable-line react-hooks/exhaustive-deps

  // When server data arrives and contradicts a stale-cache "completed" state,
  // correct watchState so the user can actually re-watch the lesson.
  useEffect(() => {
    if (!selectedLesson || watchState === "watching" || watchState === "not_started") return;
    const done = lessonAlreadyDone(
      selectedLesson.id, completedIds, selectedLesson.isCompleted,
      selectedLesson.durationSeconds, selectedLesson.actualWatchedSecs, selectedLesson.resumeAtSeconds,
    );
    if (!done && watchState === "completed" && !doMarkCompleteRef.current) {
      setWatchState("not_started");
      markCalledRef.current = false;
    }
  }, [completedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset all tracking state on lesson change
  useEffect(() => {
    startRef.current = Date.now();
    realDurationRef.current = 0;
    liveWatchedRef.current = 0;
    lastHeartbeatWatchedRef.current = 0;
    isPlayingRef.current = false;
    isSeekingRef.current = false;
    speedRef.current = typeof window !== "undefined"
      ? (parseFloat(localStorage.getItem("tbt_speed") ?? "1") || 1)
      : 1;
    doMarkCompleteRef.current = false;
    setQuizHintShown(false);
    clearTimeout(seekClearRef.current);
    clearInterval(upNextTimerRef.current);
    setLiveWatched(0);
    setLiveRealDuration(0);
    setHlsFailed(false);
    setUpNextCountdown(null);
    setUpNextVisible(false);
    firedCuesRef.current = new Set();
    cueQuizActiveRef.current = false;
    setCueQuizModal(null);
    justCompletedInSessionRef.current = false;
    xpFlashedRef.current = null;

    if (!selectedLesson) return;
    lastPlayheadRef.current = selectedLesson.resumeAtSeconds ?? 0;
    const alreadyDone = lessonAlreadyDone(
      selectedLesson.id, completedIdsRef.current, selectedLesson.isCompleted,
      selectedLesson.durationSeconds, selectedLesson.actualWatchedSecs, selectedLesson.resumeAtSeconds,
    );
    setWatchState(alreadyDone ? "completed" : "not_started");
    setWatchedSeconds(selectedLesson.resumeAtSeconds ?? 0);
    // Only suppress future API calls when the server has authoritatively confirmed completion.
    // Heuristic signals (threshold / position) show the right UI but still need a backend sync.
    const serverConfirmed = completedIdsRef.current.has(selectedLesson.id) || !!selectedLesson.isCompleted;
    markCalledRef.current = serverConfirmed;
  }, [selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // XP flash for non-quiz lessons on fresh completion (quiz lessons flash when quiz passes).
  useEffect(() => {
    if (watchState !== "completed" || !justCompletedInSessionRef.current) return;
    const lessonId = selectedLessonRef.current?.id;
    if (!lessonId || xpFlashedRef.current === lessonId) return;
    const lessonData = courseRef.current?.lessons?.find((l: any) => l.id === lessonId);
    if (lessonData?.hasQuiz) return;
    const xp = (courseRef.current as any)?.xpPerEpisode ?? 0;
    if (xp <= 0) return;
    xpFlashedRef.current = lessonId;
    setXpFlash(xp);
    const t = setTimeout(() => setXpFlash(null), 3000);
    return () => clearTimeout(t);
  }, [watchState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the player reports the real video duration, re-evaluate completion using
  // accurate duration (overrides wrong durationSeconds stored in DB).
  useEffect(() => {
    if (!selectedLesson || liveRealDuration <= 0) return;
    if (selectedLesson.isCompleted || completedIds.has(selectedLesson.id)) return;
    if (markCalledRef.current) return;
    const watched = selectedLesson.actualWatchedSecs ?? 0;
    if (watched < liveRealDuration * 0.85) return;
    justCompletedInSessionRef.current = true;
    setWatchState("completed");
    markCalledRef.current = true;
    markComplete.mutate({ lessonId: selectedLesson.id, watchedSeconds: Math.floor(watched), isCompleted: true, videoDuration: liveRealDuration });
  }, [liveRealDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Native VideoPlayer callbacks ─────────────────────────────────────────────
  const handleVideoReady = (duration: number) => {
    realDurationRef.current = duration;
    setLiveRealDuration(duration);
  };

  const handleVideoPlay = () => {
    isPlayingRef.current = true;
    setWatchState((prev) => (prev === "completed" ? "completed" : "watching"));
  };

  const handleVideoPause = () => {
    isPlayingRef.current = false;
    setWatchState((prev) => (prev === "completed" ? "completed" : "paused"));
  };

  const handleVideoSeeked = () => {
    isSeekingRef.current = true;
    clearTimeout(seekClearRef.current);
    seekClearRef.current = setTimeout(() => { isSeekingRef.current = false; }, 800);
  };

  const handleVideoProgress = (s: number) => {
    lastPlayheadRef.current = s;
    setWatchedSeconds(s);
    // Mid-video cue quiz check — fire earliest untriggered cue when playhead passes its timestamp
    if (!cueQuizActiveRef.current) {
      const lesson = courseRef.current?.lessons?.find((l: any) => l.id === selectedLessonRef.current?.id);
      const cues: any[] = [...(lesson?.quizData?.cues ?? [])].sort((a: any, b: any) => a.atSeconds - b.atSeconds);
      for (const cue of cues) {
        if (!firedCuesRef.current.has(cue.id) && s >= cue.atSeconds) {
          firedCuesRef.current.add(cue.id);
          cueQuizActiveRef.current = true;
          pausePlayerRef.current();
          // Exit fullscreen first — modal is in the parent document and won't
          // appear over a native fullscreen iframe/video element otherwise.
          const qs = cue.questions ?? [];
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {}).finally(() => { setCueQuizModal({ questions: qs }); });
          } else {
            setCueQuizModal({ questions: qs });
          }
          break;
        }
      }
    }
  };

  const handleVideoSpeedChange = (s: number) => {
    speedRef.current = s;
    setPlaybackSpeed(s);
    try { localStorage.setItem("tbt_speed", String(s)); } catch {}
  };

  const handleVideoEnded = () => {
    isPlayingRef.current = false;
    const lesson = selectedLessonRef.current;
    if (!lesson) return;
    justCompletedInSessionRef.current = true;
    setWatchState("completed");
    // Only auto-advance if this lesson has no quiz — quiz lessons advance in handleCloseQuiz
    const lessonData = courseRef.current?.lessons?.find((l: any) => l.id === lesson.id);
    if (!lessonData?.hasQuiz) triggerUpNextRef.current();
    const allLessons = courseRef.current?.lessons ?? [];
    const willBeAllDone = allLessons.length > 0 &&
      allLessons.every((l: any) => completedIdsRef.current.has(l.id) || l.id === lesson.id);
    if (willBeAllDone && !markCalledRef.current) {
      setTimeout(() => toast.success("🎉 Course complete! Great work!", { duration: 5000 }), 600);
    }
    if (!markCalledRef.current) {
      markCalledRef.current = true;
      doMarkCompleteRef.current = false;
      markComplete.mutate({ lessonId: lesson.id, watchedSeconds: Math.floor(lastPlayheadRef.current), isCompleted: true, videoDuration: realDurationRef.current > 0 ? realDurationRef.current : undefined });
    }
  };

  const handleMarkComplete = () => {
    if (!selectedLesson || markCalledRef.current) return;
    markCalledRef.current = true;
    justCompletedInSessionRef.current = true;
    setWatchState("completed");
    // Only auto-advance if this lesson has no quiz — quiz lessons advance in handleCloseQuiz
    const lessonData = courseRef.current?.lessons?.find((l: any) => l.id === selectedLesson.id);
    if (!lessonData?.hasQuiz) triggerUpNextRef.current();
    const allLessons = courseRef.current?.lessons ?? [];
    const willBeAllDone = allLessons.length > 0 &&
      allLessons.every((l: any) => completedIdsRef.current.has(l.id) || l.id === selectedLesson.id);
    if (willBeAllDone) {
      setTimeout(() => toast.success("🎉 Course complete! Great work!", { duration: 5000 }), 600);
    }
    const playhead = lastPlayheadRef.current > 0
      ? Math.floor(lastPlayheadRef.current)
      : (selectedLesson.resumeAtSeconds ?? 0);
    markComplete.mutate({
      lessonId: selectedLesson.id,
      watchedSeconds: playhead,
      isCompleted: true,
      videoDuration: realDurationRef.current > 0 ? realDurationRef.current : undefined,
    });
  };

  // ── Bunny iframe message handler — only runs when HLS is unavailable or failed ──
  useEffect(() => {
    if (!selectedLesson || !isBunnyEmbed(selectedLesson.videoUrl)) return;
    if (selectedLesson.hlsUrl && !hlsFailed) return;

    const BUNNY_ORIGIN = "https://iframe.mediadelivery.net";

    const doMarkComplete = () => {
      const lesson = selectedLessonRef.current;
      if (!lesson) return;
      isPlayingRef.current = false;
      doMarkCompleteRef.current = false;
      justCompletedInSessionRef.current = true;
      setWatchState("completed");
      // Only auto-advance if this lesson has no quiz — quiz lessons advance in handleCloseQuiz.
      // Same guard as handleVideoEnded (HLS path). Without this, the 5-second up-next countdown
      // starts while the quiz modal is simultaneously opening, navigating away before the user answers.
      const lessonDataForComplete = courseRef.current?.lessons?.find((l: any) => l.id === lesson.id);
      if (!lessonDataForComplete?.hasQuiz) triggerUpNextRef.current();
      if (!markCalledRef.current) {
        markCalledRef.current = true;
        markComplete.mutate({ lessonId: lesson.id, isCompleted: true, watchedSeconds: Math.floor(lastPlayheadRef.current), videoDuration: realDurationRef.current > 0 ? realDurationRef.current : undefined });
      }
    };

    const handler = (e: MessageEvent) => {
      if (e.origin && !e.origin.includes("mediadelivery.net")) return;

      let data = e.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data || typeof data !== "object") return;

      let evt = "";
      let payloadValue: any = undefined;

      if (data.context === "player.js") {
        evt = (data.event || "").toLowerCase();
        payloadValue = data.value;
      } else {
        const inner = data.data ?? data;
        evt = (inner.event || inner.type || inner.action || "").toLowerCase();
        payloadValue = inner.value ?? inner;
      }

      if (!evt) return;

      if (evt === "ready" && e.source) {
        const win = e.source as Window;
        ["play", "pause", "timeupdate", "ended", "seeked"].forEach((eventName) => {
          win.postMessage(
            JSON.stringify({ context: "player.js", method: "addEventListener", value: eventName }),
            BUNNY_ORIGIN
          );
        });
        // Request actual video duration and current time (to detect auto-play already in progress)
        win.postMessage(JSON.stringify({ context: "player.js", method: "getDuration" }), BUNNY_ORIGIN);
        win.postMessage(JSON.stringify({ context: "player.js", method: "getCurrentTime" }), BUNNY_ORIGIN);
        win.postMessage(JSON.stringify({ context: "player.js", method: "isPaused" }), BUNNY_ORIGIN);
        return;
      }

      const isPlay = evt === "play" || evt === "playing" || evt === "onplay" || evt === "start"
        || evt === "autoplay" || evt === "autoplaystart";
      const isEnd = evt === "ended" || evt === "end" || evt === "finish" || evt === "onfinish" || evt === "complete" || evt === "onended";
      const isPause = evt === "pause" || evt === "paused" || evt === "onpause";
      const isTimeUpdate = evt === "timeupdate";
      const isSeeked = evt === "seeked";

      // Handle getDuration response from Bunny Player.js API
      if (evt === "getduration" && payloadValue !== undefined) {
        const dur = typeof payloadValue === "number" ? payloadValue : Number(payloadValue);
        if (dur > 0 && realDurationRef.current === 0) {
          realDurationRef.current = dur;
          setLiveRealDuration(dur);
        }
      }

      // Detect if player was already playing when our handler registered (e.g. autoplay)
      if (evt === "getcurrenttime" && payloadValue !== undefined) {
        const ct = typeof payloadValue === "number" ? payloadValue : Number(payloadValue);
        if (ct > 0) {
          lastPlayheadRef.current = ct;
          isPlayingRef.current = true;
          setWatchState((s) => (s === "completed" ? "completed" : "watching"));
        }
      }
      if (evt === "ispaused" && payloadValue === false) {
        isPlayingRef.current = true;
        setWatchState((s) => (s === "completed" ? "completed" : "watching"));
      }

      if (isTimeUpdate && payloadValue !== undefined) {
        const currentTime = typeof payloadValue === "number" ? payloadValue : payloadValue.seconds;
        if (currentTime !== undefined) {
          lastPlayheadRef.current = currentTime;
          setWatchedSeconds(Math.floor(currentTime));
          // Mid-video cue quiz check — same logic as handleVideoProgress (HLS path).
          // Must run here too because iframe timeupdate bypasses handleVideoProgress.
          if (!cueQuizActiveRef.current) {
            const lesson = courseRef.current?.lessons?.find((l: any) => l.id === selectedLessonRef.current?.id);
            const cues: any[] = [...(lesson?.quizData?.cues ?? [])].sort((a: any, b: any) => a.atSeconds - b.atSeconds);
            for (const cue of cues) {
              if (!firedCuesRef.current.has(cue.id) && currentTime >= cue.atSeconds) {
                firedCuesRef.current.add(cue.id);
                cueQuizActiveRef.current = true;
                pausePlayerRef.current();
                // Exit fullscreen first — modal is in the parent document and won't
                // appear over a native fullscreen iframe/video element otherwise.
                const qs = cue.questions ?? [];
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {}).finally(() => { setCueQuizModal({ questions: qs }); });
                } else {
                  setCueQuizModal({ questions: qs });
                }
                break;
              }
            }
          }
        }
        // Fallback: some Bunny versions include duration in the timeupdate payload
        if (typeof payloadValue === "object" && payloadValue.duration > 0 && realDurationRef.current === 0) {
          realDurationRef.current = payloadValue.duration;
          setLiveRealDuration(payloadValue.duration);
        }
      }

      if (isSeeked) {
        isSeekingRef.current = true;
        clearTimeout(seekClearRef.current);
        seekClearRef.current = setTimeout(() => { isSeekingRef.current = false; }, 800);
      }

      if (isPlay && !isEnd) {
        isPlayingRef.current = true;
        setWatchState((s) => (s === "completed" ? "completed" : "watching"));
      } else if (isPause && !isEnd) {
        isPlayingRef.current = false;
        setWatchState((s) => (s === "completed" ? "completed" : "paused"));
      }

      if (isEnd) doMarkComplete();
    };

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      isPlayingRef.current = false;
    };
  }, [selectedLesson?.id, hlsFailed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 1-second tick + tab visibility + beforeunload ────────────────────────────
  useEffect(() => {
    if (!selectedLesson) return;

    const handleVisibility = () => { isHiddenRef.current = document.hidden; };
    document.addEventListener("visibilitychange", handleVisibility);

    const handleBeforeUnload = () => {
      const lesson = selectedLessonRef.current;
      if (!lesson || !isPlayingRef.current) return;
      const delta = Math.min(liveWatchedRef.current - lastHeartbeatWatchedRef.current, 30);
      if (delta <= 0) return;
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      fetch(`${apiBase}/api/user/enrollments/${courseId}/progress/${lesson.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify({
          watchedSeconds: Math.floor(lastPlayheadRef.current),
          deltaSeconds: delta,
        }),
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    const tick = setInterval(() => {
      if (!isPlayingRef.current || isHiddenRef.current || isSeekingRef.current) return;
      liveWatchedRef.current += speedRef.current;
      setLiveWatched(Math.floor(liveWatchedRef.current));
    }, 1000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(tick);
    };
  }, [selectedLesson?.id, courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 30-second heartbeat ──────────────────────────────────────────────────────
  // watchedSeconds uses the actual video playhead (lastPlayheadRef) — not
  // wall-clock elapsed — so pausing for several minutes doesn't inflate the
  // stored position and falsely trigger the 85% completion threshold.
  // deltaSeconds still uses elapsed time (capped at 30s) to measure activity
  // since the last heartbeat, which is correct regardless of player type.
  useEffect(() => {
    if (!selectedLesson) return;

    const hb = setInterval(() => {
      const lesson = selectedLessonRef.current;
      if (!lesson || markCalledRef.current || !isPlayingRef.current) return;
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const delta = Math.min(30, elapsed - lastHeartbeatWatchedRef.current);
      if (delta <= 0) return;
      lastHeartbeatWatchedRef.current = elapsed;
      markComplete.mutate({
        lessonId: lesson.id,
        watchedSeconds: Math.floor(lastPlayheadRef.current),
        deltaSeconds: delta,
      });
    }, 30_000);

    return () => clearInterval(hb);
  }, [selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close cue quiz and resume video — must be before early returns (hook rule)
  const handleCloseCueQuiz = useCallback(() => {
    setCueQuizModal(null);
    cueQuizActiveRef.current = false;
    resumePlayerRef.current();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Must be declared before any early returns — useCallback is a hook and must run
  // unconditionally every render regardless of access/loading state.
  const handleCloseQuiz = useCallback((fromResult: boolean) => {
    setQuizModal(null);
    setQuizResult(null);
    // Quiz always shows after lesson completion, so trigger up-next now that it's dismissed
    triggerUpNextRef.current();
    if (fromResult) {
      const lesson = selectedLessonRef.current;
      if (lesson && !reflectedRef.current.has(lesson.id)) {
        reflectedRef.current.add(lesson.id);
        setPendingReflection({ lessonId: lesson.id, title: lesson.title });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Collapse all sections except the one containing the active lesson.
  // Must be before early returns — hooks must be called unconditionally.
  useEffect(() => {
    const sections: any[] = (course as any)?.sections ?? [];
    if (sections.length === 0) return;
    const activeSectionId = selectedLesson?.sectionId ?? "__unsectioned__";
    setCollapsedSections(new Set<string>(
      sections
        .map((s: any) => s.id)
        .filter((id: string) => id !== activeSectionId)
    ));
  }, [(course as any)?.sections?.length, selectedLesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <PageLoader />;
  if (!course) {
    return (
      <p className="text-center py-16 text-sm" style={{ color: "var(--color-text-subtle)" }}>
        {uiStrings?.errorGeneric ?? "Course not found."}
      </p>
    );
  }

  // Paywall — course not purchased
  if (!course.hasAccess) {
    return <PaywallView course={course} courseId={courseId} />;
  }

  const lessons: Lesson[] = course.lessons ?? [];

  // Next lesson for up-next UI
  const currentLessonIdx = lessons.findIndex((l: any) => l.id === selectedLesson?.id);
  const nextLesson = currentLessonIdx >= 0 && currentLessonIdx < lessons.length - 1
    ? lessons[currentLessonIdx + 1]
    : null;

  const handleSelectLesson = (lesson: any) => {
    if (!lesson.videoUrl) return;
    setVideoKey(0);
    clearInterval(upNextTimerRef.current);
    setUpNextCountdown(null);
    setUpNextVisible(false);
    const alreadyDone = lessonAlreadyDone(
      lesson.id, completedIds, lesson.isCompleted,
      lesson.durationSeconds, lesson.actualWatchedSecs, lesson.resumeAtSeconds,
    );
    setSelectedLesson({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description ?? null,
      videoUrl: lesson.videoUrl,
      hlsUrl: lesson.hlsUrl ?? null,
      durationSeconds: lesson.durationSeconds ?? 0,
      resumeAtSeconds: alreadyDone ? 0 : (lesson.resumeAtSeconds ?? 0),
      actualWatchedSecs: lesson.actualWatchedSecs ?? 0,
      isCompleted: alreadyDone,
      sectionId: (lesson as any).sectionId ?? null,
    });
    topRef.current?.scrollIntoView({ behavior: "smooth" });
    router.replace(`/learning/${courseId}?lesson=${lesson.id}`, { scroll: false });
  };

  // ── Focus timer helpers ───────────────────────────────────────────────────
  const getLessonTimerDuration = (lesson: any): number =>
    lesson?.timerSeconds ?? (lesson?.sectionTimerSeconds ?? null) ?? config?.taskTimerSeconds ?? 300;

  const startLessonTimer = (lessonId: string, duration: number) => {
    clearInterval(timerIntervalRef.current);
    timerLessonRef.current = lessonId;
    let remaining = duration;
    setLessonTimers(prev => ({ ...prev, [lessonId]: remaining }));
    timerIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timerIntervalRef.current);
        timerLessonRef.current = null;
        setLessonTimers(prev => ({ ...prev, [lessonId]: 0 }));
        if (!completedIdsRef.current.has(lessonId)) {
          setFocusLockedIds(prev => new Set([...prev, lessonId]));
          toast.error("⏰ Time's up! Use a lifeline to unlock this lesson.", { duration: 4000 });
        }
      } else {
        setLessonTimers(prev => ({ ...prev, [lessonId]: remaining }));
      }
    }, 1000);
  };

  const handleSelectLessonWithFocus = (lesson: any) => {
    if (!lesson.videoUrl) return;
    const isFocusLocked = focusLockedIds.has(lesson.id) && !completedIds.has(lesson.id);
    if (isFocusLocked) return;
    const timerStarted = lessonTimers[lesson.id] !== undefined;
    if (timerStarted || completedIds.has(lesson.id) || lesson.isCompleted) {
      handleSelectLesson(lesson);
      return;
    }
    const duration = getLessonTimerDuration(lesson);
    if (!duration) { handleSelectLesson(lesson); return; }
    if (focusAcknowledged) {
      handleSelectLesson(lesson);
      startLessonTimer(lesson.id, duration);
      return;
    }
    setFocusDialog({ lesson, duration });
  };

  const handleUseLifeline = (lesson: any, duration: number) => {
    if (lifelinesLeft > 0) {
      const remaining = lifelinesLeft - 1;
      setLifelinesLeft(remaining);
      setFocusLockedIds(prev => { const s = new Set(prev); s.delete(lesson.id); return s; });
      startLessonTimer(lesson.id, duration);
      handleSelectLesson(lesson);
      toast.success(`Lifeline used! ${remaining} free lifeline${remaining !== 1 ? "s" : ""} remaining.`);
    } else {
      setCoinDialog({ lesson, duration });
    }
  };

  const handleSpendCoinsForLesson = async (lesson: any, duration: number) => {
    try {
      const res = await spendCoins.mutateAsync(LIFELINE_COIN_COST);
      setFocusLockedIds(prev => { const s = new Set(prev); s.delete(lesson.id); return s; });
      startLessonTimer(lesson.id, duration);
      handleSelectLesson(lesson);
      setCoinDialog(null);
      toast.success(`Lifeline activated! ${LIFELINE_COIN_COST} TBT coins deducted. Remaining: ${res.remainingCoins} coins.`);
    } catch (err: any) {
      setCoinDialog(null);
      toast.error(err?.response?.data?.error ?? "Not enough TBT coins");
    }
  };

  const handleRewatch = () => {
    if (!selectedLesson) return;
    clearInterval(upNextTimerRef.current);
    setUpNextCountdown(null);
    liveWatchedRef.current = 0;
    lastHeartbeatWatchedRef.current = 0;
    setLiveWatched(0);
    setWatchState("not_started");
    // markCalledRef stays true so we don't re-trigger completion
    setVideoKey((k) => k + 1);
  };

  const handleShareCert = async () => {
    if (!me?.id) return;
    const certId = btoa(`${me.id}:${courseId}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const url = `${window.location.origin}/verify/course/${certId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCertCopied(true);
      setTimeout(() => setCertCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const activeDuration = liveRealDuration > 0 ? liveRealDuration : (selectedLesson?.durationSeconds ?? 0);

  // Sections — group lessons by sectionId when sections exist
  const courseSections: any[] = (course as any)?.sections ?? [];
  const globalLessonIdx = new Map(lessons.map((l: any, i: number) => [l.id, i]));

  return (
    <div className="space-y-6 pb-12">

      {/* ── Focus-Mode Start Dialog ─────────────────────────────────────── */}
      {focusDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)" }}>
                <Zap size={22} style={{ color: "var(--color-accent)" }} />
              </div>
              <div>
                <p className="font-bold text-base">Focus Mode</p>
                <p className="text-xs text-muted-foreground mt-0.5">{focusDialog.lesson.title}</p>
              </div>
              <button onClick={() => setFocusDialog(null)} className="ml-auto p-1 rounded-lg hover:opacity-70">
                <X size={16} className="opacity-50" />
              </button>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              This lesson will be <strong style={{ color: "var(--color-accent)" }}>locked</strong> after{" "}
              <strong>{fmtTime(focusDialog.duration)}</strong> if not completed.
              You have <strong>{lifelinesLeft} free lifeline{lifelinesLeft !== 1 ? "s" : ""}</strong> remaining.
              After that, lifelines cost <strong>{LIFELINE_COIN_COST} TBT coins</strong> each.
            </p>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={focusAcknowledged}
                onChange={(e) => toggleFocusAck(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--color-accent)]"
              />
              <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                Don&apos;t show this again for this course
              </span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setFocusDialog(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all"
                style={{ borderColor: "var(--color-border-medium)", background: "transparent" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { handleSelectLesson(focusDialog.lesson); startLessonTimer(focusDialog.lesson.id, focusDialog.duration); setFocusDialog(null); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: "var(--color-accent)" }}
              >
                <Zap size={14} />
                Start Focus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Coin-Spend Lifeline Dialog ──────────────────────────────────── */}
      {coinDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-5" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(251,191,36,0.15)" }}>
                <Coins size={22} style={{ color: "#fbbf24" }} />
              </div>
              <div>
                <p className="font-bold text-base">Use TBT Coins?</p>
                <p className="text-xs text-muted-foreground mt-0.5">No free lifelines remaining</p>
              </div>
              <button onClick={() => setCoinDialog(null)} className="ml-auto p-1 rounded-lg hover:opacity-70">
                <X size={16} className="opacity-50" />
              </button>
            </div>
            <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Lifeline cost</span>
                <span className="font-bold" style={{ color: "#fbbf24" }}>{LIFELINE_COIN_COST} coins</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your balance</span>
                <span className="font-bold">{me?.totalPoints ?? "—"} coins</span>
              </div>
            </div>
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Spending {LIFELINE_COIN_COST} TBT coins will reset the {fmtTime(coinDialog.duration)} focus timer for this lesson.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCoinDialog(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border"
                style={{ borderColor: "var(--color-border-medium)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSpendCoinsForLesson(coinDialog.lesson, coinDialog.duration)}
                disabled={spendCoins.isPending || (me?.totalPoints ?? 0) < LIFELINE_COIN_COST}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "#d97706" }}
              >
                {spendCoins.isPending ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
                Spend {LIFELINE_COIN_COST} Coins
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back */}
      <button
        onClick={() => { selectedLesson ? setSelectedLesson(null) : router.back(); }}
        className="inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-100"
        style={{ color: "var(--color-text-subtle)" }}
      >
        <ChevronLeft size={16} />
        {selectedLesson ? course.title : "Back"}
      </button>

      {/* Access expiry warning */}
      {course.accessExpiresAt && course.accessType !== "lifetime" && (
        <ExpiryWarning expiresAt={course.accessExpiresAt} />
      )}

      {/* Top area */}
      <div ref={topRef}>
        {selectedLesson ? (
          <div className="space-y-4">
            <VideoWatermark
              className="w-full aspect-video rounded-xl overflow-hidden relative bg-black"
              containerId="course-video-root"
              showFullscreenButton={!!(selectedLesson.hlsUrl || isBunnyEmbed(selectedLesson.videoUrl))}
            >
              {selectedLesson.hlsUrl && !hlsFailed ? (
                <PlyrPlayer
                  ref={playerRef}
                  key={`${selectedLesson.id}-${videoKey}`}
                  hlsUrl={selectedLesson.hlsUrl}
                  startAt={videoKey > 0 ? 0 : (selectedLesson.resumeAtSeconds ?? 0)}
                  speed={playbackSpeed}
                  autoplay={true}
                  className="absolute inset-0 w-full h-full bg-black"
                  onReady={handleVideoReady}
                  onTimeUpdate={handleVideoProgress}
                  onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                  onEnded={handleVideoEnded}
                  onSpeedChange={handleVideoSpeedChange}
                  onError={() => setHlsFailed(true)}
                />
              ) : isBunnyEmbed(selectedLesson.videoUrl) ? (
                <iframe
                  ref={iframeRef}
                  key={`${selectedLesson.id}-${videoKey}-iframe`}
                  src={withResumeTime(normalizeBunnyUrl(selectedLesson.videoUrl) + "&autoplay=true", videoKey > 0 ? 0 : (selectedLesson.resumeAtSeconds ?? 0))}
                  className="w-full h-full border-0"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media"
                  title={selectedLesson.title}
                />
              ) : (
                <VideoPlayer
                  key={`${selectedLesson.id}-${videoKey}`}
                  src={selectedLesson.videoUrl}
                  lessonId={selectedLesson.id}
                  resumeAtSeconds={videoKey > 0 ? 0 : (selectedLesson.resumeAtSeconds ?? 0)}
                  onReady={handleVideoReady}
                  onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                  onSeeked={handleVideoSeeked}
                  onProgress={handleVideoProgress}
                  onSpeedChange={handleVideoSpeedChange}
                  onEnded={handleVideoEnded}
                />
              )}
            </VideoWatermark>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-foreground leading-snug">{selectedLesson.title}</h2>
                {selectedLesson.description && (
                  <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
                    {selectedLesson.description}
                  </p>
                )}
              </div>
              {(watchState === "completed" || !!selectedLesson.isCompleted) ? (
                <span
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
                  style={{ background: "var(--color-success)", color: "#fff" }}
                >
                  <CheckCircle2 size={13} /> Completed
                </span>
              ) : (
                <button
                  onClick={handleMarkComplete}
                  disabled={markComplete.isPending}
                  className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: "var(--color-success)", color: "#fff" }}
                >
                  {markComplete.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Mark Complete
                </button>
              )}
            </div>

            {/* Lesson navigation — Previous / counter / Next */}
            {currentLessonIdx >= 0 && (
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    if (currentLessonIdx > 0) handleSelectLessonWithFocus(lessons[currentLessonIdx - 1] as any);
                  }}
                  disabled={currentLessonIdx === 0 || !(lessons[currentLessonIdx - 1] as any)?.videoUrl}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ border: "1px solid var(--color-border-strong)", color: "var(--color-text-subtle)" }}
                >
                  <ChevronLeft size={12} /> Previous
                </button>
                <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                  {currentLessonIdx + 1} / {lessons.length}
                </span>
                <button
                  onClick={() => {
                    if (currentLessonIdx < lessons.length - 1) handleSelectLessonWithFocus(lessons[currentLessonIdx + 1] as any);
                  }}
                  disabled={currentLessonIdx === lessons.length - 1 || !(lessons[currentLessonIdx + 1] as any)?.videoUrl}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ border: "1px solid var(--color-border-strong)", color: "var(--color-text-subtle)" }}
                >
                  Next <ChevronRight size={12} />
                </button>
              </div>
            )}

            {/* 85% completion progress indicator */}
            {watchState !== "completed" && !selectedLesson.isCompleted && activeDuration > 0 && liveWatched > 0 && (() => {
              const pct = Math.min(100, Math.round((liveWatched / activeDuration) * 100));
              const toComplete = Math.max(0, Math.ceil(activeDuration * 0.95 - liveWatched));
              const currentLesson = course?.lessons?.find((l: any) => l.id === selectedLesson.id) as any;
              const hasQuiz = !!currentLesson?.hasQuiz;
              const quizUnlockPct: number = currentLesson?.quizUnlockPercent ?? 80;
              const quizApproaching = hasQuiz && pct >= (quizUnlockPct - 5) && pct < quizUnlockPct && !quizHintShown;
              if (quizApproaching && !quizHintShown) setQuizHintShown(true);
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs" style={{ color: "var(--color-text-subtle)" }}>
                    <span>{pct}% watched</span>
                    {pct < 95 ? (
                      <span>
                        {toComplete > 60
                          ? `${Math.ceil(toComplete / 60)}m to complete`
                          : `${toComplete}s to complete`}
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-success)" }}>✓ Eligible to complete</span>
                    )}
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--color-progress-track)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(100, Math.round((pct / 95) * 100))}%`,
                        background: pct >= 95 ? "var(--color-success)" : "var(--color-accent)",
                      }}
                    />
                  </div>
                  {hasQuiz && pct >= (quizUnlockPct - 5) && pct < 100 && (
                    <p className="text-xs flex items-center gap-1" style={{ color: "var(--color-accent)" }}>
                      <Zap size={11} /> Quiz unlocking soon — keep watching!
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Up-next banner — shows on completion regardless of auto-advance setting */}
            {upNextVisible && nextLesson && (
              <div
                className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-surface))",
                  border: "1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)",
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <SkipForward size={14} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                  <span className="truncate" style={{ color: "var(--color-text-normal)" }}>
                    Next: <span className="text-foreground font-medium">{nextLesson.title}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {upNextCountdown !== null ? (
                    <span className="text-xs font-bold" style={{ color: "var(--color-accent)" }}>
                      {upNextCountdown}s
                    </span>
                  ) : (
                    <button
                      onClick={() => { setUpNextVisible(false); handleSelectLessonWithFocus(nextLesson as any); }}
                      className="text-xs px-2.5 py-1 rounded-md font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: "var(--color-accent)" }}
                    >
                      Play →
                    </button>
                  )}
                  <button
                    onClick={toggleAutoAdvance}
                    title={autoAdvance ? "Turn off auto-advance" : "Turn on auto-advance"}
                    className="text-[10px] px-2 py-1 rounded-md transition-opacity hover:opacity-70"
                    style={{ border: "1px solid var(--color-border-subtle)", color: "var(--color-text-subtle)" }}
                  >
                    Auto: {autoAdvance ? "On" : "Off"}
                  </button>
                  <button
                    onClick={() => { clearInterval(upNextTimerRef.current); setUpNextCountdown(null); setUpNextVisible(false); }}
                    className="text-xs px-2 py-1 rounded-md transition-opacity hover:opacity-70"
                    style={{ border: "1px solid var(--color-border-strong)", color: "var(--color-text-subtle)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Rewatch button (only when completed and banner not showing) */}
            {watchState === "completed" && !upNextVisible && (
              <button
                onClick={handleRewatch}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                style={{ border: "1px solid var(--color-border-strong)", color: "var(--color-text-subtle)" }}
              >
                <RotateCcw size={11} /> Rewatch from start
              </button>
            )}

            {/* Episode Resources */}
            {episodeResources.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border-card)" }}>
                <div
                  className="flex items-center gap-2 px-4 py-3"
                  style={{ background: "var(--color-bg-surface)" }}
                >
                  <Download size={14} style={{ color: "var(--color-accent)" }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--color-text-normal)" }}>
                    Resources ({episodeResources.length})
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: "var(--color-border-card)" }}>
                  {episodeResources.map((r: EpisodeResource) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <FileText size={16} style={{ color: "var(--color-text-subtle)", flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-normal)" }}>{r.title}</p>
                        {r.description && (
                          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--color-text-subtle)" }}>{r.description}</p>
                        )}
                      </div>
                      {r.fileUrl && (
                        <a
                          href={r.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold transition-opacity hover:opacity-80 text-white"
                          style={{ background: "var(--color-accent)" }}
                        >
                          <Download size={11} /> {r.downloadLabel ?? "Download"}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Episode Tasks */}
            {episodeTasks.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border-card)" }}>
                <div
                  className="flex items-center gap-2 px-4 py-3"
                  style={{ background: "var(--color-bg-surface)" }}
                >
                  <ClipboardList size={14} style={{ color: "var(--color-accent)" }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--color-text-normal)" }}>
                    Tasks ({episodeTasks.length})
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: "var(--color-border-card)" }}>
                  {episodeTasks.map((t: EpisodeTask, i: number) => (
                    <div key={t.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span
                          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                          style={{ background: "var(--color-accent)" }}
                        >
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: "var(--color-text-normal)" }}>{t.title}</p>
                          {t.description && (
                            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{t.description}</p>
                          )}
                          {t.deliverables && (
                            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--color-text-subtle)" }}>
                              Deliverable: {t.deliverables}
                            </p>
                          )}
                          {t.estimatedMinutes && (
                            <span className="inline-flex items-center gap-1 mt-1.5 text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--color-surface-xs)", color: "var(--color-text-subtle)" }}>
                              <Clock size={10} /> ~{t.estimatedMinutes} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Course banner */
          <div>
            <div
              className="relative w-full aspect-video rounded-xl overflow-hidden"
              style={{ background: "var(--color-bg-surface)" }}
            >
              {course.thumbnailUrl ? (
                <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play size={48} style={{ color: "var(--color-accent)" }} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-6">
                <h1 className="text-2xl font-bold leading-tight overlay-text">{course.title}</h1>
                {course.description && (
                  <p className="text-sm mt-1 line-clamp-2 overlay-meta">
                    {course.description}
                  </p>
                )}
                <p className="text-xs mt-2 overlay-meta">
                  {completedIds.size} / {lessons.length} completed
                </p>
              </div>
            </div>
            {course.instructor && (
              <div className="mt-3">
                <InstructorCard instructor={course.instructor} />
              </div>
            )}
            {/* Gamification summary — only when no lesson playing */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <CheckCircle2 size={14} />, label: "Completed", value: `${completedIds.size} / ${lessons.length}` },
                { icon: <Zap size={14} />, label: "XP / Lesson", value: `+${(course as any).xpPerEpisode ?? 10}` },
                { icon: <Trophy size={14} />, label: "Pass Score", value: `${(course as any).passingScorePercent ?? 70}%` },
                { icon: <Award size={14} />, label: "Quizzes", value: lessons.filter((l: any) => l.hasQuiz).length },
              ].map(({ icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-xl p-3 text-center"
                  style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
                >
                  <div className="flex justify-center mb-1.5" style={{ color: "var(--color-accent)" }}>{icon}</div>
                  <p className="text-sm font-bold text-foreground">{value}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle)" }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Start / Resume / Review button */}
            {lessons.length > 0 && (() => {
              const firstUnfinished = lessons.find((l: any) => !completedIds.has(l.id) && l.videoUrl);
              const targetLesson = firstUnfinished ?? (lessons.find((l: any) => l.videoUrl) as any ?? null);
              if (!targetLesson) return null;
              const label =
                completedIds.size === 0 ? "Start Learning"
                : completedIds.size >= lessons.length ? "Review Course"
                : "Resume Course";
              return (
                <button
                  onClick={() => handleSelectLessonWithFocus(targetLesson as any)}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "var(--color-accent)" }}
                >
                  <Play size={15} fill="white" /> {label}
                </button>
              );
            })()}
          </div>
        )}
      </div>

      {/* Lesson list */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--color-border-subtle)" }}>
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-bg-surface)" }}
        >
          <div className="text-sm font-semibold" style={{ color: "var(--color-text-normal)" }}>
            {lessons.length} {lessons.length === 1 ? "Lesson" : "Lessons"}
            {completedIds.size > 0 && (
              <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-text-subtle)" }}>
                · {completedIds.size} done
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {reviewDueIds.length > 0 && (
              <span
                className="text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1"
                style={{ background: "color-mix(in srgb, #f59e0b 15%, transparent)", color: "#f59e0b" }}
              >
                <RefreshCw size={9} /> {reviewDueIds.length} to review
              </span>
            )}
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: lifelinesLeft > 0 ? "rgba(34,197,94,0.12)" : "rgba(251,191,36,0.12)",
                color: lifelinesLeft > 0 ? "#22c55e" : "#fbbf24",
              }}
              title="Free lifelines remaining this session"
            >
              <Zap size={9} />
              {lifelinesLeft} lifeline{lifelinesLeft !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setPracticeOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)" }}
            >
              <Brain size={11} /> Practice
            </button>
          </div>
        </div>

        <div>
          {lessons.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: "var(--color-text-disabled)" }}>
              No lessons available yet.
            </p>
          ) : (
            lessons.map((lesson, idx) => {
              // Section grouping — prepend a header before the first lesson of each section
              const lessonSectionId = courseSections.length > 0 ? ((lesson as any).sectionId ?? "__unsectioned__") : null;
              const prevSectionId = courseSections.length > 0 && idx > 0 ? (((lessons[idx - 1]) as any).sectionId ?? "__unsectioned__") : null;
              const isFirstInSection = courseSections.length > 0 && (idx === 0 || lessonSectionId !== prevSectionId);
              const section = lessonSectionId && lessonSectionId !== "__unsectioned__"
                ? courseSections.find((s: any) => s.id === lessonSectionId) : null;
              const isSectionCollapsed = lessonSectionId !== null && collapsedSections.has(lessonSectionId);
              const sectionLessons = section
                ? lessons.filter((l: any) => ((l as any).sectionId ?? null) === section.id)
                : lessons.filter((l: any) => !((l as any).sectionId));
              const completedCount = sectionLessons.filter((l: any) => completedIds.has(l.id)).length;
              const isCompleted = completedIds.has(lesson.id);
              const isActive = selectedLesson?.id === lesson.id;
              const isLocked = (lesson as any).locked === true;
              const isFocusLocked = focusLockedIds.has(lesson.id) && !isCompleted;
              const hasVideo = !!lesson.videoUrl;
              const canPlay = hasVideo && !isLocked && !isFocusLocked;
              const duration = isActive && liveRealDuration > 0 ? liveRealDuration : (lesson.durationSeconds ?? 0);
              const activeLessonDuration = (isActive && activeDuration > 0 ? activeDuration : duration) ?? 0;
              const livePct = isActive && liveWatched > 0 && activeLessonDuration > 0
                ? Math.min(100, Math.round((liveWatched / activeLessonDuration) * 100))
                : 0;
              const focusTimerDuration = getLessonTimerDuration(lesson);
              const timerSecs = lessonTimers[lesson.id];
              const timerStarted = timerSecs !== undefined;
              const timerDone = timerSecs === 0;
              const timerWarn = timerStarted && !timerDone && (timerSecs ?? focusTimerDuration) <= 60;

              return (
                <React.Fragment key={lesson.id}>
                  {/* Section header — rendered before first lesson in each group */}
                  {isFirstInSection && courseSections.length > 0 && (
                    section ? (
                      <button
                        onClick={() => setCollapsedSections(prev => { const next = new Set(prev); if (next.has(lessonSectionId!)) next.delete(lessonSectionId!); else next.add(lessonSectionId!); return next; })}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left border-b"
                        style={{ background: "var(--color-bg-surface)", borderColor: "var(--color-border-subtle)" }}
                      >
                        <ChevronDown size={13} className={`shrink-0 transition-transform ${isSectionCollapsed ? "-rotate-90" : ""}`} style={{ color: "var(--color-text-subtle)" }} />
                        <p className="flex-1 text-xs font-bold uppercase tracking-wide truncate" style={{ color: "var(--color-text-normal)" }}>{section.title}</p>
                        {(section as any).timerSeconds != null && (
                          <span className="text-[10px] shrink-0 font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)", color: "var(--color-accent)" }}>
                            <Timer size={9} />
                            {Math.round((section as any).timerSeconds / 60)}m
                          </span>
                        )}
                        <span className="text-[10px] shrink-0 font-semibold" style={{ color: completedCount === sectionLessons.length ? "var(--color-success)" : "var(--color-text-disabled)" }}>
                          {completedCount}/{sectionLessons.length}
                        </span>
                      </button>
                    ) : (
                      <div className="px-4 py-2 border-b text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--color-text-subtle)", background: "var(--color-bg-surface)", borderColor: "var(--color-border-subtle)" }}>
                        General
                      </div>
                    )
                  )}
                  {!isSectionCollapsed && (
                  <div className="border-b last:border-b-0" style={{ borderColor: "var(--color-border-subtle)" }}>
                  <button
                    onClick={() => canPlay && handleSelectLessonWithFocus(lesson)}
                    disabled={!canPlay}
                    title={isLocked ? "Complete the previous lesson to unlock." : isFocusLocked ? "Use a lifeline to unlock this lesson." : undefined}
                    aria-disabled={!canPlay}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-4 text-left transition-colors",
                      canPlay
                        ? "cursor-pointer hover:opacity-90"
                        : "cursor-not-allowed opacity-60",
                    )}
                    style={{
                      background: isFocusLocked
                        ? "rgba(239,68,68,0.04)"
                        : isActive
                          ? "color-mix(in srgb, var(--color-accent) 18%, var(--color-bg-surface))"
                          : "var(--color-bg-surface)",
                    }}
                  >
                    <span
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: isLocked || isFocusLocked
                          ? "var(--color-surface-overlay-md)"
                          : isCompleted
                            ? "var(--color-success)"
                            : isActive
                              ? "var(--color-accent)"
                              : "var(--color-surface-overlay-lg)",
                        color: isLocked || isFocusLocked
                          ? isFocusLocked ? "#ef4444" : "var(--color-text-disabled)"
                          : isCompleted || isActive
                            ? "#fff"
                            : "var(--color-text-subtle)",
                      }}
                    >
                      {isLocked || isFocusLocked
                        ? <Lock size={13} />
                        : isCompleted
                          ? <CheckCircle2 size={14} />
                          : idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-strong)" }}>
                        {lesson.title}
                      </p>
                      {duration && duration > 0 && (
                        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--color-text-subtle)" }}>
                          <Clock size={10} /> {fmtDuration(duration)}
                        </p>
                      )}
                      {!isActive && lesson.description && (
                        <p className="text-xs line-clamp-1 mt-0.5" style={{ color: "var(--color-text-subtle)" }}>
                          {lesson.description}
                        </p>
                      )}
                      {/* Quiz badge + XP chip + focus timer */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {(lesson as any).hasQuiz && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                            style={{
                              background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                              color: "var(--color-accent)",
                            }}
                          >
                            Quiz
                          </span>
                        )}
                        {((course as any).xpPerEpisode ?? 0) > 0 && (
                          <span
                            className="text-[10px] flex items-center gap-0.5 font-semibold"
                            style={{ color: "var(--color-text-disabled)" }}
                          >
                            <Zap size={9} />+{(course as any).xpPerEpisode} XP
                          </span>
                        )}
                        {reviewDueIds.includes(lesson.id) && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide flex items-center gap-0.5"
                            style={{ background: "color-mix(in srgb, #f59e0b 12%, transparent)", color: "#f59e0b" }}
                          >
                            <RefreshCw size={8} /> Review
                          </span>
                        )}
                        {/* Focus timer badge */}
                        {!isCompleted && timerStarted && (
                          <span
                            className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              background: timerDone
                                ? "rgba(34,197,94,0.12)"
                                : timerWarn
                                  ? "rgba(239,68,68,0.1)"
                                  : "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                              color: timerDone ? "#22c55e" : timerWarn ? "#ef4444" : "var(--color-accent)",
                            }}
                          >
                            <Timer size={9} />
                            {timerDone ? "Time's up!" : fmtTime(timerSecs!)}
                          </span>
                        )}
                      </div>
                      {/* Live progress bar for active lesson */}
                      {isActive && livePct > 0 && (
                        <div className="h-0.5 rounded-full overflow-hidden mt-1.5" style={{ background: "var(--color-progress-track)" }}>
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{ width: `${livePct}%`, background: "var(--color-accent)" }}
                          />
                        </div>
                      )}
                    </div>

                    {isActive ? (
                      <Play size={14} fill="currentColor" style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                    ) : isCompleted ? (
                      <CheckCircle2 size={15} style={{ color: "var(--color-success)", flexShrink: 0 }} />
                    ) : null}
                  </button>

                  {/* Focus-locked lifeline banner */}
                  {isFocusLocked && (
                    <div
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                      style={{ background: "rgba(239,68,68,0.06)", borderTop: "1px solid rgba(239,68,68,0.15)" }}
                    >
                      <div className="flex items-center gap-2">
                        <Lock size={12} style={{ color: "#ef4444" }} />
                        <span className="text-xs font-bold" style={{ color: "#ef4444" }}>
                          Lesson locked — timer expired
                        </span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUseLifeline(lesson, focusTimerDuration); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shrink-0 transition-opacity hover:opacity-80"
                        style={{ background: lifelinesLeft > 0 ? "var(--color-accent)" : "#d97706" }}
                      >
                        <Zap size={11} />
                        {lifelinesLeft > 0
                          ? `Get Lifeline (${lifelinesLeft} free)`
                          : `Lifeline (${LIFELINE_COIN_COST} coins)`}
                      </button>
                    </div>
                  )}
                  </div>
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      {/* XP + Streak */}
      <XpStreakWidget courseId={courseId} />

      {/* Reflections panel — shows after first reflection saved; click to review */}
      {reflectionCount > 0 && (
        <button
          onClick={() => setReflectionsOpen(true)}
          className="w-full rounded-xl px-4 py-3 flex items-center gap-3 text-left transition-opacity hover:opacity-80"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
        >
          <PenLine size={14} style={{ color: "var(--color-accent)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>
              Reflections
            </p>
            <p className="text-sm font-semibold text-foreground">
              {reflectionCount} saved — tap to review
            </p>
          </div>
          <ChevronDown size={14} style={{ color: "var(--color-text-disabled)" }} className="rotate-[-90deg]" />
        </button>
      )}

      {/* Leaderboard */}
      <LeaderboardWidget courseId={courseId} />

      {/* Certificate progress — always visible when not yet complete */}
      {certData && !certData.eligible && (
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Award size={14} style={{ color: "var(--color-text-subtle)" }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-text-subtle)" }}>
                Certificate Progress
              </span>
            </div>
            {(certData.remainingLessons ?? 0) > 0 && (
              <span className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                {certData.remainingLessons} lesson{certData.remainingLessons !== 1 ? "s" : ""} left
              </span>
            )}
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "var(--color-progress-track)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${certData.completionPercentage ?? 0}%`,
                background: "var(--color-accent)",
              }}
            />
          </div>
          <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {certData.completionPercentage ?? 0}% complete — finish all lessons to earn your certificate
          </p>
        </div>
      )}

      {/* Certificate CTA */}
      {certData?.eligible && (
        <div
          className="rounded-xl p-5 flex items-center gap-4"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-surface))",
            border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)",
          }}
        >
          <div
            className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--color-accent) 20%, transparent)" }}
          >
            <Award size={24} style={{ color: "var(--color-accent)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm">You completed this course!</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-normal)" }}>
              Your certificate of completion is ready.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {me?.id && (
              <button
                onClick={handleShareCert}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                style={{
                  border: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)",
                  color: "var(--color-accent)",
                }}
                title="Copy shareable link"
              >
                {certCopied ? <Check size={13} /> : <Copy size={13} />}
                {certCopied ? "Copied!" : "Share"}
              </button>
            )}
            <button
              disabled={downloadingCert}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "var(--color-accent)" }}
              onClick={async () => {
                setDownloadingCert(true);
                try {
                  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
                  const res = await fetch(`${apiBase}/api/user/courses/${courseId}/certificate`, { credentials: "include" });
                  if (!res.ok) { toast.error("Certificate not ready yet."); return; }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `certificate-${courseId}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast.error("Failed to download certificate.");
                } finally {
                  setDownloadingCert(false);
                }
              }}
            >
              {downloadingCert ? <Loader2 size={13} className="animate-spin" /> : <Award size={13} />}
              {downloadingCert ? "Preparing..." : "Download"}
            </button>
          </div>
        </div>
      )}

      {/* Related courses */}
      {(course as any).upsellCourses?.length > 0 && (
        <RelatedCourses courses={(course as any).upsellCourses} title="You might also like" />
      )}
      {(course as any).crossSellCourses?.length > 0 && (
        <RelatedCourses courses={(course as any).crossSellCourses} title="Related Courses" />
      )}

      {/* Mid-video cue quiz — pauses player until dismissed */}
      {cueQuizModal && (
        <CueQuizModal questions={cueQuizModal.questions} onClose={handleCloseCueQuiz} />
      )}

      {/* Practice Arena modal */}
      {practiceOpen && (
        <PracticeArenaModal course={course} completedIds={completedIds} onClose={() => setPracticeOpen(false)} />
      )}

      {/* Video feedback modal — triggered after lesson completion */}
      {feedbackEpisodeId && feedbackQuestions.length > 0 && (
        <FeedbackModal
          episodeId={feedbackEpisodeId}
          episodeType="course"
          questions={feedbackQuestions}
          onClose={() => setFeedbackEpisodeId(null)}
        />
      )}

      {/* Reflection modal — triggered after lesson completion */}
      {pendingReflection && (
        <ReflectionModal
          lessonId={pendingReflection.lessonId}
          lessonTitle={pendingReflection.title}
          courseId={courseId}
          onClose={(saved) => {
            setPendingReflection(null);
            if (saved) setReflectionCount(c => c + 1);
          }}
        />
      )}

      {/* Reflections viewer — opened from the panel */}
      {reflectionsOpen && reflectionCount > 0 && visibleReflections.length > 0 && (
        <ReflectionsViewerModal
          reflections={visibleReflections}
          lessons={course?.lessons ?? []}
          onClose={() => setReflectionsOpen(false)}
        />
      )}

      {/* XP flash */}
      {xpFlash !== null && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl font-bold text-white text-sm animate-bounce"
          style={{ background: "var(--color-accent)" }}
        >
          <Zap size={16} /> +{xpFlash} XP earned!
        </div>
      )}

      {/* Quiz modal */}
      {quizModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-medium)" }}
          >
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: "var(--color-border-subtle)" }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-accent)" }}>Episode Quiz</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">Quiz</p>
              </div>
              {!quizResult && (
                <button onClick={() => handleCloseQuiz(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X size={18} />
                </button>
              )}
            </div>

            {quizResult ? (
              <div className="p-6 text-center space-y-4">
                <div className={`text-5xl font-bold ${quizResult.passed ? "text-green-400" : "text-red-400"}`}>
                  {quizResult.score}%
                </div>
                <p className="text-foreground font-semibold">{quizResult.passed ? "🎉 Passed!" : "Not quite — try again"}</p>
                <p className="text-sm" style={{ color: "var(--color-text-subtle)" }}>
                  {quizResult.correct} / {quizResult.total} correct
                </p>
                {quizResult.passed && xpFlash !== null && (
                  <div className="flex items-center justify-center gap-1.5 text-sm font-bold" style={{ color: "var(--color-accent)" }}>
                    <Zap size={14} /> +{xpFlash} XP awarded
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  {!quizResult.passed && (
                    <button
                      onClick={() => { setQuizAnswers({}); setQuizResult(null); }}
                      className="flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors"
                      style={{ borderColor: "var(--color-border-strong)", color: "var(--color-text-normal)" }}
                    >
                      Try Again
                    </button>
                  )}
                  <button
                    onClick={() => handleCloseQuiz(true)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                    style={{ background: "var(--color-accent)" }}
                  >
                    {quizResult.passed ? "Continue" : "Skip"}
                  </button>
                </div>
              </div>
            ) : (
              <QuizQuestions
                questions={quizModal.questions}
                courseId={courseId}
                episodeId={quizModal.episodeId}
                answers={quizAnswers}
                setAnswers={setQuizAnswers}
                onSubmit={async (answers) => {
                  try {
                    const res = await submitQuiz.mutateAsync(answers);
                    const result = (res as any).data ?? res;
                    setQuizResult(result);
                    if (result.passed && (course as any).xpPerEpisode) {
                      setXpFlash((course as any).xpPerEpisode);
                      xpFlashedRef.current = selectedLessonRef.current?.id ?? null;
                      setTimeout(() => setXpFlash(null), 3000);
                    }
                  } catch (e: any) {
                    toast.error(e.message || "Failed to submit quiz");
                  }
                }}
                isSubmitting={submitQuiz.isPending}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quiz questions component ──────────────────────────────────────────────────
function QuizQuestions({
  questions, courseId, episodeId, answers, setAnswers, onSubmit, isSubmitting,
}: {
  questions: any[]; courseId: string; episodeId: string;
  answers: Record<string, string>; setAnswers: (a: Record<string, string>) => void;
  onSubmit: (a: Record<string, string>) => void; isSubmitting: boolean;
}) {

  if (!questions.length) {
    return (
      <div className="p-6 text-center text-sm" style={{ color: "var(--color-text-subtle)" }}>
        No quiz questions configured.
      </div>
    );
  }

  const allAnswered = questions.every((q: any) => answers[q.id]);

  return (
    <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
      {questions.map((q: any, qi: number) => (
        <div key={q.id}>
          <p className="text-sm font-medium text-foreground mb-3">{qi + 1}. {q.question}</p>
          <div className="space-y-2">
            {q.options?.map((opt: any) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAnswers({ ...answers, [q.id]: opt.id })}
                className="w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all border"
                style={{
                  borderColor: answers[q.id] === opt.id ? "var(--color-accent)" : "var(--color-border-medium)",
                  background: answers[q.id] === opt.id ? "color-mix(in srgb, var(--color-accent) 15%, transparent)" : "transparent",
                  color: answers[q.id] === opt.id ? "var(--color-text-strong)" : "var(--color-text-normal)",
                }}
              >
                {opt.text}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button
        onClick={() => onSubmit(answers)}
        disabled={!allAnswered || isSubmitting}
        className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
        style={{ background: "var(--color-accent)" }}
      >
        {isSubmitting ? "Submitting..." : "Submit Answers"}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Sun, Sparkles, Target, Dumbbell, Coffee,
  ChevronDown, ChevronUp, CheckCircle2,
} from "lucide-react";
import { useRitualHabits, useRitualsButtonsConfig } from "@/lib/hooks/useRituals";
import type { Habit } from "@/types";

// ─── Fallbacks (mirror mobile) ───────────────────────────────────────────────

const FALLBACK_HABITS: Habit[] = [
  { id: "f1", icon: "fa-sun", rawQuestion: "Did you write your morning pages?", highlightWord: "morning pages", subtitle: "Build clarity. Boost focus. Start your day right.", sortOrder: 0, status: "active" },
  { id: "f2", icon: "fa-spa", rawQuestion: "Did you meditate for 10 minutes?", highlightWord: "for 10 minutes", subtitle: "A clear mind drives sharper decisions.", sortOrder: 1, status: "active" },
  { id: "f3", icon: "fa-bullseye", rawQuestion: "Did you plan your daily goals?", highlightWord: "daily goals", subtitle: "Intentional planning shapes powerful outcomes.", sortOrder: 2, status: "active" },
  { id: "f4", icon: "fa-dumbbell", rawQuestion: "Did you exercise or stretch today?", highlightWord: "stretch today", subtitle: "Move your body, sharpen your mind.", sortOrder: 3, status: "active" },
  { id: "f5", icon: "fa-coffee", rawQuestion: "Did you eat a healthy breakfast?", highlightWord: "healthy breakfast", subtitle: "Fuel up for a productive day ahead.", sortOrder: 4, status: "active" },
];

// ─── Icon map ────────────────────────────────────────────────────────────────

function HabitIcon({ icon, size = 28 }: { icon: string; size?: number }) {
  const props = { size, strokeWidth: 1.5 };
  switch (icon) {
    case "fa-sun":      return <Sun {...props} />;
    case "fa-spa":      return <Sparkles {...props} />;
    case "fa-bullseye": return <Target {...props} />;
    case "fa-dumbbell": return <Dumbbell {...props} />;
    case "fa-coffee":   return <Coffee {...props} />;
    default:            return <Sun {...props} />;
  }
}

// ─── Highlight renderer ──────────────────────────────────────────────────────

function HighlightedQuestion({ text, word }: { text: string; word: string }) {
  if (!word) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(word.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: "var(--color-accent)" }}>{text.slice(idx, idx + word.length)}</span>
      {text.slice(idx + word.length)}
    </>
  );
}

// ─── Main card ───────────────────────────────────────────────────────────────

export function MorningRitualCard() {
  const { data: habits } = useRitualHabits();
  const { data: buttons } = useRitualsButtonsConfig();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(boolean | null)[]>([]);
  const [expanded, setExpanded] = useState(true);

  const list = (habits && habits.length > 0) ? habits : FALLBACK_HABITS;
  const yesLabel = buttons?.yesLabel ?? "Yes";
  const notYetLabel = buttons?.notYetLabel ?? "Not Yet";

  const answeredCount = answers.filter((a) => a !== null && a !== undefined).length;
  const isComplete = answeredCount === list.length && list.length > 0;
  const currentHabit = list[step];

  const answer = (value: boolean) => {
    const next = [...answers];
    next[step] = value;
    setAnswers(next);
    if (step < list.length - 1) {
      setTimeout(() => setStep((s) => s + 1), 220);
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2.5">
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)", color: "var(--color-accent)" }}
          >
            Morning Ritual
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
            style={{
              background: isComplete
                ? "color-mix(in srgb, var(--color-success, #16a34a) 15%, transparent)"
                : "var(--color-surface-overlay)",
              color: isComplete ? "var(--color-success, #16a34a)" : "var(--color-text-secondary)",
            }}
          >
            {isComplete ? "Completed ✓" : `${Math.min(step + 1, list.length)} / ${list.length}`}
          </span>
          {expanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Progress bars */}
      <div className="flex gap-1 px-4 pb-3">
        {list.map((_, i) => {
          const done = answers[i] !== null && answers[i] !== undefined;
          const active = i === step && !isComplete;
          return (
            <div key={i} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--color-surface-overlay)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: (done || active) ? "100%" : "0%",
                  background: done
                    ? "var(--color-accent)"
                    : "color-mix(in srgb, var(--color-accent) 40%, transparent)",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-5">
          {isComplete ? (
            /* ── Completion state ── */
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "color-mix(in srgb, var(--color-success, #16a34a) 12%, transparent)" }}
              >
                <CheckCircle2 size={32} style={{ color: "var(--color-success, #16a34a)" }} />
              </div>
              <div>
                <p className="font-bold text-foreground text-base">Morning Ritual Completed!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Success! You checked off {answers.filter(Boolean).length} of {list.length} morning habits.
                </p>
              </div>
            </div>
          ) : currentHabit ? (
            /* ── Active habit ── */
            <div>
              {/* Step nav dots */}
              {list.length > 1 && (
                <div className="flex justify-center gap-1.5 mb-5">
                  {list.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      className="rounded-full transition-all"
                      style={{
                        width: i === step ? 20 : 6,
                        height: 6,
                        background: i === step
                          ? "var(--color-accent)"
                          : "var(--color-surface-overlay)",
                      }}
                      aria-label={`Go to habit ${i + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Icon + question */}
              <div className="flex flex-col items-center gap-4 text-center mb-6">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                    color: "var(--color-accent)",
                  }}
                >
                  <HabitIcon icon={currentHabit.icon} size={28} />
                </div>

                <div className="space-y-1.5">
                  <p className="text-base font-semibold text-foreground leading-snug">
                    <HighlightedQuestion text={currentHabit.rawQuestion} word={currentHabit.highlightWord} />
                  </p>
                  {currentHabit.subtitle && (
                    <p className="text-sm text-muted-foreground">{currentHabit.subtitle}</p>
                  )}
                </div>
              </div>

              {/* Answer buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => answer(false)}
                  className="flex-1 h-11 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                  style={{
                    background: "var(--color-surface-overlay)",
                    color: "var(--color-text-secondary)",
                    border: "1px solid var(--color-border-subtle)",
                  }}
                >
                  {notYetLabel}
                </button>
                <button
                  onClick={() => answer(true)}
                  className="flex-1 h-11 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: "var(--color-accent)" }}
                >
                  {yesLabel}
                </button>
              </div>

              {/* Back/skip nav */}
              {list.length > 1 && (
                <div className="flex justify-between mt-3">
                  <button
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    disabled={step === 0}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep((s) => Math.min(list.length - 1, s + 1))}
                    disabled={step === list.length - 1}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    Skip →
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

"use client";

// Floating Learning Roadmap for a course page. A small circular map button fixed
// to the bottom-right corner opens a panel with a winding path of diamond-shaped
// levels — one per course section, in order.
// Levels come from buildRoadmapLevels (lib/utils/roadmapLevels.ts) over the same
// section groups and progress the lesson sidebar uses, so nothing is stored or
// computed separately: progress is the member's existing lesson progress, and
// unlocking follows the course's existing rules. Clicking an open level hands its
// next lesson to the page's normal lesson-open flow.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Lock, Map as MapIcon, X } from "lucide-react";
import { usePodcastPlayer } from "@/lib/stores/usePodcastPlayer";
import { roadmapSummary, type RoadmapLevel, type RoadmapLesson } from "@/lib/utils/roadmapLevels";

const PANEL_WIDTH = 300;
const PATH_WIDTH = 120; // left column the path snakes through
const ROW_HEIGHT = 92;
const DIAMOND = 38;
const TOP_PAD = 34;
// The path alternates between two x positions so consecutive levels connect with
// a gentle S-curve — strictly top-to-bottom, so it never loops back on itself.
const X_POSITIONS = [34, 86];

const STATE_LABEL: Record<RoadmapLevel["state"], string> = {
  completed: "Completed",
  current: "In progress",
  available: "Available",
  locked: "Locked",
};

function nodePoint(i: number) {
  return { x: X_POSITIONS[i % 2], y: TOP_PAD + i * ROW_HEIGHT };
}

/** Cubic segment between two consecutive nodes (vertical tangents → smooth, loop-free curve). */
function segment(i: number) {
  const a = nodePoint(i);
  const b = nodePoint(i + 1);
  const mid = (b.y - a.y) / 2;
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + mid}, ${b.x} ${b.y - mid}, ${b.x} ${b.y}`;
}

function nodeColors(state: RoadmapLevel["state"]) {
  switch (state) {
    case "completed":
      return { fill: "var(--color-success)", border: "var(--color-success)", text: "#fff" };
    case "current":
      return { fill: "var(--color-accent)", border: "var(--color-accent)", text: "#fff" };
    case "available":
      return { fill: "var(--color-bg-surface)", border: "var(--color-accent)", text: "var(--color-accent)" };
    default:
      return { fill: "var(--color-surface-overlay)", border: "var(--color-border-subtle)", text: "var(--color-text-subtle)" };
  }
}

export default function LearningRoadmap<L extends RoadmapLesson>({
  levels,
  onOpenLesson,
  title,
}: {
  levels: RoadmapLevel<L>[];
  onOpenLesson: (lesson: L) => void;
  /** Course name, shown in the panel when the page itself doesn't make it obvious (e.g. /courses). */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const summary = useMemo(() => roadmapSummary(levels), [levels]);
  const miniPlayerVisible = usePodcastPlayer((s) => !!s.episode);
  // Pin the trigger to the *visible* screen corner. `position: fixed` measures from
  // the layout viewport, which a page wider/taller than a phone screen enlarges, so
  // plain right/bottom (the CSS fallback) could land off-screen there.
  const [visibleCorner, setVisibleCorner] = useState<{ right: number; bottom: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVisibleCorner({ right: vv.offsetLeft + vv.width, bottom: vv.offsetTop + vv.height });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    // Bring the member's current level into view inside the panel only (never the page).
    const scroller = scrollerRef.current;
    const currentIndex = levels.findIndex((l) => l.state === "current");
    if (scroller && currentIndex > 0) {
      scroller.scrollTop = Math.max(0, nodePoint(currentIndex).y - scroller.clientHeight / 2);
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- scroll only when the panel opens

  if (levels.length === 0) return null;

  const height = TOP_PAD * 2 + (levels.length - 1) * ROW_HEIGHT;

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Learning roadmap"
          className="fixed left-6 md:left-8 top-1/2 -translate-y-1/2 z-30 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{
            width: `min(${PANEL_WIDTH}px, calc(100vw - 2rem))`,
            maxHeight: "min(70vh, 560px)",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-subtle)",
          }}
        >
          <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)" }}>
                Learning roadmap
              </p>
              {title && (
                <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: "var(--color-text-normal)" }}>
                  {title}
                </p>
              )}
              <p className="text-sm font-bold mt-0.5" style={{ color: "var(--color-text-normal)" }}>
                {summary.completed} of {summary.total} levels completed
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close roadmap"
              className="p-1.5 rounded-lg shrink-0"
              style={{ background: "var(--color-surface-overlay-xs)", color: "var(--color-text-secondary)" }}
            >
              <X size={14} />
            </button>
          </div>

          <div ref={scrollerRef} className="overflow-y-auto px-2">
            <ol className="relative" style={{ height }} aria-label="Levels">
              <svg data-roadmap-path className="absolute left-0 top-0" width={PATH_WIDTH} height={height} aria-hidden="true">
                {levels.slice(0, -1).map((lvl, i) => {
                  const reached = levels[i + 1].state !== "locked";
                  return (
                    <path
                      key={i}
                      d={segment(i)}
                      fill="none"
                      strokeWidth={reached ? 4 : 3}
                      strokeLinecap="round"
                      strokeDasharray={reached ? undefined : "2 7"}
                      style={{ stroke: reached ? (lvl.state === "completed" ? "var(--color-success)" : "var(--color-accent)") : "var(--color-border-subtle)" }}
                    />
                  );
                })}
              </svg>

              {levels.map((lvl, i) => {
                const p = nodePoint(i);
                const c = nodeColors(lvl.state);
                const locked = lvl.state === "locked";
                return (
                  <li key={lvl.id ?? "general"} className="absolute left-0 right-0" style={{ top: p.y - DIAMOND / 2, height: DIAMOND }}>
                    <button
                      type="button"
                      disabled={locked || !lvl.target}
                      onClick={() => {
                        if (!lvl.target) return;
                        setOpen(false);
                        onOpenLesson(lvl.target);
                      }}
                      aria-label={`Level ${lvl.number}: ${lvl.title} — ${STATE_LABEL[lvl.state]}, ${lvl.completed} of ${lvl.total} lessons completed`}
                      data-level-state={lvl.state}
                      className="group flex items-center w-full h-full text-left disabled:cursor-not-allowed"
                    >
                      {/* Diamond node */}
                      <span
                        className="absolute flex items-center justify-center rotate-45 rounded-[7px] transition-transform group-enabled:group-hover:scale-110"
                        style={{
                          left: p.x - DIAMOND / 2 + 4,
                          width: DIAMOND - 8,
                          height: DIAMOND - 8,
                          top: 4,
                          background: c.fill,
                          border: `2px solid ${c.border}`,
                          boxShadow: lvl.state === "current" ? "0 0 0 4px color-mix(in srgb, var(--color-accent) 25%, transparent)" : undefined,
                        }}
                      >
                        <span className="-rotate-45 text-[11px] font-extrabold tabular-nums" style={{ color: c.text }}>
                          {lvl.state === "completed" ? <Check size={14} strokeWidth={3} /> : locked ? <Lock size={12} /> : lvl.number}
                        </span>
                      </span>
                      {/* Label */}
                      <span className="min-w-0 pr-2" style={{ marginLeft: PATH_WIDTH + 4 }}>
                        <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: locked ? "var(--color-text-subtle)" : "var(--color-text-secondary)" }}>
                          Level {lvl.number} · {STATE_LABEL[lvl.state]}
                        </span>
                        <span className="block text-xs font-semibold truncate" style={{ color: locked ? "var(--color-text-subtle)" : "var(--color-text-normal)" }}>
                          {lvl.title}
                        </span>
                        <span className="block text-[10px] tabular-nums" style={{ color: "var(--color-text-subtle)" }}>
                          {lvl.completed}/{lvl.total} lessons
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {/* Circular trigger, fixed bottom-right (safe-area aware). Lifted above the
          podcast mini-player when it is showing; z-30 keeps it under the course
          page's bottom-right XP flashes (z-50). The soft glow runs only while the
          panel is closed and is disabled for prefers-reduced-motion. */}
      <style>{`
        @keyframes tbt-roadmap-fab-glow {
          0%, 100% { box-shadow: 0 6px 16px rgba(0,0,0,0.28), 0 0 0 0 color-mix(in srgb, var(--color-accent) 45%, transparent); }
          50% { box-shadow: 0 6px 16px rgba(0,0,0,0.28), 0 0 0 10px color-mix(in srgb, var(--color-accent) 0%, transparent); }
        }
        .tbt-roadmap-fab {
          right: calc(1rem + env(safe-area-inset-right, 0px));
          bottom: calc(var(--tbt-roadmap-fab-offset, 1rem) + env(safe-area-inset-bottom, 0px));
        }
        .tbt-roadmap-fab[data-glow="true"] { animation: tbt-roadmap-fab-glow 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .tbt-roadmap-fab[data-glow="true"] { animation: none; }
          .tbt-roadmap-fab { transition: none; }
        }
      `}</style>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Learning roadmap: ${summary.completed} of ${summary.total} levels completed`}
        title="Learning Roadmap"
        data-glow={!open}
        className="tbt-roadmap-fab fixed z-30 w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-200 ease-out md:hover:scale-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          ["--tbt-roadmap-fab-offset" as string]: miniPlayerVisible ? "6rem" : "1rem",
          // The pages render this inside a `space-y-*` stack, whose sibling top margin
          // would otherwise shift a top-anchored fixed button down.
          margin: 0,
          ...(visibleCorner
            ? {
                right: "auto",
                bottom: "auto",
                left: `calc(${visibleCorner.right}px - 4rem - env(safe-area-inset-right, 0px))`,
                top: `calc(${visibleCorner.bottom}px - 3rem - var(--tbt-roadmap-fab-offset) - env(safe-area-inset-bottom, 0px))`,
              }
            : {}),
          background: "var(--color-accent)",
          color: "#fff",
          boxShadow: "0 6px 16px rgba(0,0,0,0.28)",
          outlineColor: "var(--color-accent)",
        }}
      >
        <MapIcon size={22} strokeWidth={2.25} aria-hidden />
      </button>
    </>
  );
}

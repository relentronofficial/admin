"use client";

// Floating Learning Roadmap. A small circular map button fixed to the bottom-right
// corner opens a game-style level map in a modal popup: round level nodes on a
// winding S-shaped road that flows down the page, alternating left and right —
// one level per course section, in order. A second tab shows the member's
// batch-program growth milestones (lib/utils/growthMilestones.ts) on the same map.
// Levels come from buildRoadmapLevels (lib/utils/roadmapLevels.ts) over the same
// section groups and progress the lesson sidebar uses, so nothing is stored or
// computed separately: progress is the member's existing lesson progress, and
// unlocking follows the course's existing rules. Clicking an open level hands its
// next lesson to the page's normal lesson-open flow; locked levels never open.
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Check, Flag, Loader2, Lock, Map as MapIcon, MapPin, Trophy, X } from "lucide-react";
import { usePodcastPlayer } from "@/lib/stores/usePodcastPlayer";
import { roadmapSummary, type RoadmapLevel, type RoadmapLesson } from "@/lib/utils/roadmapLevels";
import { useMyWeeklyGraph } from "@/lib/hooks/useBatchProgram";
import { buildGrowthMilestones, type GrowthMilestoneLevel } from "@/lib/utils/growthMilestones";

// ── Map geometry ──────────────────────────────────────────────────────────────
// Node centres alternate between two lanes (percent of the map width) and step
// down a fixed row height, so consecutive levels join with a smooth S-curve that
// always runs downward — never looping back.
const LANES = [28, 72];
const ROW_HEIGHT = 132;
const TOP_PAD = 96; // room for the "Start" flag above Level 1
const BOTTOM_PAD = 104; // room for the finish trophy below the last level
const NODE = 60;

const STATE_LABEL: Record<RoadmapLevel["state"], string> = {
  completed: "Completed",
  current: "In progress",
  available: "Unlocked",
  locked: "Locked",
};

export function levelPoint(i: number) {
  return { x: LANES[i % 2], y: TOP_PAD + i * ROW_HEIGHT };
}

/** Cubic segment between consecutive nodes, in a 0–100 (x) by pixel (y) space. */
export function roadSegment(i: number) {
  const a = levelPoint(i);
  const b = levelPoint(i + 1);
  const mid = (b.y - a.y) / 2;
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + mid}, ${b.x} ${b.y - mid}, ${b.x} ${b.y}`;
}

function nodeColors(state: RoadmapLevel["state"]) {
  switch (state) {
    case "completed":
      return { fill: "var(--color-success)", ring: "color-mix(in srgb, var(--color-success) 35%, transparent)", text: "#fff" };
    case "current":
      return { fill: "var(--color-accent)", ring: "color-mix(in srgb, var(--color-accent) 35%, transparent)", text: "#fff" };
    case "available":
      return { fill: "var(--color-bg-surface)", ring: "color-mix(in srgb, var(--color-accent) 30%, transparent)", text: "var(--color-accent)" };
    default:
      return { fill: "var(--color-surface-overlay-md, #d4d4d8)", ring: "transparent", text: "var(--color-text-subtle)" };
  }
}

type Status = "loading" | "error" | "ready";

export default function LearningRoadmap<L extends RoadmapLesson>({
  levels,
  onOpenLesson,
  title,
  status = "ready",
  onRetry,
}: {
  levels: RoadmapLevel<L>[];
  onOpenLesson: (lesson: L) => void;
  /** Course name, shown in the popup header. */
  title?: string;
  /** Data state of the course/progress behind the levels (defaults to ready). */
  status?: Status;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
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

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      // Keep Tab focus inside the popup.
      if (e.key === "Tab" && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- set up once per opening

  const [tab, setTab] = useState<"growth" | "course">("growth");
  const courseNodes = useMemo(
    () =>
      levels.map(
        (lvl): MapNode => ({
          key: lvl.id ?? "general",
          kicker: `Level ${lvl.number}`,
          number: lvl.number,
          title: lvl.title,
          state: lvl.state,
          locked: lvl.state === "locked" || !lvl.target,
          detail: `${lvl.total > 0 ? `${lvl.completed}/${lvl.total} lessons` : "No lessons yet"} · ${STATE_LABEL[lvl.state]}`,
          ariaLabel: `Level ${lvl.number}: ${lvl.title} — ${STATE_LABEL[lvl.state]}, ${lvl.total > 0 ? `${lvl.completed} of ${lvl.total} lessons completed` : "no lessons yet"}`,
          onActivate:
            lvl.state === "locked" || !lvl.target
              ? null
              : () => {
                  setOpen(false);
                  onOpenLesson(lvl.target as L);
                },
        }),
      ),
    [levels, onOpenLesson],
  );
  const progressPct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  const popup =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="tbt-roadmap-overlay fixed left-0 top-0 z-[60] flex items-end sm:items-center justify-center sm:p-6"
            style={{
              // Fill the *visible* screen (see visibleCorner above).
              width: visibleCorner ? visibleCorner.right : "100vw",
              height: visibleCorner ? visibleCorner.bottom : "100vh",
              background: "rgba(0,0,0,0.6)",
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="tbt-roadmap-title"
              className="flex flex-col w-full sm:max-w-3xl lg:max-w-4xl h-full sm:rounded-3xl overflow-hidden shadow-2xl"
              style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)" }}
            >
              {/* Header: heading, course, progress, legend, close */}
              <div className="px-5 pt-5 pb-4 space-y-3" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="tbt-roadmap-title" className="text-lg font-extrabold flex items-center gap-2" style={{ color: "var(--color-text-normal)" }}>
                      <MapIcon size={20} style={{ color: "var(--color-accent)" }} aria-hidden /> Learning Roadmap
                    </h2>
                    {title && (
                      <p className="text-sm mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>
                        {title}
                      </p>
                    )}
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={close}
                    aria-label="Close roadmap"
                    className="p-2 rounded-full shrink-0 focus-visible:outline focus-visible:outline-2"
                    style={{ background: "var(--color-surface-overlay-xs)", color: "var(--color-text-normal)", outlineColor: "var(--color-accent)" }}
                  >
                    <X size={18} />
                  </button>
                </div>
                {status === "ready" && levels.length > 0 && (
                  <>
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                        <span>
                          {summary.completed} of {summary.total} levels completed
                        </span>
                        <span className="tabular-nums">{progressPct}%</span>
                      </div>
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ background: "var(--color-surface-overlay-xs)" }}
                        role="progressbar"
                        aria-label="Roadmap progress"
                        aria-valuemin={0}
                        aria-valuemax={summary.total}
                        aria-valuenow={summary.completed}
                      >
                        <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, var(--color-success), var(--color-accent))" }} />
                      </div>
                    </div>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-semibold" aria-label="Legend" style={{ color: "var(--color-text-secondary)" }}>
                      <li className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center" style={{ background: "var(--color-success)" }}>
                          <Check size={9} strokeWidth={3} color="#fff" />
                        </span>
                        Completed
                      </li>
                      <li className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full" style={{ background: "var(--color-accent)" }} />
                        Current / unlocked
                      </li>
                      <li className="inline-flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center" style={{ background: "var(--color-surface-overlay-md, #d4d4d8)" }}>
                          <Lock size={8} />
                        </span>
                        Locked
                      </li>
                    </ul>
                  </>
                )}
              </div>

              {/* Tabs: growth milestones | this course */}
              <div
                role="tablist"
                aria-label="Roadmap view"
                className="flex gap-1 px-5 pt-3"
                onKeyDown={(e) => {
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  e.preventDefault();
                  const next = tab === "growth" ? "course" : "growth";
                  setTab(next);
                  document.getElementById(`tbt-roadmap-tab-${next}`)?.focus();
                }}
              >
                {(["growth", "course"] as const).map((t) => (
                  <button
                    key={t}
                    id={`tbt-roadmap-tab-${t}`}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    aria-controls="tbt-roadmap-panel"
                    tabIndex={tab === t ? 0 : -1}
                    onClick={() => setTab(t)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-bold focus-visible:outline focus-visible:outline-2"
                    style={{
                      background: tab === t ? "var(--color-accent)" : "var(--color-surface-overlay-xs)",
                      color: tab === t ? "#fff" : "var(--color-text-secondary)",
                      outlineColor: "var(--color-accent)",
                    }}
                  >
                    {t === "growth" ? "Growth milestones" : "This course"}
                  </button>
                ))}
              </div>

              {/* Map / states */}
              <div
                ref={scrollerRef}
                id="tbt-roadmap-panel"
                role="tabpanel"
                aria-labelledby={`tbt-roadmap-tab-${tab}`}
                className="tbt-roadmap-scroller flex-1 overflow-y-auto"
              >
                {tab === "growth" ? (
                  <GrowthMilestonesPanel scrollerRef={scrollerRef} onNavigate={() => setOpen(false)} />
                ) : status === "loading" ? (
                  <LoadingState />
                ) : status === "error" ? (
                  <ErrorState onRetry={onRetry} />
                ) : levels.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
                    <MapIcon size={28} style={{ color: "var(--color-text-subtle)" }} aria-hidden />
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text-normal)" }}>No levels yet</p>
                    <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Lessons for this course will appear here as levels.</p>
                  </div>
                ) : (
                  <LevelMap nodes={courseNodes} listLabel="Levels" scrollerRef={scrollerRef} />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {popup}

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
        @keyframes tbt-roadmap-node-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        .tbt-roadmap-node-current { animation: tbt-roadmap-node-pulse 1.8s ease-in-out infinite; }
        .tbt-roadmap-map {
          background-image:
            radial-gradient(circle at 12% 18%, color-mix(in srgb, var(--color-accent) 16%, transparent) 0 3px, transparent 4px),
            radial-gradient(circle at 86% 42%, color-mix(in srgb, var(--color-success) 18%, transparent) 0 4px, transparent 5px),
            radial-gradient(circle at 18% 74%, color-mix(in srgb, var(--color-alert, #f59e0b) 18%, transparent) 0 3px, transparent 4px),
            radial-gradient(circle at 80% 88%, color-mix(in srgb, var(--color-accent) 14%, transparent) 0 5px, transparent 6px);
          background-size: 100% 520px;
        }
        @media (prefers-reduced-motion: reduce) {
          .tbt-roadmap-fab[data-glow="true"] { animation: none; }
          .tbt-roadmap-fab { transition: none; }
          .tbt-roadmap-node-current { animation: none; }
          .tbt-roadmap-node { transition: none; }
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

// ── Shared map ────────────────────────────────────────────────────────────────

/** One round node on the map — a course level or a growth milestone. */
interface MapNode {
  key: string;
  number: number;
  /** Small caption above the title, e.g. "Level 2" / "Milestone 2". */
  kicker: string;
  title: string;
  state: RoadmapLevel["state"];
  /** Shown with a lock and greyed out. */
  locked: boolean;
  /** Line under the title. */
  detail: string;
  ariaLabel: string;
  /** null = nothing to open (locked, or a milestone with no destination). */
  onActivate: (() => void) | null;
}

function LoadingState() {
  return (
    <div className="h-full flex items-center justify-center gap-2 text-sm" style={{ color: "var(--color-text-secondary)" }} aria-busy="true">
      <Loader2 size={18} className="animate-spin" /> Loading your roadmap…
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Couldn&apos;t load your roadmap.</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="px-4 py-2 rounded-full text-sm font-semibold" style={{ background: "var(--color-accent)", color: "#fff" }}>
          Try again
        </button>
      )}
    </div>
  );
}

function LevelMap({ nodes, listLabel, scrollerRef }: { nodes: MapNode[]; listLabel: string; scrollerRef: RefObject<HTMLDivElement | null> }) {
  const mapHeight = TOP_PAD + Math.max(0, nodes.length - 1) * ROW_HEIGHT + BOTTOM_PAD;
  const allDone = nodes.length > 0 && nodes.every((n) => n.state === "completed");

  // Centre the member's current node in the map (the popup only, never the page).
  useEffect(() => {
    const scroller = scrollerRef.current;
    const currentIndex = nodes.findIndex((n) => n.state === "current");
    if (scroller && currentIndex > 0) {
      scroller.scrollTop = Math.max(0, levelPoint(currentIndex).y - scroller.clientHeight / 2);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per map shown

  return (
    <div className="tbt-roadmap-map relative mx-auto w-full max-w-[460px] sm:max-w-[600px]" style={{ height: mapHeight }}>
      {/* Road: soft wide base, dashed centre line, then progress on top */}
      <svg data-roadmap-path className="absolute inset-0 w-full h-full" viewBox={`0 0 100 ${mapHeight}`} preserveAspectRatio="none" aria-hidden="true">
        {nodes.slice(0, -1).map((_, i) => (
          <path
            key={`base-${i}`}
            d={roadSegment(i)}
            fill="none"
            strokeWidth={26}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ stroke: "color-mix(in srgb, var(--color-accent) 14%, var(--color-bg-surface))" }}
          />
        ))}
        {nodes.slice(0, -1).map((node, i) => {
          const reached = nodes[i + 1].state !== "locked";
          return (
            <path
              key={`road-${i}`}
              data-road-state={reached ? "reached" : "locked"}
              d={roadSegment(i)}
              fill="none"
              strokeWidth={reached ? 10 : 4}
              strokeLinecap="round"
              strokeDasharray={reached ? undefined : "1 12"}
              vectorEffect="non-scaling-stroke"
              style={{
                stroke: reached
                  ? node.state === "completed" && nodes[i + 1].state === "completed"
                    ? "var(--color-success)"
                    : "var(--color-accent)"
                  : "var(--color-border-subtle)",
              }}
            />
          );
        })}
      </svg>

      {/* Start flag */}
      <div
        className="absolute flex flex-col items-center text-[10px] font-bold uppercase tracking-wider"
        style={{ left: `${LANES[0]}%`, top: TOP_PAD - NODE / 2 - 52, transform: "translateX(-50%)", color: "var(--color-text-secondary)" }}
        aria-hidden="true"
      >
        <Flag size={20} style={{ color: "var(--color-accent)" }} />
        Start
      </div>

      <ol aria-label={listLabel} className="absolute inset-0">
        {nodes.map((node, i) => {
          const p = levelPoint(i);
          const c = nodeColors(node.state);
          const leftLane = p.x < 50;
          const current = node.state === "current";
          const disabled = !node.onActivate;
          return (
            <li key={node.key}>
              {current && (
                <span
                  className="tbt-roadmap-here absolute z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shadow"
                  style={{ left: `${p.x}%`, top: p.y - NODE / 2 - 30, transform: "translateX(-50%)", background: "var(--color-accent)", color: "#fff" }}
                >
                  <MapPin size={11} aria-hidden /> You are here
                </span>
              )}
              <button
                type="button"
                aria-disabled={disabled || undefined}
                onClick={() => node.onActivate?.()}
                aria-label={node.ariaLabel}
                aria-current={current ? "step" : undefined}
                data-level-state={node.state}
                className={`tbt-roadmap-node absolute rounded-full flex items-center justify-center text-lg font-extrabold tabular-nums transition-transform duration-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 ${
                  disabled ? "cursor-not-allowed" : "hover:scale-110"
                } ${current ? "tbt-roadmap-node-current" : ""}`}
                style={{
                  left: `calc(${p.x}% - ${NODE / 2}px)`,
                  top: p.y - NODE / 2,
                  width: NODE,
                  height: NODE,
                  background: c.fill,
                  color: c.text,
                  border: node.state === "available" ? "4px solid var(--color-accent)" : "4px solid #fff",
                  boxShadow: `0 0 0 6px ${c.ring}, 0 6px 14px rgba(0,0,0,0.22)`,
                  outlineColor: "var(--color-accent)",
                }}
              >
                {node.state === "completed" ? <Check size={26} strokeWidth={3.5} aria-hidden /> : node.locked ? <Lock size={20} aria-hidden /> : node.number}
              </button>
              {/* Label on the open side of the node */}
              <div
                className="absolute pointer-events-none"
                style={{
                  top: p.y - 26,
                  ...(leftLane
                    ? { left: `calc(${p.x}% + ${NODE / 2 + 14}px)`, right: 8, textAlign: "left" as const }
                    : { right: `calc(${100 - p.x}% + ${NODE / 2 + 14}px)`, left: 8, textAlign: "right" as const }),
                }}
                aria-hidden="true"
              >
                <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: node.locked ? "var(--color-text-subtle)" : "var(--color-accent)" }}>
                  {node.kicker}
                </span>
                <span className="block text-sm font-bold leading-tight line-clamp-2" style={{ color: node.locked ? "var(--color-text-subtle)" : "var(--color-text-normal)" }}>
                  {node.title}
                </span>
                <span className="block text-[11px] tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
                  {node.detail}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Finish trophy */}
      {(() => {
        const last = levelPoint(nodes.length - 1);
        return (
          <div
            className="absolute flex flex-col items-center text-[10px] font-bold uppercase tracking-wider"
            style={{ left: `${last.x}%`, top: last.y + NODE / 2 + 18, transform: "translateX(-50%)", color: allDone ? "var(--color-success)" : "var(--color-text-subtle)" }}
            aria-hidden="true"
          >
            <Trophy size={22} />
            Finish
          </div>
        );
      })()}
    </div>
  );
}

// ── Growth milestones tab ─────────────────────────────────────────────────────

const MILESTONE_STATE_LABEL: Record<GrowthMilestoneLevel["state"], string> = {
  completed: "Reached",
  current: "In progress",
  locked: "Locked",
};

function milestoneDetail(m: GrowthMilestoneLevel, inBatch: boolean): string {
  if (!inBatch) return "Locked";
  if (m.kind === "revenue") {
    if (m.state === "completed") return "Recorded by your mentor · Reached";
    if (m.notRecordable) return "Not set up for your program yet";
    return m.state === "locked" ? "Locked" : "Recorded by your mentor when achieved";
  }
  const day = m.href?.startsWith("/batch-program/") ? m.href.slice("/batch-program/".length) : null;
  return `${day ? `Day ${day} · ` : ""}${MILESTONE_STATE_LABEL[m.state]}`;
}

function GrowthMilestonesPanel({ scrollerRef, onNavigate }: { scrollerRef: RefObject<HTMLDivElement | null>; onNavigate: () => void }) {
  const router = useRouter();
  const { data: graph, isLoading, isError, refetch } = useMyWeeklyGraph();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const { inBatch, levels } = buildGrowthMilestones(graph ?? null);
  const reached = levels.filter((m) => m.state === "completed").length;
  const nodes = levels.map(
    (m): MapNode => ({
      key: m.id ?? `default-${m.number}`,
      kicker: `Milestone ${m.number}`,
      number: m.number,
      title: m.title,
      state: m.state,
      locked: m.state === "locked",
      detail: milestoneDetail(m, inBatch),
      ariaLabel: `Milestone ${m.number}: ${m.title} — ${MILESTONE_STATE_LABEL[m.state]}${m.state !== "locked" && !m.href ? ", achievement status only" : ""}`,
      onActivate: m.href
        ? () => {
            onNavigate();
            router.push(m.href!);
          }
        : null,
    }),
  );

  return (
    <>
      <p className="px-5 pt-3 text-xs font-semibold text-center" style={{ color: "var(--color-text-secondary)" }} role="status">
        {inBatch ? `${reached} of ${levels.length} milestones reached` : "Join a batch program to unlock"}
      </p>
      <LevelMap nodes={nodes} listLabel="Growth milestones" scrollerRef={scrollerRef} />
    </>
  );
}

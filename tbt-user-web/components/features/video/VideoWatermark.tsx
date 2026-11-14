"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMe } from "@/lib/hooks/useUser";
import { Maximize, Minimize } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

// Nine position zones as fractions of container width/height.
// Covers corners, mid-edges, and center — watermark cycles through all of them.
const ZONES = [
  { xf: 0.06, yf: 0.07 },
  { xf: 0.58, yf: 0.07 },
  { xf: 0.06, yf: 0.42 },
  { xf: 0.58, yf: 0.42 },
  { xf: 0.06, yf: 0.76 },
  { xf: 0.58, yf: 0.76 },
  { xf: 0.32, yf: 0.25 },
  { xf: 0.32, yf: 0.62 },
  { xf: 0.75, yf: 0.30 },
];

const VISIBLE_MS = 8_000;   // how long watermark stays in one spot
const FADE_MS    = 1_400;   // framer-motion fade duration
const PAUSE_MS   = 4_000;   // hidden gap before next position

// Shuffle zone index avoiding repetition
let _lastZone = -1;
function pickZone(): number {
  let idx: number;
  do { idx = Math.floor(Math.random() * ZONES.length); } while (idx === _lastZone && ZONES.length > 1);
  _lastZone = idx;
  return idx;
}

// Base64 encode without dependency
function b64(s: string): string {
  if (typeof btoa !== "undefined") return btoa(unescape(encodeURIComponent(s)));
  return s; // SSR fallback (unused since component is client-only)
}

// Build a repeating SVG tile for the diagonal watermark grid.
// Using a CSS background-image keeps the DOM clean — no selectable text nodes.
function makeTileBg(text: string): string {
  const escaped = text.replace(/[<>&"']/g, (c: string) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] ?? c),
  );
  // An SVG used as a background image can't load the page's web fonts, so
  // this tile stays on the system monospace font rather than Nexa.
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="90">' +
    '<text x="10" y="55" font-family="monospace" font-size="9" font-weight="600"' +
    ' fill="white" fill-opacity="1" transform="rotate(-22,10,55)" letter-spacing="0.5">' +
    escaped +
    "</text></svg>";
  return `url("data:image/svg+xml;base64,${b64(svg)}")`;
}

// ─── Fullscreen + orientation helpers ─────────────────────────────────────────
// Standard API first, WebKit prefix as a fallback (older iPad Safari).

type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type WebkitDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };

function fullscreenElement(): Element | null {
  const d = document as WebkitDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function exitFullscreen(): void {
  const d = document as WebkitDocument;
  try {
    const r = d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.();
    if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => {});
  } catch { /* already exited */ }
}

/** Touch devices only; a refused or unsupported lock leaves fullscreen as-is. */
function lockLandscape(lockedRef: { current: boolean }): void {
  if (typeof window === "undefined" || !window.matchMedia?.("(pointer: coarse)").matches) return;
  const o = screen.orientation as LockableOrientation | undefined;
  if (!o?.lock) return;
  o.lock("landscape").then(() => { lockedRef.current = true; }, () => {});
}

function releaseOrientation(lockedRef: { current: boolean }): void {
  if (!lockedRef.current) return;
  lockedRef.current = false;
  try { (screen.orientation as LockableOrientation | undefined)?.unlock?.(); } catch { /* not locked */ }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoWatermarkProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  containerId?: string;
  showFullscreenButton?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VideoWatermark({
  children,
  className = "",
  style,
  containerId,
  showFullscreenButton = false,
}: VideoWatermarkProps) {
  const { data: user } = useMe();
  const containerRef = useRef<HTMLDivElement>(null);

  const [isVisible, setIsVisible]     = useState(false);
  const [position, setPosition]       = useState({ x: 0, y: 0 });
  const [timestamp, setTimestamp]     = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Timestamp (updates every 30 s for forensic accuracy) ──────────────────
  useEffect(() => {
    const update = () =>
      setTimestamp(new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC");
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Position helper ───────────────────────────────────────────────────────
  const applyNextPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const z = ZONES[pickZone()];
    setPosition({
      x: Math.round(z.xf * width),
      y: Math.round(z.yf * height),
    });
  }, []);

  // ── Visibility cycle: visible → fade → pause → reposition → visible ───────
  useEffect(() => {
    if (!user) return;

    applyNextPosition(); // set initial position before first show
    let timer: ReturnType<typeof setTimeout>;

    const show = () => {
      setIsVisible(true);
      timer = setTimeout(hide, VISIBLE_MS);
    };
    const hide = () => {
      setIsVisible(false);
      timer = setTimeout(() => { applyNextPosition(); show(); }, FADE_MS + PAUSE_MS);
    };

    timer = setTimeout(show, 1_500); // small delay so player renders first
    return () => clearTimeout(timer);
  }, [user, applyNextPosition]);

  // Browsers with no element Fullscreen API (iPhone Safari): the player fills
  // the viewport with CSS instead. It sits at z-45, under every page modal
  // (z-50+), so cue quizzes and enforcement modals still show over it.
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const orientationLockedRef = useRef(false);

  // ── Fullscreen sync ───────────────────────────────────────────────────────
  // One listener pair for the lifetime of the component (standard + WebKit
  // prefix). Leaving fullscreen by any route (button, Esc, back gesture, a
  // cue quiz calling document.exitFullscreen) releases the landscape lock.
  useEffect(() => {
    const handler = () => {
      const active = !!fullscreenElement();
      setIsFullscreen(active);
      if (!active) releaseOrientation(orientationLockedRef);
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  useEffect(() => {
    if (!isPseudoFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsPseudoFullscreen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [isPseudoFullscreen]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (fullscreenElement()) { exitFullscreen(); return; }
    if (isPseudoFullscreen) { setIsPseudoFullscreen(false); return; }

    const request = el.requestFullscreen ?? (el as WebkitElement).webkitRequestFullscreen;
    if (!request) { setIsPseudoFullscreen(true); return; }
    Promise.resolve()
      .then(() => request.call(el))
      // Landscape only once fullscreen is active — browsers refuse the lock otherwise.
      .then(() => lockLandscape(orientationLockedRef))
      .catch(() => setIsPseudoFullscreen(true));
  }, [isPseudoFullscreen]);

  const fullscreenActive = isFullscreen || isPseudoFullscreen;

  // ── Forensic payload (base64-encoded; embedded invisibly in DOM) ──────────
  const forensicToken = user
    ? b64(`tbt|${user.id}|${user.email}|${timestamp}|${Date.now()}`)
    : "";

  // Visible watermark text: email + truncated id + timestamp
  const displayLine = user
    ? `${user.email}  [${user.id.slice(0, 8)}]  ${timestamp}`
    : "";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      id={containerId}
      // forensic token readable by developer tools / DOM inspection
      data-wm={forensicToken}
      className={[
        "relative group/wm",
        isFullscreen ? "fixed inset-0 z-[9999] bg-black flex items-center justify-center" : "",
        // `!` beats the `relative`, `aspect-video` and `rounded-*` the caller passes in.
        !isFullscreen && isPseudoFullscreen ? "!fixed !inset-0 !w-auto !h-auto !aspect-auto !rounded-none z-[45] bg-black flex items-center justify-center" : "",
        showFullscreenButton ? "tbt-wm-fs" : "",
        className,
      ].join(" ")}
      style={{ isolation: "isolate", ...(!fullscreenActive ? style : {}) }}
    >
      {/* ── Main content (iframe / video) ──────────────────────────────────── */}
      <div className={fullscreenActive ? "w-full h-full" : "contents"}>
        {children}
      </div>

      {user && (
        <>
          {/* ── Layer 1: Dynamic floating watermark (appear → move → disappear) */}
          <div className="absolute inset-0 pointer-events-none select-none z-50 overflow-hidden">
            <div
              style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 700,
                whiteSpace: "nowrap",
                letterSpacing: "0.04em",
                textShadow: "0 1px 4px rgba(0,0,0,0.95)",
                mixBlendMode: "difference",
                opacity: isVisible ? 0.14 : 0,
                transition: `opacity ${FADE_MS}ms ease-in-out`,
              }}
            >
              {displayLine}
            </div>
          </div>

          {/* ── Layer 2: Faint diagonal tile grid (survives screenshots) ───── */}
          {/* Rendered as a CSS background-image so there are no selectable     */}
          {/* text nodes in the DOM. opacity: 0.028 — invisible casually,       */}
          {/* recoverable from screenshots via contrast enhancement.             */}
          <div
            className="absolute inset-0 pointer-events-none select-none z-40 overflow-hidden"
            style={{
              opacity: 0.028,
              backgroundImage: makeTileBg(`${user.id.slice(0, 18)} · ${user.email}`),
              backgroundRepeat: "repeat",
              backgroundSize: "280px 90px",
            }}
          />

          {/* ── Layer 3: Invisible forensic data embedded in DOM ───────────── */}
          {/* Opacity 0 + 1px × 1px: not visible to viewers but present in:      */}
          {/*   – developer tools / page source                                   */}
          {/*   – high-dpi screenshot OCR analysis                                */}
          {/*   – automated DOM scraping / forensic auditing                      */}
          <span
            aria-hidden="true"
            data-forensic-id={user.id}
            data-forensic-email={user.email}
            data-forensic-ts={timestamp}
            data-forensic-token={forensicToken}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "1px",
              height: "1px",
              overflow: "hidden",
              opacity: 0,
              fontSize: "0.1px",
              color: "transparent",
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 1,
            }}
          >
            {forensicToken}
          </span>
        </>
      )}

      {/* ── Custom fullscreen button ────────────────────────────────────────── */}
      {/* Replaces the Bunny native fullscreen so the watermark layers stay     */}
      {/* inside the fullscreen context and are never stripped out.             */}
      {showFullscreenButton && (
        <button
          onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
          aria-label={fullscreenActive ? "Exit fullscreen" : "Enter fullscreen"}
          className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-[80] p-2.5 sm:p-2 rounded-lg
                     bg-black/50 hover:bg-black/75 text-white
                     opacity-70 sm:opacity-40 group-hover/wm:opacity-100
                     transition-opacity duration-200 backdrop-blur-sm"
        >
          {fullscreenActive ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      )}

      {/* ── Pointer-event blocker on top of all watermark layers ───────────── */}
      <div className="absolute inset-0 pointer-events-none z-[60]" aria-hidden="true" />
    </div>
  );
}

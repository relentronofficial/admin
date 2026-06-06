"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMe } from "@/lib/hooks/useUser";
import { motion, AnimatePresence } from "framer-motion";
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
const TILE_ROWS  = 4;
const TILE_COLS  = 4;

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoWatermarkProps {
  children: React.ReactNode;
  className?: string;
  containerId?: string;
  showFullscreenButton?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VideoWatermark({
  children,
  className = "",
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

  // ── Fullscreen sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }, []);

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
        "relative overflow-hidden group/wm",
        isFullscreen ? "fixed inset-0 z-[9999] bg-black flex items-center justify-center" : "",
        className,
      ].join(" ")}
      style={{ isolation: "isolate" }}
    >
      {/* ── Main content (iframe / video) ──────────────────────────────────── */}
      <div className={isFullscreen ? "w-full h-full" : "contents"}>
        {children}
      </div>

      {user && (
        <>
          {/* ── Layer 1: Dynamic floating watermark (appear → move → disappear) */}
          <div className="absolute inset-0 pointer-events-none select-none z-50">
            <AnimatePresence>
              {isVisible && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.14 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: FADE_MS / 1000, ease: "easeInOut" }}
                  style={{
                    position: "absolute",
                    left: position.x,
                    top: position.y,
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    whiteSpace: "nowrap",
                    letterSpacing: "0.04em",
                    textShadow: "0 1px 4px rgba(0,0,0,0.95)",
                    // difference blend: text always contrasts with whatever is beneath it
                    mixBlendMode: "difference",
                  }}
                >
                  {displayLine}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Layer 2: Faint diagonal tile grid (survives screenshots) ───── */}
          {/* opacity: 0.028 — invisible during casual viewing, recoverable from screenshots */}
          <div
            className="absolute inset-0 pointer-events-none select-none z-40 overflow-hidden"
            style={{ opacity: 0.028 }}
          >
            {Array.from({ length: TILE_ROWS * TILE_COLS }).map((_, i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: `${(i % TILE_COLS) * 26}%`,
                  top: `${Math.floor(i / TILE_COLS) * 26}%`,
                  color: "#ffffff",
                  fontSize: "9px",
                  fontWeight: 600,
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                  transform: "rotate(-22deg)",
                  transformOrigin: "left center",
                  mixBlendMode: "difference",
                }}
              >
                {user.id.slice(0, 18)} · {user.email}
              </span>
            ))}
          </div>

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
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="absolute bottom-3 right-3 z-[70] p-2 rounded-lg
                     bg-black/50 hover:bg-black/75 text-white
                     opacity-40 group-hover/wm:opacity-100
                     transition-opacity duration-200 backdrop-blur-sm"
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      )}

      {/* ── Pointer-event blocker on top of all watermark layers ───────────── */}
      <div className="absolute inset-0 pointer-events-none z-[60]" aria-hidden="true" />
    </div>
  );
}

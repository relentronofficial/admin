"use client";

import React, { useState, useEffect, useRef } from "react";
import { useMe } from "@/lib/hooks/useUser";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize, Minimize } from "lucide-react";

/**
 * Watermark Configuration
 */
const CONFIG = {
  // Visibility (0 to 1)
  movingOpacity: 0.12,
  staticPatternOpacity: 0.035,
  
  // Movement & Visibility Timing
  displayDurationMs: 8000,   // How long it stays visible at one spot
  fadeDurationSeconds: 1.5,  // Duration of fade in/out
  pauseDurationMs: 4000,     // How long it stays hidden before reappearing elsewhere
  
  // Content
  showEmail: true,
  showUserId: true,
  showTimestamp: true,
  
  // Layering
  layers: 2,
};

interface VideoWatermarkProps {
  children: React.ReactNode;
  className?: string;
  containerId?: string;
  showFullscreenButton?: boolean;
}

export function VideoWatermark({ children, className, containerId, showFullscreenButton = false }: VideoWatermarkProps) {
  const { data: user, isLoading } = useMe();
  const [position, setPosition] = useState({ x: 10, y: 10 });
  const [timestamp, setTimestamp] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update timestamp occasionally
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimestamp(now.toISOString().replace("T", " ").substring(0, 19));
    };
    updateTime();
    const id = setInterval(updateTime, 60000); // every minute
    return () => clearInterval(id);
  }, []);

  // Handle "Forensic" Jump & Fade movement
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const cycle = () => {
      // 1. Fade out
      setIsVisible(false);

      // 2. Wait for fade out + pause
      timeoutId = setTimeout(() => {
        if (!containerRef.current) return;
        const { width, height } = containerRef.current.getBoundingClientRect();
        
        // Pick new random position
        const x = Math.max(10, Math.random() * (width - 280));
        const y = Math.max(10, Math.random() * (height - 80));
        setPosition({ x, y });

        // 3. Fade back in
        setIsVisible(true);

        // 4. Stay visible for displayDurationMs
        timeoutId = setTimeout(cycle, CONFIG.displayDurationMs);
      }, (CONFIG.fadeDurationSeconds * 1000) + CONFIG.pauseDurationMs);
    };

    const initialId = setTimeout(cycle, CONFIG.displayDurationMs);
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(initialId);
    };
  }, []);

  // Sync fullscreen state
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err: any) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  if (isLoading || !user) {
    return <div className={className}>{children}</div>;
  }

  const watermarkText = `
    ${user.email} 
    ${CONFIG.showUserId ? `[${user.id.substring(0, 8)}]` : ""}
    ${CONFIG.showTimestamp ? ` @ ${timestamp}` : ""}
  `.trim();

  return (
    <div
      ref={containerRef}
      id={containerId}
      className={`relative overflow-hidden group/watermark ${className} ${
        isFullscreen ? "fixed inset-0 z-[9999] bg-black flex items-center justify-center w-screen h-screen" : ""
      }`}
      style={{ isolation: "isolate" }}
    >
      {/* ── Main Video Content ── */}
      <div className={`w-full h-full relative ${isFullscreen ? "max-w-full max-h-full overflow-hidden" : ""}`}>
        {children}
      </div>

      {/* ── Layer 1: Forensic Jumping Watermark ── */}
      <div className="absolute inset-0 pointer-events-none z-50 select-none overflow-hidden">
        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: CONFIG.movingOpacity }}
              exit={{ opacity: 0 }}
              transition={{ duration: CONFIG.fadeDurationSeconds, ease: "easeInOut" }}
              style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                whiteSpace: "nowrap",
                color: "#fff",
                fontSize: "10px",
                fontWeight: "bold",
                textShadow: "1px 1px 1px rgba(0,0,0,0.5)",
                mixBlendMode: "difference",
              }}
            >
              {watermarkText}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Layer 2: Repeated Forensic Pattern (Static/Faint) ── */}
      <div 
        className="absolute inset-0 pointer-events-none z-40 select-none overflow-hidden grid grid-cols-3 grid-rows-3 opacity-[0.03]"
        style={{ mixBlendMode: "screen" }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div 
            key={i} 
            className="flex items-center justify-center text-[8px] font-mono text-white rotate-[-25deg] uppercase tracking-tighter"
            style={{ opacity: CONFIG.staticPatternOpacity }}
          >
            {user.id.substring(0, 12)}
          </div>
        ))}
      </div>

      {/* ── Fullscreen Trigger (Replaces Bunny's internal button) ── */}
      {showFullscreenButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          className="absolute bottom-6 right-6 z-[70] p-2.5 bg-black/40 hover:bg-black/60 rounded-xl text-white opacity-0 group-hover/watermark:opacity-100 transition-all hover:scale-110 active:scale-95"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          style={{ backdropFilter: "blur(8px)" }}
        >
          {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
        </button>
      )}

      {/* ── Overlay to prevent direct interaction with watermark ── */}
      <div className="absolute inset-0 pointer-events-none z-[60]" />

      <style jsx>{`
        div:fullscreen :global(iframe),
        div:fullscreen :global(video) {
          width: 100vw !important;
          height: 100vh !important;
          object-fit: contain !important;
        }
      `}</style>
    </div>
  );
}


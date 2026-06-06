"use client";

import React, { useState, useEffect, useRef } from "react";
import { useMe } from "@/lib/hooks/useUser";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Watermark Configuration
 */
const CONFIG = {
  // Visibility (0 to 1)
  movingOpacity: 0.12,
  staticPatternOpacity: 0.035,
  
  // Movement
  moveIntervalMs: 12000, // Move every 12 seconds
  moveTransitionSeconds: 4, // Smooth transition duration
  
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
}

export function VideoWatermark({ children, className, containerId }: VideoWatermarkProps) {
  const { data: user, isLoading } = useMe();
  const [position, setPosition] = useState({ x: 10, y: 10 });
  const [timestamp, setTimestamp] = useState("");
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

  // Handle random movement
  useEffect(() => {
    const move = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      
      // Keep watermark within bounds (rough estimate of text size)
      const x = Math.random() * (width - 250);
      const y = Math.random() * (height - 60);
      
      setPosition({ x: Math.max(10, x), y: Math.max(10, y) });
    };

    move(); // initial position
    const id = setInterval(move, CONFIG.moveIntervalMs);
    return () => clearInterval(id);
  }, []);

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
      className={`relative overflow-hidden group/watermark ${className}`}
      style={{ isolation: "isolate" }}
    >
      {/* ── Main Video Content ── */}
      {children}

      {/* ── Layer 1: Moving Dynamic Watermark ── */}
      <div className="absolute inset-0 pointer-events-none z-50 select-none overflow-hidden">
        <motion.div
          animate={{ x: position.x, y: position.y }}
          transition={{ duration: CONFIG.moveTransitionSeconds, ease: "easeInOut" }}
          className="absolute whitespace-nowrap pointer-events-none select-none"
          style={{
            opacity: CONFIG.movingOpacity,
            color: "#fff",
            fontSize: "10px",
            fontWeight: "bold",
            textShadow: "1px 1px 1px rgba(0,0,0,0.5)",
            mixBlendMode: "difference",
          }}
        >
          {watermarkText}
        </motion.div>
      </div>

      {/* ── Layer 2: Repeated Static/Forensic Pattern ── */}
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

      {/* ── Overlay to prevent direct interaction with watermark ── */}
      <div className="absolute inset-0 pointer-events-none z-[60]" />
    </div>
  );
}

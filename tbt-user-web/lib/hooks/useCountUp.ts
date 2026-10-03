"use client";

import { useState, useEffect, useRef } from "react";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function useCountUp(
  target: number,
  duration = 1200,
  decimals = 0,
): string {
  const [display, setDisplay] = useState("0");
  const rafRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);
  const startValRef = useRef(0);

  useEffect(() => {
    if (target === 0) {
      setDisplay((0).toFixed(decimals));
      return;
    }
    startTimeRef.current = undefined;
    startValRef.current = 0;

    const animate = (now: number) => {
      if (startTimeRef.current === undefined) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = startValRef.current + (target - startValRef.current) * eased;
      setDisplay(
        decimals > 0
          ? current.toFixed(decimals)
          : Math.round(current).toLocaleString("en-IN"),
      );
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(
          decimals > 0
            ? target.toFixed(decimals)
            : target.toLocaleString("en-IN"),
        );
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, decimals]);

  return display;
}

/** Formats a number as Indian currency abbreviation (e.g. 457856 → "4,57,856") */
export function formatINR(n: number | null | undefined): string {
  if (n == null) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

/** Growth % between current and previous; returns null when prev is 0 or null */
export function growthPct(current: number | null, prev: number | null): number | null {
  if (!current || !prev || prev === 0) return null;
  return Math.round(((current - prev) / prev) * 1000) / 10; // 1 dp
}

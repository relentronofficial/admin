"use client";

import { useActivityHeartbeat } from "@/lib/hooks/useActivityHeartbeat";

/** Mounted once in the platform layout; renders nothing. */
export function ActivityHeartbeat() {
  useActivityHeartbeat();
  return null;
}

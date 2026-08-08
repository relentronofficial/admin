"use client";

/**
 * Offline tracking queue — TBT_ADS_SPECKIT.md §11 ("network lost during ad").
 *
 * Tracking is fire-and-forget by contract, but "fire-and-forget" must not mean
 * "silently lose the completion of every ad watched on a flaky train". A failed
 * beacon is parked in localStorage and retried on reconnect, on the next
 * successful tracking call, and on the next page load.
 *
 * Deliberately NOT retried forever: entries older than 24 hours are dropped
 * (§11). Impression counts and cap enforcement are server-side and already
 * settled by then; a day-old completion event is analytics noise, and keeping
 * it would let a long-offline device flood the endpoint on reconnect.
 */

export interface QueuedCall {
  /** Absolute API path, e.g. "/api/ads/complete". */
  path: string;
  body: Record<string, unknown>;
  /** Wall-clock ms when the call was first attempted. */
  queuedAt: number;
}

const STORAGE_KEY = "tbt_ad_tracking_queue";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Bounded so a pathological offline session cannot fill localStorage. Oldest
 *  entries are dropped first — the newest tell the truer story of the session. */
const MAX_ENTRIES = 50;

function read(): QueuedCall[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedCall[]) : [];
  } catch {
    // Private browsing, quota, or corrupt JSON. Tracking degrades; the app does
    // not care.
    return [];
  }
}

function write(entries: QueuedCall[]): void {
  if (typeof window === "undefined") return;
  try {
    if (entries.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable — drop silently */
  }
}

function fresh(entries: QueuedCall[], now: number): QueuedCall[] {
  return entries.filter((e) => now - e.queuedAt < MAX_AGE_MS);
}

export function enqueue(path: string, body: Record<string, unknown>): void {
  const now = Date.now();
  const next = fresh(read(), now);
  next.push({ path, body, queuedAt: now });
  write(next.slice(-MAX_ENTRIES));
}

let flushing = false;

/**
 * Drain the queue through `send`.
 *
 * Stops at the first failure and keeps the remaining entries: if the network is
 * still down, hammering the rest just burns the rate limit that §5 puts on
 * these routes.
 */
export async function flushQueue(
  send: (path: string, body: Record<string, unknown>) => Promise<unknown>,
): Promise<void> {
  if (flushing || typeof window === "undefined") return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  flushing = true;
  try {
    let pending = fresh(read(), Date.now());
    while (pending.length > 0) {
      const [head, ...rest] = pending;
      try {
        await send(head.path, head.body);
      } catch {
        // Still failing — leave everything (including head) for next time.
        write(pending);
        return;
      }
      pending = rest;
      write(pending);
    }
  } finally {
    flushing = false;
  }
}

/** Wire reconnect-driven flushing once per page. */
export function onReconnect(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}

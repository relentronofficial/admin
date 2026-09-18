"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getAdminSocket } from "@/lib/socket/client";
import {
  useListHelpdeskTickets,
  useGetHelpdeskSettings,
  useAcknowledgeTicket,
  type HelpdeskTicket,
} from "@/lib/hooks/useHelpdesk";

const SOUND_UNLOCKED_KEY = "tbt_helpdesk_alarm_sound_unlocked";

/** Web Audio oscillator beep — no audio asset needed, and nothing in this
 * codebase plays sound anywhere else (confirmed: no existing Audio usage). */
function playBeep() {
  try {
    const AudioCtxCtor: typeof AudioContext | undefined =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxCtor) return;
    const ctx = new AudioCtxCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    /* audio unsupported/blocked — the visual banner still works */
  }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "#4ade80",
  medium: "#facc15",
  high: "#fb923c",
  urgent: "#dc2626",
};

/**
 * Global, always-mounted alarm for unacknowledged support tickets. Mirrors
 * AuthInterceptor's pattern (Providers.tsx) — a singleton, `getAdminSocket()`
 * subscriber that lives for the app's lifetime, not just while /support is
 * open.
 *
 * The unacknowledged set is NEVER trusted from client memory alone: it's
 * always `useListHelpdeskTickets({ status: 'new' })`, i.e. server-derived.
 * Socket events just tell us *when* to refetch that query — so a refresh,
 * reconnect, or a second browser tab all converge on the same truth. Only
 * "has this browser unlocked audio" lives in localStorage, since that's a
 * per-viewer browser-policy fact, never ticket state.
 */
export function HelpdeskAlarmProvider() {
  const router = useRouter();
  const qc = useQueryClient();
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const acknowledge = useAcknowledgeTicket();

  const { data: settings } = useGetHelpdeskSettings();
  const { data: ticketsRes } = useListHelpdeskTickets({ status: "new", limit: 50 });
  const unacknowledged: HelpdeskTicket[] = ticketsRes?.data ?? [];

  useEffect(() => {
    setSoundUnlocked(typeof window !== "undefined" && localStorage.getItem(SOUND_UNLOCKED_KEY) === "1");
  }, []);

  // Desktop notification + toast for genuinely new tickets (diffed against
  // what we've already seen this session) — never for tickets we already
  // knew about (e.g. after a refetch caused by someone else's action).
  useEffect(() => {
    for (const t of unacknowledged) {
      if (seenIdsRef.current.has(t.id)) continue;
      seenIdsRef.current.add(t.id);
      const label = `#TBT-${t.displayNumber ?? t.id.slice(0, 8)}`;
      const isUrgent = t.priority === "urgent";
      const title = isUrgent
        ? `🚨 URGENT TBT SUPPORT TICKET ${label}`
        : `TBT Support - New Ticket ${label}`;
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(title, { body: t.subject });
        } catch {}
      }
    }
  }, [unacknowledged]);

  // Repeating alarm — plays every `alarmRepeatIntervalSeconds` while any
  // ticket remains unacknowledged. Continues regardless of navigation.
  useEffect(() => {
    if (!soundUnlocked || unacknowledged.length === 0) return;
    const intervalMs = Math.max(5, settings?.alarmRepeatIntervalSeconds ?? 30) * 1000;
    playBeep();
    const id = setInterval(playBeep, intervalMs);
    return () => clearInterval(id);
  }, [soundUnlocked, unacknowledged.length, settings?.alarmRepeatIntervalSeconds]);

  // Socket-driven refetch. The query itself is the source of truth; sockets
  // only trigger "go check again" — never mutate local alarm state directly.
  useEffect(() => {
    let mounted = true;
    const invalidate = () => qc.invalidateQueries({ queryKey: ["helpdesk"] });
    getAdminSocket().then((socket) => {
      if (!mounted) return;
      socket.on("admin:helpdesk_ticket", invalidate);
      socket.on("admin:helpdesk_ticket_acknowledged", invalidate);
      socket.on("admin:helpdesk_ticket_escalated", (data: { subject: string; submitterName: string }) => {
        invalidate();
        toast.error(`⚠️ Escalated: ${data.submitterName} — ${data.subject}`, { duration: 10000 });
      });
      socket.on("admin:helpdesk_ticket_updated", invalidate);
    });
    return () => {
      mounted = false;
      getAdminSocket().then((s) => {
        s.off("admin:helpdesk_ticket", invalidate);
        s.off("admin:helpdesk_ticket_acknowledged", invalidate);
        s.off("admin:helpdesk_ticket_escalated");
        s.off("admin:helpdesk_ticket_updated", invalidate);
      });
    };
  }, [qc]);

  function enableAlerts() {
    setSoundUnlocked(true);
    localStorage.setItem(SOUND_UNLOCKED_KEY, "1");
    playBeep(); // unlock the AudioContext within this user-gesture handler
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }

  // Push page content down by the banner's actual height so it never
  // permanently overlaps the sticky Topbar/Sidebar chrome.
  const bannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (unacknowledged.length === 0) {
      document.body.style.paddingTop = "";
      return;
    }
    const el = bannerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      document.body.style.paddingTop = `${el.offsetHeight}px`;
    });
    ro.observe(el);
    document.body.style.paddingTop = `${el.offsetHeight}px`;
    return () => {
      ro.disconnect();
      document.body.style.paddingTop = "";
    };
  }, [unacknowledged.length]);

  if (unacknowledged.length === 0) return null;

  return (
    <div
      ref={bannerRef}
      className="fixed top-0 left-0 right-0 z-[9999] bg-[#181818] border-b-2 border-[#dc2626] shadow-[0_2px_20px_rgba(220,38,38,0.4)]"
    >
      {!soundUnlocked && (
        <button
          onClick={enableAlerts}
          className="w-full bg-[#dc2626] hover:bg-red-700 text-white text-[12px] font-bold uppercase tracking-widest font-rajdhani py-1.5"
        >
          🔔 Click to enable sound alerts for new support tickets
        </button>
      )}
      <div className="max-h-[220px] overflow-y-auto divide-y divide-[#2a2a2a]">
        {unacknowledged.map((t) => (
          <div key={t.id} className="flex items-center gap-4 px-5 py-2.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse"
              style={{ background: PRIORITY_COLORS[t.priority] ?? "#facc15" }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-[#f0f0f0] truncate">
                🔔 NEW TICKET #TBT-{t.displayNumber ?? t.id.slice(0, 8)} — {t.subject}
              </div>
              <div className="text-[11px] text-[#a0a0a0] uppercase tracking-widest font-rajdhani">
                {t.category?.name ?? "General"} · Priority: {t.priority.toUpperCase()} · {formatTime(t.createdAt)}
              </div>
            </div>
            <button
              onClick={() => router.push(`/support?tab=tickets&id=${t.id}`)}
              className="text-[11px] font-bold uppercase tracking-widest font-rajdhani border border-[#333] hover:border-[#dc2626] text-[#f0f0f0] rounded-lg px-3 py-1.5 flex-shrink-0"
            >
              View Ticket
            </button>
            <button
              onClick={() => acknowledge.mutate(t.id)}
              disabled={acknowledge.isPending}
              className="text-[11px] font-bold uppercase tracking-widest font-rajdhani bg-[#dc2626] hover:bg-red-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 flex-shrink-0"
            >
              Acknowledge & Stop Alarm
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Unacknowledged-ticket count for the Topbar's pulsing badge. */
export function useUnacknowledgedTicketsCount(): number {
  const { data } = useListHelpdeskTickets({ status: "new", limit: 50 });
  return data?.meta?.total ?? data?.data?.length ?? 0;
}

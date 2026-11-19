"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useMe } from "@/lib/hooks/useUser";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useSuppressAds } from "@/lib/ads/useRegisterMedia";

/** Fire this window event (e.g. from the profile menu) to start the tour again. */
export const START_TOUR_EVENT = "tbt:start-tour";
const DONE_KEY_PREFIX = "tbt_tour_done_v1:";
const AUTO_START_DELAY_MS = 1500;
const PAD = 6; // spotlight padding around the target

type Step = {
  id: string;
  /** `data-tour` value of the element to highlight; none = centred card. */
  target?: string;
  titleKey: string;
  bodyKey: string;
  title: string;
  body: string;
};

// Copy can be overridden in Admin → UI strings with the keys below.
const STEPS: Step[] = [
  {
    id: "welcome",
    titleKey: "tourWelcomeTitle",
    bodyKey: "tourWelcomeBody",
    title: "Welcome to TBT 👋",
    body: "Take a 1-minute tour of where everything lives. You can skip it now and replay it any time from your profile menu.",
  },
  {
    id: "nav",
    target: "nav",
    titleKey: "tourNavTitle",
    bodyKey: "tourNavBody",
    title: "Your main sections",
    body: "Community, Courses, Mentorship and more. Click a section to jump straight to it.",
  },
  {
    id: "menu",
    target: "menu",
    titleKey: "tourMenuTitle",
    bodyKey: "tourMenuBody",
    title: "Open the menu",
    body: "Tap here to see every section: Community, Courses, Mentorship, Ebooks, Podcasts and Support.",
  },
  {
    id: "progress",
    target: "progress",
    titleKey: "tourProgressTitle",
    bodyKey: "tourProgressBody",
    title: "Streak, coins and tier",
    body: "Learn every day to grow your streak. Earn TBT coins as you complete lessons and tasks, and see which tier you have access to.",
  },
  {
    id: "notifications",
    target: "notifications",
    titleKey: "tourNotificationsTitle",
    bodyKey: "tourNotificationsBody",
    title: "Notifications",
    body: "Course access, approvals, live sessions and announcements show up here. The red badge counts what you haven't read.",
  },
  {
    id: "messages",
    target: "messages",
    titleKey: "tourMessagesTitle",
    bodyKey: "tourMessagesBody",
    title: "Messages and groups",
    body: "Chat one-to-one with the TBT team and join your group chats with other members.",
  },
  {
    id: "support",
    target: "support",
    titleKey: "tourSupportTitle",
    bodyKey: "tourSupportBody",
    title: "Need help?",
    body: "Raise a support ticket or book a call with an expert. Our team replies right inside the ticket.",
  },
  {
    id: "profile",
    target: "profile",
    titleKey: "tourProfileTitle",
    bodyKey: "tourProfileBody",
    title: "Your profile",
    body: "Update your details, see your dashboard and watch history, and replay this tour from here.",
  },
  {
    id: "done",
    titleKey: "tourDoneTitle",
    bodyKey: "tourDoneBody",
    title: "You're all set 🚀",
    body: "Start with a course, say hello in the Community, and check Mentorship for your weekly plan.",
  },
];

/** The element for a step, if it is on screen at this viewport size. */
function findTarget(target?: string): HTMLElement | null {
  if (!target || typeof document === "undefined") return null;
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`));
  return els.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }) ?? null;
}

function doneKey(memberId: string) {
  return `${DONE_KEY_PREFIX}${memberId}`;
}

/**
 * First-login guided tour of the member app: a spotlight on each navbar area with a short
 * explanation. Auto-starts once per member (remembered in this browser), can be replayed
 * from the profile menu (START_TOUR_EVENT) or with `?tour=1` in the URL.
 */
export function OnboardingTour() {
  const { data: me } = useMe();
  const { uiStrings } = useSiteConfig();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [steps, setSteps] = useState<Step[]>(STEPS);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const memberId = (me as any)?.id as string | undefined;
  const isActive = (me as any)?.status === "active";

  useSuppressAds("onboarding-tour", open);

  const str = useCallback(
    (key: string, fallback: string) => ((uiStrings as any)?.[key] as string | undefined) || fallback,
    [uiStrings],
  );

  const start = useCallback(() => {
    // Only steps whose element is visible at this screen size (e.g. "menu" on phones,
    // "nav" and "progress" on desktop); centred steps always stay.
    setSteps(STEPS.filter((s) => !s.target || findTarget(s.target)));
    setIndex(0);
    setOpen(true);
  }, []);

  const finish = useCallback(() => {
    setOpen(false);
    if (memberId) {
      try { localStorage.setItem(doneKey(memberId), new Date().toISOString()); } catch {}
    }
  }, [memberId]);

  // Auto-start once per member, or when the URL asks for it.
  const forceTour = searchParams.get("tour") === "1";
  useEffect(() => {
    if (!memberId || !isActive || open) return;
    let seen = false;
    try { seen = !!localStorage.getItem(doneKey(memberId)); } catch { seen = true; }
    if (seen && !forceTour) return;
    const t = setTimeout(start, AUTO_START_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, isActive, forceTour]);

  // Replay from anywhere.
  useEffect(() => {
    const onStart = () => start();
    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, [start]);

  const step = steps[index];

  // Track the highlighted element's position (it can move on resize/scroll).
  useLayoutEffect(() => {
    if (!open || !step) return;
    const measure = () => {
      const el = findTarget(step.target);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const id = setInterval(measure, 500); // navbar contents can load late
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      clearInterval(id);
    };
  }, [open, step]);

  const next = useCallback(() => {
    if (index >= steps.length - 1) finish();
    else setIndex((i) => i + 1);
  }, [index, steps.length, finish]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Keyboard: Esc skips, arrows move between steps.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, back, finish]);

  useEffect(() => {
    if (open) nextBtnRef.current?.focus();
  }, [open, index]);

  // Card placement: below the target when there is room, otherwise above; centred without one.
  const cardStyle = useMemo<React.CSSProperties>(() => {
    const W = typeof window !== "undefined" ? window.innerWidth : 1024;
    const H = typeof window !== "undefined" ? window.innerHeight : 768;
    const width = Math.min(340, W - 32);
    if (!rect) return { width, left: (W - width) / 2, top: Math.max(16, H / 2 - 120) };
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), W - width - 16);
    const below = rect.bottom + PAD + 14;
    if (below + 220 < H) return { width, left, top: below };
    return { width, left, bottom: H - rect.top + PAD + 14 };
  }, [rect]);

  if (!open || !step || typeof document === "undefined") return null;

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      {/* Dim layer; the spotlight's huge shadow does the dimming when there is a target. */}
      {rect ? (
        <div
          className="fixed rounded-2xl pointer-events-none transition-all duration-300 ease-out"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.65), 0 0 0 2px var(--color-accent), 0 0 24px 4px color-mix(in srgb, var(--color-accent) 55%, transparent)",
          }}
        />
      ) : (
        <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.65)" }} />
      )}
      {/* Blocks clicks on the page while the tour is open. */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tbt-tour-title"
        aria-describedby="tbt-tour-body"
        className="fixed rounded-2xl p-5 transition-all duration-300 ease-out"
        style={{
          ...cardStyle,
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-medium)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        }}
      >
        <button
          type="button"
          onClick={finish}
          className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label={str("tourSkipLabel", "Skip tour")}
        >
          <X size={16} />
        </button>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--color-accent)" }}>
          {str("tourStepLabel", "Step")} {index + 1} / {steps.length}
        </p>
        <h2 id="tbt-tour-title" className="text-base font-bold text-foreground pr-6">
          {str(step.titleKey, step.title)}
        </h2>
        <p id="tbt-tour-body" className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          {str(step.bodyKey, step.body)}
        </p>

        {/* Progress dots */}
        <div className="flex gap-1.5 mt-4" aria-hidden="true">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === index ? 18 : 6,
                background: i <= index ? "var(--color-accent)" : "var(--color-border-medium)",
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 mt-4">
          {isFirst ? (
            <button type="button" onClick={finish} className="text-sm text-muted-foreground hover:text-foreground px-1 py-2">
              {str("tourSkipLabel", "Skip tour")}
            </button>
          ) : (
            <button type="button" onClick={back} className="text-sm text-muted-foreground hover:text-foreground px-1 py-2">
              {str("tourBackLabel", "Back")}
            </button>
          )}
          <button
            ref={nextBtnRef}
            type="button"
            onClick={next}
            className="text-sm font-semibold text-white rounded-xl px-4 py-2 min-h-[40px]"
            style={{ background: "var(--color-accent)" }}
          >
            {isFirst
              ? str("tourStartLabel", "Show me around")
              : isLast
                ? str("tourFinishLabel", "Get started")
                : str("tourNextLabel", "Next")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

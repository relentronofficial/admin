"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { adsService } from "@/lib/api/services/ads.service";
import { getServerNow } from "@/lib/api/client";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import type { AdCampaign } from "@/types";
import type { AdEndReason } from "@/lib/hooks/useAds";
import { AdCountdown } from "./AdCountdown";
import { ImageAdView } from "./ImageAdView";
import VideoAdView, { type VideoAdViewHandle } from "./VideoAdView";

interface FullscreenAdOverlayProps {
  campaign: AdCampaign;
  displayToken: string;
  onEnd: (reason: AdEndReason) => void;
}

/** Budget for the media to report itself loaded. Exceeded ⇒ teardown. */
const LOAD_TIMEOUT_MS = 8_000;

/**
 * Absolute lifetime ceiling, so a stalled-but-"loaded" ad can never strand the
 * user. Deliberately generous: it must never cut a legitimate ad short, so it
 * is `duration + 30s` with a 60s floor — NOT a flat 15s, which would kill any
 * video ad longer than 15 seconds mid-playback.
 */
function maxLifetimeMs(durationSeconds: number | null): number {
  return Math.max(60_000, (durationSeconds ?? 0) * 1000 + 30_000);
}

export function FullscreenAdOverlay({ campaign, displayToken, onEnd }: FullscreenAdOverlayProps) {
  const router = useRouter();
  const { uiStrings } = useSiteConfig();

  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [videoPosition, setVideoPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(campaign.durationSeconds ?? 0);
  const [showUnmute, setShowUnmute] = useState(false);
  /** Video creative failed and a fallback image is standing in for it (§11). */
  const [videoFellBack, setVideoFellBack] = useState(false);

  const videoRef = useRef<VideoAdViewHandle | null>(null);
  const endedRef = useRef(false);
  const impressionSentRef = useRef(false);

  /**
   * Mirror of `elapsed` for use inside `end()`.
   *
   * `end` must NOT depend on the elapsed state: it is consumed by the timeout
   * effects, and a dependency that changes every second would clear and
   * re-arm those timers on every tick — so the load timeout would never fire
   * and a broken ad would trap the user.
   */
  const elapsedRef = useRef(0);

  const isVideo = campaign.mediaType === "video";
  /** What is on screen right now, which is not the same as what the campaign
   *  is: once the fallback image takes over, every clock and control has to
   *  follow it, or skip gating stays pinned to a playhead that stopped moving
   *  and the user is stuck until the lifetime ceiling fires. */
  const playingVideo = isVideo && !videoFellBack;

  // ── Single teardown path ────────────────────────────────────────────
  // Every exit funnels through here. Guarded so a race (auto-close firing as
  // the user clicks skip) reports exactly one outcome.
  const end = useCallback(
    (reason: AdEndReason) => {
      if (endedRef.current) return;
      endedRef.current = true;

      const elapsedSecs = isVideo
        ? videoRef.current?.getCurrentTime() ?? elapsedRef.current
        : elapsedRef.current;
      const duration = isVideo ? videoRef.current?.getDuration() ?? 0 : campaign.durationSeconds ?? 0;
      const pct = duration > 0 ? Math.min(100, (elapsedSecs / duration) * 100) : 0;
      const payload = { displayToken, elapsedSeconds: elapsedSecs, completionPercentage: pct };

      try {
        videoRef.current?.pause();
      } catch {
        /* ignore */
      }

      // Fire-and-forget: teardown must not wait on the network.
      if (reason === "completed") void adsService.complete(payload);
      else if (reason === "skipped") void adsService.skip(payload);
      else if (reason === "closed" || reason === "load_timeout") void adsService.close(payload);
      else if (reason === "media_error") {
        void adsService.events(displayToken, [
          { eventType: "media_error", elapsedSeconds: elapsedSecs },
        ]);
        void adsService.close(payload);
      }

      onEnd(reason);
    },
    // No `elapsed` here by design — see elapsedRef above.
    [displayToken, isVideo, campaign.durationSeconds, onEnd],
  );

  // ── Mount / portal ──────────────────────────────────────────────────
  useEffect(() => setMounted(true), []);

  // ── Scroll lock ─────────────────────────────────────────────────────
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      // Restore the PREVIOUS value, not a hardcoded "". The podcast MiniPlayer
      // and other overlays may have set it, and clobbering that would leave
      // the page in the wrong scroll state.
      document.body.style.overflow = previous;
    };
  }, []);

  // ── Visible-time clock ──────────────────────────────────────────────
  // Accumulates elapsed time from `getServerNow()` deltas rather than counting
  // ticks (speckit §9): a busy main thread delays interval callbacks, and a
  // tick counter would under-count that as time not spent — an image ad's skip
  // gate would then unlock late for exactly the users on the slowest devices.
  // Hidden time is excluded by resetting the mark instead of accumulating it,
  // so backgrounding the tab cannot burn the gate down either.
  useEffect(() => {
    let mark = getServerNow();
    const id = setInterval(() => {
      const now = getServerNow();
      const deltaSeconds = (now - mark) / 1000;
      mark = now;
      if (document.visibilityState !== "visible") return;
      setElapsed((e) => {
        const next = e + deltaSeconds;
        elapsedRef.current = next;
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Pause ad playback when hidden; resume when visible — but only what we
  // paused ourselves. Resuming unconditionally would start an ad the admin
  // configured as `autoplay: false`, or one a rejected autoplay left paused,
  // purely because the user switched tabs and came back.
  const pausedForVisibilityRef = useRef(false);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!pausedForVisibilityRef.current) return;
        pausedForVisibilityRef.current = false;
        videoRef.current?.play();
        return;
      }
      pausedForVisibilityRef.current = true;
      videoRef.current?.pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // ── Impression: only once actually rendered AND on screen ───────────
  // Selection is not an impression (speckit §3.2), and neither is an ad that
  // loaded while the tab sat in the background — that would bill the campaign
  // and burn the user's frequency cap for something nobody saw. Wait for the
  // document to be visible, then report once.
  useEffect(() => {
    if (!loaded || impressionSentRef.current) return;

    const report = () => {
      if (impressionSentRef.current) return;
      impressionSentRef.current = true;
      void adsService.impression(displayToken).then((res) => {
        // The campaign was paused or archived between selection and render.
        // Tear down silently — no error, no toast: from the user's side an ad
        // that never appears is the correct outcome, not a failure (§11).
        if (res?.data?.showAd === false) end("invalidated");
      });
    };

    if (document.visibilityState === "visible") {
      report();
      return;
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") report();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loaded, displayToken]);

  // ── Timeouts ────────────────────────────────────────────────────────
  useEffect(() => {
    const loadTimer = setTimeout(() => {
      if (loaded) return;
      // Distinct from a mid-playback `media_error`: nothing ever rendered.
      // The admin needs the two separated to tell "the creative is broken" from
      // "the CDN was slow for this user" (§11).
      void adsService.events(displayToken, [
        { eventType: "load_error", elapsedSeconds: elapsedRef.current },
      ]);
      end("load_timeout");
    }, LOAD_TIMEOUT_MS);
    const hardTimer = setTimeout(() => end("load_timeout"), maxLifetimeMs(campaign.durationSeconds));
    return () => {
      clearTimeout(loadTimer);
      clearTimeout(hardTimer);
    };
  }, [loaded, end, displayToken, campaign.durationSeconds]);

  // ── Skip gating ─────────────────────────────────────────────────────
  // Video uses the playhead (buffering must not unlock skip early); image ads
  // use the visible-time clock.
  const skipProgressSeconds = playingVideo ? videoPosition : elapsed;

  const skipUnlockAt = useMemo(() => {
    const cfg = campaign.skipConfig;
    if (!cfg?.enabled) return null;
    if (cfg.type === "after_end") return null;
    if (campaign.skipAvailableAfterSeconds !== null) return campaign.skipAvailableAfterSeconds;
    if (cfg.type === "immediate") return 0;
    if (cfg.type === "seconds") return cfg.value ?? 0;
    if (cfg.type === "percent" && videoDuration > 0) {
      return (videoDuration * (cfg.value ?? 0)) / 100;
    }
    return null;
  }, [campaign.skipConfig, campaign.skipAvailableAfterSeconds, videoDuration]);

  const skipAvailable =
    campaign.skipConfig?.enabled === true &&
    skipUnlockAt !== null &&
    skipProgressSeconds >= skipUnlockAt;

  const skipCountdown =
    skipUnlockAt !== null ? Math.max(0, Math.ceil(skipUnlockAt - skipProgressSeconds)) : null;

  const skipAvailableFiredRef = useRef(false);
  useEffect(() => {
    if (!skipAvailable || skipAvailableFiredRef.current) return;
    skipAvailableFiredRef.current = true;
    void adsService.events(displayToken, [
      { eventType: "skip_available", elapsedSeconds: skipProgressSeconds },
    ]);
  }, [skipAvailable, displayToken, skipProgressSeconds]);

  // ── Close gating ────────────────────────────────────────────────────
  const closeEnabled = campaign.closeConfig?.enabled === true;
  const autoCloseAt = campaign.closeConfig?.autoClose
    ? campaign.closeConfig.autoCloseSeconds ?? null
    : null;

  useEffect(() => {
    if (autoCloseAt === null) return;
    if (elapsed >= autoCloseAt) end("closed");
  }, [elapsed, autoCloseAt, end]);

  // ── Escape key — only when closing is permitted ──────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!closeEnabled) return;
      e.preventDefault();
      end("closed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeEnabled, end]);

  // ── Video failure → fallback image, not teardown ────────────────────
  // §11: a creative that fails to load falls back to `fallbackMediaUrl` when
  // one is configured, and only ends the ad when there is nothing left to
  // show. The `media_error` event is still emitted either way — the admin
  // needs to see that the video is broken even though the user saw an ad.
  const handleVideoError = useCallback(() => {
    void adsService.events(displayToken, [
      {
        eventType: "media_error",
        elapsedSeconds: elapsedRef.current,
        metadata: campaign.fallbackMediaUrl ? { recovered: "fallback_image" } : undefined,
      },
    ]);
    if (campaign.fallbackMediaUrl) {
      // Reset the loaded gate: the fallback image has to report itself before
      // the impression counts, exactly as the video would have.
      setLoaded(false);
      setVideoFellBack(true);
      return;
    }
    end("media_error");
  }, [campaign.fallbackMediaUrl, displayToken, end]);

  // ── CTA ─────────────────────────────────────────────────────────────
  const cta = campaign.ctaConfig;
  const ctaVisible =
    cta?.enabled === true &&
    !!cta.target &&
    elapsed >= (cta.showAfterSeconds ?? 0);

  const handleCta = useCallback(async () => {
    if (!cta?.target) return;

    // Record the click BEFORE navigating — a page transition cancels in-flight
    // requests (speckit §9).
    await adsService.click({ displayToken, elapsedSeconds: skipProgressSeconds });

    // Every failure below keeps the ad open on purpose (§11): dropping the user
    // somewhere unexpected, or tearing the overlay down as if the click worked,
    // both read as "the app is broken". Leaving it up lets them dismiss it
    // deliberately, and the lifetime ceiling still guarantees an exit.
    const failed = (reason: string) => {
      void adsService.events(displayToken, [
        {
          eventType: "cta_click_failed",
          elapsedSeconds: skipProgressSeconds,
          metadata: { reason, target: cta.target },
        },
      ]);
    };

    if (cta.type === "external_url") {
      try {
        const url = new URL(cta.target);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          failed("blocked_protocol");
          return;
        }
        const opened = window.open(url.toString(), "_blank", "noopener,noreferrer");
        if (!opened) {
          // Popup blocker. The user clicked and nothing happened, which is a
          // failed click, not a conversion.
          failed("popup_blocked");
          return;
        }
        end("cta");
      } catch {
        failed("malformed_url");
      }
      return;
    }

    // Internal route. Validate BEFORE tearing down — ending the ad and then
    // discovering the target is unusable would leave the user staring at the
    // page they were already on with no explanation.
    if (!cta.target.startsWith("/") || cta.target.startsWith("//")) {
      failed("invalid_internal_route");
      return;
    }

    // Tear down first so the restored media is not fighting a route transition.
    end("cta");
    try {
      router.push(cta.target);
    } catch {
      /* already ended; the user is on a valid route either way */
    }
  }, [cta, displayToken, skipProgressSeconds, end, router]);

  if (!mounted) return null;

  const t = {
    skip: uiStrings?.adSkipLabel ?? "Skip",
    skipIn: uiStrings?.adSkipInLabel ?? "Skip in",
    close: uiStrings?.adCloseLabel ?? "Close",
    unmute: uiStrings?.adUnmuteLabel ?? "Tap for sound",
    loading: uiStrings?.loading ?? "Loading…",
    sponsored: uiStrings?.adSponsoredLabel ?? "Sponsored",
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.sponsored}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: campaign.backgroundColor ?? "#000000" }}
    >
      {/* Media */}
      <div className="relative h-full w-full">
        {playingVideo ? (
          <VideoAdView
            ref={videoRef}
            campaign={campaign}
            onLoaded={(d) => {
              setLoaded(true);
              if (d > 0) setVideoDuration(d);
            }}
            onPlaybackStarted={() => {
              void adsService.events(displayToken, [{ eventType: "playback_started" }]);
            }}
            onTimeUpdate={(cur, dur) => {
              setVideoPosition(cur);
              if (dur > 0) setVideoDuration(dur);
            }}
            onEnded={() => end("completed")}
            onError={handleVideoError}
            onMutedFallback={() => setShowUnmute(true)}
          />
        ) : (
          <ImageAdView
            campaign={campaign}
            // A video that fell back has already burned its creative; go
            // straight to the fallback image rather than letting ImageAdView
            // try to load an .m3u8 as an <img> first.
            forceFallback={videoFellBack}
            elapsedSeconds={elapsed}
            onLoaded={() => setLoaded(true)}
            onError={() => end("media_error")}
            onDurationReached={() => end("completed")}
          />
        )}

        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-white/70">{t.loading}</span>
          </div>
        )}
      </div>

      {/* Chrome */}
      <span className="pointer-events-none absolute left-4 top-4 rounded bg-black/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/80">
        {t.sponsored}
      </span>

      <div className="absolute right-4 top-4 flex items-center gap-2">
        {showUnmute && (
          <button
            type="button"
            onClick={() => {
              videoRef.current?.setMuted(false);
              setShowUnmute(false);
            }}
            className="rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-black/80"
          >
            {t.unmute}
          </button>
        )}

        {campaign.skipConfig?.enabled && (
          <AdCountdown
            remaining={skipCountdown}
            ready={skipAvailable}
            waitingLabel={t.skipIn}
            readyLabel={t.skip}
            onClick={() => end("skipped")}
          />
        )}

        {closeEnabled && (
          <button
            type="button"
            onClick={() => end("closed")}
            aria-label={t.close}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-lg leading-none text-white backdrop-blur transition hover:bg-black/80"
          >
            ×
          </button>
        )}
      </div>

      {ctaVisible && cta?.text && (
        <button
          type="button"
          onClick={() => void handleCta()}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:opacity-90"
          style={{ background: "var(--color-accent)" }}
        >
          {cta.text}
        </button>
      )}
    </div>,
    document.body,
  );
}

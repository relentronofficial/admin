import apiClient from "../client";
import { getAnonymousId } from "@/lib/ads/session";
import { enqueue, flushQueue, onReconnect } from "@/lib/ads/trackingQueue";
import type {
  AdEligibleRequest,
  AdEligibleResponse,
  AdEventType,
  ApiResponse,
} from "@/types";

export interface AdLifecyclePayload {
  displayToken: string;
  elapsedSeconds?: number;
  completionPercentage?: number;
}

export interface AdEventPayload {
  eventType: AdEventType;
  eventTimestamp?: string;
  elapsedSeconds?: number;
  completionPercentage?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Every tracking call carries the device id. For a signed-in member the
 * backend binds the display token to the JWT cookie and ignores this; for a
 * guest it is the only thing proving the token belongs to this device, and a
 * call without it is rejected (speckit §6.4). Attached here rather than at the
 * call sites so no future endpoint can forget it.
 */
const withSubject = <T extends object>(payload: T): Record<string, unknown> => ({
  ...payload,
  anonymousId: getAnonymousId(),
});

const post = (path: string, body: Record<string, unknown>) =>
  apiClient.post<never, ApiResponse<unknown>>(path, body);

/**
 * Tracking is fire-and-forget by contract: a failed beacon must never block the
 * UI or gate ad teardown (speckit §11).
 *
 * "Failed" splits in two, though, and the distinction matters:
 *
 *   * The server answered and rejected us (expired token, wrong subject, rate
 *     limit). Retrying changes nothing — drop it.
 *   * The request never reached the server. That is the flaky-network case the
 *     spec asks us to queue and retry on reconnect, and dropping it silently
 *     loses the completion of every ad watched with bad signal.
 */
function track(path: string, body: Record<string, unknown>): Promise<unknown | null> {
  return post(path, body)
    .then((res) => {
      // A success is also the cheapest signal that the network is back.
      void flushQueue(post);
      return res;
    })
    .catch((err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      // No status at all ⇒ the request never got an answer: offline, DNS, CORS
      // preflight failure, or a timeout. Anything with a status was answered
      // and is final.
      if (status === undefined) enqueue(path, body);
      return null;
    });
}

let reconnectWired = false;

/** Idempotent — the orchestrator calls this on mount. */
export function initAdTracking(): void {
  if (reconnectWired) return;
  reconnectWired = true;
  onReconnect(() => void flushQueue(post));
  // Also drain anything left over from a previous session.
  void flushQueue(post);
}

export const adsService = {
  eligible: (body: AdEligibleRequest) =>
    apiClient.post<never, ApiResponse<AdEligibleResponse>>("/api/ads/eligible", body),

  /**
   * Confirms the ad actually rendered. Until this lands the backend treats the
   * token as a selection, not an impression.
   *
   * Returns the parsed response rather than swallowing it: the backend answers
   * `{ showAd: false }` when the campaign was paused or archived between
   * selection and render, and the caller has to tear the overlay down (§11).
   */
  impression: (displayToken: string) =>
    track("/api/ads/impression", withSubject({ displayToken })) as Promise<
      ApiResponse<{ showAd?: boolean; recorded?: boolean }> | null
    >,

  complete: (payload: AdLifecyclePayload) =>
    track("/api/ads/complete", withSubject(payload)),

  skip: (payload: AdLifecyclePayload) => track("/api/ads/skip", withSubject(payload)),

  close: (payload: AdLifecyclePayload) => track("/api/ads/close", withSubject(payload)),

  /** Must be awaited before navigating away, or the beacon is cancelled by the
   *  page transition (speckit §9). */
  click: (payload: AdLifecyclePayload) => track("/api/ads/click", withSubject(payload)),

  events: (displayToken: string, events: AdEventPayload[]) =>
    track("/api/ads/events", withSubject({ displayToken, events })),
};

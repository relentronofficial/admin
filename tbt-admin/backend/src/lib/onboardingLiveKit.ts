// Shared LiveKit plumbing for onboarding verification meetings. Mirrors the
// exact patterns already proven in modules/workshops/controller.ts (dynamic
// `import('livekit-server-sdk')`, no shared client singleton, wss->https
// rewrite for the REST API) but centralized here since this module has no
// legacy call sites to stay compatible with. Existing workshops code is left
// untouched — see ONBOARDING_LIVE_MEETING_SPECKIT.md for why this isn't a
// generalization of the workshops LiveCall model.

export const ONBOARDING_ROOM_PREFIX = 'onboarding-live-';

export function onboardingRoomName(meetingId: string): string {
  return `${ONBOARDING_ROOM_PREFIX}${meetingId}`;
}

export function meetingIdFromRoomName(roomName: string): string | null {
  if (!roomName.startsWith(ONBOARDING_ROOM_PREFIX)) return null;
  return roomName.slice(ONBOARDING_ROOM_PREFIX.length);
}

export function isLiveKitConfigured(env: {
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  LIVEKIT_WS_URL?: string;
}): boolean {
  return !!(env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVEKIT_WS_URL);
}

function httpUrl(wsUrl: string): string {
  return wsUrl.replace(/^wss?:\/\//, 'https://');
}

export async function getOnboardingRoomServiceClient(env: {
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  LIVEKIT_WS_URL: string;
}) {
  const { RoomServiceClient } = await import('livekit-server-sdk');
  return new RoomServiceClient(httpUrl(env.LIVEKIT_WS_URL), env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
}

export async function getOnboardingEgressClient(env: {
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  LIVEKIT_WS_URL: string;
}) {
  const { EgressClient } = await import('livekit-server-sdk');
  return new EgressClient(httpUrl(env.LIVEKIT_WS_URL), env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
}

/**
 * Mint a short-lived LiveKit token. `role: 'host'` grants roomAdmin + an 8h
 * TTL (staff running the verification call); `role: 'participant'` grants
 * publish/subscribe only with a 4h TTL (the member, or any co-invited
 * participant) — same two-tier shape as the workshops host/member split.
 */
export async function mintOnboardingToken(
  env: { LIVEKIT_API_KEY: string; LIVEKIT_API_SECRET: string },
  params: { meetingId: string; identity: string; name: string; role: 'host' | 'participant' },
): Promise<string> {
  const { AccessToken } = await import('livekit-server-sdk');
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: params.identity,
    name: params.name,
    ttl: params.role === 'host' ? '8h' : '4h',
  });
  at.addGrant({
    room: onboardingRoomName(params.meetingId),
    roomJoin: true,
    roomAdmin: params.role === 'host',
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return at.toJwt();
}

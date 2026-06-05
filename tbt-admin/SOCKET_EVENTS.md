# Socket.IO Event Reference

Complete reference for all Socket.IO events in the TBT platform.

## Server → Client Events

| Event Name | Room | Emitted By | Received By | Trigger | Payload |
|---|---|---|---|---|---|
| `notification` | `user:{memberId}` | `notifications/controller.ts` | Navbar, `/notifications` page | Admin sends targeted notification | `{ id, title, body, type, isRead, createdAt }` |
| `notification:broadcast` | All sockets | `notifications/controller.ts` | Navbar, `/notifications` page | Admin broadcasts to all members | `{ title, body, type }` |
| `qa:new_question` | `workshop:{slug}` | `user/controller.ts` | `/workshop/[slug]` Q&A tab | Member posts a question | `{ id, questionText, memberName, createdAt, replies: [] }` |
| `qa:new_reply` | `workshop:{slug}` | `user/controller.ts` | `/workshop/[slug]` Q&A tab | Member or admin replies to a question | `{ postId, reply: { id, replyText, createdAt } }` |
| `live:started` | `live:{webinarId}` | `webinar/controller.ts` | `/live/[webinarId]` | Admin starts a webinar | `{ webinarId, streamUrl, startedAt }` |
| `live:ended` | `live:{webinarId}` | `webinar/controller.ts` | `/live/[webinarId]` | Admin ends a webinar | `{ webinarId, recordingUrl }` |
| `live:attendee_count` | `live:{webinarId}` | `plugins/socket.ts` | `/live/[webinarId]` | Member joins or leaves the live room | `{ count }` |
| `live:reminder` | `user:{memberId}` | `webinar/controller.ts` | Navbar (toast) | Admin starts a webinar (pushed to all enrolled members) | `{ webinarId, title }` |
| `message:new` | `user:{memberId}` | Future messages controller | Navbar, `/messages` page | Admin sends a direct message | `{ messageId }` |
| `workshop:enrolled` | `user:{memberId}` | `workshops/controller.ts` | `/workshops` page | Admin enrolls a member in a workshop | `{ workshopId, workshopTitle }` |
| `workshop:removed` | `user:{memberId}` | `workshops/controller.ts` | `/workshops` page | Admin removes a member from a workshop | `{ workshopId }` |
| `admin:member_joined` | `admin` | `members/controller.ts` | Admin `/dashboard` | A new member account is created | `{ memberId, fullName, createdAt }` |

## Client → Server Events

| Event Name | Emitted By | Handled By | Payload | Effect |
|---|---|---|---|---|
| `join:workshop` | `/workshop/[slug]` page | `plugins/socket.ts` | `slug: string` | Socket joins `workshop:{slug}` room |
| `leave:workshop` | `/workshop/[slug]` page | `plugins/socket.ts` | `slug: string` | Socket leaves `workshop:{slug}` room |
| `join:live` | `/live/[webinarId]` page | `plugins/socket.ts` | `webinarId: string` | Socket joins `live:{webinarId}` room; emits updated `live:attendee_count` to room |
| `leave:live` | `/live/[webinarId]` page | `plugins/socket.ts` | `webinarId: string` | Socket leaves `live:{webinarId}` room; emits updated `live:attendee_count` to room |

## Room Architecture

| Room | Auto-joined on | Members |
|---|---|---|
| `user:{memberId}` | Connection (role = member) | Personal delivery — notifications, messages, enrollment updates |
| `workshop:{slug}` | Client emits `join:workshop` | Q&A live updates for that specific workshop |
| `live:{webinarId}` | Client emits `join:live` | Webinar status changes, attendee count |
| `admin` | Connection (role = admin) | Admin dashboard live activity feed |

---

## Implementation Order

Steps ordered to minimise risk and deliver visible results early.

| Step | What | Why First | Status |
|---|---|---|---|
| 1 | Install `socket.io-client` in both frontends | Unlocks everything | ✅ Done |
| 2 | Rebuild backend socket plugin with auth + rooms | Foundation — must be done before frontend | ✅ Done |
| 3 | Add env vars `USER_WEB_URL`, `ADMIN_WEB_URL` | Needed for CORS | ✅ Done |
| 4 | Create `lib/socket/client.ts` in tbt-user-web | Singleton needed by all features | ✅ Done |
| 5 | Wire `initSocket` in `Providers.tsx` | Without this nothing connects | ✅ Done |
| 6 | Notifications (Navbar badge + page) | Highest visibility; backend emit already exists | ✅ Done |
| 7 | Q&A real-time + remove `refetchInterval` | Fixes existing polling hack | ✅ Done |
| 8 | Live / Webinar status | High user impact | ✅ Done |
| 9 | Workshop enrollment updates | Medium impact | ✅ Done |
| 10 | Admin panel socket client + dashboard feed | Admin-side polish | ✅ Done |
| 11 | Message badge updates | Depends on future messages backend | ✅ Done |

---

## Known Constraints & Notes

1. **`refetchInterval` on `useWorkshopQa`** — Removed. `refetchInterval: 15 * 1000` was a polling workaround; socket events (`qa:new_question`, `qa:new_reply`) now drive updates. Keeping both would cause double invalidation.

2. **Notification model field name** — The `Notification` Prisma model uses `memberId` (not `userId`). The controller and schema were aligned to `memberId` during §3.1.

3. **Admin socket role detection** — On connection, the plugin checks `member` table first, then `admin` table, using the Clerk sub. Admin-panel users must exist in the `Admin` table (not `Member`) for role detection to route them to the `admin` room.

4. **Reconnection token refresh** — Clerk JWTs expire. Both socket singletons (`tbt-user-web/lib/socket/client.ts` and `admin-panel/lib/socket/client.ts`) attach a `reconnect_attempt` listener that calls `disconnectSocket()` / `getSocket()` (or their admin equivalents) to create a fresh connection with a new token before each retry.

5. **Multiple browser tabs** — Each tab opens a separate socket. Personal room delivery (`user:{memberId}`) reaches all sockets in the room, so all tabs update simultaneously. This is correct and expected behaviour.

6. **Redis adapter for horizontal scaling** — If the backend is scaled to multiple Railway instances, `@socket.io/redis-adapter` with Upstash Redis (already installed) is required so events emitted on one instance reach clients connected to another. Not required for single-instance deployment.

7. **Agora.io vs Socket.IO** — `AGORA_APP_ID` / `AGORA_APP_CERT` env vars exist for WebRTC audio/video transport. Socket.IO handles only the signalling layer (webinar started/ended status, attendee count). Do not replace Agora with Socket.IO for actual video streaming.

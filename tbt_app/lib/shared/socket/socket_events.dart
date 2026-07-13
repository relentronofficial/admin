// All Socket.IO event name constants used by the TBT app.

// ── Member room events (user:{memberId}) ──────────────────────────────────────

/// A new in-app notification was created for this member.
const String kSocketNotification = 'notification';

/// A new direct message was received.
const String kSocketMessageNew = 'message:new';

/// Workshop enrollment was granted.
const String kSocketWorkshopEnrolled = 'workshop:enrolled';

/// Workshop enrollment was removed.
const String kSocketWorkshopRemoved = 'workshop:removed';

/// Live call admission was locked (member is in queue).
const String kSocketLiveCallLock = 'live_call:lock';

/// Live call admission was granted.
const String kSocketLiveCallAdmitted = 'live_call:admitted';

/// A live call poll was broadcast.
const String kSocketLiveCallPoll = 'live_call:poll';

/// Reminder fired for an upcoming live session.
const String kSocketLiveReminder = 'live:reminder';

/// A batch day was approved by an admin.
/// Payload: `{ dayNumber: int, batchId: String, xpAwarded: int }`.
const String kSocketBatchDayApproved = 'batch:day_approved';

/// A batch day submission was rejected by an admin.
/// Payload: `{ dayNumber: int, reviewNote: String }`.
const String kSocketBatchDayRejected = 'batch:day_rejected';

/// The entire batch program was completed.
/// Payload: `{ totalDays: int }`.
const String kSocketBatchCompleted = 'batch:completed';

/// Course access was granted to this member.
/// Payload: `{ courseId: String }`.
const String kSocketCourseAccessGranted = 'course:access_granted';

// ── Workshop room events (workshop:{slug}) ────────────────────────────────────

/// A new Q&A question was posted in the workshop.
const String kSocketQaNewQuestion = 'qa:new_question';

/// A new reply was posted to a Q&A question.
const String kSocketQaNewReply = 'qa:new_reply';

// ── Live session room events (live:{webinarId}) ───────────────────────────────

/// The live session started.
const String kSocketLiveStarted = 'live:started';

/// The live session ended.
const String kSocketLiveEnded = 'live:ended';

/// Current attendee count update.
const String kSocketLiveAttendeeCount = 'live:attendee_count';

// ── Conversation room events (conversation:{id}) ──────────────────────────────

/// A new chat message was received in a conversation.
const String kSocketChatMessage = 'chat:message';

/// Someone is typing in a conversation.
const String kSocketChatTyping = 'chat:typing';

/// A conversation was closed by support.
const String kSocketChatConversationClosed = 'chat:conversation_closed';

/// A closed conversation was reopened.
const String kSocketChatConversationReopened = 'chat:conversation_reopened';

// ── Broadcast events ──────────────────────────────────────────────────────────

/// A broadcast notification was sent to all members.
const String kSocketNotificationBroadcast = 'notification:broadcast';

// ── Client-emitted room join/leave events ─────────────────────────────────────

/// Emitted by client to join a workshop room.
const String kSocketJoinWorkshop = 'join:workshop';

/// Emitted by client to leave a workshop room.
const String kSocketLeaveWorkshop = 'leave:workshop';

/// Emitted by client to join a live session room.
const String kSocketJoinLive = 'join:live';

/// Emitted by client to leave a live session room.
const String kSocketLeaveLive = 'leave:live';

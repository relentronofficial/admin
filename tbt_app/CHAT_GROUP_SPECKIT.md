# Chat Group WhatsApp Parity — Implementation Speckit

> **Scope:** Flutter app (`tbt_app/`) + Fastify backend (`tbt-admin/backend/`).  
> **Baseline:** All Phase 5 features (voice notes, forward, pin strip, star, mute, DM media, reply-jump, @mentions, presence, in-group search, FCM push, read receipts, media, replies) are already shipped.  
> **This doc covers only what is missing** relative to WhatsApp group chat.

---

## Priority tiers

| Tier | Label | Criteria |
|---|---|---|
| P0 | **Must-have** | Daily-use gesture/flow; feels broken without it |
| P1 | **High value** | Noticeably missing; adds quality |
| P2 | **Nice-to-have** | Polish; not blocking |

---

## P0 — Must-Have

---

### F-01 · Swipe-to-Reply

**Current:** Reply only via long-press → action sheet → "Reply". Two steps + a modal.  
**Target:** Swipe right on any message bubble to trigger reply inline — identical to WhatsApp.

#### Flutter — `chat_group_screen.dart`

1. Wrap each `_MessageBubble` in a `Dismissible`-style drag detector.  
   Use `GestureDetector.onHorizontalDragUpdate / onHorizontalDragEnd` rather than `Dismissible` (which dismisses permanently). Track `_swipeOffsets = <String, double>{}` keyed by message id.

2. On `onHorizontalDragUpdate`:
   - Only allow drag right (dx > 0 for left-aligned messages, either direction for own messages is fine — mirror WhatsApp: swipe right regardless of side).
   - Clamp to max `60px` visually (use `Transform.translate` on the bubble).
   - At `48px` threshold: trigger `HapticFeedback.mediumImpact()` (once per drag gesture, guard with a `bool _hapticFired`).

3. On `onHorizontalDragEnd`:
   - If reached threshold: call `_onReply(msg)` (sets `_replyingTo`, focuses composer).
   - Reset translation via animated tween back to 0 (`AnimationController`, ~150ms).

4. Show a reply icon that slides in from the left as the bubble is pulled:
   ```dart
   // Positioned at the leading edge, opacity = (swipeOffset / 48).clamp(0,1)
   Icon(Icons.reply_rounded, color: kColorAccent, size: 20)
   ```

5. Remove swipe handling for deleted messages (`message.isDeleted`).

#### State changes
- Add `final Map<String, double> _swipeOffsets = {}` and `final Map<String, bool> _swipeHapticFired = {}` to `_ChatGroupScreenState`.
- Rename existing `onReply` callback to avoid conflict — it is already `onReply: () { setState(() { _replyingTo = msg; }); }`.

#### Files touched
- `chat_group_screen.dart` — `_MessageBubble` wrapper + state fields

#### No backend changes needed.

---

### F-02 · Voice Note Preview Before Send

**Current:** Releasing the mic button immediately uploads and sends. No way to cancel after recording stops or to preview length/content.  
**Target:** After releasing mic: show a preview bar with play/pause, duration, waveform, a ✓ send button, and an ✗ discard button — identical to WhatsApp.

#### Flutter — `chat_group_screen.dart`

1. Add state: `String? _pendingAudioPath` and `bool _pendingAudioSending`.

2. In `_stopRecording(cancelled: false)`: instead of uploading immediately, set:
   ```dart
   setState(() {
     _pendingAudioPath = path;
     _pendingAudioSending = false;
   });
   ```
   Do NOT upload yet.

3. Show `_VoicePreviewBar` in composer area (replaces recording indicator) when `_pendingAudioPath != null`:
   ```
   ┌────────────────────────────────────────┐
   │ [✗]  [▶ 0:12]  ▓▓▓░░░░░  [✓ Send]   │
   └────────────────────────────────────────┘
   ```
   - ✗ button: delete the temp file, `setState(() { _pendingAudioPath = null; })`.
   - ▶ button: inline `just_audio` playback of the local file (reuse `_AudioBubble` logic — but source is `AudioSource.file(File(path))`).
   - ✓ Send button: call `_sendPendingAudio()`.

4. `_sendPendingAudio()`:
   ```dart
   setState(() => _pendingAudioSending = true);
   final uploaded = await ref.read(chatGroupsServiceProvider).uploadMedia(File(_pendingAudioPath!));
   if (uploaded == null) { showSnackBar('Upload failed'); setState(() => _pendingAudioSending = false); return; }
   await ref.read(chatGroupsServiceProvider).sendMessage(groupId, mediaUrl: uploaded.publicUrl, mediaType: 'audio');
   File(_pendingAudioPath!).delete().ignore();
   setState(() { _pendingAudioPath = null; _pendingAudioSending = false; });
   ```

#### New widget
`_VoicePreviewBar` — stateful, creates its own `AudioPlayer` for local file playback. Props: `path`, `onSend`, `onDiscard`, `sending`.

#### Files touched
- `chat_group_screen.dart` — `_stopRecording`, new `_sendPendingAudio`, new `_VoicePreviewBar` widget, new state fields.

#### No backend changes needed.

---

### F-03 · Pin / Unpin from Member UI

**Current:** Backend has admin-only `POST /api/chat-groups/admin/:id/messages/:messageId/pin`. Members can see the pinned strip but cannot pin anything. No member-facing pin endpoint exists.  
**Target:** Any group member can pin a message. Long-press → "Pin" option visible in action sheet.

#### Backend — `controller.ts` + `routes.ts`

Add two member-scoped handlers next to the existing member handlers:

```typescript
// POST /api/chat-groups/:id/messages/:messageId/pin   (member-scoped)
export async function memberPinMessageHandler(req, reply) {
  const { id: groupId, messageId } = req.params as { id: string; messageId: string };
  const memberId = (req as any).memberId as string;
  const isMember = await requireMemberOfGroup(req, groupId);
  if (!isMember) return fail(reply, 403, 'FORBIDDEN', 'Not a member of this group.');

  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_group_messages SET pinned_at = NOW()
     WHERE id = $1::uuid AND group_id = $2::uuid AND deleted_at IS NULL`,
    messageId, groupId,
  );
  req.server.io.to(`group:${groupId}`).emit('group:pinned', { groupId, messageId, pinned: true, pinnedBy: memberId });
  return ok(reply, { pinned: true });
}

// DELETE /api/chat-groups/:id/messages/:messageId/pin   (member-scoped)
export async function memberUnpinMessageHandler(req, reply) {
  const { id: groupId, messageId } = req.params as { id: string; messageId: string };
  const isMember = await requireMemberOfGroup(req, groupId);
  if (!isMember) return fail(reply, 403, 'FORBIDDEN', 'Not a member of this group.');

  await req.server.prisma.$executeRawUnsafe(
    `UPDATE chat_group_messages SET pinned_at = NULL
     WHERE id = $1::uuid AND group_id = $2::uuid`,
    messageId, groupId,
  );
  req.server.io.to(`group:${groupId}`).emit('group:pinned', { groupId, messageId, pinned: false });
  return ok(reply, { pinned: false });
}
```

Register in `routes.ts` (member scope):
```typescript
userScope.post('/:id/messages/:messageId/pin', memberPinMessageHandler);
userScope.delete('/:id/messages/:messageId/pin', memberUnpinMessageHandler);
```

#### Flutter — `chat_groups_service.dart`

```dart
Future<void> pinMessage(String groupId, String messageId) async {
  await _dio.post<dynamic>('/api/chat-groups/$groupId/messages/$messageId/pin');
}
Future<void> unpinMessage(String groupId, String messageId) async {
  await _dio.delete<dynamic>('/api/chat-groups/$groupId/messages/$messageId/pin');
}
```

#### Flutter — `chat_group_screen.dart`

In `_openActionSheet`:
- Add "Pin" / "Unpin" `ListTile` after "Star".
- Show "Pin" when `!message.isPinned`, "Unpin" when `message.isPinned`.
- On tap: call `pinMessage` / `unpinMessage` via service; socket `group:pinned` will update state.
- `pinnedAt` is already in the model and `_MessageBubble` already shows a pin icon when `isPinned`.

The `onPinned` socket handler in `chat_group_providers.dart` already invalidates `chatGroupPinnedProvider` and updates the bubble flag — no change needed there.

#### Files touched
- `controller.ts` — two new handlers
- `routes.ts` — two new routes
- `chat_groups_service.dart` — `pinMessage`, `unpinMessage`
- `chat_group_screen.dart` — action sheet

---

### F-04 · Scroll-to-Bottom FAB with Unread Count

**Current:** When user scrolls up in history, there is no way to jump back to the latest message. No unread count indicator.  
**Target:** A floating action button (↓) appears when the user is not at the tail. Shows an unread badge count when there are new messages. Tapping it jumps to bottom and clears the badge.

#### Flutter — `chat_group_screen.dart`

1. Add state:
   ```dart
   bool _showScrollToBottom = false;
   int _unreadWhileScrolled = 0;
   ```

2. In `_onScrollPositions`: the list is `reverse:true` so item 0 = newest. "At bottom" = `itemPositionsListener` has an item with index == 0 visible.
   ```dart
   final atBottom = positions.any((p) => p.index == 0);
   if (atBottom != !_showScrollToBottom) {
     setState(() { _showScrollToBottom = !atBottom; });
     if (atBottom) setState(() => _unreadWhileScrolled = 0);
   }
   ```

3. In the `ref.listen` block that calls `_markTailRead` when new messages arrive:
   ```dart
   if (nextLen > prevLen && _showScrollToBottom) {
     setState(() => _unreadWhileScrolled += nextLen - prevLen);
   }
   ```

4. Overlay the FAB in the `Stack` wrapping `ScrollablePositionedList`:
   ```dart
   if (_showScrollToBottom)
     Positioned(
       right: 12, bottom: 12,
       child: FloatingActionButton.small(
         backgroundColor: tokens.bgSurface,
         elevation: 4,
         onPressed: _scrollToBottom,
         child: Badge(
           isLabelVisible: _unreadWhileScrolled > 0,
           label: Text('$_unreadWhileScrolled'),
           child: Icon(Icons.keyboard_arrow_down_rounded, color: tokens.textPrimary),
         ),
       ),
     ),
   ```

5. `_scrollToBottom`:
   ```dart
   void _scrollToBottom() {
     if (_itemScrollController.isAttached) {
       _itemScrollController.scrollTo(index: 0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
     }
     setState(() { _showScrollToBottom = false; _unreadWhileScrolled = 0; });
     _markTailRead();
   }
   ```

6. Wrap the `Expanded(child: messagesAsync.when(...))` with `Stack` to overlay the FAB.

#### Files touched
- `chat_group_screen.dart` — state, `_onScrollPositions`, `ref.listen`, `build` (Stack + FAB)

#### No backend changes needed.

---

### F-05 · Multi-Select Messages (Bulk Delete / Forward / Star)

**Current:** Every action is single-message only.  
**Target:** Long-press enters selection mode. Tap additional messages to select. Bottom toolbar shows Delete / Forward / Star / ✗ Exit. Matches WhatsApp selection UX.

#### Flutter — `chat_group_screen.dart`

1. Add state:
   ```dart
   final Set<String> _selectedIds = {};
   bool get _inSelectionMode => _selectedIds.isNotEmpty;
   ```

2. In `_MessageBubble.onLongPress`:
   - If NOT in selection mode: current action sheet opens (unchanged).
   - Pass a new `onSelect` callback from `_ChatGroupScreenState`. In `_ChatGroupScreenState`, if selection mode is active, `onLongPress` selects instead of opening sheet.
   - Restructure: add `onSelect: (id) => setState(() => _selectedIds.contains(id) ? _selectedIds.remove(id) : _selectedIds.add(id))`.

3. Tap on a bubble while in selection mode:
   - Currently tap does nothing (only long-press opens sheet). Add `onTap` to `GestureDetector` in `_MessageBubble`:
     ```dart
     onTap: _inSelectionMode ? () => onSelect?.call(message.id) : null,
     ```

4. Visual feedback: `_MessageBubble` receives `isSelected: bool` prop. When `true`, show a checkmark overlay (semi-transparent tint + `Icons.check_circle` in corner).

5. Show a selection-mode app bar (replacing normal app bar) when `_inSelectionMode`:
   ```dart
   if (_inSelectionMode)
     AppBar(
       leading: IconButton(icon: Icon(Icons.close), onPressed: () => setState(() => _selectedIds.clear())),
       title: Text('${_selectedIds.length} selected'),
       actions: [
         IconButton(icon: Icon(Icons.star_outline), onPressed: _bulkStar),
         IconButton(icon: Icon(Icons.forward), onPressed: _bulkForward),
         IconButton(icon: Icon(Icons.delete_outline), onPressed: _bulkDelete),
       ],
     )
   else
     _buildHeader(...)
   ```

6. Implement bulk actions:
   - `_bulkStar`: for each selected id, call `starMessage`/`unstarMessage` (star if not already starred).
   - `_bulkForward`: open `ForwardPickerSheet` but pass `messageIds: List<String>` — requires backend multi-forward support (see below).
   - `_bulkDelete`: confirm dialog → `deleteMessage` for each selected id (`forEveryone` only if all are own).

#### Backend — bulk forward (optional for P0, required for the multi-select forward UX)

Add `messageIds: string[]` support to `memberForwardMessageHandler`. If present, forward each id in sequence (or a batch INSERT in one query). Return `{ count }`. Backward compatible — existing `messageId` single param still works.

```typescript
// In memberForwardMessageHandler:
const ids: string[] = body.messageIds ?? (body.messageId ? [body.messageId] : []);
// INSERT for each id…
```

#### Files touched
- `chat_group_screen.dart` — selection state, modified build, `_buildHeader` gating, 3 bulk action methods
- `_MessageBubble` — `isSelected`, `onSelect` params, visual overlay
- `controller.ts` — extend `memberForwardMessageHandler` for `messageIds[]`

---

### F-06 · Link Preview

**Current:** URLs in messages are plain unstyled text. No preview card.  
**Target:** When a message body contains a URL, show a card below the text with: favicon, site name, page title, description (max 2 lines), thumbnail. Tapping opens the URL in external browser. Same as WhatsApp.

#### Backend — new endpoint + DB column

1. Add column to `chat_group_messages` in `prisma.ts` startup:
   ```sql
   ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS link_preview JSONB;
   ```
   Shape: `{ url, title, description, imageUrl, siteName } | null`.

2. In `memberSendMessageHandler`: after storing the message, if `body` contains a URL, call an async `fetchLinkPreview(url)` (fire-and-forget using `setImmediate`) and `UPDATE chat_group_messages SET link_preview = $1 WHERE id = $2` then emit `group:message:edited` with the updated payload.

3. `fetchLinkPreview(url)` — simple helper using Node `fetch` + HTML parsing:
   - GET the URL (2s timeout, no-follow past 3 redirects).
   - Parse `<meta og:title>`, `<meta og:description>`, `<meta og:image>`, `<meta og:site_name>` (fallback to `<title>` tag).
   - Strip script/style tags from response before parsing (use regex on the first 32 KB only).
   - Returns `null` on any error (timeouts, non-HTML, too large).

4. Expose `linkPreview` in `messageJson()`:
   ```typescript
   linkPreview: m.deleted_for_everyone ? null : (m as any).link_preview ?? null,
   ```

#### Flutter — `chat_group_models.dart`

Add `linkPreview` to `ChatGroupMessage`:
```dart
final ChatGroupLinkPreview? linkPreview;

// New model:
class ChatGroupLinkPreview {
  final String url;
  final String? title;
  final String? description;
  final String? imageUrl;
  final String? siteName;
  ...fromJson
}
```

#### Flutter — `chat_group_screen.dart` + `_BodyText`

After `_BodyText`, add `_LinkPreviewCard` when `message.linkPreview != null`:
```dart
if (message.linkPreview != null && !message.isDeleted)
  _LinkPreviewCard(preview: message.linkPreview!, tokens: tokens),
```

`_LinkPreviewCard` widget:
```
┌────────────────────────────────────────┐
│ [thumbnail 72x72]  Site Name           │
│                    Title               │
│                    Description text…   │
│ ── url.com ──────────────────────────  │
└────────────────────────────────────────┘
```
Tap: `launchUrl(Uri.parse(preview.url), mode: LaunchMode.externalApplication)`.

Also make URLs in `_BodyText` tappable: replace plain `TextSpan` with `TapGestureRecognizer` for `http://` / `https://` substrings.

#### DB change
`chat_group_messages.link_preview JSONB` — startup ALTER.

#### Files touched
- `prisma.ts` — startup ALTER TABLE
- `controller.ts` — `memberSendMessageHandler`, new `fetchLinkPreview`, `messageJson`
- `chat_group_models.dart` — `ChatGroupLinkPreview`, `ChatGroupMessage.linkPreview`
- `chat_group_screen.dart` — `_LinkPreviewCard`, `_BodyText` URL tap handling

---

### F-07 · Message Info Sheet (Who Read / Delivered)

**Current:** Own messages show blue ticks when all members have read. No detail view.  
**Target:** Long-press own message → "Info" option in action sheet → bottom sheet showing: Read by (list of avatars + names + time), Delivered to (not yet read).

#### Backend — new endpoint

```typescript
// GET /api/chat-groups/:id/messages/:messageId/info
export async function memberMessageInfoHandler(req, reply) {
  const { id: groupId, messageId } = req.params as { id: string; messageId: string };
  const isMember = await requireMemberOfGroup(req, groupId);
  if (!isMember) return fail(reply, 403, 'FORBIDDEN', 'Not a member.');

  // Verify the caller is the sender
  const [msg] = await req.server.prisma.$queryRawUnsafe<Array<{ sender_member_id: string }>>(
    `SELECT sender_member_id FROM chat_group_messages WHERE id = $1::uuid AND group_id = $2::uuid`,
    messageId, groupId,
  );
  if (!msg || msg.sender_member_id !== (req as any).memberId) {
    return fail(reply, 403, 'FORBIDDEN', 'Only the sender can view message info.');
  }

  // All group members except caller
  const members = await req.server.prisma.$queryRawUnsafe<
    Array<{ id: string; first_name: string | null; last_name: string | null; profile_photo_url: string | null }>
  >(
    `SELECT m.id, m.first_name, m.last_name, m.profile_photo_url
     FROM chat_group_members cgm
     JOIN members m ON m.id = cgm.member_id
     WHERE cgm.group_id = $1::uuid AND cgm.member_id != $2::uuid AND cgm.left_at IS NULL`,
    groupId, (req as any).memberId,
  );

  const reads = await req.server.prisma.$queryRawUnsafe<
    Array<{ member_id: string; read_at: Date }>
  >(
    `SELECT member_id, read_at FROM chat_group_message_reads WHERE message_id = $1::uuid`,
    messageId,
  );
  const readMap = new Map(reads.map(r => [r.member_id, r.read_at]));

  const readBy = members.filter(m => readMap.has(m.id)).map(m => ({
    id: m.id,
    name: [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Member',
    profilePhotoUrl: m.profile_photo_url,
    readAt: readMap.get(m.id),
  }));
  const deliveredTo = members.filter(m => !readMap.has(m.id)).map(m => ({
    id: m.id,
    name: [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Member',
    profilePhotoUrl: m.profile_photo_url,
  }));

  return ok(reply, { readBy, deliveredTo });
}
```

Register in `routes.ts`:
```typescript
userScope.get('/:id/messages/:messageId/info', memberMessageInfoHandler);
```

Note: `chat_group_message_reads.read_at` column may not exist — add in startup:
```sql
ALTER TABLE chat_group_message_reads ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NOW();
```

#### Flutter — `chat_groups_service.dart`

```dart
Future<({List<dynamic> readBy, List<dynamic> deliveredTo})> getMessageInfo(
    String groupId, String messageId) async {
  final res = await _dio.get<Map<String, dynamic>>(
    '/api/chat-groups/$groupId/messages/$messageId/info',
  );
  final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
  return (
    readBy: (data['readBy'] as List<dynamic>?) ?? const [],
    deliveredTo: (data['deliveredTo'] as List<dynamic>?) ?? const [],
  );
}
```

#### Flutter — `chat_group_screen.dart`

In `_openActionSheet`, add "Info" option (only when `isMine && !message.isDeleted`):
```dart
if (isMine && !message.isDeleted)
  ListTile(
    leading: const Icon(Icons.info_outline_rounded),
    title: const Text('Info'),
    onTap: () { Navigator.pop(bs); _openMessageInfo(message.id); },
  ),
```

`_openMessageInfo(String messageId)` fetches and shows a `_MessageInfoSheet` bottom sheet with two sections: **Read by** and **Delivered to**, each with avatar + name + optional timestamp.

#### DB change
`chat_group_message_reads.read_at TIMESTAMPTZ DEFAULT NOW()` — startup ALTER.

#### Files touched
- `prisma.ts` — startup ALTER TABLE (read_at column)
- `controller.ts` — `memberMessageInfoHandler`
- `routes.ts` — new GET route
- `chat_groups_service.dart` — `getMessageInfo`
- `chat_group_screen.dart` — "Info" action + `_MessageInfoSheet` widget

---

### F-08 · Camera Capture Button

**Current:** Attach button opens file picker (existing files only).  
**Target:** Two separate buttons: 📷 camera (capture photo/video) and 📎 file picker. Matches WhatsApp composer.

#### Flutter — `chat_group_screen.dart` + pubspec dependency

Add `image_picker` to `pubspec.yaml` (likely already present — check first).

Replace single `IconButton(icon: Icon(Icons.attach_file_rounded))` with two buttons:

```dart
// Camera
IconButton(
  icon: const Icon(Icons.camera_alt_rounded),
  color: tokens.textMuted,
  onPressed: _pendingMediaFile != null ? null : _pickFromCamera,
),
// File/gallery
IconButton(
  icon: const Icon(Icons.attach_file_rounded),
  color: tokens.textMuted,
  onPressed: _pendingMediaFile != null ? null : _pickMedia,
),
```

`_pickFromCamera`:
```dart
Future<void> _pickFromCamera() async {
  try {
    final picker = ImagePicker();
    final choice = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (bs) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(leading: Icon(Icons.photo_camera), title: Text('Take photo'),
              onTap: () => Navigator.pop(bs, ImageSource.camera)),
            ListTile(leading: Icon(Icons.videocam), title: Text('Record video'),
              onTap: () => Navigator.pop(bs, ImageSource.camera)),
          ],
        ),
      ),
    );
    if (choice == null) return;
    final xfile = await picker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (xfile == null) return;
    final file = File(xfile.path);
    // Reuse existing upload flow
    setState(() { _pendingMediaFile = file; _pendingUploading = true; });
    final uploaded = await ref.read(chatGroupsServiceProvider).uploadMedia(file);
    if (!mounted) return;
    setState(() {
      _pendingUploading = false;
      _pendingMediaUrl = uploaded?.publicUrl;
      _pendingMediaType = uploaded?.mediaType;
    });
  } catch (_) { setState(() => _pendingUploading = false); }
}
```

#### Files touched
- `pubspec.yaml` — add `image_picker` if missing
- `chat_group_screen.dart` — two-button composer row, `_pickFromCamera`
- `AndroidManifest.xml` / `Info.plist` — camera + mic permissions (verify they're already set for voice recording; camera permission may need to be added)

---

## P1 — High Value

---

### F-09 · Voice Note Playback Speed (1× / 1.5× / 2×)

**Current:** `_AudioBubble` plays at fixed 1× speed.  
**Target:** Tap a speed label next to the play button to cycle 1× → 1.5× → 2×.

#### Flutter — `chat_group_screen.dart` (`_AudioBubbleState`)

1. Add `double _speed = 1.0` to `_AudioBubbleState`.
2. After `_player.setUrl(...)` succeeds, also call `await _player.setSpeed(_speed)`.
3. Add `GestureDetector` around a `Text('${_speed}×')` label:
   ```dart
   GestureDetector(
     onTap: () async {
       final next = _speed == 1.0 ? 1.5 : (_speed == 1.5 ? 2.0 : 1.0);
       setState(() => _speed = next);
       if (_initialised) await _player.setSpeed(next);
     },
     child: Container(
       padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
       decoration: BoxDecoration(
         color: tokens.bgInput, borderRadius: BorderRadius.circular(4),
         border: Border.all(color: tokens.borderCard),
       ),
       child: Text('${_speed}×', style: TextStyle(color: tokens.textPrimary, fontSize: 10, fontWeight: FontWeight.w700)),
     ),
   ),
   ```
4. Place the speed label between the waveform and the timer in `_AudioBubble.build`.

#### Files touched
- `chat_group_screen.dart` — `_AudioBubbleState` + `_AudioBubble.build`

---

### F-10 · Real Voice Waveform Amplitude

**Current:** `_Waveform` is a static sine-wave placeholder (24 bars, hardcoded pattern). Code comment: "Actual per-file amplitude analysis is P2."  
**Target:** Compute amplitude data from the actual audio file and render it as the waveform.

#### Flutter — new utility + `_Waveform` upgrade

1. **On record complete** (before showing preview in F-02): compute amplitude from the `.m4a` file using the `record` package's amplitude stream:
   ```dart
   // During recording, sample amplitude every 100ms and store:
   final List<double> _amplitudeSamples = [];
   // In _startRecording: add amplitude listener
   _recordingTicker = Timer.periodic(const Duration(milliseconds: 100), (_) async {
     final amp = await _recorder.getAmplitude();
     _amplitudeSamples.add(amp.current.clamp(-60.0, 0.0)); // dBFS
   });
   ```
2. Normalize `_amplitudeSamples` to 0..1 range, downsample to 24 bars: `samples[i * samples.length ~/ 24]`.
3. Pass `List<double> amplitudes` to `_Waveform` (or `_VoicePreviewBar`).
4. For **received voice notes** (playback in `_AudioBubble`): amplitude data isn't available from a remote URL without decoding. Solution: store amplitude data in `link_preview`-style JSON column on the message (too complex for now). **Acceptable fallback:** keep the sine-wave for received messages; show real waveform only for recording preview (F-02). Mark received messages for P2.

#### `_Waveform` widget changes
Add `final List<double>? amplitudes` param. When non-null: use `amplitudes[i]` for bar height instead of sine formula.

#### DB changes
None for P1. Storing amplitude data for received messages is P2 (requires encoding during upload + storing in message metadata).

#### Files touched
- `chat_group_screen.dart` — `_startRecording` (amplitude tap), `_stopRecording` (pass to preview), `_Waveform` (amplitudes param)

---

### F-11 · Full Emoji Picker for Reactions

**Current:** 6 hardcoded emoji in the action sheet reaction row (👍❤️😂😮😢🙏).  
**Target:** A "+" button after the 6 fixed emoji opens a full emoji keyboard. Selected emoji is added as a reaction. Matches WhatsApp.

#### Flutter — new dependency + widget

Add `emoji_picker_flutter` to `pubspec.yaml`.

In `_openActionSheet`, add a 7th entry after the 6 emoji:
```dart
GestureDetector(
  onTap: () {
    Navigator.pop(bs);
    _openEmojiReactPicker(message.id);
  },
  child: Container(
    width: 36, height: 36,
    decoration: BoxDecoration(color: tokens.bgInput, shape: BoxShape.circle),
    alignment: Alignment.center,
    child: Text('+', style: TextStyle(color: tokens.textMuted, fontSize: 20)),
  ),
),
```

`_openEmojiReactPicker(String messageId)`:
```dart
showModalBottomSheet(
  context: context,
  isScrollControlled: true,
  builder: (_) => SizedBox(
    height: 320,
    child: EmojiPicker(
      onEmojiSelected: (_, e) {
        Navigator.pop(context);
        _toggleReaction(messageId, e.emoji);
      },
      config: Config(bgColor: tokens.bgSurface, ...),
    ),
  ),
);
```

#### Files touched
- `pubspec.yaml` — `emoji_picker_flutter`
- `chat_group_screen.dart` — `_openActionSheet` reaction row + `_openEmojiReactPicker`

---

### F-12 · Emoji Keyboard Button in Composer

**Current:** Composer has attach + text field + mic/send. No emoji entry point.  
**Target:** 😊 icon left of text field. Tapping it toggles an emoji picker panel (same height as keyboard) instead of the system keyboard. Matches WhatsApp behavior.

#### Flutter — `chat_group_screen.dart`

1. Add `bool _showEmojiKeyboard = false` state.
2. Add 😊 `IconButton` to composer row (between attach and text field).
3. On tap: if keyboard is open, `_composerFocus.unfocus()` first. Toggle `_showEmojiKeyboard`.
4. Below composer, conditionally show:
   ```dart
   if (_showEmojiKeyboard)
     SizedBox(
       height: 280,
       child: EmojiPicker(
         textEditingController: _composerCtl,
         onBackspacePressed: () {
           _composerCtl.text = _composerCtl.text.isEmpty
               ? '' : _composerCtl.text.substring(0, _composerCtl.text.length - 1);
         },
       ),
     ),
   ```
5. When text field is tapped/focused: set `_showEmojiKeyboard = false`.

#### Files touched
- `chat_group_screen.dart` — composer widget, `_showEmojiKeyboard` state

---

### F-13 · Unread Message Separator

**Current:** No visual separator between read and unread messages when entering a group with unread messages.  
**Target:** A "N unread messages" divider appears in the list at the boundary between previously-read and new messages. Tapping it scrolls to the first unread message.

#### Flutter — `chat_group_providers.dart` + `chat_group_screen.dart`

1. Backend already returns `unreadCount` on each `ChatGroup` in the list. The `ChatGroup` model has `unreadCount`.

2. When `chatGroupMessagesNotifierProvider` loads: capture the unread boundary. The messages are newest-first in the list. The `unreadCount` from the group list tells us how many tail messages are "unread".

3. Add `int? _unreadFromIndex` to `_ChatGroupScreenState`. Set it once on first data:
   ```dart
   // In the data callback or initState post-frame:
   final group = ref.read(myChatGroupsProvider).valueOrNull
       ?.firstWhere((g) => g.id == widget.groupId, orElse: ...);
   final unread = group?.unreadCount ?? 0;
   // In the list: messages are [newest ... oldest]. 
   // Unread = the last `unread` messages.
   // With reverse:true, index (unread - 1) is the oldest unread,
   // index unread is the newest read.
   // Show the divider at position `unread` in the rendered list.
   _unreadFromIndex = unread > 0 ? unread : null;
   ```

4. In `itemBuilder`, at index `_unreadFromIndex` (after showing that message):
   ```dart
   if (_unreadFromIndex != null && i == _unreadFromIndex)
     _UnreadDivider(count: _unreadFromIndex!),
   ```
   Clear `_unreadFromIndex` after the user scrolls to bottom or 5s after entering (whichever comes first).

5. `_UnreadDivider`:
   ```
   ────── 3 unread messages ──────
   ```
   Simple `Row` with `Expanded(child: Divider())` + centered text + `Expanded(child: Divider())`.

#### Files touched
- `chat_group_screen.dart` — `_unreadFromIndex` state, `itemBuilder`, `_UnreadDivider` widget

---

### F-14 · Image Preview Before Send

**Current:** Selecting an image immediately starts uploading in the background. User sees only filename in `_PendingMediaTile`. No way to add a caption before the background upload starts.  
**Target:** After picking an image/video from gallery or camera, open a full-screen preview with the image centered, a caption text field at the bottom, and Send / ✗ Cancel buttons. Upload happens when Send is tapped.

#### Flutter — new screen `chat_group_media_preview.dart`

Create a new screen (push as modal route from `_pickMedia` / `_pickFromCamera`):

```dart
class ChatGroupMediaPreviewScreen extends StatefulWidget {
  final File file;
  final String mediaType; // 'image' | 'video'
  const ChatGroupMediaPreviewScreen({required this.file, required this.mediaType, super.key});
}
```

Layout:
```
┌────────────────────────┐
│  ✗          [Preview]  │
│                        │
│   [Image/Video fill]   │
│                        │
│  ┌──────────────────┐  │
│  │ Add a caption…   │  │
│  └──────────────────┘  │
│  [        SEND       ] │
└────────────────────────┘
```

Returns `({String caption, File file, String mediaType})?` when Send is tapped.

#### Modify `_pickMedia` and `_pickFromCamera`:
After picking file, instead of uploading immediately:
```dart
final result = await Navigator.push<({String caption, File file, String mediaType})>(
  context,
  MaterialPageRoute(fullscreenDialog: true,
    builder: (_) => ChatGroupMediaPreviewScreen(file: file, mediaType: guessedType)),
);
if (result == null) return; // cancelled
setState(() { _pendingMediaFile = result.file; _pendingUploading = true; _pendingCaption = result.caption; });
final uploaded = await ref.read(chatGroupsServiceProvider).uploadMedia(result.file);
// then set caption as the composer text
if (_pendingCaption.isNotEmpty) _composerCtl.text = _pendingCaption;
```

For documents (non-image/video): skip the preview screen, upload directly as before.

#### Files touched
- New: `chat_group_media_preview.dart`
- `chat_group_screen.dart` — `_pickMedia`, `_pickFromCamera`

---

### F-15 · Media Gallery in Group Info

**Current:** Group info sheet shows members list + leave button only.  
**Target:** Add a "Media, Links & Docs" section above the members list showing a 3-column image thumbnail grid (tap → fullscreen). A "See all" button opens a `ChatGroupMediaGalleryScreen`.

#### Backend — new endpoint

```typescript
// GET /api/chat-groups/:id/media?type=image|video|document&limit=20&before=<cursor>
export async function memberListGroupMediaHandler(req, reply) {
  const { id: groupId } = req.params as { id: string };
  const { type = 'image', limit = 20, before } = req.query as any;
  const isMember = await requireMemberOfGroup(req, groupId);
  if (!isMember) return fail(reply, 403, 'FORBIDDEN', 'Not a member.');

  const rows = await req.server.prisma.$queryRawUnsafe<
    Array<{ id: string; media_url: string; media_type: string; created_at: Date; sender_member_id: string | null }>
  >(
    `SELECT id, media_url, media_type, created_at, sender_member_id
     FROM chat_group_messages
     WHERE group_id = $1::uuid AND media_type = $2
       AND deleted_at IS NULL AND deleted_for_everyone = FALSE
       ${before ? 'AND created_at < $4::timestamptz' : ''}
     ORDER BY created_at DESC
     LIMIT $3`,
    groupId, type, limit, ...(before ? [before] : []),
  );

  return ok(reply, rows.map(r => ({
    id: r.id, mediaUrl: r.media_url, mediaType: r.media_type, createdAt: r.created_at,
  })));
}
```

Register: `userScope.get('/:id/media', memberListGroupMediaHandler)`.

#### Flutter — `chat_group_info_sheet.dart`

Add a media preview grid section before the members header:
```dart
// Show up to 6 thumbnails in a 3-column grid
FutureBuilder(
  future: ref.read(chatGroupsServiceProvider).listGroupMedia(detail.id, type: 'image', limit: 6),
  builder: (_, snap) {
    if (!snap.hasData || snap.data!.isEmpty) return const SizedBox.shrink();
    return Column(
      children: [
        _SectionHeader('MEDIA', trailing: TextButton(onPressed: _openGallery, child: Text('See all'))),
        GridView.count(shrinkWrap: true, crossAxisCount: 3, mainAxisSpacing: 2, crossAxisSpacing: 2,
          children: snap.data!.take(6).map((m) => GestureDetector(
            onTap: () => FullscreenImageViewer.open(context, urls: [m.mediaUrl], initialIndex: 0),
            child: CachedNetworkImage(imageUrl: m.mediaUrl, fit: BoxFit.cover),
          )).toList(),
        ),
      ],
    );
  },
),
```

#### Files touched
- `controller.ts` — `memberListGroupMediaHandler`
- `routes.ts` — GET `/:id/media`
- `chat_groups_service.dart` — `listGroupMedia`
- `chat_group_info_sheet.dart` — media grid section

---

### F-16 · Forward to DMs (Conversations)

**Current:** `ForwardPickerSheet` only lists the caller's chat groups.  
**Target:** Show two tabs: "Groups" and "Contacts" (DMs). Contacts are fetched from `/api/messages` conversation list. Forwarding to a DM sends via `POST /api/messages` (existing DM endpoint).

#### Flutter — `forward_picker_sheet.dart`

1. Add a `TabBar` with "Groups" | "Contacts" at the top.
2. "Contacts" tab: fetch user's DM conversations (service call to existing messages endpoint) and list them similarly to the groups list.
3. On contact tap: call `conversationsService.sendMessage(conversationId, body: messageBody)` for text forward, or `sendMessage(conversationId, mediaUrl: ..., mediaType: ...)` for media.

#### Files touched
- `forward_picker_sheet.dart` — tab layout + DM forward
- `chat_groups_service.dart` — no change needed (use existing messages service)

---

## P2 — Nice-to-Have

---

### F-17 · Lock-to-Record Voice Notes

**Current:** Voice recording requires holding the mic button. Releasing cancels or sends (after F-02: shows preview).  
**Target:** Swiping up while holding locks the recording (shows lock icon, no longer need to hold). Tap stop to end.

#### Flutter — `chat_group_screen.dart` / `_SendOrMicButton`

1. In `_SendOrMicButtonState`: track `_dy` (vertical offset) alongside existing `_dx`.
2. `onLongPressMoveUpdate`: if `d.offsetFromOrigin.dy < -80` (swipe up by 80px), set `_locked = true`.
3. When locked: show lock icon overlay; `onLongPressEnd` does NOT stop recording.
4. Add a separate "stop" tap target (red square icon) that appears when locked.
5. `onLongPressStart` retains existing behavior. Only the "end" behavior changes when locked.

---

### F-18 · Disappearing Messages

**Target:** Group admin (or any member — configurable) enables disappearing messages (24h / 7d / 90d). Messages older than the period are automatically deleted.

#### Backend — DB + cron

1. Add column: `ALTER TABLE chat_groups ADD COLUMN IF NOT EXISTS disappearing_duration_seconds INT` (startup ALTER).
2. Admin endpoint: `PATCH /api/chat-groups/admin/:id/disappearing` → sets `disappearing_duration_seconds` (null = off).
3. Cron: a BullMQ repeatable job runs hourly, `DELETE FROM chat_group_messages WHERE group_id IN (SELECT id FROM chat_groups WHERE disappearing_duration_seconds IS NOT NULL) AND created_at < NOW() - (disappearing_duration_seconds || ' seconds')::interval`.
4. Emit `group:message:deleted` via socket for affected messages.

#### Flutter
- Show "Disappearing messages" option in group info (for admins).
- Show banner in chat header when enabled: "Disappearing messages: 7d".
- Model change: add `disappearingDurationSeconds: int?` to `ChatGroupDetail`.

---

### F-19 · Document Thumbnail Preview

**Current:** Documents show file icon + filename + "open in new" icon.  
**Target:** PDF files show a cover page thumbnail. Other docs show extension badge (DOCX, XLSX etc.) in a color-coded chip.

#### Flutter — `_MediaContent` (in `chat_group_screen.dart`)

For `type == 'document'`:
- Parse extension from URL: `url.split('.').last.toUpperCase()`.
- Show colored extension badge: PDF = red, DOCX = blue, XLSX = green, etc.
- For PDFs: use `flutter_pdfview` or `syncfusion_flutter_pdfviewer` to render page 1 thumbnail. Load lazily on first render only.

---

### F-20 · Group Voice / Video Call Button

**Target:** Add phone/video icons to the chat group header that open a LiveKit group call (same infrastructure as workshop live calls).

#### Scope note
This requires significant LiveKit integration for group calls — session creation, token generation, participant tracking. Out of scope for a pure chat feature. Log as a separate initiative; track with LiveKit backend.

---

### F-21 · Location Sharing

**Target:** Share static current location as a map card. Tap to open in Maps app.

#### Flutter — `geolocator` + `url_launcher`

1. New attach option: "Location". Request `geolocator` permission, get `Position`, send a message with `body: 'https://maps.google.com/?q={lat},{lng}'` and `mediaType: 'location'`.
2. In `_MediaContent`: if `type == 'location'`, render a static map image card (`https://maps.googleapis.com/maps/api/staticmap?center={lat},{lng}&zoom=14&size=300x150&key=KEY`).

Requires `GOOGLE_MAPS_STATIC_API_KEY` env var. Only feasible if Maps API is already in use.

---

### F-22 · Contact Sharing

**Target:** Share a contact card (name + phone) as a vCard message. Low priority — TBT platform doesn't have a native contacts concept.

Implementation deferred. Would require a `vcard` `mediaType` and a contact-card renderer widget. Not recommended until contact directory is a platform feature.

---

## Summary Table

| ID | Feature | Tier | Backend? | Flutter files | Effort |
|---|---|---|---|---|---|
| F-01 | Swipe-to-reply | P0 | ✗ | chat_group_screen | S |
| F-02 | Voice note preview before send | P0 | ✗ | chat_group_screen | M |
| F-03 | Pin/Unpin from member UI | P0 | ✓ 2 routes | controller, routes, service, screen | S |
| F-04 | Scroll-to-bottom FAB + unread | P0 | ✗ | chat_group_screen | S |
| F-05 | Multi-select + bulk actions | P0 | ✓ extend forward | screen, controller | L |
| F-06 | Link preview | P0 | ✓ async scraper + DB col | models, screen, prisma, controller | L |
| F-07 | Message info sheet | P0 | ✓ 1 route + DB col | controller, routes, service, screen | M |
| F-08 | Camera capture button | P0 | ✗ | screen, pubspec | S |
| F-09 | Voice note playback speed | P1 | ✗ | chat_group_screen | XS |
| F-10 | Real voice waveform | P1 | ✗ | chat_group_screen | M |
| F-11 | Full emoji picker (reactions) | P1 | ✗ | screen, pubspec | S |
| F-12 | Emoji keyboard in composer | P1 | ✗ | screen | S |
| F-13 | Unread message separator | P1 | ✗ | screen | S |
| F-14 | Image preview before send | P1 | ✗ | screen, new file | M |
| F-15 | Media gallery in group info | P1 | ✓ 1 route | controller, routes, service, info_sheet | M |
| F-16 | Forward to DMs | P1 | ✗ | forward_picker_sheet | M |
| F-17 | Lock-to-record | P2 | ✗ | chat_group_screen | S |
| F-18 | Disappearing messages | P2 | ✓ cron + DB col | controller, models, info_sheet | L |
| F-19 | Document thumbnail | P2 | ✗ | chat_group_screen | S |
| F-20 | Group voice/video call | P2 | ✓ LiveKit | separate initiative | XL |
| F-21 | Location sharing | P2 | ✗ | screen | M |
| F-22 | Contact sharing | P2 | ✗ | screen | defer |

**Effort key:** XS < 1h · S 1–3h · M 3–8h · L 8–16h · XL > 16h

---

## New Dependencies (pubspec.yaml)

| Package | Used by |
|---|---|
| `emoji_picker_flutter` | F-11, F-12 |
| `image_picker` | F-08 (likely already present — check) |

All other features use existing packages (`just_audio`, `record`, `scrollable_positioned_list`, `cached_network_image`, `file_picker`, `url_launcher`, `geolocator` for F-21).

---

## New Backend Routes Summary

| Method | Path | Auth | Feature |
|---|---|---|---|
| `POST` | `/api/chat-groups/:id/messages/:messageId/pin` | JWT | F-03 |
| `DELETE` | `/api/chat-groups/:id/messages/:messageId/pin` | JWT | F-03 |
| `GET` | `/api/chat-groups/:id/messages/:messageId/info` | JWT | F-07 |
| `GET` | `/api/chat-groups/:id/media` | JWT | F-15 |
| `PATCH` | `/api/chat-groups/admin/:id/disappearing` | Clerk | F-18 |

---

## DB Changes Summary

| Table | Change | Feature |
|---|---|---|
| `chat_group_messages` | `ADD COLUMN IF NOT EXISTS link_preview JSONB` | F-06 |
| `chat_group_message_reads` | `ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NOW()` | F-07 |
| `chat_groups` | `ADD COLUMN IF NOT EXISTS disappearing_duration_seconds INT` | F-18 |

All via startup `$executeRawUnsafe` in `backend/src/plugins/prisma.ts` — idempotent.

---

## Implementation Order (Recommended)

**Sprint 1 (P0 quick wins — F-01, F-04, F-08):** All Flutter-only, no backend. 3 features, ~1 day.

**Sprint 2 (P0 state features — F-02, F-03, F-07):** Voice preview + pin + message info. 1 day Flutter + 1 day backend.

**Sprint 3 (P0 complex — F-05, F-06):** Multi-select and link preview. Link preview requires backend scraper — isolate in a `lib/linkPreview.ts` helper with its own error boundary. 2–3 days.

**Sprint 4 (P1 — F-09 to F-14):** All six P1 features are Flutter-only except F-15. ~2 days.

**Sprint 5 (P1 backend — F-15, F-16):** Media gallery (1 backend route) + DM forward. 1 day.

**Sprint 6 (P2 — F-17, F-18, F-19, F-21):** Disappearing messages needs most care (cron job). Others are straightforward. ✅ Shipped.

# ONBOARDING_SPECKIT.md

Self-onboarding wizard improvement plan — 14 fixes across Flutter, Fastify backend, and Next.js admin panel.
Derived from the gap audit conducted on 2026-08-20.

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Not started |
| 🔄 | In progress |
| ✅ | Done |

---

## Sprint 1 — P0: Broken User Journeys (3 fixes)

### F-01 — Auto-redirect `awaiting_kyc` members to wizard ⬜

**Problem:** `SubscriptionGate` intercepts any `status === 'pending'` member and shows a dead-end "Awaiting Approval" screen (sign-out only). But `pending + awaiting_kyc` means the member has never submitted — they need to be in the wizard, not the approval-wait screen. Currently the user has to know to navigate to `/onboarding` manually.

**Files:** `tbt_app/lib/shared/widgets/subscription_gate.dart`

**Current behaviour:**
```dart
if (me.status == MemberStatus.pending) {
  return _PendingInterceptor(widgetRef: ref);
}
```
`_PendingInterceptor` shows title/body + a single "SIGN OUT" button.

**Target behaviour:**

Split the single pending intercept into two cases keyed on `verificationStatus`:

```
status == pending && verificationStatus == awaiting_kyc
  → show _KycIncompleteInterceptor  (CTA: "Complete Your Profile" → pushes /onboarding)

status == pending && verificationStatus != awaiting_kyc  (i.e. under_review / changes_requested)
  → keep existing _PendingInterceptor  (sign-out only — they've submitted, nothing to do)
```

**Implementation notes:**
- `me` is a `Member` (freezed model) — `me.verificationStatus` is already available.
- The `meNotifierProvider` response from `GET /api/user/me` includes `verificationStatus`.
- `_KycIncompleteInterceptor` should show: icon (📋), title "Complete Your Profile", body "Your account is pending. Fill in your business details to apply for membership.", and two buttons: "Complete Now" (`context.push(AppRoutes.onboarding)`) and "Sign Out" (secondary).
- Import `AppRoutes` — it is already imported in the file via `core/constants/routes.dart`.
- Do NOT touch `_FreeInterceptor` logic.

---

### F-02 — `verified` success screen ⬜

**Problem:** `onboarding_screen.dart` only intercepts `under_review` and `rejected`. The `verified` status falls through to `_OnboardingWizard` — approved members are shown the full 6-step wizard again as if they haven't submitted.

**File:** `tbt_app/lib/features/onboarding/presentation/onboarding_screen.dart`

**Current `OnboardingScreen.build`:**
```dart
if (state.verificationStatus == 'under_review') return const _PendingView();
if (state.verificationStatus == 'rejected') {
  return _RejectedView(note: state.onboardingReviewNote);
}
return _OnboardingWizard(state: state);
```

**Target:**
```dart
if (state.verificationStatus == 'under_review') return const _PendingView();
if (state.verificationStatus == 'verified' || state.onboardingCompleted)
  return const _VerifiedView();
if (state.verificationStatus == 'rejected') {
  return _RejectedView(note: state.onboardingReviewNote);
}
return _OnboardingWizard(state: state);
```

**`_VerifiedView` spec:**
- Large green checkmark icon in a rounded box (`_kGreen` tint, matching `_iconBox` pattern)
- Heading: "You're Verified!" (`_kGreen`, 24sp, w800)
- Subtext: "Your TBT account is active. You can now access all platform features." (`_kMuted`, 15sp)
- Single CTA button: "Go to Dashboard" → `context.go(AppRoutes.home)` or equivalent root route
- No back button — this is a terminal happy-path state

---

### F-03 — Dynamic content step key binding ⬜

**Problem:** The wizard hard-codes exactly two step keys: `find('introduction')` for step 2 and `find('guided_instructions')` for step 5. Any content step the admin creates with a different key is silently ignored. The admin content management system is partially useless.

**File:** `tbt_app/lib/features/onboarding/presentation/onboarding_screen.dart`

**Current step structure (fixed 6 steps):**
```
0: _WelcomeStep
1: _ContentStep(find('introduction'))
2: _ProfileStep
3: _DocumentsStep
4: _ContentStep(find('guided_instructions'))
5: _ReviewStep
```

**Target step structure (dynamic):**

Content steps come from the `onboardingContentProvider` list sorted by `sortOrder`. Build the page list dynamically:

```dart
// Inside _OnboardingWizardState.build():
final activeContent = content.where((c) => c.isActive ?? true).toList()
  ..sort((a, b) => (a.sortOrder ?? 0).compareTo(b.sortOrder ?? 0));
// isActive field is not currently on OnboardingContentStep — add it (see §A below)

// Build page list:
final pages = <Widget>[
  _WelcomeStep(),
  // Insert all admin content steps before Profile
  ...activeContent
      .where((c) => c.stepPosition == 'before_profile')
      .map((c) => _ContentStep(content: c, stepLabel: c.stepLabel ?? c.stepKey)),
  _ProfileStep(...),
  _DocumentsStep(...),
  // Insert all admin content steps after Documents
  ...activeContent
      .where((c) => c.stepPosition != 'before_profile')
      .map((c) => _ContentStep(content: c, stepLabel: c.stepLabel ?? c.stepKey)),
  _ReviewStep(...),
];
```

**Simpler approach (avoids new backend field):**
Keep the two slots but allow admin to set any stepKey, not just the two hardcoded values. The wizard always has exactly two content step slots; the keys are configurable constants:

```dart
// Replace hardcoded keys with constants admin can target:
const _kStepKeyEducation = 'introduction';     // slot 1 — before profile
const _kStepKeyGuided   = 'guided_instructions'; // slot 2 — after documents
```
This is already the current behaviour. The real fix is to **document the two reserved keys** in the admin panel UI as helper text, so admins know what step keys to use.

**Recommended approach — minimal, no new backend columns:**
- Add a hint under the "Step Key" input in the admin panel content form: `Tip: use step key "introduction" to inject content before the profile step, or "guided_instructions" to inject content after the document upload step.`
- Add `isActive` to `OnboardingContentStep.fromJson` (field already returned by the backend's `getOnboardingContentHandler` query; just not deserialized in Flutter):
  ```dart
  final bool? isActive;
  // fromJson:
  isActive: json['isActive'] as bool?,
  ```
- Filter: `content.where((c) => c.isActive != false)` before the `find()` lookups.
- This way an admin can deactivate a step without deleting it.

**§A — `OnboardingContentStep` model changes:**

File: `tbt_app/lib/features/onboarding/domain/onboarding_state.dart`

Add `isActive` field:
```dart
class OnboardingContentStep {
  const OnboardingContentStep({
    // ... existing fields ...
    this.isActive,
  });
  // ... existing fields ...
  final bool? isActive;

  factory OnboardingContentStep.fromJson(Map<String, dynamic> json) =>
      OnboardingContentStep(
        // ... existing ...
        isActive: json['isActive'] as bool?,
      );
}
```

The backend already returns `is_active AS "isActive"` via `CONTENT_COLS` in `controller.ts`. No backend changes needed.

---

## Sprint 2 — P1: Missing UX (4 fixes)

### F-04 — Document delete button ⬜

**Problem:** `onboarding_repository.dart` has `deleteDocument(id)` and the backend has `DELETE /api/onboarding/documents/:id`, but `_DocumentsStep` has no delete/remove UI. Users who upload the wrong file are stuck.

**File:** `tbt_app/lib/features/onboarding/presentation/onboarding_screen.dart`

**Current document card (line ~885–908):**
```dart
Row(children: [
  Icon(Icons.insert_drive_file_outlined, ...),
  Expanded(child: Text(d.documentType, ...)),
  // status badge only
])
```

**Target:**
- Add a delete `IconButton` at the trailing edge of each document card.
- Only show delete if `d.status != 'verified'` (verified documents cannot be deleted — backend enforces this too at line 135 of `controller.ts`).
- Delete is a mutating operation — lift the delete action up to `_OnboardingWizardState`.

**`_DocumentsStep` changes:**
```dart
// Add prop:
final Future<void> Function(String docId) onDelete;
final bool deleting;   // global "a delete is in flight" flag

// In document card:
if (d.status != 'verified')
  IconButton(
    icon: const Icon(Icons.delete_outline_rounded, color: _kMuted, size: 20),
    onPressed: deleting ? null : () => onDelete(d.id),
  ),
```

**`_OnboardingWizardState` changes:**
```dart
bool _deleting = false;

Future<void> _deleteDocument(String id) async {
  setState(() => _deleting = true);
  try {
    await ref.read(onboardingRepositoryProvider).deleteDocument(id);
    ref.invalidate(onboardingStateProvider);
  } catch (_) {
    if (mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not remove document.')));
  } finally {
    if (mounted) setState(() => _deleting = false);
  }
}
```

Pass `onDelete: _deleteDocument, deleting: _deleting` to `_DocumentsStep`.

---

### F-05 — Profile photo upload ⬜

**Problem:** `profilePhotoUrl` is in `PROFILE_SELECT` and `onboardingUpdateSchema` on the backend, but `_ProfileStep` has no avatar picker. Submitted profiles have no photo.

**Files:**
- `tbt_app/lib/features/onboarding/presentation/onboarding_screen.dart`
- `tbt_app/lib/features/onboarding/data/onboarding_repository.dart` (may need a presign method variant)

**Backend situation:**
- `PATCH /api/onboarding` accepts `profilePhotoUrl` as a string field (it's in `onboardingUpdateSchema`).
- `POST /api/onboarding/documents/presign` is for KYC documents (bucket `kyc-documents`). We need a presigned URL for the profile photo to a different bucket.
- Reuse `POST /api/upload/presigned-url` (the generic upload endpoint used across the admin panel) — but this endpoint requires a **Clerk** token (admin auth). Flutter users can't call it.

**Solution — add a member-facing photo presign endpoint:**

Backend: `POST /api/onboarding/photo/presign` (protected by `fastify.authenticateUser`)

```typescript
// controller.ts — new handler:
export async function presignProfilePhotoHandler(req, reply) {
  const memberId = req.memberId!;
  const member = await req.server.prisma.member.findUnique({
    where: { id: memberId }, select: { verificationStatus: true } as any });
  if (!member) return reply.status(404).send(...);
  if (!canEditOnboarding((member as any).verificationStatus))
    return reply.status(403).send(...);

  (req.body as any).bucket = 'profile-photos';
  (req.body as any).pathPrefix = `members/${memberId}`;
  return getPresignedUrlHandler(req, reply);
}
```

Route: `POST /api/onboarding/photo/presign` registered in `routes.ts` with `authenticateUser` preHandler. Body schema: same as `presignDocumentSchema` (just `{ filename, contentType }`).

**Flutter — `_ProfileStep` changes:**

Add an `onPhotoChanged: (String url) {}` callback prop. At the top of the form, add a circular avatar picker:

```dart
// Avatar row at top of _ProfileStep:
GestureDetector(
  onTap: onPickPhoto,
  child: Stack(
    children: [
      CircleAvatar(
        radius: 44,
        backgroundColor: _kSurface,
        backgroundImage: photoUrl != null ? NetworkImage(photoUrl!) : null,
        child: photoUrl == null
            ? Icon(Icons.person_outline_rounded, color: _kMuted, size: 38)
            : null,
      ),
      Positioned(
        bottom: 0, right: 0,
        child: Container(
          decoration: BoxDecoration(
            color: _kAccent, shape: BoxShape.circle),
          padding: const EdgeInsets.all(6),
          child: const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 14),
        ),
      ),
    ],
  ),
),
```

`_OnboardingWizardState._profile` already holds the profile map — photo upload sets `_profile['profilePhotoUrl'] = publicUrl` and is saved on the next `_saveAndNext()` call.

Add a `_pickProfilePhoto()` method to `_OnboardingWizardState` following the same pattern as `_pickAndUploadDocument()` but calling the new presign endpoint.

**Repository change — add `presignProfilePhoto()`:**
```dart
Future<PresignedUpload> presignProfilePhoto({
  required String filename,
  required String contentType,
}) async {
  final res = await _api.post('/onboarding/photo/presign', data: {
    'filename': filename,
    'contentType': contentType,
  });
  return PresignedUpload.fromJson(res.data['data']);
}
```

---

### F-06 — FCM push notification on approval ⬜

**Problem:** `approveMemberHandler` sends a real-time socket event and creates an in-app notification, but no Firebase Cloud Messaging push is sent. Members with the app backgrounded or closed never learn they've been approved.

**File:** `tbt-admin/backend/src/modules/members/controller.ts` (lines ~1492–1510)

**Existing approval flow (relevant lines):**
```typescript
request.server.io.to(`user:${id}`).emit('notification', { ... });
request.server.prisma.notification.create({ data: { ... } }).catch(() => {});
```

**Target — add FCM push after the existing socket emit:**
```typescript
// After socket emit + in-app notification create:
if (request.server.firebase) {
  const token = await request.server.prisma.member.findUnique({
    where: { id },
    select: { fcmToken: true } as any,
  });
  const fcmToken = (token as any)?.fcmToken;
  if (fcmToken) {
    void request.server.firebase.messaging().send({
      token: fcmToken,
      notification: {
        title: 'Account Approved 🎉',
        body: 'Your TBT membership is now active. Tap to get started.',
      },
      data: { type: 'member_approved' },
    }).catch(() => {});
  }
}
```

Check the existing FCM pattern used elsewhere in the codebase (e.g., app-notifications module) to confirm the exact API shape. `request.server.firebase` is the Firebase Admin SDK instance registered in the `firebase` plugin.

**Same pattern for `rejectMemberHandler` and `requestChangesMemberHandler`** — those emit socket events but also lack FCM push. Add equivalent FCM calls with appropriate titles/bodies:
- Rejected: "Application Not Approved — Please review the feedback and contact support."
- Changes requested: "Action Required — Your onboarding application needs updates."

---

### F-07 — Guard `onboardingCompleted` flag ⬜

**Problem:** `_OnboardingWizard` never reads `widget.state.onboardingCompleted`. If a member's `verificationStatus` is somehow reset to `awaiting_kyc` (admin manual override) while `onboardingCompleted === true`, they'd loop through the wizard. The `verified` check in F-02 covers the normal path, but the flag provides an explicit safety net.

**File:** `tbt_app/lib/features/onboarding/presentation/onboarding_screen.dart`

**Change:** Already handled by F-02's `_VerifiedView` check:
```dart
if (state.verificationStatus == 'verified' || state.onboardingCompleted)
  return const _VerifiedView();
```
The `|| state.onboardingCompleted` condition covers this case. **F-07 is satisfied by F-02 with no separate implementation needed.**

---

## Sprint 3 — P2: Admin Panel Gaps (3 fixes)

### F-08 — `sortOrder` input + reorder in admin content form ⬜

**Problem:** The admin ContentTab creates every step with `sortOrder: 0` (hardcoded in `EMPTY_FORM`). Admin cannot set the display order when creating a step, and there is no drag-to-reorder on the content list.

**File:** `tbt-admin/admin-panel/app/onboarding/page.tsx`

**Part A — Add `sortOrder` number input to the create form:**
```tsx
// In the grid below imageUrl/lottieUrl inputs:
<input
  type="number"
  placeholder="Sort order (0 = first)"
  value={form.sortOrder}
  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
  className={inputCls}
/>
```

**Part B — Add drag-to-reorder on the content list** using the existing DnD pattern from CLAUDE.md:

```typescript
const dragIdx = useRef<number | null>(null);
const [dragOver, setDragOver] = useState<number | null>(null);
const [localRows, setLocalRows] = useState<any[]>([]);
const [isDirty, setIsDirty] = useState(false);

useEffect(() => { setLocalRows(rows ?? []); setIsDirty(false); }, [data]);
```

Each row `<tr>` gets `draggable onDragStart onDragOver onDrop onDragLeave` handlers.

**Backend — add reorder endpoint:**
```typescript
// PUT /api/admin/onboarding/content/reorder  { ids: string[] }
export async function adminReorderOnboardingContentHandler(req, reply) {
  const { ids } = req.body as { ids: string[] };
  await Promise.all(
    ids.map((id, idx) =>
      req.server.prisma.$executeRawUnsafe(
        `UPDATE onboarding_content SET sort_order = $1, updated_at = NOW() WHERE id = $2::uuid`,
        idx, id,
      )
    )
  );
  return reply.send({ success: true, data: null, error: null });
}
```

Register in `routes.ts`: `PUT /admin/content/reorder` with `authenticate` preHandler.

Add TanStack Query hook in `useTbt.ts`:
```typescript
export const useReorderOnboardingContent = () =>
  useMutation({
    mutationFn: (ids: string[]) =>
      apiClient.put('/admin/onboarding/content/reorder', { ids }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-content-admin'] }),
  });
```

"Save Order" button visible only when `isDirty === true`.

---

### F-09 — Dedicated KYC review admin page ⬜

**Problem:** Reviewing submitted onboarding applications (approve, reject, request changes) only happens through the general `/members` edit modal. There is no dedicated "Pending Applications" queue showing submitted profiles, uploaded documents, and inline action buttons.

**New page:** `tbt-admin/admin-panel/app/kyc-review/page.tsx`

**Add to Sidebar** (in `admin-panel/components/layout/Sidebar.tsx`): "KYC Review" item linking to `/kyc-review`, icon `ClipboardCheck` or `ShieldCheck`. Position below "Members".

**Page structure:**
```
Header: "KYC Review" | filter tabs: [ All | Pending Review | Changes Requested ]
Table columns:
  Member Name | Phone | Submitted At | Documents | Actions
```

**Data source:** `GET /api/members?verificationStatus=under_review,changes_requested&page=1&limit=50` — this endpoint already supports `verificationStatus` as a filter (see `listMembersHandler` in controller.ts, line ~139–142). No new backend endpoint needed.

**Row expansion:** Click a row to expand an inline panel showing:
- Profile fields (name, business, city, state, GST, turnover) from the member detail
- Document list with thumbnail/link (fetch from `GET /api/members/:id` which returns full profile; documents are on `kycDocuments` relation)
- Inline action buttons: **Approve** | **Request Changes** (text input for note) | **Reject** (text input for reason)

**Hooks needed (add to `useTbt.ts`):**
```typescript
export const useKycPendingMembers = (params) =>
  useQuery({
    queryKey: ['kyc-pending', params],
    queryFn: () => apiClient.get('/members', { params: { verificationStatus: 'under_review,changes_requested', ...params } }),
  });
```

Reuse existing `useApproveMember()` from `useMembers.ts` for approve. The reject/request-changes hooks need to be added:

```typescript
// In useMembers.ts:
export const useRejectMember = () => useMutation({
  mutationFn: ({ id, reason }: { id: string; reason: string }) =>
    apiClient.post(`/members/${id}/reject`, { reason }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
});

export const useRequestMemberChanges = () => useMutation({
  mutationFn: ({ id, note }: { id: string; note: string }) =>
    apiClient.post(`/members/${id}/request-changes`, { note }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
});
```

Check whether `POST /api/members/:id/reject` and `POST /api/members/:id/request-changes` exist in the backend routes file. They are implemented in the controller (`rejectMemberHandler`, `requestChangesMemberHandler`) but may not be registered as routes yet — verify in `members/routes.ts`.

---

### F-10 — Quiz preview in admin content builder ⬜

**Problem:** Admin can build a MCQ quiz but cannot preview what it looks like to the member before publishing. Mistakes (wrong correct answer, missing explanation) are only caught by testing via the Flutter app.

**File:** `tbt-admin/admin-panel/app/onboarding/page.tsx`

**Add a "Preview" toggle button** next to the quiz builder collapse header:

```tsx
<button onClick={() => setShowQuizPreview(!showQuizPreview)}>
  {showQuizPreview ? 'Edit' : 'Preview'}
</button>
```

**Preview renders:**
```tsx
{showQuizPreview && quizQs.length > 0 && (
  <QuizPreview questions={quizQs} currentQ={previewQ} setCurrentQ={setPreviewQ} />
)}
```

**`QuizPreview` component (inline in page.tsx):**
- Shows one question at a time, matching the Flutter `_QuizWidget` layout as closely as possible in Tailwind.
- Four option buttons as outlined cards; clicking one marks it selected (green if correct, red if incorrect).
- "Check Answer" → reveal answer + explanation text below the options.
- "Next Question" → advances `previewQ` index.
- Question counter: "1 / 3"
- State is local to the preview (`useState` for selected, answered, etc.) — no mutation, pure display.
- Reset preview state when `previewQ` changes.

---

## Sprint 4 — P3: Polish (4 fixes)

### F-11 — Content step loading skeleton ⬜

**Problem:** `contentAsync.valueOrNull ?? const []` means a content step (`_ContentStep`) renders with `content: null` while the fetch is in flight. The step silently shows the fallback placeholder text instead of a skeleton. On slow connections the step looks broken for 1–2 seconds.

**File:** `tbt_app/lib/features/onboarding/presentation/onboarding_screen.dart`

**Change in `_OnboardingWizardState.build()`:**
```dart
final contentAsync = ref.watch(onboardingContentProvider);

// When loading, show skeleton shimmer on content-step pages:
if (contentAsync.isLoading && (_page == 1 || _page == 4)) {
  return const _ContentStepSkeleton();
}
final content = contentAsync.valueOrNull ?? const <OnboardingContentStep>[];
```

**`_ContentStepSkeleton`:**
```dart
class _ContentStepSkeleton extends StatelessWidget {
  const _ContentStepSkeleton();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _shimmer(height: 160, radius: 16),  // hero placeholder
          const SizedBox(height: 24),
          _shimmer(height: 20, width: 100),   // label chip
          const SizedBox(height: 16),
          _shimmer(height: 28, width: 240),   // title
          const SizedBox(height: 12),
          _shimmer(height: 14),
          _shimmer(height: 14),
          _shimmer(height: 14, width: 180),
        ],
      ),
    );
  }
}

Widget _shimmer({double? width, double height = 16, double radius = 8}) =>
    Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        width: width ?? double.infinity,
        height: height,
        decoration: BoxDecoration(
          color: _kSurface,
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
```

No dependency on `shimmer` package — use plain `_kSurface` blocks (matches existing design token).

---

### F-12 — Rejected view with action path ⬜

**Problem:** `_RejectedView` shows the admin's rejection note and nothing else. No path forward — no contact link, no WhatsApp button, no guidance.

**File:** `tbt_app/lib/features/onboarding/presentation/onboarding_screen.dart`

**Current `_RejectedView`:**
- Icon box (red X)
- "Not Approved" heading
- Note text or fallback message

**Add after note text:**
```dart
const SizedBox(height: 32),
// Contact support button
SizedBox(
  width: double.infinity,
  height: 48,
  child: OutlinedButton.icon(
    onPressed: () => launchUrl(Uri.parse('https://wa.me/<SUPPORT_NUMBER>')),
    icon: const Icon(Icons.chat_outlined, size: 18),
    label: const Text('Contact Support'),
    style: OutlinedButton.styleFrom(
      foregroundColor: _kText,
      side: const BorderSide(color: _kBorder),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ),
  ),
),
const SizedBox(height: 12),
// Sign out
TextButton(
  onPressed: () async {
    await ref.read(authNotifierProvider.notifier).logout();
    if (context.mounted) context.go(AppRoutes.login);
  },
  child: const Text('Sign out', style: TextStyle(color: _kMuted, fontSize: 14)),
),
```

`_RejectedView` needs to become a `ConsumerWidget` (or accept a `WidgetRef`) to call `authNotifierProvider`. Change constructor: `const _RejectedView({required this.note});` → class extends `ConsumerWidget`.

Support WhatsApp number: expose via `uiStrings` (or hardcode as a constant — check if there is an existing support contact in site config). If no existing config, use a constant `const _kSupportPhone = '+919XXXXXXXXX'` and document it here.

Import `url_launcher` — already in pubspec (`url_launcher: ^6.3.1` or similar — check `pubspec.yaml`).

---

### F-13 — Submission date in `_PendingView` ⬜

**Problem:** Members who submitted their application see "Your application is being reviewed" with no timeline. They call/message support asking "when will I be approved?" Surfacing the submission date reduces these queries.

**File:** `tbt_app/lib/features/onboarding/presentation/onboarding_screen.dart`

**`_PendingView` currently takes no props.** Change to accept `submittedAt`:

```dart
class _PendingView extends StatelessWidget {
  const _PendingView({this.submittedAt});
  final String? submittedAt;  // ISO 8601 string from state.onboardingSubmittedAt
```

Call site in `OnboardingScreen.build`:
```dart
if (state.verificationStatus == 'under_review')
  return _PendingView(submittedAt: state.onboardingSubmittedAt);
```

Display in the widget (below the subtext):
```dart
if (submittedAt != null) ...[
  const SizedBox(height: 20),
  Container(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
    decoration: BoxDecoration(
      color: _kCard,
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: _kBorder),
    ),
    child: Row(children: [
      const Icon(Icons.schedule_outlined, color: _kMuted, size: 16),
      const SizedBox(width: 8),
      Text(
        'Submitted ${_formatRelativeDate(submittedAt!)}',
        style: const TextStyle(color: _kMuted, fontSize: 13),
      ),
    ]),
  ),
],
```

**`_formatRelativeDate(String iso)` helper** (add as top-level function):
```dart
String _formatRelativeDate(String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return iso;
  final diff = DateTime.now().difference(dt);
  if (diff.inDays == 0) return 'today';
  if (diff.inDays == 1) return 'yesterday';
  if (diff.inDays < 7) return '${diff.inDays} days ago';
  return '${(diff.inDays / 7).floor()} week(s) ago';
}
```

---

### F-14 — WhatsApp notification on `changes_requested` ⬜

**Problem:** `requestChangesMemberHandler` emits a socket event and creates an in-app notification, but sends no WhatsApp message. Since TBT already uses WABA for OTPs and batch reports, a WhatsApp nudge here would be effective — it reaches the member even if they haven't opened the app.

**File:** `tbt-admin/backend/src/modules/members/controller.ts`

**Find `requestChangesMemberHandler`** (currently around line 1597 based on the `changes_requested` grep hit). After the existing `io.emit` + notification calls, add:

```typescript
// WhatsApp nudge for changes_requested
import { sendWhatsApp } from '../../lib/whatsapp.js';  // or wherever the WABA helper lives

const phone = (existing as any).phone;
if (phone) {
  void sendWhatsApp(phone, [
    'Your TBT onboarding application requires some changes.',
    note.trim(),
    'Please log in to the TBT app to update your details and resubmit.',
  ].join('\n\n')).catch(() => {});
}
```

Verify the WABA helper function name/path by checking `backend/src/lib/` — it is used in the OTP and batch report flows. Use plain-text (non-template) message here since there is no approved WhatsApp template for this notification type. If a template is available, prefer it.

---

## API Contract Summary (new/changed endpoints)

| Method | Path | Auth | Description | Status |
|--------|------|------|-------------|--------|
| POST | `/api/onboarding/photo/presign` | `authenticateUser` | Presign profile photo upload to `profile-photos` bucket | ⬜ F-05 |
| PUT | `/api/admin/onboarding/content/reorder` | `authenticate` (Clerk) | Reorder content steps by ID array | ⬜ F-08 |
| POST | `/api/members/:id/reject` | `authenticate` (Clerk) | Reject onboarding; set `verificationStatus: 'rejected'` | verify exists |
| POST | `/api/members/:id/request-changes` | `authenticate` (Clerk) | Set `verificationStatus: 'changes_requested'` with note | verify exists |

---

## Flutter File Change Map

| File | Fixes |
|------|-------|
| `shared/widgets/subscription_gate.dart` | F-01 |
| `features/onboarding/presentation/onboarding_screen.dart` | F-02, F-03, F-04, F-05, F-11, F-12, F-13 |
| `features/onboarding/domain/onboarding_state.dart` | F-03 (`isActive` field) |
| `features/onboarding/data/onboarding_repository.dart` | F-04 (`deleteDocument` already exists — no change), F-05 (add `presignProfilePhoto`) |

## Backend File Change Map

| File | Fixes |
|------|-------|
| `modules/members/controller.ts` | F-06, F-14 |
| `modules/onboarding/controller.ts` | F-05 (new `presignProfilePhotoHandler`), F-08 (new `adminReorderOnboardingContentHandler`) |
| `modules/onboarding/routes.ts` | F-05, F-08 (register new routes) |
| `modules/members/routes.ts` | F-09 (verify reject/request-changes routes exist) |

## Admin Panel File Change Map

| File | Fixes |
|------|-------|
| `app/onboarding/page.tsx` | F-08, F-10 |
| `app/kyc-review/page.tsx` | F-09 (new file) |
| `components/layout/Sidebar.tsx` | F-09 (new nav item) |
| `lib/hooks/useTbt.ts` | F-08 (`useReorderOnboardingContent`) |
| `lib/hooks/useMembers.ts` | F-09 (`useRejectMember`, `useRequestMemberChanges`) |

---

## Implementation Order

Sprint 1 (P0) → Sprint 2 (P1) → Sprint 3 (P2) → Sprint 4 (P3)

Within each sprint, suggested order:
- Sprint 1: F-02 → F-01 → F-03 (verified screen first since it's self-contained, then gate redirect, then content keys)
- Sprint 2: F-07 (free via F-02) → F-04 → F-05 → F-06
- Sprint 3: F-08 → F-09 → F-10
- Sprint 4: F-11 → F-13 → F-12 → F-14

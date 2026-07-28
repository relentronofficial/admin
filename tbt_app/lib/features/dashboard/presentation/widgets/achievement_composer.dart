import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../shared/api/dio_provider.dart';
import '../../../../shared/providers/me_provider.dart';
import '../../../../shared/theme/design_constants.dart';
import '../../../../shared/theme/theme_tokens.dart';
import '../../data/community_service.dart';

/// Home-page composer for community posts — direct port of co-worker's
/// `AchievementComposer` (main.dart:1363–2530).
///
/// Features:
///   * Collapsible glass card ("What did you achieve today? 🚀") with
///     chevron toggle.
///   * Avatar + multi-line text input + smiley toggle in one row.
///   * Emoji picker (60 emojis, 7 columns) that inserts at the cursor.
///   * Milestone chip row (5 options, mutually exclusive).
///   * Attachment: image (image_picker), video (image_picker), audio
///     (file_picker). Preview strip with close pill. Selecting one type
///     clears the other two.
///   * Visibility selector as bottom sheet: Public / Friends.
///   * Post button submits to `/api/community/feed` — created with
///     `isApproved: false` (admin moderates before it shows in the feed).
class AchievementComposer extends ConsumerStatefulWidget {
  const AchievementComposer({super.key, this.onPosted});

  /// Fired after a successful submit + snackbar. Used by the community
  /// screen's inline composer sheet to auto-dismiss the sheet.
  final VoidCallback? onPosted;

  @override
  ConsumerState<AchievementComposer> createState() =>
      _AchievementComposerState();
}

class _AchievementComposerState extends ConsumerState<AchievementComposer> {
  static const _emojis = <String>[
    // Smileys
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '😎',
    '🤩', '🥳', '😏', '🤔', '🤨', '😐', '😑', '🙄', '😬', '😴',
    // Hands & Gestures
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '👋', '👏', '🙏', '🙌',
    // Hearts & Miscellaneous
    '❤️', '💖', '🔥', '🚀', '🎉', '🌟', '✨', '💯', '🎈', '💼',
    '📈', '💡', '🏆', '🎯', '🤝', '📣', '🔔', '🌍', '🇮🇳', '💻',
  ];

  static const _milestoneOptions = [
    'First Post',
    'Level Up',
    'Task Complete',
    'Book Finished',
    'Course Complete',
  ];

  final _textCtl = TextEditingController();
  final _focus = FocusNode();
  final _picker = ImagePicker();

  bool _expanded = true;
  bool _showEmojiPicker = false;
  bool _submitting = false;
  String _visibility = 'Public';
  String? _milestone;

  XFile? _pickedImage;
  XFile? _pickedVideo;
  PlatformFile? _pickedAudio;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (_focus.hasFocus && _showEmojiPicker) {
        setState(() => _showEmojiPicker = false);
      }
    });
  }

  @override
  void dispose() {
    _textCtl.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _insertEmoji(String emoji) {
    final text = _textCtl.text;
    final sel = _textCtl.selection;
    if (sel.start < 0) {
      _textCtl.text = text + emoji;
      _textCtl.selection = TextSelection.fromPosition(
        TextPosition(offset: _textCtl.text.length),
      );
    } else {
      final newText = text.replaceRange(sel.start, sel.end, emoji);
      _textCtl.value = TextEditingValue(
        text: newText,
        selection: TextSelection.collapsed(offset: sel.start + emoji.length),
      );
    }
  }

  Future<void> _pickImage() async {
    try {
      final file =
          await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (file == null) return;
      setState(() {
        _pickedImage = file;
        _pickedVideo = null;
        _pickedAudio = null;
        _showEmojiPicker = false;
      });
    } catch (e) {
      _showError('Error selecting photo: $e');
    }
  }

  Future<void> _pickVideo() async {
    try {
      final file = await _picker.pickVideo(source: ImageSource.gallery);
      if (file == null) return;
      setState(() {
        _pickedVideo = file;
        _pickedImage = null;
        _pickedAudio = null;
        _showEmojiPicker = false;
      });
    } catch (e) {
      _showError('Error selecting video: $e');
    }
  }

  Future<void> _pickAudio() async {
    try {
      final result = await FilePicker.platform.pickFiles(type: FileType.audio);
      if (result == null || result.files.single.path == null) return;
      setState(() {
        _pickedAudio = result.files.single;
        _pickedImage = null;
        _pickedVideo = null;
        _showEmojiPicker = false;
      });
    } catch (e) {
      _showError('Error selecting audio: $e');
    }
  }

  void _clearAttachment() {
    setState(() {
      _pickedImage = null;
      _pickedVideo = null;
      _pickedAudio = null;
    });
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: const Color(0xFFD30814),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showVisibilitySelector() {
    showModalBottomSheet(
      context: context,
      backgroundColor: context.tokens.bgSurface,
      clipBehavior: Clip.antiAlias,
      constraints: const BoxConstraints(maxWidth: 500),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        final tokens = ctx.tokens;
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: tokens.borderCard,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Who can see this?',
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Icon(Icons.public, color: tokens.textSecondary),
                title: Text('Public',
                    style: TextStyle(color: tokens.textPrimary)),
                subtitle: Text(
                  'Anyone on or off Tamil Business Tribe',
                  style: TextStyle(color: tokens.textSecondary, fontSize: 12),
                ),
                trailing: _visibility == 'Public'
                    ? const Icon(Icons.check, color: kColorAccent)
                    : null,
                onTap: () {
                  setState(() => _visibility = 'Public');
                  Navigator.pop(ctx);
                },
              ),
              Divider(color: tokens.borderCard, height: 1),
              ListTile(
                leading: Icon(Icons.people_alt_rounded,
                    color: tokens.textSecondary),
                title: Text('Friends',
                    style: TextStyle(color: tokens.textPrimary)),
                subtitle: Text(
                  'Your connections on Tamil Business Tribe',
                  style: TextStyle(color: tokens.textSecondary, fontSize: 12),
                ),
                trailing: _visibility == 'Friends'
                    ? const Icon(Icons.check, color: kColorAccent)
                    : null,
                onTap: () {
                  setState(() => _visibility = 'Friends');
                  Navigator.pop(ctx);
                },
              ),
              const SizedBox(height: 20),
            ],
          ),
        );
      },
    );
  }

  void _showMilestoneSelector() {
    showModalBottomSheet(
      context: context,
      backgroundColor: context.tokens.bgSurface,
      clipBehavior: Clip.antiAlias,
      constraints: const BoxConstraints(maxWidth: 500),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        final tokens = ctx.tokens;
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: tokens.borderCard,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Growth Milestone',
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              for (final m in _milestoneOptions)
                ListTile(
                  leading: const Icon(Icons.rocket_launch_rounded,
                      color: kColorAccent, size: 20),
                  title: Text(m, style: TextStyle(color: tokens.textPrimary)),
                  trailing: _milestone == m
                      ? const Icon(Icons.check, color: kColorAccent)
                      : null,
                  onTap: () {
                    setState(() => _milestone = _milestone == m ? null : m);
                    Navigator.pop(ctx);
                  },
                ),
              const SizedBox(height: 20),
            ],
          ),
        );
      },
    );
  }

  /// Uploads a picked file to R2 via the presigned-URL flow. Returns
  /// the public URL that should be stored on the post's `mediaUrls`.
  /// Returns null (with a toast) if the upload fails — the composer
  /// still submits the text-only post in that case.
  Future<String?> _uploadMedia(XFile file) async {
    try {
      final dio = ref.read(dioProvider);
      // Guess content type from the file's mime (image_picker/file_picker
      // provide it) or fall back to a sensible default per extension.
      final ext = file.name.split('.').last.toLowerCase();
      final contentType = file.mimeType ??
          (const {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'mp4': 'video/mp4',
            'mov': 'video/quicktime',
            'webm': 'video/webm',
          }[ext] ??
              'application/octet-stream');
      final isVideo = contentType.startsWith('video/');
      final res = await dio.post<Map<String, dynamic>>(
        '/api/upload/presigned-url',
        data: {
          'filename': file.name,
          'contentType': contentType,
          'bucket': isVideo ? 'community-videos' : 'community-photos',
          'pathPrefix': 'community',
        },
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      final uploadUrl = data['uploadUrl'] as String?;
      final publicUrl = data['publicUrl'] as String?;
      if (uploadUrl == null || publicUrl == null) {
        _showError('Upload URL missing from server.');
        return null;
      }

      // Read the file bytes + PUT them to the presigned URL. Uses a
      // fresh Dio (no auth interceptor) since the presigned URL already
      // authenticates via the signed query string.
      final bytes = await file.readAsBytes();
      final putDio = Dio();
      await putDio.put<void>(
        uploadUrl,
        data: Stream.fromIterable([bytes]),
        options: Options(
          headers: {
            'Content-Type': contentType,
            'Content-Length': bytes.length,
          },
        ),
      );
      return publicUrl;
    } catch (e) {
      _showError('Media upload failed. Posting without media.');
      return null;
    }
  }

  Future<void> _submit() async {
    final text = _textCtl.text.trim();
    if (text.isEmpty && _pickedImage == null && _pickedVideo == null) {
      _showError('Say something first!');
      return;
    }
    if (_submitting) return;
    setState(() => _submitting = true);
    String? optimisticId;
    try {
      // Items #22 + #23: upload picked media (image OR video) to R2
      // via the presigned-URL flow, then submit the post with the
      // returned public URL in mediaUrls[]. Image and video URLs go in
      // the same array — the mobile post card decides how to render
      // each URL by inspecting its file extension.
      final mediaUrls = <String>[];
      final upload = _pickedImage ?? _pickedVideo;
      if (upload != null) {
        final url = await _uploadMedia(upload);
        if (url != null) mediaUrls.add(url);
      }

      // Item #29: optimistically insert the post at the top of the
      // feed with a "Pending approval" pill so the author sees
      // immediate feedback rather than a mystery "waiting" state.
      final me = ref.read(meNotifierProvider).valueOrNull;
      final myId = (me as dynamic)?.id as String? ?? '';
      final myName = (me as dynamic)?.name as String?;
      final myPhoto = (me as dynamic)?.avatarUrl as String?;
      if (myId.isNotEmpty) {
        final filter = ref.read(communityFilterProvider);
        optimisticId = ref
            .read(communityFeedNotifierProvider(filter).notifier)
            .insertOptimistic(
              content: text,
              mediaUrls: mediaUrls,
              memberId: myId,
              memberName: myName,
              memberPhoto: myPhoto,
            );
      }

      await ref.read(communityServiceProvider).submit(
            content: text,
            mediaUrls: mediaUrls.isEmpty ? null : mediaUrls,
          );
      // Server accepted → drop the optimistic + refetch so the row
      // has the real id and the correct isApproved state.
      ref.invalidateCommunityFeed();
      if (!mounted) return;
      _textCtl.clear();
      setState(() {
        _pickedImage = null;
        _pickedVideo = null;
        _pickedAudio = null;
        _milestone = null;
        _expanded = false;
        _showEmojiPicker = false;
      });
      _focus.unfocus();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Posted! Waiting for admin approval.'),
          backgroundColor: const Color(0xFF27AE60),
          behavior: SnackBarBehavior.floating,
          action: SnackBarAction(
            label: 'View feed',
            textColor: Colors.white,
            onPressed: () {
              if (context.mounted) {
                Navigator.of(context).pushNamed('/community');
              }
            },
          ),
        ),
      );
      widget.onPosted?.call();
    } catch (_) {
      if (!mounted) return;
      // Roll back the optimistic row so the feed doesn't lie.
      if (optimisticId != null) {
        final filter = ref.read(communityFilterProvider);
        ref
            .read(communityFeedNotifierProvider(filter).notifier)
            .rollbackOptimistic(optimisticId);
      }
      _showError('Could not post. Please try again.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final me = ref.watch(meNotifierProvider).valueOrNull;
    final avatarUrl = (me as dynamic)?.avatarUrl as String?;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? const [
                  Color(0xFF1B1B22),
                  Color(0xFF11111A),
                  Color(0xFF06060B),
                ]
              : const [
                  Color(0xFFFFFFFF),
                  Color(0xFFD4D4DC),
                ],
          stops: isDark ? const [0.0, 0.55, 1.0] : null,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: isDark
            ? const [
                // Deep, diffused single drop shadow — pure black,
                // spills downward. No gray highlight (would whitewash).
                BoxShadow(
                  color: Colors.black,
                  offset: Offset(0, 16),
                  blurRadius: 36,
                ),
                BoxShadow(
                  color: Color(0xA6000000), // black at ~65% alpha
                  offset: Offset(0, 4),
                  blurRadius: 8,
                ),
              ]
            : [
                // Light-mode neumorphism: dual shadows (dark bottom-
                // right + white highlight top-left) give the extruded
                // "lit-from-top-left" emboss.
                const BoxShadow(
                  color: Color(0xBF8E8EA0), // #8E8EA0 at 75%
                  offset: Offset(16, 16),
                  blurRadius: 32,
                ),
                const BoxShadow(
                  color: Color(0x738E8EA0), // #8E8EA0 at 45%
                  offset: Offset(4, 4),
                  blurRadius: 6,
                ),
                const BoxShadow(
                  color: Colors.white,
                  offset: Offset(-14, -14),
                  blurRadius: 30,
                ),
                BoxShadow(
                  color: Colors.white.withValues(alpha: 0.95),
                  offset: const Offset(-3, -3),
                  blurRadius: 5,
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _expanded
                          ? 'What did you achieve today? 🚀'
                          : 'What did you achieve today?',
                      style: TextStyle(
                        color: tokens.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.5,
                      ),
                    ),
                    if (_expanded) ...[
                      const SizedBox(height: 6),
                      const Text(
                        'Share your progress, inspire others, celebrate wins!',
                        style: TextStyle(
                          color: Color(0xFF8E8E93),
                          fontSize: 13.5,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => setState(() => _expanded = !_expanded),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: tokens.borderCard,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: tokens.textSecondary,
                    size: 24,
                  ),
                ),
              ),
            ],
          ),

          if (_expanded) ...[
            const SizedBox(height: 16),

            // Avatar + input + emoji toggle
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: (avatarUrl != null && avatarUrl.isNotEmpty)
                      ? Image.network(
                          avatarUrl,
                          width: 40,
                          height: 40,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _avatarFallback(tokens),
                        )
                      : _avatarFallback(tokens),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: TextField(
                      controller: _textCtl,
                      focusNode: _focus,
                      maxLines: null,
                      style: TextStyle(
                        color: tokens.textPrimary,
                        fontSize: 15,
                      ),
                      decoration: const InputDecoration.collapsed(
                        hintText: 'Share your wins, big or small...',
                        hintStyle: TextStyle(color: Color(0xFF7C7C80)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(
                    Icons.emoji_emotions_outlined,
                    color: Color(0xFF8E8E93),
                  ),
                  onPressed: () {
                    setState(() {
                      _showEmojiPicker = !_showEmojiPicker;
                      if (_showEmojiPicker) {
                        _focus.unfocus();
                      } else {
                        _focus.requestFocus();
                      }
                    });
                  },
                ),
              ],
            ),

            // Milestone chip pill (when selected)
            if (_milestone != null)
              Padding(
                padding: const EdgeInsets.only(top: 8, left: 52),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: kColorAccent.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: kColorAccent.withValues(alpha: 0.25),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.rocket_launch_rounded,
                            color: kColorAccent,
                            size: 13,
                          ),
                          const SizedBox(width: 5),
                          Flexible(
                            child: Text(
                              '${_milestone!.toUpperCase()} Growth Milestone',
                              overflow: TextOverflow.ellipsis,
                              maxLines: 1,
                              style: const TextStyle(
                                color: kColorAccent,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          GestureDetector(
                            onTap: () => setState(() => _milestone = null),
                            child: const Icon(
                              Icons.close,
                              size: 13,
                              color: kColorAccent,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

            // Attachment preview
            if (_pickedImage != null ||
                _pickedVideo != null ||
                _pickedAudio != null) ...[
              const SizedBox(height: 12),
              _AttachmentPreview(
                image: _pickedImage,
                video: _pickedVideo,
                audio: _pickedAudio,
                onClear: _clearAttachment,
              ),
            ],

            // Emoji picker grid
            if (_showEmojiPicker) ...[
              const SizedBox(height: 12),
              Container(
                height: 220,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: tokens.bgInput,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: tokens.borderCard),
                ),
                child: GridView.builder(
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 7,
                    mainAxisSpacing: 4,
                    crossAxisSpacing: 4,
                  ),
                  itemCount: _emojis.length,
                  itemBuilder: (_, i) => InkWell(
                    borderRadius: BorderRadius.circular(6),
                    onTap: () => _insertEmoji(_emojis[i]),
                    child: Center(
                      child: Text(
                        _emojis[i],
                        style: const TextStyle(fontSize: 22),
                      ),
                    ),
                  ),
                ),
              ),
            ],

            const SizedBox(height: 14),
            Divider(color: tokens.borderCard, height: 1),
            const SizedBox(height: 12),

            // Row 1 — media picker chips + visibility toggle.
            // Each media button is icon-only with a tinted circular bg so
            // the row scales cleanly on narrow screens without truncating.
            Row(
              children: [
                _MediaChip(
                  icon: Icons.image_outlined,
                  color: const Color(0xFF2F80ED),
                  tooltip: 'Photo',
                  onTap: _pickImage,
                ),
                const SizedBox(width: 8),
                _MediaChip(
                  icon: Icons.videocam_outlined,
                  color: const Color(0xFF27AE60),
                  tooltip: 'Video',
                  onTap: _pickVideo,
                ),
                const SizedBox(width: 8),
                _MediaChip(
                  icon: Icons.mic_none_outlined,
                  color: const Color(0xFF9B51E0),
                  tooltip: 'Audio',
                  onTap: _pickAudio,
                ),
                const SizedBox(width: 8),
                _MediaChip(
                  icon: Icons.emoji_events_outlined,
                  color: const Color(0xFFF59E0B),
                  tooltip: 'Milestone',
                  onTap: _showMilestoneSelector,
                ),
                const Spacer(),
                _VisibilityToggle(
                  visibility: _visibility,
                  onTap: _showVisibilitySelector,
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Row 2 — full-width Post button. Big tap target, clear label,
            // impossible to truncate.
            SizedBox(
              width: double.infinity,
              child: Material(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  onTap: _submitting ? null : _submit,
                  borderRadius: BorderRadius.circular(14),
                  child: Ink(
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFE50914), Color(0xFFB30710)],
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                      ),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: kColorAccent.withValues(alpha: 0.35),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Center(
                      child: _submitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2.4,
                              ),
                            )
                          : const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.send_rounded,
                                    color: Colors.white, size: 16),
                                SizedBox(width: 8),
                                Text(
                                  'Post to Community',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.4,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _avatarFallback(ThemeTokens tokens) => Container(
        width: 40,
        height: 40,
        color: tokens.bgInput,
        alignment: Alignment.center,
        child: Icon(Icons.person, color: tokens.textSecondary, size: 20),
      );
}

/// Compact icon-only media picker chip. Tinted circular background makes
/// the affordance clear without eating horizontal space with labels.
class _MediaChip extends StatelessWidget {
  const _MediaChip({
    required this.icon,
    required this.color,
    required this.tooltip,
    required this.onTap,
  });
  final IconData icon;
  final Color color;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withValues(alpha: 0.12),
              border: Border.all(
                color: color.withValues(alpha: 0.35),
                width: 1,
              ),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
        ),
      ),
    );
  }
}

/// Visibility pill (Public / Friends). Compact chevron toggle that opens
/// the bottom sheet — sits at the right end of the media row.
class _VisibilityToggle extends StatelessWidget {
  const _VisibilityToggle({required this.visibility, required this.onTap});
  final String visibility;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isPublic = visibility == 'Public';
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: tokens.bgInput,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: tokens.borderCard),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isPublic ? Icons.public : Icons.people_alt_rounded,
                size: 14,
                color: tokens.textSecondary,
              ),
              const SizedBox(width: 6),
              Text(
                visibility,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 2),
              Icon(
                Icons.arrow_drop_down,
                size: 16,
                color: tokens.textSecondary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AttachmentPreview extends StatelessWidget {
  const _AttachmentPreview({
    required this.image,
    required this.video,
    required this.audio,
    required this.onClear,
  });
  final XFile? image;
  final XFile? video;
  final PlatformFile? audio;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    Widget content;
    if (image != null) {
      content = ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.file(
          File(image!.path),
          height: 180,
          width: double.infinity,
          fit: BoxFit.cover,
        ),
      );
    } else if (video != null) {
      content = Container(
        height: 180,
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(12),
        ),
        alignment: Alignment.center,
        child: const Icon(Icons.play_circle_fill_rounded,
            color: Colors.white70, size: 64),
      );
    } else {
      content = Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          color: const Color(0xFF9B51E0).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: const Color(0xFF9B51E0).withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          children: [
            const Icon(Icons.audiotrack,
                color: Color(0xFF9B51E0), size: 22),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                audio!.name,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      );
    }
    return Stack(
      children: [
        content,
        Positioned(
          top: 8,
          right: 8,
          child: GestureDetector(
            onTap: onClear,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.close, color: Colors.white, size: 16),
            ),
          ),
        ),
      ],
    );
  }
}

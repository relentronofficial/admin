import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/theme/design_constants.dart';
import '../../../../shared/theme/theme_tokens.dart';
import '../../data/community_service.dart';

/// AchievementComposer — the home-page composer that lets members post
/// a "win" to the community feed. Ports the co-worker's home widget
/// with a simplified feature set (text + media URL placeholder;
/// milestone chip; visibility; post button). Full media picker deferred.
///
/// On submit → POST /api/community/feed → post lands unapproved,
/// admin moderates. UI resets to collapsed state after success.
class AchievementComposer extends ConsumerStatefulWidget {
  const AchievementComposer({super.key});

  @override
  ConsumerState<AchievementComposer> createState() => _AchievementComposerState();
}

class _AchievementComposerState extends ConsumerState<AchievementComposer> {
  final _textCtl = TextEditingController();
  final _focus = FocusNode();
  bool _expanded = false;
  bool _submitting = false;
  String _visibility = 'Public';
  String? _milestone;

  static const _visibilityOptions = ['Public', 'Private'];
  static const _milestoneOptions = [
    'First Post',
    'Level Up',
    'Task Complete',
    'Book Finished',
    'Course Complete',
  ];

  @override
  void dispose() {
    _textCtl.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _textCtl.text.trim();
    if (text.isEmpty || _submitting) return;
    setState(() => _submitting = true);
    try {
      await ref.read(communityServiceProvider).submit(content: text);
      ref.invalidate(communityFeedProvider);
      if (!mounted) return;
      _textCtl.clear();
      setState(() {
        _expanded = false;
        _milestone = null;
      });
      _focus.unfocus();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Posted — waiting for admin approval.'),
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 2),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not post. Please try again.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Collapsed input row → expands on focus
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
            child: TextField(
              controller: _textCtl,
              focusNode: _focus,
              minLines: 1,
              maxLines: _expanded ? 6 : 2,
              style: TextStyle(color: tokens.textPrimary, fontSize: 14),
              decoration: InputDecoration(
                hintText: "Share a win, insight, or milestone…",
                hintStyle: TextStyle(color: tokens.textMuted, fontSize: 14),
                border: InputBorder.none,
                isCollapsed: true,
                contentPadding: EdgeInsets.zero,
              ),
              onTap: () => setState(() => _expanded = true),
              onChanged: (v) {
                if (v.isNotEmpty && !_expanded) setState(() => _expanded = true);
              },
            ),
          ),

          if (_expanded) ...[
            const Divider(height: 1),
            // Milestone chip row
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
              child: Row(
                children: [
                  for (final m in _milestoneOptions) ...[
                    _MilestoneChip(
                      label: m,
                      selected: _milestone == m,
                      onTap: () => setState(() {
                        _milestone = _milestone == m ? null : m;
                      }),
                    ),
                    const SizedBox(width: 6),
                  ],
                ],
              ),
            ),

            // Bottom action row: visibility + post button
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 4, 10, 10),
              child: Row(
                children: [
                  // Media picker buttons (placeholders — real picker in a
                  // future slice)
                  _IconButton(
                    icon: Icons.image_outlined,
                    onTap: () => _showComingSoon('Image upload'),
                  ),
                  _IconButton(
                    icon: Icons.videocam_outlined,
                    onTap: () => _showComingSoon('Video upload'),
                  ),
                  _IconButton(
                    icon: Icons.emoji_emotions_outlined,
                    onTap: () => _showComingSoon('Emoji picker'),
                  ),
                  const Spacer(),
                  // Visibility dropdown
                  DropdownButton<String>(
                    value: _visibility,
                    isDense: true,
                    underline: const SizedBox(),
                    dropdownColor: tokens.bgSurface,
                    icon: Icon(Icons.arrow_drop_down, color: tokens.textSecondary, size: 18),
                    items: [
                      for (final v in _visibilityOptions)
                        DropdownMenuItem(
                          value: v,
                          child: Row(
                            children: [
                              Icon(
                                v == 'Public' ? Icons.public : Icons.lock_outline,
                                size: 12,
                                color: tokens.textSecondary,
                              ),
                              const SizedBox(width: 6),
                              Text(v, style: TextStyle(color: tokens.textPrimary, fontSize: 12)),
                            ],
                          ),
                        ),
                    ],
                    onChanged: (v) {
                      if (v != null) setState(() => _visibility = v);
                    },
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed:
                        _submitting || _textCtl.text.trim().isEmpty ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: kColorAccent,
                      minimumSize: const Size(72, 34),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Text(
                            'POST',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showComingSoon(String feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$feature — coming soon.'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 1),
      ),
    );
  }
}

class _MilestoneChip extends StatelessWidget {
  const _MilestoneChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? kColorAccent.withValues(alpha: 0.15) : context.tokens.bgInput,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? kColorAccent : context.tokens.borderCard,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? kColorAccent : context.tokens.textSecondary,
            fontSize: 11,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _IconButton extends StatelessWidget {
  const _IconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: Icon(icon, color: context.tokens.textSecondary, size: 20),
      onPressed: onTap,
      padding: const EdgeInsets.all(6),
      constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
    );
  }
}

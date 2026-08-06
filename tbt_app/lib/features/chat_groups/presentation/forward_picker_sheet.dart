import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/chat_groups_service.dart';
import '../providers/chat_group_providers.dart';

/// Bottom sheet that lets the member forward a message into one or many
/// of the groups they belong to. WhatsApp-style multi-select with a
/// primary "Forward to N" CTA at the bottom.
///
/// [excludeGroupId] hides the current group from the list (no
/// self-forward). Returns the number of groups the message was
/// forwarded into, or `null` on cancel.
class ForwardPickerSheet extends ConsumerStatefulWidget {
  const ForwardPickerSheet({
    super.key,
    required this.sourceGroupId,
    required this.messageId,
  });
  final String sourceGroupId;
  final String messageId;

  @override
  ConsumerState<ForwardPickerSheet> createState() => _ForwardPickerSheetState();
}

class _ForwardPickerSheetState extends ConsumerState<ForwardPickerSheet> {
  final Set<String> _selected = {};
  bool _submitting = false;

  Future<void> _forward() async {
    if (_selected.isEmpty || _submitting) return;
    setState(() => _submitting = true);
    final ids = _selected.toList();
    try {
      final count = await ref.read(chatGroupsServiceProvider).forwardMessage(
            widget.sourceGroupId,
            widget.messageId,
            ids,
          );
      if (!mounted) return;
      Navigator.of(context).pop(count);
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not forward.'), behavior: SnackBarBehavior.floating),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final groupsAsync = ref.watch(myChatGroupsProvider);
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scrollCtl) => Container(
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: tokens.borderCard,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Text(
                    'FORWARD TO',
                    style: TextStyle(
                      fontFamily: 'Rajdhani',
                      color: tokens.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      letterSpacing: 1.4,
                    ),
                  ),
                  const Spacer(),
                  if (_selected.isNotEmpty)
                    Text(
                      '${_selected.length} selected',
                      style: TextStyle(
                        color: tokens.textMuted,
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: groupsAsync.when(
                loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                error: (_, __) => Center(
                  child: Text('Could not load groups.',
                      style: TextStyle(color: tokens.textMuted)),
                ),
                data: (groups) {
                  final available = groups
                      .where((g) => g.id != widget.sourceGroupId)
                      .toList();
                  if (available.isEmpty) {
                    return Center(
                      child: Text(
                        'You are not in any other groups.',
                        style: TextStyle(color: tokens.textMuted, fontSize: 12),
                      ),
                    );
                  }
                  return ListView.separated(
                    controller: scrollCtl,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: available.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 4),
                    itemBuilder: (_, i) {
                      final g = available[i];
                      final on = _selected.contains(g.id);
                      return Material(
                        color: on
                            ? kColorAccent.withValues(alpha: 0.08)
                            : tokens.bgInput,
                        borderRadius: BorderRadius.circular(10),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(10),
                          onTap: () => setState(() {
                            if (on) {
                              _selected.remove(g.id);
                            } else {
                              _selected.add(g.id);
                            }
                          }),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                            child: Row(
                              children: [
                                _Thumb(url: g.avatarUrl, name: g.name),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    g.name,
                                    style: TextStyle(
                                      color: tokens.textPrimary,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                Icon(
                                  on
                                      ? Icons.check_circle
                                      : Icons.radio_button_unchecked,
                                  color: on ? kColorAccent : tokens.textMuted,
                                  size: 20,
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: _selected.isEmpty || _submitting ? null : _forward,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kColorAccent,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: tokens.bgInput,
                      disabledForegroundColor: tokens.textMuted,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(23),
                      ),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            _selected.isEmpty
                                ? 'Select at least one group'
                                : 'Forward to ${_selected.length}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.url, required this.name});
  final String? url;
  final String name;
  @override
  Widget build(BuildContext context) {
    if (url != null && url!.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: url!,
          width: 36,
          height: 36,
          fit: BoxFit.cover,
          errorWidget: (_, __, ___) => _fallback(),
        ),
      );
    }
    return _fallback();
  }

  Widget _fallback() {
    final initial = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return Container(
      width: 36,
      height: 36,
      decoration: const BoxDecoration(color: kColorAccent, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700),
      ),
    );
  }
}

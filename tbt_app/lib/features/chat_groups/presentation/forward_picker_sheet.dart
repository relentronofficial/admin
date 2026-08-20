import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../messages/data/messages_service.dart';
import '../../messages/providers/messages_provider.dart';
import '../data/chat_groups_service.dart';
import '../providers/chat_group_providers.dart';

/// Bottom sheet that lets the member forward a message into one or many
/// of the groups they belong to, or into an existing DM conversation.
/// WhatsApp-style multi-select with a primary "Forward to N" CTA.
///
/// [excludeGroupId] hides the current group from the list (no self-forward).
/// Returns total count of successful forwards, or `null` on cancel.
///
/// [body], [mediaUrl], [mediaType] are the message content used when
/// forwarding to a DM conversation (the group→group forward is handled
/// server-side using [messageId]).
class ForwardPickerSheet extends ConsumerStatefulWidget {
  const ForwardPickerSheet({
    super.key,
    required this.sourceGroupId,
    required this.messageId,
    this.messageIds,
    this.body,
    this.mediaUrl,
    this.mediaType,
  });
  final String sourceGroupId;
  /// Single-message forward — used by the action sheet.
  final String messageId;
  /// Multi-select bulk forward — when provided, overrides [messageId].
  final List<String>? messageIds;
  /// Original message text for DM forwarding.
  final String? body;
  /// Original message media URL for DM forwarding.
  final String? mediaUrl;
  /// Original message media type for DM forwarding.
  final String? mediaType;

  bool get _hasDmContent => body != null || mediaUrl != null;

  @override
  ConsumerState<ForwardPickerSheet> createState() => _ForwardPickerSheetState();
}

class _ForwardPickerSheetState extends ConsumerState<ForwardPickerSheet>
    with SingleTickerProviderStateMixin {
  final Set<String> _selectedGroupIds = {};
  final Set<String> _selectedConvIds = {};
  bool _submitting = false;
  late final TabController _tabCtl;

  @override
  void initState() {
    super.initState();
    _tabCtl = TabController(length: 2, vsync: this);
    _tabCtl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _tabCtl.dispose();
    super.dispose();
  }

  int get _totalSelected => _selectedGroupIds.length + _selectedConvIds.length;

  Future<void> _forward() async {
    if (_totalSelected == 0 || _submitting) return;
    setState(() => _submitting = true);
    final svc = ref.read(chatGroupsServiceProvider);
    final msgSvc = ref.read(messagesServiceProvider);
    int count = 0;

    try {
      // Group→group forward (server-side copy)
      if (_selectedGroupIds.isNotEmpty) {
        final bulkIds = widget.messageIds;
        count += (bulkIds != null && bulkIds.length > 1)
            ? await svc.forwardMessages(widget.sourceGroupId, bulkIds, _selectedGroupIds.toList())
            : await svc.forwardMessage(widget.sourceGroupId, widget.messageId, _selectedGroupIds.toList());
      }

      // Group→DM forward (send message content to each conversation)
      if (_selectedConvIds.isNotEmpty && widget._hasDmContent) {
        await Future.wait(_selectedConvIds.map((convId) async {
          try {
            await msgSvc.sendMessage(
              convId,
              widget.body,
              mediaUrl: widget.mediaUrl,
              mediaType: widget.mediaType,
            );
            count++;
          } catch (_) {}
        }));
      } else {
        count += _selectedConvIds.length;
      }

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
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
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
            const SizedBox(height: 8),
            // ── Tab bar ───────────────────────────────────────────────
            TabBar(
              controller: _tabCtl,
              labelColor: kColorAccent,
              unselectedLabelColor: tokens.textMuted,
              indicatorColor: kColorAccent,
              labelStyle: const TextStyle(
                fontFamily: 'Rajdhani',
                fontWeight: FontWeight.w700,
                fontSize: 13,
                letterSpacing: 0.6,
              ),
              tabs: const [Tab(text: 'GROUPS'), Tab(text: 'CONTACTS')],
            ),
            const SizedBox(height: 4),
            // ── Selection count ───────────────────────────────────────
            if (_totalSelected > 0)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    '$_totalSelected selected',
                    style: TextStyle(color: tokens.textMuted, fontSize: 12),
                  ),
                ),
              ),
            // ── Tab body ──────────────────────────────────────────────
            Expanded(
              child: TabBarView(
                controller: _tabCtl,
                children: [
                  _GroupsTab(
                    sourceGroupId: widget.sourceGroupId,
                    selected: _selectedGroupIds,
                    scrollCtl: scrollCtl,
                    onToggle: (id) => setState(() {
                      if (_selectedGroupIds.contains(id)) {
                        _selectedGroupIds.remove(id);
                      } else {
                        _selectedGroupIds.add(id);
                      }
                    }),
                  ),
                  _ContactsTab(
                    selected: _selectedConvIds,
                    scrollCtl: scrollCtl,
                    enabled: widget._hasDmContent,
                    onToggle: (id) => setState(() {
                      if (_selectedConvIds.contains(id)) {
                        _selectedConvIds.remove(id);
                      } else {
                        _selectedConvIds.add(id);
                      }
                    }),
                  ),
                ],
              ),
            ),
            // ── Forward CTA ───────────────────────────────────────────
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: _totalSelected == 0 || _submitting ? null : _forward,
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
                            _totalSelected == 0
                                ? 'Select at least one'
                                : 'Forward to $_totalSelected',
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

// ── Groups tab ────────────────────────────────────────────────────────────────

class _GroupsTab extends ConsumerWidget {
  const _GroupsTab({
    required this.sourceGroupId,
    required this.selected,
    required this.scrollCtl,
    required this.onToggle,
  });
  final String sourceGroupId;
  final Set<String> selected;
  final ScrollController scrollCtl;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final groupsAsync = ref.watch(myChatGroupsProvider);
    return groupsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (_, __) => Center(
        child: Text('Could not load groups.', style: TextStyle(color: tokens.textMuted)),
      ),
      data: (groups) {
        final available = groups.where((g) => g.id != sourceGroupId).toList();
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
            final on = selected.contains(g.id);
            return _PickerTile(
              avatarUrl: g.avatarUrl,
              name: g.name,
              selected: on,
              onTap: () => onToggle(g.id),
            );
          },
        );
      },
    );
  }
}

// ── Contacts tab ──────────────────────────────────────────────────────────────

class _ContactsTab extends ConsumerWidget {
  const _ContactsTab({
    required this.selected,
    required this.scrollCtl,
    required this.enabled,
    required this.onToggle,
  });
  final Set<String> selected;
  final ScrollController scrollCtl;
  final bool enabled;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;

    if (!enabled) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'DM forwarding is only available for text and media messages.',
            textAlign: TextAlign.center,
            style: TextStyle(color: tokens.textMuted, fontSize: 13),
          ),
        ),
      );
    }

    final convsAsync = ref.watch(conversationsProvider);
    return convsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (_, __) => Center(
        child: Text('Could not load conversations.', style: TextStyle(color: tokens.textMuted)),
      ),
      data: (convs) {
        if (convs.isEmpty) {
          return Center(
            child: Text(
              'No conversations yet.',
              style: TextStyle(color: tokens.textMuted, fontSize: 12),
            ),
          );
        }
        return ListView.separated(
          controller: scrollCtl,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          itemCount: convs.length,
          separatorBuilder: (_, __) => const SizedBox(height: 4),
          itemBuilder: (_, i) {
            final c = convs[i];
            final on = selected.contains(c.id);
            return _PickerTile(
              name: c.subject,
              selected: on,
              onTap: () => onToggle(c.id),
              icon: Icons.chat_bubble_outline_rounded,
            );
          },
        );
      },
    );
  }
}

// ── Shared tile ───────────────────────────────────────────────────────────────

class _PickerTile extends StatelessWidget {
  const _PickerTile({
    required this.name,
    required this.selected,
    required this.onTap,
    this.avatarUrl,
    this.icon,
  });
  final String name;
  final bool selected;
  final VoidCallback onTap;
  final String? avatarUrl;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Material(
      color: selected ? kColorAccent.withValues(alpha: 0.08) : tokens.bgInput,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              _Thumb(url: avatarUrl, name: name, icon: icon),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  name,
                  style: TextStyle(
                    color: tokens.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Icon(
                selected ? Icons.check_circle : Icons.radio_button_unchecked,
                color: selected ? kColorAccent : tokens.textMuted,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.url, required this.name, this.icon});
  final String? url;
  final String name;
  final IconData? icon;

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
    if (icon != null) {
      return Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(color: const Color(0xFF2a2a2a), shape: BoxShape.circle),
        alignment: Alignment.center,
        child: Icon(icon, color: Colors.white54, size: 18),
      );
    }
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

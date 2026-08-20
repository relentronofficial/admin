import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/providers/me_provider.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/chat_groups_service.dart';
import '../domain/chat_group_models.dart';
import '../providers/chat_group_providers.dart';
import 'chat_group_media_gallery.dart';

/// Bottom sheet — group avatar/name/description + member list with
/// presence dot + leave button.
class ChatGroupInfoSheet extends ConsumerWidget {
  const ChatGroupInfoSheet({super.key, required this.detail, required this.onLeave});
  final ChatGroupDetail detail;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final presenceMap = ref.watch(chatGroupPresenceProvider(detail.id)).valueOrNull ?? const {};
    final me = ref.watch(meNotifierProvider).valueOrNull;
    final myRole = me != null
        ? detail.members.firstWhere((m) => m.id == me.id, orElse: () => const ChatGroupMember(id: '')).role
        : null;
    final isGroupAdmin = myRole == 'admin';

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, scrollCtl) {
        return Container(
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
              Expanded(
                child: ListView(
                  controller: scrollCtl,
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                  children: [
                    // Header
                    Center(
                      child: Column(
                        children: [
                          _Avatar(url: detail.avatarUrl, size: 72, name: detail.name),
                          const SizedBox(height: 10),
                          Text(
                            detail.name,
                            style: TextStyle(
                              color: tokens.textPrimary,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (detail.description != null && detail.description!.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              detail.description!,
                              textAlign: TextAlign.center,
                              style: TextStyle(color: tokens.textSecondary, fontSize: 12, height: 1.4),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    // ── Media preview ─────────────────────────────────────
                    _MediaPreviewSection(
                      groupId: detail.id,
                      groupName: detail.name,
                      svc: ref.read(chatGroupsServiceProvider),
                    ),
                    const SizedBox(height: 20),
                    // ── Disappearing messages (F-18 — admin only) ─────────
                    if (isGroupAdmin)
                      _DisappearingSection(
                        groupId: detail.id,
                        currentSeconds: detail.disappearingDurationSeconds,
                        svc: ref.read(chatGroupsServiceProvider),
                        onChanged: () => ref.invalidate(chatGroupDetailProvider(detail.id)),
                      ),
                    if (isGroupAdmin) const SizedBox(height: 20),
                    // ── Members ───────────────────────────────────────────
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8, left: 4),
                      child: Text(
                        '${detail.members.length} member${detail.members.length == 1 ? "" : "s"}'.toUpperCase(),
                        style: TextStyle(
                          color: tokens.textMuted,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ),
                    ...detail.members.map((m) {
                      final online = presenceMap[m.id] == true;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: tokens.bgInput,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Stack(children: [
                              _Avatar(url: m.profilePhotoUrl, name: m.displayName, size: 34),
                              if (online)
                                Positioned(
                                  right: 0,
                                  bottom: 0,
                                  child: Container(
                                    width: 10,
                                    height: 10,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF22C55E),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: tokens.bgSurface, width: 1.5),
                                    ),
                                  ),
                                ),
                            ]),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(m.displayName, style: TextStyle(color: tokens.textPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
                                  Text(
                                    online ? 'Online' : 'Offline',
                                    style: TextStyle(color: tokens.textMuted, fontSize: 10),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 20),
                    OutlinedButton.icon(
                      onPressed: onLeave,
                      icon: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444)),
                      label: const Text('Leave group', style: TextStyle(color: Color(0xFFEF4444))),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(44),
                        side: const BorderSide(color: Color(0xFFEF4444)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ── Media preview strip (F-15) ────────────────────────────────────────────────

class _MediaPreviewSection extends StatefulWidget {
  const _MediaPreviewSection({
    required this.groupId,
    required this.groupName,
    required this.svc,
  });
  final String groupId;
  final String groupName;
  final ChatGroupsService svc;

  @override
  State<_MediaPreviewSection> createState() => _MediaPreviewSectionState();
}

class _MediaPreviewSectionState extends State<_MediaPreviewSection> {
  late final Future<List<ChatGroupMediaItem>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.svc.listGroupMedia(widget.groupId, limit: 6);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return FutureBuilder<List<ChatGroupMediaItem>>(
      future: _future,
      builder: (ctx, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const SizedBox(
            height: 72,
            child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: kColorAccent)),
          );
        }
        final items = snap.data ?? const [];
        if (items.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 4, bottom: 8),
                  child: Text(
                    'MEDIA',
                    style: TextStyle(
                      color: tokens.textMuted,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () => Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (_) => ChatGroupMediaGalleryScreen(
                        groupId: widget.groupId,
                        groupName: widget.groupName,
                      ),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 8, right: 4),
                    child: Text(
                      'See all',
                      style: const TextStyle(color: kColorAccent, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding: EdgeInsets.zero,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 3,
                mainAxisSpacing: 3,
              ),
              itemCount: items.length,
              itemBuilder: (_, i) {
                final item = items[i];
                return GestureDetector(
                  onTap: () => Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (_) => ChatGroupMediaGalleryScreen(
                        groupId: widget.groupId,
                        groupName: widget.groupName,
                        initialType: item.mediaType,
                      ),
                    ),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: _MediaThumb(item: item),
                  ),
                );
              },
            ),
          ],
        );
      },
    );
  }
}

class _MediaThumb extends StatelessWidget {
  const _MediaThumb({required this.item});
  final ChatGroupMediaItem item;

  @override
  Widget build(BuildContext context) {
    if (item.mediaType == 'image') {
      return CachedNetworkImage(
        imageUrl: item.mediaUrl,
        fit: BoxFit.cover,
        errorWidget: (_, __, ___) => Container(
          color: const Color(0xFF1a1a1a),
          child: const Icon(Icons.broken_image_outlined, color: Colors.white24, size: 20),
        ),
      );
    }
    return Container(
      color: const Color(0xFF1a1a1a),
      child: Icon(
        item.mediaType == 'video'
            ? Icons.play_circle_outline_rounded
            : item.mediaType == 'audio'
                ? Icons.audio_file_outlined
                : Icons.insert_drive_file_outlined,
        color: Colors.white38,
        size: 24,
      ),
    );
  }
}

// ── Disappearing messages section (F-18) ─────────────────────────────────────

class _DisappearingSection extends StatefulWidget {
  const _DisappearingSection({
    required this.groupId,
    required this.currentSeconds,
    required this.svc,
    required this.onChanged,
  });
  final String groupId;
  final int? currentSeconds;
  final ChatGroupsService svc;
  final VoidCallback onChanged;

  @override
  State<_DisappearingSection> createState() => _DisappearingSectionState();
}

class _DisappearingSectionState extends State<_DisappearingSection> {
  bool _loading = false;

  static const _options = [
    (label: 'Off', seconds: null as int?),
    (label: '5 minutes', seconds: 300 as int?),
    (label: '1 hour', seconds: 3600 as int?),
    (label: '1 day', seconds: 86400 as int?),
    (label: '7 days', seconds: 604800 as int?),
  ];

  String get _currentLabel {
    for (final opt in _options) {
      if (opt.seconds == widget.currentSeconds) return opt.label;
    }
    if (widget.currentSeconds == null) return 'Off';
    final s = widget.currentSeconds!;
    if (s < 3600) return '${(s / 60).round()} min';
    if (s < 86400) return '${(s / 3600).round()} h';
    return '${(s / 86400).round()} days';
  }

  Future<void> _pick() async {
    final tokens = context.tokens;
    final chosen = await showModalBottomSheet<int?>(
      context: context,
      backgroundColor: tokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(width: 40, height: 4,
                decoration: BoxDecoration(color: tokens.borderCard, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 12),
            for (final opt in _options)
              ListTile(
                title: Text(opt.label, style: TextStyle(color: tokens.textPrimary, fontSize: 14)),
                trailing: widget.currentSeconds == opt.seconds
                    ? const Icon(Icons.check_rounded, color: kColorAccent, size: 18)
                    : null,
                onTap: () => Navigator.pop(context, opt.seconds ?? -1),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (chosen == null) return;
    final dur = chosen == -1 ? null : chosen;
    setState(() => _loading = true);
    try {
      await widget.svc.setDisappearing(widget.groupId, durationSeconds: dur);
      widget.onChanged();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update setting')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8, left: 4),
          child: Text(
            'DISAPPEARING MESSAGES',
            style: TextStyle(
              color: tokens.textMuted,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
            ),
          ),
        ),
        InkWell(
          onTap: _loading ? null : _pick,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: tokens.bgInput,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.timer_outlined, size: 18, color: kColorAccent),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _currentLabel,
                    style: TextStyle(color: tokens.textPrimary, fontSize: 14),
                  ),
                ),
                if (_loading)
                  const SizedBox(width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: kColorAccent))
                else
                  Icon(Icons.chevron_right_rounded, color: tokens.textMuted, size: 20),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.url, required this.name, this.size = 40});
  final String? url;
  final String name;
  final double size;
  @override
  Widget build(BuildContext context) {
    if (url != null && url!.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: url!,
          width: size,
          height: size,
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
      width: size,
      height: size,
      decoration: const BoxDecoration(color: kColorAccent, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: TextStyle(color: Colors.white, fontSize: size * 0.42, fontWeight: FontWeight.w700),
      ),
    );
  }
}

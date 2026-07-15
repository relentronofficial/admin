import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/models/notification_item.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../providers/notifications_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
// ── Route resolver ────────────────────────────────────────────────────────────

String _resolveNotificationRoute(NotificationItem n) {
  if (n.actionUrl != null && n.actionUrl!.isNotEmpty) return n.actionUrl!;

  final m = n.metadata ?? {};
  switch (n.type) {
    case 'course_access_granted':
      final id = m['courseId'] as String?;
      return id != null ? '/learning/$id' : '/learning';
    case 'batch_day_approved':
      final day = m['dayNumber'];
      return day != null ? '/batch-program/$day' : '/batch-program';
    case 'workshop_enrolled':
      final id = m['workshopId'] as String?;
      return id != null ? '/workshops/$id' : '/workshops';
    case 'live_call':
      final id = m['webinarId'] as String?;
      return id != null ? '/live/$id' : '/dashboard';
    case 'message':
      final id = m['conversationId'] as String?;
      return id != null ? '/messages/$id' : '/messages';
    default:
      return '/dashboard';
  }
}

// ── Relative time ─────────────────────────────────────────────────────────────

String _timeAgo(String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return '';
  final diff = DateTime.now().difference(dt);
  if (diff.inSeconds < 60) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return '${(diff.inDays / 7).floor()}w ago';
}

// ── Date grouping ─────────────────────────────────────────────────────────────

enum _DateGroup { today, yesterday, thisWeek, older }

String _dateGroupLabel(_DateGroup g) => switch (g) {
      _DateGroup.today => 'Today',
      _DateGroup.yesterday => 'Yesterday',
      _DateGroup.thisWeek => 'This Week',
      _DateGroup.older => 'Older',
    };

_DateGroup _getDateGroup(String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return _DateGroup.older;
  final diff = DateTime.now().difference(dt).inDays;
  if (diff == 0) return _DateGroup.today;
  if (diff == 1) return _DateGroup.yesterday;
  if (diff < 7) return _DateGroup.thisWeek;
  return _DateGroup.older;
}

List<({_DateGroup group, List<NotificationItem> items})> _groupByDate(
    List<NotificationItem> items) {
  final map = <_DateGroup, List<NotificationItem>>{};
  for (final g in _DateGroup.values) {
    map[g] = [];
  }
  for (final n in items) {
    map[_getDateGroup(n.createdAt)]!.add(n);
  }
  return _DateGroup.values
      .where((g) => map[g]!.isNotEmpty)
      .map((g) => (group: g, items: map[g]!))
      .toList();
}

// ── Icon config ───────────────────────────────────────────────────────────────

({IconData icon, Color color}) _iconConfig(String? iconType) =>
    switch (iconType) {
      'video' => (icon: Icons.play_circle_outline, color: const Color(0xFFdc2626)),
      'assignment' => (icon: Icons.assignment_outlined, color: const Color(0xFFf59e0b)),
      'live_call' => (icon: Icons.videocam_outlined, color: const Color(0xFF3b82f6)),
      'achievement' => (icon: Icons.emoji_events_outlined, color: const Color(0xFFeab308)),
      'announcement' => (icon: Icons.campaign_outlined, color: const Color(0xFF8b5cf6)),
      'system' => (icon: Icons.settings_outlined, color: const Color(0xFF6b7280)),
      _ => (icon: Icons.notifications_outlined, color: const Color(0xFF6b7280)),
    };

// ── Screen ────────────────────────────────────────────────────────────────────

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  final _scrollCtrl = ScrollController();
  var _loadingMore = false;
  var _unreadOnly = false;

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_loadingMore) return;
    if (_scrollCtrl.position.extentAfter < 200) {
      _fetchMore();
    }
  }

  Future<void> _fetchMore() async {
    final notifier = ref.read(notificationsNotifierProvider.notifier);
    if (!notifier.hasMore) return;
    setState(() => _loadingMore = true);
    await notifier.fetchMore();
    if (mounted) setState(() => _loadingMore = false);
  }

  Future<void> _onRefresh() async {
    ref.invalidate(notificationsNotifierProvider);
    await ref
        .read(notificationsNotifierProvider.future)
        .catchError((_) => <NotificationItem>[]);
  }

  void _handleTap(NotificationItem n) {
    if (!n.isRead) {
      ref.read(notificationsNotifierProvider.notifier).markRead(n.id);
    }
    // `push` so pressing back returns to the notification list rather than
    // exiting the app.
    context.push(_resolveNotificationRoute(n));
  }

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    final notifAsync = ref.watch(notificationsNotifierProvider);
    // Global unread count from /unread-count endpoint (matches web behaviour —
    // web's header shows total unread across all pages, not just the loaded page).
    final globalUnread = ref.watch(unreadNotifCountNotifierProvider);
    final hasRead = notifAsync.valueOrNull?.any((n) => n.isRead) == true;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        automaticallyImplyLeading: false,
        title: Text(
          'NOTIFICATIONS',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 18,
            fontWeight: FontWeight.w700,
            letterSpacing: 2,
            color: context.tokens.textPrimary,
          ),
        ),
        actions: [
          if (hasRead)
            TextButton(
              onPressed: () => ref
                  .read(notificationsNotifierProvider.notifier)
                  .clearRead(),
              child: Text(
                'Clear read',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: context.tokens.textSecondary,
                ),
              ),
            ),
          TextButton(
            onPressed: globalUnread > 0
                ? () => ref.read(notificationsNotifierProvider.notifier).markAllRead()
                : null,
            child: Text(
              'Mark all read',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: globalUnread > 0 ? accent : context.tokens.textMuted,
              ),
            ),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: notifAsync.when(
        loading: () => _buildSkeleton(context),
        error: (e, _) => _buildError(
            context, () => ref.invalidate(notificationsNotifierProvider)),
        data: (allItems) {
          final items = _unreadOnly
              ? allItems.where((n) => !n.isRead).toList()
              : allItems;
          return Column(
            children: [
              _FilterStrip(
                unreadOnly: _unreadOnly,
                unreadCount: globalUnread,
                onChanged: (v) => setState(() => _unreadOnly = v),
                accent: accent,
              ),
              Expanded(child: _buildContent(context, items, accent)),
            ],
          );
        },
      ),
    );
  }

  Widget _buildContent(
      BuildContext context, List<NotificationItem> items, Color accent) {
    if (items.isEmpty) return _buildEmpty(context);
    final groups = _groupByDate(items);
    return _buildList(context, groups, accent);
  }

  Widget _buildList(
    BuildContext context,
    List<({_DateGroup group, List<NotificationItem> items})> groups,
    Color accent,
  ) {
    return RefreshIndicator(
      color: accent,
      backgroundColor: context.tokens.bgSurface,
      onRefresh: _onRefresh,
      child: ListView.builder(
        controller: _scrollCtrl,
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        itemCount: _groupCount(groups) + (_loadingMore ? 1 : 0),
        itemBuilder: (context, index) =>
            _buildListItem(context, groups, index, accent),
      ),
    );
  }

  // ── Flatten groups → mixed header+card list ────────────────────────────────

  int _groupCount(
      List<({_DateGroup group, List<NotificationItem> items})> groups) {
    return groups.fold(0, (sum, g) => sum + 1 + g.items.length);
  }

  Widget _buildListItem(
    BuildContext context,
    List<({_DateGroup group, List<NotificationItem> items})> groups,
    int index,
    Color accent,
  ) {
    var cursor = 0;
    for (final g in groups) {
      if (index == cursor) {
        return _SectionHeader(label: _dateGroupLabel(g.group));
      }
      cursor++;
      for (final n in g.items) {
        if (index == cursor) {
          return Dismissible(
            key: ValueKey('notif-${n.id}'),
            direction: DismissDirection.endToStart,
            background: Container(
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              margin: const EdgeInsets.symmetric(vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFdc2626),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.delete_outline, color: Colors.white),
            ),
            onDismissed: (_) => ref
                .read(notificationsNotifierProvider.notifier)
                .dismiss(n.id),
            child: _NotifCard(
              notification: n,
              accent: accent,
              onTap: () => _handleTap(n),
            ),
          );
        }
        cursor++;
      }
    }
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}

// ── Filter strip (All / Unread) ───────────────────────────────────────────────

class _FilterStrip extends StatelessWidget {
  const _FilterStrip({
    required this.unreadOnly,
    required this.unreadCount,
    required this.onChanged,
    required this.accent,
  });

  final bool unreadOnly;
  final int unreadCount;
  final ValueChanged<bool> onChanged;
  final Color accent;

  Widget _tab(BuildContext context, String label, bool active,
      VoidCallback onTap,
      {int? badge}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: active ? accent.withValues(alpha: 0.15) : context.tokens.bgInput,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? accent : context.tokens.borderCard,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                color: active ? accent : context.tokens.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
                fontFamily: 'Rajdhani',
              ),
            ),
            if (badge != null && badge > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: active ? accent : context.tokens.textMuted,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '$badge',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          _tab(context, 'All', !unreadOnly, () => onChanged(false)),
          const SizedBox(width: 8),
          _tab(context, 'Unread', unreadOnly, () => onChanged(true),
              badge: unreadCount),
        ],
      ),
    );
  }
}

// ── Section header ─────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 20, bottom: 8, left: 2),
        child: Text(
          label.toUpperCase(),
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 2,
            color: context.tokens.textMuted,
          ),
        ),
      );
}

// ── Notification card ─────────────────────────────────────────────────────────

class _NotifCard extends StatelessWidget {
  const _NotifCard({
    required this.notification,
    required this.accent,
    required this.onTap,
  });

  final NotificationItem notification;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final n = notification;
    final cfg = _iconConfig(n.iconType);
    final isUnread = !n.isRead;

    final bg = isUnread
        ? Color.alphaBlend(accent.withAlpha(13), context.tokens.bgSurface)
        : context.tokens.bgSurface;
    final borderColor = isUnread ? accent.withAlpha(64) : context.tokens.borderCard;

    return Semantics(
      label: '${n.title}: ${n.body}${isUnread ? ', unread' : ''}',
      button: true,
      child: GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(color: borderColor),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: cfg.color.withAlpha(30),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(cfg.icon, color: cfg.color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    n.title,
                    style: TextStyle(
                      color: context.tokens.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    n.body,
                    style: TextStyle(
                      color: context.tokens.textSecondary,
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                  if (n.mediaType == 'image' && n.mediaUrl != null) ...[
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        n.mediaUrl!,
                        height: 140,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                      ),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      if (isUnread) ...[
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: accent,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                      ],
                      Text(
                        _timeAgo(n.createdAt),
                        style: TextStyle(
                          color: context.tokens.textMuted,
                          fontSize: 11,
                        ),
                      ),
                      if (n.actionUrl != null && n.actionUrl!.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Text(
                          'View →',
                          style: TextStyle(
                            color: accent,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

Widget _buildSkeleton(BuildContext context) => ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      itemCount: 6,
      itemBuilder: (_, __) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          border: Border.all(color: context.tokens.borderCard),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: context.tokens.bgInput,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(height: 13, width: 180, color: context.tokens.bgInput),
                  const SizedBox(height: 6),
                  Container(height: 11, width: double.infinity, color: context.tokens.bgInput),
                  const SizedBox(height: 4),
                  Container(height: 11, width: 120, color: context.tokens.bgInput),
                ],
              ),
            ),
          ],
        ),
      ),
    );

// ── Error state ───────────────────────────────────────────────────────────────

Widget _buildError(BuildContext context, VoidCallback onRetry) => Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline, color: context.tokens.textMuted, size: 40),
          const SizedBox(height: 12),
          Text(
            'Failed to load notifications',
            style: TextStyle(color: context.tokens.textSecondary),
          ),
          const SizedBox(height: 12),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );

// ── Empty state ───────────────────────────────────────────────────────────────

Widget _buildEmpty(BuildContext context) => Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.notifications_none_outlined, color: context.tokens.textMuted, size: 48),
          const SizedBox(height: 12),
          Text(
            'No notifications yet',
            style: TextStyle(
              color: context.tokens.textSecondary,
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            "You're all caught up!",
            style: TextStyle(color: context.tokens.textMuted, fontSize: 13),
          ),
        ],
      ),
    );

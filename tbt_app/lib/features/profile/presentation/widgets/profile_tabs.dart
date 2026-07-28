import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../shared/theme/theme_tokens.dart';
import '../../data/profile_extras_service.dart';

/// Segmented tab bar (Business / My Wins / Trophies) + the three bodies.
///
/// Uses TabController inline since the profile page never rebuilds the
/// tab shell — the container is stable across profile refreshes. Tab
/// bodies are self-contained; they read their own providers.
class ProfileTabs extends StatefulWidget {
  const ProfileTabs({
    super.key,
    required this.rawProfile,
    required this.onEditBusiness,
  });

  final Map<String, dynamic> rawProfile;
  final VoidCallback onEditBusiness;

  @override
  State<ProfileTabs> createState() => _ProfileTabsState();
}

class _ProfileTabsState extends State<ProfileTabs>
    with SingleTickerProviderStateMixin {
  late final TabController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TabController(length: 3, vsync: this);
    _ctrl.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      children: [
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: tokens.bgInput,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: tokens.borderCard),
          ),
          child: TabBar(
            controller: _ctrl,
            indicator: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              borderRadius: BorderRadius.circular(9),
            ),
            indicatorSize: TabBarIndicatorSize.tab,
            indicatorPadding: EdgeInsets.zero,
            dividerColor: Colors.transparent,
            labelColor: Colors.white,
            unselectedLabelColor: tokens.textMuted,
            labelStyle: const TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.0,
            ),
            tabs: const [
              Tab(text: 'BUSINESS'),
              Tab(text: 'MY WINS'),
              Tab(text: 'TROPHIES'),
            ],
          ),
        ),
        const SizedBox(height: 14),
        IndexedStack(
          index: _ctrl.index,
          children: [
            _BusinessTab(
              rawProfile: widget.rawProfile,
              onEdit: widget.onEditBusiness,
            ),
            const _MyWinsTab(),
            _TrophiesTab(rawProfile: widget.rawProfile),
          ],
        ),
      ],
    );
  }
}

class _BusinessTab extends StatelessWidget {
  const _BusinessTab({required this.rawProfile, required this.onEdit});

  final Map<String, dynamic> rawProfile;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final businessName = (rawProfile['businessName'] as String?) ?? '';
    final industry = (rawProfile['industry'] as String?) ??
        (rawProfile['businessType'] as String?) ??
        '';
    final teamSize = (rawProfile['teamSize'] as String?) ?? '';
    final registeredOffice = (rawProfile['registeredOffice'] as String?) ??
        (rawProfile['businessAddress'] as String?) ??
        '';
    final target = (rawProfile['targetNetworkDescription'] as String?) ?? '';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: tokens.borderCard),
        ),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'BUSINESS OVERVIEW',
                  style: TextStyle(
                    fontFamily: 'Rajdhani',
                    color: tokens.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.8,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: onEdit,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.edit_outlined,
                        size: 14,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'EDIT',
                        style: TextStyle(
                          fontFamily: 'Rajdhani',
                          color: Theme.of(context).colorScheme.primary,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _kv(context, 'Company Name', businessName.isEmpty ? '—' : businessName),
            _kv(context, 'Industry', industry.isEmpty ? '—' : industry),
            _kv(context, 'Team Size', teamSize.isEmpty ? '—' : teamSize),
            _kv(context, 'Registered Office',
                registeredOffice.isEmpty ? '—' : registeredOffice),
            const SizedBox(height: 8),
            Divider(color: tokens.borderCard, height: 1),
            const SizedBox(height: 12),
            Text(
              'TARGET NETWORK',
              style: TextStyle(
                fontFamily: 'Rajdhani',
                color: tokens.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.8,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              target.isEmpty
                  ? 'Add a short description of the members and industries you\'d most like to connect with.'
                  : target,
              style: TextStyle(
                color: target.isEmpty ? tokens.textMuted : tokens.textPrimary,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _kv(BuildContext context, String label, String value) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(color: tokens.textMuted, fontSize: 12),
            ),
          ),
          Expanded(
            child: Text(
              value,
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
}

class _MyWinsTab extends ConsumerWidget {
  const _MyWinsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(myPostsProvider);
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
      error: (_, __) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: tokens.bgSurface,
            border: Border.all(color: tokens.borderCard),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            'Could not load your wins. Pull to refresh.',
            style: TextStyle(color: tokens.textSecondary, fontSize: 13),
          ),
        ),
      ),
      data: (posts) {
        if (posts.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: tokens.bgSurface,
                border: Border.all(color: tokens.borderCard),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.rocket_launch_rounded,
                    color: Theme.of(context).colorScheme.primary,
                    size: 28,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Share your first win!',
                          style: TextStyle(
                            color: tokens.textPrimary,
                            fontFamily: 'Rajdhani',
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Post to the community from the home page.',
                          style: TextStyle(
                            color: tokens.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        }
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: [
              for (final p in posts) ...[
                _WinCard(post: p),
                const SizedBox(height: 10),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _WinCard extends StatelessWidget {
  const _WinCard({required this.post});
  final MyWinPost post;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        border: Border.all(color: tokens.borderCard),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                DateFormat.yMMMd().format(post.createdAt),
                style: TextStyle(color: tokens.textMuted, fontSize: 11),
              ),
              const Spacer(),
              if (!post.isApproved)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'PENDING',
                    style: TextStyle(
                      color: Color(0xFFF59E0B),
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            post.content,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: tokens.textPrimary,
              fontSize: 13.5,
              height: 1.4,
            ),
          ),
          if (post.mediaUrls.isNotEmpty) ...[
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: CachedNetworkImage(
                imageUrl: post.mediaUrls.first,
                height: 140,
                width: double.infinity,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => Container(
                  height: 140,
                  color: tokens.bgInput,
                ),
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(Icons.favorite, size: 13, color: tokens.textMuted),
              const SizedBox(width: 4),
              Text('${post.likeCount}',
                  style: TextStyle(color: tokens.textMuted, fontSize: 11)),
              const SizedBox(width: 14),
              Icon(Icons.mode_comment, size: 13, color: tokens.textMuted),
              const SizedBox(width: 4),
              Text('${post.commentCount}',
                  style: TextStyle(color: tokens.textMuted, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}

class _TrophiesTab extends StatelessWidget {
  const _TrophiesTab({required this.rawProfile});
  final Map<String, dynamic> rawProfile;

  Color? _parse(String? hex) {
    if (hex == null) return null;
    var s = hex.replaceFirst('#', '');
    if (s.length == 6) s = 'FF$s';
    if (s.length != 8) return null;
    final v = int.tryParse(s, radix: 16);
    return v == null ? null : Color(v);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final list = (rawProfile['badges'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
    if (list.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: tokens.bgSurface,
            border: Border.all(color: tokens.borderCard),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Icon(Icons.emoji_events_outlined,
                  color: tokens.textMuted, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('No trophies yet',
                        style: TextStyle(
                          color: tokens.textPrimary,
                          fontFamily: 'Rajdhani',
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        )),
                    const SizedBox(height: 2),
                    Text(
                      'Earn badges by completing courses, workshops, and challenges.',
                      style: TextStyle(color: tokens.textMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: list.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.2,
        ),
        itemBuilder: (_, i) {
          final b = list[i];
          final label = (b['label'] as String?) ?? '';
          final fg = _parse(b['color'] as String?) ?? tokens.textPrimary;
          final bg = _parse(b['bgColor'] as String?) ??
              tokens.textMuted.withValues(alpha: 0.12);
          return GestureDetector(
            onTap: () => _openDetail(context, label),
            child: Container(
              decoration: BoxDecoration(
                color: tokens.bgSurface,
                border: Border.all(color: tokens.borderCard),
                borderRadius: BorderRadius.circular(14),
              ),
              padding: const EdgeInsets.all(14),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
                    child: Icon(Icons.emoji_events_rounded, color: fg, size: 22),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    label,
                    maxLines: 2,
                    textAlign: TextAlign.center,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: tokens.textPrimary,
                      fontFamily: 'Rajdhani',
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.4,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _openDetail(BuildContext context, String label) {
    showDialog<void>(
      context: context,
      builder: (ctx) {
        final tokens = ctx.tokens;
        return AlertDialog(
          backgroundColor: tokens.bgModal,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          title: Row(
            children: [
              Icon(Icons.emoji_events_rounded,
                  color: Theme.of(ctx).colorScheme.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(color: tokens.textPrimary, fontSize: 16),
                ),
              ),
            ],
          ),
          content: Text(
            'Earned badge. Keep contributing to the community to unlock more.',
            style: TextStyle(color: tokens.textSecondary, fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Close',
                  style:
                      TextStyle(color: Theme.of(ctx).colorScheme.primary)),
            ),
          ],
        );
      },
    );
  }
}

import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../data/profile_extras_service.dart';

/// Segmented tab bar (Business / My Wins / Trophies) + three bodies.
/// Styled to match co-worker: pill-in-container indicator, no divider,
/// crimson selected pill, uppercase bold label, dark card wrapper.
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
  static const _accent = Color(0xFFD30814);

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

  Color _cardBg(BuildContext c) =>
      Theme.of(c).brightness == Brightness.dark
          ? const Color(0xFF141416)
          : Colors.white;
  Color _borderCol(BuildContext c) =>
      Theme.of(c).brightness == Brightness.dark
          ? const Color(0xFF232326)
          : const Color(0xFFE5E5EA);
  Color _text(BuildContext c) => Theme.of(c).brightness == Brightness.dark
      ? Colors.white
      : Colors.black;
  Color _subText(BuildContext c) => _text(c).withValues(alpha: 0.6);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          height: 48,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: _cardBg(context),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _borderCol(context)),
          ),
          child: TabBar(
            controller: _ctrl,
            indicator: BoxDecoration(
              color: _accent,
              borderRadius: BorderRadius.circular(12),
            ),
            indicatorSize: TabBarIndicatorSize.tab,
            indicatorPadding: EdgeInsets.zero,
            dividerColor: Colors.transparent,
            labelColor: Colors.white,
            unselectedLabelColor: _subText(context),
            labelStyle: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
            ),
            unselectedLabelStyle: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
            tabs: const [
              Tab(text: 'Business'),
              Tab(text: 'My Wins'),
              Tab(text: 'Trophies'),
            ],
          ),
        ),
        const SizedBox(height: 16),
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

  static const _accent = Color(0xFFD30814);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF141416) : Colors.white;
    final border = isDark ? const Color(0xFF232326) : const Color(0xFFE5E5EA);
    final text = isDark ? Colors.white : Colors.black;
    final subText = text.withValues(alpha: 0.6);

    final businessName = (rawProfile['businessName'] as String?)?.trim() ?? '';
    final industry = (rawProfile['industry'] as String?)?.trim() ??
        (rawProfile['businessType'] as String?)?.trim() ??
        '';
    final teamSize = (rawProfile['teamSize'] as String?)?.trim() ?? '';
    final office = (rawProfile['registeredOffice'] as String?)?.trim() ??
        (rawProfile['businessAddress'] as String?)?.trim() ??
        '';
    final target =
        (rawProfile['targetNetworkDescription'] as String?)?.trim() ?? '';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Company Overview',
                style: TextStyle(
                  color: text,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Spacer(),
              InkWell(
                onTap: onEdit,
                child: Row(
                  children: [
                    const Icon(Icons.edit_note_rounded,
                        color: _accent, size: 18),
                    const SizedBox(width: 4),
                    const Text(
                      'EDIT',
                      style: TextStyle(
                        color: _accent,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _row(context, Icons.business_rounded, 'Company Name',
              businessName.isEmpty ? '—' : businessName),
          _row(context, Icons.category_rounded, 'Industry',
              industry.isEmpty ? '—' : industry),
          _row(context, Icons.people_rounded, 'Team Size',
              teamSize.isEmpty ? '—' : teamSize),
          _row(context, Icons.location_on_rounded, 'Registered Office',
              office.isEmpty ? '—' : office),
          const SizedBox(height: 8),
          Divider(height: 24, color: border),
          Text(
            'Target Network',
            style: TextStyle(
              color: text,
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            target.isEmpty
                ? 'Add a short description of the members and industries you\'d most like to connect with.'
                : target,
            style: TextStyle(
              color: target.isEmpty ? subText : subText,
              fontSize: 13,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(
    BuildContext context,
    IconData icon,
    String label,
    String value,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = isDark ? Colors.white : Colors.black;
    final subText = text.withValues(alpha: 0.6);
    final tileBg =
        isDark ? const Color(0xFF1C1C1E) : const Color(0xFFE5E5EA);
    final iconColor =
        isDark ? Colors.white.withValues(alpha: 0.7) : Colors.black87;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: tileBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    color: subText,
                    fontSize: 10.5,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    color: text,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MyWinsTab extends ConsumerWidget {
  const _MyWinsTab();

  static const _accent = Color(0xFFD30814);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF141416) : Colors.white;
    final border = isDark ? const Color(0xFF232326) : const Color(0xFFE5E5EA);
    final text = isDark ? Colors.white : Colors.black;
    final subText = text.withValues(alpha: 0.6);

    final async = ref.watch(myPostsProvider);
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
      error: (_, __) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: cardBg,
          border: Border.all(color: border),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          'Could not load your wins. Pull to refresh.',
          style: TextStyle(color: subText, fontSize: 13),
        ),
      ),
      data: (posts) {
        if (posts.isEmpty) {
          return Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: cardBg,
              border: Border.all(color: border),
              borderRadius: BorderRadius.circular(24),
            ),
            child: Row(
              children: [
                Icon(Icons.rocket_launch_rounded,
                    color: _accent, size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Share your first win!',
                        style: TextStyle(
                          color: text,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Post to the community from the home page.',
                        style: TextStyle(color: subText, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }
        return Column(
          children: [
            for (final p in posts) ...[
              _WinCard(
                post: p,
                cardBg: cardBg,
                border: border,
                text: text,
                subText: subText,
              ),
              const SizedBox(height: 12),
            ],
          ],
        );
      },
    );
  }
}

class _WinCard extends StatelessWidget {
  const _WinCard({
    required this.post,
    required this.cardBg,
    required this.border,
    required this.text,
    required this.subText,
  });
  final MyWinPost post;
  final Color cardBg;
  final Color border;
  final Color text;
  final Color subText;

  static const _accent = Color(0xFFD30814);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardBg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  post.content.split('\n').first,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: text,
                    fontSize: 14.5,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                DateFormat.MMMd().format(post.createdAt),
                style: TextStyle(color: subText, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            post.content,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: text.withValues(alpha: 0.85),
              fontSize: 13,
              height: 1.35,
            ),
          ),
          Divider(height: 24, color: border),
          Row(
            children: [
              const Icon(Icons.thumb_up_alt_rounded,
                  color: _accent, size: 14),
              const SizedBox(width: 6),
              Text(
                '${post.likeCount} support reactions',
                style: TextStyle(
                  color: subText,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (!post.isApproved) ...[
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6, vertical: 2),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF141416) : Colors.white;
    final border = isDark ? const Color(0xFF232326) : const Color(0xFFE5E5EA);
    final text = isDark ? Colors.white : Colors.black;
    final subText = text.withValues(alpha: 0.6);

    final list = (rawProfile['badges'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
    if (list.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: cardBg,
          border: Border.all(color: border),
          borderRadius: BorderRadius.circular(24),
        ),
        child: Row(
          children: [
            Icon(Icons.emoji_events_outlined, color: subText, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('No trophies yet',
                      style: TextStyle(
                          color: text,
                          fontSize: 15,
                          fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(
                    'Earn badges by completing courses, workshops, and challenges.',
                    style: TextStyle(color: subText, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: list.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.1,
      ),
      itemBuilder: (_, i) {
        final b = list[i];
        final label = (b['label'] as String?) ?? '';
        final fg = _parse(b['color'] as String?) ?? const Color(0xFFFFD97D);
        return InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => _openDetail(context, label, fg),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: fg.withValues(alpha: 0.2)),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: fg.withValues(alpha: 0.10),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.emoji_events_rounded, color: fg, size: 26),
                ),
                const SizedBox(height: 12),
                Text(
                  label,
                  maxLines: 2,
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: text,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Tap details',
                  style: TextStyle(color: subText, fontSize: 10),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _openDetail(BuildContext context, String label, Color color) {
    showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Trophy',
      barrierColor: Colors.black.withValues(alpha: 0.55),
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, _, __) {
        return BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Center(
            child: Dialog(
              backgroundColor: const Color(0xFF0F0F11),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.10),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: color.withValues(alpha: 0.30),
                          width: 1.5,
                        ),
                      ),
                      child: Icon(Icons.emoji_events_rounded,
                          color: color, size: 48),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Awarded for outstanding contribution to the community.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Color(0xFF8E8E93),
                        fontSize: 13.5,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF1C1C1E),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF2C2C2E)),
                      ),
                      child: TextButton(
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 24, vertical: 12),
                        ),
                        onPressed: () => Navigator.of(ctx).pop(),
                        child: const Text(
                          'Close',
                          style: TextStyle(color: Colors.white),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

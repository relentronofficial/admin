import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/routes.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../providers/me_provider.dart';
import '../providers/site_config_provider.dart';
import 'app_logo.dart';

/// Glassmorphic left drawer — direct port of co-worker's `TbtAppDrawer`
/// (main.dart:689–1112).
///
/// Behavior:
///   * Full-height glass backdrop (sigma 22) with a 3 px red gradient
///     accent strip on the left edge.
///   * Header slides in from left + fades in (420 ms easeOutCubic).
///   * 10 nav items enter with a 55 ms stagger between each, followed
///     by the logout footer (index 10).
///   * Each item is a `_TbtDrawerItem` with press-scale-to-0.94 (120 ms).
class TbtAppDrawer extends ConsumerStatefulWidget {
  const TbtAppDrawer({super.key});

  @override
  ConsumerState<TbtAppDrawer> createState() => _TbtAppDrawerState();
}

class _TbtAppDrawerState extends ConsumerState<TbtAppDrawer>
    with TickerProviderStateMixin {
  static const int _itemCount = 12; // 11 nav items (incl. Support) + 1 logout

  late final AnimationController _headerCtrl;
  late final Animation<double> _headerFade;
  late final Animation<Offset> _headerSlide;
  late final List<AnimationController> _itemCtrls;
  late final List<Animation<double>> _itemFades;
  late final List<Animation<Offset>> _itemSlides;

  @override
  void initState() {
    super.initState();

    _headerCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _headerFade = CurvedAnimation(parent: _headerCtrl, curve: Curves.easeOut);
    _headerSlide = Tween<Offset>(
      begin: const Offset(-0.3, 0),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _headerCtrl, curve: Curves.easeOutCubic));

    _itemCtrls = List.generate(
      _itemCount,
      (_) => AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 380),
      ),
    );
    _itemFades = _itemCtrls
        .map((c) => CurvedAnimation(parent: c, curve: Curves.easeOut))
        .toList();
    _itemSlides = _itemCtrls
        .map((c) => Tween<Offset>(
              begin: const Offset(-0.25, 0),
              end: Offset.zero,
            ).animate(
              CurvedAnimation(parent: c, curve: Curves.easeOutCubic),
            ))
        .toList();

    _runSequence();
  }

  Future<void> _runSequence() async {
    await Future.delayed(const Duration(milliseconds: 80));
    if (!mounted) return;
    _headerCtrl.forward();
    for (int i = 0; i < _itemCount; i++) {
      await Future.delayed(const Duration(milliseconds: 55));
      if (!mounted) return;
      _itemCtrls[i].forward();
    }
  }

  @override
  void dispose() {
    _headerCtrl.dispose();
    for (final c in _itemCtrls) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subTextColor = isDark ? Colors.white60 : Colors.black54;
    final dividerColor = isDark
        ? Colors.white.withValues(alpha: 0.08)
        : Colors.black.withValues(alpha: 0.08);

    final me = ref.watch(meNotifierProvider).valueOrNull;
    final name = ((me as dynamic)?.name as String?)?.trim() ?? 'Member';
    final photoUrl = (me as dynamic)?.avatarUrl as String?;
    final hiddenMenuKeys = ref.watch(navConfigNotifierProvider).valueOrNull?.hiddenMenuKeys ?? const <String>[];

    Widget animItem(int idx, Widget child) => FadeTransition(
          opacity: _itemFades[idx],
          child: SlideTransition(position: _itemSlides[idx], child: child),
        );

    return Drawer(
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: Stack(
        children: [
          // Glassmorphic backdrop
          Positioned.fill(
            child: ClipRRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
                child: Container(
                  decoration: BoxDecoration(
                    color: isDark
                        ? const Color(0xFF0A0A0C).withValues(alpha: 0.93)
                        : Colors.white.withValues(alpha: 0.94),
                    border: Border(
                      right: BorderSide(color: dividerColor, width: 1.5),
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Red accent gradient strip on left edge
          Positioned(
            top: 0,
            bottom: 0,
            left: 0,
            width: 3,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFFE50914),
                    Color(0xFF8B0000),
                    Color(0xFFE50914),
                  ],
                ),
              ),
            ),
          ),

          SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Header (animated slide + fade) ─────────────────
                FadeTransition(
                  opacity: _headerFade,
                  child: SlideTransition(
                    position: _headerSlide,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(20, 20, 16, 20),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom:
                              BorderSide(color: dividerColor, width: 1),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const AppLogo.appBar(),
                              Container(
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: isDark
                                      ? Colors.white.withValues(alpha: 0.06)
                                      : Colors.black.withValues(alpha: 0.04),
                                ),
                                child: IconButton(
                                  icon: Icon(
                                    Icons.close_rounded,
                                    color: textColor,
                                    size: 20,
                                  ),
                                  onPressed: () => Navigator.pop(context),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              // Avatar with red gradient ring
                              Container(
                                padding: const EdgeInsets.all(2),
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: LinearGradient(
                                    colors: [
                                      Color(0xFFE50914),
                                      Color(0xFF8B0000),
                                    ],
                                  ),
                                ),
                                child: Container(
                                  padding: const EdgeInsets.all(1.5),
                                  decoration: const BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Colors.transparent,
                                  ),
                                  child: ClipOval(
                                    child: (photoUrl != null &&
                                            photoUrl.isNotEmpty)
                                        ? CachedNetworkImage(
                                            imageUrl: photoUrl,
                                            width: 42,
                                            height: 42,
                                            fit: BoxFit.cover,
                                            memCacheWidth: (42 *
                                                    MediaQuery
                                                        .devicePixelRatioOf(
                                                            context))
                                                .round(),
                                            memCacheHeight: (42 *
                                                    MediaQuery
                                                        .devicePixelRatioOf(
                                                            context))
                                                .round(),
                                            errorWidget: (_, __, ___) =>
                                                _avatarFallback(),
                                          )
                                        : _avatarFallback(),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name,
                                      style: TextStyle(
                                        color: textColor,
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 0.2,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'TBT Member',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        color: subTextColor,
                                        fontSize: 11.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                // ── Nav items (staggered) ──────────────────────────
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
                    physics: const BouncingScrollPhysics(),
                    children: [
                      // Order matches co-worker's main.dart:950-1073
                      animItem(
                        0,
                        _TbtDrawerItem(
                          icon: Icons.home_rounded,
                          label: 'Home Feed',
                          onTap: () {
                            Navigator.pop(context);
                            GoRouter.of(context).go(AppRoutes.dashboard);
                          },
                        ),
                      ),
                      if (!hiddenMenuKeys.contains('wins'))
                        animItem(
                          1,
                          _TbtDrawerItem(
                            icon: Icons.emoji_events_rounded,
                            label: 'TBT Leaderboard',
                            onTap: () {
                              Navigator.pop(context);
                              GoRouter.of(context).push(AppRoutes.wins);
                            },
                          ),
                        ),
                      if (!hiddenMenuKeys.contains('community'))
                        animItem(
                          2,
                          _TbtDrawerItem(
                            icon: Icons.groups_rounded,
                            label: 'Community Feed',
                            onTap: () {
                              Navigator.pop(context);
                              GoRouter.of(context).push(AppRoutes.community);
                            },
                          ),
                        ),
                      animItem(
                        3,
                        _TbtDrawerItem(
                          icon: Icons.school_rounded,
                          label: 'Courses Path',
                          onTap: () {
                            Navigator.pop(context);
                            GoRouter.of(context).push(AppRoutes.courses);
                          },
                        ),
                      ),
                      animItem(
                        4,
                        _TbtDrawerItem(
                          icon: Icons.map_rounded,
                          label: 'Course Quest',
                          onTap: () {
                            Navigator.pop(context);
                            GoRouter.of(context).push(AppRoutes.courses);
                          },
                        ),
                      ),
                      if (!hiddenMenuKeys.contains('podcasts'))
                        animItem(
                          5,
                          _TbtDrawerItem(
                            icon: Icons.podcasts_rounded,
                            label: 'Voice of Sakthi',
                            onTap: () {
                              Navigator.pop(context);
                              GoRouter.of(context).push(AppRoutes.podcasts);
                            },
                          ),
                        ),
                      if (!hiddenMenuKeys.contains('ebooks'))
                        animItem(
                          6,
                          _TbtDrawerItem(
                            icon: Icons.menu_book_rounded,
                            label: 'E-Book Library',
                            onTap: () {
                              Navigator.pop(context);
                              GoRouter.of(context).push(AppRoutes.ebooks);
                            },
                          ),
                        ),
                      if (!hiddenMenuKeys.contains('ai_content'))
                        animItem(
                          7,
                          _TbtDrawerItem(
                            icon: Icons.auto_awesome_rounded,
                            label: 'Content Buddy AI',
                            onTap: () {
                              Navigator.pop(context);
                              GoRouter.of(context).push(AppRoutes.aiContent);
                            },
                          ),
                        ),
                      animItem(
                        8,
                        _TbtDrawerItem(
                          icon: Icons.notifications_rounded,
                          label: 'Notifications',
                          onTap: () {
                            Navigator.pop(context);
                            GoRouter.of(context)
                                .push(AppRoutes.notifications);
                          },
                        ),
                      ),
                      animItem(
                        9,
                        _TbtDrawerItem(
                          icon: Icons.person_rounded,
                          label: 'My Profile',
                          onTap: () {
                            Navigator.pop(context);
                            GoRouter.of(context).push(AppRoutes.profile);
                          },
                        ),
                      ),
                      if (!hiddenMenuKeys.contains('support'))
                        animItem(
                          10,
                          _TbtDrawerItem(
                            icon: Icons.support_agent_rounded,
                            label: 'Support',
                            onTap: () {
                              Navigator.pop(context);
                              GoRouter.of(context).push(AppRoutes.support);
                            },
                          ),
                        ),
                    ],
                  ),
                ),

                // ── Logout footer ──────────────────────────────────
                animItem(
                  11,
                  Container(
                    margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    padding: const EdgeInsets.only(top: 8),
                    decoration: BoxDecoration(
                      border: Border(
                        top: BorderSide(color: dividerColor, width: 1),
                      ),
                    ),
                    child: _TbtDrawerItem(
                      icon: Icons.logout_rounded,
                      label: 'Logout',
                      iconColor: const Color(0xFFE50914),
                      labelColor: const Color(0xFFE50914),
                      onTap: () async {
                        Navigator.pop(context);
                        await ref
                            .read(authNotifierProvider.notifier)
                            .logout();
                        if (context.mounted) {
                          GoRouter.of(context).go(AppRoutes.login);
                        }
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _avatarFallback() {
    return Container(
      width: 42,
      height: 42,
      color: const Color(0xFF48484A),
      alignment: Alignment.center,
      child: const Icon(Icons.person, color: Colors.white70, size: 22),
    );
  }
}

// ── Drawer item with press-scale animation ─────────────────────────

class _TbtDrawerItem extends StatefulWidget {
  const _TbtDrawerItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.iconColor,
    this.labelColor,
    this.isSelected = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? iconColor;
  final Color? labelColor;
  final bool isSelected;

  @override
  State<_TbtDrawerItem> createState() => _TbtDrawerItemState();
}

class _TbtDrawerItemState extends State<_TbtDrawerItem>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pressCtrl;
  late final Animation<double> _scale;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _pressCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 120),
    );
    _scale = Tween<double>(begin: 1.0, end: 0.94).animate(
      CurvedAnimation(parent: _pressCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pressCtrl.dispose();
    super.dispose();
  }

  void _handleTapDown(_) {
    setState(() => _pressed = true);
    _pressCtrl.forward();
  }

  Future<void> _handleTapUp(_) async {
    await Future.delayed(const Duration(milliseconds: 100));
    if (mounted) {
      setState(() => _pressed = false);
      _pressCtrl.reverse();
    }
    widget.onTap();
  }

  void _handleTapCancel() {
    if (mounted) setState(() => _pressed = false);
    _pressCtrl.reverse();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final resolvedLabel = widget.isSelected
        ? const Color(0xFFE50914)
        : (widget.labelColor ??
            (isDark ? Colors.white.withValues(alpha: 0.88) : Colors.black87));
    final resolvedIcon = widget.isSelected || _pressed
        ? const Color(0xFFE50914)
        : (widget.iconColor ??
            (isDark
                ? Colors.white.withValues(alpha: 0.78)
                : Colors.black.withValues(alpha: 0.72)));

    return GestureDetector(
      onTapDown: _handleTapDown,
      onTapUp: _handleTapUp,
      onTapCancel: _handleTapCancel,
      behavior: HitTestBehavior.opaque,
      child: AnimatedBuilder(
        animation: _scale,
        builder: (context, child) => Transform.scale(
          scale: _scale.value,
          child: child,
        ),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 3),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: _pressed
                ? (isDark
                    ? Colors.white.withValues(alpha: 0.05)
                    : Colors.black.withValues(alpha: 0.03))
                : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Icon(widget.icon, color: resolvedIcon, size: 22),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  widget.label,
                  style: TextStyle(
                    color: resolvedLabel,
                    fontSize: 14.5,
                    fontWeight: widget.isSelected
                        ? FontWeight.w700
                        : FontWeight.w500,
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

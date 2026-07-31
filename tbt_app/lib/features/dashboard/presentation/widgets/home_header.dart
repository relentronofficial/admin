import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/constants/routes.dart';
import '../../../../shared/models/member.dart';
import '../../../../shared/theme/design_constants.dart';
import '../../../../shared/theme/theme_tokens.dart';
import '../../../../shared/widgets/app_logo.dart';
import '../../../gamification/providers/tbt_providers.dart';
import '../../../notifications/providers/notifications_provider.dart' as notifs;

/// Home page header shell — ports the co-worker's fixed 70-px top bar.
///
/// Row layout (left → right):
///   * Hamburger menu icon → opens the app drawer
///   * Centered TBT wordmark (Rajdhani red/white)
///   * Streak flame widget with day count
///   * Notification bell with unread-count red dot
///   * Circular profile avatar → /profile
///
/// Fixed 70-px height. Uses a maxWidth 500 constraint so it looks
/// balanced on tablets. Matches the co-worker's PostPopupScreen header
/// (main.dart:3018–3080).
/// Member is prop-drilled from [DashboardScreen] (which already
/// watches [meNotifierProvider]) so the profile avatar doesn't need to
/// spin up its own subscription. Cuts one duplicate provider watcher
/// and one avoidable rebuild cascade whenever the member updates.
class HomeHeader extends StatelessWidget {
  const HomeHeader({super.key, this.member});

  final Member? member;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Container(
        alignment: Alignment.center,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 500),
          child: SizedBox(
            height: 70,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  // Hamburger — Scaffold drawer trigger
                  Builder(
                    builder: (ctx) => GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => Scaffold.of(ctx).openDrawer(),
                      child: const _MenuIcon(),
                    ),
                  ),

                  // Centered logo — asset-based wordmark (dark/light aware)
                  const Expanded(
                    child: Center(child: AppLogo.appBar()),
                  ),

                  // Streak · Notification · Avatar
                  const _StreakChip(),
                  const SizedBox(width: 12),
                  const _NotificationBell(),
                  const SizedBox(width: 12),
                  _ProfileAvatar(member: member),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Hamburger menu icon (three lines) ──────────────────────────────

class _MenuIcon extends StatelessWidget {
  const _MenuIcon();
  @override
  Widget build(BuildContext context) {
    // Three stacked left-aligned lines — direct port of co-worker's
    // `_buildCustomMenuIcon` (main.dart:3681). Widths 22 / 16 / 11 px,
    // height 2 px, radius 1, 5 px spacing between lines.
    final color = context.tokens.textPrimary;
    return SizedBox(
      width: 34,
      height: 34,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 22,
            height: 2,
            decoration:
                BoxDecoration(color: color, borderRadius: BorderRadius.circular(1)),
          ),
          const SizedBox(height: 5),
          Container(
            width: 16,
            height: 2,
            decoration:
                BoxDecoration(color: color, borderRadius: BorderRadius.circular(1)),
          ),
          const SizedBox(height: 5),
          Container(
            width: 11,
            height: 2,
            decoration:
                BoxDecoration(color: color, borderRadius: BorderRadius.circular(1)),
          ),
        ],
      ),
    );
  }
}

// ── Streak flame ────────────────────────────────────────────────────

class _StreakChip extends ConsumerWidget {
  const _StreakChip();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final path = ref.watch(tbtPathProvider);
    final streak = path.valueOrNull?.dailyStreak ?? 0;
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: context.tokens.bgPage.withValues(alpha: 0.3),
        border: Border.all(color: context.tokens.borderCard, width: 1.0),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          ShaderMask(
            shaderCallback: (r) => const LinearGradient(
              colors: [Color(0xFFFF416C), Color(0xFFFF4B2B)],
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
            ).createShader(r),
            child: const Icon(
              Icons.whatshot_rounded,
              color: Colors.white,
              size: 18,
            ),
          ),
          Positioned(
            bottom: 2,
            child: Text(
              streak > 99 ? '99' : '$streak',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 9,
                fontWeight: FontWeight.w900,
                shadows: [
                  Shadow(color: Colors.black, blurRadius: 3, offset: Offset(0, 1)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Notification bell with unread-count dot ────────────────────────

class _NotificationBell extends ConsumerWidget {
  const _NotificationBell();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(notifs.unreadNotifCountNotifierProvider);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => GoRouter.of(context).push(AppRoutes.notifications),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Icon(
            Icons.notifications_outlined,
            color: context.tokens.textPrimary,
            size: 22,
          ),
          if (unread > 0)
            Positioned(
              right: -2,
              top: -2,
              child: Container(
                padding: const EdgeInsets.all(2),
                constraints: const BoxConstraints(
                  minWidth: 14,
                  minHeight: 14,
                ),
                decoration: const BoxDecoration(
                  color: Color(0xFFD30814),
                  shape: BoxShape.circle,
                ),
                child: Text(
                  unread > 9 ? '9+' : '$unread',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Profile avatar ──────────────────────────────────────────────────

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({this.member});
  final Member? member;

  @override
  Widget build(BuildContext context) {
    final photoUrl = member?.avatarUrl;
    final rawName = member?.name.trim() ?? '';
    final initial = rawName.isNotEmpty ? rawName[0].toUpperCase() : '?';
    // Co-worker spec: 24×24 image inside 1.5 px ring of #D30814
    // (main.dart:3812). Total footprint ~27 px including ring.
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => GoRouter.of(context).push(AppRoutes.profile),
      child: Container(
        padding: const EdgeInsets.all(1.5),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFD30814), width: 1.5),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            width: 24,
            height: 24,
            child: photoUrl != null && photoUrl.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: photoUrl,
                    fit: BoxFit.cover,
                    memCacheWidth:
                        (24 * MediaQuery.devicePixelRatioOf(context)).round(),
                    memCacheHeight:
                        (24 * MediaQuery.devicePixelRatioOf(context)).round(),
                    placeholder: (_, __) => Container(color: context.tokens.bgSurface),
                    errorWidget: (_, __, ___) => _AvatarFallback(initial: initial),
                  )
                : _AvatarFallback(initial: initial),
          ),
        ),
      ),
    );
  }
}

class _AvatarFallback extends StatelessWidget {
  const _AvatarFallback({required this.initial});
  final String initial;
  @override
  Widget build(BuildContext context) {
    return Container(
      color: context.tokens.bgInput,
      alignment: Alignment.center,
      child: Text(
        initial,
        style: TextStyle(
          color: context.tokens.textPrimary,
          fontWeight: FontWeight.w700,
          fontSize: 14,
        ),
      ),
    );
  }
}

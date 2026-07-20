import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/constants/routes.dart';
import '../../../../shared/providers/me_provider.dart';
import '../../../../shared/theme/design_constants.dart';
import '../../../../shared/theme/theme_tokens.dart';
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
class HomeHeader extends ConsumerWidget {
  const HomeHeader({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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

                  // Centered logo
                  Expanded(
                    child: Center(
                      child: RichText(
                        text: const TextSpan(
                          children: [
                            TextSpan(
                              text: 'T',
                              style: TextStyle(
                                fontFamily: 'Rajdhani',
                                color: kColorAccent,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1,
                              ),
                            ),
                            TextSpan(
                              text: 'AMIL ',
                              style: TextStyle(
                                fontFamily: 'Rajdhani',
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.2,
                              ),
                            ),
                            TextSpan(
                              text: 'B',
                              style: TextStyle(
                                fontFamily: 'Rajdhani',
                                color: kColorAccent,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1,
                              ),
                            ),
                            TextSpan(
                              text: 'USINESS ',
                              style: TextStyle(
                                fontFamily: 'Rajdhani',
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.2,
                              ),
                            ),
                            TextSpan(
                              text: 'T',
                              style: TextStyle(
                                fontFamily: 'Rajdhani',
                                color: kColorAccent,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1,
                              ),
                            ),
                            TextSpan(
                              text: 'RIBE',
                              style: TextStyle(
                                fontFamily: 'Rajdhani',
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Streak · Notification · Avatar
                  const _StreakChip(),
                  const SizedBox(width: 12),
                  const _NotificationBell(),
                  const SizedBox(width: 12),
                  const _ProfileAvatar(),
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
    final tokens = context.tokens;
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        color: tokens.bgSurface.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: tokens.borderCard),
      ),
      child: Icon(Icons.menu, color: tokens.textPrimary, size: 18),
    );
  }
}

// ── Streak flame ────────────────────────────────────────────────────

class _StreakChip extends ConsumerWidget {
  const _StreakChip();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Reuses TBT path daily streak (already computed backend-side).
    final path = ref.watch(tbtPathProvider);
    final streak = path.valueOrNull?.dailyStreak ?? 0;
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: context.tokens.bgSurface.withValues(alpha: 0.6),
        border: Border.all(color: context.tokens.borderCard),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          ShaderMask(
            shaderCallback: (r) => const LinearGradient(
              colors: [Color(0xFFff416c), Color(0xFFff4b2b)],
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
            ).createShader(r),
            child: const Icon(Icons.whatshot_rounded, color: Colors.white, size: 20),
          ),
          if (streak > 0)
            Positioned(
              bottom: 2,
              child: Text(
                streak > 99 ? '99' : '$streak',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  shadows: [Shadow(color: Colors.black, blurRadius: 3, offset: Offset(0, 1))],
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
    // Reuse the existing notifications provider count if available;
    // fall back gracefully.
    final unread = ref.watch(notifs.unreadNotifCountNotifierProvider);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => GoRouter.of(context).push(AppRoutes.notifications),
      child: SizedBox(
        width: 34,
        height: 34,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Icon(Icons.notifications_outlined, color: context.tokens.textPrimary, size: 22),
            if (unread > 0)
              Positioned(
                top: 4,
                right: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(
                    color: kColorAccent,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(color: context.tokens.bgPage, width: 1.5),
                  ),
                  constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                  child: Text(
                    unread > 9 ? '9+' : '$unread',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
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

// ── Profile avatar ──────────────────────────────────────────────────

class _ProfileAvatar extends ConsumerWidget {
  const _ProfileAvatar();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meNotifierProvider).valueOrNull;
    final photoUrl = (me as dynamic)?.profilePhotoUrl as String?;
    final initial = ((me as dynamic)?.firstName as String?)?.trim().isNotEmpty == true
        ? ((me as dynamic).firstName as String)[0].toUpperCase()
        : '?';
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => GoRouter.of(context).push(AppRoutes.profile),
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: kColorAccent, width: 1.5),
        ),
        child: ClipOval(
          child: photoUrl != null && photoUrl.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: photoUrl,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(color: context.tokens.bgSurface),
                  errorWidget: (_, __, ___) => _AvatarFallback(initial: initial),
                )
              : _AvatarFallback(initial: initial),
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

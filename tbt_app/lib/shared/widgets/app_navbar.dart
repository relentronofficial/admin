import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/nav_config.dart';
import '../../core/constants/routes.dart';
import '../../features/messages/providers/messages_provider.dart';
import '../../features/notifications/providers/notifications_provider.dart';
import '../providers/site_config_provider.dart';
import '../theme/tbt_theme.dart';

import '../../shared/theme/theme_tokens.dart';
/// Top navigation bar shown inside the persistent shell.
/// Implements [PreferredSizeWidget] so it can be used as [Scaffold.appBar].
class AppNavbar extends ConsumerWidget implements PreferredSizeWidget {
  const AppNavbar({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final siteConfig = ref.watch(siteConfigNotifierProvider).valueOrNull;
    final navConfig = ref.watch(navConfigNotifierProvider).valueOrNull;
    final rightIcons = navConfig?.rightIcons ?? const RightIcons();
    final notifCount = ref.watch(unreadNotifCountNotifierProvider);
    final msgCount = ref.watch(unreadMessageCountNotifierProvider);
    final accent = context.tbt.accent;

    return AppBar(
      backgroundColor: context.tokens.bgSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
      automaticallyImplyLeading: false,
      titleSpacing: 16,
      title: _Logo(logoUrl: siteConfig?.logoUrl),
      actions: [
        if (rightIcons.messages) ...[
          _IconWithBadge(
            icon: Icons.mail_outline,
            count: msgCount,
            accentColor: accent,
            semanticLabel: msgCount > 0
                ? 'Messages, $msgCount unread'
                : 'Messages',
            // `push` so the back button returns to whichever screen the
            // user tapped the icon from, instead of exiting the app.
            onTap: () => context.push(AppRoutes.messages),
          ),
          const SizedBox(width: 4),
        ],
        if (rightIcons.notifications) ...[
          _IconWithBadge(
            icon: Icons.notifications_outlined,
            count: notifCount,
            accentColor: accent,
            semanticLabel: notifCount > 0
                ? 'Notifications, $notifCount unread'
                : 'Notifications',
            onTap: () => context.push(AppRoutes.notifications),
          ),
          const SizedBox(width: 8),
        ],
      ],
    );
  }
}

// ── Logo ──────────────────────────────────────────────────────────────────────
//
// Parity with tbt-user-web:
//   Dark mode  → admin-configured `siteConfig.logoUrl` (white/brand logo)
//                falling back to the bundled `tbt_logo.webp`.
//   Light mode → bundled `tbt_logo_black.png` (the black wordmark). The
//                admin's remote logo is the white version, so we always
//                use the bundled black asset in light mode instead.

class _Logo extends StatelessWidget {
  const _Logo({required this.logoUrl});
  final String? logoUrl;

  static const _kLightLogoAsset = 'assets/images/tbt_logo_black.png';
  static const _kDarkLogoAsset = 'assets/images/tbt_logo.webp';

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (isDark) {
      // Dark mode: admin's remote logoUrl (usually white/brand). Fall back
      // to the bundled white asset when the remote URL is empty or fails
      // to load.
      if (logoUrl != null && logoUrl!.isNotEmpty) {
        return ExcludeSemantics(
          child: CachedNetworkImage(
            imageUrl: logoUrl!,
            height: 28,
            fit: BoxFit.contain,
            memCacheHeight:
                (28 * MediaQuery.devicePixelRatioOf(context)).round(),
            placeholder: (_, __) =>
                Image.asset(_kDarkLogoAsset, height: 28, fit: BoxFit.contain),
            errorWidget: (_, __, ___) =>
                Image.asset(_kDarkLogoAsset, height: 28, fit: BoxFit.contain),
          ),
        );
      }
      return ExcludeSemantics(
        child: Image.asset(_kDarkLogoAsset,
            height: 28, fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => _FallbackLogo()),
      );
    }

    // Light mode: bundled black wordmark, always.
    return ExcludeSemantics(
      child: Image.asset(_kLightLogoAsset,
          height: 28, fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => _FallbackLogo()),
    );
  }
}

class _FallbackLogo extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Text(
        'TBT',
        style: TextStyle(
          fontFamily: 'Rajdhani',
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: context.tbt.accent,
          letterSpacing: 3,
        ),
      );
}

// ── Badge icon button ─────────────────────────────────────────────────────────

class _IconWithBadge extends StatelessWidget {
  const _IconWithBadge({
    required this.icon,
    required this.count,
    required this.accentColor,
    required this.semanticLabel,
    required this.onTap,
  });

  final IconData icon;
  final int count;
  final Color accentColor;
  final String semanticLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: semanticLabel,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        splashColor: accentColor.withAlpha(0x1a),
        highlightColor: Colors.transparent,
        child: SizedBox(
          width: 48,
          height: 48,
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              Icon(icon, color: context.tokens.textSecondary, size: 24),
              if (count > 0)
                Positioned(
                  top: 8,
                  right: 8,
                  child: RepaintBoundary(
                  child: Semantics(
                    liveRegion: true,
                    child: Container(
                      constraints:
                          const BoxConstraints(minWidth: 16, minHeight: 16),
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: accentColor,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        count > 99 ? '99+' : '$count',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          height: 1.6,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
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

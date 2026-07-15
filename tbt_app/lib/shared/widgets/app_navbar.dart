import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
        _IconWithBadge(
          icon: Icons.mail_outline,
          count: msgCount,
          accentColor: accent,
          semanticLabel: msgCount > 0
              ? 'Messages, $msgCount unread'
              : 'Messages',
          onTap: () => context.go(AppRoutes.messages),
        ),
        const SizedBox(width: 4),
        _IconWithBadge(
          icon: Icons.notifications_outlined,
          count: notifCount,
          accentColor: accent,
          semanticLabel: notifCount > 0
              ? 'Notifications, $notifCount unread'
              : 'Notifications',
          onTap: () => context.go(AppRoutes.notifications),
        ),
        const SizedBox(width: 8),
      ],
    );
  }
}

// ── Logo ──────────────────────────────────────────────────────────────────────

class _Logo extends StatelessWidget {
  const _Logo({required this.logoUrl});
  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    if (logoUrl != null && logoUrl!.isNotEmpty) {
      return ExcludeSemantics(
        child: CachedNetworkImage(
          imageUrl: logoUrl!,
          height: 28,
          fit: BoxFit.contain,
          errorWidget: (_, __, ___) => _FallbackLogo(),
        ),
      );
    }
    return ExcludeSemantics(child: _FallbackLogo());
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

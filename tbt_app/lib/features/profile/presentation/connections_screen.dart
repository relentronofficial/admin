import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/theme_tokens.dart';
import '../data/profile_extras_service.dart';

/// List of members the current user follows. Backed by
/// `/api/user/me/connections`. Empty state prompts the user to find
/// people via community/search.
class ConnectionsScreen extends ConsumerWidget {
  const ConnectionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(myConnectionsProvider);
    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: Text(
          'CONNECTIONS',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: tokens.textPrimary,
          ),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Could not load your connections.',
              style: TextStyle(color: tokens.textSecondary),
            ),
          ),
        ),
        data: (list) {
          if (list.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.people_outline,
                        color: tokens.textMuted, size: 40),
                    const SizedBox(height: 12),
                    Text('No connections yet',
                        style: TextStyle(
                          color: tokens.textPrimary,
                          fontFamily: 'Rajdhani',
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        )),
                    const SizedBox(height: 4),
                    Text(
                      'Follow members from the community feed to build your network.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: tokens.textMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(myConnectionsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) =>
                  Divider(color: tokens.borderCard, height: 12),
              itemBuilder: (_, i) => _ConnectionRow(c: list[i]),
            ),
          );
        },
      ),
    );
  }
}

class _ConnectionRow extends StatelessWidget {
  const _ConnectionRow({required this.c});
  final ProfileConnection c;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Row(
      children: [
        ClipOval(
          child: c.avatarUrl != null && c.avatarUrl!.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: c.avatarUrl!,
                  width: 44,
                  height: 44,
                  fit: BoxFit.cover,
                  memCacheWidth:
                      (44 * MediaQuery.devicePixelRatioOf(context)).round(),
                  memCacheHeight:
                      (44 * MediaQuery.devicePixelRatioOf(context)).round(),
                  errorWidget: (_, __, ___) => _initials(context),
                )
              : _initials(context),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                c.name,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if ((c.role ?? c.businessName) != null)
                Text(
                  [
                    if (c.role != null && c.role!.isNotEmpty) c.role,
                    if (c.businessName != null && c.businessName!.isNotEmpty)
                      c.businessName,
                  ].whereType<String>().join(' · '),
                  style: TextStyle(color: tokens.textMuted, fontSize: 12),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _initials(BuildContext context) {
    final parts = c.name.trim().split(RegExp(r'\s+'));
    final initials = parts.isEmpty
        ? '?'
        : parts.length == 1
            ? parts.first[0].toUpperCase()
            : '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return Container(
      width: 44,
      height: 44,
      color: Theme.of(context).colorScheme.primary,
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontFamily: 'Rajdhani',
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

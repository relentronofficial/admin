import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../domain/chat_group_models.dart';
import '../providers/chat_group_providers.dart';

/// Global "Starred messages" screen — lists every message the member
/// has starred across all their groups.
///
/// Tap a row → jumps to the corresponding group chat. (MVP: the target
/// chat scrolls to bottom; deep-linking to a specific message id
/// requires an additional query param that the router doesn't wire yet.)
class StarredMessagesScreen extends ConsumerWidget {
  const StarredMessagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(starredMessagesProvider);

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: IconThemeData(color: tokens.textPrimary),
        title: Text(
          'STARRED MESSAGES',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.6,
            color: tokens.textPrimary,
          ),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, color: tokens.textMuted, size: 40),
              const SizedBox(height: 10),
              Text('Could not load starred messages.',
                  style: TextStyle(color: tokens.textSecondary)),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => ref.invalidate(starredMessagesProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (items) {
          if (items.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.star_outline_rounded,
                        size: 48, color: tokens.textMuted),
                    const SizedBox(height: 10),
                    Text(
                      'No starred messages yet',
                      style: TextStyle(
                        color: tokens.textSecondary,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Long-press any message and tap Star to bookmark it here.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: tokens.textMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            );
          }
          return RefreshIndicator(
            color: kColorAccent,
            backgroundColor: tokens.bgSurface,
            onRefresh: () async {
              ref.invalidate(starredMessagesProvider);
              await ref
                  .read(starredMessagesProvider.future)
                  .catchError((_) => <StarredMessage>[]);
            },
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: items.length,
              separatorBuilder: (_, __) =>
                  Divider(height: 1, color: tokens.borderCard, indent: 16),
              itemBuilder: (_, i) {
                final s = items[i];
                final m = s.message;
                final when = DateFormat.MMMd().add_jm().format(m.createdAt.toLocal());
                final senderName = m.sender?.displayName ?? 'Member';
                final preview = m.deletedForEveryone
                    ? 'message deleted'
                    : (m.body ??
                        (m.mediaType != null ? '📎 ${m.mediaType}' : '…'));
                return InkWell(
                  onTap: () => context.push(AppRoutes.chatGroupPath(m.groupId)),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.star_rounded,
                                color: Color(0xFFF5B301), size: 14),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                s.groupName,
                                style: TextStyle(
                                  color: tokens.textPrimary,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Text(when,
                                style: TextStyle(
                                    color: tokens.textMuted, fontSize: 11)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$senderName · $preview',
                          style: TextStyle(
                            color: tokens.textSecondary,
                            fontSize: 13,
                            height: 1.35,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

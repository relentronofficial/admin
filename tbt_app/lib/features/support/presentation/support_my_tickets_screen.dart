import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../providers/support_providers.dart';
import '../../../shared/widgets/app_loader.dart';

/// List of tickets the current member has submitted.
class SupportMyTicketsScreen extends ConsumerWidget {
  const SupportMyTicketsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(myTicketsProvider);
    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: const Text('My Tickets',
            style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
      ),
      body: async.when(
        loading: () => const AppLoader.center(),
        error: (_, __) => Center(
          child: Text('Could not load tickets.',
              style: TextStyle(color: tokens.textSecondary)),
        ),
        data: (list) {
          if (list.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'You haven\'t submitted any tickets yet.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: tokens.textSecondary, height: 1.5),
                ),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(myTicketsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (ctx, i) {
                final t = list[i];
                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: tokens.bgSurface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: tokens.borderCard),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              t.subject,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: tokens.textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          _StatusBadge(status: t.status),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        DateFormat.yMMMd().add_jm().format(t.createdAt),
                        style: TextStyle(color: tokens.textMuted, fontSize: 11),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        t.message,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: tokens.textSecondary, fontSize: 12, height: 1.4),
                      ),
                      if (t.hasAdminReply) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: kColorAccent.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: kColorAccent.withValues(alpha: 0.25),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                    Icons.reply,
                                    size: 12,
                                    color: kColorAccent,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'ADMIN REPLIED',
                                    style: TextStyle(
                                      color: kColorAccent,
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                  const Spacer(),
                                  if (t.adminRepliedAt != null)
                                    Text(
                                      DateFormat.MMMd()
                                          .add_jm()
                                          .format(t.adminRepliedAt!),
                                      style: TextStyle(
                                        color: tokens.textMuted,
                                        fontSize: 10,
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                t.adminReply!,
                                style: TextStyle(
                                  color: tokens.textPrimary,
                                  fontSize: 12.5,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
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

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final map = {
      'new': (const Color(0xFF60a5fa), 'New'),
      'in_progress': (const Color(0xFFfacc15), 'In Progress'),
      'resolved': (const Color(0xFF4ade80), 'Resolved'),
      'closed': (const Color(0xFFa0a0a0), 'Closed'),
    };
    final (color, label) = map[status] ?? (const Color(0xFFa0a0a0), status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 9,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

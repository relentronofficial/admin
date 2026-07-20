import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../domain/tbt_models.dart';
import '../providers/tbt_providers.dart';

/// WINS — dedicated bottom-nav tab that shows the full TBT leaderboard.
///
/// Reuses the existing /api/tbt/leaderboard endpoint. Renders top 50
/// members ordered by total points, with top-3 crown icons (gold/
/// silver/bronze) and the caller's own row highlighted.
class WinsScreen extends ConsumerWidget {
  const WinsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(tbtLeaderboardProvider);

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: const Row(
          children: [
            Icon(Icons.emoji_events, color: Color(0xFFfacc15), size: 22),
            SizedBox(width: 8),
            Text('WINS',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.5,
                )),
          ],
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator(color: kColorAccent)),
        error: (e, _) => Center(
          child: Text('Could not load leaderboard.',
              style: TextStyle(color: tokens.textSecondary)),
        ),
        data: (rows) {
          if (rows.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'No leaderboard entries yet.\nBe the first to earn points!',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: tokens.textSecondary, height: 1.5),
                ),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(tbtLeaderboardProvider),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
              itemCount: rows.length,
              itemBuilder: (ctx, i) => _LeaderTile(row: rows[i]),
            ),
          );
        },
      ),
    );
  }
}

class _LeaderTile extends StatelessWidget {
  const _LeaderTile({required this.row});
  final LeaderboardRow row;

  Color? _rankColor() {
    if (row.rank == 1) return const Color(0xFFfacc15); // gold
    if (row.rank == 2) return const Color(0xFFd1d5db); // silver
    if (row.rank == 3) return const Color(0xFFea580c); // bronze
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final rankColor = _rankColor();
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: row.isMe
            ? kColorAccent.withValues(alpha: 0.10)
            : tokens.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: row.isMe
              ? kColorAccent.withValues(alpha: 0.4)
              : rankColor != null
                  ? rankColor.withValues(alpha: 0.4)
                  : tokens.borderCard,
          width: row.isMe ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          // Rank badge
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: (rankColor ?? tokens.textMuted).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: (rankColor ?? tokens.borderCard).withValues(alpha: 0.4)),
            ),
            child: Center(
              child: rankColor != null && row.rank <= 3
                  ? Icon(Icons.emoji_events, color: rankColor, size: 20)
                  : Text(
                      '${row.rank}',
                      style: TextStyle(
                        fontFamily: 'Rajdhani',
                        color: tokens.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 10),
          // Avatar
          ClipOval(
            child: row.memberPhoto != null && row.memberPhoto!.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: row.memberPhoto!,
                    width: 36,
                    height: 36,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) =>
                        Container(width: 36, height: 36, color: tokens.bgInput),
                  )
                : Container(
                    width: 36,
                    height: 36,
                    color: tokens.bgInput,
                    child: Icon(Icons.person, size: 18, color: tokens.textMuted),
                  ),
          ),
          const SizedBox(width: 10),
          // Name + isMe pill
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.memberName ?? 'Member',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: row.isMe ? Colors.white : tokens.textPrimary,
                    fontSize: 14,
                    fontWeight: row.isMe ? FontWeight.w800 : FontWeight.w600,
                  ),
                ),
                if (row.isMe)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      'YOU',
                      style: TextStyle(
                        color: kColorAccent,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          // Points chip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFfacc15).withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: const Color(0xFFfacc15).withValues(alpha: 0.3),
              ),
            ),
            child: Text(
              '${row.totalPoints} pts',
              style: const TextStyle(
                color: Color(0xFFfacc15),
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

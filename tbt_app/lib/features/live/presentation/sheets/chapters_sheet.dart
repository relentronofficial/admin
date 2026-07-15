import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/theme/theme_tokens.dart';
import '../../../workshops/data/workshops_service.dart';

/// Bottom sheet listing chapter markers for a live call. Fetches from
/// `GET /api/user/workshop/live-calls/:id/chapters` once on open — the
/// list is read-only, no polling. Empty and error states are both
/// rendered inline so the parent screen doesn't need custom fallbacks.
class ChaptersSheet extends ConsumerStatefulWidget {
  const ChaptersSheet({
    super.key,
    required this.callId,
    required this.accent,
  });

  final String callId;
  final Color accent;

  @override
  ConsumerState<ChaptersSheet> createState() => _ChaptersSheetState();
}

class _ChaptersSheetState extends ConsumerState<ChaptersSheet> {
  Future<List<Map<String, dynamic>>>? _future;

  @override
  void initState() {
    super.initState();
    _future = ref
        .read(workshopsServiceProvider)
        .getLiveCallChapters(widget.callId);
  }

  String _formatTimestamp(dynamic v) {
    // Backend may send seconds (int) or a formatted string. Handle both.
    if (v is num) {
      final total = v.toInt();
      final m = total ~/ 60;
      final s = total % 60;
      return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    }
    if (v is String && v.isNotEmpty) return v;
    return '';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.tokens.bgSurface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: context.tokens.textMuted.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Row(
            children: [
              Icon(Icons.bookmark_outline,
                  color: context.tokens.textPrimary, size: 18),
              const SizedBox(width: 8),
              Text(
                'Chapters',
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: context.tokens.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.55),
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  );
                }
                if (snap.hasError) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: Text('Failed to load chapters',
                          style: TextStyle(
                              color: context.tokens.textMuted, fontSize: 13)),
                    ),
                  );
                }
                final chapters = snap.data ?? const [];
                if (chapters.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: Text('No chapters yet for this session',
                          style: TextStyle(
                              color: context.tokens.textMuted, fontSize: 13)),
                    ),
                  );
                }
                return ListView.separated(
                  shrinkWrap: true,
                  itemCount: chapters.length,
                  separatorBuilder: (_, __) =>
                      Divider(color: context.tokens.borderCard, height: 1),
                  itemBuilder: (_, i) {
                    final c = chapters[i];
                    final title =
                        (c['title'] ?? c['label'] ?? 'Chapter ${i + 1}')
                            .toString();
                    final ts = _formatTimestamp(
                        c['startTime'] ?? c['startsAt'] ?? c['atSeconds']);
                    final note = (c['description'] ?? c['notes'] ?? '')
                        .toString();
                    return Padding(
                      padding: const EdgeInsets.symmetric(
                          vertical: 10, horizontal: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: widget.accent.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              ts.isEmpty ? '—' : ts,
                              style: TextStyle(
                                color: widget.accent,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                fontFeatures: const [
                                  FontFeature.tabularFigures()
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  title,
                                  style: TextStyle(
                                    color: context.tokens.textPrimary,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                if (note.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    note,
                                    style: TextStyle(
                                      color: context.tokens.textMuted,
                                      fontSize: 12,
                                      height: 1.4,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

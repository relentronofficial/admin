import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../providers/ebook_providers.dart';

/// List of member's bookmarked books. Tap → book detail.
class EbookBookmarksScreen extends ConsumerWidget {
  const EbookBookmarksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(ebookBookmarksProvider);
    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: const Text('Bookmarks',
            style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator(color: kColorAccent)),
        error: (_, __) => Center(
          child: Text('Could not load bookmarks.',
              style: TextStyle(color: tokens.textSecondary)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'No bookmarks yet.\nTap the bookmark icon on any book to save it here.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: tokens.textSecondary, height: 1.5),
                ),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(ebookBookmarksProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (ctx, i) {
                final item = items[i];
                return Material(
                  color: tokens.bgSurface,
                  borderRadius: BorderRadius.circular(10),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () =>
                        GoRouter.of(context).push(AppRoutes.ebookDetailPath(item.book.id)),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: kColorAccent.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.bookmark, color: kColorAccent, size: 18),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.book.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: tokens.textPrimary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                if (item.bookmark.pageNumber != null)
                                  Text(
                                    'Page ${item.bookmark.pageNumber}',
                                    style: TextStyle(color: tokens.textMuted, fontSize: 11),
                                  ),
                              ],
                            ),
                          ),
                          Icon(Icons.chevron_right, color: tokens.textMuted, size: 18),
                        ],
                      ),
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

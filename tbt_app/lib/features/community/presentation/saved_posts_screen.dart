import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_loader.dart';
import '../../dashboard/data/community_service.dart';
import 'community_screen.dart';

/// My saved (bookmarked) community posts — item #16.
///
/// Reuses [CommunityPostCard] end-to-end (so all the animations, like
/// toggle, comment sheet, share, overflow menu, etc. work identically
/// to the main feed) fed by [communityBookmarksProvider].
class SavedPostsScreen extends ConsumerWidget {
  const SavedPostsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(communityBookmarksProvider);
    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        foregroundColor: tokens.textPrimary,
        title: Text(
          'Saved posts',
          style: TextStyle(
            color: tokens.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.2,
          ),
        ),
      ),
      body: async.when(
        loading: () => const AppLoader.center(),
        error: (_, __) => Center(
          child: Text(
            'Could not load saved posts.',
            style: TextStyle(color: tokens.textSecondary),
          ),
        ),
        data: (posts) {
          if (posts.isEmpty) {
            return RefreshIndicator(
              color: kColorAccent,
              onRefresh: () async =>
                  ref.invalidate(communityBookmarksProvider),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(24, 96, 24, 100),
                children: [
                  Icon(
                    Icons.bookmark_border,
                    size: 80,
                    color: tokens.textMuted.withValues(alpha: 0.5),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'No saved posts yet',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: tokens.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Tap the ⋮ menu on any post → Save to bookmark it. '
                    'Saved posts appear here for quick access.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: tokens.textSecondary,
                      fontSize: 13,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            color: kColorAccent,
            onRefresh: () async =>
                ref.invalidate(communityBookmarksProvider),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
              itemCount: posts.length,
              itemBuilder: (ctx, i) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: CommunityPostCard(post: posts[i]),
              ),
            ),
          );
        },
      ),
    );
  }
}

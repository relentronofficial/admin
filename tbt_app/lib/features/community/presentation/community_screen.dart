import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/member_avatar.dart';
import '../../dashboard/data/community_service.dart';
import 'author_profile_sheet.dart';
import 'image_viewer.dart';

/// Community feed — reconstructed, not recovered.
///
/// This file was imported by `app.dart`, `saved_posts_screen.dart` and
/// `achievement_composer.dart` but was **never committed to git** (verified:
/// no commit on any ref has ever touched this path, or a file of this name at
/// any other path). There is no earlier version to restore, so every symbol
/// here is rebuilt from the exact shape its existing callers demand:
///
///   app.dart                 → `CommunityScreen`
///   saved_posts_screen.dart  → `CommunityPostCard(post:)`, `communityBookmarksProvider`
///   achievement_composer.dart→ `communityFilterProvider`,
///                              `communityFeedNotifierProvider(filter)` with
///                              `.insertOptimistic(...)` / `.rollbackOptimistic(id)`,
///                              `ref.invalidateCommunityFeed()`
///   author_profile_sheet.dart→ `communityMemberProfileProvider(memberId)`,
///                              `CommunityMemberProfile`, `CommunityRecentPost`
///
/// Every network call goes through `CommunityService`, which maps 1:1 onto
/// routes the backend already serves (`modules/community/routes.ts`). No
/// endpoint is invented here.
///
/// **The feed's visual design is a reconstruction and should get a product
/// review.** The data flow and API contracts are pinned by the callers and the
/// backend; the layout is not. It follows the app's `ThemeTokens` conventions
/// so it is consistent, but nobody specified what this screen looks like.

// ── Screen ────────────────────────────────────────────────────────────────

class CommunityScreen extends ConsumerWidget {
  const CommunityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final filter = ref.watch(communityFilterProvider);
    final async = ref.watch(communityFeedNotifierProvider(filter));

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgPage,
        elevation: 0,
        title: const Text('Community'),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => _FeedMessage(
          title: 'Could not load the feed',
          detail: '$err',
          onRetry: () =>
              ref.read(communityFeedNotifierProvider(filter).notifier).load(),
        ),
        data: (posts) {
          if (posts.isEmpty) {
            return _FeedMessage(
              title: 'No posts yet',
              detail: 'Posts from the tribe will appear here.',
              onRetry: () =>
                  ref.read(communityFeedNotifierProvider(filter).notifier).load(),
            );
          }
          return RefreshIndicator(
            onRefresh: () =>
                ref.read(communityFeedNotifierProvider(filter).notifier).load(),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
              itemCount: posts.length,
              itemBuilder: (_, i) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: CommunityPostCard(post: posts[i]),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _FeedMessage extends StatelessWidget {
  const _FeedMessage({
    required this.title,
    required this.detail,
    required this.onRetry,
  });

  final String title;
  final String detail;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(24, 96, 24, 100),
      children: [
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: tokens.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          detail,
          textAlign: TextAlign.center,
          style: TextStyle(color: tokens.textSecondary, fontSize: 13),
        ),
        const SizedBox(height: 16),
        Center(
          child: TextButton(onPressed: onRetry, child: const Text('Retry')),
        ),
      ],
    );
  }
}

// ── Post card ─────────────────────────────────────────────────────────────

/// A single feed post.
///
/// `saved_posts_screen.dart` reuses this so its rows match the feed's. Its doc
/// comment describes a richer card (comment sheet, share, overflow menu) than
/// this one — those surfaces were never committed either, and building them
/// would be inventing product rather than restoring it. What is here is what
/// the backend and the callers pin down: author, content, media, like and
/// bookmark, both wired to real endpoints.
class CommunityPostCard extends ConsumerStatefulWidget {
  const CommunityPostCard({super.key, required this.post});

  final CommunityPost post;

  @override
  ConsumerState<CommunityPostCard> createState() => _CommunityPostCardState();
}

class _CommunityPostCardState extends ConsumerState<CommunityPostCard> {
  late int _likes = widget.post.likesCount;
  bool _liked = false;
  bool _bookmarked = false;
  bool _busy = false;

  Future<void> _toggleLike() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      // Optimistic — the endpoint is a toggle, so mirror it locally and undo
      // on failure rather than making the user wait for a round trip.
      _liked = !_liked;
      _likes += _liked ? 1 : -1;
    });
    try {
      await ref.read(communityServiceProvider).toggleLike(widget.post.id);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _liked = !_liked;
        _likes += _liked ? 1 : -1;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleBookmark() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _bookmarked = !_bookmarked;
    });
    try {
      await ref.read(communityServiceProvider).toggleBookmark(widget.post.id);
      ref.invalidate(communityBookmarksProvider);
    } catch (_) {
      if (!mounted) return;
      setState(() => _bookmarked = !_bookmarked);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _openAuthor() {
    // The sheet owns its own presentation (AuthorProfileSheet.open) — going
    // through it keeps one definition of how the sheet is shown.
    AuthorProfileSheet.open(context, widget.post.memberId);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final post = widget.post;

    return Container(
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.borderCard),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: _openAuthor,
                child: MemberAvatar(
                  photoUrl: post.memberPhoto,
                  name: post.memberName ?? 'Member',
                  memberId: post.memberId,
                  size: 36,
                  isMentor: post.isMentor,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: _openAuthor,
                  child: Text(
                    post.memberName ?? 'Member',
                    style: TextStyle(
                      color: tokens.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
              if (post.isPinned)
                Icon(Icons.push_pin, size: 16, color: tokens.textSecondary),
            ],
          ),
          if (post.content.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              post.content,
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 14,
                height: 1.4,
              ),
            ),
          ],
          if (post.mediaUrls.isNotEmpty) ...[
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: GestureDetector(
                onTap: () => FullscreenImageViewer.open(context, urls: post.mediaUrls),
                child: Image.network(
                  post.mediaUrls.first,
                  height: 200,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              _Action(
                icon: _liked ? Icons.favorite : Icons.favorite_border,
                label: '$_likes',
                onTap: _toggleLike,
              ),
              const SizedBox(width: 18),
              _Action(
                icon: Icons.mode_comment_outlined,
                label: '${post.commentsCount}',
                onTap: null,
              ),
              const Spacer(),
              _Action(
                icon: _bookmarked ? Icons.bookmark : Icons.bookmark_border,
                label: '',
                onTap: _toggleBookmark,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({required this.icon, required this.label, this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Row(
        children: [
          Icon(icon, size: 18, color: tokens.textSecondary),
          if (label.isNotEmpty) ...[
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(color: tokens.textSecondary, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

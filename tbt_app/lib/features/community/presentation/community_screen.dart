import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/providers/me_provider.dart';
import '../../../shared/providers/socket_provider.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/utils/time_ago.dart';
import '../../../shared/widgets/member_avatar.dart';
import '../../dashboard/data/community_service.dart';
import '../../dashboard/presentation/widgets/achievement_composer.dart';
import 'author_profile_sheet.dart';
import 'image_viewer.dart';
import 'rich_text_helpers.dart';
import 'video_viewer.dart';

/// Dynamic community feed screen — port of co-worker's CommunityScreen.
///
/// Sections:
///   * App bar "Community"
///   * Filter TabBar: For You · Following · Mentors · My Posts
///   * Feed list of [CommunityPostCard]s (item 0 = inline composer)
///   * Empty / loading / error states
///   * Pull-to-refresh
///
/// Interactions:
///   * Tab switch → writes to [communityFilterProvider] → feed refetches
///   * Like button — optimistic toggle, reconciles with server response
///   * Comment button — opens [CommentSheet] bottom modal
class CommunityScreen extends ConsumerStatefulWidget {
  const CommunityScreen({super.key});

  @override
  ConsumerState<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends ConsumerState<CommunityScreen>
    with SingleTickerProviderStateMixin {
  static const _tabs = <_FilterTab>[
    _FilterTab(id: 'all', label: 'For You'),
    _FilterTab(id: 'following', label: 'Following'),
    _FilterTab(id: 'mentors', label: 'Mentors'),
    _FilterTab(id: 'mine', label: 'My Posts'),
  ];

  late final TabController _tabController;
  final ScrollController _scrollController = ScrollController();

  /// Number of posts we last showed the user. When a refresh produces
  /// a strictly larger list, we flash the "N new posts" pill for 3 s.
  int? _lastKnownLength;
  int _newSinceLast = 0;
  Timer? _pillDismissTimer;

  /// FAB visibility state — hidden on scroll-down, shown on scroll-up
  /// (Twitter/X pattern). Toggled by a NotificationListener on the
  /// feed's ListView.
  bool _fabVisible = true;

  bool _onScrollNotification(ScrollNotification n) {
    // Only care about vertical drags/swipes on the scroll view itself.
    // `pixels < 24` ensures the FAB is always shown near the top.
    if (n is ScrollUpdateNotification) {
      final delta = n.scrollDelta ?? 0;
      if (n.metrics.pixels < 24 && !_fabVisible) {
        setState(() => _fabVisible = true);
      } else if (delta > 6 && _fabVisible) {
        setState(() => _fabVisible = false);
      } else if (delta < -6 && !_fabVisible) {
        setState(() => _fabVisible = true);
      }
    }
    // Item #28: fire loadMore when within 500 px of the bottom. The
    // notifier's own busy flag prevents duplicate requests.
    if (n.metrics.pixels >= n.metrics.maxScrollExtent - 500) {
      final filter = ref.read(communityFilterProvider);
      ref.read(communityFeedNotifierProvider(filter).notifier).loadMore();
    }
    return false;
  }

  void _openComposerSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      useSafeArea: true,
      builder: (_) => _ComposerSheet(),
    );
  }

  @override
  void initState() {
    super.initState();
    // Seed the controller from the currently-selected filter so the
    // active tab persists when the user navigates away and back.
    final initial = _indexFor(
        ProviderScope.containerOf(context, listen: false)
            .read(communityFilterProvider));
    _tabController = TabController(
      length: _tabs.length,
      initialIndex: initial,
      vsync: this,
    );
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) return;
      final next = _tabs[_tabController.index].id;
      final current = ref.read(communityFilterProvider);
      if (next != current) {
        ref.read(communityFilterProvider.notifier).state = next;
      }
    });

    // Item #30: subscribe to socket events. Refresh the currently-
    // active feed on any community mutation. Kept simple — invalidation
    // over fine-grained delta application, which would require the
    // event payload to include the full post/like/comment shape.
    final sock = ref.read(socketNotifierProvider.notifier);
    sock.on('community:post_created', _onSocketEvent);
    sock.on('community:post_liked', _onSocketEvent);
    sock.on('community:comment_added', _onSocketEvent);
  }

  void _onSocketEvent(dynamic _) {
    if (!mounted) return;
    // Only refresh if we're currently on a filter tab that would
    // actually surface the change. Cheap heuristic: always refresh
    // the active filter — the notifier will de-dupe if nothing
    // changed.
    ref.invalidateCommunityFeed();
  }

  int _indexFor(String filterId) {
    final i = _tabs.indexWhere((t) => t.id == filterId);
    return i < 0 ? 0 : i;
  }

  @override
  void dispose() {
    // Item #30: detach socket listeners so we don't leak invalidation
    // calls after the screen is gone.
    final sock = ref.read(socketNotifierProvider.notifier);
    sock.off('community:post_created', _onSocketEvent);
    sock.off('community:post_liked', _onSocketEvent);
    sock.off('community:comment_added', _onSocketEvent);
    _tabController.dispose();
    _scrollController.dispose();
    _pillDismissTimer?.cancel();
    super.dispose();
  }

  Future<void> _handleRefresh() async {
    // Refresh via the notifier so the spinner stays visible until
    // fresh data lands.
    final filter = ref.read(communityFilterProvider);
    await ref
        .read(communityFeedNotifierProvider(filter).notifier)
        .refresh();
  }

  /// Called after each build when data is available. Compares list
  /// length against the previous render; if strictly larger, computes
  /// the delta and flashes the pill.
  void _maybeShowNewPostsPill(int currentLength) {
    final last = _lastKnownLength;
    // Only fire on subsequent loads (first load establishes baseline).
    if (last != null && currentLength > last) {
      final delta = currentLength - last;
      _pillDismissTimer?.cancel();
      setState(() => _newSinceLast = delta);
      _pillDismissTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) setState(() => _newSinceLast = 0);
      });
    }
    _lastKnownLength = currentLength;
  }

  void _scrollToTop() {
    if (!_scrollController.hasClients) return;
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
    );
    _pillDismissTimer?.cancel();
    setState(() => _newSinceLast = 0);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final async = ref.watch(communityFeedProvider);
    final activeFilter = ref.watch(communityFilterProvider);

    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        foregroundColor: tokens.textPrimary,
        title: Text(
          'Community',
          style: TextStyle(
            color: tokens.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.2,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.bookmark_border,
                color: tokens.textPrimary, size: 22),
            tooltip: 'Saved posts',
            onPressed: () =>
                Navigator.of(context).pushNamed(AppRoutes.communitySaved),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(44),
          child: Container(
            color: tokens.bgSurface,
            child: TabBar(
              controller: _tabController,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              indicatorColor: kColorAccent,
              indicatorWeight: 3,
              indicatorSize: TabBarIndicatorSize.label,
              labelColor: kColorAccent,
              unselectedLabelColor: tokens.textSecondary,
              labelStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
              unselectedLabelStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
              labelPadding: const EdgeInsets.symmetric(horizontal: 14),
              tabs: [
                for (final t in _tabs) Tab(text: t.label.toUpperCase()),
              ],
            ),
          ),
        ),
      ),
      body: async.when(
        loading: () => const _FeedSkeleton(),
        error: (_, __) => Center(
          child: Text(
            'Could not load community feed.',
            style: TextStyle(color: tokens.textSecondary),
          ),
        ),
        data: (posts) {
          if (posts.isEmpty) {
            return RefreshIndicator(
              color: kColorAccent,
              onRefresh: () async => ref.invalidateCommunityFeed(),
              child: _EmptyStateCta(filter: activeFilter),
            );
          }
          // Item #13: run delta detection after every data update.
          WidgetsBinding.instance.addPostFrameCallback(
            (_) => _maybeShowNewPostsPill(posts.length),
          );

          return Stack(
            children: [
              // NotificationListener wraps the RefreshIndicator so the
              // FAB hide-on-scroll (item #15) sees every scroll delta,
              // AND the loadMore trigger (item #28) fires at the
              // bottom.
              NotificationListener<ScrollNotification>(
                onNotification: _onScrollNotification,
                child: RefreshIndicator(
                  color: kColorAccent,
                  onRefresh: _handleRefresh,
                  child: Builder(builder: (_) {
                    // Read the notifier's live state for footer rendering.
                    final feedState = ref.watch(
                      communityFeedNotifierProvider(activeFilter),
                    );
                    final hasMore =
                        feedState.valueOrNull?.hasMore ?? false;
                    final loadingMore =
                        feedState.valueOrNull?.loadingMore ?? false;
                    // Composer + N posts + footer.
                    final itemCount = posts.length + 2;
                    return ListView.builder(
                      controller: _scrollController,
                      padding:
                          const EdgeInsets.fromLTRB(12, 12, 12, 100),
                      itemCount: itemCount,
                      itemBuilder: (ctx, i) {
                        if (i == 0) {
                          return const Padding(
                            padding: EdgeInsets.only(bottom: 12),
                            child: InlineComposerCard(),
                          );
                        }
                        if (i == itemCount - 1) {
                          return _FeedFooter(
                            hasMore: hasMore,
                            loadingMore: loadingMore,
                          );
                        }
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child:
                              CommunityPostCard(post: posts[i - 1]),
                        );
                      },
                    );
                  }),
                ),
              ),
              // Item #13: floating "↑ N new posts" pill.
              Positioned(
                top: 8,
                left: 0,
                right: 0,
                child: _NewPostsPill(
                  count: _newSinceLast,
                  onTap: _scrollToTop,
                ),
              ),
            ],
          );
        },
      ),
      // Item #15: FAB composer. Hidden on scroll-down, shown on
      // scroll-up. Anchored bottom-right — the standard Material
      // location so it doesn't collide with the bottom nav shell.
      floatingActionButton: AnimatedSlide(
        offset: _fabVisible ? Offset.zero : const Offset(0, 1.4),
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        child: AnimatedOpacity(
          opacity: _fabVisible ? 1 : 0,
          duration: const Duration(milliseconds: 180),
          child: FloatingActionButton.extended(
            onPressed: _openComposerSheet,
            backgroundColor: kColorAccent,
            foregroundColor: Colors.white,
            elevation: 6,
            highlightElevation: 8,
            icon: const Icon(Icons.edit_note, size: 20),
            label: const Text(
              'Post',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
          ),
        ),
      ),
    );
  }

  // Empty-state messaging moved into [_EmptyStateCta] (item #14).
}

/// Simple record for the tab list. Kept as a private class (not a Dart
/// record) so we can use `const` and pass through as widget config.
class _FilterTab {
  const _FilterTab({required this.id, required this.label});
  final String id;
  final String label;
}

// ── Post card ──────────────────────────────────────────────────────

class CommunityPostCard extends ConsumerStatefulWidget {
  const CommunityPostCard({super.key, required this.post});
  final CommunityPost post;

  @override
  ConsumerState<CommunityPostCard> createState() => _CommunityPostCardState();
}

class _CommunityPostCardState extends ConsumerState<CommunityPostCard> {
  late bool _liked = widget.post.isLikedByMe;
  late int _likesCount = widget.post.likesCount;
  bool _likeBusy = false;

  Future<void> _toggleLike() async {
    if (_likeBusy) return;
    setState(() {
      _likeBusy = true;
      _liked = !_liked;
      _likesCount += _liked ? 1 : -1;
      if (_likesCount < 0) _likesCount = 0;
    });
    try {
      final result =
          await ref.read(communityServiceProvider).toggleLike(widget.post.id);
      if (!mounted) return;
      setState(() {
        _liked = result.liked;
        _likesCount = result.likesCount;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        // Roll back optimistic update on failure.
        _liked = !_liked;
        _likesCount += _liked ? 1 : -1;
      });
    } finally {
      if (mounted) setState(() => _likeBusy = false);
    }
  }

  void _openComments() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => CommentSheet(post: widget.post),
    );
  }

  void _openLikersSheet(CommunityPost post) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => LikersSheet(postId: post.id, totalLikes: _likesCount),
    );
  }

  void _openAuthorProfile(String memberId) {
    AuthorProfileSheet.open(context, memberId);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final p = widget.post;
    final card = Container(
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          // Slight amber tint on the border for unapproved rows so
          // they read as "in-review" even without looking at the pill.
          color: p.isApproved
              ? tokens.borderCard
              : const Color(0xFFF59E0B).withValues(alpha: 0.5),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      // ClipRRect so the action band's tinted background hugs the
      // rounded corners of the card.
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Content region (padding 16) ───────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 8, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header row: avatar + name/time inline + overflow
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Item #20: tap avatar → open profile sheet.
                      GestureDetector(
                        onTap: () => _openAuthorProfile(p.memberId),
                        child: MemberAvatar(
                          photoUrl: p.memberPhoto,
                          name: p.memberName,
                          memberId: p.memberId,
                          size: 44,
                          isMentor: p.isMentor,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Name · time on one line (time right-aligned
                            // and muted small — LinkedIn/Threads pattern).
                            Row(
                              children: [
                                Flexible(
                                  child: GestureDetector(
                                    onTap: () =>
                                        _openAuthorProfile(p.memberId),
                                    child: Text(
                                      p.memberName ?? 'Member',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        color: tokens.textPrimary,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: -0.1,
                                      ),
                                    ),
                                  ),
                                ),
                                if (p.isMentor) ...[
                                  const SizedBox(width: 6),
                                  _MentorBadge(),
                                ],
                                if (!p.isApproved) ...[
                                  const SizedBox(width: 6),
                                  const _PendingBadge(),
                                ],
                                if (p.isPinned) ...[
                                  const SizedBox(width: 6),
                                  Icon(Icons.push_pin,
                                      size: 13, color: kColorAccent),
                                ],
                                const SizedBox(width: 8),
                                // Time right-aligned in header row —
                                // 11 muted w600 per speckit item #7.
                                Text(
                                  '· ${timeAgo(p.createdAt)}',
                                  style: TextStyle(
                                    color: tokens.textMuted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0.1,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            // Sub-line reserved for role / tagline in a
                            // future revision — kept empty for spacing
                            // rhythm now.
                          ],
                        ),
                      ),
                      _OverflowMenuButton(post: p),
                    ],
                  ),

                  const SizedBox(height: 12),

                  // Content — larger + more leading than v1.
                  // Collapsed to 4 lines by default with "…more" toggle
                  // (item #9).
                  _ExpandableContent(text: p.content),

                  if (p.mediaUrls.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    // Constrain media width by matching the card's inner
                    // padding on the right side (the 8 px right pad above
                    // leaves the overflow button flush).
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _MediaGrid(urls: p.mediaUrls),
                    ),
                  ],

                  // Item #6: engagement summary line — only rendered if
                  // there's something to summarize (at least 1 like or
                  // 1 comment). Uses the optimistic `_likesCount` from
                  // the parent state so it reflects a fresh like tap
                  // before the server round-trip completes.
                  if (_likesCount > 0 || p.commentsCount > 0) ...[
                    const SizedBox(height: 10),
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _EngagementSummaryLine(
                        firstLiker: p.firstLiker,
                        likesCount: _likesCount,
                        commentsCount: p.commentsCount,
                        onTapLikers: () => _openLikersSheet(p),
                        onTapAuthor: (m) => _openAuthorProfile(m.id),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // ── Comment preview (item #11) ────────────────────────────
            // Rendered ABOVE the action band so it feels attached to
            // the content (LinkedIn pattern), not to the actions.
            if (p.topComment != null && p.commentsCount >= 1)
              _CommentPreviewLine(
                topComment: p.topComment!,
                totalComments: p.commentsCount,
                onOpenComments: _openComments,
              ),

            // ── Action band ───────────────────────────────────────────
            // Distinct tinted strip at the bottom of the card, so the
            // interactive actions have their own visual weight without
            // needing a divider line. Matches Threads / LinkedIn.
            Container(
              color: tokens.bgInput.withValues(alpha: 0.4),
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Row(
                children: [
                  _LikeButton(
                    liked: _liked,
                    count: _likesCount,
                    onTap: _toggleLike,
                  ),
                  const SizedBox(width: 4),
                  _ActionButton(
                    icon: Icons.mode_comment_outlined,
                    color: tokens.textSecondary,
                    label: _formatCount(p.commentsCount),
                    onTap: _openComments,
                  ),
                  const Spacer(),
                  _ActionButton(
                    icon: Icons.share_outlined,
                    color: tokens.textSecondary,
                    label: 'Share',
                    onTap: () {
                      // Item #17: native OS share sheet.
                      //   Body: "{content preview}\n\n{post URL}\n\n{first image URL}"
                      //   Subject: author name (falls back to app name)
                      // Chat apps like WhatsApp render both URLs as
                      // preview cards; email/SMS just includes the text.
                      final url =
                          'https://app.tamilbusinesstribe.com/community/posts/${p.id}';
                      final preview = p.content.length > 140
                          ? '${p.content.substring(0, 140)}…'
                          : p.content;
                      final parts = <String>[preview, url];
                      if (p.mediaUrls.isNotEmpty) {
                        parts.add(p.mediaUrls.first);
                      }
                      Share.share(
                        parts.join('\n\n'),
                        subject: p.memberName != null
                            ? '${p.memberName} on Tamil Business Tribe'
                            : 'Tamil Business Tribe',
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
    // Item #29: unapproved posts render slightly muted so the pending
    // pill isn't the only visual signal — the whole card reads as
    // "still cooking".
    return p.isApproved ? card : Opacity(opacity: 0.82, child: card);
  }
}

// ── Inline composer card (item #1) ─────────────────────────────────
//
// Collapsed 60 px pill that sits above the feed. Renders the current
// member's avatar + a "Share a win…" placeholder + Photo/Video quick
// icons. Tapping anywhere on the row opens the full [AchievementComposer]
// in a scrollable bottom sheet. The sheet auto-dismisses on successful
// submit via the composer's [onPosted] callback.

class InlineComposerCard extends ConsumerWidget {
  const InlineComposerCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final me = ref.watch(meNotifierProvider).valueOrNull;
    final photoUrl = (me as dynamic)?.avatarUrl as String?;
    final name = ((me as dynamic)?.name as String?)?.trim() ?? '';
    final myId = (me as dynamic)?.id as String?;

    void openComposer({VoidCallback? onOpened}) {
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        useSafeArea: true,
        builder: (ctx) {
          onOpened?.call();
          return _ComposerSheet();
        },
      );
    }

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: () => openComposer(),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          height: 60,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: tokens.bgSurface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: tokens.borderCard.withValues(alpha: 0.4),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 12,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              MemberAvatar(
                photoUrl: photoUrl,
                name: name,
                memberId: myId,
                size: 40,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Share a win, insight, or milestone…',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: tokens.textMuted,
                    fontSize: 14,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _QuickMediaIcon(
                icon: Icons.image_outlined,
                color: const Color(0xFF2F80ED),
                onTap: () => openComposer(),
              ),
              const SizedBox(width: 6),
              _QuickMediaIcon(
                icon: Icons.videocam_outlined,
                color: const Color(0xFF27AE60),
                onTap: () => openComposer(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickMediaIcon extends StatelessWidget {
  const _QuickMediaIcon({required this.icon, required this.color, required this.onTap});
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 32,
      height: 32,
      child: IconButton(
        icon: Icon(icon, color: color, size: 20),
        padding: EdgeInsets.zero,
        onPressed: onTap,
        splashRadius: 20,
      ),
    );
  }
}

class _ComposerSheet extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    // Take up to 90% of the screen so the emoji picker + attachment
    // preview don't overflow.
    final maxH = MediaQuery.sizeOf(context).height * 0.90;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Container(
      constraints: BoxConstraints(maxHeight: maxH),
      decoration: BoxDecoration(
        color: tokens.bgPage,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          // Push content above the keyboard when the text field is focused.
          padding: EdgeInsets.only(bottom: bottomInset),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: tokens.borderCard,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                  child: AchievementComposer(
                    onPosted: () {
                      // Refresh feed then dismiss the sheet.
                      ref.invalidateCommunityFeed();
                      if (Navigator.of(context).canPop()) {
                        Navigator.of(context).pop();
                      }
                    },
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

/// Gold "PENDING APPROVAL" pill shown next to the author name on
/// posts whose `isApproved == false` (item #29). Applies to two cases:
///   * Optimistic rows the composer just inserted locally
///   * The author's own not-yet-moderated posts on the "My Posts" tab
class _PendingBadge extends StatelessWidget {
  const _PendingBadge();
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: const Color(0xFFF59E0B).withValues(alpha: 0.4),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: const [
          Icon(Icons.schedule, color: Color(0xFFB8760F), size: 10),
          SizedBox(width: 4),
          Text(
            'PENDING',
            style: TextStyle(
              color: Color(0xFFB8760F),
              fontSize: 8.5,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _MentorBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFD4AF37).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: const Color(0xFFD4AF37).withValues(alpha: 0.4)),
      ),
      child: const Text(
        'MENTOR',
        style: TextStyle(
          color: Color(0xFFB8951F),
          fontSize: 8.5,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

/// Like button with Twitter/Instagram-style tap feedback (item #5).
///
/// On tap:
///   * `HapticFeedback.lightImpact()` — subtle physical response
///   * The heart icon **bounces** through a scale sequence
///     `1.0 → 1.4 → 0.9 → 1.0` over 320 ms with the peak at ~40% of
///     the timeline (feels punchier than a pure ease-in-out to 1.4)
///   * A red **ring pulses** outward from behind the icon, fading to
///     transparent over the same 320 ms (only fires when transitioning
///     from unliked → liked; a "de-liking" tap just does the shrink)
///   * The icon color cross-fades muted → red via [AnimatedSwitcher]
///     when the icon glyph itself changes (outline ↔ filled)
///
/// The animation runs off a single [AnimationController] and is
/// re-triggered by widget parent state changes (via `didUpdateWidget`)
/// so the burst only plays when `liked` actually flipped — not on every
/// rebuild of the surrounding card.
class _LikeButton extends StatefulWidget {
  const _LikeButton({
    required this.liked,
    required this.count,
    required this.onTap,
  });
  final bool liked;
  final int count;
  final VoidCallback onTap;

  @override
  State<_LikeButton> createState() => _LikeButtonState();
}

class _LikeButtonState extends State<_LikeButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;
  late final Animation<double> _ringScale;
  late final Animation<double> _ringOpacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );

    // Bouncy scale: 1.0 → 1.4 → 0.9 → 1.0. Weights loosely track the
    // Instagram like feel (fast up, gentle settle).
    _scale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 1.0, end: 1.4)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 40,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 1.4, end: 0.9)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 30,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 0.9, end: 1.0)
            .chain(CurveTween(curve: Curves.elasticOut)),
        weight: 30,
      ),
    ]).animate(_ctrl);

    // Ring: expands 0.6× → 2.0× while opacity 0.6 → 0. Only visible on
    // an unliked → liked transition (see didUpdateWidget).
    _ringScale = Tween<double>(begin: 0.6, end: 2.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic),
    );
    _ringOpacity = Tween<double>(begin: 0.6, end: 0.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic),
    );
  }

  @override
  void didUpdateWidget(covariant _LikeButton old) {
    super.didUpdateWidget(old);
    // Fire the burst whenever `liked` flipped. Both directions play the
    // scale bounce so the tap always feels responsive; only the ring
    // pulse would visually make sense on the unlike direction too
    // (still helpful haptic-ally).
    if (widget.liked != old.liked) {
      _ctrl.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _handleTap() {
    HapticFeedback.lightImpact();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final color = widget.liked ? kColorAccent : tokens.textSecondary;
    return InkWell(
      onTap: _handleTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Fixed-size stack so the icon + ring don't push the count
            // label around when the ring is at peak scale.
            SizedBox(
              width: 22,
              height: 22,
              child: AnimatedBuilder(
                animation: _ctrl,
                builder: (_, __) => Stack(
                  alignment: Alignment.center,
                  children: [
                    // Ring pulse (only visible when animating and only
                    // meaningful on the liked→unliked transition; harmless
                    // otherwise since it fades to 0).
                    if (widget.liked && _ctrl.isAnimating)
                      Transform.scale(
                        scale: _ringScale.value,
                        child: Opacity(
                          opacity: _ringOpacity.value,
                          child: Container(
                            width: 18,
                            height: 18,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: kColorAccent,
                                width: 2,
                              ),
                            ),
                          ),
                        ),
                      ),
                    // Bouncing heart, with icon glyph cross-fading
                    // between outlined and filled.
                    Transform.scale(
                      scale: _scale.value,
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 150),
                        transitionBuilder: (child, anim) =>
                            FadeTransition(opacity: anim, child: child),
                        child: Icon(
                          widget.liked
                              ? Icons.favorite
                              : Icons.favorite_border,
                          key: ValueKey(widget.liked),
                          size: 18,
                          color: color,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 4),
            // Count also cross-fades color as the like flips.
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 180),
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
              child: Text(_formatCount(widget.count)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(width: 6),
            Text(
              label.isEmpty ? '' : label,
              style: TextStyle(
                color: color,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Overflow ⋮ menu — author-aware bottom sheet (item #8).
///
/// Renders different actions based on who's viewing:
///   * **Author**: Copy link · **Delete post** (red, with confirmation)
///   * **Others**: Copy link · Save · Follow · Report (stubs marked
///     "Coming soon" — real implementations land in items #16, #21, #25)
class _OverflowMenuButton extends ConsumerWidget {
  const _OverflowMenuButton({required this.post});
  final CommunityPost post;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    return IconButton(
      icon: Icon(Icons.more_horiz, color: tokens.textMuted, size: 20),
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
      onPressed: () => _openSheet(context, ref),
    );
  }

  Future<void> _openSheet(BuildContext context, WidgetRef ref) async {
    final tokens = context.tokens;
    final me = ref.read(meNotifierProvider).valueOrNull;
    final myId = (me as dynamic)?.id as String?;
    final isAuthor = myId != null && myId == post.memberId;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: tokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: tokens.borderCard,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),
              _ActionTile(
                icon: Icons.link,
                label: 'Copy link',
                onTap: () async {
                  Navigator.pop(ctx);
                  await Clipboard.setData(
                    ClipboardData(text: _postUrl(post.id)),
                  );
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Link copied to clipboard.'),
                      behavior: SnackBarBehavior.floating,
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
              ),
              // Save/Unsave — available for everyone including author.
              _ActionTile(
                icon: post.isBookmarkedByMe
                    ? Icons.bookmark
                    : Icons.bookmark_border,
                label: post.isBookmarkedByMe ? 'Unsave' : 'Save',
                onTap: () async {
                  Navigator.pop(ctx);
                  await _toggleBookmark(context, ref);
                },
              ),
              if (!isAuthor) ...[
                _ActionTile(
                  icon: Icons.person_outline,
                  label: 'View ${post.memberName ?? "author"}\'s profile',
                  onTap: () {
                    Navigator.pop(ctx);
                    AuthorProfileSheet.open(context, post.memberId);
                  },
                ),
                _ActionTile(
                  icon: Icons.report_outlined,
                  label: 'Report',
                  onTap: () async {
                    Navigator.pop(ctx);
                    await _openReportSheet(context, ref);
                  },
                ),
              ],
              if (isAuthor)
                _ActionTile(
                  icon: Icons.delete_outline,
                  label: 'Delete post',
                  destructive: true,
                  onTap: () async {
                    Navigator.pop(ctx);
                    await _confirmAndDelete(context, ref);
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  static String _postUrl(String id) =>
      'https://app.tamilbusinesstribe.com/community/posts/$id';

  /// Report bottom sheet (item #25). Radios for the 5 reasons + a
  /// free-form "additional context" field. Submit → POST to backend.
  Future<void> _openReportSheet(BuildContext context, WidgetRef ref) async {
    final tokens = context.tokens;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: tokens.bgSurface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ReportSheet(postId: post.id),
    );
  }

  Future<void> _toggleBookmark(BuildContext context, WidgetRef ref) async {
    try {
      final now =
          await ref.read(communityServiceProvider).toggleBookmark(post.id);
      ref.invalidateCommunityFeed();
      ref.invalidate(communityBookmarksProvider);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(now ? 'Post saved.' : 'Removed from saved.'),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not update bookmark.'),
          backgroundColor: Color(0xFFD30814),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _confirmAndDelete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dctx) => AlertDialog(
        title: const Text('Delete post?'),
        content: const Text(
          'This will permanently remove the post and all its comments. '
          'This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dctx, true),
            style: TextButton.styleFrom(foregroundColor: kColorAccent),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref
          .read(communityServiceProvider)
          .deleteOwnPost(post.id);
      ref.invalidateCommunityFeed();
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Post deleted.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not delete post.'),
          backgroundColor: Color(0xFFD30814),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}

/// Report sheet (item #25). Radios for the 5 canonical reasons + a
/// free-form context field. Submits to `/api/community/posts/:id/report`
/// then dismisses with a green toast.
class _ReportSheet extends ConsumerStatefulWidget {
  const _ReportSheet({required this.postId});
  final String postId;

  @override
  ConsumerState<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends ConsumerState<_ReportSheet> {
  static const _reasons = <(String, String, IconData)>[
    ('spam', 'Spam', Icons.block),
    ('harassment', 'Harassment or bullying', Icons.shield_outlined),
    ('inappropriate', 'Inappropriate content', Icons.warning_amber),
    ('misinformation', 'False information', Icons.report_problem_outlined),
    ('other', 'Something else', Icons.more_horiz),
  ];

  String? _selected;
  final _detailCtl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _detailCtl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selected == null || _submitting) return;
    setState(() => _submitting = true);
    try {
      final already = await ref.read(communityServiceProvider).reportPost(
            postId: widget.postId,
            reason: _selected!,
            detail: _detailCtl.text.trim().isEmpty
                ? null
                : _detailCtl.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            already
                ? 'Already reported. Our team is reviewing it.'
                : 'Thanks — we\'ll take a look.',
          ),
          backgroundColor: const Color(0xFF27AE60),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not submit report.'),
          backgroundColor: Color(0xFFD30814),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(bottom: bottomInset),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: tokens.borderCard,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Why are you reporting this post?',
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Your report is anonymous. We\'ll review it as soon as we can.',
              textAlign: TextAlign.center,
              style: TextStyle(color: tokens.textMuted, fontSize: 12),
            ),
            const SizedBox(height: 10),
            for (final r in _reasons)
              RadioListTile<String>(
                value: r.$1,
                groupValue: _selected,
                onChanged: (v) => setState(() => _selected = v),
                dense: true,
                secondary: Icon(r.$3, color: tokens.textSecondary, size: 20),
                title: Text(
                  r.$2,
                  style: TextStyle(
                    color: tokens.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                activeColor: kColorAccent,
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
              child: TextField(
                controller: _detailCtl,
                maxLength: 500,
                maxLines: 2,
                style: TextStyle(color: tokens.textPrimary, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Add context (optional)',
                  hintStyle:
                      TextStyle(color: tokens.textMuted, fontSize: 13),
                  filled: true,
                  fillColor: tokens.bgInput,
                  counterText: '',
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
              child: SizedBox(
                width: double.infinity,
                height: 46,
                child: FilledButton(
                  onPressed:
                      _selected == null || _submitting ? null : _submit,
                  style: FilledButton.styleFrom(
                    backgroundColor: kColorAccent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor:
                        tokens.borderCard,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                    ),
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text('Submit report'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Sheet row — icon + primary label + optional subtitle + destructive
/// styling for delete/report/etc.
class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
    this.destructive = false,
  });
  final IconData icon;
  final String label;
  final String? subtitle;
  final bool destructive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final color = destructive ? kColorAccent : tokens.textPrimary;
    return ListTile(
      leading: Icon(icon, color: destructive ? kColorAccent : tokens.textSecondary),
      title: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 14.5,
          fontWeight: destructive ? FontWeight.w700 : FontWeight.w500,
        ),
      ),
      subtitle: subtitle == null
          ? null
          : Text(
              subtitle!,
              style: TextStyle(color: tokens.textMuted, fontSize: 12),
            ),
      onTap: onTap,
    );
  }
}

/// Floating "↑ N new posts" pill (item #13). Slides down + fades in
/// when [count] > 0, slides up + fades out otherwise. Tap → scrolls to
/// top of the feed.
class _NewPostsPill extends StatelessWidget {
  const _NewPostsPill({required this.count, required this.onTap});
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // AnimatedSwitcher handles both the enter (slide+fade) and the
    // dismiss (fade). SizedBox.shrink is the "hidden" branch so no tap
    // target is present when count == 0.
    return IgnorePointer(
      ignoring: count == 0,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        switchInCurve: Curves.easeOutBack,
        switchOutCurve: Curves.easeIn,
        transitionBuilder: (child, anim) {
          return FadeTransition(
            opacity: anim,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0, -0.6),
                end: Offset.zero,
              ).animate(anim),
              child: child,
            ),
          );
        },
        child: count == 0
            ? const SizedBox.shrink(key: ValueKey('empty'))
            : Center(
                key: ValueKey(count),
                child: Material(
                  color: kColorAccent,
                  borderRadius: BorderRadius.circular(24),
                  elevation: 6,
                  shadowColor: kColorAccent.withValues(alpha: 0.35),
                  child: InkWell(
                    onTap: onTap,
                    borderRadius: BorderRadius.circular(24),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.arrow_upward,
                              color: Colors.white, size: 14),
                          const SizedBox(width: 6),
                          Text(
                            count == 1
                                ? '1 new post'
                                : '$count new posts',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}

/// Pagination footer (item #28). Renders a subtle spinner while a
/// next page is loading, or a muted "You're all caught up" chip when
/// there's nothing left to fetch.
class _FeedFooter extends StatelessWidget {
  const _FeedFooter({required this.hasMore, required this.loadingMore});
  final bool hasMore;
  final bool loadingMore;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    if (loadingMore) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              color: kColorAccent,
              strokeWidth: 2,
            ),
          ),
        ),
      );
    }
    if (hasMore) return const SizedBox(height: 24);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Center(
        child: Text(
          'You\'re all caught up.',
          style: TextStyle(
            color: tokens.textMuted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

/// Full-screen empty state with a primary CTA (item #14). Filter-aware:
/// `all` / `mine` show a "Share your first win" button; `following` /
/// `mentors` show a subdued message with no button (posting in those
/// contexts doesn't make sense).
class _EmptyStateCta extends ConsumerWidget {
  const _EmptyStateCta({required this.filter});
  final String filter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final canPost = filter == 'all' || filter == 'mine';
    final heading = switch (filter) {
      'following' => 'You\'re not following anyone yet',
      'mentors' => 'No mentor posts yet',
      'mine' => 'You haven\'t posted yet',
      _ => 'No posts yet',
    };
    final subheading = switch (filter) {
      'following' =>
        'Explore For You to discover the tribe and follow people you find inspiring.',
      'mentors' =>
        'Mentor posts appear here as soon as they\'re published — check back soon.',
      'mine' => 'Share a win, insight, or milestone with the tribe.',
      _ => 'Be the first to share a win with the tribe.',
    };
    return ListView(
      // Keep scrollable so RefreshIndicator works even on empty state.
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(24, 96, 24, 100),
      children: [
        Icon(
          Icons.groups_rounded,
          size: 80,
          color: tokens.textMuted.withValues(alpha: 0.5),
        ),
        const SizedBox(height: 20),
        Text(
          heading,
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
          subheading,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: tokens.textSecondary,
            fontSize: 13,
            height: 1.5,
          ),
        ),
        if (canPost) ...[
          const SizedBox(height: 28),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 260),
              child: SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton.icon(
                  onPressed: () {
                    // Open the composer via the same bottom-sheet path
                    // the InlineComposerCard uses — so the "post" flow
                    // is identical whether you tap the header pill or
                    // the empty-state CTA.
                    showModalBottomSheet<void>(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      useSafeArea: true,
                      builder: (_) => _ComposerSheet(),
                    );
                  },
                  icon: const Icon(Icons.edit_note, size: 20),
                  label: const Text(
                    'Share your first win',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.2,
                    ),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: kColorAccent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Shimmer skeleton feed shown while the first page loads (item #12).
/// Renders 3 placeholder cards whose layout matches [CommunityPostCard]
/// so the actual list "settles in" without a visible layout shift.
class _FeedSkeleton extends StatelessWidget {
  const _FeedSkeleton();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    // Shimmer colors — use `bgInput` as base and a subtly-lighter tint
    // as the highlight. Works in both light and dark themes because we
    // derive from the theme tokens.
    final base = tokens.bgInput;
    final highlight = Color.alphaBlend(
      Colors.white.withValues(alpha: 0.06),
      base,
    );
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
      itemCount: 3,
      itemBuilder: (_, __) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Shimmer.fromColors(
          baseColor: base,
          highlightColor: highlight,
          period: const Duration(milliseconds: 1400),
          child: const _SkeletonCard(),
        ),
      ),
    );
  }
}

/// Single skeleton card — pure static geometry (all boxes are grey
/// blocks). Shimmer.fromColors wraps this and paints the highlight
/// sweep over every solid grey rectangle inside.
class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();

  static const _box = _SkeletonBox();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      decoration: BoxDecoration(
        color: tokens.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.borderCard),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header — avatar + name/time
                  Row(
                    children: const [
                      _SkeletonBox(width: 44, height: 44, radius: 22),
                      SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _SkeletonBox(width: 120, height: 12, radius: 6),
                            SizedBox(height: 6),
                            _SkeletonBox(width: 60, height: 10, radius: 5),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  // Content — 2 full-width lines + one shorter
                  _SkeletonBox(width: double.infinity, height: 12, radius: 6),
                  const SizedBox(height: 8),
                  _SkeletonBox(width: double.infinity, height: 12, radius: 6),
                  const SizedBox(height: 8),
                  _box,
                  const SizedBox(height: 16),
                  // Media placeholder — matches the 16:10 single-image
                  // layout that most demo posts use.
                  AspectRatio(
                    aspectRatio: 16 / 10,
                    child: _SkeletonBox(
                      width: double.infinity,
                      height: double.infinity,
                      radius: 10,
                    ),
                  ),
                ],
              ),
            ),
            // Action band placeholder — 3 grey pills to hint at the
            // like/comment/share row.
            Container(
              color: tokens.bgInput.withValues(alpha: 0.4),
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: Row(
                children: const [
                  _SkeletonBox(width: 44, height: 18, radius: 4),
                  SizedBox(width: 14),
                  _SkeletonBox(width: 44, height: 18, radius: 4),
                  Spacer(),
                  _SkeletonBox(width: 60, height: 18, radius: 4),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Rounded grey rectangle — the primitive Shimmer sweeps over.
class _SkeletonBox extends StatelessWidget {
  const _SkeletonBox({
    this.width = 200,
    this.height = 12,
    this.radius = 4,
  });
  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: context.tokens.bgInput,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

/// Expandable post content (item #9). Caps at [maxLines] by default;
/// if the text would overflow at the given width, appends an inline
/// "…more" red link. Tapping "…more" expands to full text via
/// [AnimatedCrossFade] (200 ms). No collapse back once expanded — Twitter
/// / LinkedIn convention (users rarely want to re-hide what they just
/// chose to read).
class _ExpandableContent extends StatefulWidget {
  const _ExpandableContent({required this.text, this.maxLines = 4});
  final String text;
  final int maxLines;

  @override
  State<_ExpandableContent> createState() => _ExpandableContentState();
}

class _ExpandableContentState extends State<_ExpandableContent> {
  bool _expanded = false;

  static const _style = TextStyle(
    fontSize: 15.5,
    height: 1.55,
  );

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final baseStyle = _style.copyWith(color: tokens.textPrimary);

    // Build rich spans once — includes @mentions and #hashtags as
    // tappable red segments (item #26). The same list is used for both
    // the collapsed probe and the expanded render, so parsing runs once.
    final richSpans = buildMentionSpans(
      widget.text,
      baseStyle: baseStyle,
      onMention: (name) => _handleMentionTap(context, name),
      onHashtag: (tag) => _handleHashtagTap(context, tag),
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final tp = TextPainter(
          text: TextSpan(children: richSpans),
          maxLines: widget.maxLines,
          textDirection: TextDirection.ltr,
        )..layout(maxWidth: constraints.maxWidth);
        final overflowing = tp.didExceedMaxLines;

        return AnimatedCrossFade(
          duration: const Duration(milliseconds: 200),
          crossFadeState: _expanded || !overflowing
              ? CrossFadeState.showSecond
              : CrossFadeState.showFirst,
          firstChild: _buildCollapsed(richSpans),
          secondChild: RichText(
            text: TextSpan(children: richSpans),
          ),
          alignment: Alignment.topLeft,
          layoutBuilder: (top, topKey, bottom, bottomKey) => Stack(
            alignment: Alignment.topLeft,
            children: [
              Positioned(key: bottomKey, child: bottom),
              Positioned(key: topKey, child: top),
            ],
          ),
        );
      },
    );
  }

  Widget _buildCollapsed(List<InlineSpan> richSpans) {
    // Append an inline "…more" link. Uses the same rich spans (with
    // @mentions styled) then attaches the toggle span at the end.
    final all = [
      ...richSpans,
      TextSpan(
        text: '  …more',
        style: const TextStyle(
          color: kColorAccent,
          fontSize: 14.5,
          fontWeight: FontWeight.w700,
        ),
        recognizer: TapGestureRecognizer()
          ..onTap = () => setState(() => _expanded = true),
      ),
    ];
    return RichText(
      maxLines: widget.maxLines,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(children: all),
    );
  }

  void _handleMentionTap(BuildContext context, String name) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('@$name — mention linking coming soon.'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _handleHashtagTap(BuildContext context, String tag) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('#$tag — hashtag feeds coming soon.'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }
}

/// "Liked by <first liker> and N others · M comments" line (item #6).
/// Renders inline as a single line of small muted text. Names are bold
/// and tap-able; the "N others" segment opens [LikersSheet]; the
/// author name segment fires [onTapAuthor] for the profile stub.
class _EngagementSummaryLine extends StatelessWidget {
  const _EngagementSummaryLine({
    required this.firstLiker,
    required this.likesCount,
    required this.commentsCount,
    required this.onTapLikers,
    required this.onTapAuthor,
  });

  final CommunityMemberRef? firstLiker;
  final int likesCount;
  final int commentsCount;
  final VoidCallback onTapLikers;
  final ValueChanged<CommunityMemberRef> onTapAuthor;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final baseStyle = TextStyle(
      color: tokens.textSecondary,
      fontSize: 12,
      fontWeight: FontWeight.w500,
      height: 1.35,
    );
    final boldStyle = baseStyle.copyWith(
      color: tokens.textPrimary,
      fontWeight: FontWeight.w800,
    );
    final segments = <InlineSpan>[];

    // Likes segment (only if likesCount > 0).
    if (likesCount > 0) {
      segments.add(TextSpan(text: 'Liked by ', style: baseStyle));
      final liker = firstLiker;
      if (liker != null) {
        segments.add(
          TextSpan(
            text: liker.displayName,
            style: boldStyle,
            recognizer: TapGestureRecognizer()
              ..onTap = () => onTapAuthor(liker),
          ),
        );
        final others = likesCount - 1;
        if (others > 0) {
          segments.add(TextSpan(text: ' and ', style: baseStyle));
          segments.add(
            TextSpan(
              text: '${_formatCount(others)} other${others == 1 ? '' : 's'}',
              style: boldStyle,
              recognizer: TapGestureRecognizer()..onTap = onTapLikers,
            ),
          );
        }
      } else {
        // No firstLiker attached — just show the count with tap-target.
        segments.add(
          TextSpan(
            text: '${_formatCount(likesCount)} '
                '${likesCount == 1 ? 'person' : 'people'}',
            style: boldStyle,
            recognizer: TapGestureRecognizer()..onTap = onTapLikers,
          ),
        );
      }
    }

    // Comments segment. If both likes + comments render, separate them
    // with a middle dot.
    if (commentsCount > 0) {
      if (segments.isNotEmpty) {
        segments.add(TextSpan(text: '  ·  ', style: baseStyle));
      }
      segments.add(
        TextSpan(
          text: '${_formatCount(commentsCount)} '
              'comment${commentsCount == 1 ? '' : 's'}',
          style: baseStyle,
        ),
      );
    }

    if (segments.isEmpty) return const SizedBox.shrink();

    return RichText(
      text: TextSpan(children: segments),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );
  }
}

/// Inline top-comment preview (item #11). Sits under the post content
/// / above the action band. Renders as:
///
///   Priya  Massive congrats! What was the biggest un…
///   View all 12 comments
///
/// Author name is bold; content is 1 line ellipsis. Tapping any part of
/// the row opens [CommentSheet] (via [onOpenComments]).
class _CommentPreviewLine extends StatelessWidget {
  const _CommentPreviewLine({
    required this.topComment,
    required this.totalComments,
    required this.onOpenComments,
  });
  final CommentPreview topComment;
  final int totalComments;
  final VoidCallback onOpenComments;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final author = topComment.member?.displayName ?? 'Member';
    return InkWell(
      onTap: onOpenComments,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Author + comment content on one line, single-line ellipsis
            // so the row height is predictable across posts.
            RichText(
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              text: TextSpan(
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 13,
                  height: 1.35,
                ),
                children: [
                  TextSpan(
                    text: '$author  ',
                    style: TextStyle(
                      color: tokens.textPrimary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  TextSpan(
                    text: topComment.content,
                    style: TextStyle(
                      color: tokens.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            if (totalComments > 1) ...[
              const SizedBox(height: 4),
              Text(
                'View all $totalComments comments',
                style: TextStyle(
                  color: kColorAccent,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ] else ...[
              const SizedBox(height: 4),
              Text(
                'View comment',
                style: TextStyle(
                  color: kColorAccent,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet listing everyone who liked a post (item #6). Uses the
/// `communityLikersProvider(postId)` family.
class LikersSheet extends ConsumerWidget {
  const LikersSheet({super.key, required this.postId, required this.totalLikes});
  final String postId;
  final int totalLikes;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(communityLikersProvider(postId));
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (_, controller) => Container(
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: tokens.borderCard,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              totalLikes == 1
                  ? '1 person liked this'
                  : '${_formatCount(totalLikes)} people liked this',
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Divider(color: tokens.borderCard, height: 1),
            Expanded(
              child: async.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: kColorAccent),
                ),
                error: (_, __) => Center(
                  child: Text(
                    'Could not load likers.',
                    style: TextStyle(color: tokens.textSecondary),
                  ),
                ),
                data: (members) {
                  if (members.isEmpty) {
                    return Center(
                      child: Text(
                        'No one has liked this yet.',
                        style: TextStyle(color: tokens.textMuted),
                      ),
                    );
                  }
                  return ListView.separated(
                    controller: controller,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: members.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 2),
                    itemBuilder: (_, i) {
                      final m = members[i];
                      return ListTile(
                        leading: MemberAvatar(
                          photoUrl: m.profilePhotoUrl,
                          name: m.displayName,
                          memberId: m.id,
                          size: 40,
                        ),
                        title: Text(
                          m.displayName,
                          style: TextStyle(
                            color: tokens.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        onTap: () {
                          Navigator.of(context).pop();
                          AuthorProfileSheet.open(context, m.id);
                        },
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MediaGrid extends StatelessWidget {
  const _MediaGrid({required this.urls});
  final List<String> urls;

  /// Video URLs get their own viewer; image URLs go to the paginated
  /// image lightbox (which supports pinch-zoom + swipe between images).
  /// Item #23 keeps videos and images in the same `mediaUrls` array —
  /// this dispatch decides the correct route per URL.
  void _open(BuildContext context, int index) {
    final url = urls[index];
    if (isVideoUrl(url)) {
      VideoViewer.open(context, url);
      return;
    }
    // For images, filter out any videos from the pageable list so
    // swiping doesn't land on a video (which the image viewer can't
    // render). Then find our new index inside the filtered list.
    final imageUrls =
        urls.where((u) => !isVideoUrl(u)).toList(growable: false);
    final imgIndex = imageUrls.indexOf(url);
    FullscreenImageViewer.open(
      context,
      urls: imageUrls,
      initialIndex: imgIndex < 0 ? 0 : imgIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (urls.length == 1) {
      // Single image/video: fill card width, height derived from the
      // image's real aspect ratio — no crop, no forced 16:10 box.
      return _TappableImage(
        url: urls[0],
        onTap: () => _open(context, 0),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: LayoutBuilder(
            builder: (ctx, cons) =>
                _MediaThumb(url: urls[0], width: cons.maxWidth),
          ),
        ),
      );
    }
    // 2 or more: horizontal scroll. Fixed height, width per image is
    // computed from its natural aspect so nothing gets squashed to a
    // square.
    const stripHeight = 220.0;
    return SizedBox(
      height: stripHeight,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: urls.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) => _TappableImage(
          url: urls[i],
          onTap: () => _open(context, i),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: _MediaThumb(url: urls[i], height: stripHeight),
          ),
        ),
      ),
    );
  }
}

/// Renders either a static image (default) or a video thumbnail with
/// a black scrim + centered play icon (item #23). Videos in the MVP
/// don't have a real poster frame — the play glyph on a solid dark
/// background is enough to communicate "this is a video".
class _MediaThumb extends StatelessWidget {
  const _MediaThumb({required this.url, this.width, this.height});
  final String url;

  /// Constrain the thumbnail to this width; height comes from the
  /// image's natural aspect. Used by the single-image layout.
  final double? width;

  /// Constrain the thumbnail to this height; width comes from the
  /// image's natural aspect. Used by the horizontal multi-image strip.
  final double? height;

  @override
  Widget build(BuildContext context) {
    if (!isVideoUrl(url)) {
      // No `fit` — Image sizes itself from intrinsic pixel dimensions
      // and the single provided constraint (width OR height), so the
      // real aspect ratio is preserved with no crop or squash.
      final dpr = MediaQuery.devicePixelRatioOf(context);
      return CachedNetworkImage(
        imageUrl: url,
        width: width,
        height: height,
        memCacheWidth:
            width != null ? (width! * dpr).round().clamp(1, 2000) : null,
        memCacheHeight:
            height != null ? (height! * dpr).round().clamp(1, 2000) : null,
        placeholder: (_, __) => Container(
          width: width,
          height: height ?? (width != null ? width! * 9 / 16 : 160),
          color: Colors.white.withValues(alpha: 0.05),
        ),
      );
    }
    // Videos have no real poster yet — fall back to a 16:9 box sized
    // from whichever constraint the caller passed.
    final w = width ?? (height != null ? height! * 16 / 9 : 200.0);
    final h = height ?? (width != null ? width! * 9 / 16 : 120.0);
    return SizedBox(
      width: w,
      height: h,
      child: Stack(
        fit: StackFit.expand,
        alignment: Alignment.center,
        children: [
          Container(color: Colors.black),
        // Subtle sheen — matches most social apps' video poster style.
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withValues(alpha: 0.04),
                Colors.black.withValues(alpha: 0.4),
              ],
            ),
          ),
        ),
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.black.withValues(alpha: 0.55),
            border: Border.all(color: Colors.white24, width: 1),
          ),
          child: const Icon(Icons.play_arrow, color: Colors.white, size: 26),
        ),
        // Small "VIDEO" badge bottom-left so the affordance is obvious
        // even when the play icon is scaled small in a thumbnail grid.
        Positioned(
          left: 6,
          bottom: 6,
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Text(
              'VIDEO',
              style: TextStyle(
                color: Colors.white,
                fontSize: 9,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ),
        ],
      ),
    );
  }
}

/// Thin wrapper — makes an image tap-target-able with a subtle splash.
/// Kept separate from [_MediaGrid] so the tap ripple sits above the
/// image without interfering with the outer card's InkWell handling.
class _TappableImage extends StatelessWidget {
  const _TappableImage({
    required this.url,
    required this.child,
    required this.onTap,
  });
  final String url;
  final Widget child;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: child,
      ),
    );
  }
}

// ── Comment sheet (bottom modal) ───────────────────────────────────

class CommentSheet extends ConsumerStatefulWidget {
  const CommentSheet({super.key, required this.post});
  final CommunityPost post;

  @override
  ConsumerState<CommentSheet> createState() => _CommentSheetState();
}

class _CommentSheetState extends ConsumerState<CommentSheet> {
  final _ctl = TextEditingController();
  final _focus = FocusNode();
  bool _submitting = false;

  /// Item #18 — when set, the next submit will attach `parentCommentId`
  /// so the new comment becomes a reply. Cleared after successful send
  /// or when the user cancels via the "×" on the reply chip.
  CommunityComment? _replyingTo;

  @override
  void dispose() {
    _ctl.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _startReply(CommunityComment target) {
    setState(() => _replyingTo = target);
    // Pre-fill @author so the reply is anchored contextually. The user
    // can delete/edit it before sending.
    final name = target.memberName ?? 'Member';
    final mention = '@$name ';
    if (!_ctl.text.startsWith(mention)) {
      _ctl.text = mention;
      _ctl.selection = TextSelection.fromPosition(
        TextPosition(offset: _ctl.text.length),
      );
    }
    _focus.requestFocus();
  }

  void _cancelReply() {
    setState(() => _replyingTo = null);
  }

  Future<void> _submit() async {
    final text = _ctl.text.trim();
    if (text.isEmpty || _submitting) return;
    setState(() => _submitting = true);
    try {
      await ref.read(communityServiceProvider).addComment(
            postId: widget.post.id,
            content: text,
            parentCommentId: _replyingTo?.id,
          );
      ref.invalidate(communityCommentsProvider(widget.post.id));
      ref.invalidateCommunityFeed();
      if (!mounted) return;
      _ctl.clear();
      setState(() => _replyingTo = null);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not post comment.'),
          backgroundColor: Color(0xFFD30814),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// Groups a flat comment list into (root, replies[]) buckets so the
  /// UI can render each root followed by its indented children. Sort
  /// order preserved from the backend (createdAt asc).
  Map<String, List<CommunityComment>> _bucketReplies(
    List<CommunityComment> all,
  ) {
    final map = <String, List<CommunityComment>>{};
    for (final c in all) {
      final pid = c.parentCommentId;
      if (pid != null) {
        map.putIfAbsent(pid, () => []).add(c);
      }
    }
    return map;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final me = ref.watch(meNotifierProvider).valueOrNull;
    final async = ref.watch(communityCommentsProvider(widget.post.id));
    final height = MediaQuery.sizeOf(context).height * 0.75;
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Container(
        height: height,
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: tokens.borderCard,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Comments',
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Divider(color: tokens.borderCard, height: 1),
            Expanded(
              child: async.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: kColorAccent),
                ),
                error: (_, __) => Center(
                  child: Text(
                    'Could not load comments.',
                    style: TextStyle(color: tokens.textSecondary),
                  ),
                ),
                data: (comments) {
                  if (comments.isEmpty) {
                    return Center(
                      child: Text(
                        'Be the first to comment.',
                        style: TextStyle(color: tokens.textMuted),
                      ),
                    );
                  }
                  // Item #18: split into roots + replies, render each
                  // root followed by its indented children.
                  final replies = _bucketReplies(comments);
                  final roots =
                      comments.where((c) => c.parentCommentId == null).toList();
                  return ListView.builder(
                    controller: scrollController,
                    padding: const EdgeInsets.all(14),
                    itemCount: roots.length,
                    itemBuilder: (_, i) {
                      final root = roots[i];
                      final replyList = replies[root.id] ?? const [];
                      return Padding(
                        padding: EdgeInsets.only(
                          bottom: i == roots.length - 1 ? 0 : 14,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _CommentRow(
                              comment: root,
                              indented: false,
                              onReply: () => _startReply(root),
                            ),
                            for (final r in replyList) ...[
                              const SizedBox(height: 10),
                              _CommentRow(
                                comment: r,
                                indented: true,
                                onReply: () => _startReply(root),
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
            ),
            // Composer row (with optional "Replying to …" chip above)
            SafeArea(
              top: false,
              child: Container(
                decoration: BoxDecoration(
                  color: tokens.bgSurface,
                  border: Border(
                    top: BorderSide(color: tokens.borderCard),
                  ),
                ),
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_replyingTo != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Icon(Icons.reply,
                                size: 14, color: kColorAccent),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Replying to ${_replyingTo!.memberName ?? "Member"}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: tokens.textSecondary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            InkWell(
                              onTap: _cancelReply,
                              borderRadius: BorderRadius.circular(12),
                              child: Padding(
                                padding: const EdgeInsets.all(4),
                                child: Icon(Icons.close,
                                    size: 16, color: tokens.textMuted),
                              ),
                            ),
                          ],
                        ),
                      ),
                    Row(
                      children: [
                        MemberAvatar(
                          photoUrl: (me as dynamic)?.avatarUrl as String?,
                          name: (me as dynamic)?.name as String?,
                          memberId: (me as dynamic)?.id as String?,
                          size: 32,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _ctl,
                            focusNode: _focus,
                            minLines: 1,
                            maxLines: 4,
                            style: TextStyle(
                              color: tokens.textPrimary,
                              fontSize: 14,
                            ),
                            decoration: InputDecoration(
                              hintText: _replyingTo == null
                                  ? 'Add a comment…'
                                  : 'Write your reply…',
                              hintStyle: TextStyle(
                                color: tokens.textMuted,
                                fontSize: 14,
                              ),
                              filled: true,
                              fillColor: tokens.bgInput,
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(20),
                                borderSide: BorderSide.none,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Material(
                          color: kColorAccent,
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: _submitting ? null : _submit,
                            child: Container(
                              width: 40,
                              height: 40,
                              alignment: Alignment.center,
                              child: _submitting
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        color: Colors.white,
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.send_rounded,
                                      color: Colors.white, size: 18),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One comment (root or reply) with author tap-through, comment-like
/// heart (item #19), and Reply link (item #18).
///
/// [indented] true → this is a reply; renders with 32 px left padding
/// and a subtle vertical connector line so the parent grouping is
/// visually obvious without a full tree control.
class _CommentRow extends ConsumerStatefulWidget {
  const _CommentRow({
    required this.comment,
    required this.indented,
    required this.onReply,
  });
  final CommunityComment comment;
  final bool indented;
  final VoidCallback onReply;

  @override
  ConsumerState<_CommentRow> createState() => _CommentRowState();
}

class _CommentRowState extends ConsumerState<_CommentRow> {
  late bool _liked = widget.comment.isLikedByMe;
  late int _likesCount = widget.comment.likesCount;
  bool _likeBusy = false;

  Future<void> _toggleLike() async {
    if (_likeBusy) return;
    setState(() {
      _likeBusy = true;
      _liked = !_liked;
      _likesCount += _liked ? 1 : -1;
      if (_likesCount < 0) _likesCount = 0;
    });
    HapticFeedback.selectionClick();
    try {
      final r = await ref
          .read(communityServiceProvider)
          .toggleCommentLike(widget.comment.id);
      if (!mounted) return;
      setState(() {
        _liked = r.liked;
        _likesCount = r.likesCount;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _liked = !_liked;
        _likesCount += _liked ? 1 : -1;
      });
    } finally {
      if (mounted) setState(() => _likeBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final c = widget.comment;
    final child = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () => AuthorProfileSheet.open(context, c.memberId),
          child: MemberAvatar(
            photoUrl: c.memberPhoto,
            name: c.memberName,
            memberId: c.memberId,
            size: widget.indented ? 26 : 30,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: tokens.bgInput,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GestureDetector(
                      onTap: () =>
                          AuthorProfileSheet.open(context, c.memberId),
                      child: Text(
                        c.memberName ?? 'Member',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: tokens.textPrimary,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    // Item #26: highlight @mentions + #hashtags inside
                    // the comment content as tappable red spans.
                    RichText(
                      text: TextSpan(
                        children: buildMentionSpans(
                          c.content,
                          baseStyle: TextStyle(
                            color: tokens.textPrimary,
                            fontSize: 13,
                            height: 1.35,
                          ),
                          onMention: (name) => ScaffoldMessenger.of(context)
                              .showSnackBar(SnackBar(
                            content: Text('@$name — profile linking coming soon.'),
                            behavior: SnackBarBehavior.floating,
                            duration: const Duration(seconds: 2),
                          )),
                          onHashtag: (tag) => ScaffoldMessenger.of(context)
                              .showSnackBar(SnackBar(
                            content: Text('#$tag — hashtag feeds coming soon.'),
                            behavior: SnackBarBehavior.floating,
                            duration: const Duration(seconds: 2),
                          )),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // Action strip under the bubble — time · Like · Reply
              Padding(
                padding:
                    const EdgeInsets.only(top: 6, left: 4, right: 4),
                child: Row(
                  children: [
                    Text(
                      timeAgo(c.createdAt),
                      style: TextStyle(
                        color: tokens.textMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 14),
                    InkWell(
                      onTap: _toggleLike,
                      borderRadius: BorderRadius.circular(6),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 2, vertical: 2),
                        child: Row(
                          children: [
                            Icon(
                              _liked
                                  ? Icons.favorite
                                  : Icons.favorite_border,
                              size: 14,
                              color: _liked
                                  ? kColorAccent
                                  : tokens.textMuted,
                            ),
                            if (_likesCount > 0) ...[
                              const SizedBox(width: 4),
                              Text(
                                '$_likesCount',
                                style: TextStyle(
                                  color: _liked
                                      ? kColorAccent
                                      : tokens.textSecondary,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    // Reply is only offered on root comments — level-2
                    // replies flatten back to the root, so it's clearer
                    // to hide the affordance here.
                    if (!widget.indented)
                      InkWell(
                        onTap: widget.onReply,
                        borderRadius: BorderRadius.circular(6),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 2, vertical: 2),
                          child: Text(
                            'Reply',
                            style: TextStyle(
                              color: tokens.textSecondary,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );

    if (!widget.indented) return child;

    // Nested reply — indent 32 px and paint a subtle vertical connector
    // line on the left so the parent grouping is clear without a full
    // tree control.
    return Padding(
      padding: const EdgeInsets.only(left: 32),
      child: Stack(
        children: [
          Positioned(
            left: -20,
            top: 12,
            bottom: 12,
            child: Container(width: 2, color: tokens.borderCard),
          ),
          child,
        ],
      ),
    );
  }
}

// ── helpers ────────────────────────────────────────────────────────

String _formatCount(int n) {
  if (n <= 0) return '';
  if (n < 1000) return '$n';
  final k = (n / 100).round() / 10;
  return '${k}k';
}

// `timeAgo` now lives in lib/shared/utils/time_ago.dart (item #7).

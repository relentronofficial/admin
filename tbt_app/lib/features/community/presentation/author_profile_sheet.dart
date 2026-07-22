import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/member_avatar.dart';
import '../../dashboard/data/community_service.dart';
import '../../../shared/widgets/app_loader.dart';

/// Bottom sheet with a compact author profile (item #20).
///
/// Layout (top → bottom):
///   * Drag handle
///   * Cover strip (linear gradient, hue derived from memberId)
///   * Overlapping 96 px avatar
///   * Name (22 w800) · role line · location
///   * Stats row: Posts · Followers · Following
///   * Follow (primary red) + Message (outline secondary) buttons —
///     both currently stubs. Follow lands with item #21, Message with a
///     later revision that wires it into the existing /messages tab.
///   * Recent posts thumbnail row (up to 3)
///
/// Opened via [AuthorProfileSheet.open]. Uses a DraggableScrollableSheet
/// (0.6 initial → 0.95 max) so users can drag it up for the full profile
/// or dismiss with a downward flick.
class AuthorProfileSheet extends ConsumerWidget {
  const AuthorProfileSheet({super.key, required this.memberId});
  final String memberId;

  static Future<void> open(BuildContext context, String memberId) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => AuthorProfileSheet(memberId: memberId),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(communityMemberProfileProvider(memberId));
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (_, controller) => Container(
        decoration: BoxDecoration(
          color: tokens.bgPage,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: async.when(
          loading: () => _wrapDrag(
              tokens, const AppLoader.center()),
          error: (_, __) => _wrapDrag(
            tokens,
            Center(
              child: Text(
                'Could not load profile.',
                style: TextStyle(color: tokens.textSecondary),
              ),
            ),
          ),
          data: (p) => _buildBody(context, controller, tokens, p),
        ),
      ),
    );
  }

  Widget _wrapDrag(ThemeTokens tokens, Widget child) => Column(
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
          Expanded(child: child),
        ],
      );

  Widget _buildBody(
    BuildContext context,
    ScrollController controller,
    ThemeTokens tokens,
    CommunityMemberProfile profile,
  ) {
    return CustomScrollView(
      controller: controller,
      slivers: [
        SliverToBoxAdapter(
          child: Column(
            children: [
              const SizedBox(height: 10),
              // Drag handle.
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: tokens.borderCard,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),
              _CoverBanner(memberId: profile.member.id),
              // Overlapping avatar — pulled up 48 px so half sits on the
              // cover, half on the surface.
              Transform.translate(
                offset: const Offset(0, -48),
                child: MemberAvatar(
                  photoUrl: profile.member.profilePhotoUrl,
                  name: profile.member.displayName,
                  memberId: profile.member.id,
                  size: 88,
                  isMentor: false,
                ),
              ),
              // Pull the following content up so it sits close to the
              // avatar's bottom edge (compensates for the translate).
              Transform.translate(
                offset: const Offset(0, -32),
                child: _ProfileHeader(profile: profile),
              ),
              Transform.translate(
                offset: const Offset(0, -24),
                child: _ProfileActions(profile: profile),
              ),
              if (profile.recentPosts.isNotEmpty) ...[
                const SizedBox(height: 4),
                _RecentPosts(posts: profile.recentPosts),
              ],
              const SizedBox(height: 40),
            ],
          ),
        ),
      ],
    );
  }
}

/// Cover strip — deterministic gradient from memberId hash so every
/// member gets a stable "banner color". Same seeding logic idea as
/// [MemberAvatar] so the two visuals sit in the same palette family.
class _CoverBanner extends StatelessWidget {
  const _CoverBanner({required this.memberId});
  final String memberId;

  @override
  Widget build(BuildContext context) {
    final seed = _stableSeed(memberId);
    final hue = (seed % 360).toDouble();
    return Container(
      height: 110,
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            HSLColor.fromAHSL(1.0, hue, 0.60, 0.55).toColor(),
            HSLColor.fromAHSL(1.0, (hue + 40) % 360, 0.55, 0.35).toColor(),
          ],
        ),
      ),
    );
  }

  static int _stableSeed(String s) {
    if (s.isEmpty) return 210;
    int h = 0x811c9dc5;
    for (int i = 0; i < s.length; i++) {
      h ^= s.codeUnitAt(i);
      h = (h * 0x01000193) & 0xffffffff;
    }
    return h.abs();
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.profile});
  final CommunityMemberProfile profile;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          Text(
            profile.member.displayName,
            style: TextStyle(
              color: tokens.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.2,
            ),
          ),
          if (profile.roleLine.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              profile.roleLine,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: tokens.textSecondary,
                fontSize: 13,
              ),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _StatBlock(label: 'Posts', value: profile.postsCount),
              _StatBlock(label: 'Followers', value: profile.followersCount),
              _StatBlock(label: 'Following', value: profile.followingCount),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatBlock extends StatelessWidget {
  const _StatBlock({required this.label, required this.value});
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      children: [
        Text(
          _formatCount(value),
          style: TextStyle(
            color: tokens.textPrimary,
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            color: tokens.textMuted,
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.3,
          ),
        ),
      ],
    );
  }

  String _formatCount(int n) {
    if (n < 1000) return '$n';
    final k = (n / 100).round() / 10;
    return '${k}k';
  }
}

class _ProfileActions extends ConsumerStatefulWidget {
  const _ProfileActions({required this.profile});
  final CommunityMemberProfile profile;

  @override
  ConsumerState<_ProfileActions> createState() => _ProfileActionsState();
}

class _ProfileActionsState extends ConsumerState<_ProfileActions> {
  late bool _following = widget.profile.isFollowing;
  late int _followers = widget.profile.followersCount;
  bool _busy = false;

  Future<void> _toggleFollow() async {
    if (_busy) return;
    // Optimistic: flip immediately + update follower count.
    setState(() {
      _busy = true;
      _following = !_following;
      _followers += _following ? 1 : -1;
      if (_followers < 0) _followers = 0;
    });
    try {
      final now = await ref
          .read(communityServiceProvider)
          .toggleFollow(widget.profile.member.id);
      if (!mounted) return;
      setState(() => _following = now);
      // Invalidate feed so the "Following" tab picks up the change and
      // the profile provider so a re-open shows accurate counts.
      ref.invalidateCommunityFeed();
      ref.invalidate(
        communityMemberProfileProvider(widget.profile.member.id),
      );
    } catch (_) {
      if (!mounted) return;
      // Roll back.
      setState(() {
        _following = !_following;
        _followers += _following ? 1 : -1;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not update follow.'),
          backgroundColor: Color(0xFFD30814),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: SizedBox(
              height: 44,
              child: FilledButton.icon(
                onPressed: _busy ? null : _toggleFollow,
                icon: Icon(
                  _following ? Icons.check : Icons.person_add_alt_1,
                  size: 18,
                ),
                label: Text(_following ? 'Following' : 'Follow'),
                style: FilledButton.styleFrom(
                  // "Following" state is subdued — matches Instagram /
                  // Threads pattern where "following" is a lower-key
                  // outline so the primary action visually shifts.
                  backgroundColor: _following
                      ? tokens.bgInput
                      : kColorAccent,
                  foregroundColor:
                      _following ? tokens.textPrimary : Colors.white,
                  side: _following
                      ? BorderSide(color: tokens.borderCard)
                      : BorderSide.none,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: SizedBox(
              height: 44,
              child: OutlinedButton.icon(
                onPressed: () => _stub(context, 'Message'),
                icon: const Icon(Icons.mail_outline, size: 18),
                label: const Text('Message'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: tokens.textPrimary,
                  side: BorderSide(color: tokens.borderCard),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _stub(BuildContext context, String feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$feature — coming soon.'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }
}

class _RecentPosts extends StatelessWidget {
  const _RecentPosts({required this.posts});
  final List<CommunityRecentPost> posts;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 3,
                height: 14,
                decoration: BoxDecoration(
                  color: kColorAccent,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Recent posts',
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (int i = 0; i < posts.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(child: _RecentPostTile(post: posts[i])),
              ],
              // If fewer than 3, pad with empty slots so the layout
              // doesn't stretch the existing tiles across the row.
              for (int i = posts.length; i < 3; i++) ...[
                const SizedBox(width: 8),
                const Expanded(child: SizedBox()),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _RecentPostTile extends StatelessWidget {
  const _RecentPostTile({required this.post});
  final CommunityRecentPost post;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final url = post.mediaUrls.isNotEmpty ? post.mediaUrls.first : null;
    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        decoration: BoxDecoration(
          color: tokens.bgInput,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: tokens.borderCard),
        ),
        clipBehavior: Clip.antiAlias,
        child: url != null
            ? CachedNetworkImage(imageUrl: url, fit: BoxFit.cover)
            : Center(
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: Text(
                    post.content,
                    textAlign: TextAlign.center,
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: tokens.textSecondary,
                      fontSize: 10,
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}

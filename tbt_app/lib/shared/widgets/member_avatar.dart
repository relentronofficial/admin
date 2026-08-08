import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/theme_tokens.dart';

/// Circular member avatar with an initial fallback.
///
/// Reconstructed from its call site in `author_profile_sheet.dart`, which fixes
/// the API exactly:
///
///     MemberAvatar(
///       photoUrl: profile.member.profilePhotoUrl,
///       name: profile.member.displayName,
///       memberId: profile.member.id,
///       size: 88,
///       isMentor: false,
///     )
///
/// The rendering mirrors `_ProfileAvatar` / `_AvatarFallback` in
/// `dashboard/presentation/widgets/home_header.dart` — same CachedNetworkImage
/// setup, same `memCache*` sizing, same initial-letter fallback — so the two
/// avatars in the app look like one component rather than two.
class MemberAvatar extends StatelessWidget {
  const MemberAvatar({
    super.key,
    required this.name,
    required this.memberId,
    this.photoUrl,
    this.size = 40,
    this.isMentor = false,
  });

  final String? photoUrl;
  final String name;

  /// Carried for callers that key or navigate by member. Not rendered.
  final String memberId;

  final double size;

  /// Mentors get the accent ring — the one visual distinction the feed makes
  /// between a mentor and a member.
  final bool isMentor;

  static const _mentorRing = Color(0xFFD30814);

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final trimmed = name.trim();
    final initial = trimmed.isNotEmpty ? trimmed[0].toUpperCase() : '?';
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final cachePx = (size * dpr).round();

    final image = ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: photoUrl != null && photoUrl!.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: photoUrl!,
                fit: BoxFit.cover,
                memCacheWidth: cachePx,
                memCacheHeight: cachePx,
                placeholder: (_, __) => Container(color: tokens.bgSurface),
                errorWidget: (_, __, ___) =>
                    _Fallback(initial: initial, size: size),
              )
            : _Fallback(initial: initial, size: size),
      ),
    );

    if (!isMentor) return image;

    return Container(
      padding: const EdgeInsets.all(2),
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        border: Border.fromBorderSide(
          BorderSide(color: _mentorRing, width: 1.5),
        ),
      ),
      child: image,
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.initial, required this.size});

  final String initial;
  final double size;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      color: tokens.bgInput,
      alignment: Alignment.center,
      child: Text(
        initial,
        style: TextStyle(
          color: tokens.textPrimary,
          fontWeight: FontWeight.w700,
          // Tracks the avatar so a 24 px and an 88 px avatar look alike.
          fontSize: size * 0.4,
        ),
      ),
    );
  }
}

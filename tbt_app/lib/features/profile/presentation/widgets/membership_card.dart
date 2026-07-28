import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../../shared/theme/theme_tokens.dart';

/// Signature interactive membership card.
///
/// - Drag / pan to tilt (X + Y perspective).
/// - Tap to flip 180° between front (details) and back (QR).
/// - Front: brand strip, plan chip, avatar, name, business, member ID, expiry.
/// - Back: QR code encoding the member ID + a verification note.
/// - Neumorphic surface tuned per theme (matches the home menu tile family).
class MembershipCard extends StatefulWidget {
  const MembershipCard({
    super.key,
    required this.name,
    required this.memberId,
    this.avatarUrl,
    this.plan = 'ELITE',
    this.businessName,
    this.expiryLabel,
  });

  final String name;
  final String memberId;
  final String? avatarUrl;
  final String plan;
  final String? businessName;
  final String? expiryLabel;

  @override
  State<MembershipCard> createState() => _MembershipCardState();
}

class _MembershipCardState extends State<MembershipCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _flipCtrl;
  double _tiltX = 0;
  double _tiltY = 0;
  bool _isBack = false;

  @override
  void initState() {
    super.initState();
    _flipCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 550),
    );
  }

  @override
  void dispose() {
    _flipCtrl.dispose();
    super.dispose();
  }

  void _handleTap() {
    setState(() => _isBack = !_isBack);
    if (_isBack) {
      _flipCtrl.forward();
    } else {
      _flipCtrl.reverse();
    }
  }

  void _onPanUpdate(DragUpdateDetails d, Size size) {
    setState(() {
      _tiltY += d.delta.dx / size.width * 0.6;
      _tiltX -= d.delta.dy / size.height * 0.6;
      _tiltX = _tiltX.clamp(-0.35, 0.35);
      _tiltY = _tiltY.clamp(-0.35, 0.35);
    });
  }

  void _onPanEnd(DragEndDetails _) {
    setState(() {
      _tiltX = 0;
      _tiltY = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return LayoutBuilder(
      builder: (context, cts) {
        final w = cts.maxWidth.clamp(280.0, 380.0);
        final h = w * 0.62;
        final size = Size(w, h);
        return Center(
          child: GestureDetector(
            onTap: _handleTap,
            onPanUpdate: (d) => _onPanUpdate(d, size),
            onPanEnd: _onPanEnd,
            child: AnimatedBuilder(
              animation: _flipCtrl,
              builder: (context, _) {
                final flip = _flipCtrl.value; // 0.0 → 1.0
                final angle = flip * math.pi;
                final showingBack = flip > 0.5;
                final transform = Matrix4.identity()
                  ..setEntry(3, 2, 0.0015)
                  ..rotateX(_tiltX)
                  ..rotateY(_tiltY + angle);
                return Transform(
                  alignment: Alignment.center,
                  transform: transform,
                  child: SizedBox(
                    width: w,
                    height: h,
                    child: showingBack
                        ? Transform(
                            alignment: Alignment.center,
                            transform: Matrix4.identity()..rotateY(math.pi),
                            child: _CardBack(
                              isDark: isDark,
                              memberId: widget.memberId,
                              name: widget.name,
                            ),
                          )
                        : _CardFront(
                            isDark: isDark,
                            name: widget.name,
                            memberId: widget.memberId,
                            avatarUrl: widget.avatarUrl,
                            plan: widget.plan,
                            businessName: widget.businessName,
                            expiryLabel: widget.expiryLabel,
                          ),
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }
}

BoxDecoration _cardDecoration(bool isDark) {
  return BoxDecoration(
    gradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: isDark
          ? const [
              Color(0xFF1B1B22),
              Color(0xFF11111A),
              Color(0xFF06060B),
            ]
          : const [
              Color(0xFFFFFFFF),
              Color(0xFFEEEEF2),
              Color(0xFFDADAE0),
            ],
      stops: isDark ? const [0.0, 0.55, 1.0] : null,
    ),
    borderRadius: BorderRadius.circular(22),
    boxShadow: isDark
        ? const [
            BoxShadow(
              color: Colors.black,
              offset: Offset(0, 18),
              blurRadius: 36,
            ),
            BoxShadow(
              color: Color(0xA6000000),
              offset: Offset(0, 4),
              blurRadius: 8,
            ),
          ]
        : [
            BoxShadow(
              color: const Color(0xFF8E8EA0).withValues(alpha: 0.55),
              offset: const Offset(14, 14),
              blurRadius: 32,
            ),
            BoxShadow(
              color: const Color(0xFF8E8EA0).withValues(alpha: 0.30),
              offset: const Offset(4, 4),
              blurRadius: 6,
            ),
            BoxShadow(
              color: Colors.white.withValues(alpha: 1.0),
              offset: const Offset(-14, -14),
              blurRadius: 30,
            ),
            BoxShadow(
              color: Colors.white.withValues(alpha: 0.95),
              offset: const Offset(-3, -3),
              blurRadius: 5,
            ),
          ],
  );
}

class _CardFront extends StatelessWidget {
  const _CardFront({
    required this.isDark,
    required this.name,
    required this.memberId,
    required this.avatarUrl,
    required this.plan,
    required this.businessName,
    required this.expiryLabel,
  });

  final bool isDark;
  final String name;
  final String memberId;
  final String? avatarUrl;
  final String plan;
  final String? businessName;
  final String? expiryLabel;

  @override
  Widget build(BuildContext context) {
    final textColor = isDark ? Colors.white : const Color(0xFF0B0B0D);
    final mutedColor =
        isDark ? Colors.white.withValues(alpha: 0.55) : const Color(0xFF6B6B6B);
    return Container(
      decoration: _cardDecoration(isDark),
      padding: const EdgeInsets.all(18),
      child: Stack(
        children: [
          // Brand strip along the top
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              height: 6,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFE50914), Color(0xFFB30710)],
                ),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(22),
                ),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 4),
              Row(
                children: [
                  Text(
                    'TAMIL BUSINESS TRIBE',
                    style: TextStyle(
                      color: textColor.withValues(alpha: 0.85),
                      fontFamily: 'Rajdhani',
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2.2,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE50914).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: const Color(0xFFE50914).withValues(alpha: 0.5),
                      ),
                    ),
                    child: Text(
                      plan.toUpperCase(),
                      style: const TextStyle(
                        color: Color(0xFFE50914),
                        fontFamily: 'Rajdhani',
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.6,
                      ),
                    ),
                  ),
                ],
              ),
              const Spacer(),
              Row(
                children: [
                  _avatar(context),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name.isEmpty ? 'Member' : name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: textColor,
                            fontFamily: 'Rajdhani',
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.4,
                          ),
                        ),
                        if (businessName != null && businessName!.isNotEmpty)
                          Text(
                            businessName!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: mutedColor,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _labelValue(
                      'MEMBER ID',
                      memberId.isEmpty ? '—' : memberId,
                      textColor,
                      mutedColor,
                    ),
                  ),
                  Expanded(
                    child: _labelValue(
                      'VALID THRU',
                      expiryLabel ?? '—',
                      textColor,
                      mutedColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Icon(
                    Icons.touch_app_outlined,
                    color: mutedColor,
                    size: 12,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Tap to flip · drag to tilt',
                    style: TextStyle(
                      color: mutedColor,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.4,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _avatar(BuildContext context) {
    if (avatarUrl != null && avatarUrl!.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: avatarUrl!,
          width: 42,
          height: 42,
          fit: BoxFit.cover,
        ),
      );
    }
    final initials = _initials(name);
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontFamily: 'Rajdhani',
          fontWeight: FontWeight.w800,
          fontSize: 16,
        ),
      ),
    );
  }

  String _initials(String s) {
    final parts = s.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  Widget _labelValue(
    String label,
    String value,
    Color textColor,
    Color mutedColor,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: mutedColor,
            fontSize: 9,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: textColor,
            fontFamily: 'Rajdhani',
            fontSize: 14,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
          ),
        ),
      ],
    );
  }
}

class _CardBack extends StatelessWidget {
  const _CardBack({
    required this.isDark,
    required this.memberId,
    required this.name,
  });

  final bool isDark;
  final String memberId;
  final String name;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final qrFg = isDark ? Colors.white : const Color(0xFF0B0B0D);
    final qrBg = Colors.transparent;
    final payload = memberId.isEmpty ? 'TBT:UNKNOWN' : 'TBT:$memberId';
    return Container(
      decoration: _cardDecoration(isDark),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 128,
            height: 128,
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color:
                  isDark ? Colors.white.withValues(alpha: 0.06) : Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color:
                    isDark ? Colors.white.withValues(alpha: 0.15) : tokens.borderCard,
              ),
            ),
            child: QrImageView(
              data: payload,
              version: QrVersions.auto,
              backgroundColor: qrBg,
              // ignore: deprecated_member_use — foregroundColor was added in
              // qr_flutter 4.1 but the CI toolchain still resolves 4.0.x on
              // some machines; the deprecated `foregroundColor` slot on the
              // painter is still respected across all shipped versions.
              // ignore: unnecessary_this
              eyeStyle: QrEyeStyle(
                eyeShape: QrEyeShape.square,
                color: qrFg,
              ),
              dataModuleStyle: QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.square,
                color: qrFg,
              ),
              padding: EdgeInsets.zero,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'VERIFICATION',
                  style: TextStyle(
                    color: tokens.textMuted,
                    fontFamily: 'Rajdhani',
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 2.0,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  name.isEmpty ? 'Member' : name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: tokens.textPrimary,
                    fontFamily: 'Rajdhani',
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Scan to verify this Elite member with a TBT staff terminal.',
                  style: TextStyle(
                    color: tokens.textSecondary,
                    fontSize: 11.5,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  memberId.isEmpty ? 'ID unknown' : memberId,
                  style: TextStyle(
                    color: tokens.textPrimary,
                    fontFamily: 'Rajdhani',
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

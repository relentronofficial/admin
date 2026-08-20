import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

/// Signature "Elite Network" membership card. Direct port of the
/// co-worker's design (co-worker/profile.dart lines ~744–1143).
///
/// - Fixed 220 px tall, full-width, corner radius 16.
/// - Dark gradient front with gold border + warm glow shadow.
/// - Pan-to-tilt (X/Y perspective, ±0.4 rad, snap-back on end).
/// - Tap to flip 180° with AnimatedSwitcher (300 ms).
/// - Back face: white QR container inside the same dark card.
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

  static const _gold = Color(0xFFFFD700);
  static const _accent = Color(0xFFD30814);

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
    if (_flipCtrl.status == AnimationStatus.completed ||
        _flipCtrl.status == AnimationStatus.forward) {
      _flipCtrl.reverse();
    } else {
      _flipCtrl.forward();
    }
  }

  void _onPanUpdate(DragUpdateDetails d) {
    setState(() {
      _tiltY += d.delta.dx * 0.003;
      _tiltX -= d.delta.dy * 0.003;
      _tiltX = _tiltX.clamp(-0.4, 0.4);
      _tiltY = _tiltY.clamp(-0.4, 0.4);
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
    return GestureDetector(
      onTap: _handleTap,
      onPanUpdate: _onPanUpdate,
      onPanEnd: _onPanEnd,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: _tiltX, end: _tiltX),
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
        builder: (context, tiltX, _) {
          return TweenAnimationBuilder<double>(
            tween: Tween(begin: _tiltY, end: _tiltY),
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            builder: (context, tiltY, __) {
              return AnimatedBuilder(
                animation: _flipCtrl,
                builder: (context, _) {
                  final flip = _flipCtrl.value; // 0.0 → 1.0
                  final showingBack = flip > 0.5;
                  // Back face rotates from -π/2 (edge-on) back to 0 (facing
                  // user) — that way its content renders upright without any
                  // counter-mirror. Front sweeps 0 → π/2 as usual.
                  final effectiveAngle =
                      showingBack ? (flip - 1) * math.pi : flip * math.pi;
                  final transform = Matrix4.identity()
                    ..setEntry(3, 2, 0.001)
                    ..rotateX(tiltX)
                    ..rotateY(tiltY + effectiveAngle);
                  final face = showingBack
                      ? _CardBack(
                          name: widget.name,
                          memberId: widget.memberId,
                          gold: _gold,
                        )
                      : _CardFront(
                          name: widget.name,
                          memberId: widget.memberId,
                          businessName: widget.businessName,
                          avatarUrl: widget.avatarUrl,
                          plan: widget.plan,
                          expiryLabel: widget.expiryLabel,
                          gold: _gold,
                          accent: _accent,
                        );
                  return Transform(
                    alignment: Alignment.center,
                    transform: transform,
                    child: SizedBox(
                      height: 220,
                      width: double.infinity,
                      child: face,
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}

class _CardFront extends StatelessWidget {
  const _CardFront({
    super.key,
    required this.name,
    required this.memberId,
    required this.businessName,
    required this.avatarUrl,
    required this.plan,
    required this.expiryLabel,
    required this.gold,
    required this.accent,
  });

  final String name;
  final String memberId;
  final String? businessName;
  final String? avatarUrl;
  final String plan;
  final String? expiryLabel;
  final Color gold;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1F1F24), Color(0xFF0F0F12), Color(0xFF050507)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: gold.withValues(alpha: 0.25), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFD4AF).withValues(alpha: 0.04),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.50),
            blurRadius: 30,
            offset: const Offset(0, 15),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Ambient glow blob (top-right)
          Positioned(
            right: -50,
            top: -50,
            child: ClipOval(
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(sigmaX: 30, sigmaY: 30),
                child: Container(
                  width: 200,
                  height: 200,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
          ),
          // Brand strip (top-left)
          Positioned(
            top: 24,
            left: 24,
            child: Row(
              children: [
                Icon(Icons.campaign_rounded, color: gold, size: 24),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'TAMIL BUSINESS TRIBE',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.5,
                      ),
                    ),
                    Text(
                      'ELITE NETWORK CARD',
                      style: TextStyle(
                        color: gold,
                        fontSize: 7.5,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 2.0,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // ELITE chip (top-right)
          Positioned(
            top: 24,
            right: 24,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: gold.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: gold.withValues(alpha: 0.4)),
              ),
              child: Text(
                plan.toUpperCase(),
                style: TextStyle(
                  color: gold,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
          // In-card avatar (right side)
          Positioned(
            right: 40,
            top: 75,
            child: Container(
              width: 57,
              height: 57,
              padding: const EdgeInsets.all(1.5),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: gold, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.30),
                    blurRadius: 8,
                    spreadRadius: 1,
                  ),
                ],
              ),
              child: ClipOval(
                child: (avatarUrl != null && avatarUrl!.isNotEmpty)
                    ? CachedNetworkImage(
                        imageUrl: avatarUrl!,
                        width: 54,
                        height: 54,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => _initialsAvatar(),
                      )
                    : _initialsAvatar(),
              ),
            ),
          ),
          // Name + business (bottom-left area)
          Positioned(
            left: 24,
            bottom: 65,
            right: 120,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (name.isEmpty ? 'MEMBER' : name).toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.0,
                  ),
                ),
                if (businessName != null && businessName!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      businessName!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFFD1D1D6),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          // Footer detail rows (bottom-left)
          Positioned(
            left: 24,
            bottom: 24,
            child: Row(
              children: [
                _labelValue('MEMBER ID', memberId.isEmpty ? '—' : memberId),
                const SizedBox(width: 32),
                _labelValue('EXPIRES', expiryLabel ?? '—'),
              ],
            ),
          ),
          // TAP TO FLIP hint (bottom-right)
          Positioned(
            right: 24,
            bottom: 24,
            child: Row(
              children: [
                Icon(Icons.flip_camera_android_rounded,
                    color: gold, size: 14),
                const SizedBox(width: 4),
                Text(
                  'TAP TO FLIP',
                  style: TextStyle(
                    color: gold,
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _labelValue(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF8E8E93),
            fontSize: 8,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 11.5,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _initialsAvatar() {
    final parts = name.trim().split(RegExp(r'\s+'));
    final initials = parts.isEmpty || parts.first.isEmpty
        ? '?'
        : parts.length == 1
            ? parts.first[0].toUpperCase()
            : '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return Container(
      width: 54,
      height: 54,
      color: const Color(0xFF48484A),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _CardBack extends StatelessWidget {
  const _CardBack({
    super.key,
    required this.name,
    required this.memberId,
    required this.gold,
  });

  final String name;
  final String memberId;
  final Color gold;

  @override
  Widget build(BuildContext context) {
    final payload = memberId.isEmpty ? 'TBT:UNKNOWN' : 'TBT:$memberId';
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0F0F12), Color(0xFF1A1A22), Color(0xFF0A0A0E)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: gold.withValues(alpha: 0.15), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.50),
            blurRadius: 30,
            offset: const Offset(0, 15),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Verified icon (top-left)
          const Positioned(
            top: 24,
            left: 24,
            child: Icon(
              Icons.verified_user_rounded,
              color: Color(0xFF27AE60),
              size: 20,
            ),
          ),
          // Central QR + caption
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: gold.withValues(alpha: 0.20),
                        blurRadius: 15,
                      ),
                    ],
                  ),
                  child: QrImageView(
                    data: payload,
                    version: QrVersions.auto,
                    size: 90,
                    backgroundColor: Colors.white,
                    eyeStyle: const QrEyeStyle(
                      eyeShape: QrEyeShape.square,
                      color: Colors.black,
                    ),
                    dataModuleStyle: const QrDataModuleStyle(
                      dataModuleShape: QrDataModuleShape.square,
                      color: Colors.black,
                    ),
                    padding: EdgeInsets.zero,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'SCAN TO VERIFY MEMBERSHIP',
                  style: TextStyle(
                    color: gold,
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.0,
                  ),
                ),
              ],
            ),
          ),
          // TAP TO FLIP hint (bottom-right)
          Positioned(
            right: 24,
            bottom: 24,
            child: Row(
              children: [
                const Icon(Icons.flip_camera_android_rounded,
                    color: Colors.white60, size: 14),
                const SizedBox(width: 4),
                const Text(
                  'TAP TO FLIP',
                  style: TextStyle(
                    color: Colors.white60,
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
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

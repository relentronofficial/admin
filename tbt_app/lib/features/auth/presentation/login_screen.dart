import 'dart:async';
import 'dart:math' as math;
import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../../../core/exceptions/app_exception.dart';
import '../../../shared/providers/site_config_provider.dart';
import '../domain/auth_state.dart';
import '../providers/auth_provider.dart';

import '../../../shared/theme/design_tokens.dart';

/// Dark-cyan glassmorphism login (Module 5 redesign).
///
/// Preserved from the previous implementation:
///   * Form fields (phone + password), validation, submit → OTP flow
///   * Inline error banner
///   * Background slideshow / mobile-specific bg / gradient fallback
///   * Show/hide password toggle
///   * Forgot-password + Sign-up links
///
/// New visual layer:
///   * Ambient animated cyan gradient orbs behind the scrim
///   * Cyan gradient-border glass card with beefier backdrop blur
///   * Cyan-tinted focus glow on inputs
///   * Cyan halo on the primary CTA
///
/// The accent cyan is scoped to this screen only — the app-wide
/// TBT red accent is unchanged everywhere else.
const Color _kCyanAccent = Color(0xFF06d6f6);
const Color _kCyanDeep = Color(0xFF0891b2);
const Color _kBgDeep = Color(0xFF040910);

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneFocus = FocusNode();
  final _passwordFocus = FocusNode();
  bool _obscurePassword = true;
  String? _errorBanner;
  int _bgIndex = 0;
  Timer? _bgTimer;

  // Slow orbit controller for the ambient background orbs. Kept at a
  // long duration + low fps by design — this is decorative, not
  // gameplay; we don't want it eating CPU on lower-end devices.
  late final AnimationController _ambientCtl;

  @override
  void initState() {
    super.initState();
    _phoneFocus.addListener(() => setState(() {}));
    _passwordFocus.addListener(() => setState(() {}));
    _bgTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted) return;
      final imgs = ref.read(siteConfigNotifierProvider).valueOrNull?.loginBgImages;
      if (imgs == null || imgs.length < 2) return;
      setState(() => _bgIndex = (_bgIndex + 1) % imgs.length);
    });
    _ambientCtl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 22),
    )..repeat();
  }

  @override
  void dispose() {
    _bgTimer?.cancel();
    _ambientCtl.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _phoneFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  /// Returns the current background image URL from siteConfig; null =
  /// fall through to the animated gradient. Same resolution order as
  /// before the redesign: slideshow entry → mobile-specific → shared.
  String? _currentBgUrl() {
    final cfg = ref.watch(siteConfigNotifierProvider).valueOrNull;
    if (cfg == null) return null;
    final imgs = cfg.loginBgImages;
    if (imgs != null && imgs.isNotEmpty) {
      return imgs[_bgIndex % imgs.length];
    }
    return cfg.loginBgMobileUrl ?? cfg.loginBgUrl;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _errorBanner = null);
    final res = await ref.read(authNotifierProvider.notifier).loginWithOtp(
          _phoneController.text.trim(),
          _passwordController.text,
        );
    if (!mounted || res?.phone == null) return;
    final phone = Uri.encodeComponent(res!.phone!);
    final redirectParam =
        GoRouterState.of(context).uri.queryParameters['redirect'];
    var path = '${AppRoutes.verify}?phone=$phone';
    if (res.otp != null && res.otp!.isNotEmpty) {
      path += '&otp=${Uri.encodeComponent(res.otp!)}';
    }
    if (redirectParam != null && redirectParam.isNotEmpty) {
      path += '&redirect=${Uri.encodeComponent(redirectParam)}';
    }
    context.go(path);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<AuthState>>(authNotifierProvider, (_, next) {
      next.whenOrNull(
        error: (error, _) {
          final msg =
              error is AppException ? error.message : 'Something went wrong';
          setState(() => _errorBanner = msg);
        },
      );
    });

    final isLoading = ref.watch(authNotifierProvider).isLoading;
    final bgUrl = _currentBgUrl();
    final size = MediaQuery.of(context).size;

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Layer 1: background image or deep-cyan gradient ────
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 900),
            child: bgUrl != null && bgUrl.isNotEmpty
                ? CachedNetworkImage(
                    key: ValueKey(bgUrl),
                    imageUrl: bgUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => _gradientFallback(),
                    errorWidget: (_, __, ___) => _gradientFallback(),
                  )
                : _gradientFallback(),
          ),
          // ── Layer 2: ambient orbs (only when NO bg image, so we
          // don't over-decorate a photo the admin uploaded).
          if (bgUrl == null || bgUrl.isEmpty)
            AnimatedBuilder(
              animation: _ambientCtl,
              builder: (ctx, _) => CustomPaint(
                painter: _AmbientOrbsPainter(_ambientCtl.value),
                size: size,
              ),
            ),
          // ── Layer 3: dark scrim so any bg image stays legible ──
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.45),
                  Colors.black.withValues(alpha: 0.72),
                ],
              ),
            ),
          ),
          // ── Layer 4: the glass card ────────────────────────────
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
                child: _GlassCard(
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 8),
                        // Brand mark — cyan gradient text via ShaderMask
                        ShaderMask(
                          shaderCallback: (rect) => const LinearGradient(
                            colors: [_kCyanAccent, Colors.white, _kCyanDeep],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ).createShader(rect),
                          child: const Text(
                            'TBT',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontFamily: 'Rajdhani',
                              fontSize: 54,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              letterSpacing: 8,
                              height: 1,
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'TAMIL BUSINESS TRIBE',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontFamily: 'Rajdhani',
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.white.withValues(alpha: 0.55),
                            letterSpacing: 4,
                          ),
                        ),
                        const SizedBox(height: 8),
                        // Thin cyan divider line to anchor the mark
                        Center(
                          child: Container(
                            width: 42,
                            height: 2,
                            margin: const EdgeInsets.only(top: 6, bottom: 24),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [
                                  Colors.transparent,
                                  _kCyanAccent,
                                  Colors.transparent,
                                ],
                              ),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),
                        // ── Inline error banner ─────────────────
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 220),
                          child: _errorBanner == null
                              ? const SizedBox.shrink()
                              : Container(
                                  key: const ValueKey('login-error'),
                                  margin: const EdgeInsets.only(bottom: 16),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFdc2626)
                                        .withValues(alpha: 0.12),
                                    borderRadius:
                                        BorderRadius.circular(AppRadius.md),
                                    border: Border.all(
                                      color: const Color(0xFFf87171)
                                          .withValues(alpha: 0.4),
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.error_outline,
                                          color: Color(0xFFf87171), size: 16),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          _errorBanner!,
                                          style: const TextStyle(
                                            color: Color(0xFFf0d0d0),
                                            fontSize: 13,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                        ),
                        _FieldLabel('PHONE NUMBER'),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _phoneController,
                          focusNode: _phoneFocus,
                          keyboardType: TextInputType.phone,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly
                          ],
                          style: const TextStyle(
                              color: Colors.white, fontSize: 14),
                          decoration: _inputDecoration(
                              'Enter your phone number', _phoneFocus.hasFocus,
                              icon: Icons.phone_outlined),
                          validator: (v) => (v == null || v.trim().isEmpty)
                              ? 'Phone number is required'
                              : null,
                        ),
                        const SizedBox(height: 18),
                        _FieldLabel('PASSWORD'),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _passwordController,
                          focusNode: _passwordFocus,
                          obscureText: _obscurePassword,
                          style: const TextStyle(
                              color: Colors.white, fontSize: 14),
                          decoration: _inputDecoration(
                                  'Enter your password',
                                  _passwordFocus.hasFocus,
                                  icon: Icons.lock_outline)
                              .copyWith(
                            suffixIcon: IconButton(
                              tooltip: _obscurePassword
                                  ? 'Show password'
                                  : 'Hide password',
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                color: Colors.white.withValues(alpha: 0.55),
                                size: 20,
                              ),
                              onPressed: () => setState(
                                  () => _obscurePassword = !_obscurePassword),
                            ),
                          ),
                          validator: (v) => (v == null || v.isEmpty)
                              ? 'Password is required'
                              : null,
                        ),
                        const SizedBox(height: 4),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () =>
                                context.go(AppRoutes.forgotPassword),
                            style: TextButton.styleFrom(
                              foregroundColor:
                                  _kCyanAccent.withValues(alpha: 0.9),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 4, vertical: 8),
                            ),
                            child: const Text('Forgot password?',
                                style: TextStyle(fontSize: 13)),
                          ),
                        ),
                        const SizedBox(height: 12),
                        // ── Primary CTA — cyan halo + gradient fill ─
                        _CyanCta(
                          onPressed: isLoading ? null : _submit,
                          isLoading: isLoading,
                          label: 'SIGN IN',
                        ),
                        const SizedBox(height: 26),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              "Don't have an account? ",
                              style: TextStyle(
                                  color:
                                      Colors.white.withValues(alpha: 0.55),
                                  fontSize: 14),
                            ),
                            Semantics(
                              label: 'Sign Up',
                              button: true,
                              child: GestureDetector(
                                onTap: () => context.go(AppRoutes.signup),
                                child: const Text(
                                  'Sign Up',
                                  style: TextStyle(
                                    color: _kCyanAccent,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _gradientFallback() => Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(-0.4, -0.5),
            radius: 1.4,
            colors: [
              Color(0xFF0e2c3a), // dim teal
              Color(0xFF071620), // navy
              _kBgDeep, // near-black
            ],
            stops: [0.0, 0.5, 1.0],
          ),
        ),
      );

  InputDecoration _inputDecoration(String hint, bool focused,
      {IconData? icon}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(
          color: Colors.white.withValues(alpha: 0.4), fontSize: 14),
      prefixIcon: icon != null
          ? Icon(
              icon,
              size: 18,
              color: focused
                  ? _kCyanAccent
                  : Colors.white.withValues(alpha: 0.55),
            )
          : null,
      filled: true,
      fillColor: focused
          ? _kCyanAccent.withValues(alpha: 0.06)
          : Colors.white.withValues(alpha: 0.04),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.10)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.10)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: _kCyanAccent, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: Color(0xFFf87171)),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: Color(0xFFf87171), width: 1.5),
      ),
      errorStyle: const TextStyle(color: Color(0xFFf87171), fontSize: 11),
    );
  }
}

// ── Glass card wrapper ────────────────────────────────────────────

class _GlassCard extends StatelessWidget {
  const _GlassCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 400),
      child: Container(
        padding: const EdgeInsets.all(1.5),
        decoration: BoxDecoration(
          // Cyan gradient border — top-left glow, bottom-right shadow
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              _kCyanAccent.withValues(alpha: 0.55),
              Colors.white.withValues(alpha: 0.12),
              _kCyanDeep.withValues(alpha: 0.35),
            ],
          ),
          borderRadius: BorderRadius.circular(AppRadius.xl),
          boxShadow: [
            BoxShadow(
              color: _kCyanAccent.withValues(alpha: 0.15),
              blurRadius: 40,
              spreadRadius: -6,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(19),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(19),
              ),
              padding:
                  const EdgeInsets.symmetric(horizontal: 24, vertical: 30),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Cyan CTA with animated halo ───────────────────────────────────

class _CyanCta extends StatelessWidget {
  const _CyanCta({
    required this.onPressed,
    required this.isLoading,
    required this.label,
  });
  final VoidCallback? onPressed;
  final bool isLoading;
  final String label;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 50,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.md),
          boxShadow: onPressed == null
              ? const []
              : [
                  BoxShadow(
                    color: _kCyanAccent.withValues(alpha: 0.35),
                    blurRadius: 24,
                    spreadRadius: -4,
                    offset: const Offset(0, 8),
                  ),
                ],
        ),
        child: ElevatedButton(
          onPressed: onPressed,
          style: ElevatedButton.styleFrom(
            padding: EdgeInsets.zero,
            elevation: 0,
            backgroundColor: Colors.transparent,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
          ).copyWith(
            backgroundColor: WidgetStateProperty.resolveWith((states) {
              // Ripple base
              return Colors.transparent;
            }),
          ),
          child: Ink(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: onPressed == null
                    ? [
                        Colors.white.withValues(alpha: 0.08),
                        Colors.white.withValues(alpha: 0.08),
                      ]
                    : const [_kCyanAccent, _kCyanDeep],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Container(
              alignment: Alignment.center,
              child: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      label,
                      style: const TextStyle(
                        fontFamily: 'Rajdhani',
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: 3,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Ambient orbs painter ──────────────────────────────────────────
// Two overlapping soft radial gradients that drift slowly. Only
// rendered when there's no admin-uploaded background image (see
// build() above). Repaint frequency is limited by the parent
// AnimationController's 22 s duration → about 3 repaints per second.

class _AmbientOrbsPainter extends CustomPainter {
  _AmbientOrbsPainter(this.t);
  final double t; // 0..1, cycles smoothly

  @override
  void paint(Canvas canvas, Size size) {
    final theta = t * 2 * math.pi;
    final w = size.width;
    final h = size.height;

    // Orb A — cyan-teal, orbits upper region
    final cx1 = w * (0.30 + 0.15 * math.sin(theta));
    final cy1 = h * (0.28 + 0.10 * math.cos(theta * 0.8));
    final r1 = math.max(w, h) * 0.55;
    final paint1 = Paint()
      ..shader = RadialGradient(
        colors: [
          _kCyanAccent.withValues(alpha: 0.28),
          _kCyanAccent.withValues(alpha: 0.0),
        ],
      ).createShader(Rect.fromCircle(center: Offset(cx1, cy1), radius: r1));
    canvas.drawCircle(Offset(cx1, cy1), r1, paint1);

    // Orb B — deeper cyan, orbits lower region, opposite phase
    final cx2 = w * (0.72 + 0.12 * math.cos(theta + math.pi / 3));
    final cy2 = h * (0.78 + 0.10 * math.sin(theta * 1.2 + math.pi / 4));
    final r2 = math.max(w, h) * 0.5;
    final paint2 = Paint()
      ..shader = RadialGradient(
        colors: [
          _kCyanDeep.withValues(alpha: 0.32),
          _kCyanDeep.withValues(alpha: 0.0),
        ],
      ).createShader(Rect.fromCircle(center: Offset(cx2, cy2), radius: r2));
    canvas.drawCircle(Offset(cx2, cy2), r2, paint2);
  }

  @override
  bool shouldRepaint(covariant _AmbientOrbsPainter oldDelegate) =>
      oldDelegate.t != t;
}

// ── Field label ──────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: TextStyle(
          fontFamily: 'Rajdhani',
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: Colors.white.withValues(alpha: 0.55),
          letterSpacing: 2,
        ),
      );
}

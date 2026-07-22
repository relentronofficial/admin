import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../../../core/exceptions/app_exception.dart';
import '../../../shared/providers/site_config_provider.dart';
import '../../../shared/theme/design_tokens.dart';
import '../../../shared/theme/status_bar_scope.dart';
import '../domain/auth_state.dart';
import '../providers/auth_provider.dart';

/// Login screen — flat black + red.
///
/// Preserved:
///   * Phone + password form with validation
///   * Inline error banner
///   * Background image (slideshow → mobile-specific → shared) from
///     site config, so the admin can swap the mobile login backdrop
///     from /settings/site without shipping a new APK
///   * Show/hide password toggle
///   * Forgot-password + Sign-up links
const Color _kRed = Color(0xFFDC2626);
const Color _kRedDeep = Color(0xFFB91C1C);
const Color _kBg = Color(0xFF000000);
const Color _kCard = Color(0xFF141414);
const Color _kBorder = Color(0xFF2A2A2A);

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneFocus = FocusNode();
  final _passwordFocus = FocusNode();
  bool _obscurePassword = true;
  String? _errorBanner;
  int _bgIndex = 0;
  Timer? _bgTimer;

  @override
  void initState() {
    super.initState();
    _phoneFocus.addListener(() => setState(() {}));
    _passwordFocus.addListener(() => setState(() {}));
    _bgTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted) return;
      final imgs =
          ref.read(siteConfigNotifierProvider).valueOrNull?.loginBgImages;
      if (imgs == null || imgs.length < 2) return;
      setState(() => _bgIndex = (_bgIndex + 1) % imgs.length);
    });
  }

  @override
  void dispose() {
    _bgTimer?.cancel();
    _phoneController.dispose();
    _passwordController.dispose();
    _phoneFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  /// Background image URL from siteConfig. Precedence:
  ///   1. Slideshow entry (rotates every 6 s)
  ///   2. Mobile-specific url
  ///   3. Shared (desktop) url
  /// Returns null when no bg is configured → falls back to solid black.
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

    return StatusBarScope.overDarkBackground(
      child: Scaffold(
      backgroundColor: _kBg,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // ── Layer 1: background image (admin-configurable) or solid black.
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 600),
            child: bgUrl != null && bgUrl.isNotEmpty
                ? CachedNetworkImage(
                    key: ValueKey(bgUrl),
                    imageUrl: bgUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => const ColoredBox(color: _kBg),
                    errorWidget: (_, __, ___) => const ColoredBox(color: _kBg),
                  )
                : const ColoredBox(color: _kBg),
          ),
          // ── Layer 2: dark scrim so bg image doesn't drown the form.
          //           Skipped when no bg image so the pure black stays clean.
          if (bgUrl != null && bgUrl.isNotEmpty)
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xCC000000),
                    Color(0xE6000000),
                  ],
                ),
              ),
            ),
          // ── Layer 3: card.
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                    horizontal: 20, vertical: 32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: Container(
                    decoration: BoxDecoration(
                      color: _kCard,
                      borderRadius: BorderRadius.circular(AppRadius.xl),
                      border: Border.all(color: _kBorder),
                    ),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 30),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SizedBox(height: 4),
                          // TBT wordmark
                          const Text(
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
                          Container(
                            width: 42,
                            height: 2,
                            margin: const EdgeInsets.symmetric(vertical: 20),
                            color: _kRed,
                          ),
                          // ── Inline error banner
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
                                      color:
                                          _kRed.withValues(alpha: 0.12),
                                      borderRadius:
                                          BorderRadius.circular(AppRadius.md),
                                      border: Border.all(
                                        color:
                                            _kRed.withValues(alpha: 0.5),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.error_outline,
                                            color: _kRed, size: 16),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            _errorBanner!,
                                            style: const TextStyle(
                                              color: Color(0xFFF0D0D0),
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
                                'Enter your phone number',
                                _phoneFocus.hasFocus,
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
                                onPressed: () => setState(() =>
                                    _obscurePassword = !_obscurePassword),
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
                                foregroundColor: _kRed,
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 4, vertical: 8),
                              ),
                              child: const Text('Forgot password?',
                                  style: TextStyle(fontSize: 13)),
                            ),
                          ),
                          const SizedBox(height: 12),
                          _RedCta(
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
                                      color: _kRed,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    ),
    );
  }

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
              color:
                  focused ? _kRed : Colors.white.withValues(alpha: 0.55),
            )
          : null,
      filled: true,
      fillColor: const Color(0xFF1A1A1A),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: _kBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: _kBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: _kRed, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: _kRed),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: _kRed, width: 1.5),
      ),
      errorStyle: const TextStyle(color: _kRed, fontSize: 11),
    );
  }
}

// ── Red CTA — flat button, no halo ────────────────────────────────

class _RedCta extends StatelessWidget {
  const _RedCta({
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
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: _kRed,
          disabledBackgroundColor: Colors.white.withValues(alpha: 0.08),
          disabledForegroundColor: Colors.white.withValues(alpha: 0.4),
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
        ).copyWith(
          overlayColor: WidgetStateProperty.all(_kRedDeep.withValues(alpha: 0.3)),
        ),
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
    );
  }
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

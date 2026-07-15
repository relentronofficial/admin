import 'dart:async';
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
import '../../../shared/theme/theme_tokens.dart';
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
  // Inline error banner text (replaces the SnackBar). Kept in state so a
  // rebuild can animate it in / out.
  String? _errorBanner;
  // Cycles through `siteConfig.loginBgImages` every 6 seconds when the
  // backend provides a slideshow. Falls back to a single image (or none)
  // when the array is empty.
  int _bgIndex = 0;
  Timer? _bgTimer;

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

  /// Returns the current background image URL:
  /// - the slideshow entry at `_bgIndex` when `loginBgImages` is populated;
  /// - else the mobile-specific `loginBgMobileUrl`;
  /// - else the shared `loginBgUrl`;
  /// - else null (render the fallback radial gradient).
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
    // Backend echoes the canonical phone (and, in dev / staging, an inline OTP
    // when WhatsApp delivery is unavailable). Forward both to the OTP screen
    // so it can pre-fill the boxes when the OTP is known.
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

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Layer 1: background — image slideshow (cross-faded) or gradient.
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
          // Layer 2: dark scrim so text on any image stays legible.
          Container(color: Colors.black.withValues(alpha: 0.55)),
          // Layer 3: the glassmorphic card + form. Gradient border via a
          // Container with a linear-gradient background, then a
          // BackdropFilter-blurred inner surface.
          SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
            child: Container(
              padding: const EdgeInsets.all(1.5),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Theme.of(context).colorScheme.primary.withValues(alpha: 0.55),
                    Colors.white.withValues(alpha: 0.10),
                    Theme.of(context).colorScheme.primary.withValues(alpha: 0.35),
                  ],
                ),
                borderRadius: BorderRadius.circular(AppRadius.xl),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(19),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(19),
                    ),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 28),
                    child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 8),
                  Text(
                    'TBT',
                    textAlign: TextAlign.center,
                    style: TextStyle(
          fontFamily: 'Rajdhani',
                      fontSize: 52,
                      fontWeight: FontWeight.w700,
                      color: Theme.of(context).colorScheme.primary,
                      letterSpacing: 6,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'TAMIL BUSINESS TRIBE',
                    textAlign: TextAlign.center,
                    style: TextStyle(
          fontFamily: 'Rajdhani',
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: context.tokens.textMuted,
                      letterSpacing: 3,
                    ),
                  ),
                  const SizedBox(height: 40),
                  // Inline error banner — replaces the transient SnackBar so
                  // the failure reason stays visible while the user fixes it.
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
                              color: Theme.of(context).colorScheme.primary
                                  .withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(AppRadius.md),
                              border: Border.all(
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.error_outline,
                                    color: Theme.of(context).colorScheme.primary, size: 16),
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
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    style: TextStyle(color: context.tokens.textPrimary),
                    decoration:
                        _inputDecoration('Enter your phone number', _phoneFocus.hasFocus),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Phone number is required' : null,
                  ),
                  const SizedBox(height: 20),
                  _FieldLabel('PASSWORD'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _passwordController,
                    focusNode: _passwordFocus,
                    obscureText: _obscurePassword,
                    style: TextStyle(color: context.tokens.textPrimary),
                    decoration: _inputDecoration('Enter your password', _passwordFocus.hasFocus)
                        .copyWith(
                      suffixIcon: IconButton(
                        tooltip: _obscurePassword ? 'Show password' : 'Hide password',
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          color: context.tokens.textMuted,
                          size: 20,
                        ),
                        onPressed: () =>
                            setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),
                    validator: (v) =>
                        (v == null || v.isEmpty) ? 'Password is required' : null,
                  ),
                  const SizedBox(height: 4),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => context.go(AppRoutes.forgotPassword),
                      style: TextButton.styleFrom(
                        foregroundColor: context.tokens.textSecondary,
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                      ),
                      child: const Text('Forgot password?', style: TextStyle(fontSize: 13)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: isLoading ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Theme.of(context).colorScheme.primary,
                        disabledBackgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.5),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                        elevation: 0,
                      ),
                      child: isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              'SIGN IN',
                              style: TextStyle(
          fontFamily: 'Rajdhani',
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                                letterSpacing: 2,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        "Don't have an account? ",
                        style: TextStyle(color: context.tokens.textMuted, fontSize: 14),
                      ),
                      Semantics(
                        label: 'Sign Up',
                        button: true,
                        child: GestureDetector(
                          onTap: () => context.go(AppRoutes.signup),
                          child: Text(
                            'Sign Up',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.primary,
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
            ),                    // Form
                  ),               // Container (glass surface)
                ),                 // BackdropFilter
              ),                   // ClipRRect
            ),                     // Container (gradient border)
          ),                       // SingleChildScrollView
        ),                         // Center
      ),                           // SafeArea
        ],                         // Stack children
      ),                           // Stack
    );                             // Scaffold
  }

  Widget _gradientFallback() => Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.4),
            radius: 1.2,
            colors: [
              Color(0xFF1a1010),
              Color(0xFF0a0a0a),
              Color(0xFF000000),
            ],
            stops: [0.0, 0.55, 1.0],
          ),
        ),
      );

  // When focused, thicken the accent border to give the field an accent glow —
  // matches the web login card's focus-ring styling.
  InputDecoration _inputDecoration(String hint, bool focused) =>
      InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: context.tokens.textMuted, fontSize: 14),
        filled: true,
        fillColor: focused
            ? const Color(0xFF221818) // subtle accent-tinted fill on focus
            : context.tokens.bgInput,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: context.tokens.borderCard),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: context.tokens.borderCard),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: Theme.of(context).colorScheme.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: Theme.of(context).colorScheme.primary),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: Theme.of(context).colorScheme.primary, width: 1.5),
        ),
      );
}

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
          color: context.tokens.textMuted,
          letterSpacing: 1.5,
        ),
      );
}

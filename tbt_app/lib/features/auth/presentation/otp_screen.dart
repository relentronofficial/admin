import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../../../core/exceptions/app_exception.dart';
import '../domain/auth_state.dart';
import '../providers/auth_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({
    super.key,
    required this.phone,
    this.redirect,
    this.prefillOtp,
  });
  final String phone;

  /// Optional route to navigate to after successful authentication.
  /// Decoded path — fallback is [AppRoutes.dashboard].
  final String? redirect;

  /// When the backend ships the OTP inline (dev / staging), pre-fill the
  /// boxes so the user just has to tap Verify. Production always leaves this
  /// null.
  final String? prefillOtp;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _controllers = List.generate(6, (_) => TextEditingController());
  final _focusNodes = List.generate(6, (_) => FocusNode());

  Timer? _resendTimer;
  int _resendSeconds = 60;

  @override
  void initState() {
    super.initState();
    _startResendTimer();

    // Pre-fill the 6 boxes if the backend passed us an OTP directly.
    final pre = widget.prefillOtp;
    if (pre != null && pre.length == 6 && RegExp(r'^\d{6}$').hasMatch(pre)) {
      for (var i = 0; i < 6; i++) {
        _controllers[i].text = pre[i];
      }
      // Auto-submit after first frame so the user just sees the verify
      // spinner without manual tapping.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _submit();
      });
    } else {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _focusNodes[0].requestFocus(),
      );
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    _resendTimer?.cancel();
    super.dispose();
  }

  void _startResendTimer() {
    _resendTimer?.cancel();
    setState(() => _resendSeconds = 60);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() {
        if (_resendSeconds > 0) {
          _resendSeconds--;
        } else {
          t.cancel();
        }
      });
    });
  }

  String get _otp => _controllers.map((c) => c.text).join();

  void _onBoxChanged(int index, String value) {
    if (value.length == 1) {
      if (index < 5) {
        _focusNodes[index + 1].requestFocus();
      } else {
        _focusNodes[index].unfocus();
        if (_otp.length == 6) _submit();
      }
    } else if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
  }

  void _submit() {
    final otp = _otp;
    if (otp.length < 6) return;
    ref.read(authNotifierProvider.notifier).verifyOtp(widget.phone, otp);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<AuthState>>(authNotifierProvider, (_, next) {
      next.whenOrNull(
        data: (state) {
          if (state.step == AuthStep.authenticated) {
            final dest = (widget.redirect?.isNotEmpty == true &&
                    widget.redirect!.startsWith('/'))
                ? widget.redirect!
                : AppRoutes.dashboard;
            context.go(dest);
          } else if (state.step == AuthStep.resetPassword) {
            context.go(AppRoutes.forgotPassword);
          }
        },
        error: (error, _) {
          final msg =
              error is AppException ? error.message : 'Invalid or expired OTP';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(msg),
              backgroundColor: Theme.of(context).colorScheme.primary,
            ),
          );
          for (final c in _controllers) {
            c.clear();
          }
          _focusNodes[0].requestFocus();
        },
      );
    });

    final isLoading = ref.watch(authNotifierProvider).isLoading;

    return Scaffold(
      backgroundColor: context.tokens.bgPage,
      appBar: AppBar(
        backgroundColor: context.tokens.bgPage,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: context.tokens.textPrimary),
          onPressed: () => context.go(AppRoutes.login),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              Text(
                'VERIFY OTP',
                style: TextStyle(
          fontFamily: 'Rajdhani',
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: context.tokens.textPrimary,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Enter the 6-digit code sent to\n${widget.phone}',
                style: TextStyle(
                  color: context.tokens.textSecondary,
                  fontSize: 14,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 40),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(
                  6,
                  (i) => _OtpBox(
                    controller: _controllers[i],
                    focusNode: _focusNodes[i],
                    onChanged: (v) => _onBoxChanged(i, v),
                    enabled: !isLoading,
                  ),
                ),
              ),
              const SizedBox(height: 40),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: isLoading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    disabledBackgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.5),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
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
                          'VERIFY',
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
              const SizedBox(height: 24),
              Center(
                child: _resendSeconds > 0
                    ? Text(
                        'Resend OTP in ${_resendSeconds}s',
                        style: TextStyle(
                          color: context.tokens.textMuted,
                          fontSize: 13,
                        ),
                      )
                    : TextButton(
                        onPressed: () => context.go(AppRoutes.login),
                        style: TextButton.styleFrom(
                          foregroundColor: context.tokens.textSecondary,
                        ),
                        child: const Text(
                          'Back to Sign In to resend',
                          style: TextStyle(fontSize: 13),
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

class _OtpBox extends StatelessWidget {
  const _OtpBox({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.enabled,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 44,
        height: 54,
        child: TextField(
          controller: controller,
          focusNode: focusNode,
          enabled: enabled,
          maxLength: 1,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: context.tokens.textPrimary,
            fontSize: 20,
            fontWeight: FontWeight.w600,
          ),
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(
            counterText: '',
            filled: true,
            fillColor: context.tokens.bgInput,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: context.tokens.borderCard),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: context.tokens.borderCard),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide:
                  BorderSide(color: Theme.of(context).colorScheme.primary, width: 2),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: context.tokens.bgInput),
            ),
          ),
          onChanged: onChanged,
        ),
      );
}

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
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  int _step = 1;
  String _phone = '';
  String _storedOtp = '';

  // Step 1
  final _phoneController = TextEditingController();

  // Step 2 — OTP boxes
  final _otpControllers = List.generate(6, (_) => TextEditingController());
  final _otpFocusNodes = List.generate(6, (_) => FocusNode());
  Timer? _resendTimer;
  int _resendSeconds = 60;
  bool _resendLoading = false;

  // Step 3 — new password
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  @override
  void dispose() {
    _phoneController.dispose();
    for (final c in _otpControllers) {
      c.dispose();
    }
    for (final f in _otpFocusNodes) {
      f.dispose();
    }
    _resendTimer?.cancel();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
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

  void _showError(dynamic error) {
    final msg = error is AppException
        ? error.message
        : (error is String ? error : 'Something went wrong');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: Theme.of(context).colorScheme.primary,
      ),
    );
  }

  void _onOtpBoxChanged(int index, String value) {
    if (value.length == 1) {
      if (index < 5) {
        _otpFocusNodes[index + 1].requestFocus();
      } else {
        _otpFocusNodes[index].unfocus();
      }
    } else if (value.isEmpty && index > 0) {
      _otpFocusNodes[index - 1].requestFocus();
    }
  }

  void _confirmOtp() {
    final otp = _otpControllers.map((c) => c.text).join();
    if (otp.length < 6) {
      _showError('Please enter all 6 digits');
      return;
    }
    _storedOtp = otp;
    setState(() => _step = 3);
  }

  Future<void> _resendOtp() async {
    setState(() => _resendLoading = true);
    try {
      await ref
          .read(authNotifierProvider.notifier)
          .sendForgotPassword(_phone);
      if (!mounted) return;
      for (final c in _otpControllers) {
        c.clear();
      }
      _startResendTimer();
      _otpFocusNodes[0].requestFocus();
    } finally {
      if (mounted) setState(() => _resendLoading = false);
    }
  }

  void _onBack() {
    if (_step > 1) {
      setState(() => _step--);
    } else {
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<AuthState>>(authNotifierProvider, (_, next) {
      next.whenOrNull(
        data: (state) {
          if (state.step == AuthStep.otpSent && _step == 1) {
            _phone = _phoneController.text.trim();
            setState(() => _step = 2);
            _startResendTimer();
            WidgetsBinding.instance.addPostFrameCallback(
              (_) => _otpFocusNodes[0].requestFocus(),
            );
          } else if (state.step == AuthStep.authenticated && _step == 3) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Password updated. Please sign in.'),
                backgroundColor: Colors.green,
              ),
            );
            context.go(AppRoutes.login);
          }
        },
        error: (error, _) => _showError(error),
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
          onPressed: _onBack,
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              Text(
                'RESET PASSWORD',
                style: TextStyle(
          fontFamily: 'Rajdhani',
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: context.tokens.textPrimary,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 8),
              _StepRow(current: _step),
              const SizedBox(height: 40),
              if (_step == 1) _buildStepOne(isLoading),
              if (_step == 2) _buildStepTwo(isLoading),
              if (_step == 3) _buildStepThree(isLoading),
              const SizedBox(height: 64),
            ],
          ),
        ),
      ),
    );
  }

  // ── Step 1: phone entry ────────────────────────────────────────────────────

  Widget _buildStepOne(bool isLoading) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Enter your registered phone number to receive a reset code.',
            style:
                TextStyle(color: context.tokens.textSecondary, fontSize: 14, height: 1.5),
          ),
          const SizedBox(height: 32),
          _FieldLabel('PHONE NUMBER'),
          const SizedBox(height: 8),
          TextFormField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: TextStyle(color: context.tokens.textPrimary),
            decoration: _inputDecoration('Enter your phone number'),
          ),
          const SizedBox(height: 28),
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: isLoading
                  ? null
                  : () => ref
                      .read(authNotifierProvider.notifier)
                      .sendForgotPassword(_phoneController.text.trim()),
              style: _buttonStyle,
              child: isLoading
                  ? _loadingIndicator
                  : Text('SEND OTP', style: _rajdhaniButton),
            ),
          ),
        ],
      );

  // ── Step 2: OTP entry ──────────────────────────────────────────────────────

  Widget _buildStepTwo(bool isLoading) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Enter the 6-digit code sent to\n$_phone',
            style: TextStyle(
                color: context.tokens.textSecondary, fontSize: 14, height: 1.5),
          ),
          const SizedBox(height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(
              6,
              (i) => _OtpBox(
                controller: _otpControllers[i],
                focusNode: _otpFocusNodes[i],
                onChanged: (v) => _onOtpBoxChanged(i, v),
                enabled: !isLoading && !_resendLoading,
              ),
            ),
          ),
          const SizedBox(height: 28),
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: (isLoading || _resendLoading) ? null : _confirmOtp,
              style: _buttonStyle,
              child: Text('CONTINUE', style: _rajdhaniButton),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: _resendSeconds > 0
                ? Text(
                    'Resend in ${_resendSeconds}s',
                    style: TextStyle(
                        color: context.tokens.textMuted, fontSize: 13),
                  )
                : TextButton(
                    onPressed: _resendLoading ? null : _resendOtp,
                    style: TextButton.styleFrom(
                        foregroundColor: context.tokens.textSecondary),
                    child: _resendLoading
                        ? SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: context.tokens.textSecondary),
                          )
                        : const Text('Resend OTP',
                            style: TextStyle(fontSize: 13)),
                  ),
          ),
        ],
      );

  // ── Step 3: new password ───────────────────────────────────────────────────

  Widget _buildStepThree(bool isLoading) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Create a new password for your account.',
            style:
                TextStyle(color: context.tokens.textSecondary, fontSize: 14, height: 1.5),
          ),
          const SizedBox(height: 32),
          _FieldLabel('NEW PASSWORD'),
          const SizedBox(height: 8),
          TextField(
            controller: _newPasswordController,
            obscureText: _obscureNew,
            style: TextStyle(color: context.tokens.textPrimary),
            decoration: _inputDecoration('Enter new password').copyWith(
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureNew
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  color: context.tokens.textMuted,
                  size: 20,
                ),
                onPressed: () => setState(() => _obscureNew = !_obscureNew),
              ),
            ),
          ),
          const SizedBox(height: 20),
          _FieldLabel('CONFIRM PASSWORD'),
          const SizedBox(height: 8),
          TextField(
            controller: _confirmPasswordController,
            obscureText: _obscureConfirm,
            style: TextStyle(color: context.tokens.textPrimary),
            decoration: _inputDecoration('Confirm new password').copyWith(
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureConfirm
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  color: context.tokens.textMuted,
                  size: 20,
                ),
                onPressed: () =>
                    setState(() => _obscureConfirm = !_obscureConfirm),
              ),
            ),
          ),
          const SizedBox(height: 28),
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: isLoading
                  ? null
                  : () {
                      final pw = _newPasswordController.text;
                      final confirm = _confirmPasswordController.text;
                      if (pw.isEmpty) {
                        _showError('New password is required');
                        return;
                      }
                      if (pw != confirm) {
                        _showError('Passwords do not match');
                        return;
                      }
                      ref
                          .read(authNotifierProvider.notifier)
                          .resetPassword(_phone, _storedOtp, pw);
                    },
              style: _buttonStyle,
              child: isLoading
                  ? _loadingIndicator
                  : Text('UPDATE PASSWORD', style: _rajdhaniButton),
            ),
          ),
        ],
      );

  // ── Shared helpers ─────────────────────────────────────────────────────────

  InputDecoration _inputDecoration(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: context.tokens.textMuted, fontSize: 14),
        filled: true,
        fillColor: context.tokens.bgInput,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
          borderSide: BorderSide(color: Theme.of(context).colorScheme.primary),
        ),
      );

  ButtonStyle get _buttonStyle => ElevatedButton.styleFrom(
        backgroundColor: Theme.of(context).colorScheme.primary,
        disabledBackgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.5),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        elevation: 0,
      );

  TextStyle get _rajdhaniButton => TextStyle(
          fontFamily: 'Rajdhani',
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: Colors.white,
        letterSpacing: 2,
      );

  Widget get _loadingIndicator => const SizedBox(
        width: 20,
        height: 20,
        child:
            CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
      );
}

// ── Sub-widgets ──────────────────────────────────────────────────────────────

class _StepRow extends StatelessWidget {
  const _StepRow({required this.current});
  final int current;

  @override
  Widget build(BuildContext context) => Row(
        children: List.generate(3, (i) {
          final step = i + 1;
          final active = step <= current;
          return Expanded(
            child: Container(
              height: 3,
              margin: EdgeInsets.only(right: i < 2 ? 4 : 0),
              decoration: BoxDecoration(
                color: active
                    ? Theme.of(context).colorScheme.primary
                    : context.tokens.borderCard,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          );
        }),
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

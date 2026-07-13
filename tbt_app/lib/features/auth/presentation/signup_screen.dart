import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../../../core/exceptions/app_exception.dart';
import '../../../shared/api/services/auth_service.dart';

class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final phone = _phoneController.text.trim();
      final email = _emailController.text.trim();
      await ref.read(authServiceProvider).signup({
        'name': _nameController.text.trim(),
        'phone': phone,
        if (email.isNotEmpty) 'email': email,
        'password': _passwordController.text,
      });
      if (!mounted) return;
      context.go(
        '${AppRoutes.verify}?phone=${Uri.encodeComponent(phone)}',
      );
    } catch (e) {
      if (!mounted) return;
      final msg =
          e is AppException ? e.message : 'Signup failed. Please try again.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(msg),
          backgroundColor: const Color(0xFFdc2626),
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0f0f0f),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0f0f0f),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFFf0f0f0)),
          onPressed: () => context.go(AppRoutes.login),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 24),
                Text(
                  'CREATE ACCOUNT',
                  style: TextStyle(
          fontFamily: 'Rajdhani',
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFFf0f0f0),
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Join Tamil Business Tribe',
                  style: TextStyle(
          fontFamily: 'Rajdhani',
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: const Color(0xFF606060),
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 36),

                // ── Full name ────────────────────────────────────────────────
                const _FieldLabel('FULL NAME'),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _nameController,
                  textCapitalization: TextCapitalization.words,
                  style: const TextStyle(color: Color(0xFFf0f0f0)),
                  decoration: _inputDecoration('Enter your full name'),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'Full name is required'
                      : null,
                ),
                const SizedBox(height: 20),

                // ── Phone ─────────────────────────────────────────────────────
                const _FieldLabel('PHONE NUMBER'),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: const TextStyle(color: Color(0xFFf0f0f0)),
                  decoration: _inputDecoration('Enter your phone number'),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'Phone number is required'
                      : null,
                ),
                const SizedBox(height: 20),

                // ── Email (optional) ──────────────────────────────────────────
                const _FieldLabel('EMAIL (OPTIONAL)'),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  style: const TextStyle(color: Color(0xFFf0f0f0)),
                  decoration: _inputDecoration('Enter your email address'),
                ),
                const SizedBox(height: 20),

                // ── Password ──────────────────────────────────────────────────
                const _FieldLabel('PASSWORD'),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  style: const TextStyle(color: Color(0xFFf0f0f0)),
                  decoration: _inputDecoration('Create a password').copyWith(
                    suffixIcon: IconButton(
                      tooltip: _obscurePassword ? 'Show password' : 'Hide password',
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        color: const Color(0xFF606060),
                        size: 20,
                      ),
                      onPressed: () =>
                          setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Password is required';
                    if (v.length < 6) {
                      return 'Password must be at least 6 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 20),

                // ── Confirm password ──────────────────────────────────────────
                const _FieldLabel('CONFIRM PASSWORD'),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _confirmController,
                  obscureText: _obscureConfirm,
                  style: const TextStyle(color: Color(0xFFf0f0f0)),
                  decoration: _inputDecoration('Confirm your password').copyWith(
                    suffixIcon: IconButton(
                      tooltip: _obscureConfirm ? 'Show password' : 'Hide password',
                      icon: Icon(
                        _obscureConfirm
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        color: const Color(0xFF606060),
                        size: 20,
                      ),
                      onPressed: () =>
                          setState(() => _obscureConfirm = !_obscureConfirm),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return 'Please confirm your password';
                    }
                    if (v != _passwordController.text) {
                      return 'Passwords do not match';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 32),

                // ── Submit button ─────────────────────────────────────────────
                SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFdc2626),
                      disabledBackgroundColor: const Color(0xFF7f1111),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      elevation: 0,
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            'CREATE ACCOUNT',
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

                // ── Sign in link ──────────────────────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Already have an account? ',
                      style:
                          TextStyle(color: Color(0xFF606060), fontSize: 14),
                    ),
                    Semantics(
                      label: 'Sign In',
                      button: true,
                      child: GestureDetector(
                        onTap: () => context.go(AppRoutes.login),
                        child: const Text(
                          'Sign In',
                          style: TextStyle(
                            color: Color(0xFFdc2626),
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 48),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF606060), fontSize: 14),
        filled: true,
        fillColor: const Color(0xFF1a1a1a),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFF2a2a2a)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFF2a2a2a)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFdc2626)),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFdc2626)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFdc2626)),
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
          color: const Color(0xFF606060),
          letterSpacing: 1.5,
        ),
      );
}

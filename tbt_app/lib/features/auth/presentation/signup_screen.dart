import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../../../core/exceptions/app_exception.dart';
import '../../../shared/api/services/auth_service.dart';

import '../../../shared/theme/design_tokens.dart';
import '../../../shared/theme/theme_tokens.dart';

const _kBusinessTypes = [
  'Product-based',
  'Service-based',
  'Both',
  'Other',
];

class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});

  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _businessNameController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  String? _businessType;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _businessNameController.dispose();
    _cityController.dispose();
    _stateController.dispose();
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
      final businessName = _businessNameController.text.trim();
      final city = _cityController.text.trim();
      final state = _stateController.text.trim();

      await ref.read(authServiceProvider).signup({
        'firstName': _firstNameController.text.trim(),
        'lastName': _lastNameController.text.trim(),
        'phone': phone,
        if (email.isNotEmpty) 'email': email,
        if (businessName.isNotEmpty) 'businessName': businessName,
        if (city.isNotEmpty) 'city': city,
        if (state.isNotEmpty) 'state': state,
        if (_businessType != null) 'productServiceType': _businessType,
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
          backgroundColor: Theme.of(context).colorScheme.primary,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
                    color: context.tokens.textPrimary,
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
                    color: context.tokens.textMuted,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 36),

                // ── First name + Last name ────────────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const _FieldLabel('FIRST NAME'),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _firstNameController,
                            textCapitalization: TextCapitalization.words,
                            style: TextStyle(color: context.tokens.textPrimary),
                            decoration: _inputDecoration('First name'),
                            validator: (v) => (v == null || v.trim().isEmpty)
                                ? 'Required'
                                : null,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const _FieldLabel('LAST NAME'),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _lastNameController,
                            textCapitalization: TextCapitalization.words,
                            style: TextStyle(color: context.tokens.textPrimary),
                            decoration: _inputDecoration('Last name'),
                            validator: (v) => (v == null || v.trim().isEmpty)
                                ? 'Required'
                                : null,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // ── Phone ─────────────────────────────────────────────────────
                const _FieldLabel('PHONE NUMBER'),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: TextStyle(color: context.tokens.textPrimary),
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
                  style: TextStyle(color: context.tokens.textPrimary),
                  decoration: _inputDecoration('Enter your email address'),
                ),
                const SizedBox(height: 20),

                // ── Business name ─────────────────────────────────────────────
                const _FieldLabel('BUSINESS NAME (OPTIONAL)'),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _businessNameController,
                  textCapitalization: TextCapitalization.words,
                  style: TextStyle(color: context.tokens.textPrimary),
                  decoration: _inputDecoration('Your business name'),
                ),
                const SizedBox(height: 20),

                // ── Business type dropdown ─────────────────────────────────────
                const _FieldLabel('BUSINESS TYPE (OPTIONAL)'),
                const SizedBox(height: 8),
                _BusinessTypeDropdown(
                  value: _businessType,
                  onChanged: (v) => setState(() => _businessType = v),
                  inputDecoration: _inputDecoration('Select business type'),
                ),
                const SizedBox(height: 20),

                // ── City + State ──────────────────────────────────────────────
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const _FieldLabel('CITY (OPTIONAL)'),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _cityController,
                            textCapitalization: TextCapitalization.words,
                            style: TextStyle(color: context.tokens.textPrimary),
                            decoration: _inputDecoration('City'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const _FieldLabel('STATE (OPTIONAL)'),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _stateController,
                            textCapitalization: TextCapitalization.words,
                            style: TextStyle(color: context.tokens.textPrimary),
                            decoration: _inputDecoration('State'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // ── Password ──────────────────────────────────────────────────
                const _FieldLabel('PASSWORD'),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  style: TextStyle(color: context.tokens.textPrimary),
                  decoration: _inputDecoration('Create a password').copyWith(
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
                  style: TextStyle(color: context.tokens.textPrimary),
                  decoration: _inputDecoration('Confirm your password').copyWith(
                    suffixIcon: IconButton(
                      tooltip: _obscureConfirm ? 'Show password' : 'Hide password',
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
                      backgroundColor: Theme.of(context).colorScheme.primary,
                      disabledBackgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.5),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.md),
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
                    Text(
                      'Already have an account? ',
                      style:
                          TextStyle(color: context.tokens.textMuted, fontSize: 14),
                    ),
                    Semantics(
                      label: 'Sign In',
                      button: true,
                      child: GestureDetector(
                        onTap: () => context.go(AppRoutes.login),
                        child: Text(
                          'Sign In',
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
        hintStyle: TextStyle(color: context.tokens.textMuted, fontSize: 14),
        filled: true,
        fillColor: context.tokens.bgInput,
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
          borderSide: BorderSide(color: Theme.of(context).colorScheme.primary),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: Theme.of(context).colorScheme.primary),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: Theme.of(context).colorScheme.primary),
        ),
      );
}

class _BusinessTypeDropdown extends StatelessWidget {
  const _BusinessTypeDropdown({
    required this.value,
    required this.onChanged,
    required this.inputDecoration,
  });

  final String? value;
  final ValueChanged<String?> onChanged;
  final InputDecoration inputDecoration;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      value: value,
      onChanged: onChanged,
      decoration: inputDecoration,
      dropdownColor: context.tokens.bgInput,
      style: TextStyle(color: context.tokens.textPrimary, fontSize: 14),
      items: _kBusinessTypes
          .map((t) => DropdownMenuItem(value: t, child: Text(t)))
          .toList(),
    );
  }
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

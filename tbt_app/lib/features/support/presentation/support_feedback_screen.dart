import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/support_service.dart';

/// Rating + message feedback form.
class SupportFeedbackScreen extends ConsumerStatefulWidget {
  const SupportFeedbackScreen({super.key});
  @override
  ConsumerState<SupportFeedbackScreen> createState() => _SupportFeedbackScreenState();
}

class _SupportFeedbackScreenState extends ConsumerState<SupportFeedbackScreen> {
  final _formKey = GlobalKey<FormState>();
  final _messageCtl = TextEditingController();
  final _nameCtl = TextEditingController();
  final _emailCtl = TextEditingController();
  int _rating = 5;
  bool _busy = false;

  @override
  void dispose() {
    _messageCtl.dispose();
    _nameCtl.dispose();
    _emailCtl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await ref.read(supportServiceProvider).submitFeedback(
            message: _messageCtl.text.trim(),
            rating: _rating,
            name: _nameCtl.text.trim().isEmpty ? null : _nameCtl.text.trim(),
            email: _emailCtl.text.trim().isEmpty ? null : _emailCtl.text.trim(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Thank you for your feedback!'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.of(context).pop();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not submit feedback. Please try again.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  InputDecoration _deco(String label) {
    final tokens = context.tokens;
    return InputDecoration(
      labelText: label,
      labelStyle: TextStyle(color: tokens.textMuted),
      filled: true,
      fillColor: tokens.bgInput,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: tokens.borderInput),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: tokens.borderInput),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: kColorAccent),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: const Text('Feedback',
            style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'How would you rate your experience?',
              style: TextStyle(color: tokens.textPrimary, fontSize: 14, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (i) {
                final active = i < _rating;
                return IconButton(
                  iconSize: 34,
                  onPressed: () => setState(() => _rating = i + 1),
                  icon: Icon(
                    active ? Icons.star_rounded : Icons.star_outline_rounded,
                    color: active ? Colors.amber : tokens.textMuted,
                  ),
                );
              }),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _messageCtl,
              decoration: _deco('Tell us more'),
              maxLines: 6,
              style: TextStyle(color: tokens.textPrimary),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Please share your thoughts' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _nameCtl,
              decoration: _deco('Your name (optional)'),
              style: TextStyle(color: tokens.textPrimary),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _emailCtl,
              decoration: _deco('Email (optional)'),
              keyboardType: TextInputType.emailAddress,
              style: TextStyle(color: tokens.textPrimary),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _busy ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: kColorAccent,
                minimumSize: const Size.fromHeight(46),
              ),
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('SUBMIT',
                      style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.8)),
            ),
          ],
        ),
      ),
    );
  }
}

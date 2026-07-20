import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/support_service.dart';
import '../providers/support_providers.dart';

/// Contact form → submits a support ticket. Backend auto-attaches
/// memberId from the JWT cookie.
class SupportContactScreen extends ConsumerStatefulWidget {
  const SupportContactScreen({super.key});
  @override
  ConsumerState<SupportContactScreen> createState() => _SupportContactScreenState();
}

class _SupportContactScreenState extends ConsumerState<SupportContactScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtl = TextEditingController();
  final _emailCtl = TextEditingController();
  final _phoneCtl = TextEditingController();
  final _subjectCtl = TextEditingController();
  final _messageCtl = TextEditingController();
  String? _categoryId;
  bool _busy = false;

  @override
  void dispose() {
    _nameCtl.dispose();
    _emailCtl.dispose();
    _phoneCtl.dispose();
    _subjectCtl.dispose();
    _messageCtl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await ref.read(supportServiceProvider).submitTicket(
            name: _nameCtl.text.trim(),
            email: _emailCtl.text.trim(),
            phone: _phoneCtl.text.trim().isEmpty ? null : _phoneCtl.text.trim(),
            subject: _subjectCtl.text.trim(),
            message: _messageCtl.text.trim(),
            categoryId: _categoryId,
          );
      ref.invalidate(myTicketsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ticket submitted — we\'ll get back to you soon.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.of(context).pop();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not submit ticket. Please try again.'),
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
    final categories = ref.watch(supportCategoriesProvider);
    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: const Text('Contact Us',
            style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700)),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _nameCtl,
              decoration: _deco('Your name'),
              style: TextStyle(color: tokens.textPrimary),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _emailCtl,
              decoration: _deco('Email'),
              keyboardType: TextInputType.emailAddress,
              style: TextStyle(color: tokens.textPrimary),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Required';
                if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim())) {
                  return 'Invalid email';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phoneCtl,
              decoration: _deco('Phone (optional)'),
              keyboardType: TextInputType.phone,
              style: TextStyle(color: tokens.textPrimary),
            ),
            const SizedBox(height: 12),
            categories.maybeWhen(
              data: (cats) => cats.isEmpty
                  ? const SizedBox.shrink()
                  : DropdownButtonFormField<String?>(
                      value: _categoryId,
                      decoration: _deco('Category (optional)'),
                      dropdownColor: tokens.bgSurface,
                      style: TextStyle(color: tokens.textPrimary),
                      items: [
                        const DropdownMenuItem<String?>(value: null, child: Text('— none —')),
                        ...cats.map((c) => DropdownMenuItem<String?>(
                              value: c.id,
                              child: Text(c.name),
                            )),
                      ],
                      onChanged: (v) => setState(() => _categoryId = v),
                    ),
              orElse: () => const SizedBox.shrink(),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _subjectCtl,
              decoration: _deco('Subject'),
              style: TextStyle(color: tokens.textPrimary),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _messageCtl,
              decoration: _deco('Message'),
              maxLines: 5,
              style: TextStyle(color: tokens.textPrimary),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
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

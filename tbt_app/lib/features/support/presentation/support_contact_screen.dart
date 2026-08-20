import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/api/dio_provider.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/support_service.dart';
import '../domain/support_models.dart';
import '../providers/support_providers.dart';

/// Support ticket submission form.
///
/// After a successful submit swaps the form for an inline success card
/// showing the assigned `#TBT-{n}` id + a "View ticket" CTA that jumps
/// into the chat thread.
class SupportContactScreen extends ConsumerStatefulWidget {
  const SupportContactScreen({super.key});
  @override
  ConsumerState<SupportContactScreen> createState() =>
      _SupportContactScreenState();
}

class _SupportContactScreenState extends ConsumerState<SupportContactScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtl = TextEditingController();
  final _emailCtl = TextEditingController();
  final _phoneCtl = TextEditingController();
  final _subjectCtl = TextEditingController();
  final _messageCtl = TextEditingController();

  String? _categoryId;
  String _priority = 'medium'; // low | medium | high
  String? _preferredContact; // email | whatsapp | phone
  bool _busy = false;

  static const int _kMaxAttachmentBytes = 10 * 1024 * 1024;
  static const int _kMaxAttachmentCount = 5;

  final List<_AttachmentSlot> _slots = [];

  // On successful submit we swap the form for a confirmation card.
  SupportTicket? _submittedTicket;

  @override
  void dispose() {
    _nameCtl.dispose();
    _emailCtl.dispose();
    _phoneCtl.dispose();
    _subjectCtl.dispose();
    _messageCtl.dispose();
    super.dispose();
  }

  String _guessContentType(String filename) {
    final ext = filename.split('.').last.toLowerCase();
    return const {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'pdf': 'application/pdf',
          'txt': 'text/plain',
          'log': 'text/plain',
          'doc': 'application/msword',
          'docx':
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }[ext] ??
        'application/octet-stream';
  }

  Future<void> _pickAttachments() async {
    if (_busy) return;
    final remaining = _kMaxAttachmentCount - _slots.length;
    if (remaining <= 0) {
      _toast('Attachment limit reached ($_kMaxAttachmentCount).');
      return;
    }
    try {
      final picked = await FilePicker.platform.pickFiles(
        type: FileType.any,
        allowMultiple: true,
        withData: true,
      );
      if (picked == null || picked.files.isEmpty) return;

      final accepted = <PlatformFile>[];
      for (final f in picked.files) {
        if (accepted.length >= remaining) break;
        if (f.bytes == null) continue;
        if (f.bytes!.length > _kMaxAttachmentBytes) {
          _toast('Skipped "${f.name}" — over 10 MB.');
          continue;
        }
        accepted.add(f);
      }
      if (accepted.isEmpty) return;

      setState(() {
        for (final f in accepted) {
          _slots.add(_AttachmentSlot(file: f, uploading: true));
        }
      });

      // Kick off uploads in parallel so multiple slots don't serialize.
      await Future.wait(accepted.map((f) async {
        final url = await _uploadToR2(f);
        if (!mounted) return;
        setState(() {
          final slot = _slots.firstWhere(
            (s) => identical(s.file, f),
            orElse: () => _slots.first,
          );
          slot.uploading = false;
          slot.uploadedUrl = url;
        });
      }));
    } catch (_) {
      _toast('Could not attach file(s).');
    }
  }

  Future<String?> _uploadToR2(PlatformFile f) async {
    // Uploads via `POST /api/upload/image` — the backend
    // `uploadImageHandler` tries Bunny Storage first and falls back to
    // R2 only if Bunny isn't configured. Same flow the admin panel and
    // the community composer use, so support attachments land on Bunny
    // instead of the old presigned-R2-PUT that produced 404s.
    try {
      final dio = ref.read(dioProvider);
      final contentType = _guessContentType(f.name);
      final bytes = f.bytes!;
      final res = await dio.post<Map<String, dynamic>>(
        '/api/upload/image',
        queryParameters: {
          'pathPrefix': 'tickets',
          'filename': f.name,
        },
        data: bytes,
        options: Options(
          contentType: contentType,
          headers: {'Content-Type': contentType},
          validateStatus: (s) => s != null && s >= 200 && s < 300,
        ),
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      final publicUrl = data['publicUrl'] as String?;
      if (publicUrl == null || publicUrl.isEmpty) return null;
      return publicUrl;
    } catch (_) {
      return null;
    }
  }

  void _removeSlot(_AttachmentSlot slot) {
    setState(() => _slots.remove(slot));
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    // Block if any upload is still running or failed.
    final anyUploading = _slots.any((s) => s.uploading);
    if (anyUploading) {
      _toast('Wait for attachments to finish uploading.');
      return;
    }
    final anyFailed = _slots.any((s) => !s.uploading && s.uploadedUrl == null);
    if (anyFailed) {
      _toast('Some attachments failed. Remove them or try again.');
      return;
    }

    setState(() => _busy = true);
    try {
      final urls = _slots
          .map((s) => s.uploadedUrl)
          .whereType<String>()
          .toList(growable: false);
      final ticket = await ref.read(supportServiceProvider).submitTicket(
            name: _nameCtl.text.trim(),
            email: _emailCtl.text.trim(),
            phone: _phoneCtl.text.trim().isEmpty ? null : _phoneCtl.text.trim(),
            subject: _subjectCtl.text.trim(),
            message: _messageCtl.text.trim(),
            categoryId: _categoryId,
            priority: _priority,
            preferredContact: _preferredContact,
            attachmentUrls: urls,
          );
      ref.invalidate(myTicketsProvider);
      if (!mounted) return;
      setState(() => _submittedTicket = ticket);
    } catch (_) {
      if (!mounted) return;
      _toast('Could not submit ticket. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        iconTheme: IconThemeData(color: tokens.textPrimary),
        title: Text(
          _submittedTicket == null ? 'Raise a Ticket' : 'Ticket submitted',
          style: TextStyle(
            color: tokens.textPrimary,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: _submittedTicket == null ? _buildForm(tokens) : _buildSuccess(tokens),
    );
  }

  Widget _buildForm(ThemeTokens tokens) {
    final categories = ref.watch(supportCategoriesProvider);
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _fieldLabel('YOUR NAME'),
          TextFormField(
            controller: _nameCtl,
            decoration: _inputDecoration('Enter your name'),
            style: TextStyle(color: tokens.textPrimary),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 14),
          _fieldLabel('EMAIL'),
          TextFormField(
            controller: _emailCtl,
            keyboardType: TextInputType.emailAddress,
            decoration: _inputDecoration('you@example.com'),
            style: TextStyle(color: tokens.textPrimary),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Required';
              if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim())) {
                return 'Invalid email';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),
          _fieldLabel('PHONE (OPTIONAL)'),
          TextFormField(
            controller: _phoneCtl,
            keyboardType: TextInputType.phone,
            decoration: _inputDecoration('e.g. +91 90000 00000'),
            style: TextStyle(color: tokens.textPrimary),
          ),
          const SizedBox(height: 14),
          categories.maybeWhen(
            data: (cats) => cats.isEmpty
                ? const SizedBox.shrink()
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _fieldLabel('CATEGORY'),
                      DropdownButtonFormField<String?>(
                        value: _categoryId,
                        dropdownColor: tokens.bgSurface,
                        decoration: _inputDecoration('— none —'),
                        style: TextStyle(color: tokens.textPrimary),
                        items: [
                          const DropdownMenuItem<String?>(
                              value: null, child: Text('— none —')),
                          ...cats.map((c) => DropdownMenuItem<String?>(
                                value: c.id,
                                child: Text(c.name),
                              )),
                        ],
                        onChanged: (v) => setState(() => _categoryId = v),
                      ),
                      const SizedBox(height: 14),
                    ],
                  ),
            orElse: () => const SizedBox.shrink(),
          ),
          _fieldLabel('PRIORITY'),
          const SizedBox(height: 4),
          _ChipGroup(
            options: const [
              _ChipOpt(value: 'low', label: 'Low'),
              _ChipOpt(value: 'medium', label: 'Medium'),
              _ChipOpt(value: 'high', label: 'High'),
            ],
            selected: _priority,
            onChanged: (v) => setState(() => _priority = v),
          ),
          const SizedBox(height: 14),
          _fieldLabel('SUBJECT'),
          TextFormField(
            controller: _subjectCtl,
            decoration: _inputDecoration('Short summary of the issue'),
            style: TextStyle(color: tokens.textPrimary),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 14),
          _fieldLabel('DESCRIPTION'),
          TextFormField(
            controller: _messageCtl,
            decoration: _inputDecoration('Describe the issue in detail'),
            maxLines: 5,
            style: TextStyle(color: tokens.textPrimary),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 14),
          _fieldLabel('REPLY VIA (OPTIONAL)'),
          const SizedBox(height: 4),
          _ChipGroup(
            options: const [
              _ChipOpt(value: 'email', label: 'Email'),
              _ChipOpt(value: 'whatsapp', label: 'WhatsApp'),
              _ChipOpt(value: 'phone', label: 'Phone'),
            ],
            selected: _preferredContact ?? '',
            allowClear: true,
            onChanged: (v) => setState(() =>
                _preferredContact = _preferredContact == v ? null : v),
          ),
          const SizedBox(height: 16),
          _AttachmentsBlock(
            slots: _slots,
            onAdd: _pickAttachments,
            onRemove: _removeSlot,
            maxCount: _kMaxAttachmentCount,
          ),
          const SizedBox(height: 22),
          FilledButton(
            onPressed: _busy ? null : _submit,
            style: FilledButton.styleFrom(
              backgroundColor: kColorAccent,
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: _busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text(
                    'SUBMIT TICKET',
                    style: TextStyle(
                        fontWeight: FontWeight.w800, letterSpacing: 0.8),
                  ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildSuccess(ThemeTokens tokens) {
    final ticket = _submittedTicket!;
    return SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              Center(
                child: Container(
                  width: 68,
                  height: 68,
                  decoration: BoxDecoration(
                    color: const Color(0xFF27AE60).withValues(alpha: 0.10),
                    shape: BoxShape.circle,
                    border: Border.all(
                        color:
                            const Color(0xFF27AE60).withValues(alpha: 0.35)),
                  ),
                  child: const Icon(
                    Icons.check_circle_rounded,
                    color: Color(0xFF27AE60),
                    size: 34,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Ticket ${ticket.displayId} submitted',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: tokens.textPrimary,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.2,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _replyBlurb(ticket),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: tokens.textSecondary,
                  fontSize: 13.5,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: tokens.bgSurface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: tokens.borderCard),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      ticket.subject,
                      style: TextStyle(
                        color: tokens.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Priority: ${ticket.priority.toUpperCase()}'
                      '${ticket.category != null ? '  ·  ${ticket.category!.name}' : ''}',
                      style: TextStyle(
                        color: tokens.textMuted,
                        fontSize: 11.5,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              FilledButton(
                onPressed: () {
                  context.pop();
                  context.push(AppRoutes.supportTicketDetailPath(ticket.id));
                },
                style: FilledButton.styleFrom(
                  backgroundColor: kColorAccent,
                  minimumSize: const Size.fromHeight(46),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'VIEW TICKET',
                  style: TextStyle(
                      fontWeight: FontWeight.w800, letterSpacing: 0.8),
                ),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () => context.pop(),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                  side: BorderSide(color: tokens.borderCard),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  'Back to Support',
                  style: TextStyle(
                      color: tokens.textPrimary,
                      fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _replyBlurb(SupportTicket ticket) {
    final via = ticket.preferredContact;
    final base = "Our support team has been notified. You'll get updates in";
    if (via != null && via.isNotEmpty) {
      return '$base your Ticket detail here and via ${via.toUpperCase()}.';
    }
    return '$base your Ticket detail here.';
  }

  // ── decoration helpers ──
  Widget _fieldLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(
          text,
          style: const TextStyle(
            color: Color(0xFFFFD4AF),
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.8,
          ),
        ),
      );

  InputDecoration _inputDecoration(String hint) {
    final tokens = context.tokens;
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: tokens.textMuted),
      filled: true,
      fillColor: tokens.bgInput,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: tokens.borderInput),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: tokens.borderInput),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: kColorAccent),
      ),
    );
  }
}

// ── Chip group helper ────────────────────────────────────────────

class _ChipOpt {
  const _ChipOpt({required this.value, required this.label});
  final String value;
  final String label;
}

class _ChipGroup extends StatelessWidget {
  const _ChipGroup({
    required this.options,
    required this.selected,
    required this.onChanged,
    this.allowClear = false,
  });
  final List<_ChipOpt> options;
  final String selected;
  final ValueChanged<String> onChanged;
  final bool allowClear;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final opt in options)
          _Chip(
            label: opt.label,
            selected: opt.value == selected,
            onTap: () => onChanged(opt.value),
            tokens: tokens,
          ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
    required this.tokens,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final ThemeTokens tokens;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? kColorAccent.withValues(alpha: 0.10)
              : tokens.bgSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? kColorAccent : tokens.borderCard,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? kColorAccent : tokens.textSecondary,
            fontSize: 12.5,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

// ── Attachments ─────────────────────────────────────────────────

class _AttachmentSlot {
  _AttachmentSlot({required this.file, this.uploading = true, this.uploadedUrl});
  final PlatformFile file;
  bool uploading;
  String? uploadedUrl;
}

class _AttachmentsBlock extends StatelessWidget {
  const _AttachmentsBlock({
    required this.slots,
    required this.onAdd,
    required this.onRemove,
    required this.maxCount,
  });
  final List<_AttachmentSlot> slots;
  final VoidCallback onAdd;
  final void Function(_AttachmentSlot) onRemove;
  final int maxCount;

  String _humanSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'ATTACHMENTS (${slots.length}/$maxCount)',
              style: const TextStyle(
                color: Color(0xFFFFD4AF),
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
              ),
            ),
            const Spacer(),
            TextButton.icon(
              onPressed: slots.length >= maxCount ? null : onAdd,
              icon: const Icon(Icons.attach_file, size: 16),
              label: const Text('Add file'),
              style: TextButton.styleFrom(
                foregroundColor: kColorAccent,
                padding: EdgeInsets.zero,
              ),
            ),
          ],
        ),
        if (slots.isEmpty)
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            decoration: BoxDecoration(
              color: tokens.bgSurface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: tokens.borderCard),
            ),
            child: Text(
              'Up to $maxCount files, 10 MB each. Optional.',
              style: TextStyle(color: tokens.textMuted, fontSize: 12),
            ),
          )
        else
          Column(
            children: [
              for (final slot in slots)
                Container(
                  margin: const EdgeInsets.only(top: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: tokens.bgSurface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: tokens.borderCard),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        slot.uploadedUrl != null
                            ? Icons.check_circle
                            : (slot.uploading
                                ? Icons.cloud_upload
                                : Icons.error_outline),
                        color: slot.uploadedUrl != null
                            ? const Color(0xFF4ADE80)
                            : (slot.uploading
                                ? kColorAccent
                                : const Color(0xFFEF4444)),
                        size: 20,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              slot.file.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  color: tokens.textPrimary,
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              slot.uploading
                                  ? 'Uploading… ${_humanSize(slot.file.size)}'
                                  : slot.uploadedUrl != null
                                      ? 'Ready · ${_humanSize(slot.file.size)}'
                                      : 'Failed · tap remove to retry',
                              style: TextStyle(
                                  color: tokens.textMuted, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      if (slot.uploading)
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      else
                        IconButton(
                          tooltip: 'Remove',
                          icon: Icon(Icons.close,
                              color: tokens.textMuted, size: 18),
                          onPressed: () => onRemove(slot),
                        ),
                    ],
                  ),
                ),
            ],
          ),
      ],
    );
  }
}

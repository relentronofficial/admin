import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/api/dio_provider.dart';
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

  // Attachment state — a member can attach one optional file (image, PDF,
  // log, etc.) up to 10 MB. Uploaded to R2 via presigned URL before the
  // ticket is submitted so the ticket row carries a stable public URL.
  static const int _kMaxAttachmentBytes = 10 * 1024 * 1024; // 10 MB
  PlatformFile? _pickedFile;
  String? _uploadedAttachmentUrl;
  bool _uploadingAttachment = false;

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

  Future<void> _pickAttachment() async {
    if (_uploadingAttachment) return;
    try {
      final picked = await FilePicker.platform.pickFiles(
        type: FileType.any,
        withData: true,
      );
      if (picked == null || picked.files.isEmpty) return;
      final f = picked.files.single;
      final bytes = f.bytes;
      if (bytes == null) {
        _toast('Could not read the picked file.');
        return;
      }
      if (bytes.length > _kMaxAttachmentBytes) {
        _toast('Attachment must be under 10 MB.');
        return;
      }
      setState(() {
        _pickedFile = f;
        _uploadedAttachmentUrl = null;
        _uploadingAttachment = true;
      });
      final url = await _uploadToR2(f);
      if (!mounted) return;
      setState(() {
        _uploadedAttachmentUrl = url;
        _uploadingAttachment = false;
      });
      if (url == null) {
        _toast('Upload failed. Try a different file or skip attachment.');
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _uploadingAttachment = false;
        });
        _toast('Could not attach file.');
      }
    }
  }

  Future<String?> _uploadToR2(PlatformFile f) async {
    try {
      final dio = ref.read(dioProvider);
      final contentType = _guessContentType(f.name);
      final res = await dio.post<Map<String, dynamic>>(
        '/api/upload/presigned-url',
        data: {
          'filename': f.name,
          'contentType': contentType,
          'bucket': 'support-attachments',
          'pathPrefix': 'tickets',
        },
      );
      final data = (res.data?['data'] as Map<String, dynamic>?) ?? const {};
      final uploadUrl = data['uploadUrl'] as String?;
      final publicUrl = data['publicUrl'] as String?;
      if (uploadUrl == null || publicUrl == null) return null;

      // Fresh Dio (no auth interceptor) — presigned URL authenticates via
      // its signed query string.
      final bytes = f.bytes!;
      final putDio = Dio();
      await putDio.put<void>(
        uploadUrl,
        data: Stream.fromIterable([bytes]),
        options: Options(
          headers: {
            'Content-Type': contentType,
            'Content-Length': bytes.length,
          },
        ),
      );
      return publicUrl;
    } catch (_) {
      return null;
    }
  }

  void _clearAttachment() {
    setState(() {
      _pickedFile = null;
      _uploadedAttachmentUrl = null;
      _uploadingAttachment = false;
    });
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
    // If the user picked a file but the upload is still running or
    // failed, block submit so the ticket doesn't silently drop the
    // attachment.
    if (_pickedFile != null && _uploadedAttachmentUrl == null) {
      _toast(_uploadingAttachment
          ? 'Wait for the attachment to finish uploading.'
          : 'Attachment upload failed. Remove it or try again.');
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(supportServiceProvider).submitTicket(
            name: _nameCtl.text.trim(),
            email: _emailCtl.text.trim(),
            phone: _phoneCtl.text.trim().isEmpty ? null : _phoneCtl.text.trim(),
            subject: _subjectCtl.text.trim(),
            message: _messageCtl.text.trim(),
            categoryId: _categoryId,
            attachmentUrl: _uploadedAttachmentUrl,
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
            const SizedBox(height: 16),
            _AttachmentPicker(
              pickedFile: _pickedFile,
              uploading: _uploadingAttachment,
              uploadedUrl: _uploadedAttachmentUrl,
              onPick: _pickAttachment,
              onClear: _clearAttachment,
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

class _AttachmentPicker extends StatelessWidget {
  const _AttachmentPicker({
    required this.pickedFile,
    required this.uploading,
    required this.uploadedUrl,
    required this.onPick,
    required this.onClear,
  });
  final PlatformFile? pickedFile;
  final bool uploading;
  final String? uploadedUrl;
  final VoidCallback onPick;
  final VoidCallback onClear;

  String _humanSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    if (pickedFile == null) {
      return OutlinedButton.icon(
        onPressed: onPick,
        icon: const Icon(Icons.attach_file, size: 18),
        label: const Text('Attach file (optional, max 10 MB)'),
        style: OutlinedButton.styleFrom(
          foregroundColor: kColorAccent,
          side: BorderSide(color: tokens.borderInput),
          minimumSize: const Size.fromHeight(44),
        ),
      );
    }
    final f = pickedFile!;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tokens.bgInput,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: tokens.borderInput),
      ),
      child: Row(
        children: [
          Icon(
            uploadedUrl != null
                ? Icons.check_circle
                : uploading
                    ? Icons.cloud_upload
                    : Icons.attach_file,
            color: uploadedUrl != null
                ? const Color(0xFF4ade80)
                : kColorAccent,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  f.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: tokens.textPrimary,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  uploading
                      ? 'Uploading… ${_humanSize(f.size)}'
                      : uploadedUrl != null
                          ? 'Attached · ${_humanSize(f.size)}'
                          : 'Upload failed · tap remove and try again',
                  style: TextStyle(
                    color: tokens.textMuted,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          if (uploading)
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            IconButton(
              tooltip: 'Remove attachment',
              icon: Icon(Icons.close, color: tokens.textMuted, size: 18),
              onPressed: onClear,
            ),
        ],
      ),
    );
  }
}

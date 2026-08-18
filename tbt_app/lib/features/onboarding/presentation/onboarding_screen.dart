import 'package:better_player_plus/better_player_plus.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../../../shared/api/upload_service.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/providers/me_provider.dart';
import '../domain/onboarding_state.dart';
import '../providers/onboarding_provider.dart';

// Wizard chrome (labels/copy) is hardcoded here, mirroring the user-web
// wizard's same scope decision — the *educational content* (step 2/5
// text+audio+video) is what the product spec requires to be admin-managed,
// and that comes from onboardingContentProvider. See
// SELF_ONBOARDING_SPECKIT.md.

enum _Step { welcome, education, profile, documents, guidedMedia, review }

const _stepOrder = [
  _Step.welcome,
  _Step.education,
  _Step.profile,
  _Step.documents,
  _Step.guidedMedia,
  _Step.review,
];

const _requiredFields = ['firstName', 'businessName', 'businessType', 'city', 'state'];

const _documentTypes = [
  ('business_proof', 'Business Proof'),
  ('gst_certificate', 'GST Certificate'),
  ('id_proof', 'ID Proof'),
  ('other', 'Other'),
];

class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stateAsync = ref.watch(onboardingStateProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Onboarding')),
      body: stateAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Something went wrong. Please try again.')),
        data: (state) {
          if (state.verificationStatus == 'under_review') return const _PendingReviewView();
          if (state.verificationStatus == 'rejected') return _RejectedView(note: state.onboardingReviewNote);
          return _OnboardingWizard(state: state);
        },
      ),
    );
  }
}

class _PendingReviewView extends StatelessWidget {
  const _PendingReviewView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Application Submitted',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: context.tokens.textPrimary)),
            const SizedBox(height: 12),
            Text(
              "Your onboarding has been submitted successfully and is waiting for admin approval. "
              "We'll notify you as soon as it's reviewed.",
              textAlign: TextAlign.center,
              style: TextStyle(color: context.tokens.textSecondary, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _RejectedView extends StatelessWidget {
  const _RejectedView({required this.note});
  final String? note;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Application Not Approved',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: context.tokens.textPrimary)),
            const SizedBox(height: 12),
            Text(
              note ?? 'Your application was not approved. Please contact support for details.',
              textAlign: TextAlign.center,
              style: TextStyle(color: context.tokens.textSecondary, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardingWizard extends ConsumerStatefulWidget {
  const _OnboardingWizard({required this.state});
  final OnboardingWizardState state;

  @override
  ConsumerState<_OnboardingWizard> createState() => _OnboardingWizardState();
}

class _OnboardingWizardState extends ConsumerState<_OnboardingWizard> {
  _Step _step = _Step.welcome;
  late Map<String, dynamic> _profile;
  String _documentType = _documentTypes.first.$1;
  bool _uploading = false;
  bool _saving = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _profile = Map<String, dynamic>.from(widget.state.profile);
  }

  void _goto(_Step s) => setState(() => _step = s);

  Future<void> _saveAndAdvance(_Step next) async {
    setState(() => _saving = true);
    try {
      await ref.read(onboardingRepositoryProvider).saveProgress(_profile);
      if (mounted) _goto(next);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Couldn't save your progress. Please try again.")));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickAndUploadDocument() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.any, allowMultiple: false);
    if (result == null || result.files.isEmpty) return;
    final file = result.files.single;
    final bytes = file.bytes;
    if (bytes == null) return;

    setState(() => _uploading = true);
    try {
      final repo = ref.read(onboardingRepositoryProvider);
      final contentType = _guessContentType(file.name);
      final presigned = await repo.presignDocument(
        filename: file.name,
        contentType: contentType,
        documentType: _documentType,
      );
      await ref.read(uploadServiceProvider).uploadToR2(
            uploadUrl: presigned.uploadUrl,
            bytes: bytes,
            contentType: contentType,
          );
      await repo.registerDocument(documentType: _documentType, documentUrl: presigned.publicUrl);
      ref.invalidate(onboardingStateProvider);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Upload failed. Please try again.')));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ref.read(onboardingRepositoryProvider).submit();
      ref.invalidate(onboardingStateProvider);
      ref.invalidate(meNotifierProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Onboarding submitted!')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Please complete all required fields first.')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final contentAsync = ref.watch(onboardingContentProvider);
    final content = contentAsync.valueOrNull ?? const <OnboardingContentStep>[];
    OnboardingContentStep? findContent(String key) {
      for (final c in content) {
        if (c.stepKey == key) return c;
      }
      return null;
    }

    return Column(
      children: [
        _ProgressBar(step: _step),
        if (widget.state.verificationStatus == 'changes_requested')
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.orange.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Admin requested some changes', style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(widget.state.onboardingReviewNote ?? ''),
              ],
            ),
          ),
        Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(20), child: _buildStep(findContent))),
      ],
    );
  }

  Widget _buildStep(OnboardingContentStep? Function(String) findContent) {
    switch (_step) {
      case _Step.welcome:
        return _StepShell(
          title: 'Welcome to TBT 👋',
          onNext: () => _goto(_Step.education),
          child: const Text(
            "Let's get your account set up. This should take about 5–10 minutes — you can save "
            'your progress and come back anytime before submitting.',
          ),
        );
      case _Step.education:
        return _StepShell(
          title: 'Before you start',
          onBack: () => _goto(_Step.welcome),
          onNext: () => _goto(_Step.profile),
          child: _ContentBlock(content: findContent('introduction')),
        );
      case _Step.profile:
        return _StepShell(
          title: 'Tell us about your business',
          onBack: () => _goto(_Step.education),
          onNext: _saving ? null : () => _saveAndAdvance(_Step.documents),
          nextLabel: _saving ? 'Saving…' : 'Continue',
          child: _ProfileForm(profile: _profile, onChanged: (k, v) => setState(() => _profile[k] = v)),
        );
      case _Step.documents:
        return _StepShell(
          title: 'Upload a document',
          onBack: () => _goto(_Step.profile),
          onNext: () => _goto(_Step.guidedMedia),
          child: _DocumentsStep(
            documentType: _documentType,
            onTypeChanged: (v) => setState(() => _documentType = v),
            uploading: _uploading,
            onPick: _pickAndUploadDocument,
            documents: widget.state.documents,
          ),
        );
      case _Step.guidedMedia:
        return _StepShell(
          title: 'A quick walkthrough',
          onBack: () => _goto(_Step.documents),
          onNext: () => _goto(_Step.review),
          child: _ContentBlock(content: findContent('guided_instructions')),
        );
      case _Step.review:
        final missing = _requiredFields.where((f) => (_profile[f] ?? '').toString().isEmpty).toList();
        final ready = missing.isEmpty && widget.state.documents.isNotEmpty;
        return _ReviewStep(
          profile: _profile,
          documentCount: widget.state.documents.length,
          missingFields: missing,
          ready: ready,
          submitting: _submitting,
          onBack: () => _goto(_Step.guidedMedia),
          onSubmit: _submit,
        );
    }
  }
}

String _guessContentType(String filename) {
  final ext = filename.split('.').last.toLowerCase();
  return switch (ext) {
    'pdf' => 'application/pdf',
    'png' => 'image/png',
    'jpg' || 'jpeg' => 'image/jpeg',
    _ => 'application/octet-stream',
  };
}

// ── Shared bits ──────────────────────────────────────────────────────────────

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.step});
  final _Step step;

  @override
  Widget build(BuildContext context) {
    final index = _stepOrder.indexOf(step);
    final pct = (index + 1) / _stepOrder.length;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Step ${index + 1} of ${_stepOrder.length}',
              style: TextStyle(fontSize: 12, color: context.tokens.textSecondary)),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(value: pct, minHeight: 6),
          ),
        ],
      ),
    );
  }
}

class _StepShell extends StatelessWidget {
  const _StepShell({required this.title, required this.child, this.onBack, required this.onNext, this.nextLabel});
  final String title;
  final Widget child;
  final VoidCallback? onBack;
  final VoidCallback? onNext;
  final String? nextLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: context.tokens.textPrimary)),
        const SizedBox(height: 20),
        child,
        const SizedBox(height: 32),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            onBack != null
                ? TextButton(onPressed: onBack, child: const Text('Back'))
                : const SizedBox.shrink(),
            ElevatedButton(onPressed: onNext, child: Text(nextLabel ?? 'Continue')),
          ],
        ),
      ],
    );
  }
}

class _ProfileForm extends StatelessWidget {
  const _ProfileForm({required this.profile, required this.onChanged});
  final Map<String, dynamic> profile;
  final void Function(String key, String value) onChanged;

  static const _fields = [
    ('firstName', 'First Name *'),
    ('lastName', 'Last Name'),
    ('city', 'City *'),
    ('state', 'State *'),
    ('businessName', 'Business Name *'),
    ('businessType', 'Business Type *'),
    ('productServiceType', 'Product / Service Type'),
    ('gstNumber', 'GST Number'),
    ('annualTurnover', 'Annual Turnover'),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: _fields.map((f) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: TextFormField(
            initialValue: (profile[f.$1] ?? '').toString(),
            decoration: InputDecoration(labelText: f.$2),
            onChanged: (v) => onChanged(f.$1, v),
          ),
        );
      }).toList(),
    );
  }
}

class _DocumentsStep extends StatelessWidget {
  const _DocumentsStep({
    required this.documentType,
    required this.onTypeChanged,
    required this.uploading,
    required this.onPick,
    required this.documents,
  });
  final String documentType;
  final void Function(String) onTypeChanged;
  final bool uploading;
  final VoidCallback onPick;
  final List<OnboardingDocument> documents;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          value: documentType,
          items: _documentTypes.map((d) => DropdownMenuItem(value: d.$1, child: Text(d.$2))).toList(),
          onChanged: (v) { if (v != null) onTypeChanged(v); },
          decoration: const InputDecoration(labelText: 'Document Type'),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: uploading ? null : onPick,
          icon: uploading
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.upload_file),
          label: Text(uploading ? 'Uploading…' : 'Choose File'),
        ),
        const SizedBox(height: 16),
        ...documents.map((d) => ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(d.documentType),
              trailing: Text(d.status, style: const TextStyle(fontSize: 12)),
            )),
      ],
    );
  }
}

class _ReviewStep extends StatelessWidget {
  const _ReviewStep({
    required this.profile,
    required this.documentCount,
    required this.missingFields,
    required this.ready,
    required this.submitting,
    required this.onBack,
    required this.onSubmit,
  });
  final Map<String, dynamic> profile;
  final int documentCount;
  final List<String> missingFields;
  final bool ready;
  final bool submitting;
  final VoidCallback onBack;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Review & Submit',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: context.tokens.textPrimary)),
        const SizedBox(height: 20),
        ...profile.entries.where((e) => (e.value ?? '').toString().isNotEmpty).map(
              (e) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(e.key, style: TextStyle(color: context.tokens.textSecondary)),
                    Flexible(child: Text(e.value.toString(), textAlign: TextAlign.end)),
                  ],
                ),
              ),
            ),
        const SizedBox(height: 12),
        Text('$documentCount document(s) uploaded', style: TextStyle(color: context.tokens.textSecondary)),
        if (!ready)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              missingFields.isNotEmpty
                  ? 'Please fill in: ${missingFields.join(", ")}'
                  : 'Please upload at least one document.',
              style: const TextStyle(color: Colors.orange),
            ),
          ),
        const SizedBox(height: 32),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton(onPressed: onBack, child: const Text('Back')),
            ElevatedButton(
              onPressed: (ready && !submitting) ? onSubmit : null,
              child: Text(submitting ? 'Submitting…' : 'Submit for Approval'),
            ),
          ],
        ),
      ],
    );
  }
}

// ── Educational content (text + video + audio) ──────────────────────────────

class _ContentBlock extends StatelessWidget {
  const _ContentBlock({this.content});
  final OnboardingContentStep? content;

  @override
  Widget build(BuildContext context) {
    if (content == null) {
      return Text(
        "We'll ask you for a few business details and a document to verify your account. "
        "Once submitted, our team reviews it and you'll be notified as soon as you're approved.",
        style: TextStyle(color: context.tokens.textSecondary, height: 1.5),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (content!.textBody != null) Text(content!.textBody!, style: TextStyle(height: 1.5, color: context.tokens.textPrimary)),
        if (content!.videoUrl != null) ...[
          const SizedBox(height: 16),
          _InlineVideo(url: content!.videoUrl!),
        ],
        if (content!.audioUrl != null) ...[
          const SizedBox(height: 16),
          _InlineAudio(url: content!.audioUrl!),
        ],
      ],
    );
  }
}

class _InlineVideo extends StatefulWidget {
  const _InlineVideo({required this.url});
  final String url;

  @override
  State<_InlineVideo> createState() => _InlineVideoState();
}

class _InlineVideoState extends State<_InlineVideo> {
  BetterPlayerController? _controller;

  @override
  void initState() {
    super.initState();
    final dataSource = BetterPlayerDataSource(BetterPlayerDataSourceType.network, widget.url);
    _controller = BetterPlayerController(
      const BetterPlayerConfiguration(aspectRatio: 16 / 9, autoPlay: false, fullScreenByDefault: false),
      betterPlayerDataSource: dataSource,
    );
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: BetterPlayer(controller: _controller!),
      ),
    );
  }
}

class _InlineAudio extends StatefulWidget {
  const _InlineAudio({required this.url});
  final String url;

  @override
  State<_InlineAudio> createState() => _InlineAudioState();
}

class _InlineAudioState extends State<_InlineAudio> {
  final AudioPlayer _player = AudioPlayer();
  bool _loaded = false;
  bool _playing = false;

  Future<void> _toggle() async {
    if (!_loaded) {
      await _player.setUrl(widget.url);
      _loaded = true;
    }
    if (_playing) {
      await _player.pause();
    } else {
      await _player.play();
    }
    setState(() => _playing = !_playing);
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: _toggle,
      icon: Icon(_playing ? Icons.pause : Icons.play_arrow),
      label: Text(_playing ? 'Pause Audio' : 'Play Audio'),
    );
  }
}

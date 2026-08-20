import 'package:better_player_plus/better_player_plus.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:just_audio/just_audio.dart';
import 'package:lottie/lottie.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/api/upload_service.dart';
import '../../../shared/providers/me_provider.dart';
import '../../auth/providers/auth_provider.dart';
import '../domain/onboarding_state.dart';
import '../providers/onboarding_provider.dart';

// ── Design tokens ─────────────────────────────────────────────────────────────

const _kBg = Color(0xFF080808);
const _kCard = Color(0xFF141414);
const _kSurface = Color(0xFF1C1C1C);
const _kBorder = Color(0xFF2A2A2A);
const _kAccent = Color(0xFFDC2626);
const _kGreen = Color(0xFF22C55E);
const _kAmber = Color(0xFFF59E0B);
const _kText = Color(0xFFF0F0F0);
const _kMuted = Color(0xFF808080);

// Support WhatsApp — update this number in production
const _kSupportWhatsAppUrl = 'https://wa.me/919000000000';

// ── Wizard step definition ────────────────────────────────────────────────────

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

// ── Entry point ───────────────────────────────────────────────────────────────

class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stateAsync = ref.watch(onboardingStateProvider);
    return Scaffold(
      backgroundColor: _kBg,
      body: stateAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: _kAccent)),
        error: (_, __) => Center(
          child: Text('Something went wrong. Please try again.',
              style: TextStyle(color: _kMuted)),
        ),
        data: (state) {
          if (state.verificationStatus == 'under_review') {
            return _PendingView(submittedAt: state.onboardingSubmittedAt);
          }
          if (state.verificationStatus == 'verified' || state.onboardingCompleted) {
            return const _VerifiedView();
          }
          if (state.verificationStatus == 'rejected') {
            return _RejectedView(note: state.onboardingReviewNote);
          }
          return _OnboardingWizard(state: state);
        },
      ),
    );
  }
}

// ── Terminal states ────────────────────────────────────────────────────────────

class _PendingView extends StatelessWidget {
  const _PendingView({this.submittedAt});
  final String? submittedAt;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _iconBox(Icons.hourglass_top_rounded, _kAccent),
              const SizedBox(height: 24),
              const Text('Under Review',
                  style: TextStyle(color: _kText, fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              const Text(
                "Your application is being reviewed. We'll notify you once it's approved.",
                textAlign: TextAlign.center,
                style: TextStyle(color: _kMuted, fontSize: 15, height: 1.55),
              ),
              if (submittedAt != null) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: _kCard,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _kBorder),
                  ),
                  child: Row(children: [
                    const Icon(Icons.schedule_outlined, color: _kMuted, size: 16),
                    const SizedBox(width: 8),
                    Text(
                      'Submitted ${_formatRelativeDate(submittedAt!)}',
                      style: const TextStyle(color: _kMuted, fontSize: 13),
                    ),
                  ]),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _RejectedView extends ConsumerWidget {
  const _RejectedView({required this.note});
  final String? note;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _iconBox(Icons.close_rounded, _kAccent),
              const SizedBox(height: 24),
              const Text('Not Approved',
                  style: TextStyle(color: _kText, fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              Text(
                note ?? 'Your application was not approved. Please contact support.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: _kMuted, fontSize: 15, height: 1.55),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton.icon(
                  onPressed: () => launchUrl(
                    Uri.parse(_kSupportWhatsAppUrl),
                    mode: LaunchMode.externalApplication,
                  ),
                  icon: const Icon(Icons.chat_outlined, size: 18),
                  label: const Text('Contact Support'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _kText,
                    side: const BorderSide(color: _kBorder),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () async {
                  await ref.read(authNotifierProvider.notifier).logout();
                  if (context.mounted) context.go(AppRoutes.login);
                },
                child: const Text('Sign out',
                    style: TextStyle(color: _kMuted, fontSize: 14)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VerifiedView extends StatelessWidget {
  const _VerifiedView();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _iconBox(Icons.check_circle_outline_rounded, _kGreen),
              const SizedBox(height: 24),
              const Text(
                "You're Verified!",
                style: TextStyle(
                  color: _kGreen,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Your TBT account is active. You can now access all platform features.',
                textAlign: TextAlign.center,
                style: TextStyle(color: _kMuted, fontSize: 15, height: 1.55),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () => context.go(AppRoutes.dashboard),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'GO TO DASHBOARD',
                    style: TextStyle(
                      fontFamily: 'Rajdhani',
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 2,
                    ),
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

Widget _iconBox(IconData icon, Color color) => Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Icon(icon, color: color, size: 36),
    );

// ── Main wizard ───────────────────────────────────────────────────────────────

class _OnboardingWizard extends ConsumerStatefulWidget {
  const _OnboardingWizard({required this.state});
  final OnboardingWizardState state;

  @override
  ConsumerState<_OnboardingWizard> createState() => _OnboardingWizardState();
}

class _OnboardingWizardState extends ConsumerState<_OnboardingWizard> {
  final _pageController = PageController();
  int _page = 0;
  late Map<String, dynamic> _profile;
  String _documentType = _documentTypes.first.$1;
  bool _uploading = false;
  bool _uploadingPhoto = false;
  bool _deleting = false;
  bool _saving = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _profile = Map<String, dynamic>.from(widget.state.profile);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _goTo(int p) {
    setState(() => _page = p);
    _pageController.animateToPage(
      p,
      duration: const Duration(milliseconds: 380),
      curve: Curves.easeInOutCubic,
    );
  }

  Future<void> _saveAndNext() async {
    setState(() => _saving = true);
    try {
      await ref.read(onboardingRepositoryProvider).saveProgress(_profile);
      _goTo(_page + 1);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Couldn't save. Please try again.")),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickAndUploadDocument() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.any);
    if (result == null || result.files.isEmpty) return;
    final file = result.files.single;
    final bytes = file.bytes;
    if (bytes == null) return;

    setState(() => _uploading = true);
    try {
      final repo = ref.read(onboardingRepositoryProvider);
      final ct = _guessContentType(file.name);
      final presigned = await repo.presignDocument(
        filename: file.name,
        contentType: ct,
        documentType: _documentType,
      );
      await ref
          .read(uploadServiceProvider)
          .uploadToR2(uploadUrl: presigned.uploadUrl, bytes: bytes, contentType: ct);
      await repo.registerDocument(
          documentType: _documentType, documentUrl: presigned.publicUrl);
      ref.invalidate(onboardingStateProvider);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Upload failed.')));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _pickProfilePhoto() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 90,
    );
    if (picked == null) return;

    setState(() => _uploadingPhoto = true);
    try {
      final bytes = await picked.readAsBytes();
      final ct = UploadService.guessContentType(picked.name);
      final repo = ref.read(onboardingRepositoryProvider);
      final presigned = await repo.presignProfilePhoto(
        filename: picked.name,
        contentType: ct,
      );
      await ref.read(uploadServiceProvider).uploadToR2(
        uploadUrl: presigned.uploadUrl,
        bytes: bytes,
        contentType: ct,
      );
      setState(() => _profile['profilePhotoUrl'] = presigned.publicUrl);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Photo upload failed. Please try again.')));
      }
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<void> _deleteDocument(String id) async {
    setState(() => _deleting = true);
    try {
      await ref.read(onboardingRepositoryProvider).deleteDocument(id);
      ref.invalidate(onboardingStateProvider);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not remove document.')));
      }
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ref.read(onboardingRepositoryProvider).submit();
      ref.invalidate(onboardingStateProvider);
      ref.invalidate(meNotifierProvider);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Please fill all required fields and upload at least one document.')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  List<String> get _missingFields =>
      _requiredFields.where((f) => (_profile[f] ?? '').toString().isEmpty).toList();

  bool get _ready =>
      _missingFields.isEmpty && widget.state.documents.isNotEmpty;

  VoidCallback? _onNext() {
    final profilePage = _stepOrder.indexOf(_Step.profile);
    final reviewPage = _stepOrder.indexOf(_Step.review);
    if (_page == profilePage) return _saving ? null : _saveAndNext;
    if (_page == reviewPage) return (_ready && !_submitting) ? _submit : null;
    return () => _goTo(_page + 1);
  }

  String _nextLabel() {
    if (_page == 0) return 'Get Started';
    if (_page == _stepOrder.indexOf(_Step.profile)) {
      return _saving ? 'Saving…' : 'Continue';
    }
    if (_page == _stepOrder.indexOf(_Step.review)) {
      return _submitting ? 'Submitting…' : 'Submit Application';
    }
    return 'Continue';
  }

  @override
  Widget build(BuildContext context) {
    final contentAsync = ref.watch(onboardingContentProvider);
    if (contentAsync.isLoading && (_page == 1 || _page == 4)) {
      return const _ContentStepSkeleton();
    }
    final content = contentAsync.valueOrNull ?? const <OnboardingContentStep>[];
    // Only match steps that are active (null = not returned by old backend = treat as active)
    OnboardingContentStep? find(String key) {
      for (final c in content) {
        if (c.stepKey == key && c.isActive != false) return c;
      }
      return null;
    }

    return SafeArea(
      child: Column(
        children: [
          // Changes requested banner
          if (widget.state.verificationStatus == 'changes_requested')
            _ChangesBanner(note: widget.state.onboardingReviewNote),

          // Page content
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _WelcomeStep(),
                _ContentStep(
                  content: find('introduction'),
                  stepLabel: 'Before You Begin',
                ),
                _ProfileStep(
                  profile: _profile,
                  onChanged: (k, v) => setState(() => _profile[k] = v),
                  onPickPhoto: _pickProfilePhoto,
                  uploadingPhoto: _uploadingPhoto,
                ),
                _DocumentsStep(
                  documentType: _documentType,
                  onTypeChanged: (v) => setState(() => _documentType = v),
                  uploading: _uploading,
                  onPick: _pickAndUploadDocument,
                  documents: widget.state.documents,
                  onDelete: _deleteDocument,
                  deleting: _deleting,
                ),
                _ContentStep(
                  content: find('guided_instructions'),
                  stepLabel: 'How It Works',
                ),
                _ReviewStep(
                  profile: _profile,
                  documentCount: widget.state.documents.length,
                  missingFields: _missingFields,
                  ready: _ready,
                ),
              ],
            ),
          ),

          // Sticky bottom nav
          _BottomNav(
            currentPage: _page,
            total: _stepOrder.length,
            onBack: _page > 0 ? () => _goTo(_page - 1) : null,
            onNext: _onNext(),
            nextLabel: _nextLabel(),
          ),
        ],
      ),
    );
  }
}

// ── Step 1: Welcome ────────────────────────────────────────────────────────────

class _WelcomeStep extends StatefulWidget {
  const _WelcomeStep();

  @override
  State<_WelcomeStep> createState() => _WelcomeStepState();
}

class _WelcomeStepState extends State<_WelcomeStep>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final heroH = constraints.maxHeight * 0.50;
      return Column(
        children: [
          // Hero zone — animated TBT mark with pulse rings
          SizedBox(
            height: heroH,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      colors: [_kAccent.withOpacity(0.18), _kBg],
                    ),
                  ),
                ),
                AnimatedBuilder(
                  animation: _pulse,
                  builder: (_, __) => CustomPaint(
                    size: Size(constraints.maxWidth, heroH),
                    painter: _PulsePainter(_pulse.value),
                  ),
                ),
                Container(
                  width: 92,
                  height: 92,
                  decoration: BoxDecoration(
                    color: _kAccent,
                    borderRadius: BorderRadius.circular(26),
                    boxShadow: [
                      BoxShadow(
                        color: _kAccent.withOpacity(0.45),
                        blurRadius: 28,
                        spreadRadius: 0,
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Text(
                      'TBT',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2.5,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Content zone
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(28, 24, 28, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Welcome to\nTamil Business Tribe',
                    style: TextStyle(
                      color: _kText,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Set up your profile in 5 minutes. Answer a few questions about your business and upload a document to get started.',
                    style: TextStyle(color: _kMuted, fontSize: 15, height: 1.6),
                  ),
                  const SizedBox(height: 24),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: const [
                      _Pill(icon: Icons.business_center_outlined, label: 'Business Profile'),
                      _Pill(icon: Icons.verified_outlined, label: 'Verification'),
                      _Pill(icon: Icons.school_outlined, label: 'Learning Access'),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    });
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: _kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: _kAccent, size: 14),
          const SizedBox(width: 6),
          Text(label,
              style: const TextStyle(
                  color: _kText, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _PulsePainter extends CustomPainter {
  const _PulsePainter(this.progress);
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (var i = 0; i < 3; i++) {
      final t = ((progress + i / 3) % 1.0);
      paint.color = _kAccent.withOpacity((1 - t) * 0.22);
      canvas.drawCircle(center, 50 + t * 130, paint);
    }
  }

  @override
  bool shouldRepaint(_PulsePainter old) => old.progress != progress;
}

// ── Step 2 / 5: Rich admin content (education / guided media) ─────────────────

class _ContentStep extends StatelessWidget {
  const _ContentStep({this.content, required this.stepLabel});
  final OnboardingContentStep? content;
  final String stepLabel;

  @override
  Widget build(BuildContext context) {
    final c = content;
    final hasHero = c != null && (c.lottieUrl != null || c.imageUrl != null);

    return LayoutBuilder(builder: (context, constraints) {
      return Column(
        children: [
          if (hasHero)
            SizedBox(
              height: constraints.maxHeight * 0.42,
              child: _HeroZone(content: c),
            ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Step label chip
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: _kAccent.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      stepLabel.toUpperCase(),
                      style: const TextStyle(
                        color: _kAccent,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    c?.title ?? 'Getting Ready',
                    style: const TextStyle(
                      color: _kText,
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      height: 1.3,
                    ),
                  ),
                  if (c?.textBody != null) ...[
                    const SizedBox(height: 14),
                    Text(c!.textBody!,
                        style: const TextStyle(
                            color: _kMuted, fontSize: 14, height: 1.75)),
                  ] else if (c == null)
                    const Padding(
                      padding: EdgeInsets.only(top: 14),
                      child: Text(
                        "We'll ask you for some business details and a document to verify your account. "
                        'Once submitted, our team reviews it and you\'ll be notified when approved.',
                        style: TextStyle(color: _kMuted, fontSize: 14, height: 1.75),
                      ),
                    ),
                  if (c?.videoUrl != null) ...[
                    const SizedBox(height: 20),
                    _InlineVideo(url: c!.videoUrl!),
                  ],
                  if (c?.audioUrl != null) ...[
                    const SizedBox(height: 16),
                    _InlineAudio(url: c!.audioUrl!),
                  ],
                  if (c?.quizData != null) _QuizWidget(quizData: c!.quizData!),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        ],
      );
    });
  }
}

// ── Hero zone: Lottie → image → gradient fallback ─────────────────────────────

class _HeroZone extends StatelessWidget {
  const _HeroZone({required this.content});
  final OnboardingContentStep content;

  @override
  Widget build(BuildContext context) {
    Widget hero;
    if (content.lottieUrl != null) {
      hero = Lottie.network(
        content.lottieUrl!,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => _FallbackHero(),
      );
    } else if (content.imageUrl != null) {
      hero = CachedNetworkImage(
        imageUrl: content.imageUrl!,
        fit: BoxFit.cover,
        errorWidget: (_, __, ___) => _FallbackHero(),
        placeholder: (_, __) => Container(color: _kCard),
      );
    } else {
      hero = _FallbackHero();
    }

    return ClipRect(
      child: Stack(
        fit: StackFit.expand,
        children: [
          hero,
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, _kBg],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FallbackHero extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_kAccent.withOpacity(0.15), _kCard],
        ),
      ),
      child: Center(
        child: Icon(Icons.business_center_rounded,
            color: _kAccent.withOpacity(0.35), size: 72),
      ),
    );
  }
}

// ── Step 3: Profile form (grouped) ────────────────────────────────────────────

class _ProfileStep extends StatelessWidget {
  const _ProfileStep({
    required this.profile,
    required this.onChanged,
    required this.onPickPhoto,
    required this.uploadingPhoto,
  });
  final Map<String, dynamic> profile;
  final void Function(String key, String value) onChanged;
  final VoidCallback onPickPhoto;
  final bool uploadingPhoto;

  @override
  Widget build(BuildContext context) {
    final photoUrl = (profile['profilePhotoUrl'] as String?)?.isNotEmpty == true
        ? profile['profilePhotoUrl'] as String
        : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar picker
          Center(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: GestureDetector(
                onTap: uploadingPhoto ? null : onPickPhoto,
                child: Stack(
                  children: [
                    CircleAvatar(
                      radius: 44,
                      backgroundColor: _kSurface,
                      backgroundImage:
                          photoUrl != null ? NetworkImage(photoUrl) : null,
                      child: uploadingPhoto
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                  color: _kAccent, strokeWidth: 2),
                            )
                          : photoUrl == null
                              ? const Icon(Icons.person_outline_rounded,
                                  color: _kMuted, size: 38)
                              : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        decoration: const BoxDecoration(
                          color: _kAccent,
                          shape: BoxShape.circle,
                        ),
                        padding: const EdgeInsets.all(6),
                        child: const Icon(Icons.camera_alt_rounded,
                            color: Colors.white, size: 14),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          _sectionHeader(Icons.person_outline_rounded, 'Personal Information'),
          const SizedBox(height: 14),
          _field(profile, onChanged, 'firstName', 'First Name *'),
          _field(profile, onChanged, 'lastName', 'Last Name'),
          Row(children: [
            Expanded(child: _field(profile, onChanged, 'city', 'City *')),
            const SizedBox(width: 12),
            Expanded(child: _field(profile, onChanged, 'state', 'State *')),
          ]),
          const SizedBox(height: 22),
          _sectionHeader(Icons.business_outlined, 'Business Details'),
          const SizedBox(height: 14),
          _field(profile, onChanged, 'businessName', 'Business Name *'),
          _field(profile, onChanged, 'businessType', 'Business Type *'),
          _field(profile, onChanged, 'productServiceType', 'Product / Service'),
          Row(children: [
            Expanded(child: _field(profile, onChanged, 'gstNumber', 'GST Number')),
            const SizedBox(width: 12),
            Expanded(
                child: _field(profile, onChanged, 'annualTurnover', 'Annual Turnover')),
          ]),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

Widget _sectionHeader(IconData icon, String label) {
  return Row(children: [
    Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        color: _kAccent.withOpacity(0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, color: _kAccent, size: 17),
    ),
    const SizedBox(width: 10),
    Text(label,
        style: const TextStyle(
            color: _kText, fontSize: 15, fontWeight: FontWeight.w700)),
  ]);
}

Widget _field(
  Map<String, dynamic> profile,
  void Function(String, String) onChanged,
  String key,
  String label,
) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: TextFormField(
      initialValue: (profile[key] ?? '').toString(),
      style: const TextStyle(color: _kText, fontSize: 15),
      onChanged: (v) => onChanged(key, v),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: _kMuted, fontSize: 13),
        filled: true,
        fillColor: _kSurface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border:
            OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kBorder)),
        enabledBorder:
            OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kBorder)),
        focusedBorder:
            OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _kAccent)),
      ),
    ),
  );
}

// ── Step 4: Document upload ────────────────────────────────────────────────────

class _DocumentsStep extends StatelessWidget {
  const _DocumentsStep({
    required this.documentType,
    required this.onTypeChanged,
    required this.uploading,
    required this.onPick,
    required this.documents,
    required this.onDelete,
    required this.deleting,
  });
  final String documentType;
  final void Function(String) onTypeChanged;
  final bool uploading;
  final VoidCallback onPick;
  final List<OnboardingDocument> documents;
  final Future<void> Function(String docId) onDelete;
  final bool deleting;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader(Icons.upload_file_outlined, 'Upload Documents'),
          const SizedBox(height: 8),
          const Text(
            'Upload at least one document to verify your business.',
            style: TextStyle(color: _kMuted, fontSize: 13, height: 1.5),
          ),
          const SizedBox(height: 20),

          // Document type dropdown
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: _kSurface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _kBorder),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: documentType,
                isExpanded: true,
                dropdownColor: _kCard,
                style: const TextStyle(color: _kText, fontSize: 14),
                items: _documentTypes
                    .map((d) => DropdownMenuItem(value: d.$1, child: Text(d.$2)))
                    .toList(),
                onChanged: (v) {
                  if (v != null) onTypeChanged(v);
                },
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Upload drop zone
          GestureDetector(
            onTap: uploading ? null : onPick,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 32),
              decoration: BoxDecoration(
                color: _kSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: uploading ? _kAccent.withOpacity(0.4) : _kBorder,
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  uploading
                      ? const CircularProgressIndicator(
                          color: _kAccent, strokeWidth: 2)
                      : Icon(Icons.cloud_upload_outlined,
                          color: _kAccent.withOpacity(0.75), size: 38),
                  const SizedBox(height: 12),
                  Text(
                    uploading ? 'Uploading…' : 'Tap to choose file',
                    style: TextStyle(
                      color: uploading ? _kAccent : _kMuted,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (!uploading)
                    const Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text('PDF, image, or any document',
                          style: TextStyle(color: Color(0xFF555555), fontSize: 12)),
                    ),
                ],
              ),
            ),
          ),

          // Uploaded document list
          if (documents.isNotEmpty) ...[
            const SizedBox(height: 22),
            Text('Uploaded (${documents.length})',
                style: const TextStyle(
                    color: _kMuted, fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            ...documents.map((d) => Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: _kCard,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _kBorder),
                  ),
                  child: Row(children: [
                    const Icon(Icons.insert_drive_file_outlined,
                        color: _kAccent, size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                        child: Text(d.documentType,
                            style: const TextStyle(
                                color: _kText,
                                fontSize: 13,
                                fontWeight: FontWeight.w500))),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: _kGreen.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(d.status,
                          style: const TextStyle(
                              color: _kGreen,
                              fontSize: 11,
                              fontWeight: FontWeight.w700)),
                    ),
                    if (d.status != 'verified') ...[
                      const SizedBox(width: 6),
                      GestureDetector(
                        onTap: deleting ? null : () => onDelete(d.id),
                        child: Icon(
                          Icons.delete_outline_rounded,
                          color: deleting ? _kBorder : _kMuted,
                          size: 20,
                        ),
                      ),
                    ],
                  ]),
                )),
          ],
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

// ── Step 6: Review & Submit ───────────────────────────────────────────────────

class _ReviewStep extends StatelessWidget {
  const _ReviewStep({
    required this.profile,
    required this.documentCount,
    required this.missingFields,
    required this.ready,
  });
  final Map<String, dynamic> profile;
  final int documentCount;
  final List<String> missingFields;
  final bool ready;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status header
          Center(
            child: Column(
              children: [
                Container(
                  width: 74,
                  height: 74,
                  decoration: BoxDecoration(
                    color:
                        (ready ? _kGreen : _kAccent).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Icon(
                    ready
                        ? Icons.check_circle_outline_rounded
                        : Icons.pending_actions_outlined,
                    color: ready ? _kGreen : _kAccent,
                    size: 36,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  ready ? 'Ready to Submit!' : 'Almost There',
                  style: TextStyle(
                    color: ready ? _kGreen : _kText,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  ready
                      ? 'Your profile is complete. Tap Submit to send it for admin review.'
                      : 'Complete the checklist below before submitting.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: _kMuted, fontSize: 14, height: 1.5),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Checklist
          _checkItem(
            icon: Icons.person_outline_rounded,
            label: 'Profile information',
            done: missingFields.isEmpty,
            note: missingFields.isEmpty
                ? null
                : 'Missing: ${missingFields.join(", ")}',
          ),
          _checkItem(
            icon: Icons.insert_drive_file_outlined,
            label: 'Document uploaded',
            done: documentCount > 0,
            note: documentCount > 0 ? '$documentCount document(s)' : 'Required',
          ),

          // Profile summary
          if (profile.isNotEmpty) ...[
            const SizedBox(height: 24),
            const Text('Your Profile',
                style: TextStyle(
                    color: _kMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            Container(
              decoration: BoxDecoration(
                color: _kCard,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _kBorder),
              ),
              child: Column(
                children: () {
                  final entries = profile.entries
                      .where((e) => (e.value ?? '').toString().isNotEmpty)
                      .toList();
                  return entries.asMap().entries.map((entry) {
                    final e = entry.value;
                    final isLast = entry.key == entries.length - 1;
                    return Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 11),
                      decoration: isLast
                          ? null
                          : BoxDecoration(
                              border: Border(
                                  bottom:
                                      BorderSide(color: _kBorder))),
                      child: Row(children: [
                        Expanded(
                            child: Text(e.key,
                                style: const TextStyle(
                                    color: _kMuted, fontSize: 13))),
                        Flexible(
                            child: Text(e.value.toString(),
                                style: const TextStyle(
                                    color: _kText, fontSize: 13),
                                textAlign: TextAlign.end)),
                      ]),
                    );
                  }).toList();
                }(),
              ),
            ),
          ],
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _checkItem({
    required IconData icon,
    required String label,
    required bool done,
    String? note,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: done ? _kGreen.withOpacity(0.3) : _kBorder),
      ),
      child: Row(children: [
        Icon(icon, color: done ? _kGreen : _kMuted, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label,
                style: const TextStyle(
                    color: _kText,
                    fontSize: 14,
                    fontWeight: FontWeight.w600)),
            if (note != null)
              Text(note,
                  style: TextStyle(
                      color: done ? _kGreen : _kAmber, fontSize: 12)),
          ]),
        ),
        Icon(
          done
              ? Icons.check_circle_rounded
              : Icons.radio_button_unchecked_rounded,
          color: done ? _kGreen : _kMuted,
          size: 22,
        ),
      ]),
    );
  }
}

// ── Quiz widget ───────────────────────────────────────────────────────────────

class _QuizWidget extends StatefulWidget {
  const _QuizWidget({required this.quizData});
  final Map<String, dynamic> quizData;

  @override
  State<_QuizWidget> createState() => _QuizWidgetState();
}

class _QuizWidgetState extends State<_QuizWidget> {
  int _qIdx = 0;
  String? _selected;
  bool _checked = false;

  List<Map<String, dynamic>> get _qs =>
      ((widget.quizData['questions'] as List?) ?? [])
          .cast<Map<String, dynamic>>();

  @override
  Widget build(BuildContext context) {
    if (_qs.isEmpty) return const SizedBox.shrink();
    final q = _qs[_qIdx];
    final opts = ((q['options'] as List?) ?? []).cast<Map<String, dynamic>>();
    final correctId = opts
        .where((o) => o['correct'] == true)
        .map((o) => o['id'] as String?)
        .firstOrNull;
    final isCorrect = _selected == correctId;

    return Container(
      margin: const EdgeInsets.only(top: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Quiz badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _kAccent.withOpacity(0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              'QUIZ  ${_qIdx + 1} / ${_qs.length}',
              style: const TextStyle(
                  color: _kAccent,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            q['question'] as String? ?? '',
            style: const TextStyle(
                color: _kText,
                fontSize: 16,
                fontWeight: FontWeight.w600,
                height: 1.4),
          ),
          const SizedBox(height: 16),

          // Options
          ...opts.map((opt) {
            final oid = opt['id'] as String? ?? '';
            final isSel = _selected == oid;
            final isCorrectOpt = opt['correct'] == true;

            Color border = _kBorder, bg = _kSurface, fg = _kText;
            Widget? trail;

            if (_checked && isSel && isCorrect) {
              border = _kGreen;
              bg = _kGreen.withOpacity(0.10);
              fg = _kGreen;
              trail = const Icon(Icons.check_circle, color: _kGreen, size: 18);
            } else if (_checked && isSel) {
              border = _kAccent;
              bg = _kAccent.withOpacity(0.10);
              fg = _kAccent;
              trail = const Icon(Icons.cancel, color: _kAccent, size: 18);
            } else if (_checked && isCorrectOpt) {
              border = _kGreen;
              bg = _kGreen.withOpacity(0.06);
              fg = _kGreen;
            } else if (isSel) {
              border = _kAccent;
              bg = _kAccent.withOpacity(0.08);
            }

            return GestureDetector(
              onTap: _checked ? null : () => setState(() => _selected = oid),
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: border),
                ),
                child: Row(children: [
                  Expanded(
                      child: Text(opt['text'] as String? ?? '',
                          style: TextStyle(color: fg, fontSize: 14))),
                  if (trail != null) ...[const SizedBox(width: 8), trail],
                ]),
              ),
            );
          }),

          // Explanation
          if (_checked &&
              q['explanation'] != null &&
              (q['explanation'] as String).isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: (isCorrect ? _kGreen : _kAccent).withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color:
                        (isCorrect ? _kGreen : _kAccent).withOpacity(0.25)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                      isCorrect
                          ? Icons.lightbulb_outline
                          : Icons.info_outline,
                      color: isCorrect ? _kGreen : _kAccent,
                      size: 15),
                  const SizedBox(width: 8),
                  Expanded(
                      child: Text(q['explanation'] as String,
                          style: TextStyle(
                              color: _kText.withOpacity(0.85),
                              fontSize: 13,
                              height: 1.4))),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),

          // Action button
          SizedBox(
            width: double.infinity,
            child: _checked
                ? (_qIdx < _qs.length - 1
                    ? ElevatedButton(
                        onPressed: () => setState(() {
                          _qIdx++;
                          _selected = null;
                          _checked = false;
                        }),
                        style: _btnStyle(_kAccent),
                        child: const Text('Next Question'),
                      )
                    : ElevatedButton(
                        onPressed: null,
                        style: _btnStyle(_kGreen),
                        child: const Text('Quiz Complete ✓'),
                      ))
                : ElevatedButton(
                    onPressed: _selected == null
                        ? null
                        : () => setState(() => _checked = true),
                    style: _btnStyle(_kAccent),
                    child: const Text('Check Answer'),
                  ),
          ),
        ],
      ),
    );
  }

  ButtonStyle _btnStyle(Color color) => ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        disabledBackgroundColor: _kSurface,
        disabledForegroundColor: _kMuted,
        padding: const EdgeInsets.symmetric(vertical: 14),
        textStyle:
            const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      );
}

// ── Bottom navigation bar ─────────────────────────────────────────────────────

class _BottomNav extends StatelessWidget {
  const _BottomNav({
    required this.currentPage,
    required this.total,
    required this.onBack,
    required this.onNext,
    required this.nextLabel,
  });
  final int currentPage;
  final int total;
  final VoidCallback? onBack;
  final VoidCallback? onNext;
  final String nextLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      decoration: BoxDecoration(
        color: _kBg,
        border: Border(top: BorderSide(color: _kBorder.withOpacity(0.6))),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Dot indicators
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(total, (i) {
              final active = i == currentPage;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: active ? 24 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: active ? _kAccent : _kBorder,
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          ),
          const SizedBox(height: 14),
          // Back / Continue buttons
          Row(
            children: [
              if (onBack != null) ...[
                Expanded(
                  flex: 1,
                  child: OutlinedButton(
                    onPressed: onBack,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _kText,
                      side: const BorderSide(color: _kBorder),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Back',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                flex: onBack != null ? 2 : 1,
                child: ElevatedButton(
                  onPressed: onNext,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _kAccent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: _kSurface,
                    disabledForegroundColor: _kMuted,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    textStyle: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 15),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(nextLabel),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Changes requested banner ──────────────────────────────────────────────────

class _ChangesBanner extends StatelessWidget {
  const _ChangesBanner({this.note});
  final String? note;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: _kAmber.withOpacity(0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kAmber.withOpacity(0.30)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_rounded, color: _kAmber, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Changes Requested',
                    style: TextStyle(
                        color: _kAmber,
                        fontSize: 12,
                        fontWeight: FontWeight.w700)),
                if (note != null && note!.isNotEmpty)
                  Text(note!,
                      style: TextStyle(
                          color: _kText.withOpacity(0.8),
                          fontSize: 12,
                          height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Inline video player ───────────────────────────────────────────────────────

class _InlineVideo extends StatefulWidget {
  const _InlineVideo({required this.url});
  final String url;

  @override
  State<_InlineVideo> createState() => _InlineVideoState();
}

class _InlineVideoState extends State<_InlineVideo> {
  BetterPlayerController? _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = BetterPlayerController(
      const BetterPlayerConfiguration(aspectRatio: 16 / 9, autoPlay: false),
      betterPlayerDataSource: BetterPlayerDataSource(
          BetterPlayerDataSourceType.network, widget.url),
    );
  }

  @override
  void dispose() {
    _ctrl?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: AspectRatio(
          aspectRatio: 16 / 9,
          child: BetterPlayer(controller: _ctrl!)),
    );
  }
}

// ── Inline audio player ───────────────────────────────────────────────────────

class _InlineAudio extends StatefulWidget {
  const _InlineAudio({required this.url});
  final String url;

  @override
  State<_InlineAudio> createState() => _InlineAudioState();
}

class _InlineAudioState extends State<_InlineAudio> {
  final _player = AudioPlayer();
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: _kSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: Row(children: [
        GestureDetector(
          onTap: _toggle,
          child: Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(color: _kAccent, shape: BoxShape.circle),
            child: Icon(_playing ? Icons.pause : Icons.play_arrow,
                color: Colors.white, size: 20),
          ),
        ),
        const SizedBox(width: 12),
        Text(
          _playing ? 'Playing audio…' : 'Audio guide',
          style: const TextStyle(
              color: _kText, fontSize: 14, fontWeight: FontWeight.w500),
        ),
      ]),
    );
  }
}

// ── Content step skeleton (F-11) ──────────────────────────────────────────────

class _ContentStepSkeleton extends StatelessWidget {
  const _ContentStepSkeleton();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _shimmer(height: 160, radius: 16),
          const SizedBox(height: 24),
          _shimmer(height: 20, width: 100),
          const SizedBox(height: 16),
          _shimmer(height: 28, width: 240),
          const SizedBox(height: 12),
          _shimmer(height: 14),
          _shimmer(height: 14),
          _shimmer(height: 14, width: 180),
        ],
      ),
    );
  }
}

Widget _shimmer({double? width, double height = 16, double radius = 8}) =>
    Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        width: width ?? double.infinity,
        height: height,
        decoration: BoxDecoration(
          color: _kSurface,
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );

// ── Helpers ───────────────────────────────────────────────────────────────────

String _formatRelativeDate(String iso) {
  final dt = DateTime.tryParse(iso);
  if (dt == null) return iso;
  final diff = DateTime.now().difference(dt);
  if (diff.inDays == 0) return 'today';
  if (diff.inDays == 1) return 'yesterday';
  if (diff.inDays < 7) return '${diff.inDays} days ago';
  return '${(diff.inDays / 7).floor()} week(s) ago';
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

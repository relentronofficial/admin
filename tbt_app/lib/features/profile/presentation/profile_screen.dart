import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/constants/routes.dart';
import '../../../features/auth/providers/auth_provider.dart';
import '../../../features/notifications/data/notifications_service.dart';
import '../../../shared/api/services/members_service.dart';
import '../../../shared/models/member.dart';
import '../../../shared/providers/me_provider.dart';
import '../../../shared/providers/theme_mode_provider.dart';
import '../../../shared/theme/design_constants.dart';
import '../data/profile_extras_service.dart';
import '../providers/profile_provider.dart';
import 'widgets/membership_card.dart';
import 'widgets/profile_tabs.dart';

import '../../../shared/theme/theme_tokens.dart';
import '../../../shared/widgets/app_loader.dart';
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _nameController = TextEditingController();
  bool _editMode = false;
  bool _savingName = false;
  bool _uploadingAvatar = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  void _enterEdit(Member member) {
    _nameController.text = member.name;
    setState(() => _editMode = true);
  }

  void _cancelEdit() => setState(() => _editMode = false);

  Future<void> _saveName() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;
    setState(() => _savingName = true);
    try {
      await updateProfileName(ref, name);
      if (mounted) setState(() { _editMode = false; _savingName = false; });
    } catch (_) {
      if (mounted) {
        setState(() => _savingName = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save name')),
        );
      }
    }
  }

  Future<void> _pickAvatar() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: context.tokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(Icons.photo_library_outlined,
                  color: context.tokens.textPrimary),
              title: Text('Choose from Gallery',
                  style: TextStyle(color: context.tokens.textPrimary)),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
            ListTile(
              leading: Icon(Icons.camera_alt_outlined,
                  color: context.tokens.textPrimary),
              title: Text('Take Photo',
                  style: TextStyle(color: context.tokens.textPrimary)),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;

    final picked = await ImagePicker().pickImage(
      source: source,
      imageQuality: 85,
      maxWidth: 800,
    );
    if (picked == null || !mounted) return;

    // Same guards as the web upload path: image/* MIME + 5 MB cap. Applied
    // before the spinner so a rejected file doesn't flash a loading state.
    // The image_picker already scales max width to 800 px & quality 85, so
    // most photos will land well under 5 MB — the check is defence for large
    // pre-existing files coming from Gallery.
    final ext = picked.name.split('.').last.toLowerCase();
    const validExts = {'png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'};
    if (!validExts.contains(ext)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please select an image file')),
        );
      }
      return;
    }
    final bytes = await picked.readAsBytes();
    if (bytes.lengthInBytes > 5 * 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Image must be under 5 MB')),
        );
      }
      return;
    }
    final contentType = switch (ext) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      'gif' => 'image/gif',
      'heic' => 'image/heic',
      _ => 'image/jpeg',
    };

    setState(() => _uploadingAvatar = true);
    try {
      await uploadAvatar(ref, bytes, picked.name, contentType);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Avatar upload failed')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploadingAvatar = false);
    }
  }

  Future<void> _shareProfile(Member member) async {
    final name = member.name;
    final url = 'https://app.tamilbusinesstribe.com/profile/${member.id}';
    final text = 'Check out $name on Tamil Business Tribe — $url';
    await Share.share(text, subject: name);
  }

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.tokens.bgModal,
        title: Text('Sign Out',
            style: TextStyle(color: context.tokens.textPrimary)),
        content: Text('Are you sure you want to sign out?',
            style: TextStyle(color: context.tokens.textSecondary)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel',
                style: TextStyle(color: context.tokens.textMuted)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Sign Out',
                style: TextStyle(color: Theme.of(context).colorScheme.primary)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await ref.read(authNotifierProvider.notifier).logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final meAsync = ref.watch(meNotifierProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgGradient = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: isDark
          ? const [Color(0xFF0F0F11), Color(0xFF050505)]
          : const [Color(0xFFF5F5F5), Color(0xFFE5E5EA)],
    );
    final textColor = isDark ? Colors.white : Colors.black;

    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      body: Container(
        decoration: BoxDecoration(gradient: bgGradient),
        child: SafeArea(
          child: Column(
            children: [
              // ── Custom header (co-worker style, no AppBar) ────────────
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    IconButton(
                      icon: Icon(Icons.arrow_back_ios_new_rounded,
                          size: 20, color: textColor),
                      onPressed: () => Navigator.of(context).maybePop(),
                    ),
                    Expanded(
                      child: Text(
                        'Elite Profile',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: textColor,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ),
                    meAsync.whenOrNull(
                          data: (member) => IconButton(
                            icon: Icon(Icons.share_outlined,
                                size: 20, color: textColor),
                            tooltip: 'Share profile',
                            onPressed: () => _shareProfile(member),
                          ),
                        ) ??
                        const SizedBox(width: 48),
                  ],
                ),
              ),
              // Body scroll
              Expanded(
                child: _buildBody(meAsync),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(AsyncValue<Member> meAsync) {
    return meAsync.when(
        loading: () =>
            const AppLoader.center(),
        error: (e, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline,
                  color: context.tokens.textMuted, size: 40),
              const SizedBox(height: 12),
              Text('Failed to load profile',
                  style: TextStyle(color: context.tokens.textSecondary)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(meNotifierProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (member) {
          final children = <Widget>[
            const SizedBox(height: 16),
            // ── Hero (avatar with gradient ring + name + role + ONLINE + badges)
            _HeroSection(
              member: member,
              uploading: _uploadingAvatar,
              onTapAvatar: _pickAvatar,
            ),
            const SizedBox(height: 24),
            // ── Stats row (Streak · Connections · Points)
            const _StatsRowNew(),
            const SizedBox(height: 28),
            // ── Signature membership card
            _MembershipCardFromRaw(member: member),
            const SizedBox(height: 28),
            // ── 3-tab layout (Business / My Wins / Trophies)
            _ProfileTabsFromRaw(
              onEditBusiness: () async {
                final ok = await showModalBottomSheet<bool>(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => const _EditPersonalInfoSheet(),
                );
                if (ok == true) ref.invalidate(meNotifierProvider);
              },
            ),
            const SizedBox(height: 28),
            // ── Settings block (wraps existing profile-adjacent sections)
            _SettingsGroup(
              children: [
                _SettingsLinkRow(
                  icon: Icons.person_rounded,
                  label: 'My Account',
                  onTap: () async {
                    final ok = await showModalBottomSheet<bool>(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => const _EditPersonalInfoSheet(),
                    );
                    if (ok == true) ref.invalidate(meNotifierProvider);
                  },
                ),
                _SettingsLinkRow(
                  icon: Icons.people_alt_rounded,
                  label: 'Connections',
                  onTap: () =>
                      context.push(AppRoutes.profileConnections),
                ),
                _SettingsLinkRow(
                  icon: Icons.gavel_rounded,
                  label: 'Terms & Conditions',
                  onTap: () => context.push(AppRoutes.legalTerms),
                ),
                _SettingsLinkRow(
                  icon: Icons.privacy_tip_rounded,
                  label: 'Privacy Policy',
                  onTap: () => context.push(AppRoutes.legalPrivacy),
                ),
                _SettingsThemeRow(),
              ],
            ),
            const SizedBox(height: 16),
            // Retained backend-driven sections (below settings so they
            // don't clutter the hero — kept because they surface DB
            // truth: subscription, tiers, notif prefs, devices).
            const _SubscriptionSection(),
            const SizedBox(height: 16),
            const _TiersSection(),
            const SizedBox(height: 16),
            const _NotificationPrefsSection(),
            const SizedBox(height: 16),
            const _DevicesSection(),
            const SizedBox(height: 24),
            _SettingsGroup(
              children: [
                _SettingsLinkRow(
                  icon: Icons.logout_rounded,
                  label: 'Sign Out',
                  danger: true,
                  onTap: _logout,
                ),
              ],
            ),
            const SizedBox(height: 40),
          ];
          return RefreshIndicator(
            color: const Color(0xFFD30814),
            onRefresh: () async {
              ref.invalidate(meNotifierProvider);
              ref.invalidate(myConnectionsProvider);
              ref.invalidate(myPostsProvider);
              ref.invalidate(profileStatsProvider);
              try {
                await Future.wait([
                  ref.read(meNotifierProvider.future),
                  ref.read(profileStatsProvider.future),
                ]);
              } catch (_) {}
            },
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics(),
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 500),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: children,
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      );
  }
}

// ── Hero section — gradient-ring avatar + name + role/location + ONLINE
//    pill + hero badge pills (10X Growth Club / Pillar of Sakthi).
//    Matches co-worker's design spec.

class _HeroSection extends ConsumerStatefulWidget {
  const _HeroSection({
    required this.member,
    required this.uploading,
    required this.onTapAvatar,
  });

  final Member member;
  final bool uploading;
  final VoidCallback onTapAvatar;

  @override
  ConsumerState<_HeroSection> createState() => _HeroSectionState();
}

class _HeroSectionState extends ConsumerState<_HeroSection> {
  Map<String, dynamic>? _raw;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await fetchRawProfile(ref);
      if (mounted) setState(() => _raw = data);
    } catch (_) {}
  }

  bool _isOnline(Map<String, dynamic> data) {
    final last = data['lastActiveAt'] as String?;
    if (last == null) return false;
    final dt = DateTime.tryParse(last);
    if (dt == null) return false;
    return DateTime.now().difference(dt).inMinutes < 15;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black;
    final subText = textColor.withValues(alpha: 0.6);
    final data = _raw ?? const <String, dynamic>{};
    final role = (data['role'] as String?)?.trim() ?? '';
    final city = (data['city'] as String?)?.trim() ?? '';
    final state = (data['state'] as String?)?.trim() ?? '';
    final location = [
      if (city.isNotEmpty) city,
      if (state.isNotEmpty) state,
    ].join(', ');
    final online = _isOnline(data);

    return Column(
      children: [
        // Avatar stack — outer gradient ring + inner bg + avatar image
        GestureDetector(
          onTap: widget.uploading ? null : widget.onTapAvatar,
          child: SizedBox(
            width: 96,
            height: 96,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFFD30814),
                        Color(0xFFFF5E62),
                        Color(0xFFFFD97D),
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFD30814).withValues(alpha: 0.40),
                        blurRadius: 16,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isDark
                        ? const Color(0xFF0F0F11)
                        : Colors.white,
                  ),
                ),
                ClipRRect(
                  borderRadius: BorderRadius.circular(44),
                  child: SizedBox(
                    width: 84,
                    height: 84,
                    child: (widget.member.avatarUrl != null &&
                            widget.member.avatarUrl!.isNotEmpty)
                        ? CachedNetworkImage(
                            imageUrl: widget.member.avatarUrl!,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) =>
                                _initialsFallback(context),
                          )
                        : _initialsFallback(context),
                  ),
                ),
                if (widget.uploading)
                  Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(44),
                    ),
                    child: const Center(
                      child: SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      ),
                    ),
                  ),
                if (online)
                  Positioned(
                    bottom: 2,
                    right: 2,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF27AE60),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isDark
                              ? const Color(0xFF0F0F11)
                              : Colors.white,
                          width: 1.5,
                        ),
                      ),
                      child: const Text(
                        'ONLINE',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          widget.member.name.isEmpty ? 'Member' : widget.member.name,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: textColor,
            fontSize: 22,
            fontWeight: FontWeight.bold,
            letterSpacing: -0.5,
          ),
        ),
        if (role.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            role,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: subText,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
        if (location.isNotEmpty) ...[
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.location_on_rounded,
                  size: 14, color: Color(0xFFD30814)),
              const SizedBox(width: 4),
              Text(
                location,
                style: TextStyle(color: subText, fontSize: 12),
              ),
            ],
          ),
        ],
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            _HeroBadge(
              label: '10X Growth Club',
              color: Color(0xFFD30814),
            ),
            SizedBox(width: 8),
            _HeroBadge(
              label: 'Pillar of Sakthi',
              color: Color(0xFFD4AF37),
            ),
          ],
        ),
      ],
    );
  }

  Widget _initialsFallback(BuildContext context) {
    final parts = widget.member.name.trim().split(RegExp(r'\s+'));
    final initials = parts.isEmpty || parts.first.isEmpty
        ? '?'
        : parts.length == 1
            ? parts.first[0].toUpperCase()
            : '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return Container(
      color: const Color(0xFF48484A),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white70,
          fontSize: 32,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _HeroBadge extends StatelessWidget {
  const _HeroBadge({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.stars_rounded, color: color, size: 14),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Stats row — 3 items (Daily Streak · Connections · TBT Points) with
//    vertical dividers between them. Wrapped in card decoration.

class _StatsRowNew extends ConsumerWidget {
  const _StatsRowNew();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF141416) : Colors.white;
    final border = isDark ? const Color(0xFF232326) : const Color(0xFFE5E5EA);
    final text = isDark ? Colors.white : Colors.black;
    final subText = text.withValues(alpha: 0.6);

    // Reactive: any invalidation of profileStatsProvider (pull-to-refresh,
    // or one of its inner providers) triggers a rebuild with fresh numbers.
    final statsAsync = ref.watch(profileStatsProvider);
    final stats = statsAsync.valueOrNull ?? ProfileStats.empty;
    final streak = stats.dailyStreak;
    final connections = stats.connections;
    final points = stats.tbtPoints;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _stat(
            icon: Icons.whatshot_rounded,
            iconColor: const Color(0xFFFF5E3A),
            value: '$streak',
            label: 'Daily Streak',
            text: text,
            subText: subText,
          ),
          Container(height: 32, width: 1, color: border),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => context.push(AppRoutes.profileConnections),
            child: _stat(
              icon: Icons.people_alt_rounded,
              iconColor: const Color(0xFF2F80ED),
              value: '$connections',
              label: 'Connections',
              text: text,
              subText: subText,
            ),
          ),
          Container(height: 32, width: 1, color: border),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => context.push(AppRoutes.tbtPoints),
            child: _stat(
              icon: Icons.stars_rounded,
              iconColor: const Color(0xFFFFD97D),
              value: '$points',
              label: 'TBT Points',
              text: text,
              subText: subText,
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat({
    required IconData icon,
    required Color iconColor,
    required String value,
    required String label,
    required Color text,
    required Color subText,
  }) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: iconColor, size: 16),
            const SizedBox(width: 4),
            Text(
              value,
              style: TextStyle(
                color: text,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            color: subText,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

// ── Settings block — outer container with row list. Each row is a
//    _SettingsLinkRow (icon + label + chevron). Custom dark toggle
//    row for theme.

class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF141416) : Colors.white;
    final border = isDark ? const Color(0xFF232326) : const Color(0xFFE5E5EA);
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      rows.add(children[i]);
      if (i < children.length - 1) {
        rows.add(Divider(
          height: 1,
          indent: 16,
          endIndent: 16,
          color: border,
        ));
      }
    }
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: border),
      ),
      child: Column(children: rows),
    );
  }
}

class _SettingsLinkRow extends StatelessWidget {
  const _SettingsLinkRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.danger = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = isDark ? Colors.white : Colors.black;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFFD30814), size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: danger ? const Color(0xFFD30814) : text,
                  fontSize: 14.5,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            if (!danger)
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 14,
                color: text.withValues(alpha: 0.7),
              ),
          ],
        ),
      ),
    );
  }
}

class _SettingsThemeRow extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final isDark = mode == ThemeMode.dark;
    final text = isDark ? Colors.white : Colors.black;
    final subText = text.withValues(alpha: 0.6);
    final screenW = MediaQuery.of(context).size.width;
    final pillW = screenW * 0.13;
    final pillH = screenW * 0.07;
    final knobD = screenW * 0.055;
    return InkWell(
      onTap: () => ref
          .read(themeModeProvider.notifier)
          .setMode(isDark ? ThemeMode.light : ThemeMode.dark),
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Row(
          children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              transitionBuilder: (c, a) => ScaleTransition(scale: a, child: c),
              child: Icon(
                isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
                key: ValueKey(isDark),
                color: const Color(0xFFD30814),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isDark ? 'Dark mode' : 'Light mode',
                    style: TextStyle(
                      color: text,
                      fontSize: 14.5,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Toggle app appearance',
                    style: TextStyle(color: subText, fontSize: 11.5),
                  ),
                ],
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
              width: pillW,
              height: pillH,
              decoration: BoxDecoration(
                color: isDark
                    ? const Color(0xFFD30814)
                    : const Color(0xFF9E9E9E),
                borderRadius: BorderRadius.circular(30),
                boxShadow: [
                  BoxShadow(
                    color: (isDark
                            ? const Color(0xFFD30814)
                            : const Color(0xFF9E9E9E))
                        .withValues(alpha: 0.30),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  AnimatedPositioned(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeInOut,
                    left: isDark ? pillW - knobD - 4 : 4,
                    child: Container(
                      width: knobD,
                      height: knobD,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        isDark
                            ? Icons.nights_stay_rounded
                            : Icons.wb_sunny_rounded,
                        size: knobD * 0.6,
                        color: const Color(0xFFD30814),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Membership card + tabs shell — pull raw profile once, share among children.

class _MembershipCardFromRaw extends ConsumerStatefulWidget {
  const _MembershipCardFromRaw({required this.member});
  final Member member;

  @override
  ConsumerState<_MembershipCardFromRaw> createState() =>
      _MembershipCardFromRawState();
}

class _MembershipCardFromRawState
    extends ConsumerState<_MembershipCardFromRaw> {
  Map<String, dynamic>? _raw;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await fetchRawProfile(ref);
      if (mounted) setState(() => _raw = data);
    } catch (_) {
      // fail silent — card still renders with fallbacks
    }
  }

  @override
  Widget build(BuildContext context) {
    final raw = _raw ?? const <String, dynamic>{};
    final subscription = raw['subscription'] as Map<String, dynamic>?;
    String? expiryLabel;
    final endDate = subscription?['endDate'] as String?;
    if (endDate != null && endDate.isNotEmpty) {
      final dt = DateTime.tryParse(endDate);
      if (dt != null) {
        expiryLabel =
            '${dt.month.toString().padLeft(2, '0')}/${dt.year}';
      }
    }
    final printedMemberId =
        (raw['memberId'] as String?) ?? widget.member.id;
    final plan = widget.member.membershipPlan;
    return MembershipCard(
      name: widget.member.name,
      memberId: printedMemberId,
      avatarUrl: widget.member.avatarUrl,
      plan: plan,
      businessName: (raw['businessName'] as String?) ??
          (raw['business_name'] as String?),
      expiryLabel: expiryLabel,
    );
  }
}

class _ProfileTabsFromRaw extends ConsumerStatefulWidget {
  const _ProfileTabsFromRaw({required this.onEditBusiness});
  final VoidCallback onEditBusiness;

  @override
  ConsumerState<_ProfileTabsFromRaw> createState() =>
      _ProfileTabsFromRawState();
}

class _ProfileTabsFromRawState extends ConsumerState<_ProfileTabsFromRaw> {
  Map<String, dynamic>? _raw;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await fetchRawProfile(ref);
      if (mounted) setState(() => _raw = data);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_raw == null) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 30),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    return ProfileTabs(
      rawProfile: _raw!,
      onEditBusiness: widget.onEditBusiness,
    );
  }
}

// ── Settings link tile (legal / connections shortcuts) ───────────────────────

class _SettingsLinkTile extends StatelessWidget {
  const _SettingsLinkTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: tokens.bgSurface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: tokens.borderCard),
            ),
            child: Row(
              children: [
                Icon(icon, size: 18, color: tokens.textSecondary),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: tokens.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Icon(Icons.chevron_right,
                    color: tokens.textMuted, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Avatar section ────────────────────────────────────────────────────────────

class _AvatarSection extends StatelessWidget {
  const _AvatarSection({
    required this.member,
    required this.uploading,
    required this.onTap,
  });

  final Member member;
  final bool uploading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: context.tokens.bgSurface,
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          Semantics(
            label: 'Change profile photo',
            button: true,
            child: GestureDetector(
            onTap: uploading ? null : onTap,
            child: Stack(
              alignment: Alignment.center,
              children: [
                _Avatar(avatarUrl: member.avatarUrl, name: member.name),
                if (uploading)
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(40),
                    ),
                    child: const Center(
                      child: SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      ),
                    ),
                  ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.camera_alt,
                        color: Colors.white, size: 14),
                  ),
                ),
              ],
            ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            member.name,
            style: TextStyle(
              color: context.tokens.textPrimary,
              fontFamily: 'Rajdhani',
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          // Plan chip + earned-badge chips wrap onto multiple lines if needed
          // so long badge lists don't push the layout wider than the avatar.
          _ProfileChipsRow(plan: member.membershipPlan),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.avatarUrl, required this.name});

  final String? avatarUrl;
  final String name;

  @override
  Widget build(BuildContext context) {
    if (avatarUrl != null && avatarUrl!.isNotEmpty) {
      final dpr = MediaQuery.devicePixelRatioOf(context);
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: avatarUrl!,
          width: 80,
          height: 80,
          fit: BoxFit.cover,
          memCacheWidth: (80 * dpr).round(),
          memCacheHeight: (80 * dpr).round(),
          placeholder: (_, __) => _Initials(name: name),
          errorWidget: (_, __, ___) => _Initials(name: name),
        ),
      );
    }
    return _Initials(name: name);
  }
}

class _Initials extends StatelessWidget {
  const _Initials({required this.name});

  final String name;

  String get _initials {
    final parts = name.trim().split(' ');
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          _initials,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 28,
            fontWeight: FontWeight.w700,
            fontFamily: 'Rajdhani',
          ),
        ),
      ),
    );
  }
}

class _PlanChip extends StatelessWidget {
  const _PlanChip({required this.plan});

  final String plan;

  Color _color(BuildContext context) {
    return switch (plan.toLowerCase()) {
      'premium' => const Color(0xFF7c3aed),
      'enterprise' => const Color(0xFF1d4ed8),
      _ => context.tokens.textMuted,
    };
  }

  @override
  Widget build(BuildContext context) {
    final planColor = _color(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: planColor.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: planColor.withValues(alpha: 0.4)),
      ),
      child: Text(
        plan.toUpperCase(),
        style: TextStyle(
          color: planColor,
          fontFamily: 'Rajdhani',
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.5,
        ),
      ),
    );
  }
}

// ── Profile chips row (plan + earned badges) ─────────────────────────────────
//
// Mirrors the web profile header, which renders the plan badge next to any
// earned achievement badges (`profile.badges` — `{id, label, color, bgColor}`
// from GET /api/user/me). Reads from `fetchRawProfile` for consistency with
// the neighbouring sections; the endpoint is cached by Dio so no extra hit.

class _ProfileChipsRow extends ConsumerStatefulWidget {
  const _ProfileChipsRow({required this.plan});
  final String plan;

  @override
  ConsumerState<_ProfileChipsRow> createState() => _ProfileChipsRowState();
}

class _ProfileChipsRowState extends ConsumerState<_ProfileChipsRow> {
  List<Map<String, dynamic>>? _badges;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await fetchRawProfile(ref);
      if (!mounted) return;
      final list = (data['badges'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .toList();
      setState(() => _badges = list);
    } catch (_) {
      // Silent — endpoint may not expose badges yet on legacy backends.
    }
  }

  @override
  Widget build(BuildContext context) {
    final badges = _badges ?? const <Map<String, dynamic>>[];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 6,
        runSpacing: 6,
        children: [
          _PlanChip(plan: widget.plan),
          for (final b in badges) _BadgeChip(badge: b),
        ],
      ),
    );
  }
}

class _BadgeChip extends StatelessWidget {
  const _BadgeChip({required this.badge});
  final Map<String, dynamic> badge;

  Color? _parse(String? hex) {
    if (hex == null) return null;
    var s = hex.trim();
    if (s.isEmpty) return null;
    // Strip common CSS prefixes we can't render as a solid color.
    s = s.replaceFirst('#', '');
    if (s.length == 6) s = 'FF$s';
    if (s.length != 8) return null;
    final v = int.tryParse(s, radix: 16);
    return v == null ? null : Color(v);
  }

  @override
  Widget build(BuildContext context) {
    final label = (badge['label'] as String?) ?? '';
    if (label.isEmpty) return const SizedBox.shrink();
    final fg = _parse(badge['color'] as String?) ?? context.tokens.textPrimary;
    final bg = _parse(badge['bgColor'] as String?) ??
        context.tokens.textMuted.withValues(alpha: 0.12);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontFamily: 'Rajdhani',
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}

// ── Info section ──────────────────────────────────────────────────────────────

class _InfoSection extends StatelessWidget {
  const _InfoSection({required this.member});

  final Member member;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: context.tokens.borderCard),
        ),
        child: Column(
          children: [
            _InfoRow(
              icon: Icons.person_outline,
              label: 'NAME',
              value: member.name,
            ),
            Divider(height: 1, color: context.tokens.borderCard),
            if (member.email != null)
              _InfoRow(
                icon: Icons.email_outlined,
                label: 'EMAIL',
                value: member.email!,
              ),
            if (member.email != null)
              Divider(height: 1, color: context.tokens.borderCard),
            _InfoRow(
              icon: Icons.phone_outlined,
              label: 'PHONE',
              value: member.phone,
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Icon(icon, color: context.tokens.textMuted, size: 18),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontFamily: 'Rajdhani',
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                    color: context.tokens.textMuted,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                      color: context.tokens.textPrimary, fontSize: 14),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Edit name section ─────────────────────────────────────────────────────────

class _EditNameSection extends StatelessWidget {
  const _EditNameSection({
    required this.controller,
    required this.saving,
  });

  final TextEditingController controller;
  final bool saving;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'FULL NAME',
            style: TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: context.tokens.textMuted,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: controller,
            autofocus: true,
            enabled: !saving,
            style: TextStyle(color: context.tokens.textPrimary),
            decoration: inputDecorationOf(context, 'Your full name'),
          ),
        ],
      ),
    );
  }
}

// ── Notification preferences section ─────────────────────────────────────────

class _NotificationPrefsSection extends ConsumerStatefulWidget {
  const _NotificationPrefsSection();

  @override
  ConsumerState<_NotificationPrefsSection> createState() =>
      _NotificationPrefsSectionState();
}

class _NotificationPrefsSectionState
    extends ConsumerState<_NotificationPrefsSection> {
  NotificationPreferences? _prefs;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final p =
          await ref.read(notificationsServiceProvider).getPreferences();
      if (!mounted) return;
      setState(() {
        _prefs = p;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      // Silent fail — legacy backends may not expose /preferences yet.
      setState(() => _loading = false);
    }
  }

  Future<void> _save(NotificationPreferences next) async {
    final prev = _prefs;
    setState(() {
      _prefs = next;
      _saving = true;
    });
    try {
      await ref
          .read(notificationsServiceProvider)
          .updatePreferences(next);
    } catch (_) {
      if (mounted) setState(() => _prefs = prev);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update preferences')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _prefs == null) return const SizedBox.shrink();
    final p = _prefs!;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(16, 14, 16, 6),
              child: Text(
                'NOTIFICATIONS',
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.8,
                  color: context.tokens.textMuted,
                ),
              ),
            ),
            _prefToggle(
              label: 'Push',
              value: p.push,
              onChanged: _saving
                  ? null
                  : (v) => _save(p.copyWith(push: v)),
            ),
            Divider(height: 1, color: context.tokens.borderCard),
            _prefToggle(
              label: 'Email',
              value: p.email,
              onChanged: _saving
                  ? null
                  : (v) => _save(p.copyWith(email: v)),
            ),
            Divider(height: 1, color: context.tokens.borderCard),
            _prefToggle(
              label: 'SMS',
              value: p.sms,
              onChanged: _saving
                  ? null
                  : (v) => _save(p.copyWith(sms: v)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _prefToggle({
    required String label,
    required bool value,
    required ValueChanged<bool>? onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: context.tokens.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: Theme.of(context).colorScheme.primary,
          ),
        ],
      ),
    );
  }
}

// ── Device sessions section ──────────────────────────────────────────────────

class _DevicesSection extends ConsumerStatefulWidget {
  const _DevicesSection();

  @override
  ConsumerState<_DevicesSection> createState() => _DevicesSectionState();
}

class _DevicesSectionState extends ConsumerState<_DevicesSection> {
  List<MyDevice>? _devices;
  bool _loading = true;
  final Set<String> _revoking = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await ref.read(membersServiceProvider).getMyDevices();
      if (!mounted) return;
      setState(() {
        _devices = list;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _revoke(String id) async {
    setState(() => _revoking.add(id));
    try {
      await ref.read(membersServiceProvider).revokeDevice(id);
      if (!mounted) return;
      setState(() =>
          _devices = (_devices ?? []).where((d) => d.id != id).toList());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not revoke device')),
        );
      }
    } finally {
      if (mounted) setState(() => _revoking.remove(id));
    }
  }

  String _shortAgent(String? ua) {
    if (ua == null || ua.isEmpty) return 'Unknown device';
    if (ua.contains('Android')) return 'Android';
    if (ua.contains('iPhone') || ua.contains('iOS')) return 'iOS';
    if (ua.contains('Windows')) return 'Windows';
    if (ua.contains('Mac')) return 'macOS';
    return ua.split(' ').first;
  }

  String _timeAgo(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SizedBox.shrink();
    final devices = _devices ?? [];
    if (devices.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(16, 14, 16, 6),
              child: Text(
                'SIGNED-IN DEVICES',
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.8,
                  color: context.tokens.textMuted,
                ),
              ),
            ),
            for (var i = 0; i < devices.length; i++) ...[
              if (i > 0)
                Divider(height: 1, color: context.tokens.borderCard),
              _deviceTile(devices[i]),
            ],
          ],
        ),
      ),
    );
  }

  Widget _deviceTile(MyDevice d) {
    final isRevoking = _revoking.contains(d.id);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      child: Row(
        children: [
          Icon(Icons.phone_iphone,
              color: context.tokens.textSecondary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      _shortAgent(d.userAgent),
                      style: TextStyle(
                        color: context.tokens.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (d.isCurrent) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'THIS DEVICE',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.primary,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                if (d.lastSeenAt != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      _timeAgo(d.lastSeenAt),
                      style: TextStyle(
                        color: context.tokens.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (!d.isCurrent)
            IconButton(
              tooltip: 'Revoke',
              icon: isRevoking
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(Icons.logout, size: 18, color: Theme.of(context).colorScheme.primary),
              onPressed: isRevoking ? null : () => _revoke(d.id),
            ),
        ],
      ),
    );
  }
}

// ── Extended personal info edit sheet ────────────────────────────────────────

class _EditPersonalInfoSheet extends ConsumerStatefulWidget {
  const _EditPersonalInfoSheet();

  @override
  ConsumerState<_EditPersonalInfoSheet> createState() =>
      _EditPersonalInfoSheetState();
}

class _EditPersonalInfoSheetState
    extends ConsumerState<_EditPersonalInfoSheet> {
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _phone = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _businessName = TextEditingController();
  final _productService = TextEditingController();
  final _annualTurnover = TextEditingController();
  final _gstNumber = TextEditingController();
  final _goal90 = TextEditingController();
  final _businessEstablished = TextEditingController();
  final _dob = TextEditingController();
  // 2026-07-28 — extended business fields for the Business tab
  final _role = TextEditingController();
  final _industry = TextEditingController();
  final _teamSize = TextEditingController();
  final _registeredOffice = TextEditingController();
  final _targetNetwork = TextEditingController();
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _prefill();
  }

  @override
  void dispose() {
    for (final c in [
      _firstName,
      _lastName,
      _phone,
      _city,
      _state,
      _businessName,
      _productService,
      _annualTurnover,
      _gstNumber,
      _goal90,
      _businessEstablished,
      _dob,
      _role,
      _industry,
      _teamSize,
      _registeredOffice,
      _targetNetwork,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _prefill() async {
    try {
      final data = await fetchRawProfile(ref);
      if (!mounted) return;
      _firstName.text = (data['firstName'] as String?) ?? '';
      _lastName.text = (data['lastName'] as String?) ?? '';
      _phone.text = (data['phone'] as String?) ?? '';
      _city.text = (data['city'] as String?) ?? '';
      _state.text = (data['state'] as String?) ?? '';
      _businessName.text = (data['businessName'] as String?) ?? '';
      _productService.text = (data['productServiceType'] as String?) ?? '';
      _annualTurnover.text = (data['annualTurnover'] as String?) ?? '';
      _gstNumber.text = (data['gstNumber'] as String?) ?? '';
      _goal90.text = (data['goalAfter90Days'] as String?) ?? '';
      // API returns full ISO — keep just the date portion for the picker input.
      final estabRaw = (data['businessEstablishedOn'] as String?) ?? '';
      _businessEstablished.text =
          estabRaw.contains('T') ? estabRaw.split('T').first : estabRaw;
      _dob.text = (data['dob'] as String?) ?? '';
      _role.text = (data['role'] as String?) ?? '';
      _industry.text = (data['industry'] as String?) ?? '';
      _teamSize.text = (data['teamSize'] as String?) ?? '';
      _registeredOffice.text = (data['registeredOffice'] as String?) ??
          (data['businessAddress'] as String?) ??
          '';
      _targetNetwork.text =
          (data['targetNetworkDescription'] as String?) ?? '';
      setState(() => _loading = false);
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await updateProfileFields(ref, {
        'firstName': _firstName.text.trim(),
        'lastName': _lastName.text.trim(),
        'phone': _phone.text.trim(),
        'city': _city.text.trim(),
        'state': _state.text.trim(),
        'businessName': _businessName.text.trim(),
        'productServiceType': _productService.text.trim(),
        'annualTurnover': _annualTurnover.text.trim(),
        'gstNumber': _gstNumber.text.trim(),
        'goalAfter90Days': _goal90.text.trim(),
        'businessEstablishedOn': _businessEstablished.text.trim(),
        'dob': _dob.text.trim(),
        'role': _role.text.trim(),
        'industry': _industry.text.trim(),
        'teamSize': _teamSize.text.trim(),
        'registeredOffice': _registeredOffice.text.trim(),
        'targetNetworkDescription': _targetNetwork.text.trim(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save profile')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final initial =
        DateTime.tryParse(_dob.text) ?? DateTime(now.year - 25);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1930),
      lastDate: now,
    );
    if (picked != null) {
      _dob.text = picked.toIso8601String().split('T').first;
    }
  }

  Future<void> _pickBusinessEstablished() async {
    final now = DateTime.now();
    final initial = DateTime.tryParse(_businessEstablished.text) ?? now;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1950),
      lastDate: now,
    );
    if (picked != null) {
      _businessEstablished.text = picked.toIso8601String().split('T').first;
    }
  }

  Widget _field(String label, TextEditingController c,
      {TextInputType? kt, VoidCallback? onTap, bool readOnly = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: c,
        keyboardType: kt,
        readOnly: readOnly,
        onTap: onTap,
        style: TextStyle(color: context.tokens.textPrimary, fontSize: 14),
        decoration: InputDecoration(
          isDense: true,
          filled: true,
          fillColor: context.tokens.bgInput,
          labelText: label,
          labelStyle: TextStyle(color: context.tokens.textMuted, fontSize: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: context.tokens.borderCard),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: context.tokens.borderCard),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: inset),
      child: Container(
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
          border: Border(top: BorderSide(color: context.tokens.borderCard)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: context.tokens.textMuted.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Text(
                'EDIT PROFILE',
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.8,
                  color: context.tokens.textPrimary,
                ),
              ),
              const SizedBox(height: 14),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 30),
                  child: Center(
                      child: CircularProgressIndicator(strokeWidth: 2)),
                )
              else ...[
                _field('First name', _firstName),
                _field('Last name', _lastName),
                _field('Phone', _phone, kt: TextInputType.phone),
                _field('Date of birth', _dob,
                    readOnly: true, onTap: _pickDob),
                _field('City', _city),
                _field('State', _state),
                _field('Role (e.g. Founder)', _role),
                _field('Business name', _businessName),
                _field('Industry', _industry),
                _field('Team size (e.g. 1-5)', _teamSize),
                _field('Registered office', _registeredOffice),
                _field('Product / Service type', _productService),
                _field('Annual turnover', _annualTurnover),
                _field('GST number', _gstNumber),
                _field('Business established on', _businessEstablished,
                    readOnly: true, onTap: _pickBusinessEstablished),
                _field('Goal after 90 days', _goal90),
                _field('Target network description', _targetNetwork),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _saving
                            ? null
                            : () => Navigator.of(context).pop(),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: context.tokens.textSecondary,
                          side: BorderSide(color: context.tokens.borderCard),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _saving ? null : _save,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Theme.of(context).colorScheme.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: _saving
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Save'),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Stats strip (Points / Streak / Health) ────────────────────────────────────

class _StatsStrip extends ConsumerStatefulWidget {
  const _StatsStrip();

  @override
  ConsumerState<_StatsStrip> createState() => _StatsStripState();
}

class _StatsStripState extends ConsumerState<_StatsStrip> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await fetchRawProfile(ref);
      if (mounted) {
        setState(() {
          _data = data;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _data == null) return const SizedBox.shrink();
    final d = _data!;
    final points = (d['totalPoints'] as num?)?.toInt() ?? 0;
    final streak = (d['currentStreak'] as num?)?.toInt() ?? 0;
    final health = (d['healthPct'] as num?)?.toInt() ??
        (d['healthScore'] as num?)?.toInt() ??
        0;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: _Stat(
              icon: Icons.emoji_events_outlined,
              value: '$points',
              label: 'Points',
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _Stat(
              icon: Icons.local_fire_department,
              value: '${streak}d',
              label: 'Streak',
              color: const Color(0xFFf59e0b),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _Stat(
              icon: Icons.favorite_outline,
              value: '$health%',
              label: 'Health',
              color: const Color(0xFFef4444),
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });
  final IconData icon;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.tokens.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: context.tokens.borderCard),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 18,
              fontWeight: FontWeight.w800,
              fontFamily: 'Rajdhani',
              height: 1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              color: context.tokens.textMuted,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.6,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Subscription section ──────────────────────────────────────────────────────

class _SubscriptionSection extends ConsumerStatefulWidget {
  const _SubscriptionSection();

  @override
  ConsumerState<_SubscriptionSection> createState() =>
      _SubscriptionSectionState();
}

class _SubscriptionSectionState extends ConsumerState<_SubscriptionSection> {
  Map<String, dynamic>? _sub;
  String? _plan;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await fetchRawProfile(ref);
      if (mounted) {
        setState(() {
          _plan = data['membershipPlan'] as String?;
          _sub = data['subscription'] as Map<String, dynamic>?;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _fmtDate(String? iso) {
    if (iso == null) return '—';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '—';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SizedBox.shrink();
    final plan = _plan ?? 'free';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'SUBSCRIPTION',
              style: TextStyle(
                fontFamily: 'Rajdhani',
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.8,
                color: context.tokens.textMuted,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Text(
                  'Plan',
                  style: TextStyle(
                    color: context.tokens.textSecondary,
                    fontSize: 13,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    plan.toUpperCase(),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ],
            ),
            if (_sub != null) ...[
              const SizedBox(height: 10),
              _kv('Started', _fmtDate(_sub!['startDate'] as String?)),
              const SizedBox(height: 6),
              _kv('Ends', _fmtDate(_sub!['endDate'] as String?)),
              const SizedBox(height: 6),
              _kv('Status',
                  (_sub!['status'] as String?)?.toUpperCase() ?? 'ACTIVE'),
            ],
          ],
        ),
      ),
    );
  }

  Widget _kv(String k, String v) {
    return Row(
      children: [
        Text(k,
            style: TextStyle(color: context.tokens.textMuted, fontSize: 12)),
        const Spacer(),
        Text(v,
            style: TextStyle(
                color: context.tokens.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w600)),
      ],
    );
  }
}

// ── Tier access section ───────────────────────────────────────────────────────

class _TiersSection extends ConsumerStatefulWidget {
  const _TiersSection();

  @override
  ConsumerState<_TiersSection> createState() => _TiersSectionState();
}

class _TiersSectionState extends ConsumerState<_TiersSection> {
  List<Map<String, dynamic>>? _tiers;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await fetchRawProfile(ref);
      if (!mounted) return;
      final list =
          (data['tiers'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
      setState(() {
        _tiers = list;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const SizedBox.shrink();
    final tiers = _tiers ?? [];
    if (tiers.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'TIER ACCESS',
              style: TextStyle(
                fontFamily: 'Rajdhani',
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.8,
                color: context.tokens.textMuted,
              ),
            ),
            const SizedBox(height: 10),
            for (var i = 0; i < tiers.length; i++) ...[
              if (i > 0) Divider(height: 12, color: context.tokens.borderCard),
              _tierRow(tiers[i]),
            ],
          ],
        ),
      ),
    );
  }

  Widget _tierRow(Map<String, dynamic> t) {
    final label = (t['label'] as String?) ?? (t['name'] as String?) ?? '—';
    final status = (t['status'] as String?) ?? 'locked';
    final unlocked = status == 'unlocked' || t['unlocked'] == true;
    final condition = t['unlockCondition'] as String? ?? '';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(
            unlocked ? Icons.check_circle : Icons.lock_outline,
            color: unlocked ? const Color(0xFF22c55e) : context.tokens.textMuted,
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: context.tokens.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (condition.isNotEmpty && !unlocked)
                  Text(
                    condition,
                    style: TextStyle(
                      color: context.tokens.textMuted,
                      fontSize: 11,
                    ),
                  ),
              ],
            ),
          ),
          Text(
            unlocked ? 'UNLOCKED' : 'LOCKED',
            style: TextStyle(
              color: unlocked ? const Color(0xFF22c55e) : context.tokens.textMuted,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Dark-mode toggle tile ─────────────────────────────────────────────────────

class _ThemeToggleTile extends ConsumerWidget {
  const _ThemeToggleTile();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final isDark = mode == ThemeMode.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          color: context.tokens.bgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.tokens.borderCard),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Icon(
              isDark ? Icons.dark_mode : Icons.light_mode,
              color: Theme.of(context).colorScheme.primary,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Dark mode',
                    style: TextStyle(
                      color: context.tokens.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Toggle app appearance',
                    style: TextStyle(
                      color: context.tokens.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Switch(
              value: isDark,
              onChanged: (v) => ref
                  .read(themeModeProvider.notifier)
                  .setMode(v ? ThemeMode.dark : ThemeMode.light),
              activeColor: Theme.of(context).colorScheme.primary,
            ),
          ],
        ),
      ),
    );
  }
}

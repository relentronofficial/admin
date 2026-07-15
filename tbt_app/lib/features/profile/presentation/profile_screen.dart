import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../features/auth/providers/auth_provider.dart';
import '../../../features/notifications/data/notifications_service.dart';
import '../../../shared/api/services/members_service.dart';
import '../../../shared/models/member.dart';
import '../../../shared/providers/me_provider.dart';
import '../../../shared/providers/theme_mode_provider.dart';
import '../../../shared/theme/design_constants.dart';
import '../providers/profile_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
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

    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(
          'PROFILE',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: context.tokens.textPrimary,
          ),
        ),
        actions: [
          meAsync.whenOrNull(
                data: (member) => _editMode
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          TextButton(
                            onPressed: _savingName ? null : _cancelEdit,
                            child: Text('Cancel',
                                style: TextStyle(color: context.tokens.textMuted)),
                          ),
                          TextButton(
                            onPressed: _savingName ? null : _saveName,
                            child: _savingName
                                ? SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: Theme.of(context).colorScheme.primary),
                                  )
                                : Text('Save',
                                    style: TextStyle(color: Theme.of(context).colorScheme.primary)),
                          ),
                        ],
                      )
                    : IconButton(
                        icon: Icon(Icons.edit_outlined,
                            color: context.tokens.textPrimary, size: 20),
                        tooltip: 'Edit name',
                        onPressed: () => _enterEdit(member),
                      ),
              ) ??
              const SizedBox.shrink(),
        ],
      ),
      body: meAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(strokeWidth: 2)),
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
          final listItems = <Widget>[
            _AvatarSection(
              member: member,
              uploading: _uploadingAvatar,
              onTap: _pickAvatar,
            ),
            const SizedBox(height: 24),
            if (_editMode)
              _EditNameSection(
                controller: _nameController,
                saving: _savingName,
              )
            else
              _InfoSection(member: member),
            if (!_editMode) ...[
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.edit_outlined, size: 16),
                  label: const Text('Edit Personal Info'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: context.tokens.textSecondary,
                    side: BorderSide(color: context.tokens.borderCard),
                    minimumSize: const Size.fromHeight(40),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  onPressed: () async {
                    final ok = await showModalBottomSheet<bool>(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => const _EditPersonalInfoSheet(),
                    );
                    if (ok == true) ref.invalidate(meNotifierProvider);
                  },
                ),
              ),
            ],
            const SizedBox(height: 16),
            const _StatsStrip(),
            const SizedBox(height: 24),
            const _SubscriptionSection(),
            const SizedBox(height: 24),
            const _TiersSection(),
            const SizedBox(height: 24),
            const _NotificationPrefsSection(),
            const SizedBox(height: 24),
            const _DevicesSection(),
            const SizedBox(height: 24),
            const _ThemeToggleTile(),
            const SizedBox(height: 32),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: OutlinedButton.icon(
                icon: const Icon(Icons.logout, size: 18),
                label: const Text(
                  'Sign Out',
                  style: TextStyle(
                    fontFamily: 'Rajdhani',
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    letterSpacing: 0.5,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.primary,
                  side: BorderSide(color: Theme.of(context).colorScheme.primary),
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: _logout,
              ),
            ),
          ];
          return ListView.builder(
            padding: const EdgeInsets.only(bottom: 40),
            itemCount: listItems.length,
            itemBuilder: (_, i) => listItems[i],
          );
        },
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
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: avatarUrl!,
          width: 80,
          height: 80,
          fit: BoxFit.cover,
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
            decoration: kInputDecoration('Your full name'),
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
                _field('Business name', _businessName),
                _field('Product / Service type', _productService),
                _field('Annual turnover', _annualTurnover),
                _field('GST number', _gstNumber),
                _field('Business established on', _businessEstablished,
                    readOnly: true, onTap: _pickBusinessEstablished),
                _field('Goal after 90 days', _goal90),
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

import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/routes.dart';
import '../../../shared/api/upload_service.dart';
import '../../../shared/models/workshop.dart';
import '../../../shared/providers/socket_provider.dart';
import '../../../shared/socket/socket_events.dart';
import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/tbt_theme.dart';
import '../data/workshops_service.dart';
import '../providers/workshops_provider.dart';
import 'widgets/challenge_completion_sheet.dart';

// workshopId is the slug — route pattern is /workshops/:id but value is a slug.
class WorkshopDetailScreen extends ConsumerStatefulWidget {
  const WorkshopDetailScreen({super.key, required this.workshopId});
  final String workshopId; // slug

  @override
  ConsumerState<WorkshopDetailScreen> createState() =>
      _WorkshopDetailScreenState();
}

class _WorkshopDetailScreenState extends ConsumerState<WorkshopDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  final _visitedTabs = <int>{0};

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 5, vsync: this);
    _tabCtrl.addListener(() {
      if (!_tabCtrl.indexIsChanging) {
        setState(() => _visitedTabs.add(_tabCtrl.index));
      }
    });
    // Join the workshop socket room so Q&A events are received.
    ref.read(socketNotifierProvider.notifier).emit(
          kSocketJoinWorkshop,
          widget.workshopId,
        );
  }

  @override
  void dispose() {
    // Leave the workshop socket room on exit.
    ref.read(socketNotifierProvider.notifier).emit(
          kSocketLeaveWorkshop,
          widget.workshopId,
        );
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final accent = context.tbt.accent;
    final slug = widget.workshopId;
    final detailAsync = ref.watch(workshopDetailProvider(slug));

    // Pull delivery mode from the list cache if available.
    final listCache = ref.watch(workshopsProvider).valueOrNull;
    final listItem = listCache?.where((w) => w.slug == slug).firstOrNull;

    return Scaffold(
      body: detailAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        error: (e, _) => _buildError(
          () => ref.invalidate(workshopDetailProvider(slug)),
          detail: e.toString(),
        ),
        data: (detail) {
          final isEnrolled = detail.enrollmentStatus == 'active' ||
              detail.enrollmentStatus == 'completed';

          if (!isEnrolled) {
            return _AccessGate(
              slug: slug,
              detail: detail,
              accent: accent,
              onAccessGranted: () =>
                  ref.invalidate(workshopDetailProvider(slug)),
            );
          }

          return NestedScrollView(
            headerSliverBuilder: (context, _) => [
              _buildHeroSliver(detail, listItem, accent),
              _buildTabBarSliver(accent),
            ],
            body: TabBarView(
              controller: _tabCtrl,
              children: [
                // Tab 0 — Overview
                _OverviewTab(
                  detail: detail,
                  slug: widget.workshopId,
                  accent: accent,
                ),
                // Tab 1 — Flow
                if (_visitedTabs.contains(1))
                  _FlowTab(slug: slug, accent: accent)
                else
                  _buildPlaceholder(),
                // Tab 2 — Q&A
                if (_visitedTabs.contains(2))
                  _QaTab(slug: slug, accent: accent)
                else
                  _buildPlaceholder(),
                // Tab 3 — Live Calls
                if (_visitedTabs.contains(3))
                  _LiveCallsTab(slug: slug, accent: accent)
                else
                  _buildPlaceholder(),
                // Tab 4 — Assignments
                if (_visitedTabs.contains(4))
                  _AssignmentsTab(slug: slug, accent: accent)
                else
                  _buildPlaceholder(),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildHeroSliver(
    WorkshopDetail detail,
    Workshop? listItem,
    Color accent,
  ) {
    return SliverAppBar(
      expandedHeight: 220,
      pinned: true,
      backgroundColor: kColorBgSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new,
            color: kColorTextPrimary, size: 18),
        onPressed: () => Navigator.of(context).pop(),
      ),
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
          fit: StackFit.expand,
          children: [
            // Thumbnail
            if (detail.thumbnailUrl != null)
              CachedNetworkImage(
                imageUrl: detail.thumbnailUrl!,
                fit: BoxFit.cover,
                placeholder: (_, __) =>
                    const ColoredBox(color: kColorBgInput),
                errorWidget: (_, __, ___) =>
                    const ColoredBox(color: kColorBgInput),
              )
            else
              const ColoredBox(
                color: kColorBgInput,
                child: Center(
                  child: Icon(Icons.play_circle_outline,
                      color: kColorTextMuted, size: 48),
                ),
              ),
            // Gradient overlay for title legibility
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.black87],
                  stops: [0.4, 1.0],
                ),
              ),
            ),
            // Title + mode chip at bottom of hero
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (listItem != null)
                    _ModeChip(mode: listItem.deliveryMode,
                        label: listItem.deliveryModeLabel),
                  const SizedBox(height: 6),
                  Text(
                    detail.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      height: 1.3,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabBarSliver(Color accent) {
    return SliverPersistentHeader(
      pinned: true,
      delegate: _TabBarDelegate(
        TabBar(
          controller: _tabCtrl,
          labelColor: accent,
          unselectedLabelColor: kColorTextMuted,
          indicatorColor: accent,
          indicatorWeight: 2,
          labelStyle: const TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 13,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
          unselectedLabelStyle: const TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
          tabs: const [
            Tab(text: 'OVERVIEW'),
            Tab(text: 'FLOW'),
            Tab(text: 'Q&A'),
            Tab(text: 'LIVE CALLS'),
            Tab(text: 'ASSIGNMENTS'),
          ],
          isScrollable: true,
          tabAlignment: TabAlignment.start,
        ),
      ),
    );
  }

  Widget _buildPlaceholder() => const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      );
}

// ── Access gate (non-enrolled) ────────────────────────────────────────────────

class _AccessGate extends ConsumerStatefulWidget {
  const _AccessGate({
    required this.slug,
    required this.detail,
    required this.accent,
    required this.onAccessGranted,
  });
  final String slug;
  final WorkshopDetail detail;
  final Color accent;
  final VoidCallback onAccessGranted;

  @override
  ConsumerState<_AccessGate> createState() => _AccessGateState();
}

class _AccessGateState extends ConsumerState<_AccessGate> {
  var _requesting = false;
  String? _localStatus;

  @override
  void initState() {
    super.initState();
    _localStatus = widget.detail.enrollmentStatus;
  }

  Future<void> _request() async {
    setState(() => _requesting = true);
    try {
      final status = await ref
          .read(workshopsServiceProvider)
          .requestAccess(widget.slug);
      if (mounted) {
        setState(() {
          _localStatus = status;
          _requesting = false;
        });
        if (status == 'active') widget.onAccessGranted();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _requesting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: const Color(0xFFdc2626),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.detail;
    final isPending = _localStatus == 'pending';

    return Scaffold(
      appBar: AppBar(
        backgroundColor: kColorBgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              color: kColorTextPrimary, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          d.title,
          style: const TextStyle(
            color: kColorTextPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Thumbnail
            if (d.thumbnailUrl != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: CachedNetworkImage(
                    imageUrl: d.thumbnailUrl!,
                    fit: BoxFit.cover,
                    placeholder: (_, __) =>
                        const ColoredBox(color: kColorBgInput),
                    errorWidget: (_, __, ___) =>
                        const ColoredBox(color: kColorBgInput),
                  ),
                ),
              ),

            const SizedBox(height: 24),

            Text(
              d.title,
              style: const TextStyle(
                color: kColorTextPrimary,
                fontSize: 22,
                fontWeight: FontWeight.w700,
                height: 1.3,
              ),
              textAlign: TextAlign.center,
            ),

            if (d.description != null && d.description!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                d.description!,
                style: const TextStyle(
                  color: kColorTextSecondary,
                  fontSize: 14,
                  height: 1.6,
                ),
                textAlign: TextAlign.center,
              ),
            ],

            const SizedBox(height: 32),

            if (isPending)
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 20, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF3d2600),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                      color: const Color(0xFFfb923c).withAlpha(77)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.hourglass_empty_outlined,
                        color: Color(0xFFfb923c), size: 16),
                    SizedBox(width: 8),
                    Text(
                      'Access Requested — Pending Approval',
                      style: TextStyle(
                        color: Color(0xFFfb923c),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              )
            else
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _requesting ? null : _request,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: widget.accent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor:
                        widget.accent.withAlpha(128),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    elevation: 0,
                  ),
                  child: _requesting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text(
                          'Request Access',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                          ),
                        ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Overview tab ──────────────────────────────────────────────────────────────

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({
    required this.detail,
    required this.slug,
    required this.accent,
  });
  final WorkshopDetail detail;
  final String slug;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final progress = detail.learningProgress;
    final cert = detail.certificate;

    final listItems = <Widget>[
        // Description
        if (detail.description != null && detail.description!.isNotEmpty) ...[
          const Text(
            'ABOUT',
            style: TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
              color: kColorTextMuted,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            detail.description!,
            style: const TextStyle(
              color: kColorTextSecondary,
              fontSize: 14,
              height: 1.7,
            ),
          ),
          const SizedBox(height: 24),
        ],

        // Learning progress
        if (progress != null) ...[
          const Text(
            'YOUR PROGRESS',
            style: TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
              color: kColorTextMuted,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: kColorBgSurface,
              border: Border.all(color: kColorBorderCard),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      progress.label ?? 'Progress',
                      style: const TextStyle(
                        color: kColorTextPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      '${progress.percentage}%',
                      style: TextStyle(
                        color: accent,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress.percentage / 100,
                    backgroundColor: kColorBgInput,
                    valueColor: AlwaysStoppedAnimation<Color>(accent),
                    minHeight: 6,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${progress.completedCount} of ${progress.totalCount} completed',
                  style: const TextStyle(
                    color: kColorTextMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],

        // Certificate eligibility
        if (cert != null) ...[
          const Text(
            'CERTIFICATE',
            style: TextStyle(
              fontFamily: 'Rajdhani',
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
              color: kColorTextMuted,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: kColorBgSurface,
              border: Border.all(color: kColorBorderCard),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Icon(
                  cert['eligible'] == true
                      ? Icons.verified_outlined
                      : Icons.pending_outlined,
                  color: cert['eligible'] == true
                      ? const Color(0xFF22c55e)
                      : kColorTextMuted,
                  size: 28,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        cert['eligible'] == true
                            ? 'You are eligible!'
                            : 'Not yet eligible',
                        style: TextStyle(
                          color: cert['eligible'] == true
                              ? const Color(0xFF22c55e)
                              : kColorTextPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (cert['eligible'] != true) ...[
                        const SizedBox(height: 4),
                        Text(
                          _certRemainingText(cert),
                          style: const TextStyle(
                            color: kColorTextMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Videos% + Challenges% dual progress bars (matches web).
          if (cert['eligible'] != true) ...[
            const SizedBox(height: 12),
            _CertProgressBars(cert: cert, accent: accent),
          ],

          if (cert['eligible'] == true) ...[
            const SizedBox(height: 12),
            _WorkshopCertDownloadButton(
              slug: slug,
              accent: accent,
            ),
          ],
        ],
    ];
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
      itemCount: listItems.length,
      itemBuilder: (_, i) => listItems[i],
    );
  }

  String _certRemainingText(Map<String, dynamic> cert) {
    final videos = (cert['remainingVideos'] as num?)?.toInt() ?? 0;
    final challenges = (cert['remainingChallenges'] as num?)?.toInt() ?? 0;
    final parts = <String>[];
    if (videos > 0) parts.add('$videos video${videos > 1 ? 's' : ''}');
    if (challenges > 0) {
      parts.add('$challenges challenge${challenges > 1 ? 's' : ''}');
    }
    if (parts.isEmpty) return 'Complete all content to earn your certificate';
    return '${parts.join(' and ')} remaining';
  }
}

// ── Delivery mode chip ────────────────────────────────────────────────────────

class _ModeChip extends StatelessWidget {
  const _ModeChip({required this.mode, this.label});
  final DeliveryMode mode;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (mode) {
      DeliveryMode.online => (
          const Color(0xFF1e3a5f),
          const Color(0xFF60a5fa)
        ),
      DeliveryMode.offline => (
          const Color(0xFF3d2600),
          const Color(0xFFfb923c)
        ),
      DeliveryMode.hybrid => (
          const Color(0xFF2e1a47),
          const Color(0xFFa78bfa)
        ),
    };
    final text = label?.isNotEmpty == true
        ? label!
        : switch (mode) {
            DeliveryMode.online => 'Online',
            DeliveryMode.offline => 'In-Person',
            DeliveryMode.hybrid => 'Hybrid',
          };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: fg,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          fontFamily: 'Rajdhani',
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

// ── Tab bar pinned header delegate ────────────────────────────────────────────

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  const _TabBarDelegate(this.tabBar);
  final TabBar tabBar;

  @override
  double get minExtent => tabBar.preferredSize.height;
  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) =>
      ColoredBox(color: kColorBgSurface, child: tabBar);

  @override
  bool shouldRebuild(_TabBarDelegate old) => old.tabBar != tabBar;
}

// ── Flow tab ──────────────────────────────────────────────────────────────────

class _FlowTab extends ConsumerWidget {
  const _FlowTab({required this.slug, required this.accent});
  final String slug;
  final Color accent;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final flowAsync = ref.watch(workshopFlowProvider(slug));

    return flowAsync.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (_, __) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: kColorTextMuted, size: 36),
            const SizedBox(height: 10),
            const Text('Failed to load flow',
                style: TextStyle(color: kColorTextSecondary)),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => ref.invalidate(workshopFlowProvider(slug)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const Center(
            child: Text('No flow items yet',
                style: TextStyle(color: kColorTextMuted)),
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          itemCount: items.length,
          itemBuilder: (context, i) =>
              _FlowItemCard(item: items[i], slug: slug, accent: accent),
        );
      },
    );
  }
}

class _FlowItemCard extends StatelessWidget {
  const _FlowItemCard({
    required this.item,
    required this.slug,
    required this.accent,
  });
  final FlowItem item;
  final String slug;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return switch (item.type) {
      'challenge' => _ChallengeCard(item: item, slug: slug, accent: accent),
      'live_call' => _LiveCallFlowCard(item: item, accent: accent),
      _ => _CustomFlowCard(item: item),
    };
  }
}

class _ChallengeCard extends StatefulWidget {
  const _ChallengeCard({
    required this.item,
    required this.slug,
    required this.accent,
  });
  final FlowItem item;
  final String slug;
  final Color accent;

  @override
  State<_ChallengeCard> createState() => _ChallengeCardState();
}

class _ChallengeCardState extends State<_ChallengeCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final accent = widget.accent;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: kColorBgSurface,
        border: Border.all(color: kColorBorderCard),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (item.numberLabel != null)
                        Text(
                          item.numberLabel!,
                          style: TextStyle(
                            color: _hexColor(item.numberColor) ?? accent,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            fontFamily: 'Rajdhani',
                            letterSpacing: 1,
                          ),
                        ),
                      const Spacer(),
                      _CompletionIcon(
                          isCompleted: item.progressPercent == 100,
                          accent: accent),
                      const SizedBox(width: 8),
                      Icon(
                        _expanded
                            ? Icons.keyboard_arrow_up
                            : Icons.keyboard_arrow_down,
                        color: kColorTextMuted,
                        size: 18,
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    item.title ?? '',
                    style: const TextStyle(
                      color: kColorTextPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (item.progressPercent > 0) ...[
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(3),
                      child: LinearProgressIndicator(
                        value: item.progressPercent / 100,
                        backgroundColor: kColorBgInput,
                        valueColor: AlwaysStoppedAnimation<Color>(accent),
                        minHeight: 4,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${item.progressPercent}% complete',
                      style: const TextStyle(
                        color: kColorTextMuted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (_expanded && item.episodes.isNotEmpty) ...[
            const Divider(color: kColorBorderCard, height: 1),
            ...item.episodes.map(
              (ep) =>
                  _EpisodeRow(ep: ep, slug: widget.slug, accent: accent),
            ),
          ],
          if (_expanded && !item.isCompleted && item.progressPercent < 100) ...[
            const Divider(color: kColorBorderCard, height: 1),
            Padding(
              padding: const EdgeInsets.all(12),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.play_arrow, size: 16),
                  label: const Text('Start Challenge'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: accent,
                    side: BorderSide(color: accent),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  onPressed: () async {
                    final ok = await showModalBottomSheet<bool>(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => ChallengeCompletionSheet(
                        slug: widget.slug,
                        challengeId: item.id,
                        accent: accent,
                      ),
                    );
                    if (ok == true && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('Challenge complete!')),
                      );
                    }
                  },
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _EpisodeRow extends StatelessWidget {
  const _EpisodeRow({
    required this.ep,
    required this.slug,
    required this.accent,
  });
  final FlowEpisode ep;
  final String slug;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () =>
          context.push(AppRoutes.workshopEpisodePath(slug, ep.id)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          children: [
            Icon(
              ep.isCompleted
                  ? Icons.check_circle
                  : Icons.play_circle_outline,
              color:
                  ep.isCompleted ? const Color(0xFF22c55e) : kColorTextMuted,
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                ep.title,
                style: TextStyle(
                  color: ep.isCompleted
                      ? kColorTextSecondary
                      : kColorTextPrimary,
                  fontSize: 13,
                ),
              ),
            ),
            if (ep.durationLabel != null)
              Text(
                ep.durationLabel!,
                style: const TextStyle(
                  color: kColorTextMuted,
                  fontSize: 11,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _LiveCallFlowCard extends StatelessWidget {
  const _LiveCallFlowCard({required this.item, required this.accent});
  final FlowItem item;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final isPast = item.status == 'past';
    final isUpcoming = item.status == 'upcoming';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kColorBgSurface,
        border: Border.all(color: kColorBorderCard),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: accent.withAlpha(26),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(Icons.videocam_outlined, color: accent, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (item.label != null)
                  Text(
                    item.label!,
                    style: TextStyle(
                      color: _hexColor(item.labelColor) ?? accent,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      fontFamily: 'Rajdhani',
                      letterSpacing: 1,
                    ),
                  ),
                Text(
                  item.title ?? 'Live Call',
                  style: const TextStyle(
                    color: kColorTextPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (item.scheduledAt != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    _formatScheduled(item.scheduledAt!),
                    style: const TextStyle(
                        color: kColorTextMuted, fontSize: 12),
                  ),
                ],
                if (item.recordingAvailable && item.recordingLabel != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    item.recordingLabel!,
                    style: TextStyle(
                      color: accent,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ],
            ),
          ),
          _StatusBadge(
            isPast: isPast,
            isUpcoming: isUpcoming,
            isUnlocked: item.isUnlocked,
          ),
        ],
      ),
    );
  }

  String _formatScheduled(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      final h = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
      final m = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '${months[dt.month - 1]} ${dt.day}, ${dt.year} · $h:$m $ampm';
    } catch (_) {
      return iso;
    }
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge(
      {required this.isPast, required this.isUpcoming, required this.isUnlocked});
  final bool isPast;
  final bool isUpcoming;
  final bool isUnlocked;

  @override
  Widget build(BuildContext context) {
    if (isPast) {
      return _badge('Ended', const Color(0xFF3d2600), const Color(0xFFfb923c));
    }
    if (isUnlocked) {
      return _badge('Live', const Color(0xFF14532d), const Color(0xFF4ade80));
    }
    return _badge('Upcoming', const Color(0xFF1e3a5f), const Color(0xFF60a5fa));
  }

  Widget _badge(String label, Color bg, Color fg) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: fg,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            fontFamily: 'Rajdhani',
          ),
        ),
      );
}

class _CustomFlowCard extends StatelessWidget {
  const _CustomFlowCard({required this.item});
  final FlowItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kColorBgSurface,
        border: Border.all(color: kColorBorderCard),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          const Icon(Icons.checklist_outlined,
              color: kColorTextMuted, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (item.label != null && item.label!.isNotEmpty)
                  Text(
                    item.label!,
                    style: const TextStyle(
                      color: kColorTextPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                if (item.description != null && item.description!.isNotEmpty)
                  Text(
                    item.description!,
                    style: const TextStyle(
                        color: kColorTextSecondary, fontSize: 13),
                  ),
              ],
            ),
          ),
          _CompletionIcon(isCompleted: item.isCompleted, accent: kColorTextMuted),
        ],
      ),
    );
  }
}

class _CompletionIcon extends StatelessWidget {
  const _CompletionIcon({required this.isCompleted, required this.accent});
  final bool isCompleted;
  final Color accent;

  @override
  Widget build(BuildContext context) => Icon(
        isCompleted
            ? Icons.check_circle
            : Icons.radio_button_unchecked,
        color: isCompleted ? const Color(0xFF22c55e) : kColorTextMuted,
        size: 18,
      );
}

Color? _hexColor(String? hex) {
  if (hex == null || hex.isEmpty) return null;
  try {
    final s = hex.replaceFirst('#', '');
    return Color(int.parse('FF$s', radix: 16));
  } catch (_) {
    return null;
  }
}

// ── Q&A tab ───────────────────────────────────────────────────────────────────

class _QaTab extends ConsumerStatefulWidget {
  const _QaTab({required this.slug, required this.accent});
  final String slug;
  final Color accent;

  @override
  ConsumerState<_QaTab> createState() => _QaTabState();
}

class _QaTabState extends ConsumerState<_QaTab> {
  Timer? _pollTimer;
  // postId → reply input controller
  final _replyCtrl = <String, TextEditingController>{};
  final _replyExpanded = <String, bool>{};
  var _submittingReply = <String, bool>{};

  @override
  void initState() {
    super.initState();
    _pollTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) ref.invalidate(workshopQaProvider(widget.slug));
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    for (final c in _replyCtrl.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _toggleReply(String postId) {
    setState(() {
      _replyExpanded[postId] = !(_replyExpanded[postId] ?? false);
      _replyCtrl.putIfAbsent(postId, TextEditingController.new);
    });
  }

  Future<void> _submitReply(String postId) async {
    final ctrl = _replyCtrl[postId];
    final text = ctrl?.text.trim() ?? '';
    if (text.isEmpty) return;
    setState(() => _submittingReply = {..._submittingReply, postId: true});
    try {
      await ref
          .read(workshopsServiceProvider)
          .postQaReply(postId, text);
      ctrl?.clear();
      setState(() {
        _replyExpanded[postId] = false;
        _submittingReply = {..._submittingReply, postId: false};
      });
      ref.invalidate(workshopQaProvider(widget.slug));
    } catch (e) {
      if (mounted) {
        setState(
            () => _submittingReply = {..._submittingReply, postId: false});
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: const Color(0xFFdc2626),
          ),
        );
      }
    }
  }

  void _showAskSheet(WorkshopQaData qa) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: kColorBgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _AskQuestionSheet(
        slug: widget.slug,
        qa: qa,
        accent: widget.accent,
        onPosted: () => ref.invalidate(workshopQaProvider(widget.slug)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.accent;
    final qaAsync = ref.watch(workshopQaProvider(widget.slug));

    return qaAsync.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (_, __) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: kColorTextMuted, size: 36),
            const SizedBox(height: 10),
            const Text('Failed to load Q&A',
                style: TextStyle(color: kColorTextSecondary)),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () =>
                  ref.invalidate(workshopQaProvider(widget.slug)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (qa) {
        return Scaffold(
          backgroundColor: Colors.transparent,
          floatingActionButton: FloatingActionButton.extended(
            backgroundColor: accent,
            foregroundColor: Colors.white,
            elevation: 2,
            onPressed: () => _showAskSheet(qa),
            icon: const Icon(Icons.edit_outlined, size: 18),
            label: const Text(
              'Ask a Question',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                fontFamily: 'Rajdhani',
              ),
            ),
          ),
          body: qa.posts.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.question_answer_outlined,
                          color: kColorTextMuted, size: 40),
                      SizedBox(height: 10),
                      Text('No questions yet — be the first!',
                          style: TextStyle(color: kColorTextSecondary)),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                  itemCount: qa.posts.length,
                  itemBuilder: (context, i) => _QaPostCard(
                    post: qa.posts[i],
                    accent: accent,
                    replyExpanded:
                        _replyExpanded[qa.posts[i].id] ?? false,
                    replyCtrl: _replyCtrl.putIfAbsent(
                        qa.posts[i].id, TextEditingController.new),
                    submittingReply:
                        _submittingReply[qa.posts[i].id] ?? false,
                    onToggleReply: () => _toggleReply(qa.posts[i].id),
                    onSubmitReply: () => _submitReply(qa.posts[i].id),
                  ),
                ),
        );
      },
    );
  }
}

// ── Ask question bottom sheet ─────────────────────────────────────────────────

class _AskQuestionSheet extends ConsumerStatefulWidget {
  const _AskQuestionSheet({
    required this.slug,
    required this.qa,
    required this.accent,
    required this.onPosted,
  });
  final String slug;
  final WorkshopQaData qa;
  final Color accent;
  final VoidCallback onPosted;

  @override
  ConsumerState<_AskQuestionSheet> createState() => _AskQuestionSheetState();
}

class _AskQuestionSheetState extends ConsumerState<_AskQuestionSheet> {
  final _ctrl = TextEditingController();
  var _submitting = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await ref
          .read(workshopsServiceProvider)
          .postWorkshopQuestion(widget.slug, text);
      if (mounted) Navigator.of(context).pop();
      widget.onPosted();
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: const Color(0xFFdc2626),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final qa = widget.qa;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            qa.heading,
            style: const TextStyle(
              color: kColorTextPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (qa.promptText.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              qa.promptText,
              style: const TextStyle(color: kColorTextMuted, fontSize: 13),
            ),
          ],
          const SizedBox(height: 14),
          TextField(
            controller: _ctrl,
            maxLines: 4,
            style:
                const TextStyle(color: kColorTextPrimary, fontSize: 14),
            decoration: InputDecoration(
              hintText: qa.inputPlaceholder,
              hintStyle:
                  const TextStyle(color: kColorTextMuted, fontSize: 14),
              filled: true,
              fillColor: kColorBgInput,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: kColorBorderCard),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: kColorBorderCard),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: widget.accent),
              ),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: widget.accent,
                foregroundColor: Colors.white,
                disabledBackgroundColor: widget.accent.withAlpha(128),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text(
                      qa.submitLabel,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QaPostCard extends StatelessWidget {
  const _QaPostCard({
    required this.post,
    required this.accent,
    required this.replyExpanded,
    required this.replyCtrl,
    required this.submittingReply,
    required this.onToggleReply,
    required this.onSubmitReply,
  });
  final QaPost post;
  final Color accent;
  final bool replyExpanded;
  final TextEditingController replyCtrl;
  final bool submittingReply;
  final VoidCallback onToggleReply;
  final VoidCallback onSubmitReply;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kColorBgSurface,
        border: Border.all(color: kColorBorderCard),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Author row
          Row(
            children: [
              _Avatar(name: post.author.name, avatarUrl: post.author.avatarUrl),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      post.author.name,
                      style: const TextStyle(
                        color: kColorTextPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      post.timeAgo,
                      style: const TextStyle(
                          color: kColorTextMuted, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Question text
          Text(
            post.questionText,
            style: const TextStyle(
              color: kColorTextSecondary,
              fontSize: 14,
              height: 1.5,
            ),
          ),
          // Replies
          if (post.replies.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...post.replies.map((r) => _ReplyRow(reply: r)),
          ],
          const SizedBox(height: 10),
          // Reply button
          Semantics(
            label: replyExpanded ? 'Cancel reply' : 'Reply to post',
            button: true,
            child: GestureDetector(
              onTap: onToggleReply,
              child: Text(
                replyExpanded ? 'Cancel' : post.replyLabel,
                style: TextStyle(
                  color: accent,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          // Inline reply input
          if (replyExpanded) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: replyCtrl,
                    style: const TextStyle(
                        color: kColorTextPrimary, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Write a reply…',
                      hintStyle: const TextStyle(
                          color: kColorTextMuted, fontSize: 13),
                      filled: true,
                      fillColor: kColorBgInput,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide:
                            const BorderSide(color: kColorBorderCard),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide:
                            const BorderSide(color: kColorBorderCard),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: accent),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Semantics(
                  label: 'Submit reply',
                  button: true,
                  child: GestureDetector(
                    onTap: submittingReply ? null : onSubmitReply,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: accent,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: submittingReply
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.send,
                              color: Colors.white, size: 16),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ReplyRow extends StatelessWidget {
  const _ReplyRow({required this.reply});
  final QaReply reply;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Avatar(
              name: reply.author.name,
              avatarUrl: reply.author.avatarUrl,
              size: 24),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      reply.author.name,
                      style: const TextStyle(
                        color: kColorTextPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      reply.timeAgo,
                      style: const TextStyle(
                          color: kColorTextMuted, fontSize: 10),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  reply.replyText,
                  style: const TextStyle(
                    color: kColorTextSecondary,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, this.avatarUrl, this.size = 32});
  final String name;
  final String? avatarUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (avatarUrl != null && avatarUrl!.isNotEmpty) {
      return ClipOval(
        child: Image.network(
          avatarUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _initials(),
        ),
      );
    }
    return _initials();
  }

  Widget _initials() {
    final initial =
        name.isNotEmpty ? name[0].toUpperCase() : '?';
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        color: Color(0xFF1e3a5f),
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          initial,
          style: TextStyle(
            color: const Color(0xFF60a5fa),
            fontSize: size * 0.4,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

// ── Live Calls tab ────────────────────────────────────────────────────────────

class _LiveCallsTab extends ConsumerStatefulWidget {
  const _LiveCallsTab({required this.slug, required this.accent});
  final String slug;
  final Color accent;

  @override
  ConsumerState<_LiveCallsTab> createState() => _LiveCallsTabState();
}

class _LiveCallsTabState extends ConsumerState<_LiveCallsTab> {
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) ref.invalidate(workshopFlowProvider(widget.slug));
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.accent;
    final flowAsync = ref.watch(workshopFlowProvider(widget.slug));

    return flowAsync.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (_, __) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: kColorTextMuted, size: 36),
            const SizedBox(height: 10),
            const Text('Failed to load live calls',
                style: TextStyle(color: kColorTextSecondary)),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () =>
                  ref.invalidate(workshopFlowProvider(widget.slug)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (items) {
        final liveCalls =
            items.where((i) => i.type == 'live_call').toList();
        if (liveCalls.isEmpty) {
          return const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.videocam_off_outlined,
                    color: kColorTextMuted, size: 40),
                SizedBox(height: 10),
                Text('No live calls scheduled',
                    style: TextStyle(color: kColorTextMuted)),
              ],
            ),
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          itemCount: liveCalls.length,
          itemBuilder: (context, i) => _LiveCallCard(
            item: liveCalls[i],
            accent: accent,
            workshopSlug: widget.slug,
          ),
        );
      },
    );
  }
}

class _LiveCallCard extends ConsumerStatefulWidget {
  const _LiveCallCard({
    required this.item,
    required this.accent,
    required this.workshopSlug,
  });
  final FlowItem item;
  final Color accent;
  final String workshopSlug;

  @override
  ConsumerState<_LiveCallCard> createState() => _LiveCallCardState();
}

class _LiveCallCardState extends ConsumerState<_LiveCallCard> {
  String? _rsvpStatus;
  bool _rsvpLoading = true;
  Timer? _countdownTicker;

  @override
  void initState() {
    super.initState();
    _loadRsvp();
    _countdownTicker =
        Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _countdownTicker?.cancel();
    super.dispose();
  }

  Future<void> _loadRsvp() async {
    final id = widget.item.liveCallId;
    if (id == null || id.isEmpty) {
      setState(() => _rsvpLoading = false);
      return;
    }
    try {
      final status =
          await ref.read(workshopsServiceProvider).getRsvpStatus(id);
      if (!mounted) return;
      setState(() {
        _rsvpStatus = status;
        _rsvpLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _rsvpLoading = false);
    }
  }

  Future<void> _setRsvp(String next) async {
    final id = widget.item.liveCallId;
    if (id == null) return;
    final prev = _rsvpStatus;
    setState(() => _rsvpStatus = next);
    try {
      await ref.read(workshopsServiceProvider).upsertRsvp(id, next);
    } catch (_) {
      if (mounted) {
        setState(() => _rsvpStatus = prev);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update RSVP')),
        );
      }
    }
  }

  // ── Calendar exports ────────────────────────────────────────────────────────
  // Google Calendar accepts a pre-templated URL; .ics is a text-format file
  // that any calendar app on the phone will import.

  DateTime? _startTime() {
    final iso = widget.item.scheduledAt;
    if (iso == null) return null;
    return DateTime.tryParse(iso)?.toUtc();
  }

  Future<void> _openGoogleCalendar() async {
    final start = _startTime();
    if (start == null) return;
    final end = start.add(const Duration(hours: 1));
    String fmt(DateTime dt) =>
        '${dt.year.toString().padLeft(4, '0')}${dt.month.toString().padLeft(2, '0')}${dt.day.toString().padLeft(2, '0')}T${dt.hour.toString().padLeft(2, '0')}${dt.minute.toString().padLeft(2, '0')}${dt.second.toString().padLeft(2, '0')}Z';
    final title = Uri.encodeComponent(
        widget.item.title ?? 'TBT Live Call');
    final dates = '${fmt(start)}/${fmt(end)}';
    final uri = Uri.parse(
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=$title&dates=$dates',
    );
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _downloadIcs() async {
    final start = _startTime();
    if (start == null) return;
    final end = start.add(const Duration(hours: 1));
    String fmt(DateTime dt) =>
        '${dt.year.toString().padLeft(4, '0')}${dt.month.toString().padLeft(2, '0')}${dt.day.toString().padLeft(2, '0')}T${dt.hour.toString().padLeft(2, '0')}${dt.minute.toString().padLeft(2, '0')}${dt.second.toString().padLeft(2, '0')}Z';
    final title = widget.item.title ?? 'TBT Live Call';
    final uid = '${widget.item.id}@tamilbusinesstribe.com';
    final ics = 'BEGIN:VCALENDAR\r\n'
        'VERSION:2.0\r\n'
        'PRODID:-//TBT//EN\r\n'
        'BEGIN:VEVENT\r\n'
        'UID:$uid\r\n'
        'DTSTAMP:${fmt(DateTime.now().toUtc())}\r\n'
        'DTSTART:${fmt(start)}\r\n'
        'DTEND:${fmt(end)}\r\n'
        'SUMMARY:$title\r\n'
        'DESCRIPTION:Live call from Tamil Business Tribe\r\n'
        'END:VEVENT\r\n'
        'END:VCALENDAR\r\n';
    final dir = await getTemporaryDirectory();
    final safeTitle =
        title.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '-').toLowerCase();
    final file = File('${dir.path}/tbt-$safeTitle.ics');
    await file.writeAsString(ics, flush: true);
    final result = await OpenFilex.open(file.path, type: 'text/calendar');
    if (result.type != ResultType.done && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.message)),
      );
    }
  }

  String? _countdownLabel() {
    final iso = widget.item.scheduledAt;
    if (iso == null) return null;
    final target = DateTime.tryParse(iso);
    if (target == null) return null;
    final diff = target.difference(DateTime.now());
    if (diff.isNegative) return null;
    if (diff.inDays > 0) {
      return '${diff.inDays}d ${diff.inHours.remainder(24)}h';
    }
    if (diff.inHours > 0) {
      return '${diff.inHours}h ${diff.inMinutes.remainder(60)}m';
    }
    if (diff.inMinutes > 0) {
      return '${diff.inMinutes}m ${diff.inSeconds.remainder(60)}s';
    }
    return '${diff.inSeconds}s';
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final accent = widget.accent;
    final workshopSlug = widget.workshopSlug;
    final isPast = item.status == 'past';
    final canJoin = item.isUnlocked && !isPast;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kColorBgSurface,
        border: Border.all(color: kColorBorderCard),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: accent.withAlpha(26),
                  borderRadius: BorderRadius.circular(8),
                ),
                child:
                    Icon(Icons.videocam_outlined, color: accent, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (item.label != null && item.label!.isNotEmpty)
                      Text(
                        item.label!,
                        style: TextStyle(
                          color: _hexColor(item.labelColor) ?? accent,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          fontFamily: 'Rajdhani',
                          letterSpacing: 1,
                        ),
                      ),
                    Text(
                      item.title ?? 'Live Call',
                      style: const TextStyle(
                        color: kColorTextPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              _StatusBadge(
                isPast: isPast,
                isUpcoming: !canJoin && !isPast,
                isUnlocked: canJoin,
              ),
            ],
          ),

          if (item.scheduledAt != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.schedule,
                    color: kColorTextMuted, size: 14),
                const SizedBox(width: 6),
                Text(
                  _formatScheduled(item.scheduledAt!),
                  style: const TextStyle(
                      color: kColorTextMuted, fontSize: 13),
                ),
              ],
            ),
          ],

          if (item.prerequisiteNote != null &&
              item.prerequisiteNote!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              item.prerequisiteNote!,
              style: const TextStyle(
                  color: kColorTextMuted, fontSize: 12),
            ),
          ],

          if (item.recordingAvailable && item.recordingLabel != null) ...[
            const SizedBox(height: 8),
            Text(
              item.recordingLabel!,
              style: TextStyle(
                color: accent,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],

          if (item.aiSummary != null && item.aiSummary!.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text(
              'AI SUMMARY',
              style: TextStyle(
                fontFamily: 'Rajdhani',
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5,
                color: kColorTextMuted,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              item.aiSummary!,
              style: const TextStyle(
                  color: kColorTextSecondary, fontSize: 13, height: 1.5),
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
            ),
          ],

          // Countdown to the scheduled start time (updates every second).
          if (_countdownLabel() != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: kColorBgInput,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: kColorBorderCard),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.schedule, color: accent, size: 14),
                  const SizedBox(width: 6),
                  Text(
                    'Starts in ${_countdownLabel()}',
                    style: const TextStyle(
                      color: kColorTextSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Calendar exports (Google Calendar link + .ics file).
          if (item.scheduledAt != null && _countdownLabel() != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.event_available, size: 14),
                    label: const Text(
                      'Google Calendar',
                      style: TextStyle(fontSize: 12),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: kColorTextSecondary,
                      side: const BorderSide(color: kColorBorderCard),
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    onPressed: _openGoogleCalendar,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.download, size: 14),
                    label: const Text(
                      '.ics',
                      style: TextStyle(fontSize: 12),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: kColorTextSecondary,
                      side: const BorderSide(color: kColorBorderCard),
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    onPressed: _downloadIcs,
                  ),
                ),
              ],
            ),
          ],

          // RSVP row — only when a scheduled future call.
          if (!isPast &&
              item.liveCallId != null &&
              !_rsvpLoading &&
              _countdownLabel() != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: Icon(
                      _rsvpStatus == 'confirmed'
                          ? Icons.check_circle
                          : Icons.check_circle_outline,
                      size: 16,
                    ),
                    label: const Text('Confirmed'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _rsvpStatus == 'confirmed'
                          ? accent
                          : kColorTextSecondary,
                      side: BorderSide(
                        color: _rsvpStatus == 'confirmed'
                            ? accent
                            : kColorBorderCard,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    onPressed: () => _setRsvp('confirmed'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: Icon(
                      _rsvpStatus == 'declined'
                          ? Icons.cancel
                          : Icons.cancel_outlined,
                      size: 16,
                    ),
                    label: const Text('Can\'t make it'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _rsvpStatus == 'declined'
                          ? Colors.redAccent
                          : kColorTextSecondary,
                      side: BorderSide(
                        color: _rsvpStatus == 'declined'
                            ? Colors.redAccent
                            : kColorBorderCard,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    onPressed: () => _setRsvp('declined'),
                  ),
                ),
              ],
            ),
          ],

          if (canJoin && item.liveCallId != null) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => context.push(
                  AppRoutes.liveCallPath(workshopSlug, item.liveCallId!),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: accent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  elevation: 0,
                ),
                icon: const Icon(Icons.videocam, size: 18),
                label: const Text(
                  'Join Now',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _formatScheduled(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      final h = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
      final m = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '${months[dt.month - 1]} ${dt.day}, ${dt.year} · $h:$m $ampm';
    } catch (_) {
      return iso;
    }
  }
}

// ── Assignments tab ───────────────────────────────────────────────────────────

class _AssignmentsTab extends ConsumerWidget {
  const _AssignmentsTab({required this.slug, required this.accent});
  final String slug;
  final Color accent;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assignmentsAsync = ref.watch(workshopAssignmentsProvider(slug));

    return assignmentsAsync.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (_, __) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: kColorTextMuted, size: 36),
            const SizedBox(height: 10),
            const Text('Failed to load assignments',
                style: TextStyle(color: kColorTextSecondary)),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () =>
                  ref.invalidate(workshopAssignmentsProvider(slug)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (groups) {
        if (groups.isEmpty) {
          return const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.assignment_outlined,
                    color: kColorTextMuted, size: 40),
                SizedBox(height: 10),
                Text('No assignments yet',
                    style: TextStyle(color: kColorTextMuted)),
              ],
            ),
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          itemCount: groups.length,
          itemBuilder: (context, gi) =>
              _AssignmentGroupCard(group: groups[gi], accent: accent, slug: slug),
        );
      },
    );
  }
}

class _AssignmentGroupCard extends ConsumerWidget {
  const _AssignmentGroupCard({
    required this.group,
    required this.accent,
    required this.slug,
  });
  final AssignmentGroup group;
  final Color accent;
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8, top: 4),
          child: RichText(
            text: TextSpan(
              children: [
                TextSpan(
                  text: '${group.challengeLabel}  ',
                  style: const TextStyle(
                    fontFamily: 'Rajdhani',
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                    color: kColorTextMuted,
                  ),
                ),
                TextSpan(
                  text: group.challengeTitle,
                  style: const TextStyle(
                    color: kColorTextSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
        ...group.assignments.map((a) => _AssignmentCard(
              assignment: a,
              accent: accent,
              slug: slug,
              onSubmitted: () => ref.invalidate(workshopAssignmentsProvider(slug)),
            )),
        const SizedBox(height: 8),
      ],
    );
  }
}

class _AssignmentCard extends ConsumerStatefulWidget {
  const _AssignmentCard({
    required this.assignment,
    required this.accent,
    required this.slug,
    required this.onSubmitted,
  });
  final WorkshopAssignment assignment;
  final Color accent;
  final String slug;
  final VoidCallback onSubmitted;

  @override
  ConsumerState<_AssignmentCard> createState() => _AssignmentCardState();
}

class _AssignmentCardState extends ConsumerState<_AssignmentCard> {
  // ── Assignment types (matches web `assignmentType` field) ────────────────────
  //  - image_upload → pick image via image_picker
  //  - file_upload  → pick generic file via file_picker
  //  - video_upload → pick video via image_picker.pickVideo
  //  - anything else (qa / answer / null) → text answer via TextField
  bool get _isImage => widget.assignment.assignmentType == 'image_upload';
  bool get _isFile => widget.assignment.assignmentType == 'file_upload';
  bool get _isVideo => widget.assignment.assignmentType == 'video_upload';
  bool get _isText => !_isImage && !_isFile && !_isVideo;

  // Size caps mirror the web's copy hints (10 / 50 / 500 MB). The web relies
  // on `accept=""` alone — mobile enforces size client-side so uploads over
  // cellular don't waste minutes before the presigned PUT rejects them.
  int get _maxBytes => _isImage
      ? 10 * 1024 * 1024
      : _isVideo
          ? 500 * 1024 * 1024
          : 50 * 1024 * 1024;

  String get _maxLabel => _isImage
      ? '10MB'
      : _isVideo
          ? '500MB'
          : '50MB';

  bool _checkSize(Uint8List bytes) {
    if (bytes.length <= _maxBytes) return true;
    if (!mounted) return false;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('File is too large — max $_maxLabel')),
    );
    return false;
  }

  bool _checkMime(String contentType) {
    // Image and video pickers already restrict at the OS level, but on some
    // Android skins the picker can still return a foreign mimetype (e.g. a
    // HEIC labelled application/octet-stream). Fail early with a clear msg.
    if (_isImage && !contentType.startsWith('image/')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Only image files are allowed')),
      );
      return false;
    }
    if (_isVideo && !contentType.startsWith('video/')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Only video files are allowed')),
      );
      return false;
    }
    return true;
  }

  bool _isEditing = false;
  bool _submitting = false;

  // Text mode
  final _answerCtrl = TextEditingController();

  // File-upload staging: the picked bytes/name/type before we upload.
  Uint8List? _pickedBytes;
  String? _pickedName;
  String? _pickedContentType;

  @override
  void dispose() {
    _answerCtrl.dispose();
    super.dispose();
  }

  void _startEdit() {
    setState(() {
      _isEditing = true;
      if (_isText) {
        _answerCtrl.text = widget.assignment.submission?.answerText ?? '';
      }
    });
  }

  void _cancelEdit() {
    setState(() {
      _isEditing = false;
      _answerCtrl.clear();
      _pickedBytes = null;
      _pickedName = null;
      _pickedContentType = null;
    });
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final xFile = await picker.pickImage(source: ImageSource.gallery);
    if (xFile == null) return;
    final bytes = await xFile.readAsBytes();
    final contentType =
        xFile.mimeType ?? UploadService.guessContentType(xFile.name);
    if (!_checkMime(contentType)) return;
    if (!_checkSize(bytes)) return;
    setState(() {
      _pickedBytes = bytes;
      _pickedName = xFile.name;
      _pickedContentType = contentType;
    });
  }

  Future<void> _pickVideo() async {
    final picker = ImagePicker();
    final xFile = await picker.pickVideo(source: ImageSource.gallery);
    if (xFile == null) return;
    final bytes = await xFile.readAsBytes();
    final contentType =
        xFile.mimeType ?? UploadService.guessContentType(xFile.name);
    if (!_checkMime(contentType)) return;
    if (!_checkSize(bytes)) return;
    setState(() {
      _pickedBytes = bytes;
      _pickedName = xFile.name;
      _pickedContentType = contentType;
    });
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.any,
      allowMultiple: false,
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.single;
    final bytes = file.bytes ?? await file.xFile.readAsBytes();
    final contentType = UploadService.guessContentType(file.name);
    if (!_checkMime(contentType)) return;
    if (!_checkSize(bytes)) return;
    setState(() {
      _pickedBytes = bytes;
      _pickedName = file.name;
      _pickedContentType = contentType;
    });
  }

  Future<void> _submit() async {
    if (_submitting) return;

    if (_isText) {
      final text = _answerCtrl.text.trim();
      if (text.isEmpty) return;
      setState(() => _submitting = true);
      try {
        await ref.read(workshopsServiceProvider).submitAssignment(
              widget.assignment.id,
              answerText: text,
            );
        if (mounted) _finishSubmit();
      } catch (e) {
        if (mounted) _showError(e);
      }
      return;
    }

    // Upload path (image / file / video)
    final bytes = _pickedBytes;
    final name = _pickedName;
    final contentType = _pickedContentType;
    if (bytes == null || name == null || contentType == null) return;

    setState(() => _submitting = true);
    try {
      final workshopsSvc = ref.read(workshopsServiceProvider);
      final uploadSvc = ref.read(uploadServiceProvider);

      // Image assignments hit a dedicated bucket via a different presign URL.
      final presign = _isImage
          ? await workshopsSvc.getAssignmentImagePresign(name, contentType)
          : await workshopsSvc.getAssignmentFilePresign(name, contentType);

      final uploadUrl = presign['uploadUrl'] ?? '';
      final publicUrl = presign['publicUrl'] ?? '';
      if (uploadUrl.isEmpty || publicUrl.isEmpty) {
        throw Exception('Failed to obtain upload URL');
      }

      await uploadSvc.uploadToR2(
        uploadUrl: uploadUrl,
        bytes: bytes,
        contentType: contentType,
      );

      await workshopsSvc.submitAssignment(
        widget.assignment.id,
        imageUrl: _isImage ? publicUrl : null,
        fileUrl: _isFile ? publicUrl : null,
        videoUrl: _isVideo ? publicUrl : null,
      );

      if (mounted) _finishSubmit();
    } catch (e) {
      if (mounted) _showError(e);
    }
  }

  void _finishSubmit() {
    setState(() {
      _submitting = false;
      _isEditing = false;
      _answerCtrl.clear();
      _pickedBytes = null;
      _pickedName = null;
      _pickedContentType = null;
    });
    widget.onSubmitted();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Assignment submitted!'),
        backgroundColor: Color(0xFF14532d),
      ),
    );
  }

  void _showError(Object e) {
    setState(() => _submitting = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(e.toString()),
        backgroundColor: const Color(0xFFdc2626),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.assignment;
    final sub = a.submission;
    final isSubmitted = sub?.isSubmitted ?? false;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kColorBgSurface,
        border: Border.all(
          color: isSubmitted && !_isEditing
              ? const Color(0xFF14532d)
              : kColorBorderCard,
        ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row (icon + title + Submitted badge)
          Row(
            children: [
              Icon(
                _typeIcon(isSubmitted && !_isEditing),
                color: isSubmitted && !_isEditing
                    ? const Color(0xFF22c55e)
                    : widget.accent,
                size: 18,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  a.title,
                  style: const TextStyle(
                    color: kColorTextPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (isSubmitted && !_isEditing)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF14532d),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'Submitted',
                    style: TextStyle(
                      color: Color(0xFF4ade80),
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      fontFamily: 'Rajdhani',
                    ),
                  ),
                ),
            ],
          ),

          if (a.questionText != null && a.questionText!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              a.questionText!,
              style: const TextStyle(
                color: kColorTextSecondary,
                fontSize: 13,
                height: 1.5,
              ),
            ),
          ],

          // Submitted review OR editing form
          if (isSubmitted && !_isEditing) ...[
            const SizedBox(height: 10),
            _SubmissionPreview(submission: sub!, accent: widget.accent),
            if (a.canEdit) ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.edit_outlined, size: 14),
                  label: const Text(
                    'Edit',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: kColorTextSecondary,
                    side: const BorderSide(color: kColorBorderCard),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  onPressed: _startEdit,
                ),
              ),
            ],
          ] else ...[
            const SizedBox(height: 12),
            _buildInputArea(),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submitting || !_canSubmit() ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: widget.accent,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: widget.accent.withAlpha(90),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      elevation: 0,
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            _isEditing ? 'Update' : a.submitLabel,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                  ),
                ),
                if (_isEditing) ...[
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: _submitting ? null : _cancelEdit,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: kColorTextSecondary,
                      side: const BorderSide(color: kColorBorderCard),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: Text(
                      a.cancelLabel,
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }

  IconData _typeIcon(bool submittedGreen) {
    if (submittedGreen) return Icons.check_circle;
    if (_isImage) return Icons.image_outlined;
    if (_isVideo) return Icons.videocam_outlined;
    if (_isFile) return Icons.attach_file_outlined;
    return Icons.chat_bubble_outline;
  }

  bool _canSubmit() {
    if (_isText) return _answerCtrl.text.trim().isNotEmpty;
    return _pickedBytes != null && _pickedName != null;
  }

  Widget _buildInputArea() {
    if (_isText) {
      return TextField(
        controller: _answerCtrl,
        maxLines: 5,
        minLines: 3,
        style: const TextStyle(color: kColorTextPrimary, fontSize: 13),
        decoration: InputDecoration(
          hintText: 'Type your answer…',
          hintStyle: const TextStyle(color: kColorTextMuted, fontSize: 13),
          filled: true,
          fillColor: kColorBgInput,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: kColorBorderCard),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: kColorBorderCard),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: widget.accent),
          ),
        ),
        onChanged: (_) => setState(() {}),
      );
    }

    final picked = _pickedBytes != null;
    final picker = _isImage
        ? _pickImage
        : _isVideo
            ? _pickVideo
            : _pickFile;
    final iconData = _isImage
        ? Icons.image_outlined
        : _isVideo
            ? Icons.videocam_outlined
            : Icons.upload_file_outlined;
    final label = _isImage
        ? 'Click to upload an image'
        : _isVideo
            ? 'Click to upload a video'
            : 'Click to upload a file';
    final hint = _isImage
        ? 'PNG, JPG, WEBP up to $_maxLabel'
        : _isVideo
            ? 'MP4, MOV, WEBM up to $_maxLabel'
            : 'PDF, DOC, XLSX up to $_maxLabel';

    return InkWell(
      onTap: picker,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kColorBgInput,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: kColorBorderCard,
            style: BorderStyle.solid,
            width: 1,
          ),
        ),
        child: picked
            ? _PickedFilePreview(
                bytes: _pickedBytes!,
                name: _pickedName!,
                isImage: _isImage,
                onRemove: () => setState(() {
                  _pickedBytes = null;
                  _pickedName = null;
                  _pickedContentType = null;
                }),
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(iconData, color: kColorTextMuted, size: 28),
                  const SizedBox(height: 8),
                  Text(
                    label,
                    style: const TextStyle(
                      color: kColorTextSecondary,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    hint,
                    style: const TextStyle(
                      color: kColorTextMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

// Small helper widget: preview of the picked file before submit.
class _PickedFilePreview extends StatelessWidget {
  const _PickedFilePreview({
    required this.bytes,
    required this.name,
    required this.isImage,
    required this.onRemove,
  });

  final Uint8List bytes;
  final String name;
  final bool isImage;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (isImage)
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 200),
              child: Image.memory(bytes, fit: BoxFit.contain),
            ),
          )
        else
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.insert_drive_file_outlined,
                  color: kColorTextSecondary, size: 20),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  name,
                  style: const TextStyle(
                    color: kColorTextPrimary,
                    fontSize: 13,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        const SizedBox(height: 8),
        TextButton.icon(
          onPressed: onRemove,
          icon: const Icon(Icons.close, size: 14, color: kColorTextMuted),
          label: const Text(
            'Remove',
            style: TextStyle(color: kColorTextMuted, fontSize: 12),
          ),
          style: TextButton.styleFrom(padding: EdgeInsets.zero),
        ),
      ],
    );
  }
}

// Preview widget shown when the assignment has been submitted (renders the
// stored answer text, image, file link, or video URL).
class _SubmissionPreview extends StatelessWidget {
  const _SubmissionPreview({required this.submission, required this.accent});
  final AssignmentSubmission submission;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    if (submission.imageUrl != null && submission.imageUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 220),
          child: CachedNetworkImage(
            imageUrl: submission.imageUrl!,
            fit: BoxFit.contain,
            placeholder: (_, __) => Container(
              color: kColorBgInput,
              height: 120,
              child: const Center(
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
            errorWidget: (_, __, ___) => Container(
              color: kColorBgInput,
              height: 60,
              alignment: Alignment.center,
              child: const Text(
                'Could not load image',
                style: TextStyle(color: kColorTextMuted, fontSize: 12),
              ),
            ),
          ),
        ),
      );
    }
    if (submission.videoUrl != null && submission.videoUrl!.isNotEmpty) {
      final url = submission.videoUrl!;
      return _SubmittedVideoTile(url: url, accent: accent);
    }
    if (submission.fileUrl != null && submission.fileUrl!.isNotEmpty) {
      final url = submission.fileUrl!;
      return InkWell(
        onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: kColorBgInput,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: kColorBorderCard),
          ),
          child: Row(
            children: [
              Icon(Icons.description_outlined, color: accent, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'View submitted file',
                  style: TextStyle(
                    color: accent,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const Icon(Icons.open_in_new, size: 14, color: kColorTextMuted),
            ],
          ),
        ),
      );
    }
    if (submission.answerText != null && submission.answerText!.isNotEmpty) {
      return _AnswerText(text: submission.answerText!);
    }
    return const SizedBox.shrink();
  }
}

// Numbered-list detection matches the web `renderAnswerText` helper — if every
// line begins with `1. `, `2. `, etc., render as an ordered list.
class _AnswerText extends StatelessWidget {
  const _AnswerText({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final lines = text
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();
    final numbered = lines.length > 1 &&
        lines.every((l) => RegExp(r'^\d+[.)]\s').hasMatch(l));

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: kColorBgInput,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: kColorBorderCard),
      ),
      child: numbered
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < lines.length; i++)
                  Padding(
                    padding: EdgeInsets.only(bottom: i == lines.length - 1 ? 0 : 6),
                    child: Text(
                      lines[i],
                      style: const TextStyle(
                        color: kColorTextSecondary,
                        fontSize: 13,
                        height: 1.5,
                      ),
                    ),
                  ),
              ],
            )
          : Text(
              text,
              style: const TextStyle(
                color: kColorTextSecondary,
                fontSize: 13,
                height: 1.5,
              ),
            ),
    );
  }
}

// Compact "Play submitted video" tile — opens the video URL in the platform
// video handler (Chrome / gallery / etc.) via url_launcher.
class _SubmittedVideoTile extends StatelessWidget {
  const _SubmittedVideoTile({required this.url, required this.accent});
  final String url;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: kColorBgInput,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: kColorBorderCard),
        ),
        child: Row(
          children: [
            Icon(Icons.play_circle_outline, color: accent, size: 22),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'View submitted video',
                style: TextStyle(
                  color: kColorTextPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const Icon(Icons.open_in_new, size: 14, color: kColorTextMuted),
          ],
        ),
      ),
    );
  }
}

// ── Workshop certificate download button ──────────────────────────────────────

// ── Certificate progress dual bars ────────────────────────────────────────────

class _CertProgressBars extends StatelessWidget {
  const _CertProgressBars({required this.cert, required this.accent});
  final Map<String, dynamic> cert;
  final Color accent;

  int _pct(dynamic v) {
    if (v is num) return v.toInt().clamp(0, 100);
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final videosPct = _pct(cert['videosProgress'] ?? cert['videosPercent']);
    final challengesPct =
        _pct(cert['challengesProgress'] ?? cert['challengesPercent']);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kColorBgSurface,
        border: Border.all(color: kColorBorderCard),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.workspace_premium_outlined, color: accent, size: 16),
              const SizedBox(width: 8),
              const Text(
                'CERTIFICATE PROGRESS',
                style: TextStyle(
                  fontFamily: 'Rajdhani',
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                  color: kColorTextMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _row('Videos', videosPct, accent),
          const SizedBox(height: 8),
          _row('Challenges', challengesPct, accent),
          const SizedBox(height: 8),
          Text(
            _remainingLabel(cert),
            style: const TextStyle(
              color: kColorTextMuted,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, int pct, Color color) {
    return Row(
      children: [
        SizedBox(
          width: 78,
          child: Text(
            label,
            style: const TextStyle(
              color: kColorTextSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: pct / 100,
              backgroundColor: kColorBgInput,
              valueColor: AlwaysStoppedAnimation<Color>(color),
              minHeight: 5,
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 36,
          child: Text(
            '$pct%',
            textAlign: TextAlign.right,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }

  String _remainingLabel(Map<String, dynamic> cert) {
    final videos = (cert['remainingVideos'] as num?)?.toInt() ?? 0;
    final challenges =
        (cert['remainingChallenges'] as num?)?.toInt() ?? 0;
    final parts = <String>[];
    if (videos > 0) parts.add('$videos video${videos > 1 ? 's' : ''} remaining');
    if (challenges > 0) {
      parts.add('$challenges challenge${challenges > 1 ? 's' : ''} remaining');
    }
    return parts.isEmpty
        ? 'Complete all content to unlock your certificate.'
        : parts.join(' · ');
  }
}

class _WorkshopCertDownloadButton extends ConsumerStatefulWidget {
  const _WorkshopCertDownloadButton({required this.slug, required this.accent});

  final String slug;
  final Color accent;

  @override
  ConsumerState<_WorkshopCertDownloadButton> createState() =>
      _WorkshopCertDownloadButtonState();
}

class _WorkshopCertDownloadButtonState
    extends ConsumerState<_WorkshopCertDownloadButton> {
  bool _launching = false;

  Future<void> _download() async {
    if (_launching) return;
    setState(() => _launching = true);
    try {
      // Mirrors the course-cert pattern: cookie-authenticated PDF stream via
      // Dio, written to app cache, then opened with the native PDF viewer.
      final bytes = await ref
          .read(workshopsServiceProvider)
          .downloadWorkshopCertificate(widget.slug);
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/tbt-workshop-cert-${widget.slug}.pdf');
      await file.writeAsBytes(bytes, flush: true);
      final result = await OpenFilex.open(file.path, type: 'application/pdf');
      if (result.type != ResultType.done && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.message)),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open certificate')),
        );
      }
    } finally {
      if (mounted) setState(() => _launching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 44,
      child: ElevatedButton.icon(
        icon: _launching
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Icon(Icons.workspace_premium, size: 18),
        label: const Text(
          'Download Certificate',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontWeight: FontWeight.w700,
            fontSize: 15,
            letterSpacing: 0.5,
          ),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: widget.accent,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
        onPressed: _launching ? null : _download,
      ),
    );
  }
}

// ── Error state ───────────────────────────────────────────────────────────────

Widget _buildError(VoidCallback onRetry, {String? detail}) => Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: kColorTextMuted, size: 40),
          const SizedBox(height: 12),
          const Text('Failed to load workshop',
              style: TextStyle(color: kColorTextSecondary)),
          if (detail != null) ...[
            const SizedBox(height: 8),
            Text(
              detail,
              textAlign: TextAlign.center,
              style: const TextStyle(color: kColorTextMuted, fontSize: 11),
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: 12),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
      ),
    );

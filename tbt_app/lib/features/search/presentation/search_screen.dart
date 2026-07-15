import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/routes.dart';
import '../providers/search_provider.dart';

import '../../../shared/theme/theme_tokens.dart';
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  Timer? _debounce;
  String _activeQuery = '';
  List<String> _recentSearches = [];
  bool _loadingRecent = true;

  @override
  void initState() {
    super.initState();
    _focusNode.requestFocus();
    _loadRecent();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _loadRecent() async {
    final searches = await loadRecentSearches();
    if (mounted) setState(() { _recentSearches = searches; _loadingRecent = false; });
  }

  void _onTextChanged(String value) {
    _debounce?.cancel();
    if (value.trim().isEmpty) {
      setState(() => _activeQuery = '');
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _activeQuery = value.trim());
    });
  }

  Future<void> _submitSearch(String query) async {
    final q = query.trim();
    if (q.isEmpty) return;
    setState(() => _activeQuery = q);
    _controller.text = q;
    _controller.selection = TextSelection.fromPosition(
        TextPosition(offset: q.length));
    await saveRecentSearch(q);
    await _loadRecent();
  }

  Future<void> _removeRecent(String query) async {
    await removeRecentSearch(query);
    await _loadRecent();
  }

  Future<void> _clearAll() async {
    await clearRecentSearches();
    await _loadRecent();
  }

  void _clear() {
    _controller.clear();
    setState(() => _activeQuery = '');
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: context.tokens.bgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleSpacing: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: context.tokens.textPrimary),
          onPressed: () => context.pop(),
        ),
        title: TextField(
          controller: _controller,
          focusNode: _focusNode,
          onChanged: _onTextChanged,
          onSubmitted: _submitSearch,
          style: TextStyle(color: context.tokens.textPrimary, fontSize: 15),
          decoration: InputDecoration(
            hintText: 'Search workshops, courses…',
            hintStyle:
                TextStyle(color: context.tokens.textMuted, fontSize: 15),
            border: InputBorder.none,
            suffixIcon: _controller.text.isNotEmpty
                ? IconButton(
                    icon: Icon(Icons.close,
                        color: context.tokens.textMuted, size: 20),
                    onPressed: _clear,
                  )
                : null,
          ),
        ),
      ),
      body: _activeQuery.isEmpty
          ? _RecentSearchesView(
              searches: _recentSearches,
              loading: _loadingRecent,
              onTap: _submitSearch,
              onRemove: _removeRecent,
              onClearAll: _clearAll,
            )
          : _ResultsView(
              query: _activeQuery,
              onWorkshopTap: (slug) => context.push(AppRoutes.workshopDetailPath(slug)),
              onCourseTap: (id) => context.push(AppRoutes.courseDetailPath(id)),
              onEpisodeTap: (courseId, episodeId) =>
                  context.push(AppRoutes.lessonPlayerPath(courseId, episodeId)),
              onResourceTap: () => context.push(AppRoutes.resources),
              onResultShown: () => saveRecentSearch(_activeQuery),
            ),
    );
  }
}

// ── Recent searches ───────────────────────────────────────────────────────────

class _RecentSearchesView extends StatelessWidget {
  const _RecentSearchesView({
    required this.searches,
    required this.loading,
    required this.onTap,
    required this.onRemove,
    required this.onClearAll,
  });

  final List<String> searches;
  final bool loading;
  final ValueChanged<String> onTap;
  final ValueChanged<String> onRemove;
  final VoidCallback onClearAll;

  @override
  Widget build(BuildContext context) {
    if (loading) return const SizedBox.shrink();
    if (searches.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search, color: context.tokens.textMuted, size: 40),
            SizedBox(height: 12),
            Text(
              'Search for workshops, courses, resources',
              style: TextStyle(color: context.tokens.textSecondary, fontSize: 13),
            ),
          ],
        ),
      );
    }

    final listItems = <Widget>[
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 8, 4),
        child: Row(
          children: [
            Text(
              'RECENT',
              style: TextStyle(
                fontFamily: 'Rajdhani',
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.5,
                color: context.tokens.textMuted,
              ),
            ),
            const Spacer(),
            TextButton(
              onPressed: onClearAll,
              child: Text(
                'Clear all',
                style: TextStyle(color: context.tokens.textMuted, fontSize: 12),
              ),
            ),
          ],
        ),
      ),
      ...searches.map(
        (q) => ListTile(
          dense: true,
          leading: Icon(Icons.history,
              color: context.tokens.textMuted, size: 18),
          title: Text(q,
              style: TextStyle(
                  color: context.tokens.textPrimary, fontSize: 14)),
          trailing: IconButton(
            icon: Icon(Icons.close,
                color: context.tokens.textMuted, size: 18),
            onPressed: () => onRemove(q),
          ),
          onTap: () => onTap(q),
        ),
      ),
    ];
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: listItems.length,
      itemBuilder: (_, i) => listItems[i],
    );
  }
}

// ── Results ───────────────────────────────────────────────────────────────────

class _ResultsView extends ConsumerWidget {
  const _ResultsView({
    required this.query,
    required this.onWorkshopTap,
    required this.onCourseTap,
    required this.onEpisodeTap,
    required this.onResourceTap,
    required this.onResultShown,
  });

  final String query;
  final ValueChanged<String> onWorkshopTap;
  final ValueChanged<String> onCourseTap;
  final void Function(String courseId, String episodeId) onEpisodeTap;
  final VoidCallback onResourceTap;
  final VoidCallback onResultShown;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(searchProvider(query));

    return async.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (_, __) => Center(
        child: Text(
          'Search failed. Try again.',
          style: TextStyle(color: context.tokens.textSecondary),
        ),
      ),
      data: (results) {
        if (results.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.search_off,
                    color: context.tokens.textMuted, size: 40),
                const SizedBox(height: 12),
                Text(
                  'No results for "$query"',
                  style: TextStyle(
                      color: context.tokens.textSecondary, fontSize: 13),
                ),
              ],
            ),
          );
        }

        // Save to recent when results appear
        WidgetsBinding.instance.addPostFrameCallback((_) => onResultShown());

        final listItems = <Widget>[
          if (results.workshops.isNotEmpty) ...[
            _SectionHeader(label: 'WORKSHOPS (${results.workshops.length})'),
            ...results.workshops.map(
              (w) => _ResultTile(
                icon: Icons.play_circle_outline,
                title: w.title,
                subtitle: w.description,
                thumbnailUrl: w.thumbnailUrl,
                onTap: () => onWorkshopTap(w.slug),
              ),
            ),
          ],
          if (results.courses.isNotEmpty) ...[
            _SectionHeader(label: 'COURSES (${results.courses.length})'),
            ...results.courses.map(
              (c) => _ResultTile(
                icon: Icons.school_outlined,
                title: c.title,
                subtitle: c.description,
                thumbnailUrl: c.thumbnailUrl,
                onTap: () => onCourseTap(c.id),
              ),
            ),
          ],
          if (results.episodes.isNotEmpty) ...[
            _SectionHeader(label: 'EPISODES (${results.episodes.length})'),
            ...results.episodes.map(
              (e) => _ResultTile(
                icon: Icons.ondemand_video_outlined,
                title: e.title,
                subtitle: e.courseTitle,
                thumbnailUrl: e.thumbnailUrl,
                onTap: () => onEpisodeTap(e.courseId, e.id),
              ),
            ),
          ],
          if (results.resources.isNotEmpty) ...[
            _SectionHeader(
                label: 'RESOURCES (${results.resources.length})'),
            ...results.resources.map(
              (r) => _ResultTile(
                icon: _resourceIcon(r.fileType),
                title: r.title,
                subtitle: r.description ?? r.fileType?.toUpperCase(),
                onTap: onResourceTap,
              ),
            ),
          ],
        ];
        return ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: listItems.length,
          itemBuilder: (_, i) => listItems[i],
        );
      },
    );
  }

  IconData _resourceIcon(String? fileType) {
    if (fileType == null) return Icons.insert_drive_file_outlined;
    final t = fileType.toLowerCase();
    if (t.contains('pdf')) return Icons.picture_as_pdf_outlined;
    if (t.contains('video')) return Icons.videocam_outlined;
    if (t.contains('audio')) return Icons.audio_file_outlined;
    if (t.contains('image')) return Icons.image_outlined;
    return Icons.insert_drive_file_outlined;
  }
}

// ── Shared sub-widgets ────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
      child: Text(
        label,
        style: TextStyle(
          fontFamily: 'Rajdhani',
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.5,
          color: context.tokens.textMuted,
        ),
      ),
    );
  }
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.thumbnailUrl,
  });

  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final String? subtitle;
  final String? thumbnailUrl;

  @override
  Widget build(BuildContext context) {
    // Render a 56×56 thumbnail block when the hit has one; otherwise fall
    // back to a colored icon square in the same footprint so titles align
    // across rows.
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                width: 56,
                height: 56,
                child: (thumbnailUrl != null && thumbnailUrl!.isNotEmpty)
                    ? CachedNetworkImage(
                        imageUrl: thumbnailUrl!,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(
                          color: context.tokens.bgInput,
                          alignment: Alignment.center,
                          child: Icon(icon,
                              color: context.tokens.textMuted, size: 18),
                        ),
                        errorWidget: (_, __, ___) => Container(
                          color: context.tokens.bgInput,
                          alignment: Alignment.center,
                          child: Icon(icon,
                              color: context.tokens.textMuted, size: 18),
                        ),
                      )
                    : Container(
                        color: context.tokens.bgInput,
                        alignment: Alignment.center,
                        child:
                            Icon(icon, color: context.tokens.textSecondary, size: 20),
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: context.tokens.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      height: 1.3,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (subtitle != null && subtitle!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: TextStyle(
                        color: context.tokens.textMuted,
                        fontSize: 11,
                        height: 1.35,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(Icons.chevron_right,
                color: context.tokens.textMuted, size: 18),
          ],
        ),
      ),
    );
  }
}

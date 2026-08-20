import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/chat_groups_service.dart';
import '../domain/chat_group_models.dart';

/// Full-screen paginated media gallery for a group.
/// Tabs: All | Images | Videos | Docs
class ChatGroupMediaGalleryScreen extends ConsumerStatefulWidget {
  const ChatGroupMediaGalleryScreen({
    super.key,
    required this.groupId,
    required this.groupName,
    this.initialType,
  });
  final String groupId;
  final String groupName;
  final String? initialType;

  @override
  ConsumerState<ChatGroupMediaGalleryScreen> createState() =>
      _ChatGroupMediaGalleryScreenState();
}

class _ChatGroupMediaGalleryScreenState
    extends ConsumerState<ChatGroupMediaGalleryScreen>
    with SingleTickerProviderStateMixin {
  static const _tabs = ['All', 'Images', 'Videos', 'Docs'];
  static const _types = [null, 'image', 'video', 'document'];

  late final TabController _tabCtl;
  final List<List<ChatGroupMediaItem>> _pages = [[], [], [], []];
  final List<bool> _loading = [false, false, false, false];
  final List<bool> _hasMore = [true, true, true, true];
  final List<String?> _cursors = [null, null, null, null];

  @override
  void initState() {
    super.initState();
    final initialIdx = widget.initialType == null
        ? 0
        : _types.indexOf(widget.initialType).clamp(0, 3);
    _tabCtl = TabController(
      length: _tabs.length,
      vsync: this,
      initialIndex: initialIdx,
    );
    _tabCtl.addListener(() {
      if (_tabCtl.indexIsChanging) return;
      final i = _tabCtl.index;
      if (_pages[i].isEmpty && !_loading[i]) _load(i);
    });
    _load(initialIdx);
  }

  @override
  void dispose() {
    _tabCtl.dispose();
    super.dispose();
  }

  Future<void> _load(int tabIdx, {bool refresh = false}) async {
    if (_loading[tabIdx]) return;
    if (!_hasMore[tabIdx] && !refresh) return;
    if (refresh) {
      _pages[tabIdx].clear();
      _cursors[tabIdx] = null;
      _hasMore[tabIdx] = true;
    }
    setState(() => _loading[tabIdx] = true);
    try {
      final svc = ref.read(chatGroupsServiceProvider);
      final items = await svc.listGroupMedia(
        widget.groupId,
        type: _types[tabIdx],
        limit: 30,
        before: _cursors[tabIdx],
      );
      setState(() {
        _pages[tabIdx].addAll(items);
        if (items.length < 30) _hasMore[tabIdx] = false;
        if (items.isNotEmpty) {
          _cursors[tabIdx] = items.last.createdAt.toUtc().toIso8601String();
        }
        _loading[tabIdx] = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading[tabIdx] = false);
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
        title: Text(
          widget.groupName,
          style: TextStyle(color: tokens.textPrimary, fontSize: 16, fontWeight: FontWeight.w700),
        ),
        iconTheme: IconThemeData(color: tokens.textPrimary),
        bottom: TabBar(
          controller: _tabCtl,
          labelColor: kColorAccent,
          unselectedLabelColor: tokens.textMuted,
          indicatorColor: kColorAccent,
          labelStyle: const TextStyle(
            fontFamily: 'Rajdhani',
            fontWeight: FontWeight.w700,
            fontSize: 13,
            letterSpacing: 0.6,
          ),
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
          onTap: (i) {
            if (_pages[i].isEmpty && !_loading[i]) _load(i);
          },
        ),
      ),
      body: TabBarView(
        controller: _tabCtl,
        children: List.generate(
          _tabs.length,
          (i) => _MediaGrid(
            items: _pages[i],
            loading: _loading[i],
            hasMore: _hasMore[i],
            onLoadMore: () => _load(i),
            onRefresh: () => _load(i, refresh: true),
          ),
        ),
      ),
    );
  }
}

class _MediaGrid extends StatelessWidget {
  const _MediaGrid({
    required this.items,
    required this.loading,
    required this.hasMore,
    required this.onLoadMore,
    required this.onRefresh,
  });

  final List<ChatGroupMediaItem> items;
  final bool loading;
  final bool hasMore;
  final VoidCallback onLoadMore;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    if (items.isEmpty && loading) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2, color: kColorAccent));
    }
    if (items.isEmpty && !loading) {
      return Center(
        child: Text('No media yet', style: TextStyle(color: tokens.textMuted, fontSize: 13)),
      );
    }

    return RefreshIndicator(
      color: kColorAccent,
      onRefresh: () async => onRefresh(),
      child: GridView.builder(
        padding: const EdgeInsets.all(2),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          crossAxisSpacing: 2,
          mainAxisSpacing: 2,
        ),
        itemCount: items.length + (hasMore ? 1 : 0),
        itemBuilder: (ctx, i) {
          if (i >= items.length) {
            // Load-more sentinel
            if (!loading) WidgetsBinding.instance.addPostFrameCallback((_) => onLoadMore());
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(8),
                child: CircularProgressIndicator(strokeWidth: 2, color: kColorAccent),
              ),
            );
          }
          return _Thumb(item: items[i]);
        },
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.item});
  final ChatGroupMediaItem item;

  void _open(BuildContext context) {
    if (item.mediaType == 'image') {
      _openImageViewer(context);
    }
    // video/document: no-op for now — could launch URL via url_launcher
  }

  void _openImageViewer(BuildContext context) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.black,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
          body: Center(
            child: InteractiveViewer(
              child: CachedNetworkImage(
                imageUrl: item.mediaUrl,
                fit: BoxFit.contain,
                errorWidget: (_, __, ___) => const Icon(
                  Icons.broken_image_outlined,
                  color: Colors.white24,
                  size: 64,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => _open(context),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (item.mediaType == 'image')
            CachedNetworkImage(
              imageUrl: item.mediaUrl,
              fit: BoxFit.cover,
              errorWidget: (_, __, ___) => Container(
                color: const Color(0xFF1a1a1a),
                child: const Icon(Icons.broken_image_outlined, color: Colors.white24, size: 28),
              ),
            )
          else
            Container(
              color: const Color(0xFF1a1a1a),
              child: Icon(
                item.mediaType == 'video'
                    ? Icons.play_circle_outline_rounded
                    : item.mediaType == 'audio'
                        ? Icons.audio_file_outlined
                        : Icons.insert_drive_file_outlined,
                color: Colors.white38,
                size: 32,
              ),
            ),
          if (item.mediaType == 'video')
            const Center(
              child: Icon(Icons.play_circle_filled_rounded, color: Colors.white54, size: 28),
            ),
        ],
      ),
    );
  }
}

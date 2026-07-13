import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/theme/design_constants.dart';
import '../data/resources_service.dart';
import '../providers/resources_provider.dart';

class ResourcesScreen extends ConsumerStatefulWidget {
  const ResourcesScreen({super.key});

  @override
  ConsumerState<ResourcesScreen> createState() => _ResourcesScreenState();
}

class _ResourcesScreenState extends ConsumerState<ResourcesScreen> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  String _query = '';
  bool _grid = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      setState(() => _query = v.trim());
    });
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(searchedResourcesProvider(_query));

    return Scaffold(
      appBar: AppBar(
        backgroundColor: kColorBgSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'RESOURCES',
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 17,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: kColorTextPrimary,
          ),
        ),
        actions: [
          IconButton(
            tooltip: _grid ? 'List view' : 'Grid view',
            icon: Icon(_grid ? Icons.view_list : Icons.grid_view,
                color: kColorTextMuted, size: 20),
            onPressed: () => setState(() => _grid = !_grid),
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: kColorTextMuted, size: 20),
            onPressed: () =>
                ref.invalidate(searchedResourcesProvider(_query)),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              style:
                  const TextStyle(color: kColorTextPrimary, fontSize: 14),
              decoration: InputDecoration(
                isDense: true,
                prefixIcon: const Icon(Icons.search,
                    color: kColorTextMuted, size: 18),
                suffixIcon: _searchCtrl.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close,
                            color: kColorTextMuted, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          _onSearchChanged('');
                        },
                      ),
                hintText: 'Search resources…',
                hintStyle: const TextStyle(color: kColorTextMuted),
                filled: true,
                fillColor: kColorBgInput,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: kColorBorderCard),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: kColorBorderCard),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
          Expanded(
            child: async.when(
              loading: () => const Center(
                  child: CircularProgressIndicator(strokeWidth: 2)),
              error: (_, __) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        color: kColorTextMuted, size: 40),
                    const SizedBox(height: 12),
                    const Text('Failed to load resources',
                        style: TextStyle(color: kColorTextSecondary)),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => ref
                          .invalidate(searchedResourcesProvider(_query)),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.folder_open_outlined,
                            color: kColorTextMuted, size: 40),
                        const SizedBox(height: 12),
                        Text(
                          _query.isEmpty
                              ? 'No resources available'
                              : 'No results for "$_query"',
                          style: const TextStyle(
                              color: kColorTextSecondary, fontSize: 14),
                        ),
                      ],
                    ),
                  );
                }
                if (_grid) {
                  return GridView.builder(
                    padding: const EdgeInsets.all(12),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 0.9,
                    ),
                    itemCount: items.length,
                    itemBuilder: (_, i) => _ResourceGridCard(
                      resource: items[i],
                      onDownload: () => _download(context, ref, items[i]),
                      onPreview: () => _preview(context, items[i]),
                    ),
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: items.length,
                  itemBuilder: (_, i) => _ResourceTile(
                    resource: items[i],
                    onDownload: () => _download(context, ref, items[i]),
                    onPreview: () => _preview(context, items[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _download(
      BuildContext context, WidgetRef ref, AppResource resource) async {
    if (resource.locked) return;

    try {
      final url = await ref
          .read(resourcesFeatureServiceProvider)
          .getDownloadUrl(resource.id);
      if (url.isEmpty) throw Exception('Empty URL');
      final uri = Uri.parse(url);
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw Exception('Could not launch URL');
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to open resource')),
        );
      }
    }
  }

  // Preview opens the resource directly in the OS browser without hitting the
  // download counter — parity with the web "Preview" hover action.
  Future<void> _preview(BuildContext context, AppResource resource) async {
    final url = resource.previewUrl;
    if (url == null || url.isEmpty) return;
    try {
      final uri = Uri.parse(url);
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw Exception('Could not launch preview');
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to preview resource')),
        );
      }
    }
  }
}

// ── Resource tile ─────────────────────────────────────────────────────────────

class _ResourceTile extends StatefulWidget {
  const _ResourceTile({
    required this.resource,
    required this.onDownload,
    required this.onPreview,
  });

  final AppResource resource;
  final Future<void> Function() onDownload;
  final Future<void> Function() onPreview;

  @override
  State<_ResourceTile> createState() => _ResourceTileState();
}

class _ResourceTileState extends State<_ResourceTile> {
  bool _loading = false;

  Future<void> _handleTap() async {
    if (widget.resource.locked || _loading) return;
    setState(() => _loading = true);
    await widget.onDownload();
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final res = widget.resource;
    final locked = res.locked;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: kColorBgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: kColorBorderCard),
      ),
      child: Stack(
        children: [
          ListTile(
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            leading: _FileTypeIcon(fileType: res.fileType),
            title: Text(
              res.title,
              style: TextStyle(
                color: locked ? kColorTextMuted : kColorTextPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (res.description != null && res.description!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      res.description!,
                      style: const TextStyle(
                          color: kColorTextMuted, fontSize: 11),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    _MetaChip(label: res.fileType.toUpperCase()),
                    if (res.fileCount > 1) ...[
                      const SizedBox(width: 6),
                      _MetaChip(label: '${res.fileCount} files'),
                    ],
                    if (res.author != null) ...[
                      const SizedBox(width: 6),
                      _MetaChip(label: res.author!),
                    ],
                  ],
                ),
              ],
            ),
            trailing: locked
                ? const Icon(Icons.lock_outline,
                    color: kColorTextMuted, size: 20)
                : _loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: kColorAccent),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (res.previewUrl != null &&
                              res.previewUrl!.isNotEmpty)
                            IconButton(
                              tooltip: 'Preview',
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(
                                  minWidth: 32, minHeight: 32),
                              icon: const Icon(Icons.visibility_outlined,
                                  color: kColorTextSecondary, size: 20),
                              onPressed: widget.onPreview,
                            ),
                          const SizedBox(width: 4),
                          const Icon(Icons.download_outlined,
                              color: kColorAccent, size: 22),
                        ],
                      ),
            onTap: locked ? null : _handleTap,
          ),

          // Locked overlay
          if (locked)
            Positioned.fill(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  color: Colors.black.withValues(alpha: 0.35),
                  child: const Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.lock_outline,
                            color: Colors.white70, size: 16),
                        SizedBox(width: 6),
                        Text(
                          'Batch restricted',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── File type icon ────────────────────────────────────────────────────────────

class _FileTypeIcon extends StatelessWidget {
  const _FileTypeIcon({required this.fileType});

  final String fileType;

  IconData get _icon {
    final t = fileType.toLowerCase();
    if (t.contains('pdf')) return Icons.picture_as_pdf_outlined;
    if (t.contains('video') || t.contains('mp4')) return Icons.videocam_outlined;
    if (t.contains('audio') || t.contains('mp3')) return Icons.audio_file_outlined;
    if (t.contains('image') || t.contains('jpg') || t.contains('png')) {
      return Icons.image_outlined;
    }
    if (t.contains('zip') || t.contains('rar')) return Icons.folder_zip_outlined;
    if (t.contains('doc') || t.contains('word')) return Icons.description_outlined;
    if (t.contains('xls') || t.contains('sheet')) return Icons.table_chart_outlined;
    if (t.contains('ppt') || t.contains('slide')) return Icons.slideshow_outlined;
    if (t.contains('link') || t.contains('url')) return Icons.link_outlined;
    return Icons.insert_drive_file_outlined;
  }

  Color get _color {
    final t = fileType.toLowerCase();
    if (t.contains('pdf')) return const Color(0xFFdc2626);
    if (t.contains('video') || t.contains('mp4')) return const Color(0xFF7c3aed);
    if (t.contains('audio') || t.contains('mp3')) return const Color(0xFF0891b2);
    if (t.contains('image')) return const Color(0xFF059669);
    if (t.contains('zip') || t.contains('rar')) return const Color(0xFFd97706);
    if (t.contains('doc') || t.contains('word')) return const Color(0xFF1d4ed8);
    if (t.contains('xls') || t.contains('sheet')) return const Color(0xFF16a34a);
    if (t.contains('ppt') || t.contains('slide')) return const Color(0xFFea580c);
    return kColorTextMuted;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(_icon, color: _color, size: 22),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: kColorBgInput,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: kColorTextMuted,
          fontSize: 9,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

// ── Grid card ─────────────────────────────────────────────────────────────────

class _ResourceGridCard extends StatefulWidget {
  const _ResourceGridCard({
    required this.resource,
    required this.onDownload,
    required this.onPreview,
  });

  final AppResource resource;
  final Future<void> Function() onDownload;
  final Future<void> Function() onPreview;

  @override
  State<_ResourceGridCard> createState() => _ResourceGridCardState();
}

class _ResourceGridCardState extends State<_ResourceGridCard> {
  bool _loading = false;

  Future<void> _tap() async {
    if (widget.resource.locked || _loading) return;
    setState(() => _loading = true);
    await widget.onDownload();
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.resource;
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: _tap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: kColorBgSurface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: kColorBorderCard),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _FileTypeIcon(fileType: r.fileType),
            const SizedBox(height: 10),
            Text(
              r.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: r.locked ? kColorTextMuted : kColorTextPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            if (r.description != null && r.description!.isNotEmpty)
              Expanded(
                child: Text(
                  r.description!,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: kColorTextMuted,
                    fontSize: 11,
                    height: 1.3,
                  ),
                ),
              )
            else
              const Spacer(),
            Row(
              children: [
                _MetaChip(label: r.fileType.toUpperCase()),
                const Spacer(),
                if (r.locked)
                  const Icon(Icons.lock_outline,
                      color: kColorTextMuted, size: 16)
                else if (_loading)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else ...[
                  if (r.previewUrl != null && r.previewUrl!.isNotEmpty)
                    InkWell(
                      onTap: widget.onPreview,
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 4),
                        child: Icon(Icons.visibility_outlined,
                            color: kColorTextSecondary, size: 16),
                      ),
                    ),
                  const Icon(Icons.download_rounded,
                      color: kColorAccent, size: 18),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

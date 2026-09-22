import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import '../../../shared/theme/design_constants.dart';
import '../../../shared/theme/theme_tokens.dart';
import '../data/ebook_service.dart';
import '../domain/ebook_models.dart';
import '../providers/ebook_providers.dart';
import '../../../shared/widgets/app_loader.dart';

/// In-app PDF reader powered by `flutter_pdfview`.
///
/// Flow:
///   1. Download the PDF to a local file (cached across launches so the
///      second open is instant).
///   2. Mount `PDFView`, hooking `onPageChanged` → posts progress to
///      the backend (throttled to at most one write per 3 s per book).
///   3. Bookmark button snapshots the current page.
///
/// Falls back to a friendly error state if the download / render fails.
class EbookReaderScreen extends ConsumerStatefulWidget {
  const EbookReaderScreen({super.key, required this.bookId});
  final String bookId;

  @override
  ConsumerState<EbookReaderScreen> createState() => _EbookReaderScreenState();
}

class _EbookReaderScreenState extends ConsumerState<EbookReaderScreen> {
  String? _localPath;
  String? _error;
  int _currentPage = 0;
  int _totalPages = 0;
  DateTime _lastProgressWrite = DateTime.fromMillisecondsSinceEpoch(0);
  bool _busyBookmark = false;

  @override
  void initState() {
    super.initState();
    _loadPdf();
  }

  Future<void> _loadPdf() async {
    try {
      final book = await ref.read(ebookServiceProvider).getBook(widget.bookId);
      if (book.pdfUrl == null || book.pdfUrl!.isEmpty) {
        setState(() => _error = 'This book has no PDF file.');
        return;
      }
      final dir = await getTemporaryDirectory();
      // Filename includes book.id so we don't collide across books; the
      // cache is idempotent per book.
      final file = File('${dir.path}/ebook_${widget.bookId}.pdf');
      if (!await file.exists()) {
        final res = await http.get(Uri.parse(book.pdfUrl!));
        if (res.statusCode < 200 || res.statusCode >= 300) {
          setState(() => _error = 'PDF download failed (HTTP ${res.statusCode}).');
          return;
        }
        await file.writeAsBytes(res.bodyBytes, flush: true);
      }
      if (!mounted) return;
      setState(() {
        _localPath = file.path;
        _currentPage = book.progress?.currentPage ?? 0;
        _totalPages = book.totalPages;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() => _error = 'Could not open this PDF.');
    }
  }

  Future<void> _writeProgress({bool force = false}) async {
    final now = DateTime.now();
    if (!force && now.difference(_lastProgressWrite) < const Duration(seconds: 3)) return;
    _lastProgressWrite = now;
    if (_totalPages == 0) return;
    try {
      await ref.read(ebookServiceProvider).submitProgress(
            bookId: widget.bookId,
            currentPage: _currentPage,
            totalPages: _totalPages,
            completed: _totalPages > 0 && _currentPage >= _totalPages - 1,
          );
      // Backend bumps the reading streak on every progress write; refresh
      // the provider so the ebooks-screen badge reflects the new count.
      ref.invalidate(ebookReadingStreakProvider);
    } catch (_) {
      // Best-effort — a lost tick just delays the resume by 3 s.
    }
  }

  Future<void> _toggleBookmark() async {
    if (_busyBookmark) return;
    setState(() => _busyBookmark = true);
    try {
      await ref
          .read(ebookServiceProvider)
          .upsertBookmark(widget.bookId, pageNumber: _currentPage + 1);
      ref.invalidate(ebookBookmarksProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Bookmarked page ${_currentPage + 1}'),
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Bookmark failed.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busyBookmark = false);
    }
  }

  Future<void> _openHighlightSheet() async {
    // Sheet is manual-entry (page number + selected text + optional
    // note) because flutter_pdfview doesn't expose text selection —
    // native text-highlight overlay needs a PDF-library swap and is
    // tracked as a separate follow-up.
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _HighlightComposerSheet(
        bookId: widget.bookId,
        initialPage: _currentPage + 1,
        onSaved: () {
          ref.invalidate(bookHighlightsProvider(widget.bookId));
          ref.invalidate(myHighlightsProvider);
        },
      ),
    );
  }

  Future<void> _openHighlightsPanel() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _HighlightsPanel(
        bookId: widget.bookId,
        onChanged: () {
          ref.invalidate(bookHighlightsProvider(widget.bookId));
          ref.invalidate(myHighlightsProvider);
        },
      ),
    );
  }

  @override
  void dispose() {
    // Flush final progress before the screen disappears.
    unawaited(_writeProgress(force: true));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        foregroundColor: Colors.white,
        title: Text(
          _totalPages > 0 ? 'Page ${_currentPage + 1} / $_totalPages' : 'Reader',
          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            tooltip: 'View highlights',
            icon: const Icon(Icons.format_quote_rounded, color: Colors.white),
            onPressed: _openHighlightsPanel,
          ),
          IconButton(
            tooltip: 'Add highlight / note',
            icon: const Icon(Icons.edit_note_rounded, color: Colors.white),
            onPressed: _openHighlightSheet,
          ),
          IconButton(
            tooltip: 'Bookmark',
            icon: _busyBookmark
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: kColorAccent),
                  )
                : const Icon(Icons.bookmark_add_outlined, color: Colors.white),
            onPressed: _toggleBookmark,
          ),
        ],
      ),
      body: _error != null
          ? _ErrorState(message: _error!)
          : _localPath == null
              ? const AppLoader.center()
              : PDFView(
                  filePath: _localPath!,
                  autoSpacing: true,
                  enableSwipe: true,
                  swipeHorizontal: false,
                  pageFling: true,
                  fitPolicy: FitPolicy.WIDTH,
                  defaultPage: _currentPage,
                  nightMode: false,
                  onRender: (pages) {
                    if (pages != null && pages > 0) {
                      setState(() => _totalPages = pages);
                    }
                  },
                  onPageChanged: (page, total) {
                    if (page == null) return;
                    setState(() {
                      _currentPage = page;
                      if (total != null && total > 0) _totalPages = total;
                    });
                    unawaited(_writeProgress());
                  },
                  onError: (err) {
                    setState(() => _error = 'PDF failed to render.');
                  },
                ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: TextStyle(color: context.tokens.textSecondary, fontSize: 14, height: 1.4),
        ),
      ),
    );
  }
}

// Manual-entry highlight composer. Not tied to real text selection in
// the PDF — see the note on _openHighlightSheet in the parent screen.
class _HighlightComposerSheet extends ConsumerStatefulWidget {
  const _HighlightComposerSheet({
    required this.bookId,
    required this.initialPage,
    required this.onSaved,
  });
  final String bookId;
  final int initialPage;
  final VoidCallback onSaved;

  @override
  ConsumerState<_HighlightComposerSheet> createState() =>
      _HighlightComposerSheetState();
}

class _HighlightComposerSheetState
    extends ConsumerState<_HighlightComposerSheet> {
  final _pageCtl = TextEditingController();
  final _textCtl = TextEditingController();
  final _noteCtl = TextEditingController();
  String _color = 'yellow';
  bool _saving = false;

  static const _colors = <String, Color>{
    'yellow': Color(0xFFFFD54F),
    'green': Color(0xFF81C784),
    'pink': Color(0xFFF48FB1),
    'blue': Color(0xFF64B5F6),
  };

  @override
  void initState() {
    super.initState();
    _pageCtl.text = widget.initialPage.toString();
  }

  @override
  void dispose() {
    _pageCtl.dispose();
    _textCtl.dispose();
    _noteCtl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final page = int.tryParse(_pageCtl.text.trim());
    final text = _textCtl.text.trim();
    if (page == null || page < 1) {
      _snack('Enter a valid page number.');
      return;
    }
    if (text.isEmpty) {
      _snack('Highlight text is required.');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(ebookServiceProvider).createHighlight(
            bookId: widget.bookId,
            pageNumber: page,
            selectedText: text,
            highlightColor: _color,
            notes: _noteCtl.text.trim(),
          );
      if (!mounted) return;
      widget.onSaved();
      Navigator.of(context).pop();
      _snack('Highlight saved');
    } catch (_) {
      _snack('Could not save highlight');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
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
                  color: tokens.borderCard,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              'Add highlight',
              style: TextStyle(
                color: tokens.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                SizedBox(
                  width: 90,
                  child: TextField(
                    controller: _pageCtl,
                    keyboardType: TextInputType.number,
                    style: TextStyle(color: tokens.textPrimary),
                    decoration: const InputDecoration(
                      labelText: 'Page',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Wrap(
                    spacing: 8,
                    children: _colors.entries
                        .map(
                          (e) => GestureDetector(
                            onTap: () => setState(() => _color = e.key),
                            child: Container(
                              width: 28,
                              height: 28,
                              decoration: BoxDecoration(
                                color: e.value,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: _color == e.key
                                      ? tokens.textPrimary
                                      : Colors.transparent,
                                  width: 2,
                                ),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _textCtl,
              maxLines: 4,
              minLines: 3,
              style: TextStyle(color: tokens.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Highlight text',
                hintText: 'Type or paste the passage you want to keep.',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _noteCtl,
              maxLines: 2,
              minLines: 1,
              style: TextStyle(color: tokens.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Your note (optional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: _saving ? null : () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Highlights panel — view, delete existing highlights
// ─────────────────────────────────────────────────────────────────────────────

class _HighlightsPanel extends ConsumerStatefulWidget {
  const _HighlightsPanel({
    required this.bookId,
    required this.onChanged,
  });
  final String bookId;
  final VoidCallback onChanged;

  @override
  ConsumerState<_HighlightsPanel> createState() => _HighlightsPanelState();
}

class _HighlightsPanelState extends ConsumerState<_HighlightsPanel> {
  static const _colorMap = <String, Color>{
    'yellow': Color(0xFFFFD54F),
    'green': Color(0xFF81C784),
    'pink': Color(0xFFF48FB1),
    'blue': Color(0xFF64B5F6),
  };

  Future<void> _delete(EbookHighlight highlight) async {
    try {
      await ref.read(ebookServiceProvider).deleteHighlight(highlight.id);
      ref.invalidate(bookHighlightsProvider(widget.bookId));
      ref.invalidate(myHighlightsProvider);
      widget.onChanged();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Highlight deleted.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not delete highlight.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final highlightsAsync = ref.watch(bookHighlightsProvider(widget.bookId));

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (_, scrollCtl) => Container(
        decoration: BoxDecoration(
          color: tokens.bgSurface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Drag handle + header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Column(
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 14),
                      decoration: BoxDecoration(
                        color: tokens.borderCard,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      Text(
                        'My Highlights',
                        style: TextStyle(
                          color: tokens.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const Spacer(),
                      highlightsAsync.whenOrNull(
                        data: (list) => Text(
                          '${list.length}',
                          style: TextStyle(color: tokens.textMuted, fontSize: 14),
                        ),
                      ) ?? const SizedBox.shrink(),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: highlightsAsync.when(
                loading: () => const AppLoader.center(),
                error: (_, __) => Center(
                  child: Text(
                    'Could not load highlights.',
                    style: TextStyle(color: tokens.textMuted, fontSize: 14),
                  ),
                ),
                data: (highlights) => highlights.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(32),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.format_quote_rounded,
                                size: 48,
                                color: tokens.textMuted,
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'No highlights yet.',
                                style: TextStyle(
                                  color: tokens.textSecondary,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Tap the pencil icon to save a passage.',
                                style: TextStyle(color: tokens.textMuted, fontSize: 13),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView.separated(
                        controller: scrollCtl,
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        itemCount: highlights.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) {
                          final h = highlights[i];
                          final accent =
                              _colorMap[h.highlightColor] ?? const Color(0xFFFFD54F);
                          return Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: tokens.bgPage,
                              borderRadius: BorderRadius.circular(8),
                              border: Border(
                                left: BorderSide(color: accent, width: 3),
                              ),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Icon(
                                            Icons.menu_book_outlined,
                                            size: 12,
                                            color: tokens.textMuted,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            'Page ${h.pageNumber}',
                                            style: TextStyle(
                                              color: tokens.textMuted,
                                              fontSize: 11,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        h.selectedText,
                                        style: TextStyle(
                                          color: tokens.textPrimary,
                                          fontSize: 13,
                                          height: 1.4,
                                        ),
                                      ),
                                      if (h.notes != null && h.notes!.isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        Text(
                                          h.notes!,
                                          style: TextStyle(
                                            color: tokens.textSecondary,
                                            fontSize: 12,
                                            fontStyle: FontStyle.italic,
                                            height: 1.35,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: Icon(Icons.close, size: 18, color: tokens.textMuted),
                                  tooltip: 'Delete highlight',
                                  onPressed: () => _delete(h),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

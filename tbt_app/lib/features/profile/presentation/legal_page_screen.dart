import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/theme_tokens.dart';
import '../data/profile_extras_service.dart';

/// Read-only viewer for Terms & Conditions / Privacy Policy.
///
/// Loads the markdown body from `/api/pub/legal/:slug` and renders a
/// simple markdown-lite pass: `# heading`, `## sub-heading`, `- bullet`,
/// blank line = paragraph break. Deliberately does NOT pull a full
/// markdown package — legal copy is plain and the parser stays local.
class LegalPageScreen extends ConsumerWidget {
  const LegalPageScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final async = ref.watch(legalPageProvider(slug));
    return Scaffold(
      backgroundColor: tokens.bgPage,
      appBar: AppBar(
        backgroundColor: tokens.bgSurface,
        elevation: 0,
        title: Text(
          async.valueOrNull?.title ??
              (slug == 'terms' ? 'Terms & Conditions' : 'Privacy Policy'),
          style: TextStyle(
            fontFamily: 'Rajdhani',
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: tokens.textPrimary,
          ),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Could not load this page. Please try again.',
              style: TextStyle(color: tokens.textSecondary),
              textAlign: TextAlign.center,
            ),
          ),
        ),
        data: (page) => SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
          child: _LegalBody(markdown: page.bodyMarkdown),
        ),
      ),
    );
  }
}

class _LegalBody extends StatelessWidget {
  const _LegalBody({required this.markdown});
  final String markdown;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final blocks = <Widget>[];
    for (final rawLine in markdown.split('\n')) {
      final line = rawLine.trimRight();
      if (line.isEmpty) {
        blocks.add(const SizedBox(height: 10));
        continue;
      }
      if (line.startsWith('## ')) {
        blocks.add(Padding(
          padding: const EdgeInsets.only(top: 14, bottom: 6),
          child: Text(
            line.substring(3),
            style: TextStyle(
              color: tokens.textPrimary,
              fontFamily: 'Rajdhani',
              fontSize: 15,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
            ),
          ),
        ));
      } else if (line.startsWith('# ')) {
        blocks.add(Padding(
          padding: const EdgeInsets.only(top: 16, bottom: 8),
          child: Text(
            line.substring(2),
            style: TextStyle(
              color: tokens.textPrimary,
              fontFamily: 'Rajdhani',
              fontSize: 18,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
            ),
          ),
        ));
      } else if (line.startsWith('- ')) {
        blocks.add(Padding(
          padding: const EdgeInsets.only(left: 6, bottom: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('•  ',
                  style: TextStyle(
                      color: tokens.textSecondary, fontSize: 14, height: 1.5)),
              Expanded(
                child: Text(
                  line.substring(2),
                  style: TextStyle(
                    color: tokens.textPrimary,
                    fontSize: 13.5,
                    height: 1.5,
                  ),
                ),
              ),
            ],
          ),
        ));
      } else {
        blocks.add(Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Text(
            line,
            style: TextStyle(
              color: tokens.textPrimary,
              fontSize: 13.5,
              height: 1.5,
            ),
          ),
        ));
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: blocks,
    );
  }
}

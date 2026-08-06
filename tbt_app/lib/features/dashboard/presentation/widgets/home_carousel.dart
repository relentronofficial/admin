import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../shared/theme/design_constants.dart';
import '../../../../shared/theme/theme_tokens.dart';
import '../../providers/home_hero_provider.dart';
import '../../../tbt/data/catalog_service.dart';

/// Home mentor poster card + carousel — direct port of the co-worker's
/// `_buildMentorPosterCard` (main.dart:3861–4097).
///
/// Behavior:
///   * When [homeHeroProvider] returns non-empty slides → renders those.
///   * When it returns empty (or errors) → renders 2 hardcoded fallback
///     slides so the mentor card is never blank.
///   * Auto-advances every 4 s (matches co-worker's `_carouselTimer`).
///   * Overlays a [_BlinkingShareButton] top-right that shares the
///     current slide's title + subtitle.
class HomeCarousel extends ConsumerStatefulWidget {
  const HomeCarousel({super.key});

  @override
  ConsumerState<HomeCarousel> createState() => _HomeCarouselState();
}

class _HomeCarouselState extends ConsumerState<HomeCarousel> {
  static const _initialPage = 1000;
  final _pageController = PageController(initialPage: _initialPage);
  Timer? _timer;
  int _index = 0;
  int _slideCount = 0;

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _ensureAutoPlay(int slideCount) {
    if (_slideCount == slideCount) return;
    _slideCount = slideCount;
    _timer?.cancel();
    if (slideCount < 2) return;
    _timer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || !_pageController.hasClients) return;
      _pageController.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeIn,
      );
    });
  }

  void _shareCurrent(List<_Slide> slides) {
    if (slides.isEmpty) return;
    final slide = slides[_index % slides.length];
    final text = slide.description == null || slide.description!.isEmpty
        ? '${slide.title}\n\n${slide.subtitle ?? ""}'
        : '${slide.title}\n\n${slide.subtitle ?? ""}\n\n${slide.description}';
    Share.share(text.trim(), subject: slide.title);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(homeHeroProvider);
    final slides = async.when(
      loading: () => const <_Slide>[],
      error: (_, __) => _fallbackSlides,
      data: (hero) =>
          hero.slides.isEmpty ? _fallbackSlides : hero.slides.map(_Slide.fromHero).toList(),
    );

    if (async.isLoading) {
      return Container(
        width: double.infinity,
        height: 200,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          color: context.tokens.bgSurface,
        ),
        child: const Center(
          child: CircularProgressIndicator(color: Color(0xFFCC0000)),
        ),
      );
    }

    _ensureAutoPlay(slides.length);

    return Column(
      children: [
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: context.tokens.borderCard, width: 1.5),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(22.5),
            child: AspectRatio(
              aspectRatio: 1.6,
              child: Stack(
                children: [
                  PageView.builder(
                    controller: _pageController,
                    onPageChanged: (i) =>
                        setState(() => _index = i % slides.length),
                    itemBuilder: (context, i) => _SlideView(
                      slide: slides[i % slides.length],
                    ),
                  ),
                  Positioned(
                    top: 16,
                    right: 16,
                    child: _BlinkingShareButton(
                      onTap: () => _shareCurrent(slides),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (slides.length > 1) ...[
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(slides.length, (i) {
              final active = i == _index;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                width: active ? 18 : 6,
                height: 4,
                decoration: BoxDecoration(
                  color: active ? kColorAccent : const Color(0xFF48484A),
                  borderRadius: BorderRadius.circular(2),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }
}

// ── Internal slide model (unifies HeroSlide + fallback map) ────────

class _Slide {
  const _Slide({
    required this.title,
    this.subtitle,
    this.description,
    this.buttonText,
    this.buttonLink,
    this.mediaUrl,
    this.isAsset = false,
  });

  final String title;
  final String? subtitle;
  final String? description;
  final String? buttonText;
  final String? buttonLink;
  final String? mediaUrl;
  final bool isAsset;

  factory _Slide.fromHero(HeroSlide s) => _Slide(
        title: s.title,
        subtitle: s.description,
        buttonText: s.ctaLabel,
        buttonLink: s.ctaUrl,
        mediaUrl: s.bgImageUrl,
      );
}

const List<_Slide> _fallbackSlides = [
  _Slide(
    title: 'Tamil Business Tribe',
    subtitle: 'Tamil Business Tribe - Guide. Inspire. Empower.',
    mediaUrl: 'assets/images/whatsapp_image.jpeg',
    isAsset: true,
  ),
  _Slide(
    title: 'TBT Quote of the Day',
    subtitle:
        '"To get something you never had, you have to do something you never did."\n\n- Tamil Business Tribe Mentor Quote',
    mediaUrl: 'assets/images/tbt_2.jpeg',
    isAsset: true,
  ),
];

// ── Single slide renderer ──────────────────────────────────────────

class _SlideView extends StatelessWidget {
  const _SlideView({required this.slide});
  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    Widget media;
    if (slide.mediaUrl == null || slide.mediaUrl!.isEmpty) {
      media = Container(color: const Color(0xFF0F0F11));
    } else if (slide.isAsset) {
      media = Image.asset(
        slide.mediaUrl!,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Container(color: context.tokens.bgSurface),
      );
    } else {
      media = CachedNetworkImage(
        imageUrl: slide.mediaUrl!,
        fit: BoxFit.cover,
        placeholder: (_, __) => Container(color: context.tokens.bgSurface),
        errorWidget: (_, __, ___) => Container(
          color: const Color(0xFF0F0F11),
          alignment: Alignment.center,
          child: const Icon(Icons.broken_image, color: Colors.white24, size: 40),
        ),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        media,
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withValues(alpha: 0.15),
                Colors.black.withValues(alpha: 0.85),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text(
                slide.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 2),
              if (slide.subtitle != null && slide.subtitle!.isNotEmpty)
                Text(
                  slide.subtitle!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              if (slide.description != null && slide.description!.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  slide.description!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontSize: 10,
                  ),
                ),
              ],
              if (slide.buttonText != null && slide.buttonText!.isNotEmpty) ...[
                const SizedBox(height: 6),
                SizedBox(
                  height: 28,
                  child: ElevatedButton(
                    onPressed: () {
                      final link = slide.buttonLink ?? '';
                      if (link.isNotEmpty && link.startsWith('/')) {
                        GoRouter.of(context).push(link);
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFCC0000),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                    child: Text(
                      slide.buttonText!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

// ── Blinking share button ──────────────────────────────────────────
// Direct port of co-worker's `BlinkingShareButton` (main.dart:5166).
// Continuous 1500 ms opacity loop (0.5 ↔ 1.0).

class _BlinkingShareButton extends StatefulWidget {
  const _BlinkingShareButton({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_BlinkingShareButton> createState() => _BlinkingShareButtonState();
}

class _BlinkingShareButtonState extends State<_BlinkingShareButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _opacity = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: FadeTransition(
        opacity: _opacity,
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.black.withValues(alpha: 0.4),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.3),
              width: 1,
            ),
          ),
          child: const Icon(Icons.ios_share, color: Colors.white, size: 16),
        ),
      ),
    );
  }
}

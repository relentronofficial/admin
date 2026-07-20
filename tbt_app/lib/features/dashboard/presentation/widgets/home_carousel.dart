import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/theme/design_constants.dart';
import '../../../../shared/theme/theme_tokens.dart';
import '../../providers/home_hero_provider.dart';
import '../../../tbt/data/catalog_service.dart';

/// Auto-advancing carousel of hero slides — matches the co-worker's
/// home_carousel widget shape. Reuses our existing hero_slides data
/// (no new backend). PageView with 5-second auto-advance timer,
/// dot indicators below, tap → navigate to the slide's CTA target.
class HomeCarousel extends ConsumerStatefulWidget {
  const HomeCarousel({super.key});

  @override
  ConsumerState<HomeCarousel> createState() => _HomeCarouselState();
}

class _HomeCarouselState extends ConsumerState<HomeCarousel> {
  final _pageController = PageController(viewportFraction: 0.94);
  Timer? _timer;
  int _index = 0;

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _startAutoPlay(int intervalMs, int slideCount) {
    _timer?.cancel();
    if (slideCount < 2) return;
    _timer = Timer.periodic(Duration(milliseconds: intervalMs), (_) {
      if (!mounted || !_pageController.hasClients) return;
      final next = (_index + 1) % slideCount;
      _pageController.animateToPage(
        next,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(homeHeroProvider);
    return async.when(
      loading: () => const SizedBox(height: 180),
      error: (_, __) => const SizedBox.shrink(),
      data: (hero) {
        if (hero.slides.isEmpty) return const SizedBox.shrink();
        _startAutoPlay(hero.autoPlayIntervalMs, hero.slides.length);
        return Column(
          children: [
            SizedBox(
              height: 180,
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (i) => setState(() => _index = i),
                itemCount: hero.slides.length,
                itemBuilder: (ctx, i) => _CarouselSlide(slide: hero.slides[i]),
              ),
            ),
            if (hero.slides.length > 1) ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(hero.slides.length, (i) {
                  final active = i == _index;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: active ? 20 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: active ? kColorAccent : context.tokens.borderCard,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  );
                }),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _CarouselSlide extends StatelessWidget {
  const _CarouselSlide({required this.slide});
  final HeroSlide slide;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () {
            if (slide.ctaUrl.isEmpty) return;
            if (slide.ctaType == 'internal') {
              GoRouter.of(context).push(slide.ctaUrl);
            }
          },
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (slide.bgImageUrl != null && slide.bgImageUrl!.isNotEmpty)
                CachedNetworkImage(imageUrl: slide.bgImageUrl!, fit: BoxFit.cover)
              else
                Container(color: kColorBgSurface),
              // Bottom-half dark gradient scrim so title stays legible on any image
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.85),
                    ],
                    stops: const [0.3, 1.0],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (slide.badgeText != null && slide.badgeText!.isNotEmpty)
                      Container(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: kColorAccent.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          slide.badgeText!.toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    Text(
                      slide.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        height: 1.2,
                      ),
                    ),
                    if (slide.description != null && slide.description!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          slide.description!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 12,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

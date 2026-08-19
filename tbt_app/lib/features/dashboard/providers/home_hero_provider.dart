import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../tbt/data/catalog_service.dart';

/// Reuses the existing hero_slides endpoint (kUserHomeHero) for the
/// dashboard's home carousel — no new backend needed. Same slides
/// admins already curate for the catalog screen.
final homeHeroProvider = FutureProvider<HeroData>((ref) async {
  return ref.watch(catalogServiceProvider).getHeroContent();
});

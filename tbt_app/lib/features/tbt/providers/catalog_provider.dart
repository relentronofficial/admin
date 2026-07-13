import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../shared/models/content_section.dart';
import '../data/catalog_service.dart';

part 'catalog_provider.g.dart';

@riverpod
Future<HeroData> hero(Ref ref) =>
    ref.watch(catalogServiceProvider).getHeroContent();

@riverpod
Future<List<ContentSection>> catalogSections(Ref ref) =>
    ref.watch(catalogServiceProvider).getHomeSections();

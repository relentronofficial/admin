import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/resources_service.dart';

part 'resources_provider.g.dart';

@riverpod
Future<List<AppResource>> resources(Ref ref) =>
    ref.watch(resourcesFeatureServiceProvider).listResources();

/// Search-scoped variant. Plain FutureProvider.family because codegen
/// (`@riverpod`) is blocked by the pubspec Dart SDK pin.
final searchedResourcesProvider =
    FutureProvider.autoDispose.family<List<AppResource>, String>(
  (ref, query) =>
      ref.watch(resourcesFeatureServiceProvider).listResources(
            search: query.isEmpty ? null : query,
          ),
);

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/podcast_service.dart';
import '../domain/podcast_models.dart';

// ── Categories ────────────────────────────────────────────────────
final podcastCategoriesProvider =
    FutureProvider.autoDispose<List<PodcastCategory>>((ref) async {
  ref.keepAlive();
  return ref.watch(podcastServiceProvider).listCategories();
});

// ── Episodes (filtered by category slug + search) ────────────────
final selectedCategorySlugProvider = StateProvider<String?>((_) => null);
final episodeSearchProvider = StateProvider<String>((_) => '');

final podcastEpisodesProvider =
    FutureProvider.autoDispose<List<PodcastEpisode>>((ref) async {
  final slug = ref.watch(selectedCategorySlugProvider);
  final search = ref.watch(episodeSearchProvider);
  final result = await ref.watch(podcastServiceProvider).listEpisodes(
        page: 1,
        limit: 50,
        category: slug,
        search: search.isEmpty ? null : search,
      );
  return result.episodes;
});

// ── Featured series ──────────────────────────────────────────────
final featuredSeriesProvider =
    FutureProvider.autoDispose<List<PodcastSeries>>((ref) async {
  ref.keepAlive();
  return ref.watch(podcastServiceProvider).listFeaturedSeries();
});

// ── Series detail ────────────────────────────────────────────────
final seriesDetailProvider = FutureProvider.autoDispose
    .family<({PodcastSeries series, List<PodcastEpisode> episodes}), String>(
        (ref, id) async {
  return ref.watch(podcastServiceProvider).getSeries(id);
});

// ── Single episode ───────────────────────────────────────────────
final episodeDetailProvider =
    FutureProvider.autoDispose.family<PodcastEpisode, String>((ref, id) async {
  return ref.watch(podcastServiceProvider).getEpisode(id);
});

// ── Continue listening ───────────────────────────────────────────
final continueListeningProvider =
    FutureProvider.autoDispose<List<ContinueListeningItem>>((ref) async {
  return ref.watch(podcastServiceProvider).continueListening();
});

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/support_service.dart';
import '../domain/support_models.dart';

final helpdeskSettingsProvider =
    FutureProvider.autoDispose<HelpdeskSettings?>((ref) async {
  ref.keepAlive();
  return ref.watch(supportServiceProvider).getSettings();
});

final supportCategoriesProvider =
    FutureProvider.autoDispose<List<SupportCategory>>((ref) async {
  ref.keepAlive();
  return ref.watch(supportServiceProvider).listCategories();
});

final selectedFaqCategoryProvider = StateProvider<String?>((_) => null);
final faqSearchProvider = StateProvider<String>((_) => '');

final faqsProvider = FutureProvider.autoDispose<List<Faq>>((ref) async {
  final category = ref.watch(selectedFaqCategoryProvider);
  final search = ref.watch(faqSearchProvider);
  return ref.watch(supportServiceProvider).listFaqs(
        categoryId: category,
        search: search.isEmpty ? null : search,
      );
});

final myTicketsProvider =
    FutureProvider.autoDispose<List<SupportTicket>>((ref) async {
  return ref.watch(supportServiceProvider).myTickets();
});

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

/// Family provider for a single FAQ id — used by SupportScreen when
/// opened with a `focusFaqId` deep-link so the target FAQ can be scrolled
/// into view / expanded even if it doesn't appear in the first page of
/// the standard list.
final faqByIdProvider =
    FutureProvider.autoDispose.family<Faq?, String>((ref, id) async {
  return ref.watch(supportServiceProvider).getFaqById(id);
});

/// Single ticket + reply thread. Family-keyed by ticket id.
/// `autoDispose` so the thread state is dropped when the detail screen
/// closes, and re-fetched fresh on the next open (so a new admin reply
/// isn't stale).
final ticketDetailProvider =
    FutureProvider.autoDispose.family<SupportTicket?, String>((ref, id) async {
  return ref.watch(supportServiceProvider).getMyTicketDetail(id);
});

/// Which status the My Tickets filter tabs are currently showing.
/// `'all'` shows everything; otherwise matches one of the four ticket
/// statuses.
final myTicketsFilterProvider = StateProvider<String>((_) => 'all');

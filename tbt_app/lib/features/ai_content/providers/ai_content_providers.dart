import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/ai_content_service.dart';
import '../domain/ai_models.dart';

/// Riverpod providers for the AI Content Buddy feature.
///
/// Hand-written (no codegen) to match the leaner feature folders in
/// this app — this way the feature can be added without rerunning
/// build_runner. Auto-dispose so switching screens releases in-flight
/// requests; keep-alive is applied where a screen typically pops back
/// (e.g. the current-conversation cache).

// ── Conversations list ─────────────────────────────────────────────
final aiConversationsSearchProvider = StateProvider<String>((_) => '');

final aiConversationsProvider =
    FutureProvider.autoDispose<List<AIConversation>>((ref) async {
  final search = ref.watch(aiConversationsSearchProvider);
  return ref.watch(aiContentServiceProvider).listConversations(search: search);
});

// ── Active conversation ────────────────────────────────────────────
/// The conversation the chat screen is currently focused on. `null`
/// = a fresh conversation that hasn't been created yet.
final activeConversationIdProvider = StateProvider<String?>((_) => null);

/// Messages for the active conversation. Family keyed so switching
/// conversations refetches cleanly; keepAlive so scrolling back to a
/// list and returning doesn't re-hit the network.
final aiMessagesProvider = FutureProvider.autoDispose
    .family<List<AIMessage>, String>((ref, conversationId) async {
  ref.keepAlive();
  return ref.watch(aiContentServiceProvider).getMessages(conversationId);
});

// ── Saved content ──────────────────────────────────────────────────
final savedCategoryFilterProvider = StateProvider<String?>((_) => null);
final savedSearchProvider = StateProvider<String>((_) => '');

final savedContentProvider =
    FutureProvider.autoDispose<List<SavedAIContent>>((ref) async {
  final category = ref.watch(savedCategoryFilterProvider);
  final search = ref.watch(savedSearchProvider);
  return ref
      .watch(aiContentServiceProvider)
      .listSaved(category: category, search: search);
});

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../shared/models/workshop.dart';
import '../../../shared/providers/socket_provider.dart';
import '../../../shared/socket/socket_events.dart';
import '../data/workshops_service.dart';

part 'workshops_provider.g.dart';

// ── Workshop list (all — backend returns full list at once) ───────────────────

@riverpod
Future<List<Workshop>> workshops(Ref ref) =>
    ref.read(workshopsServiceProvider).listWorkshops();

// ── Workshop detail (family, auto-dispose) ─────────────────────────────────────

@riverpod
Future<WorkshopDetail> workshopDetail(Ref ref, String slug) =>
    ref.read(workshopsServiceProvider).getWorkshopDetail(slug);

// ── Workshop flow (family, auto-dispose) ───────────────────────────────────────

@riverpod
Future<List<FlowItem>> workshopFlow(Ref ref, String slug) =>
    ref.read(workshopsServiceProvider).getWorkshopFlow(slug);

// ── Workshop Q&A (family, auto-dispose) ───────────────────────────────────────

@riverpod
Future<WorkshopQaData> workshopQa(Ref ref, String slug) =>
    ref.read(workshopsServiceProvider).getWorkshopQa(slug);

// ── Workshop assignments (family, auto-dispose) ────────────────────────────────

@riverpod
Future<List<AssignmentGroup>> workshopAssignments(Ref ref, String slug) =>
    ref.read(workshopsServiceProvider).getWorkshopAssignments(slug);

// ── Workshop enrollment event handler (keepAlive) ─────────────────────────────

/// Listens for `workshop:enrolled` and `workshop:removed` socket events and
/// invalidates [workshopsProvider] so the list refreshes automatically.
@Riverpod(keepAlive: true)
void workshopEventHandler(Ref ref) {
  final socket = ref.read(socketNotifierProvider.notifier);
  void handler(dynamic _) => ref.invalidate(workshopsProvider);
  socket.on(kSocketWorkshopEnrolled, handler);
  socket.on(kSocketWorkshopRemoved, handler);
  ref.onDispose(() {
    socket.off(kSocketWorkshopEnrolled, handler);
    socket.off(kSocketWorkshopRemoved, handler);
  });
}

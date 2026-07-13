import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/events_service.dart';

part 'events_provider.g.dart';

@riverpod
Future<List<TbtEvent>> events(Ref ref) =>
    ref.watch(eventsFeatureServiceProvider).listEvents();

@riverpod
Future<TbtEvent> event(Ref ref, String id) =>
    ref.watch(eventsFeatureServiceProvider).getEvent(id);

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/webinars_service.dart';

part 'webinars_provider.g.dart';

@riverpod
Future<List<TbtWebinar>> webinars(Ref ref) =>
    ref.watch(webinarsServiceProvider).listWebinars();

@riverpod
Future<TbtWebinar> webinar(Ref ref, String id) =>
    ref.watch(webinarsServiceProvider).getWebinar(id);

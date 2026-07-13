import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/programs_service.dart';

part 'programs_provider.g.dart';

@riverpod
Future<List<TbtProgram>> programs(Ref ref) =>
    ref.watch(programsFeatureServiceProvider).listPrograms();

@riverpod
Future<TbtProgramDetail> programDetail(Ref ref, String id) =>
    ref.watch(programsFeatureServiceProvider).getProgram(id);

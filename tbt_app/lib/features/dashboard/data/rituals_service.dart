import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';

/// Data for the Morning Ritual home-page widget.

class Habit {
  const Habit({
    required this.id,
    required this.icon,
    required this.rawQuestion,
    required this.highlightWord,
    required this.subtitle,
  });
  final String id;
  final String icon;
  final String rawQuestion;
  final String highlightWord;
  final String subtitle;

  factory Habit.fromJson(Map<String, dynamic> j) => Habit(
        id: j['id'] as String,
        icon: (j['icon'] as String?) ?? 'fa-sun',
        rawQuestion: j['rawQuestion'] as String,
        highlightWord: (j['highlightWord'] as String?) ?? '',
        subtitle: (j['subtitle'] as String?) ?? '',
      );
}

class ButtonsConfig {
  const ButtonsConfig({required this.yesLabel, required this.notYetLabel});
  final String yesLabel;
  final String notYetLabel;
  factory ButtonsConfig.fromJson(Map<String, dynamic> j) => ButtonsConfig(
        yesLabel: (j['yesLabel'] as String?) ?? 'Yes',
        notYetLabel: (j['notYetLabel'] as String?) ?? 'Not Yet',
      );
}

class RitualsService {
  const RitualsService(this._dio);
  final Dio _dio;

  Future<List<Habit>> listHabits() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kRitualHabits);
      final list = (res.data?['data'] as List<dynamic>?) ?? const [];
      return list.cast<Map<String, dynamic>>().map(Habit.fromJson).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<ButtonsConfig> getButtonsConfig() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kRitualButtons);
      final data = res.data?['data'] as Map<String, dynamic>?;
      if (data == null) return const ButtonsConfig(yesLabel: 'Yes', notYetLabel: 'Not Yet');
      return ButtonsConfig.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final ritualsServiceProvider = Provider<RitualsService>(
  (ref) => RitualsService(ref.watch(dioProvider)),
);

final habitsProvider = FutureProvider.autoDispose<List<Habit>>((ref) async {
  ref.keepAlive();
  return ref.watch(ritualsServiceProvider).listHabits();
});

final buttonsConfigProvider = FutureProvider.autoDispose<ButtonsConfig>((ref) async {
  ref.keepAlive();
  return ref.watch(ritualsServiceProvider).getButtonsConfig();
});

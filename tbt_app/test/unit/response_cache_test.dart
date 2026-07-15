import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:tbt_app/shared/cache/response_cache.dart';

/// In-memory path provider so Hive can write to a temp directory in
/// the test environment (path_provider's real implementation calls
/// through to the platform channel, which isn't available here).
class _MemoryPathProvider extends PathProviderPlatform with MockPlatformInterfaceMixin {
  final String _tempDir;
  _MemoryPathProvider(this._tempDir);
  @override
  Future<String?> getApplicationDocumentsPath() async => _tempDir;
  @override
  Future<String?> getApplicationSupportPath() async => _tempDir;
  @override
  Future<String?> getTemporaryPath() async => _tempDir;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    // Hive writes to a real filesystem path; give it a unique dir per
    // test session and let PathProviderPlatform serve it.
    final tempDir = Directory.systemTemp.createTempSync('tbt_cache_test_');
    PathProviderPlatform.instance = _MemoryPathProvider(tempDir.path);
    await ResponseCache.init();
  });

  setUp(() async {
    await ResponseCache.clear();
  });

  group('ResponseCache', () {
    test('read returns null for missing key', () {
      expect(ResponseCache.read('missing:key'), isNull);
      expect(ResponseCache.readPayload('missing:key'), isNull);
    });

    test('write then read round-trips the payload', () async {
      await ResponseCache.write('dashboard:stats', {
        'coursesEnrolled': 3,
        'points': 420,
      });

      final payload = ResponseCache.readPayload('dashboard:stats');
      expect(payload, isNotNull);
      expect(payload!['coursesEnrolled'], 3);
      expect(payload['points'], 420);
    });

    test('write stamps savedAt so freshness can be computed', () async {
      final before = DateTime.now().millisecondsSinceEpoch;
      await ResponseCache.write('k', {'x': 1});
      final after = DateTime.now().millisecondsSinceEpoch;

      final wrapped = ResponseCache.read('k');
      final savedAt = wrapped!['savedAt'] as int;
      expect(savedAt, greaterThanOrEqualTo(before));
      expect(savedAt, lessThanOrEqualTo(after));
      expect(ResponseCache.isFresh('k'), isTrue);
    });

    test('isFresh returns false for missing entries', () {
      expect(ResponseCache.isFresh('never-written'), isFalse);
    });

    test('evict removes a single key without touching others', () async {
      await ResponseCache.write('a', {'v': 1});
      await ResponseCache.write('b', {'v': 2});

      await ResponseCache.evict('a');

      expect(ResponseCache.read('a'), isNull);
      expect(ResponseCache.readPayload('b'), {'v': 2});
    });

    test('clear removes everything (used on sign-out)', () async {
      await ResponseCache.write('a', {'v': 1});
      await ResponseCache.write('b', {'v': 2});

      await ResponseCache.clear();

      expect(ResponseCache.read('a'), isNull);
      expect(ResponseCache.read('b'), isNull);
    });

    test('read tolerates corrupt entries (evicts silently)', () async {
      // Bypass the class API and write junk directly through Hive so
      // we simulate on-disk corruption (e.g. a partial write from a
      // previous crash).
      final box = Hive.box<String>('tbt_response_cache');
      await box.put('corrupt', 'not valid json {{{');

      expect(ResponseCache.read('corrupt'), isNull);
      // After the failed read, the entry should have been evicted so
      // we don't keep tripping over the same corruption on every read.
      expect(box.get('corrupt'), isNull);
    });
  });
}

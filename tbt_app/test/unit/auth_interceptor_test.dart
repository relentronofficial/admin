import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tbt_app/core/constants/storage_keys.dart';
import 'package:tbt_app/shared/api/auth_interceptor.dart';

class _MockHandler extends Mock implements RequestInterceptorHandler {}

// In-memory substitute for FlutterSecureStorage used via method channel mocking.
final Map<String, String?> _store = {};

const _kSecureStorageChannel =
    MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

void _mockSecureStorage() {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(_kSecureStorageChannel, (call) async {
    final args = call.arguments as Map;
    final key = args['key'] as String?;
    switch (call.method) {
      case 'read':
        return _store[key];
      case 'write':
        if (key != null) _store[key] = args['value'] as String?;
        return null;
      case 'delete':
        _store.remove(key);
        return null;
      default:
        return null;
    }
  });
}

void _clearSecureStorageMock() {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(_kSecureStorageChannel, null);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
    registerFallbackValue(
        DioException(requestOptions: RequestOptions(path: '')));
  });

  setUp(() {
    _store.clear();
    _mockSecureStorage();
  });

  tearDown(_clearSecureStorageMock);

  group('AuthInterceptor.onRequest', () {
    test('injects tbt_access cookie when token is stored', () async {
      _store[kSecureAccessToken] = 'tok_abc123';

      final interceptor = AuthInterceptor();
      final opts = RequestOptions(path: '/api/user/me');
      final handler = _MockHandler();

      await interceptor.onRequest(opts, handler);

      expect(opts.headers['Cookie'], 'tbt_access=tok_abc123');
    });

    test('does not set Cookie header when no token is stored', () async {
      // _store is empty

      final interceptor = AuthInterceptor();
      final opts = RequestOptions(path: '/api/user/me');
      final handler = _MockHandler();

      await interceptor.onRequest(opts, handler);

      expect(opts.headers.containsKey('Cookie'), isFalse);
    });

    test('always calls handler.next regardless of token state', () async {
      final interceptor = AuthInterceptor();
      final opts = RequestOptions(path: '/api/user/me');
      final handler = _MockHandler();

      await interceptor.onRequest(opts, handler);

      verify(() => handler.next(any())).called(1);
      verifyNever(() => handler.reject(any()));
    });

    test('does not crash when token is null', () async {
      final interceptor = AuthInterceptor();
      final opts = RequestOptions(path: '/api/user/me');
      final handler = _MockHandler();

      expect(
        () async => interceptor.onRequest(opts, handler),
        returnsNormally,
      );
    });

    test('token value is reflected exactly in Cookie header', () async {
      const expected = 'eyJhbGciOiJIUzI1NiJ9.payload.sig';
      _store[kSecureAccessToken] = expected;

      final interceptor = AuthInterceptor();
      final opts = RequestOptions(path: '/api/user/dashboard/stats');
      final handler = _MockHandler();

      await interceptor.onRequest(opts, handler);

      expect(opts.headers['Cookie'], 'tbt_access=$expected');
    });
  });
}

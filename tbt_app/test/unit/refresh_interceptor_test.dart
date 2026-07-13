import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tbt_app/core/constants/api.dart';
import 'package:tbt_app/core/constants/storage_keys.dart';
import 'package:tbt_app/shared/api/refresh_interceptor.dart';

class _MockDio extends Mock implements Dio {}

class _MockErrorHandler extends Mock implements ErrorInterceptorHandler {}

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

DioException _make401(String path) => DioException(
      requestOptions: RequestOptions(path: path),
      response: Response(
        requestOptions: RequestOptions(path: path),
        statusCode: 401,
      ),
      type: DioExceptionType.badResponse,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _MockDio mockDio;
  late _MockErrorHandler handler;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
    registerFallbackValue(Options());
    registerFallbackValue(
        Response<dynamic>(requestOptions: RequestOptions(path: '')));
    registerFallbackValue(DioException(requestOptions: RequestOptions(path: '')));
  });

  setUp(() {
    mockDio = _MockDio();
    handler = _MockErrorHandler();
    _store.clear();
    _mockSecureStorage();
  });

  tearDown(_clearSecureStorageMock);

  group('RefreshInterceptor.onError', () {
    test('passes non-401 errors through without refreshing', () async {
      final interceptor = RefreshInterceptor(mockDio);
      final err = DioException(
        requestOptions: RequestOptions(path: '/api/user/me'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/user/me'),
          statusCode: 500,
        ),
        type: DioExceptionType.badResponse,
      );

      await interceptor.onError(err, handler);

      verifyNever(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options')));
      verify(() => handler.next(err)).called(1);
    });

    test('passes 401 on /api/user-auth/ paths through without refreshing',
        () async {
      final interceptor = RefreshInterceptor(mockDio);
      final err = _make401('/api/user-auth/login');

      await interceptor.onError(err, handler);

      verifyNever(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options')));
      verify(() => handler.next(err)).called(1);
    });

    test('passes 401 on /api/user-auth/refresh through without refreshing',
        () async {
      final interceptor = RefreshInterceptor(mockDio);
      final err = _make401(kAuthRefresh);

      await interceptor.onError(err, handler);

      verifyNever(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options')));
      verify(() => handler.next(err)).called(1);
    });

    test('passes error through when refresh token is absent', () async {
      // _store has no refresh token
      final interceptor = RefreshInterceptor(mockDio);
      final err = _make401('/api/user/me');

      await interceptor.onError(err, handler);

      verifyNever(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options')));
      verify(() => handler.next(err)).called(1);
    });

    test('refreshes token and retries original request on 401', () async {
      _store[kSecureRefreshToken] = 'refresh_tok';

      final refreshOpts = RequestOptions(path: kAuthRefresh);
      when(() => mockDio.post<dynamic>(
            any(),
            options: any(named: 'options'),
          )).thenAnswer((_) async => Response<dynamic>(
            requestOptions: refreshOpts,
            statusCode: 200,
            headers: Headers.fromMap({
              'set-cookie': [
                'tbt_access=new_access; Path=/; HttpOnly',
                'tbt_refresh=new_refresh; Path=/; HttpOnly',
              ],
            }),
          ));

      final retriedOpts = RequestOptions(path: '/api/user/me');
      when(() => mockDio.fetch<dynamic>(any())).thenAnswer((_) async =>
          Response<dynamic>(
            requestOptions: retriedOpts,
            statusCode: 200,
          ));

      final interceptor = RefreshInterceptor(mockDio);
      final err = _make401('/api/user/me');

      await interceptor.onError(err, handler);

      verify(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options'))).called(1);
      verify(() => mockDio.fetch<dynamic>(any())).called(1);
      verify(() => handler.resolve(any())).called(1);
      verifyNever(() => handler.next(any()));
    });

    test('writes new tokens to storage after successful refresh', () async {
      _store[kSecureRefreshToken] = 'old_refresh';

      final refreshOpts = RequestOptions(path: kAuthRefresh);
      when(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options'))).thenAnswer((_) async =>
          Response<dynamic>(
            requestOptions: refreshOpts,
            statusCode: 200,
            headers: Headers.fromMap({
              'set-cookie': [
                'tbt_access=saved_access; Path=/; HttpOnly',
                'tbt_refresh=saved_refresh; Path=/; HttpOnly',
              ],
            }),
          ));

      when(() => mockDio.fetch<dynamic>(any())).thenAnswer((_) async =>
          Response<dynamic>(
            requestOptions: RequestOptions(path: '/api/user/me'),
            statusCode: 200,
          ));

      final interceptor = RefreshInterceptor(mockDio);
      await interceptor.onError(_make401('/api/user/me'), handler);

      expect(_store[kSecureAccessToken], 'saved_access');
      expect(_store[kSecureRefreshToken], 'saved_refresh');
    });

    test('clears tokens and passes error when refresh call throws', () async {
      _store[kSecureAccessToken] = 'old_access';
      _store[kSecureRefreshToken] = 'old_refresh';

      when(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options'))).thenThrow(DioException(
        requestOptions: RequestOptions(path: kAuthRefresh),
        type: DioExceptionType.connectionError,
      ));

      final interceptor = RefreshInterceptor(mockDio);
      await interceptor.onError(_make401('/api/user/me'), handler);

      expect(_store[kSecureAccessToken], isNull);
      expect(_store[kSecureRefreshToken], isNull);
      verify(() => handler.next(any())).called(1);
      verifyNever(() => handler.resolve(any()));
    });
  });
}

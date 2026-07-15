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

    // ── Session-preservation rule ────────────────────────────────────
    // Only 401/403 from the refresh endpoint itself may wipe tokens.
    // Every other failure (network, timeout, 5xx) is transient — the
    // refresh token is still valid on the server, so keeping the local
    // copy lets the very next request try again once the wire calms
    // down. Regression tests below lock this contract in place.
    //
    // Background: an older `catch (_) => clearAll()` was silently
    // signing users out on any transient hiccup. Fixed 2026-07-15.

    test('keeps tokens on transient connectionError from refresh', () async {
      _store[kSecureAccessToken] = 'access_before';
      _store[kSecureRefreshToken] = 'refresh_before';

      when(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options'))).thenThrow(DioException(
        requestOptions: RequestOptions(path: kAuthRefresh),
        type: DioExceptionType.connectionError,
      ));

      final interceptor = RefreshInterceptor(mockDio);
      await interceptor.onError(_make401('/api/user/me'), handler);

      expect(_store[kSecureAccessToken], 'access_before',
          reason: 'connection error must not wipe access token');
      expect(_store[kSecureRefreshToken], 'refresh_before',
          reason: 'connection error must not wipe refresh token');
      verify(() => handler.next(any())).called(1);
      verifyNever(() => handler.resolve(any()));
    });

    test('keeps tokens on 5xx from refresh (server hiccup)', () async {
      _store[kSecureAccessToken] = 'access_before';
      _store[kSecureRefreshToken] = 'refresh_before';

      when(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options'))).thenThrow(DioException(
        requestOptions: RequestOptions(path: kAuthRefresh),
        response: Response(
          requestOptions: RequestOptions(path: kAuthRefresh),
          statusCode: 503,
        ),
        type: DioExceptionType.badResponse,
      ));

      final interceptor = RefreshInterceptor(mockDio);
      await interceptor.onError(_make401('/api/user/me'), handler);

      expect(_store[kSecureAccessToken], 'access_before',
          reason: '503 must not wipe access token');
      expect(_store[kSecureRefreshToken], 'refresh_before',
          reason: '503 must not wipe refresh token');
    });

    test('keeps tokens on receiveTimeout from refresh', () async {
      _store[kSecureAccessToken] = 'access_before';
      _store[kSecureRefreshToken] = 'refresh_before';

      when(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options'))).thenThrow(DioException(
        requestOptions: RequestOptions(path: kAuthRefresh),
        type: DioExceptionType.receiveTimeout,
      ));

      final interceptor = RefreshInterceptor(mockDio);
      await interceptor.onError(_make401('/api/user/me'), handler);

      expect(_store[kSecureAccessToken], 'access_before');
      expect(_store[kSecureRefreshToken], 'refresh_before');
    });

    test('wipes tokens ONLY when refresh returns 401', () async {
      _store[kSecureAccessToken] = 'access_before';
      _store[kSecureRefreshToken] = 'refresh_before';

      when(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options'))).thenThrow(DioException(
        requestOptions: RequestOptions(path: kAuthRefresh),
        response: Response(
          requestOptions: RequestOptions(path: kAuthRefresh),
          statusCode: 401,
        ),
        type: DioExceptionType.badResponse,
      ));

      final interceptor = RefreshInterceptor(mockDio);
      await interceptor.onError(_make401('/api/user/me'), handler);

      expect(_store[kSecureAccessToken], isNull,
          reason: 'refresh-401 explicitly means "your refresh token is dead"');
      expect(_store[kSecureRefreshToken], isNull);
    });

    test('wipes tokens ONLY when refresh returns 403', () async {
      _store[kSecureAccessToken] = 'access_before';
      _store[kSecureRefreshToken] = 'refresh_before';

      when(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options'))).thenThrow(DioException(
        requestOptions: RequestOptions(path: kAuthRefresh),
        response: Response(
          requestOptions: RequestOptions(path: kAuthRefresh),
          statusCode: 403,
        ),
        type: DioExceptionType.badResponse,
      ));

      final interceptor = RefreshInterceptor(mockDio);
      await interceptor.onError(_make401('/api/user/me'), handler);

      expect(_store[kSecureAccessToken], isNull);
      expect(_store[kSecureRefreshToken], isNull);
    });

    test('keeps tokens on non-Dio programmer error during refresh', () async {
      _store[kSecureAccessToken] = 'access_before';
      _store[kSecureRefreshToken] = 'refresh_before';

      when(() => mockDio.post<dynamic>(any(),
          options: any(named: 'options'))).thenThrow(StateError('boom'));

      final interceptor = RefreshInterceptor(mockDio);
      await interceptor.onError(_make401('/api/user/me'), handler);

      expect(_store[kSecureAccessToken], 'access_before',
          reason: 'Non-Dio errors are treated as transient — programmer bug '
              'should never silently sign users out');
      expect(_store[kSecureRefreshToken], 'refresh_before');
    });
  });
}

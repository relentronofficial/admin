// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'courses_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$coursesHash() => r'65373b12447c7efc09c5f20e8c8525a24c0065ed';

/// See also [courses].
@ProviderFor(courses)
final coursesProvider = AutoDisposeFutureProvider<List<Course>>.internal(
  courses,
  name: r'coursesProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$coursesHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef CoursesRef = AutoDisposeFutureProviderRef<List<Course>>;
String _$courseDetailHash() => r'1185d26685653cf68eb0bb5663130fcc311769f0';

/// Copied from Dart SDK
class _SystemHash {
  _SystemHash._();

  static int combine(int hash, int value) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + value);
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x0007ffff & hash) << 10));
    return hash ^ (hash >> 6);
  }

  static int finish(int hash) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x03ffffff & hash) << 3));
    // ignore: parameter_assignments
    hash = hash ^ (hash >> 11);
    return 0x1fffffff & (hash + ((0x00003fff & hash) << 15));
  }
}

/// See also [courseDetail].
@ProviderFor(courseDetail)
const courseDetailProvider = CourseDetailFamily();

/// See also [courseDetail].
class CourseDetailFamily extends Family<AsyncValue<CourseDetail>> {
  /// See also [courseDetail].
  const CourseDetailFamily();

  /// See also [courseDetail].
  CourseDetailProvider call(String courseId) {
    return CourseDetailProvider(courseId);
  }

  @override
  CourseDetailProvider getProviderOverride(
    covariant CourseDetailProvider provider,
  ) {
    return call(provider.courseId);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'courseDetailProvider';
}

/// See also [courseDetail].
class CourseDetailProvider extends AutoDisposeFutureProvider<CourseDetail> {
  /// See also [courseDetail].
  CourseDetailProvider(String courseId)
    : this._internal(
        (ref) => courseDetail(ref as CourseDetailRef, courseId),
        from: courseDetailProvider,
        name: r'courseDetailProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$courseDetailHash,
        dependencies: CourseDetailFamily._dependencies,
        allTransitiveDependencies:
            CourseDetailFamily._allTransitiveDependencies,
        courseId: courseId,
      );

  CourseDetailProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.courseId,
  }) : super.internal();

  final String courseId;

  @override
  Override overrideWith(
    FutureOr<CourseDetail> Function(CourseDetailRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: CourseDetailProvider._internal(
        (ref) => create(ref as CourseDetailRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        courseId: courseId,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<CourseDetail> createElement() {
    return _CourseDetailProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is CourseDetailProvider && other.courseId == courseId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, courseId.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin CourseDetailRef on AutoDisposeFutureProviderRef<CourseDetail> {
  /// The parameter `courseId` of this provider.
  String get courseId;
}

class _CourseDetailProviderElement
    extends AutoDisposeFutureProviderElement<CourseDetail>
    with CourseDetailRef {
  _CourseDetailProviderElement(super.provider);

  @override
  String get courseId => (origin as CourseDetailProvider).courseId;
}

String _$lessonProgressHash() => r'1a5ab24580ef37a774b4c757cfbfa82e64ee8768';

/// See also [lessonProgress].
@ProviderFor(lessonProgress)
const lessonProgressProvider = LessonProgressFamily();

/// See also [lessonProgress].
class LessonProgressFamily extends Family<AsyncValue<List<LessonProgress>>> {
  /// See also [lessonProgress].
  const LessonProgressFamily();

  /// See also [lessonProgress].
  LessonProgressProvider call(String courseId) {
    return LessonProgressProvider(courseId);
  }

  @override
  LessonProgressProvider getProviderOverride(
    covariant LessonProgressProvider provider,
  ) {
    return call(provider.courseId);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'lessonProgressProvider';
}

/// See also [lessonProgress].
class LessonProgressProvider
    extends AutoDisposeFutureProvider<List<LessonProgress>> {
  /// See also [lessonProgress].
  LessonProgressProvider(String courseId)
    : this._internal(
        (ref) => lessonProgress(ref as LessonProgressRef, courseId),
        from: lessonProgressProvider,
        name: r'lessonProgressProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$lessonProgressHash,
        dependencies: LessonProgressFamily._dependencies,
        allTransitiveDependencies:
            LessonProgressFamily._allTransitiveDependencies,
        courseId: courseId,
      );

  LessonProgressProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.courseId,
  }) : super.internal();

  final String courseId;

  @override
  Override overrideWith(
    FutureOr<List<LessonProgress>> Function(LessonProgressRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: LessonProgressProvider._internal(
        (ref) => create(ref as LessonProgressRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        courseId: courseId,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<List<LessonProgress>> createElement() {
    return _LessonProgressProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is LessonProgressProvider && other.courseId == courseId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, courseId.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin LessonProgressRef on AutoDisposeFutureProviderRef<List<LessonProgress>> {
  /// The parameter `courseId` of this provider.
  String get courseId;
}

class _LessonProgressProviderElement
    extends AutoDisposeFutureProviderElement<List<LessonProgress>>
    with LessonProgressRef {
  _LessonProgressProviderElement(super.provider);

  @override
  String get courseId => (origin as LessonProgressProvider).courseId;
}

String _$myEnrollmentsHash() => r'c926a3ec723e343985013593412938d12cce4e5e';

/// See also [myEnrollments].
@ProviderFor(myEnrollments)
final myEnrollmentsProvider = FutureProvider<List<CourseEnrollment>>.internal(
  myEnrollments,
  name: r'myEnrollmentsProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$myEnrollmentsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef MyEnrollmentsRef = FutureProviderRef<List<CourseEnrollment>>;
String _$courseLeaderboardHash() => r'a2c4d9419838c94aa5204dd80081141d5f9129f7';

/// See also [courseLeaderboard].
@ProviderFor(courseLeaderboard)
const courseLeaderboardProvider = CourseLeaderboardFamily();

/// See also [courseLeaderboard].
class CourseLeaderboardFamily extends Family<AsyncValue<CourseLeaderboard>> {
  /// See also [courseLeaderboard].
  const CourseLeaderboardFamily();

  /// See also [courseLeaderboard].
  CourseLeaderboardProvider call(String courseId) {
    return CourseLeaderboardProvider(courseId);
  }

  @override
  CourseLeaderboardProvider getProviderOverride(
    covariant CourseLeaderboardProvider provider,
  ) {
    return call(provider.courseId);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'courseLeaderboardProvider';
}

/// See also [courseLeaderboard].
class CourseLeaderboardProvider
    extends AutoDisposeFutureProvider<CourseLeaderboard> {
  /// See also [courseLeaderboard].
  CourseLeaderboardProvider(String courseId)
    : this._internal(
        (ref) => courseLeaderboard(ref as CourseLeaderboardRef, courseId),
        from: courseLeaderboardProvider,
        name: r'courseLeaderboardProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$courseLeaderboardHash,
        dependencies: CourseLeaderboardFamily._dependencies,
        allTransitiveDependencies:
            CourseLeaderboardFamily._allTransitiveDependencies,
        courseId: courseId,
      );

  CourseLeaderboardProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.courseId,
  }) : super.internal();

  final String courseId;

  @override
  Override overrideWith(
    FutureOr<CourseLeaderboard> Function(CourseLeaderboardRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: CourseLeaderboardProvider._internal(
        (ref) => create(ref as CourseLeaderboardRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        courseId: courseId,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<CourseLeaderboard> createElement() {
    return _CourseLeaderboardProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is CourseLeaderboardProvider && other.courseId == courseId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, courseId.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin CourseLeaderboardRef on AutoDisposeFutureProviderRef<CourseLeaderboard> {
  /// The parameter `courseId` of this provider.
  String get courseId;
}

class _CourseLeaderboardProviderElement
    extends AutoDisposeFutureProviderElement<CourseLeaderboard>
    with CourseLeaderboardRef {
  _CourseLeaderboardProviderElement(super.provider);

  @override
  String get courseId => (origin as CourseLeaderboardProvider).courseId;
}

String _$earnedBadgesHash() => r'dbd4de377d54a96c1854fce6f492df0e4e361fc9';

/// See also [earnedBadges].
@ProviderFor(earnedBadges)
final earnedBadgesProvider = FutureProvider<List<EarnedBadge>>.internal(
  earnedBadges,
  name: r'earnedBadgesProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$earnedBadgesHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef EarnedBadgesRef = FutureProviderRef<List<EarnedBadge>>;
String _$certEligibilityHash() => r'a9ae26d2372b1f489e48a34a8582a309fbb86bd3';

/// See also [certEligibility].
@ProviderFor(certEligibility)
const certEligibilityProvider = CertEligibilityFamily();

/// See also [certEligibility].
class CertEligibilityFamily extends Family<AsyncValue<CertEligibility>> {
  /// See also [certEligibility].
  const CertEligibilityFamily();

  /// See also [certEligibility].
  CertEligibilityProvider call(String courseId) {
    return CertEligibilityProvider(courseId);
  }

  @override
  CertEligibilityProvider getProviderOverride(
    covariant CertEligibilityProvider provider,
  ) {
    return call(provider.courseId);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'certEligibilityProvider';
}

/// See also [certEligibility].
class CertEligibilityProvider
    extends AutoDisposeFutureProvider<CertEligibility> {
  /// See also [certEligibility].
  CertEligibilityProvider(String courseId)
    : this._internal(
        (ref) => certEligibility(ref as CertEligibilityRef, courseId),
        from: certEligibilityProvider,
        name: r'certEligibilityProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$certEligibilityHash,
        dependencies: CertEligibilityFamily._dependencies,
        allTransitiveDependencies:
            CertEligibilityFamily._allTransitiveDependencies,
        courseId: courseId,
      );

  CertEligibilityProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.courseId,
  }) : super.internal();

  final String courseId;

  @override
  Override overrideWith(
    FutureOr<CertEligibility> Function(CertEligibilityRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: CertEligibilityProvider._internal(
        (ref) => create(ref as CertEligibilityRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        courseId: courseId,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<CertEligibility> createElement() {
    return _CertEligibilityProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is CertEligibilityProvider && other.courseId == courseId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, courseId.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin CertEligibilityRef on AutoDisposeFutureProviderRef<CertEligibility> {
  /// The parameter `courseId` of this provider.
  String get courseId;
}

class _CertEligibilityProviderElement
    extends AutoDisposeFutureProviderElement<CertEligibility>
    with CertEligibilityRef {
  _CertEligibilityProviderElement(super.provider);

  @override
  String get courseId => (origin as CertEligibilityProvider).courseId;
}

String _$learningCoursesHash() => r'0a72bb2249450bdaab2d2664c0a58c366ce15d36';

/// See also [learningCourses].
@ProviderFor(learningCourses)
final learningCoursesProvider = FutureProvider<List<CourseEnrollment>>.internal(
  learningCourses,
  name: r'learningCoursesProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$learningCoursesHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef LearningCoursesRef = FutureProviderRef<List<CourseEnrollment>>;
String _$courseAccessEventNotifierHash() =>
    r'ddce0446e0e84e69c2146a70c256e228965bb67c';

/// Holds the courseId from the most recent `course:access_granted` socket event.
/// Screens listen to this to show a SnackBar and the provider invalidates
/// [myEnrollmentsProvider] so the enrollments list refreshes automatically.
///
/// Copied from [CourseAccessEventNotifier].
@ProviderFor(CourseAccessEventNotifier)
final courseAccessEventNotifierProvider =
    NotifierProvider<CourseAccessEventNotifier, String?>.internal(
      CourseAccessEventNotifier.new,
      name: r'courseAccessEventNotifierProvider',
      debugGetCreateSourceHash:
          const bool.fromEnvironment('dart.vm.product')
              ? null
              : _$courseAccessEventNotifierHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$CourseAccessEventNotifier = Notifier<String?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'messages_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$conversationsHash() => r'668fbf432992ebdae3a7e32c2688d802a5f21c01';

/// See also [conversations].
@ProviderFor(conversations)
final conversationsProvider =
    AutoDisposeFutureProvider<List<Conversation>>.internal(
      conversations,
      name: r'conversationsProvider',
      debugGetCreateSourceHash:
          const bool.fromEnvironment('dart.vm.product')
              ? null
              : _$conversationsHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ConversationsRef = AutoDisposeFutureProviderRef<List<Conversation>>;
String _$unreadMessageCountNotifierHash() =>
    r'b1a9df47ea30d9287f618d7a8dcec290a2290572';

/// See also [UnreadMessageCountNotifier].
@ProviderFor(UnreadMessageCountNotifier)
final unreadMessageCountNotifierProvider =
    NotifierProvider<UnreadMessageCountNotifier, int>.internal(
      UnreadMessageCountNotifier.new,
      name: r'unreadMessageCountNotifierProvider',
      debugGetCreateSourceHash:
          const bool.fromEnvironment('dart.vm.product')
              ? null
              : _$unreadMessageCountNotifierHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$UnreadMessageCountNotifier = Notifier<int>;
String _$conversationMessagesHash() =>
    r'0e47c4d5455a52ea8a61c4a831eabdfe21d26b47';

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

abstract class _$ConversationMessages
    extends BuildlessAutoDisposeAsyncNotifier<List<ChatMessage>> {
  late final String conversationId;

  FutureOr<List<ChatMessage>> build(String conversationId);
}

/// See also [ConversationMessages].
@ProviderFor(ConversationMessages)
const conversationMessagesProvider = ConversationMessagesFamily();

/// See also [ConversationMessages].
class ConversationMessagesFamily extends Family<AsyncValue<List<ChatMessage>>> {
  /// See also [ConversationMessages].
  const ConversationMessagesFamily();

  /// See also [ConversationMessages].
  ConversationMessagesProvider call(String conversationId) {
    return ConversationMessagesProvider(conversationId);
  }

  @override
  ConversationMessagesProvider getProviderOverride(
    covariant ConversationMessagesProvider provider,
  ) {
    return call(provider.conversationId);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'conversationMessagesProvider';
}

/// See also [ConversationMessages].
class ConversationMessagesProvider
    extends
        AutoDisposeAsyncNotifierProviderImpl<
          ConversationMessages,
          List<ChatMessage>
        > {
  /// See also [ConversationMessages].
  ConversationMessagesProvider(String conversationId)
    : this._internal(
        () => ConversationMessages()..conversationId = conversationId,
        from: conversationMessagesProvider,
        name: r'conversationMessagesProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$conversationMessagesHash,
        dependencies: ConversationMessagesFamily._dependencies,
        allTransitiveDependencies:
            ConversationMessagesFamily._allTransitiveDependencies,
        conversationId: conversationId,
      );

  ConversationMessagesProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.conversationId,
  }) : super.internal();

  final String conversationId;

  @override
  FutureOr<List<ChatMessage>> runNotifierBuild(
    covariant ConversationMessages notifier,
  ) {
    return notifier.build(conversationId);
  }

  @override
  Override overrideWith(ConversationMessages Function() create) {
    return ProviderOverride(
      origin: this,
      override: ConversationMessagesProvider._internal(
        () => create()..conversationId = conversationId,
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        conversationId: conversationId,
      ),
    );
  }

  @override
  AutoDisposeAsyncNotifierProviderElement<
    ConversationMessages,
    List<ChatMessage>
  >
  createElement() {
    return _ConversationMessagesProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is ConversationMessagesProvider &&
        other.conversationId == conversationId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, conversationId.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin ConversationMessagesRef
    on AutoDisposeAsyncNotifierProviderRef<List<ChatMessage>> {
  /// The parameter `conversationId` of this provider.
  String get conversationId;
}

class _ConversationMessagesProviderElement
    extends
        AutoDisposeAsyncNotifierProviderElement<
          ConversationMessages,
          List<ChatMessage>
        >
    with ConversationMessagesRef {
  _ConversationMessagesProviderElement(super.provider);

  @override
  String get conversationId =>
      (origin as ConversationMessagesProvider).conversationId;
}

String _$conversationTypingNotifierHash() =>
    r'356e276f007b3161a74baa90ce2d01d487dec321';

abstract class _$ConversationTypingNotifier
    extends BuildlessAutoDisposeNotifier<bool> {
  late final String conversationId;

  bool build(String conversationId);
}

/// See also [ConversationTypingNotifier].
@ProviderFor(ConversationTypingNotifier)
const conversationTypingNotifierProvider = ConversationTypingNotifierFamily();

/// See also [ConversationTypingNotifier].
class ConversationTypingNotifierFamily extends Family<bool> {
  /// See also [ConversationTypingNotifier].
  const ConversationTypingNotifierFamily();

  /// See also [ConversationTypingNotifier].
  ConversationTypingNotifierProvider call(String conversationId) {
    return ConversationTypingNotifierProvider(conversationId);
  }

  @override
  ConversationTypingNotifierProvider getProviderOverride(
    covariant ConversationTypingNotifierProvider provider,
  ) {
    return call(provider.conversationId);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'conversationTypingNotifierProvider';
}

/// See also [ConversationTypingNotifier].
class ConversationTypingNotifierProvider
    extends AutoDisposeNotifierProviderImpl<ConversationTypingNotifier, bool> {
  /// See also [ConversationTypingNotifier].
  ConversationTypingNotifierProvider(String conversationId)
    : this._internal(
        () => ConversationTypingNotifier()..conversationId = conversationId,
        from: conversationTypingNotifierProvider,
        name: r'conversationTypingNotifierProvider',
        debugGetCreateSourceHash:
            const bool.fromEnvironment('dart.vm.product')
                ? null
                : _$conversationTypingNotifierHash,
        dependencies: ConversationTypingNotifierFamily._dependencies,
        allTransitiveDependencies:
            ConversationTypingNotifierFamily._allTransitiveDependencies,
        conversationId: conversationId,
      );

  ConversationTypingNotifierProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.conversationId,
  }) : super.internal();

  final String conversationId;

  @override
  bool runNotifierBuild(covariant ConversationTypingNotifier notifier) {
    return notifier.build(conversationId);
  }

  @override
  Override overrideWith(ConversationTypingNotifier Function() create) {
    return ProviderOverride(
      origin: this,
      override: ConversationTypingNotifierProvider._internal(
        () => create()..conversationId = conversationId,
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        conversationId: conversationId,
      ),
    );
  }

  @override
  AutoDisposeNotifierProviderElement<ConversationTypingNotifier, bool>
  createElement() {
    return _ConversationTypingNotifierProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is ConversationTypingNotifierProvider &&
        other.conversationId == conversationId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, conversationId.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin ConversationTypingNotifierRef on AutoDisposeNotifierProviderRef<bool> {
  /// The parameter `conversationId` of this provider.
  String get conversationId;
}

class _ConversationTypingNotifierProviderElement
    extends AutoDisposeNotifierProviderElement<ConversationTypingNotifier, bool>
    with ConversationTypingNotifierRef {
  _ConversationTypingNotifierProviderElement(super.provider);

  @override
  String get conversationId =>
      (origin as ConversationTypingNotifierProvider).conversationId;
}

// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package

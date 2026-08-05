// Plain-data models for the group chat feature (WhatsApp-inspired).
// Hand-written to match community/ and support/ — no Freezed / codegen.

class ChatGroup {
  const ChatGroup({
    required this.id,
    required this.name,
    required this.createdAt,
    required this.updatedAt,
    required this.lastMessageAt,
    this.avatarUrl,
    this.description,
    this.unreadCount = 0,
    this.lastMessage,
  });

  final String id;
  final String name;
  final String? avatarUrl;
  final String? description;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime lastMessageAt;
  final int unreadCount;
  final ChatGroupLastMessage? lastMessage;

  factory ChatGroup.fromJson(Map<String, dynamic> j) => ChatGroup(
        id: j['id'] as String,
        name: j['name'] as String,
        avatarUrl: j['avatarUrl'] as String?,
        description: j['description'] as String?,
        createdAt: DateTime.parse(j['createdAt'] as String),
        updatedAt: DateTime.parse(j['updatedAt'] as String),
        lastMessageAt: DateTime.parse(j['lastMessageAt'] as String),
        unreadCount: (j['unreadCount'] as int?) ?? 0,
        lastMessage: j['lastMessage'] != null
            ? ChatGroupLastMessage.fromJson(j['lastMessage'] as Map<String, dynamic>)
            : null,
      );
}

class ChatGroupLastMessage {
  const ChatGroupLastMessage({
    required this.body,
    required this.createdAt,
    this.senderName,
  });
  final String body;
  final DateTime createdAt;
  final String? senderName;
  factory ChatGroupLastMessage.fromJson(Map<String, dynamic> j) => ChatGroupLastMessage(
        body: j['body'] as String,
        createdAt: DateTime.parse(j['createdAt'] as String),
        senderName: j['senderName'] as String?,
      );
}

class ChatGroupMember {
  const ChatGroupMember({
    required this.id,
    this.firstName,
    this.lastName,
    this.profilePhotoUrl,
    this.businessName,
    this.role,
    this.joinedAt,
  });

  final String id;
  final String? firstName;
  final String? lastName;
  final String? profilePhotoUrl;
  final String? businessName;
  final String? role;
  final DateTime? joinedAt;

  String get displayName {
    final joined = [firstName, lastName]
        .whereType<String>()
        .where((s) => s.isNotEmpty)
        .join(' ')
        .trim();
    return joined.isEmpty ? 'Member' : joined;
  }

  factory ChatGroupMember.fromJson(Map<String, dynamic> j) => ChatGroupMember(
        id: j['id'] as String,
        firstName: j['firstName'] as String?,
        lastName: j['lastName'] as String?,
        profilePhotoUrl: j['profilePhotoUrl'] as String?,
        businessName: j['businessName'] as String?,
        role: j['role'] as String?,
        joinedAt: j['joinedAt'] != null ? DateTime.tryParse(j['joinedAt'] as String) : null,
      );
}

class ChatGroupDetail {
  const ChatGroupDetail({
    required this.id,
    required this.name,
    required this.createdAt,
    required this.updatedAt,
    required this.lastMessageAt,
    required this.members,
    this.avatarUrl,
    this.description,
  });

  final String id;
  final String name;
  final String? avatarUrl;
  final String? description;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime lastMessageAt;
  final List<ChatGroupMember> members;

  factory ChatGroupDetail.fromJson(Map<String, dynamic> j) => ChatGroupDetail(
        id: j['id'] as String,
        name: j['name'] as String,
        avatarUrl: j['avatarUrl'] as String?,
        description: j['description'] as String?,
        createdAt: DateTime.parse(j['createdAt'] as String),
        updatedAt: DateTime.parse(j['updatedAt'] as String),
        lastMessageAt: DateTime.parse(j['lastMessageAt'] as String),
        members: ((j['members'] as List<dynamic>?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(ChatGroupMember.fromJson)
            .toList(),
      );
}

/// Compact preview of a message this one is replying to.
class ChatGroupReplyPreview {
  const ChatGroupReplyPreview({
    required this.id,
    required this.deletedForEveryone,
    this.body,
    this.mediaType,
    this.senderName,
  });
  final String id;
  final String? body;
  final String? mediaType;
  final String? senderName;
  final bool deletedForEveryone;

  factory ChatGroupReplyPreview.fromJson(Map<String, dynamic> j) => ChatGroupReplyPreview(
        id: j['id'] as String,
        body: j['body'] as String?,
        mediaType: j['mediaType'] as String?,
        senderName: j['senderName'] as String?,
        deletedForEveryone: (j['deletedForEveryone'] as bool?) ?? false,
      );
}

class ChatGroupReaction {
  const ChatGroupReaction({required this.emoji, required this.memberId});
  final String emoji;
  final String memberId;
  factory ChatGroupReaction.fromJson(Map<String, dynamic> j) => ChatGroupReaction(
        emoji: j['emoji'] as String,
        memberId: j['memberId'] as String,
      );
}

class ChatGroupMessage {
  const ChatGroupMessage({
    required this.id,
    required this.groupId,
    required this.createdAt,
    required this.deletedForEveryone,
    required this.isSystem,
    this.senderMemberId,
    this.senderAdminId,
    this.body,
    this.mediaUrl,
    this.mediaType,
    this.replyToId,
    this.replyTo,
    this.editedAt,
    this.deletedAt,
    this.sender,
    this.reactions = const [],
    this.readByCount = 0,
    this.readByMemberIds = const [],
    this.mentionedMemberIds = const [],
  });

  final String id;
  final String groupId;
  final String? senderMemberId;
  final String? senderAdminId;
  final String? body;
  final String? mediaUrl;
  final String? mediaType;
  final String? replyToId;
  final ChatGroupReplyPreview? replyTo;
  final bool isSystem;
  final DateTime createdAt;
  final DateTime? editedAt;
  final DateTime? deletedAt;
  final bool deletedForEveryone;
  final ChatGroupMember? sender;
  final List<ChatGroupReaction> reactions;
  final int readByCount;
  final List<String> readByMemberIds;
  final List<String> mentionedMemberIds;

  bool get isDeleted => deletedForEveryone || deletedAt != null;

  ChatGroupMessage copyWith({
    String? body,
    DateTime? editedAt,
    DateTime? deletedAt,
    bool? deletedForEveryone,
    List<ChatGroupReaction>? reactions,
    int? readByCount,
    List<String>? readByMemberIds,
  }) {
    return ChatGroupMessage(
      id: id,
      groupId: groupId,
      senderMemberId: senderMemberId,
      senderAdminId: senderAdminId,
      body: body ?? this.body,
      mediaUrl: mediaUrl,
      mediaType: mediaType,
      replyToId: replyToId,
      replyTo: replyTo,
      isSystem: isSystem,
      createdAt: createdAt,
      editedAt: editedAt ?? this.editedAt,
      deletedAt: deletedAt ?? this.deletedAt,
      deletedForEveryone: deletedForEveryone ?? this.deletedForEveryone,
      sender: sender,
      reactions: reactions ?? this.reactions,
      readByCount: readByCount ?? this.readByCount,
      readByMemberIds: readByMemberIds ?? this.readByMemberIds,
      mentionedMemberIds: mentionedMemberIds,
    );
  }

  factory ChatGroupMessage.fromJson(Map<String, dynamic> j) => ChatGroupMessage(
        id: j['id'] as String,
        groupId: j['groupId'] as String,
        senderMemberId: j['senderMemberId'] as String?,
        senderAdminId: j['senderAdminId'] as String?,
        body: j['body'] as String?,
        mediaUrl: j['mediaUrl'] as String?,
        mediaType: j['mediaType'] as String?,
        replyToId: j['replyToId'] as String?,
        replyTo: j['replyTo'] != null
            ? ChatGroupReplyPreview.fromJson(j['replyTo'] as Map<String, dynamic>)
            : null,
        isSystem: (j['isSystem'] as bool?) ?? false,
        createdAt: DateTime.parse(j['createdAt'] as String),
        editedAt: j['editedAt'] != null ? DateTime.tryParse(j['editedAt'] as String) : null,
        deletedAt: j['deletedAt'] != null ? DateTime.tryParse(j['deletedAt'] as String) : null,
        deletedForEveryone: (j['deletedForEveryone'] as bool?) ?? false,
        sender: j['sender'] != null
            ? ChatGroupMember.fromJson(j['sender'] as Map<String, dynamic>)
            : null,
        reactions: ((j['reactions'] as List<dynamic>?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(ChatGroupReaction.fromJson)
            .toList(),
        readByCount: (j['readByCount'] as int?) ?? 0,
        readByMemberIds: ((j['readByMemberIds'] as List<dynamic>?) ?? const [])
            .whereType<String>()
            .toList(),
        mentionedMemberIds: ((j['mentionedMemberIds'] as List<dynamic>?) ?? const [])
            .whereType<String>()
            .toList(),
      );
}

class ChatGroupPresence {
  const ChatGroupPresence({
    required this.memberId,
    required this.online,
    this.lastSeenAt,
  });
  final String memberId;
  final bool online;
  final DateTime? lastSeenAt;
  factory ChatGroupPresence.fromJson(Map<String, dynamic> j) => ChatGroupPresence(
        memberId: j['memberId'] as String,
        online: (j['online'] as bool?) ?? false,
        lastSeenAt: j['lastSeenAt'] != null ? DateTime.tryParse(j['lastSeenAt'] as String) : null,
      );
}

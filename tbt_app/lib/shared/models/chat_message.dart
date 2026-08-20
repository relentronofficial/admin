// Plain-data model for DM (member ↔ admin support conversation) messages.
// Was Freezed; converted to hand-written to allow adding optional media +
// reply fields without a build_runner cycle. Matches the hand-written
// pattern used by chat_group_models.dart.

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.senderType,
    required this.senderId,
    required this.senderName,
    required this.body,
    required this.createdAt,
    this.senderAvatarUrl,
    this.mediaUrl,
    this.mediaType,
    this.replyToId,
    this.replyToBody,
    this.replyToSenderName,
  });

  final String id;
  final String senderType;
  final String senderId;
  final String senderName;
  final String? senderAvatarUrl;
  final String body;
  final String createdAt;

  // ── WhatsApp-parity extensions ──────────────────────────────────────────
  /// R2 (or Bunny) URL of an image/video/audio/document attachment.
  final String? mediaUrl;
  /// One of `image`, `video`, `audio`, `document`.
  final String? mediaType;
  /// ID of the message this one is replying to.
  final String? replyToId;
  /// Short preview of the parent message body (backend may embed).
  final String? replyToBody;
  final String? replyToSenderName;

  bool get hasMedia => mediaUrl != null && mediaUrl!.isNotEmpty;

  ChatMessage copyWith({
    String? body,
    String? mediaUrl,
    String? mediaType,
  }) =>
      ChatMessage(
        id: id,
        senderType: senderType,
        senderId: senderId,
        senderName: senderName,
        senderAvatarUrl: senderAvatarUrl,
        body: body ?? this.body,
        createdAt: createdAt,
        mediaUrl: mediaUrl ?? this.mediaUrl,
        mediaType: mediaType ?? this.mediaType,
        replyToId: replyToId,
        replyToBody: replyToBody,
        replyToSenderName: replyToSenderName,
      );

  factory ChatMessage.fromJson(Map<String, dynamic> j) {
    // Backend may return the reply preview under `replyTo` (matching the
    // group-chat shape) or as flat `replyToBody` / `replyToSenderName`.
    final replyTo = j['replyTo'] as Map<String, dynamic>?;
    return ChatMessage(
      id: j['id'] as String,
      senderType: (j['senderType'] as String?) ?? 'admin',
      senderId: (j['senderId'] as String?) ?? '',
      senderName: (j['senderName'] as String?) ?? 'TBT Team',
      senderAvatarUrl: j['senderAvatarUrl'] as String?,
      body: (j['body'] as String?) ?? '',
      createdAt: (j['createdAt'] as String?) ?? DateTime.now().toIso8601String(),
      mediaUrl: j['mediaUrl'] as String?,
      mediaType: j['mediaType'] as String?,
      replyToId: j['replyToId'] as String? ?? (replyTo?['id'] as String?),
      replyToBody: (j['replyToBody'] as String?) ??
          (replyTo?['body'] as String?),
      replyToSenderName: (j['replyToSenderName'] as String?) ??
          (replyTo?['senderName'] as String?),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'senderType': senderType,
        'senderId': senderId,
        'senderName': senderName,
        'senderAvatarUrl': senderAvatarUrl,
        'body': body,
        'createdAt': createdAt,
        if (mediaUrl != null) 'mediaUrl': mediaUrl,
        if (mediaType != null) 'mediaType': mediaType,
        if (replyToId != null) 'replyToId': replyToId,
        if (replyToBody != null) 'replyToBody': replyToBody,
        if (replyToSenderName != null) 'replyToSenderName': replyToSenderName,
      };
}

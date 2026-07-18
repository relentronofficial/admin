// Plain-data models for the AI Content Buddy feature.
//
// Kept as hand-written classes (no Freezed) — small enough that the
// codegen overhead isn't worth it, and consistent with the leaner
// modules in this app. If any of these ever need equality, copyWith,
// or JSON round-trips beyond what's here, promote them to Freezed.

class AIConversation {
  const AIConversation({
    required this.id,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String title;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory AIConversation.fromJson(Map<String, dynamic> json) => AIConversation(
        id: json['id'] as String,
        title: (json['title'] as String?) ?? 'New Conversation',
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
      );
}

class AIMessage {
  const AIMessage({
    required this.id,
    required this.conversationId,
    required this.sender,
    required this.message,
    required this.inputType,
    required this.createdAt,
    this.imageUrl,
    this.contentType,
    this.language,
    this.tone,
  });

  final String id;
  final String conversationId;
  final String sender; // 'user' | 'assistant'
  final String message;
  final String inputType; // 'text' | 'voice' | 'image'
  final String? imageUrl;
  final String? contentType;
  final String? language;
  final String? tone;
  final DateTime createdAt;

  bool get isUser => sender == 'user';

  factory AIMessage.fromJson(Map<String, dynamic> json) => AIMessage(
        id: json['id'] as String,
        conversationId: json['conversationId'] as String,
        sender: json['sender'] as String,
        message: json['message'] as String,
        inputType: json['inputType'] as String,
        imageUrl: json['imageUrl'] as String?,
        contentType: json['contentType'] as String?,
        language: json['language'] as String?,
        tone: json['tone'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class SavedAIContent {
  const SavedAIContent({
    required this.id,
    required this.title,
    required this.content,
    required this.category,
    required this.createdAt,
    this.conversationId,
  });

  final String id;
  final String title;
  final String content;
  final String category;
  final String? conversationId;
  final DateTime createdAt;

  factory SavedAIContent.fromJson(Map<String, dynamic> json) => SavedAIContent(
        id: json['id'] as String,
        title: json['title'] as String,
        content: json['content'] as String,
        category: (json['category'] as String?) ?? 'other',
        conversationId: json['conversationId'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

/// Result of a POST /content/create call. `title` is populated only
/// on the first turn of a conversation (backend generates one from
/// the reply, so the caller can update the sidebar without a refetch).
class AIGenerateResult {
  const AIGenerateResult({
    required this.conversationId,
    required this.messageId,
    required this.content,
    this.title,
    this.suggestions = const [],
  });

  final String conversationId;
  final String messageId;
  final String content;
  final String? title;
  final List<String> suggestions;

  factory AIGenerateResult.fromJson(Map<String, dynamic> json) =>
      AIGenerateResult(
        conversationId: json['conversationId'] as String,
        messageId: json['messageId'] as String,
        content: json['content'] as String,
        title: json['title'] as String?,
        suggestions: (json['suggestions'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
      );
}

/// Categories accepted by the backend `saved_ai_content.category`
/// CHECK constraint — MUST match `SAVED_CATEGORIES` in
/// backend/src/modules/ai/schema.ts.
const List<String> kSavedCategories = [
  'social_media',
  'advertisement',
  'business',
  'personal',
  'video_script',
  'email',
  'other',
];

String prettyCategory(String c) {
  switch (c) {
    case 'social_media':
      return 'Social Media';
    case 'advertisement':
      return 'Advertisement';
    case 'business':
      return 'Business';
    case 'personal':
      return 'Personal';
    case 'video_script':
      return 'Video Script';
    case 'email':
      return 'Email';
    default:
      return 'Other';
  }
}

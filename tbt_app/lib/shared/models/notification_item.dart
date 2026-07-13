import 'package:freezed_annotation/freezed_annotation.dart';

part 'notification_item.freezed.dart';
part 'notification_item.g.dart';

@freezed
class NotificationItem with _$NotificationItem {
  const factory NotificationItem({
    required String id,
    required String type,
    required String title,
    required String body,
    @JsonKey(name: 'data') Map<String, dynamic>? metadata,
    @Default(false) bool isRead,
    required String createdAt,
    String? actionUrl,
    String? iconType,
    String? mediaType,
    String? mediaUrl,
  }) = _NotificationItem;

  factory NotificationItem.fromJson(Map<String, dynamic> json) =>
      _$NotificationItemFromJson(json);
}

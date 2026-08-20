// Tests for all ChatGroup* model fromJson / computed-property / copyWith logic.
// Pure Dart — no Flutter SDK or network needed.
import 'package:flutter_test/flutter_test.dart';

import 'package:tbt_app/lib/features/chat_groups/domain/chat_group_models.dart';

void main() {
  // ── ChatGroupMember ────────────────────────────────────────────────────────

  group('ChatGroupMember', () {
    test('fromJson parses all fields', () {
      final m = ChatGroupMember.fromJson({
        'id': 'mem-1',
        'firstName': 'Arjun',
        'lastName': 'Kumar',
        'profilePhotoUrl': 'https://cdn.example/photo.jpg',
        'businessName': 'Arjun Traders',
        'role': 'admin',
        'joinedAt': '2024-01-15T10:00:00.000Z',
      });

      expect(m.id, 'mem-1');
      expect(m.firstName, 'Arjun');
      expect(m.lastName, 'Kumar');
      expect(m.profilePhotoUrl, 'https://cdn.example/photo.jpg');
      expect(m.businessName, 'Arjun Traders');
      expect(m.role, 'admin');
      expect(m.joinedAt, DateTime.parse('2024-01-15T10:00:00.000Z'));
    });

    test('displayName: full name when both parts present', () {
      final m = ChatGroupMember.fromJson(
          {'id': 'x', 'firstName': 'Arjun', 'lastName': 'Kumar'});
      expect(m.displayName, 'Arjun Kumar');
    });

    test('displayName: first only', () {
      final m = ChatGroupMember.fromJson({'id': 'x', 'firstName': 'Arjun'});
      expect(m.displayName, 'Arjun');
    });

    test('displayName: last only', () {
      final m =
          ChatGroupMember.fromJson({'id': 'x', 'lastName': 'Kumar'});
      expect(m.displayName, 'Kumar');
    });

    test('displayName: fallback Member when no name', () {
      final m = ChatGroupMember.fromJson({'id': 'x'});
      expect(m.displayName, 'Member');
    });

    test('displayName: ignores empty-string names', () {
      final m = ChatGroupMember.fromJson(
          {'id': 'x', 'firstName': '', 'lastName': ''});
      expect(m.displayName, 'Member');
    });
  });

  // ── ChatGroupLastMessage ───────────────────────────────────────────────────

  group('ChatGroupLastMessage', () {
    test('fromJson all fields', () {
      final msg = ChatGroupLastMessage.fromJson({
        'body': 'Hello group!',
        'createdAt': '2025-08-01T08:00:00.000Z',
        'senderName': 'Arjun',
      });
      expect(msg.body, 'Hello group!');
      expect(msg.senderName, 'Arjun');
    });

    test('fromJson: senderName nullable', () {
      final msg = ChatGroupLastMessage.fromJson(
          {'body': 'Hi', 'createdAt': '2025-08-01T08:00:00.000Z'});
      expect(msg.senderName, isNull);
    });
  });

  // ── ChatGroup ──────────────────────────────────────────────────────────────

  group('ChatGroup', () {
    const _ts = '2025-08-01T08:00:00.000Z';

    final _baseJson = {
      'id': 'grp-1',
      'name': 'TBT General',
      'createdAt': _ts,
      'updatedAt': _ts,
      'lastMessageAt': _ts,
    };

    test('fromJson minimal', () {
      final g = ChatGroup.fromJson(_baseJson);
      expect(g.id, 'grp-1');
      expect(g.name, 'TBT General');
      expect(g.avatarUrl, isNull);
      expect(g.description, isNull);
      expect(g.unreadCount, 0);
      expect(g.lastMessage, isNull);
    });

    test('fromJson with unreadCount and lastMessage', () {
      final g = ChatGroup.fromJson({
        ..._baseJson,
        'unreadCount': 5,
        'avatarUrl': 'https://cdn.example/avatar.jpg',
        'lastMessage': {
          'body': 'Hello!',
          'createdAt': _ts,
          'senderName': 'Priya',
        },
      });
      expect(g.unreadCount, 5);
      expect(g.avatarUrl, 'https://cdn.example/avatar.jpg');
      expect(g.lastMessage!.body, 'Hello!');
      expect(g.lastMessage!.senderName, 'Priya');
    });
  });

  // ── ChatGroupDetail ────────────────────────────────────────────────────────

  group('ChatGroupDetail', () {
    const _ts = '2025-08-01T08:00:00.000Z';

    test('fromJson with members and disappearingDurationSeconds', () {
      final d = ChatGroupDetail.fromJson({
        'id': 'grp-1',
        'name': 'TBT General',
        'createdAt': _ts,
        'updatedAt': _ts,
        'lastMessageAt': _ts,
        'disappearingDurationSeconds': 86400,
        'members': [
          {
            'id': 'mem-1',
            'firstName': 'Arjun',
            'lastName': 'Kumar',
            'role': 'admin',
          },
          {
            'id': 'mem-2',
            'firstName': 'Priya',
            'role': 'member',
          },
        ],
      });
      expect(d.id, 'grp-1');
      expect(d.disappearingDurationSeconds, 86400);
      expect(d.members.length, 2);
      expect(d.members[0].role, 'admin');
    });

    test('disappearingDurationSeconds null when not set', () {
      final d = ChatGroupDetail.fromJson({
        'id': 'grp-1',
        'name': 'TBT',
        'createdAt': _ts,
        'updatedAt': _ts,
        'lastMessageAt': _ts,
      });
      expect(d.disappearingDurationSeconds, isNull);
    });

    test('members defaults to empty list when key absent', () {
      final d = ChatGroupDetail.fromJson({
        'id': 'grp-1',
        'name': 'TBT',
        'createdAt': _ts,
        'updatedAt': _ts,
        'lastMessageAt': _ts,
      });
      expect(d.members, isEmpty);
    });
  });

  // ── ChatGroupReaction ──────────────────────────────────────────────────────

  group('ChatGroupReaction', () {
    test('fromJson all fields', () {
      final r = ChatGroupReaction.fromJson({
        'emoji': '👍',
        'memberId': 'mem-1',
        'memberName': 'Arjun',
        'profilePhotoUrl': 'https://cdn.example/photo.jpg',
      });
      expect(r.emoji, '👍');
      expect(r.memberId, 'mem-1');
      expect(r.memberName, 'Arjun');
      expect(r.profilePhotoUrl, 'https://cdn.example/photo.jpg');
    });

    test('memberName and profilePhotoUrl nullable', () {
      final r =
          ChatGroupReaction.fromJson({'emoji': '❤️', 'memberId': 'mem-2'});
      expect(r.memberName, isNull);
      expect(r.profilePhotoUrl, isNull);
    });
  });

  // ── ChatGroupLinkPreview ───────────────────────────────────────────────────

  group('ChatGroupLinkPreview', () {
    test('fromJson all fields', () {
      final lp = ChatGroupLinkPreview.fromJson({
        'url': 'https://example.com/article',
        'title': 'Test Article',
        'description': 'A test article',
        'imageUrl': 'https://cdn.example/img.jpg',
        'siteName': 'Example',
      });
      expect(lp.url, 'https://example.com/article');
      expect(lp.title, 'Test Article');
      expect(lp.siteName, 'Example');
    });

    test('optional fields nullable', () {
      final lp = ChatGroupLinkPreview.fromJson(
          {'url': 'https://example.com'});
      expect(lp.title, isNull);
      expect(lp.description, isNull);
      expect(lp.imageUrl, isNull);
      expect(lp.siteName, isNull);
    });
  });

  // ── ChatGroupReplyPreview ──────────────────────────────────────────────────

  group('ChatGroupReplyPreview', () {
    test('fromJson all fields', () {
      final rp = ChatGroupReplyPreview.fromJson({
        'id': 'msg-parent',
        'body': 'Original message',
        'mediaType': 'image',
        'senderName': 'Priya',
        'deletedForEveryone': false,
      });
      expect(rp.id, 'msg-parent');
      expect(rp.body, 'Original message');
      expect(rp.mediaType, 'image');
      expect(rp.senderName, 'Priya');
      expect(rp.deletedForEveryone, isFalse);
    });

    test('deletedForEveryone defaults false', () {
      final rp =
          ChatGroupReplyPreview.fromJson({'id': 'x', 'deletedForEveryone': null});
      expect(rp.deletedForEveryone, isFalse);
    });
  });

  // ── ChatGroupMessage ───────────────────────────────────────────────────────

  group('ChatGroupMessage', () {
    const _ts = '2025-08-01T08:00:00.000Z';

    Map<String, dynamic> _baseMsg({
      String id = 'msg-1',
      String groupId = 'grp-1',
    }) =>
        {
          'id': id,
          'groupId': groupId,
          'createdAt': _ts,
          'deletedForEveryone': false,
          'isSystem': false,
        };

    test('fromJson minimal fields', () {
      final msg = ChatGroupMessage.fromJson(_baseMsg());
      expect(msg.id, 'msg-1');
      expect(msg.groupId, 'grp-1');
      expect(msg.isDeleted, isFalse);
      expect(msg.isPinned, isFalse);
      expect(msg.isForwarded, isFalse);
      expect(msg.reactions, isEmpty);
      expect(msg.readByCount, 0);
      expect(msg.readByMemberIds, isEmpty);
      expect(msg.mentionedMemberIds, isEmpty);
    });

    test('isDeleted = true when deletedForEveryone', () {
      final msg = ChatGroupMessage.fromJson(
          {..._baseMsg(), 'deletedForEveryone': true});
      expect(msg.isDeleted, isTrue);
    });

    test('isDeleted = true when deletedAt is set', () {
      final msg = ChatGroupMessage.fromJson(
          {..._baseMsg(), 'deletedAt': _ts});
      expect(msg.isDeleted, isTrue);
    });

    test('isPinned when pinnedAt present', () {
      final msg =
          ChatGroupMessage.fromJson({..._baseMsg(), 'pinnedAt': _ts});
      expect(msg.isPinned, isTrue);
    });

    test('isForwarded when forwardedFromMessageId present', () {
      final msg = ChatGroupMessage.fromJson(
          {..._baseMsg(), 'forwardedFromMessageId': 'msg-orig'});
      expect(msg.isForwarded, isTrue);
    });

    test('fromJson parses sender, reactions, readBy, mentions', () {
      final msg = ChatGroupMessage.fromJson({
        ..._baseMsg(),
        'body': 'Hello @Arjun!',
        'senderMemberId': 'mem-1',
        'sender': {'id': 'mem-1', 'firstName': 'Priya'},
        'reactions': [
          {'emoji': '👍', 'memberId': 'mem-2'},
        ],
        'readByCount': 3,
        'readByMemberIds': ['mem-2', 'mem-3', 'mem-4'],
        'mentionedMemberIds': ['mem-1'],
      });
      expect(msg.body, 'Hello @Arjun!');
      expect(msg.sender?.firstName, 'Priya');
      expect(msg.reactions.length, 1);
      expect(msg.reactions[0].emoji, '👍');
      expect(msg.readByCount, 3);
      expect(msg.readByMemberIds, ['mem-2', 'mem-3', 'mem-4']);
      expect(msg.mentionedMemberIds, ['mem-1']);
    });

    test('fromJson parses linkPreview (F-06)', () {
      final msg = ChatGroupMessage.fromJson({
        ..._baseMsg(),
        'body': 'https://example.com',
        'linkPreview': {
          'url': 'https://example.com',
          'title': 'Example',
        },
      });
      expect(msg.linkPreview?.url, 'https://example.com');
      expect(msg.linkPreview?.title, 'Example');
    });

    test('fromJson parses replyTo (F-01)', () {
      final msg = ChatGroupMessage.fromJson({
        ..._baseMsg(),
        'replyToId': 'msg-parent',
        'replyTo': {
          'id': 'msg-parent',
          'body': 'Original',
          'senderName': 'Priya',
          'deletedForEveryone': false,
        },
      });
      expect(msg.replyToId, 'msg-parent');
      expect(msg.replyTo?.body, 'Original');
      expect(msg.replyTo?.senderName, 'Priya');
    });

    test('fromJson: mediaType audio (F-02 voice)', () {
      final msg = ChatGroupMessage.fromJson({
        ..._baseMsg(),
        'mediaUrl': 'https://cdn.example/voice.m4a',
        'mediaType': 'audio',
      });
      expect(msg.mediaType, 'audio');
      expect(msg.mediaUrl, contains('.m4a'));
    });

    test('fromJson: mediaType location (F-21)', () {
      final msg = ChatGroupMessage.fromJson({
        ..._baseMsg(),
        'mediaUrl': 'https://maps.google.com/?q=13.0827,80.2707',
        'mediaType': 'location',
      });
      expect(msg.mediaType, 'location');
    });

    test('fromJson: mediaType document (F-19)', () {
      final msg = ChatGroupMessage.fromJson({
        ..._baseMsg(),
        'mediaUrl': 'https://cdn.example/report.pdf',
        'mediaType': 'document',
      });
      expect(msg.mediaType, 'document');
    });

    group('copyWith', () {
      final base = ChatGroupMessage.fromJson({
        'id': 'msg-1',
        'groupId': 'grp-1',
        'body': 'Original',
        'createdAt': _ts,
        'deletedForEveryone': false,
        'isSystem': false,
      });

      test('copies body', () {
        final updated = base.copyWith(body: 'Edited');
        expect(updated.body, 'Edited');
        expect(updated.id, base.id);
      });

      test('copies editedAt', () {
        final t = DateTime.now();
        final updated = base.copyWith(editedAt: t);
        expect(updated.editedAt, t);
      });

      test('copies deletedForEveryone', () {
        final updated = base.copyWith(deletedForEveryone: true);
        expect(updated.isDeleted, isTrue);
      });

      test('copies reactions list', () {
        final reactions = [
          const ChatGroupReaction(emoji: '❤️', memberId: 'mem-2'),
        ];
        final updated = base.copyWith(reactions: reactions);
        expect(updated.reactions.length, 1);
      });

      test('copies readByCount and readByMemberIds', () {
        final updated = base.copyWith(
          readByCount: 5,
          readByMemberIds: ['a', 'b', 'c', 'd', 'e'],
        );
        expect(updated.readByCount, 5);
        expect(updated.readByMemberIds.length, 5);
      });

      test('copyWith clearPinnedAt removes pin (F-03)', () {
        final pinned = base.copyWith(pinnedAt: DateTime.now());
        expect(pinned.isPinned, isTrue);
        final unpinned = pinned.copyWith(clearPinnedAt: true);
        expect(unpinned.isPinned, isFalse);
      });

      test('copyWith linkPreview (F-06)', () {
        const lp = ChatGroupLinkPreview(url: 'https://example.com');
        final updated = base.copyWith(linkPreview: lp);
        expect(updated.linkPreview?.url, 'https://example.com');
      });

      test('copyWith clearLinkPreview removes preview (F-06)', () {
        const lp = ChatGroupLinkPreview(url: 'https://example.com');
        final withPreview = base.copyWith(linkPreview: lp);
        final cleared = withPreview.copyWith(clearLinkPreview: true);
        expect(cleared.linkPreview, isNull);
      });
    });
  });

  // ── MessageReadInfo ────────────────────────────────────────────────────────

  group('MessageReadInfo', () {
    test('fromJson all fields (F-07)', () {
      final info = MessageReadInfo.fromJson({
        'memberId': 'mem-1',
        'name': 'Arjun Kumar',
        'profilePhotoUrl': 'https://cdn.example/photo.jpg',
        'readAt': '2025-08-01T08:30:00.000Z',
      });
      expect(info.memberId, 'mem-1');
      expect(info.name, 'Arjun Kumar');
      expect(info.profilePhotoUrl, 'https://cdn.example/photo.jpg');
      expect(info.readAt.isUtc, isTrue);
    });

    test('name defaults to Member when missing', () {
      final info = MessageReadInfo.fromJson({
        'memberId': 'mem-1',
        'readAt': '2025-08-01T08:30:00.000Z',
      });
      expect(info.name, 'Member');
    });
  });

  // ── StarredMessage ─────────────────────────────────────────────────────────

  group('StarredMessage', () {
    const _ts = '2025-08-01T08:00:00.000Z';

    test('fromJson nested message + group (F-08 star)', () {
      final sm = StarredMessage.fromJson({
        'message': {
          'id': 'msg-1',
          'groupId': 'grp-1',
          'body': 'Important message',
          'createdAt': _ts,
          'deletedForEveryone': false,
          'isSystem': false,
        },
        'group': {'name': 'TBT General'},
      });
      expect(sm.message.id, 'msg-1');
      expect(sm.groupName, 'TBT General');
    });

    test('fromJson flat layout fallback', () {
      final sm = StarredMessage.fromJson({
        'id': 'msg-2',
        'groupId': 'grp-1',
        'body': 'Another',
        'createdAt': _ts,
        'deletedForEveryone': false,
        'isSystem': false,
        'groupName': 'Business Chat',
      });
      expect(sm.message.id, 'msg-2');
      expect(sm.groupName, 'Business Chat');
    });

    test('groupName defaults to Group when absent', () {
      final sm = StarredMessage.fromJson({
        'id': 'msg-3',
        'groupId': 'grp-1',
        'createdAt': _ts,
        'deletedForEveryone': false,
        'isSystem': false,
      });
      expect(sm.groupName, 'Group');
    });
  });

  // ── ChatGroupMediaItem ─────────────────────────────────────────────────────

  group('ChatGroupMediaItem', () {
    test('fromJson all fields (F-15 media gallery)', () {
      final item = ChatGroupMediaItem.fromJson({
        'id': 'msg-5',
        'mediaUrl': 'https://cdn.example/photo.jpg',
        'mediaType': 'image',
        'createdAt': '2025-08-01T08:00:00.000Z',
        'senderMemberId': 'mem-1',
      });
      expect(item.id, 'msg-5');
      expect(item.mediaType, 'image');
      expect(item.senderMemberId, 'mem-1');
    });

    test('senderMemberId nullable', () {
      final item = ChatGroupMediaItem.fromJson({
        'id': 'msg-6',
        'mediaUrl': 'https://cdn.example/doc.pdf',
        'mediaType': 'document',
        'createdAt': '2025-08-01T08:00:00.000Z',
      });
      expect(item.senderMemberId, isNull);
    });
  });

  // ── ChatGroupPresence ──────────────────────────────────────────────────────

  group('ChatGroupPresence', () {
    test('fromJson online true', () {
      final p = ChatGroupPresence.fromJson({
        'memberId': 'mem-1',
        'online': true,
        'lastSeenAt': '2025-08-01T09:00:00.000Z',
      });
      expect(p.online, isTrue);
      expect(p.lastSeenAt, isNotNull);
    });

    test('online defaults to false', () {
      final p = ChatGroupPresence.fromJson({'memberId': 'mem-1'});
      expect(p.online, isFalse);
      expect(p.lastSeenAt, isNull);
    });
  });

  // ── F-18 disappearing messages — TTL edge cases ────────────────────────────

  group('F-18 disappearing duration values', () {
    const _ts = '2025-08-01T08:00:00.000Z';

    _makeDetail(int? dur) => ChatGroupDetail.fromJson({
          'id': 'grp-1',
          'name': 'TBT',
          'createdAt': _ts,
          'updatedAt': _ts,
          'lastMessageAt': _ts,
          if (dur != null) 'disappearingDurationSeconds': dur,
        });

    test('5 minutes = 300', () =>
        expect(_makeDetail(300).disappearingDurationSeconds, 300));
    test('1 hour = 3600', () =>
        expect(_makeDetail(3600).disappearingDurationSeconds, 3600));
    test('1 day = 86400', () =>
        expect(_makeDetail(86400).disappearingDurationSeconds, 86400));
    test('7 days = 604800', () =>
        expect(_makeDetail(604800).disappearingDurationSeconds, 604800));
    test('null = disabled', () =>
        expect(_makeDetail(null).disappearingDurationSeconds, isNull));
  });
}

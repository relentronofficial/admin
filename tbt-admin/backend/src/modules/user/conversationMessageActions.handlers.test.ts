import { beforeEach, describe, expect, it, vi } from 'vitest';

// Member actions on direct (member ↔ TBT team) conversation messages, against an
// in-memory conversations / direct_messages / direct_message_reactions store.
// Every action is scoped to the member's own conversation; edits follow the
// group-chat rule (own message, within 5 minutes); "delete for everyone" is
// sender-only; one reaction per member (same = remove, other = change);
// forwards copy text + media into the member's other conversations.

vi.mock('../../config/env.js', () => ({ env: { PROGRAM_TIMEZONE: 'Asia/Kolkata', MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '' } }));

const actions = await import('./conversationMessageActions.js');
const user = await import('./controller.js');

const ME = '50000000-0000-4000-8000-0000000000a1';
const OTHER = '50000000-0000-4000-8000-0000000000a2';
const ADMIN = '60000000-0000-4000-8000-0000000000b1';
const C1 = '70000000-0000-4000-8000-000000000001';
const C2 = '70000000-0000-4000-8000-000000000002';
const C_OTHER = '70000000-0000-4000-8000-000000000003';

type Msg = {
  id: string; conversationId: string; memberId: string; senderId: string; senderType: 'member' | 'admin';
  body: string | null; mediaUrl: string | null; mediaType: string | null; replyToId: string | null;
  editedAt: Date | null; deletedAt: Date | null; deletedForEveryone: boolean; forwardedFromMessageId: string | null;
  readByAdminAt: null; readByMemberAt: null; createdAt: Date;
};
let convos: Array<{ id: string; memberId: string; status: 'open' | 'closed'; subject: string; adminUnreadCount: number; memberUnreadCount: number; lastMessageAt: Date }>;
let msgs: Msg[];
let reactions: Array<{ message_id: string; sender_type: string; sender_id: string; emoji: string; created_at: number }>;
let emitted: Array<[string, string, any]>;
let failReactionsRead: boolean;
const G1 = '90000000-0000-4000-8000-000000000001';
const G_ANNOUNCE = '90000000-0000-4000-8000-000000000002';
const G_NOT_MEMBER = '90000000-0000-4000-8000-000000000003';
let groups: Array<{ id: string; name: string; announcement_only: boolean; is_deleted: boolean; last_message_at: Date | null }>;
let groupMembers: Array<{ group_id: string; member_id: string; role: string; left_at: Date | null; unread_count: number }>;
let groupMsgs: Array<{ id: string; group_id: string; sender_member_id: string; body: string | null; media_url: string | null; media_type: string | null; forwarded_from_message_id: string }>;
let seq = 0;
const uuid = () => `80000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

const msg = (over: Partial<Msg>): Msg => ({
  id: uuid(), conversationId: C1, memberId: ME, senderId: ME, senderType: 'member', body: 'Hello', mediaUrl: null, mediaType: null,
  replyToId: null, editedAt: null, deletedAt: null, deletedForEveryone: false, forwardedFromMessageId: null,
  readByAdminAt: null, readByMemberAt: null, createdAt: new Date(), ...over,
});

async function sql(text: string, ...a: any[]): Promise<any> {
  const q = text.replace(/\s+/g, ' ').trim();
  if (q.startsWith('SELECT dm.id::text AS id')) {
    const m = msgs.find((x) => x.id === a[0] && x.conversationId === a[1] && convos.find((c) => c.id === x.conversationId)?.memberId === a[2]);
    return m ? [{ id: m.id, sender_type: m.senderType, sender_id: m.senderId, body: m.body, media_url: m.mediaUrl, media_type: m.mediaType,
      created_at: m.createdAt, edited_at: m.editedAt, deleted_at: m.deletedAt, deleted_for_everyone: m.deletedForEveryone }] : [];
  }
  if (q.startsWith('UPDATE direct_messages SET body = $1, edited_at = NOW()')) {
    const m = msgs.find((x) => x.id === a[1])!;
    m.body = a[0]; m.editedAt = new Date();
    return [{ id: m.id, body: m.body, edited_at: m.editedAt }];
  }
  if (q.startsWith('UPDATE direct_messages SET deleted_at = NOW(), deleted_for_everyone = $2')) {
    const m = msgs.find((x) => x.id === a[0])!;
    m.deletedAt = new Date(); m.deletedForEveryone = a[1];
    return 1;
  }
  if (q.startsWith("SELECT emoji FROM direct_message_reactions WHERE message_id = $1::uuid AND sender_type = 'member'")) {
    return reactions.filter((r) => r.message_id === a[0] && r.sender_type === 'member' && r.sender_id === a[1]).map((r) => ({ emoji: r.emoji }));
  }
  if (q.startsWith("DELETE FROM direct_message_reactions WHERE message_id = $1::uuid AND sender_type = 'member'")) {
    reactions = reactions.filter((r) => !(r.message_id === a[0] && r.sender_type === 'member' && r.sender_id === a[1]));
    return 1;
  }
  if (q.startsWith('INSERT INTO direct_message_reactions')) {
    reactions.push({ message_id: a[0], sender_type: 'member', sender_id: a[1], emoji: a[2], created_at: ++seq });
    return 1;
  }
  if (q.startsWith('SELECT message_id::text AS message_id, sender_type, sender_id::text AS sender_id, emoji FROM direct_message_reactions')) {
    if (failReactionsRead) throw new Error('relation "direct_message_reactions" does not exist');
    return [...reactions].sort((x, y) => x.created_at - y.created_at).filter((r) => a[0].includes(r.message_id));
  }
  if (q.startsWith('SELECT cgm.group_id::text AS group_id, g.name, g.announcement_only, cgm.role FROM chat_group_members cgm')) {
    return groupMembers
      .filter((gm) => gm.member_id === a[0] && gm.left_at === null && a[1].includes(gm.group_id))
      .map((gm) => ({ gm, g: groups.find((g) => g.id === gm.group_id && !g.is_deleted) }))
      .filter((x) => x.g)
      .map(({ gm, g }) => ({ group_id: gm.group_id, name: g!.name, announcement_only: g!.announcement_only, role: gm.role }));
  }
  if (q.startsWith('INSERT INTO chat_group_messages')) {
    const row = { id: uuid(), group_id: a[0], sender_member_id: a[1], body: a[2], media_url: a[3], media_type: a[4], forwarded_from_message_id: a[5] };
    groupMsgs.push(row);
    return [{ id: row.id }];
  }
  if (q.startsWith('UPDATE chat_groups SET last_message_at = NOW()')) {
    groups.find((g) => g.id === a[0])!.last_message_at = new Date();
    return 1;
  }
  if (q.startsWith('UPDATE chat_group_members SET unread_count = unread_count + 1')) {
    for (const gm of groupMembers) if (gm.group_id === a[0] && gm.member_id !== a[1] && gm.left_at === null) gm.unread_count += 1;
    return 1;
  }
  if (q.startsWith('SELECT member_id::text AS member_id FROM chat_group_members')) {
    return groupMembers.filter((gm) => gm.group_id === a[0] && gm.member_id !== a[1] && gm.left_at === null).map((gm) => ({ member_id: gm.member_id }));
  }
  throw new Error(`unhandled SQL: ${q.slice(0, 90)}`);
}

const visible = (where: any) => (m: Msg) =>
  m.conversationId === where.conversationId && !(where.NOT && m.deletedAt && !m.deletedForEveryone);

const prisma: any = {
  $queryRawUnsafe: sql,
  $executeRawUnsafe: sql,
  async $transaction(arg: any) {
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg(prisma);
  },
  conversation: {
    async findFirst({ where }: any) { return convos.find((c) => c.id === where.id && c.memberId === where.memberId) ?? null; },
    async findMany({ where }: any) { return convos.filter((c) => where.id.in.includes(c.id) && c.memberId === where.memberId); },
    async update({ where, data }: any) {
      const c = convos.find((x) => x.id === where.id)!;
      if (data.adminUnreadCount?.increment) c.adminUnreadCount += data.adminUnreadCount.increment;
      if (data.memberUnreadCount === 0) c.memberUnreadCount = 0;
      if (data.status) c.status = data.status;
      return c;
    },
  },
  directMessage: {
    async create({ data }: any) { const m = msg({ ...data, id: uuid(), replyToId: null }); msgs.push(m); return m; },
    async count({ where }: any) { return msgs.filter(visible(where)).length; },
    async findMany({ where }: any) { return msgs.filter(visible(where)); },
  },
  admin: { async findMany() { return [{ id: ADMIN, fullName: 'Asha (TBT)', profilePhotoUrl: null }]; } },
  member: {
    async findUnique() { return { firstName: 'Nila', lastName: 'Test', profilePhotoUrl: null }; },
  },
};

async function call(handler: any, { memberId = ME, params = {}, query = {}, body }: any = {}) {
  const sent: { status: number; body: any } = { status: 200, body: undefined };
  const reply: any = {
    status(code: number) { sent.status = code; return reply; },
    code(code: number) { sent.status = code; return reply; },
    send(b: any) { sent.body = b; return reply; },
  };
  const io = { to: (room: string) => ({ emit: (event: string, payload: any) => emitted.push([room, event, payload]) }) };
  const req: any = { memberId, params, query, headers: {}, body, server: { prisma, redis: null, io }, log: { error() {}, warn() {} } };
  await handler(req, reply);
  return sent;
}

const edit = (messageId: string, body: any, memberId = ME, convo = C1) => call(actions.editConversationMessageHandler, { memberId, params: { id: convo, messageId }, body: { body } });
const del = (messageId: string, forEveryone = false, memberId = ME) => call(actions.deleteConversationMessageHandler, { memberId, params: { id: C1, messageId }, query: forEveryone ? { forEveryone: 'true' } : {} });
const react = (messageId: string, emoji: any, memberId = ME) => call(actions.reactConversationMessageHandler, { memberId, params: { id: C1, messageId }, body: { emoji } });
const forward = (messageId: string, toConversationIds: any, memberId = ME) => call(actions.forwardConversationMessageHandler, { memberId, params: { id: C1, messageId }, body: { toConversationIds } });
const list = async (convo = C1) => (await call(user.getMemberConversationMessagesHandler, { params: { id: convo }, query: {} })).body.data;

beforeEach(() => {
  seq = 0;
  emitted = [];
  failReactionsRead = false;
  convos = [
    { id: C1, memberId: ME, status: 'open', subject: 'Billing', adminUnreadCount: 0, memberUnreadCount: 0, lastMessageAt: new Date() },
    { id: C2, memberId: ME, status: 'closed', subject: 'Tech help', adminUnreadCount: 0, memberUnreadCount: 0, lastMessageAt: new Date() },
    { id: C_OTHER, memberId: OTHER, status: 'open', subject: 'Not mine', adminUnreadCount: 0, memberUnreadCount: 0, lastMessageAt: new Date() },
  ];
  msgs = [];
  reactions = [];
  groups = [
    { id: G1, name: 'Batch 7', announcement_only: false, is_deleted: false, last_message_at: null },
    { id: G_ANNOUNCE, name: 'Announcements', announcement_only: true, is_deleted: false, last_message_at: null },
    { id: G_NOT_MEMBER, name: 'Other batch', announcement_only: false, is_deleted: false, last_message_at: null },
  ];
  groupMembers = [
    { group_id: G1, member_id: ME, role: 'member', left_at: null, unread_count: 0 },
    { group_id: G1, member_id: OTHER, role: 'member', left_at: null, unread_count: 0 },
    { group_id: G_ANNOUNCE, member_id: ME, role: 'member', left_at: null, unread_count: 0 },
    { group_id: G_NOT_MEMBER, member_id: OTHER, role: 'member', left_at: null, unread_count: 0 },
  ];
  groupMsgs = [];
});

describe('edit', () => {
  it('edits the member\'s own recent message; the list shows the new text and edited time', async () => {
    const m = msg({}); msgs.push(m);
    const r = await edit(m.id, '  Hello again  ');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ id: m.id, body: 'Hello again' });
    const row = (await list()).find((x: any) => x.id === m.id);
    expect(row.body).toBe('Hello again');
    expect(row.editedAt).toBeInstanceOf(Date);
    expect(emitted).toContainEqual([`conversation:${C1}`, 'chat:message_updated', { conversationId: C1, messageId: m.id, change: 'edited' }]);
  });

  it('rejects editing a TBT team message, an old message, an empty edit, or someone else\'s conversation', async () => {
    const adminMsg = msg({ senderType: 'admin', senderId: ADMIN }); msgs.push(adminMsg);
    expect((await edit(adminMsg.id, 'x')).status).toBe(403);
    const old = msg({ createdAt: new Date(Date.now() - 6 * 60_000) }); msgs.push(old);
    expect(await edit(old.id, 'x')).toMatchObject({ status: 400, body: { error: { message: 'Messages can only be edited within 5 minutes.' } } });
    const mine = msg({}); msgs.push(mine);
    expect((await edit(mine.id, '   ')).status).toBe(400);
    expect((await edit(mine.id, 'x', OTHER)).status).toBe(404);
    expect(mine.body).toBe('Hello');
  });
});

describe('delete', () => {
  it('"delete for me" hides it from the member only (still stored for the TBT team)', async () => {
    const adminMsg = msg({ senderType: 'admin', senderId: ADMIN, body: 'Team reply' }); msgs.push(adminMsg);
    const r = await del(adminMsg.id);
    expect(r).toMatchObject({ status: 200, body: { data: { deleted: true, forEveryone: false } } });
    expect((await list()).map((x: any) => x.id)).not.toContain(adminMsg.id);
    expect(msgs.find((x) => x.id === adminMsg.id)?.body).toBe('Team reply');
  });

  it('"delete for everyone" is sender-only and blanks the content for the member', async () => {
    const adminMsg = msg({ senderType: 'admin', senderId: ADMIN }); msgs.push(adminMsg);
    expect((await del(adminMsg.id, true)).status).toBe(403);
    const mine = msg({ body: 'Oops', mediaUrl: 'https://cdn.example.com/x.png', mediaType: 'image' }); msgs.push(mine);
    expect((await del(mine.id, true)).status).toBe(200);
    const row = (await list()).find((x: any) => x.id === mine.id);
    expect(row).toMatchObject({ deletedForEveryone: true, body: null, mediaUrl: null, reactions: [] });
    expect((await del(mine.id, true)).status).toBe(400);
  });

  it('cannot delete in someone else\'s conversation', async () => {
    const m = msg({}); msgs.push(m);
    expect((await del(m.id, false, OTHER)).status).toBe(404);
    expect(m.deletedAt).toBeNull();
  });
});

describe('react', () => {
  it('sets, changes and removes the member\'s single reaction; the list shows counts', async () => {
    const m = msg({ senderType: 'admin', senderId: ADMIN }); msgs.push(m);
    reactions.push({ message_id: m.id, sender_type: 'admin', sender_id: ADMIN, emoji: '👍', created_at: 0 });

    expect((await react(m.id, '👍')).body.data).toEqual({ id: m.id, emoji: '👍' });
    expect((await list())[0].reactions).toEqual([{ emoji: '👍', count: 2, reactedByMe: true }]);

    expect((await react(m.id, '❤️')).body.data.emoji).toBe('❤️');
    expect((await list())[0].reactions).toEqual([{ emoji: '👍', count: 1, reactedByMe: false }, { emoji: '❤️', count: 1, reactedByMe: true }]);

    expect((await react(m.id, '❤️')).body.data.emoji).toBeNull();
    expect((await list())[0].reactions).toEqual([{ emoji: '👍', count: 1, reactedByMe: false }]);
  });

  it('rejects an unsupported reaction or a deleted message', async () => {
    const m = msg({}); msgs.push(m);
    expect((await react(m.id, '🔥')).status).toBe(400);
    m.deletedAt = new Date(); m.deletedForEveryone = true;
    expect((await react(m.id, '👍')).status).toBe(400);
    expect(reactions).toEqual([]);
  });

  it('a reactions read failure never hides the conversation', async () => {
    msgs.push(msg({}));
    failReactionsRead = true;
    const rows = await list();
    expect(rows).toHaveLength(1);
    expect(rows[0].reactions).toEqual([]);
  });
});

describe('forward', () => {
  it('copies text + attachment into the chosen own conversation (reopening it) and notifies', async () => {
    const m = msg({ senderType: 'admin', senderId: ADMIN, body: 'See attached', mediaUrl: 'https://cdn.example.com/doc.pdf', mediaType: 'file' }); msgs.push(m);
    const r = await forward(m.id, [C2]);
    expect(r.status).toBe(201);
    const copy = (await list(C2))[0];
    expect(copy).toMatchObject({ body: 'See attached', mediaUrl: 'https://cdn.example.com/doc.pdf', mediaType: 'file', senderType: 'member', forwarded: true });
    expect(convos.find((c) => c.id === C2)).toMatchObject({ status: 'open', adminUnreadCount: 1 });
    expect(emitted.map(([room, ev]) => `${room} ${ev}`)).toEqual(expect.arrayContaining([
      `conversation:${C2} chat:message`, `conversation:${C2} chat:conversation_reopened`, 'admin chat:unread_ping',
    ]));
  });

  it('refuses another member\'s conversation, no target, or a deleted message — and writes nothing', async () => {
    const m = msg({}); msgs.push(m);
    expect((await forward(m.id, [C_OTHER])).status).toBe(404);
    expect((await forward(m.id, [])).status).toBe(400);
    m.deletedAt = new Date(); m.deletedForEveryone = true;
    expect((await forward(m.id, [C2])).status).toBe(400);
    expect(msgs).toHaveLength(1);
  });
});

describe('forward to a chat group', () => {
  const fwd = (messageId: string, body: any) => call(actions.forwardConversationMessageHandler, { params: { id: C1, messageId }, body });

  it('posts text + attachment into a group the member belongs to, bumps it and notifies its members', async () => {
    const m = msg({ senderType: 'admin', senderId: ADMIN, body: 'Batch schedule', mediaUrl: 'https://cdn.example.com/s.pdf', mediaType: 'file' }); msgs.push(m);
    const r = await fwd(m.id, { toGroupIds: [G1] });
    expect(r.status).toBe(201);
    expect(r.body.data.forwardedToGroups).toEqual([{ groupId: G1, messageId: groupMsgs[0].id }]);
    expect(groupMsgs).toEqual([expect.objectContaining({
      group_id: G1, sender_member_id: ME, body: 'Batch schedule', media_url: 'https://cdn.example.com/s.pdf', media_type: 'file', forwarded_from_message_id: m.id,
    })]);
    expect(groups.find((g) => g.id === G1)!.last_message_at).toBeInstanceOf(Date);
    expect(groupMembers.find((gm) => gm.group_id === G1 && gm.member_id === OTHER)!.unread_count).toBe(1);
    expect(groupMembers.find((gm) => gm.group_id === G1 && gm.member_id === ME)!.unread_count).toBe(0);
    expect(emitted).toEqual(expect.arrayContaining([
      [`group:${G1}`, 'group:message:new', { forwardedMessageId: groupMsgs[0].id }],
      [`user:${OTHER}`, 'group:bumped', { groupId: G1 }],
    ]));
  });

  it('can forward to a conversation and a group in one go', async () => {
    const m = msg({}); msgs.push(m);
    const r = await fwd(m.id, { toConversationIds: [C2], toGroupIds: [G1] });
    expect(r.status).toBe(201);
    expect(r.body.data.forwardedTo).toHaveLength(1);
    expect(r.body.data.forwardedToGroups).toHaveLength(1);
  });

  it('refuses groups the member is not in, and announcement-only groups for non-admins — nothing is written', async () => {
    const m = msg({}); msgs.push(m);
    expect(await fwd(m.id, { toGroupIds: [G_NOT_MEMBER] })).toMatchObject({ status: 404, body: { error: { message: 'Group not found' } } });
    expect(await fwd(m.id, { toGroupIds: [G_ANNOUNCE] })).toMatchObject({ status: 403, body: { error: { message: 'Only group admins can post in "Announcements"' } } });
    groupMembers.find((gm) => gm.group_id === G1 && gm.member_id === ME)!.left_at = new Date();
    expect((await fwd(m.id, { toConversationIds: [C2], toGroupIds: [G1] })).status).toBe(404);
    expect(groupMsgs).toEqual([]);
    expect(msgs).toHaveLength(1);
  });

  it('needs at least one target', async () => {
    const m = msg({}); msgs.push(m);
    expect((await fwd(m.id, { toConversationIds: [], toGroupIds: [] })).status).toBe(400);
    expect((await fwd(m.id, { toGroupIds: ['bad'] })).status).toBe(400);
  });
});

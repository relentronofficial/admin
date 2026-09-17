// Dev helper: seed multiple sample group chats with realistic content.
// Idempotent — deletes and recreates the seeded groups by name, leaves
// other groups alone.
//
// Run with:  node scripts/seed-chat-group.mjs
//
// Uses raw SQL because chat_group_* controllers use $queryRawUnsafe.

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

// ── Group definitions ──────────────────────────────────────────────────────

const GROUPS = [
  {
    name: "Founder's Circle",
    description: 'Where TBT operators talk shop — founders, growth, sales, hires.',
    memberNames: ['Arjun', 'Priya', 'Ravi', 'Deepika', 'Manoj', 'Sakthivel'],
    // markAllRead=true → sender sees blue double-ticks on their own msgs
    markAllRead: true,
    script: [
      { key: 'fc1', sender: 'Manoj', body: "Morning folks 👋 kicking off week 3 with a big update — landing page conversion is up 42%. Full share tomorrow.", at: 240 },
      { key: 'fc2', sender: 'Priya', body: "Massive 🚀🚀 @Manoj which variant won — long-form or the video hero?", at: 238, mentions: ['Manoj'] },
      { key: 'fc3', sender: 'Manoj', body: "Video hero by a mile. Long-form actually dropped 8%.", at: 235, replyTo: 'fc2' },
      { key: 'fc4', sender: 'Arjun', body: "@Priya can we grab 15 min today? Want to walk through the pricing test results before Ravi's session.", at: 180, mentions: ['Priya'] },
      { key: 'fc5', sender: 'Priya', body: "3:30pm? On my way to Bengaluru airport at 5 so anything before 4 works.", at: 175, replyTo: 'fc4' },
      { key: 'fc6', sender: 'Ravi', body: "Live call at 7pm sharp — please come with ONE metric from your last 7 days. Doesn't need to be pretty, needs to be honest.", at: 120 },
      { key: 'fc7', sender: 'Deepika', body: "Signed our first ₹5L retainer this morning 🎉", at: 90 },
      { key: 'fc8', sender: 'Arjun', body: "Huge 👏 what was the closing move that unlocked it?", at: 88, replyTo: 'fc7' },
      { key: 'fc9', sender: 'Deepika', body: "Framed the proposal as an outcome-per-month price, not a project fee. They kept asking 'what do we get for this?' — once we answered that in ₹ they signed within 48 hours.", at: 85, replyTo: 'fc8' },
      { key: 'fc10', sender: 'Sakthivel', body: "Anyone here shipped WhatsApp broadcast for lead nurture at scale? Hitting rate limit issues on WABA.", at: 60 },
      { key: 'fc11', sender: 'Manoj', body: "@Sakthivel yes — you need the higher tier template category + a proper CTA button. DM me, I'll share our template.", at: 55, replyTo: 'fc10', mentions: ['Sakthivel'] },
      { key: 'fc12', sender: 'Priya', body: "Reminder: submit last week's numbers before tonight's call. Nobody presents without them.", at: 30 },
      { key: 'fc13', sender: 'Arjun', body: "Done ✅", at: 28, replyTo: 'fc12' },
      { key: 'fc14', sender: 'Ravi', body: "Same, submitted 🙌", at: 20, replyTo: 'fc12' },
      { key: 'fc15', sender: 'Deepika', body: "Just posted mine. See you at 7.", at: 10, replyTo: 'fc12' },
    ],
    reactions: [
      { key: 'fc1',  reactor: 'Priya',    emoji: '🚀' },
      { key: 'fc1',  reactor: 'Arjun',    emoji: '🚀' },
      { key: 'fc1',  reactor: 'Deepika',  emoji: '❤️' },
      { key: 'fc7',  reactor: 'Manoj',    emoji: '🙌' },
      { key: 'fc7',  reactor: 'Priya',    emoji: '🙌' },
      { key: 'fc7',  reactor: 'Arjun',    emoji: '🙌' },
      { key: 'fc7',  reactor: 'Ravi',     emoji: '❤️' },
      { key: 'fc7',  reactor: 'Sakthivel',emoji: '🎉' },
      { key: 'fc9',  reactor: 'Priya',    emoji: '👍' },
      { key: 'fc9',  reactor: 'Manoj',    emoji: '👍' },
      { key: 'fc11', reactor: 'Sakthivel',emoji: '🙏' },
      { key: 'fc13', reactor: 'Priya',    emoji: '👍' },
    ],
  },

  {
    name: 'Cohort 12 · Growth Sprint',
    description: '4-week sprint. Daily standup at 9am, weekly review Fridays.',
    memberNames: ['Arjun', 'Priya', 'Ravi', 'Deepika', 'Manoj', 'Merlin', 'Thrisha'],
    // markAllRead=false → recent messages appear unread → group list shows badge
    markAllRead: false,
    unreadTailCount: 6,  // the newest N messages stay unread for everyone-else
    script: [
      { key: 'gr1', sender: 'Priya', body: "Kicking off Cohort 12 today. Everyone should have received the workbook link. Post any issues here — I'll route them.", at: 4320 /* 3 days ago */ },
      { key: 'gr2', sender: 'Merlin', body: "Got the workbook. Question: for the ICP exercise, are we defining 1 ICP or ranking 3?", at: 4300, replyTo: 'gr1' },
      { key: 'gr3', sender: 'Priya', body: "Rank 3, pick #1 for the sprint. You'll iterate but we need one target for the messaging tests.", at: 4295, replyTo: 'gr2' },
      { key: 'gr4', sender: 'Thrisha', body: "Day 1 done. Booked 3 discovery calls for this week — 2 warm, 1 cold. Feels weird to be talking to prospects on day 1 but here we go.", at: 4100 },
      { key: 'gr5', sender: 'Deepika', body: "That's the point — discovery beats research 100% of the time. What are you asking them?", at: 4090, replyTo: 'gr4' },
      { key: 'gr6', sender: 'Thrisha', body: "The 5 Whys sheet from module 2. Trying not to pitch, just listen.", at: 4085, replyTo: 'gr5' },
      { key: 'gr7', sender: 'Arjun', body: "Reminder: the messaging test template drops in your inbox at 10am tomorrow. Don't skip the first draft — that's where the insight lives.", at: 2880 /* 2 days ago */ },
      { key: 'gr8', sender: 'Ravi', body: "Standup in 5 minutes. Format: 1) win, 2) block, 3) ask.", at: 1440 /* 1 day ago */ },
      { key: 'gr9', sender: 'Merlin', body: "Win: closed a discovery call with a $2M/yr agency, they said yes to a paid pilot. Block: pricing — they want to negotiate the retainer down. Ask: how do you hold price on the first pilot?", at: 1435, replyTo: 'gr8' },
      { key: 'gr10', sender: 'Priya', body: "@Merlin drop them one line: 'Our pilot pricing is what it is because the outcome is what it is. If it works you'll see it back in month 1.' Then be quiet.", at: 1430, replyTo: 'gr9', mentions: ['Merlin'] },
      { key: 'gr11', sender: 'Deepika', body: "^ this. Silence closes more deals than talking.", at: 1428, replyTo: 'gr10' },
      // Unread tail — recent messages nobody has read yet
      { key: 'gr12', sender: 'Manoj', body: "Team, quick update: I've pushed the group chat feature live 🎉 you can react, reply, mention @Merlin @Thrisha, edit, delete. Play with it.", at: 120, mentions: ['Merlin', 'Thrisha'] },
      { key: 'gr13', sender: 'Merlin', body: "Testing 🚀", at: 90, replyTo: 'gr12' },
      { key: 'gr14', sender: 'Thrisha', body: "Working smooth on mobile too 👍", at: 60, replyTo: 'gr12' },
      { key: 'gr15', sender: 'Priya', body: "Nice. Sprint retro Friday 4pm — put it on your calendars.", at: 30 },
      { key: 'gr16', sender: 'Arjun', body: "Locked. Also — anyone up for a Bengaluru meetup next weekend? Could do dinner + informal debrief.", at: 15 },
      { key: 'gr17', sender: 'Deepika', body: "Count me in 🙌", at: 3, replyTo: 'gr16' },
    ],
    reactions: [
      { key: 'gr1', reactor: 'Merlin', emoji: '👍' },
      { key: 'gr1', reactor: 'Thrisha', emoji: '👍' },
      { key: 'gr4', reactor: 'Priya', emoji: '🔥' },
      { key: 'gr4', reactor: 'Arjun', emoji: '🔥' },
      { key: 'gr9', reactor: 'Deepika', emoji: '🎯' },
      { key: 'gr10', reactor: 'Merlin', emoji: '🙏' },
      { key: 'gr10', reactor: 'Ravi', emoji: '👍' },
      { key: 'gr11', reactor: 'Priya', emoji: '💯' },
      { key: 'gr12', reactor: 'Merlin', emoji: '🚀' },
      { key: 'gr12', reactor: 'Thrisha', emoji: '🚀' },
      { key: 'gr16', reactor: 'Manoj', emoji: '🙌' },
    ],
  },

  {
    name: 'Product & Engineering',
    description: 'For anyone shipping code + product decisions. Short thread rules — new topic = new group.',
    memberNames: ['Arjun', 'Manoj', 'Sakthivel', 'Ravi'],
    markAllRead: false,
    unreadTailCount: 3,
    script: [
      { key: 'pe1', sender: 'Manoj', body: "Team — the group chat backend goes to prod tonight. All 5 tables via raw SQL (matches admin_notifications pattern). Read the CLAUDE.md pitfall #28 before you touch it.", at: 5760 },
      { key: 'pe2', sender: 'Arjun', body: "How are we handling read receipts server-side?", at: 5750, replyTo: 'pe1' },
      { key: 'pe3', sender: 'Manoj', body: "chat_group_message_reads composite-unique on (message_id, member_id). Emit group:read on mark → sender's client flips ticks blue.", at: 5745, replyTo: 'pe2' },
      { key: 'pe4', sender: 'Sakthivel', body: "What about presence? Cloud Run scales to N pods, in-memory Map won't fan out.", at: 5740, replyTo: 'pe1' },
      { key: 'pe5', sender: 'Manoj', body: "Redis pub/sub adapter is already attached to Socket.IO (perf commit c5187846). Emit presence:update via io.emit — every replica hears it. Query endpoint reads only the local Map so it's approximate, but the broadcast keeps clients in sync.", at: 5735, replyTo: 'pe4' },
      { key: 'pe6', sender: 'Ravi', body: "Migration plan for the drift tables (admin_notifications, legal_pages)? CI's db push --accept-data-loss is a landmine.", at: 5000 },
      { key: 'pe7', sender: 'Manoj', body: "Yep — flagged it. Two options: (1) add all drift tables to schema.prisma, or (2) drop --accept-data-loss from CI and script the additions. Leaning toward (1) since we're doing it anyway for chat_groups.", at: 4990, replyTo: 'pe6' },
      { key: 'pe8', sender: 'Sakthivel', body: "Nit: our @mention parse-on-client vs parse-on-server. If someone types @Foo but @Foo isn't a member, we still fire a group:message:new but no group:mention. Right?", at: 4200 },
      { key: 'pe9', sender: 'Manoj', body: "Correct. Backend validates against group members before persisting mentionedMemberIds. Text @Foo renders highlighted client-side anyway (RichText regex), but no ping event fires.", at: 4195, replyTo: 'pe8' },
      // Unread tail
      { key: 'pe10', sender: 'Arjun', body: "Merged Phase 4 mobile port. Flutter analyze passes on chat_groups/. Pre-existing warnings elsewhere still red-mark CI but nothing new.", at: 45 },
      { key: 'pe11', sender: 'Ravi', body: "Nice. Bumping versionCode + shipping to TestFlight tomorrow.", at: 20, replyTo: 'pe10' },
      { key: 'pe12', sender: 'Manoj', body: "APK sideloaded and working end-to-end on Vivo. Founder's Circle sample data renders correctly. Blue ticks, reactions, replies — all wired.", at: 5 },
    ],
    reactions: [
      { key: 'pe3', reactor: 'Arjun', emoji: '👍' },
      { key: 'pe5', reactor: 'Sakthivel', emoji: '🙏' },
      { key: 'pe7', reactor: 'Ravi', emoji: '💯' },
      { key: 'pe9', reactor: 'Sakthivel', emoji: '✅' },
      { key: 'pe12', reactor: 'Arjun', emoji: '🎉' },
      { key: 'pe12', reactor: 'Ravi', emoji: '🚀' },
    ],
  },
];

// ── Seed runner ────────────────────────────────────────────────────────────

async function main() {
  // Fetch every candidate member up front
  const roster = await prisma.$queryRawUnsafe(`
    SELECT id, first_name, last_name
    FROM members
    WHERE first_name IN ('Arjun','Priya','Ravi','Deepika','Manoj','Sakthivel','Merlin','Thrisha')
    ORDER BY first_name ASC
  `);
  const byName = Object.fromEntries(roster.map((m) => [m.first_name, m]));

  for (const spec of GROUPS) {
    console.log(`\n── Seeding "${spec.name}" ──`);

    const members = spec.memberNames
      .map((n) => byName[n])
      .filter(Boolean);
    if (members.length < 3) {
      console.log(`  skipped — need >= 3 members (found ${members.length})`);
      continue;
    }

    // Wipe + recreate group so re-runs stay idempotent
    await prisma.$executeRawUnsafe(
      `DELETE FROM chat_groups WHERE name = $1`,
      spec.name,
    );
    const [grp] = await prisma.$queryRawUnsafe(
      `INSERT INTO chat_groups (name, description) VALUES ($1, $2) RETURNING id`,
      spec.name,
      spec.description,
    );
    const groupId = grp.id;

    // Add members
    await prisma.$executeRawUnsafe(
      `INSERT INTO chat_group_members (group_id, member_id)
       SELECT $1::uuid, UNNEST($2::uuid[])
       ON CONFLICT (group_id, member_id) DO NOTHING`,
      groupId,
      members.map((m) => m.id),
    );

    // Seed messages
    const now = new Date();
    const insertedByKey = {};
    for (const msg of spec.script) {
      const sender = byName[msg.sender];
      if (!sender) throw new Error(`Unknown sender ${msg.sender}`);
      const replyToId = msg.replyTo ? insertedByKey[msg.replyTo]?.id ?? null : null;
      const mentionIds =
        (msg.mentions ?? []).map((n) => byName[n]?.id).filter(Boolean);
      const at = new Date(now.getTime() - msg.at * 60_000);

      const [row] = await prisma.$queryRawUnsafe(
        `INSERT INTO chat_group_messages
           (group_id, sender_member_id, body, reply_to_id, mentioned_member_ids, created_at)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5::uuid[], $6::timestamptz)
         RETURNING id`,
        groupId,
        sender.id,
        msg.body,
        replyToId,
        mentionIds,
        at,
      );
      insertedByKey[msg.key] = row;
    }

    // Reactions
    for (const r of spec.reactions ?? []) {
      const msg = insertedByKey[r.key];
      const reactor = byName[r.reactor];
      if (!msg || !reactor) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO chat_group_reactions (message_id, member_id, emoji)
         VALUES ($1::uuid, $2::uuid, $3)
         ON CONFLICT (message_id, member_id, emoji) DO NOTHING`,
        msg.id,
        reactor.id,
        r.emoji,
      );
    }

    // Reads — mark historic messages as read; leave `unreadTailCount` tail
    // unread so the group list shows the badge.
    const unreadTail = spec.markAllRead ? 0 : (spec.unreadTailCount ?? 0);
    const readableCount = spec.script.length - unreadTail;
    for (let i = 0; i < readableCount; i++) {
      const msg = spec.script[i];
      const insertedId = insertedByKey[msg.key]?.id;
      if (!insertedId) continue;
      const senderId = byName[msg.sender].id;
      for (const m of members) {
        if (m.id === senderId) continue;
        await prisma.$executeRawUnsafe(
          `INSERT INTO chat_group_message_reads (message_id, member_id)
           VALUES ($1::uuid, $2::uuid)
           ON CONFLICT (message_id, member_id) DO NOTHING`,
          insertedId,
          m.id,
        );
      }
    }

    // Recompute unread_count per member = # of tail messages sent by others
    if (unreadTail > 0) {
      const unreadMessages = spec.script.slice(-unreadTail);
      for (const m of members) {
        const unreadForThisMember = unreadMessages.filter(
          (msg) => byName[msg.sender].id !== m.id,
        ).length;
        await prisma.$executeRawUnsafe(
          `UPDATE chat_group_members
           SET unread_count = $3
           WHERE group_id = $1::uuid AND member_id = $2::uuid`,
          groupId,
          m.id,
          unreadForThisMember,
        );
      }
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE chat_group_members SET unread_count = 0 WHERE group_id = $1::uuid`,
        groupId,
      );
    }

    // Bump last_message_at
    await prisma.$executeRawUnsafe(
      `UPDATE chat_groups SET last_message_at = NOW() WHERE id = $1::uuid`,
      groupId,
    );

    console.log(
      `  ✅ ${spec.script.length} messages · ${(spec.reactions ?? []).length} reactions · ${unreadTail} unread tail`,
    );
  }

  console.log(`\nSeed complete. Members with access: ${Object.keys(byName).join(', ')}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

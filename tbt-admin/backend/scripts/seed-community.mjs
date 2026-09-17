// One-off community seed for QA.
// Creates 3 approved posts across 3 members so the feed has content
// to render, then adds a couple of comments so the comment sheet also
// has content. Idempotent: skips if similar content already exists.
//
// Run with: node scripts/seed-community.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_MARKER = '[demo-seed]';

async function main() {
  // Pick 3 members (any active ones) for post authors.
  const members = await prisma.member.findMany({
    take: 4,
    orderBy: { createdAt: 'asc' },
    select: { id: true, firstName: true, lastName: true },
  });
  if (members.length < 2) {
    console.error('Not enough members to seed a community.');
    process.exit(1);
  }

  // Skip if already seeded.
  const existing = await prisma.post.count({
    where: { content: { contains: SEED_MARKER } },
  });
  if (existing > 0) {
    console.log(`Already ${existing} demo posts — skipping seed.`);
    return;
  }

  const posts = [
    {
      memberId: members[0].id,
      content:
        `Just hit our first month of ₹1L revenue! Started with zero customers 90 days ago and today the tribe helped me cross that milestone. Thank you Sakthi for the pricing framework — anchored ₹3999 like you said, no discount, and the customers came. ${SEED_MARKER}`,
      mediaUrls: [
        'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop',
      ],
      isApproved: true,
      isMentor: false,
      isPinned: false,
      likesCount: 24,
      commentsCount: 0,
    },
    {
      memberId: members[1 % members.length].id,
      content:
        `Finished the 30-day morning ritual challenge today. My productivity jumped 3x. Sharing my ritual: 5am wake, 15min pages, 10min meditate, review daily goals over coffee. Feel free to steal it. ${SEED_MARKER}`,
      mediaUrls: [],
      isApproved: true,
      isMentor: true,
      isPinned: true,
      likesCount: 87,
      commentsCount: 0,
    },
    {
      memberId: members[2 % members.length].id,
      content:
        `Hiring my first employee next week — copywriter for the agency. Any tribe members done this recently? Would love a 15-min call to compare notes on interview questions. ${SEED_MARKER}`,
      mediaUrls: [],
      isApproved: true,
      isMentor: false,
      isPinned: false,
      likesCount: 12,
      commentsCount: 0,
    },
  ];

  const createdIds = [];
  for (const p of posts) {
    const row = await prisma.post.create({ data: p });
    createdIds.push(row.id);
    const name = [members.find((m) => m.id === p.memberId)?.firstName].filter(Boolean).join(' ');
    console.log(`  + post by ${name || p.memberId.slice(0, 8)} — "${p.content.slice(0, 40)}..."`);
  }

  // Add comments to first post so the comment sheet has content.
  const comments = [
    {
      postId: createdIds[0],
      memberId: members[1 % members.length].id,
      content: 'Massive congrats! What was the biggest unlock for you?',
    },
    {
      postId: createdIds[0],
      memberId: members[2 % members.length].id,
      content: 'Inspiring 🔥 — building in public is such a superpower.',
    },
  ];
  for (const c of comments) {
    await prisma.comment.create({ data: c });
  }
  // Sync count on the parent post.
  await prisma.post.update({
    where: { id: createdIds[0] },
    data: { commentsCount: comments.length },
  });

  console.log(`\n✅ Seeded ${posts.length} approved posts + ${comments.length} comments.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

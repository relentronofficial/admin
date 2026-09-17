// One-off seed for /wins verification.
// Grants dummy points to up to 10 active members so the podium + list
// have data to render. Idempotent: skips members that already have
// activity within the last hour (assumes we've already seeded).
//
// Run with: node scripts/seed-leaderboard.mjs
//
// Points distribution (loosely realistic):
//   Rank 1: ~9,450   Rank 2: ~8,210   Rank 3: ~7,120
//   Rank 4: ~5,830   Rank 5: ~4,680   Rank 6: ~3,540
//   Rank 7: ~2,890   Rank 8: ~2,120   Rank 9: ~1,540   Rank 10: ~980

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const POINTS = [9450, 8210, 7120, 5830, 4680, 3540, 2890, 2120, 1540, 980];

async function main() {
  // Find up to 10 members. Prefer active status if available; otherwise any.
  const members = await prisma.member.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { id: true, firstName: true, lastName: true, status: true },
  });

  if (members.length === 0) {
    console.error('No members in DB — cannot seed.');
    process.exit(1);
  }

  console.log(`Seeding leaderboard for ${members.length} members…`);

  const nowMs = Date.now();
  const rows = [];
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const points = POINTS[i] ?? 500;

    // Skip if this member already has activity in the last hour (idempotent).
    const recent = await prisma.tbtActivityLog.count({
      where: {
        memberId: member.id,
        createdAt: { gte: new Date(nowMs - 60 * 60 * 1000) },
      },
    });
    if (recent > 0) {
      console.log(`  ↷ skip ${member.firstName ?? member.id} (already seeded)`);
      continue;
    }

    // Spread the points across a mix of dates so week/month filters have
    // varying results.
    //   ~40% of points 1 day ago  (visible in week)
    //   ~35% of points 10 days ago (visible in month, not week)
    //   ~25% of points 60 days ago (all-time only)
    const week = Math.round(points * 0.4);
    const month = Math.round(points * 0.35);
    const old = points - week - month;

    const bucket = [
      { days: 1, points: week, source: 'task_completion' },
      { days: 10, points: month, source: 'task_completion' },
      { days: 60, points: old, source: 'task_completion' },
    ];

    for (const b of bucket) {
      const activityDate = new Date(nowMs - b.days * 24 * 60 * 60 * 1000);
      rows.push({
        memberId: member.id,
        points: b.points,
        source: b.source,
        activityDate,
      });
    }

    const label = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.id.slice(0, 8);
    console.log(`  + ${label.padEnd(28)} → ${points.toLocaleString()} pts (${week}/${month}/${old})`);
  }

  if (rows.length === 0) {
    console.log('All members already have recent activity — nothing to insert.');
    return;
  }

  const created = await prisma.tbtActivityLog.createMany({ data: rows });
  console.log(`✅ Inserted ${created.count} activity_log rows.`);

  // Quick sanity check — top 5 by aggregated points.
  const grouped = await prisma.tbtActivityLog.groupBy({
    by: ['memberId'],
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
    take: 5,
  });
  console.log('\nTop 5 all-time after seed:');
  for (const g of grouped) {
    const m = members.find((mm) => mm.id === g.memberId);
    const name = m ? [m.firstName, m.lastName].filter(Boolean).join(' ') : g.memberId.slice(0, 8);
    console.log(`  ${(g._sum.points ?? 0).toString().padStart(6)}  ${name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

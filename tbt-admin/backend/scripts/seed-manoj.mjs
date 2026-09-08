// Grants Manoj (test user) mid-tier points so he appears in the leaderboard
// list with the "YOU" pill highlighted.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find Manoj by first name (case-insensitive).
  const manoj = await prisma.member.findFirst({
    where: {
      OR: [
        { firstName: { equals: 'Manoj', mode: 'insensitive' } },
        { firstName: { equals: 'manoj', mode: 'insensitive' } },
      ],
    },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!manoj) {
    console.error('Could not find member "Manoj". Aborting.');
    process.exit(1);
  }

  const nowMs = Date.now();
  const recent = await prisma.tbtActivityLog.count({
    where: {
      memberId: manoj.id,
      createdAt: { gte: new Date(nowMs - 60 * 60 * 1000) },
    },
  });
  if (recent > 0) {
    console.log(`Manoj already has recent activity — skipping.`);
    return;
  }

  // Grant 6,240 points split across dates so all period filters show him
  // Rank should land him around 4-5th.
  const buckets = [
    { days: 1, points: 2496, source: 'task_completion' },
    { days: 10, points: 2184, source: 'task_completion' },
    { days: 60, points: 1560, source: 'task_completion' },
  ];
  const rows = buckets.map((b) => ({
    memberId: manoj.id,
    points: b.points,
    source: b.source,
    activityDate: new Date(nowMs - b.days * 24 * 60 * 60 * 1000),
  }));

  const created = await prisma.tbtActivityLog.createMany({ data: rows });
  console.log(`✅ Inserted ${created.count} rows for ${manoj.firstName} ${manoj.lastName ?? ''}`);
  console.log(`   Total: ${buckets.reduce((s, b) => s + b.points, 0).toLocaleString()} pts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

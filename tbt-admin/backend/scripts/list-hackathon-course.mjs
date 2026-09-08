// List hackathon course and its episodes
// Run: node scripts/list-hackathon-course.mjs (from tbt-admin/backend/)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany({
    where: { title: { contains: 'hackathon', mode: 'insensitive' } },
    select: {
      id: true, title: true,
      courseEpisodes: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, order: true, durationSeconds: true },
      },
    },
  });

  if (courses.length === 0) {
    const all = await prisma.course.findMany({ select: { id: true, title: true } });
    console.log('No hackathon course found. All courses:');
    all.forEach(c => console.log(`  [${c.id}] ${c.title}`));
    return;
  }

  for (const c of courses) {
    console.log(`\nCourse: ${c.title}`);
    console.log(`ID: ${c.id}`);
    console.log(`Episodes (${c.courseEpisodes.length}):`);
    for (const ep of c.courseEpisodes) {
      const mins = ep.durationSeconds ? Math.round(ep.durationSeconds / 60) : null;
      console.log(`  [${ep.order}] ${ep.id} | ${ep.title}${mins ? ` (${mins}m)` : ''}`);
    }
  }

  // Also show any existing sections
  const sectionRows = await prisma.$queryRawUnsafe(
    `SELECT cs.id, cs.title, cs.sort_order, cs.timer_seconds,
            COUNT(ce.id) as episode_count
     FROM course_sections cs
     LEFT JOIN course_episodes ce ON ce.section_id = cs.id
     WHERE cs.course_id = ANY($1::uuid[])
     GROUP BY cs.id ORDER BY cs.sort_order`,
    courses.map(c => c.id)
  );
  if (sectionRows.length > 0) {
    console.log('\nExisting sections:');
    for (const s of sectionRows) {
      console.log(`  [${s.sort_order}] ${s.id} | "${s.title}" | ${s.episode_count} episodes | timer: ${s.timer_seconds ?? 'none'}s`);
    }
  } else {
    console.log('\nNo sections yet.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

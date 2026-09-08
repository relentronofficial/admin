// Setup sections for TBT Hackathon Model course.
// Creates 8 weekly sections, assigns all 65 episodes, and sets
// timers on both sections and individual episodes.
//
// Run: node scripts/setup-hackathon-sections.mjs (from tbt-admin/backend/)
// Idempotent: skips sections that already exist by matching title.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COURSE_ID = 'a09beb11-32e1-4843-97d7-486cfcd3961b';

// ── Section definitions ────────────────────────────────────────────────────────
// timerMinutes: shown on section header in app (focus session time for the section)
// episodeOrders: the order indices of episodes that belong here
const SECTIONS = [
  {
    title: 'Week 1 – Business Model & Strategy',
    description: 'BMC, Kano Model, Unit Economics, Content Creation fundamentals',
    timerMinutes: 30,
    episodeOrders: [0, 1, 2, 3, 4],
  },
  {
    title: 'Week 2 – Website & Landing Page',
    description: 'Building and optimising your business website and landing page',
    timerMinutes: 30,
    episodeOrders: [5, 6, 7, 8],
  },
  {
    title: 'Week 3 – Meta Ads',
    description: 'Pricing revision, funnels, awareness campaigns, sales campaigns, and scaling',
    timerMinutes: 45,
    episodeOrders: [9, 10, 11, 12, 13],
  },
  {
    title: 'Week 5 – Sales',
    description: 'Sales psychology, handling techniques, proactive situations, and the complete sales process',
    timerMinutes: 45,
    episodeOrders: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
  },
  {
    title: 'Week 6 – Drip Marketing & CRM',
    description: 'Introduction to drip marketing, Privyr CRM, Bigin CRM, and Trustpilot',
    timerMinutes: 20,
    episodeOrders: [32, 33, 34, 35, 36],
  },
  {
    title: 'Week 7 – Lateral Thinking',
    description: 'Creative thinking tools: brainstorming, brainwriting, 635, reverse brainstorming, and thinking hats',
    timerMinutes: 45,
    episodeOrders: [37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51],
  },
  {
    title: 'Week 8 – Guerilla Marketing',
    description: 'Guerilla marketing strategies, live examples, and creative campaign thinking',
    timerMinutes: 30,
    episodeOrders: [52, 53, 54, 55, 56, 57, 58, 59],
  },
  {
    title: 'Week 9 – Automation',
    description: 'Marketing automation with Zapier, Instachamp, Collect.chat, and Facebook Ads integration',
    timerMinutes: 20,
    episodeOrders: [60, 61, 62, 63, 64],
  },
];

async function main() {
  // Fetch all episodes ordered by order column
  const episodes = await prisma.courseEpisode.findMany({
    where: { courseId: COURSE_ID },
    orderBy: { order: 'asc' },
    select: { id: true, title: true, order: true, durationSeconds: true },
  });

  console.log(`Found ${episodes.length} episodes for hackathon course.\n`);

  // Build order→episode map
  const byOrder = new Map(episodes.map((ep, i) => [ep.order, ep]));
  // Fallback: if orders are not 0-based sequential, use index
  const byIndex = new Map(episodes.map((ep, i) => [i, ep]));

  for (let sIdx = 0; sIdx < SECTIONS.length; sIdx++) {
    const sec = SECTIONS[sIdx];
    const timerSeconds = sec.timerMinutes * 60;

    // Check if this section already exists
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM course_sections WHERE course_id = $1::uuid AND title = $2 LIMIT 1`,
      COURSE_ID, sec.title
    );

    let sectionId;
    if (existing.length > 0) {
      sectionId = existing[0].id;
      console.log(`✓ Section already exists: "${sec.title}" (${sectionId})`);
      // Update timer in case it changed
      await prisma.$executeRawUnsafe(
        `UPDATE course_sections SET timer_seconds = $1 WHERE id = $2::uuid`,
        timerSeconds, sectionId
      );
    } else {
      const [row] = await prisma.$queryRawUnsafe(
        `INSERT INTO course_sections (course_id, title, description, sort_order, timer_seconds)
         VALUES ($1::uuid, $2, $3, $4, $5) RETURNING id`,
        COURSE_ID, sec.title, sec.description, sIdx, timerSeconds
      );
      sectionId = row.id;
      console.log(`✚ Created section [${sIdx}]: "${sec.title}" | timer: ${sec.timerMinutes}m`);
    }

    // Assign episodes to this section + set episode timers
    let assigned = 0;
    for (const orderIdx of sec.episodeOrders) {
      // Try by stored order value first, fall back to positional index
      const ep = byOrder.get(orderIdx) ?? byIndex.get(orderIdx);
      if (!ep) {
        console.log(`  ⚠️  No episode found for order index ${orderIdx}`);
        continue;
      }

      // Timer for this episode = video duration rounded up to next 5 minutes, minimum 5min
      const rawMins = ep.durationSeconds ? Math.ceil(ep.durationSeconds / 60) : 0;
      const roundedMins = rawMins > 0 ? Math.max(5, Math.ceil(rawMins / 5) * 5) : sec.timerMinutes;
      const epTimerSeconds = roundedMins * 60;

      await prisma.$executeRawUnsafe(
        `UPDATE course_episodes SET section_id = $1::uuid, timer_seconds = $2 WHERE id = $3::uuid`,
        sectionId, epTimerSeconds, ep.id
      );
      assigned++;
    }
    console.log(`  → Assigned ${assigned} episodes | episode timers set to video-duration (rounded up to 5min)\n`);
  }

  // Verify
  const final = await prisma.$queryRawUnsafe(
    `SELECT cs.title, cs.timer_seconds,
            COUNT(ce.id)::int AS episode_count,
            AVG(ce.timer_seconds)::int AS avg_ep_timer
     FROM course_sections cs
     LEFT JOIN course_episodes ce ON ce.section_id = cs.id
     WHERE cs.course_id = $1::uuid
     GROUP BY cs.id ORDER BY cs.sort_order`,
    COURSE_ID
  );

  console.log('── Final layout ─────────────────────────────────────────────');
  for (const row of final) {
    const sMin = Math.round(row.timer_seconds / 60);
    const epMin = row.avg_ep_timer ? Math.round(row.avg_ep_timer / 60) : '–';
    console.log(`  "${row.title}" | section timer: ${sMin}m | ${row.episode_count} episodes | avg episode timer: ${epMin}m`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

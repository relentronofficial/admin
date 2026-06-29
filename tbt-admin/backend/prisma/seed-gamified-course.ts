/**
 * Gamified Course Seed
 * Run: npm run seed:course   (from tbt-admin/)
 *   or: npx tsx prisma/seed-gamified-course.ts  (from backend/)
 *
 * Creates "Digital Marketing Mastery for Tamil Businesses" with:
 *   - 5 lessons, 4 of which have multi-question quizzes
 *   - xpPerEpisode: 15, passingScorePercent: 70
 *   - CourseAccess (lifetime) for all seed members
 *   - CourseEnrollment + episode progress for 3 members
 *   - MemberXP + CourseStreak records
 *   - 2 CourseBadges, one awarded to the top member
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const VIDEO_URL = 'https://iframe.mediadelivery.net/embed/674791/6bc82f7c-bb64-492b-8439-8549fd53787b';
const BUNNY_ID  = '6bc82f7c-bb64-492b-8439-8549fd53787b';
const THUMB_URL = 'https://tamil-business-tribe-cdn.b-cdn.net/thumbnails/drip-marketing.png';

// ── Quiz data for each episode ────────────────────────────────────────────────

const QUIZZES = {
  ep2: {
    questions: [
      {
        id: 'ep2q1', question: 'What is the primary purpose of creating a customer avatar?',
        options: [
          { id: 'a', text: 'To visualise your ideal customer and understand their needs', correct: true },
          { id: 'b', text: 'To make marketing materials look better', correct: false },
          { id: 'c', text: 'To set your product price automatically', correct: false },
          { id: 'd', text: 'To track competitor activity', correct: false },
        ],
      },
      {
        id: 'ep2q2', question: 'Which is most important when researching your target audience?',
        options: [
          { id: 'a', text: 'Their favourite colours and hobbies', correct: false },
          { id: 'b', text: 'Their pain points and core challenges', correct: true },
          { id: 'c', text: 'The size of their home', correct: false },
          { id: 'd', text: 'Their educational qualifications only', correct: false },
        ],
      },
      {
        id: 'ep2q3', question: 'What does "niche down" mean in marketing?',
        options: [
          { id: 'a', text: 'Reduce your prices to attract more buyers', correct: false },
          { id: 'b', text: 'Stop marketing to existing customers', correct: false },
          { id: 'c', text: 'Focus on a specific, well-defined market segment', correct: true },
          { id: 'd', text: 'Partner with larger businesses in your industry', correct: false },
        ],
      },
    ],
  },
  ep3: {
    questions: [
      {
        id: 'ep3q1', question: 'What does the AIDA model stand for?',
        options: [
          { id: 'a', text: 'Attention, Interest, Desire, Action', correct: true },
          { id: 'b', text: 'Advertise, Inform, Distribute, Analyse', correct: false },
          { id: 'c', text: 'Audience, Intent, Data, Analytics', correct: false },
          { id: 'd', text: 'Awareness, Influence, Deliver, Achieve', correct: false },
        ],
      },
      {
        id: 'ep3q2', question: 'Which content type typically generates the highest social media engagement?',
        options: [
          { id: 'a', text: 'Long text posts with detailed information', correct: false },
          { id: 'b', text: 'Video content', correct: true },
          { id: 'c', text: 'Plain text advertisements', correct: false },
          { id: 'd', text: 'PDF documents shared as attachments', correct: false },
        ],
      },
      {
        id: 'ep3q3', question: 'What is a "call to action" (CTA)?',
        options: [
          { id: 'a', text: 'A phone number displayed on your website', correct: false },
          { id: 'b', text: 'An instruction encouraging the audience to take a specific next step', correct: true },
          { id: 'c', text: 'A customer complaint form', correct: false },
          { id: 'd', text: 'A discount code for new customers', correct: false },
        ],
      },
      {
        id: 'ep3q4', question: 'How often should you post content for consistent business growth?',
        options: [
          { id: 'a', text: 'Once a month is enough', correct: false },
          { id: 'b', text: 'Only when you have a new product to announce', correct: false },
          { id: 'c', text: 'Consistently, on a regular and planned schedule', correct: true },
          { id: 'd', text: 'Only on weekends when people are free', correct: false },
        ],
      },
    ],
  },
  ep4: {
    questions: [
      {
        id: 'ep4q1', question: 'What is the best approach to choosing social media platforms?',
        options: [
          { id: 'a', text: 'Be equally active on every platform available', correct: false },
          { id: 'b', text: 'Choose platforms where your target audience is most active', correct: true },
          { id: 'c', text: 'Only use the single most popular platform globally', correct: false },
          { id: 'd', text: 'Use whichever platform you personally enjoy the most', correct: false },
        ],
      },
      {
        id: 'ep4q2', question: 'What is the recommended ratio of value to promotional content?',
        options: [
          { id: 'a', text: '100% promotional posts only', correct: false },
          { id: 'b', text: '80% promotional, 20% value content', correct: false },
          { id: 'c', text: '80% value content, 20% promotional posts', correct: true },
          { id: 'd', text: '50% promotional, 50% value equally', correct: false },
        ],
      },
      {
        id: 'ep4q3', question: 'What does "social proof" mean in digital marketing?',
        options: [
          { id: 'a', text: 'Proof that your business has social media accounts', correct: false },
          { id: 'b', text: 'Screenshots of your social media posts', correct: false },
          { id: 'c', text: 'Evidence from existing customers validating your product or service', correct: true },
          { id: 'd', text: 'The total number of followers on your profiles', correct: false },
        ],
      },
    ],
  },
  ep5: {
    questions: [
      {
        id: 'ep5q1', question: 'What does ROI stand for in marketing?',
        options: [
          { id: 'a', text: 'Return on Investment', correct: true },
          { id: 'b', text: 'Revenue on Income', correct: false },
          { id: 'c', text: 'Rate of Interest', correct: false },
          { id: 'd', text: 'Return on Initiative', correct: false },
        ],
      },
      {
        id: 'ep5q2', question: 'Which metric measures how many visitors take a desired action on your site?',
        options: [
          { id: 'a', text: 'Total page views', correct: false },
          { id: 'b', text: 'Bounce rate', correct: false },
          { id: 'c', text: 'Conversion rate', correct: true },
          { id: 'd', text: 'Click-through rate', correct: false },
        ],
      },
      {
        id: 'ep5q3', question: 'What is the correct formula for calculating ROI?',
        options: [
          { id: 'a', text: '(Revenue ÷ Cost) × 100', correct: false },
          { id: 'b', text: '((Revenue − Cost) ÷ Cost) × 100', correct: true },
          { id: 'c', text: 'Revenue − Cost only', correct: false },
          { id: 'd', text: 'Cost ÷ Revenue × 100', correct: false },
        ],
      },
      {
        id: 'ep5q4', question: 'What is a KPI in digital marketing?',
        options: [
          { id: 'a', text: 'Key Product Item', correct: false },
          { id: 'b', text: 'Known Platform Insight', correct: false },
          { id: 'c', text: 'Key Performance Indicator', correct: true },
          { id: 'd', text: 'Knowledge Process Integration', correct: false },
        ],
      },
    ],
  },
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎮 Seeding gamified course data...\n');

  // ── Resolve admin ────────────────────────────────────────────────────────────
  const admin = await prisma.admin.findFirst({ where: { role: 'super_admin' } });
  if (!admin) {
    console.error('❌ Super admin not found. Run: npx prisma db seed first');
    process.exit(1);
  }

  // ── Resolve members from sample seed ────────────────────────────────────────
  const memberEmails = [
    'arjun.sub@test.tbt',
    'priya.k@test.tbt',
    'ravi.m@test.tbt',
    'deepika.n@test.tbt',
    'karthik.s@test.tbt',
  ];
  const members = await prisma.member.findMany({
    where: { email: { in: memberEmails } },
    orderBy: { firstName: 'asc' },
  });
  if (members.length === 0) {
    console.error('❌ No seed members found. Run: npx tsx prisma/seed-sample.ts first');
    process.exit(1);
  }
  console.log(`✅ Found ${members.length} members`);

  // ── Wipe any previous gamified course ───────────────────────────────────────
  const prev = await prisma.course.findFirst({ where: { slug: 'digital-marketing-mastery-tbt' } });
  if (prev) {
    // Cascade deletes episodes, access, enrollment, XP, streaks via FK
    await prisma.course.delete({ where: { id: prev.id } });
    console.log('🗑  Removed previous gamified course');
  }
  // Also clean up any orphaned badges with this slug prefix
  await (prisma as any).courseBadge.deleteMany({
    where: { slug: { in: ['dmm-fast-learner', 'dmm-quiz-champion'] } },
  });

  // ── Create course ────────────────────────────────────────────────────────────
  console.log('📚 Creating course...');
  const course = await (prisma as any).course.create({
    data: {
      title: 'Digital Marketing Mastery for Tamil Businesses',
      slug: 'digital-marketing-mastery-tbt',
      description:
        'A practical, step-by-step guide to digital marketing built for Tamil entrepreneurs. Learn to attract customers online, create content that converts, and measure every rupee of ROI — with quizzes and XP rewards at every step.',
      thumbnailUrl: THUMB_URL,
      level: 'beginner',
      isActive: true,
      isPublished: true,
      isFeatured: true,
      status: 'published',
      sortOrder: 0,
      requiredTier: 1,
      xpPerEpisode: 15,
      passingScorePercent: 70,
      durationHours: 2.5,
      createdBy: admin.id,
    },
  });
  console.log(`   ✅ Course: ${course.title}  (id: ${course.id})`);

  // ── Create 5 episodes ────────────────────────────────────────────────────────
  console.log('🎬 Creating episodes...');
  const episodeDefs = [
    {
      order: 1,
      title: 'Why Digital Marketing Matters for Tamil Businesses',
      durationSeconds: 900,   // 15 min
      quizData: null,         // no quiz — reflection triggers directly on completion
      quizUnlockPercent: 80,
    },
    {
      order: 2,
      title: 'Understanding Your Target Customer',
      durationSeconds: 1200,  // 20 min
      quizData: QUIZZES.ep2,
      quizUnlockPercent: 80,
    },
    {
      order: 3,
      title: 'Creating Content That Converts',
      durationSeconds: 1500,  // 25 min
      quizData: QUIZZES.ep3,
      quizUnlockPercent: 80,
    },
    {
      order: 4,
      title: 'Social Media Strategy for Your Business',
      durationSeconds: 1200,  // 20 min
      quizData: QUIZZES.ep4,
      quizUnlockPercent: 80,
    },
    {
      order: 5,
      title: 'Measuring Your Marketing ROI',
      durationSeconds: 1800,  // 30 min
      quizData: QUIZZES.ep5,
      quizUnlockPercent: 75,
    },
  ];

  const episodes: any[] = [];
  for (const ep of episodeDefs) {
    const created = await (prisma as any).courseEpisode.create({
      data: {
        courseId: course.id,
        order: ep.order,
        title: ep.title,
        thumbnailUrl: THUMB_URL,
        videoUrl: VIDEO_URL,
        bunnyVideoId: BUNNY_ID,
        durationSeconds: ep.durationSeconds,
        isVisible: true,
        quizData: ep.quizData,
        quizUnlockPercent: ep.quizUnlockPercent,
      },
    });
    episodes.push(created);
    console.log(`   ✅ Ep${ep.order}: ${ep.title}${ep.quizData ? ' [+Quiz]' : ''}`);
  }

  // ── Grant course access (lifetime) to all members ────────────────────────────
  console.log('\n🔑 Granting course access...');
  for (const m of members) {
    await (prisma as any).courseAccess.upsert({
      where: { memberId_courseId: { memberId: m.id, courseId: course.id } },
      create: {
        memberId: m.id,
        courseId: course.id,
        grantedBy: admin.id,
        accessType: 'lifetime',
        isActive: true,
        notes: 'Granted via seed script',
      },
      update: { isActive: true },
    });
  }
  console.log(`   ✅ Access granted to ${members.length} members`);

  // ── Create enrollments ───────────────────────────────────────────────────────
  console.log('\n📋 Creating enrollments...');
  for (const m of members) {
    await (prisma as any).courseEnrollment.upsert({
      where: { memberId_courseId: { memberId: m.id, courseId: course.id } },
      create: { memberId: m.id, courseId: course.id, progressPercentage: 0 },
      update: {},
    });
  }

  // ── Seed episode progress ────────────────────────────────────────────────────
  // Member 0 (Arjun): all 5 episodes completed
  // Member 1 (Deepika): first 3 completed, ep4 partially watched
  // Member 2 (Karthik): first 1 completed, ep2 in progress
  console.log('\n📊 Seeding episode progress...');

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  // Member 0: 5/5 complete (acts as the star student for leaderboard)
  const m0 = members[0];
  for (let i = 0; i < episodes.length; i++) {
    await (prisma as any).courseEpisodeProgress.upsert({
      where: { memberId_episodeId: { memberId: m0.id, episodeId: episodes[i].id } },
      create: {
        memberId: m0.id,
        episodeId: episodes[i].id,
        completed: true,
        completedAt: daysAgo(8 - i),    // completed over past week, oldest first
        lastWatchedSecs: episodes[i].durationSeconds,
        actualWatchedSecs: episodes[i].durationSeconds,
      },
      update: {},
    });
  }

  // Member 1: 3/5 complete, ep4 partially watched
  const m1 = members[1];
  for (let i = 0; i < 3; i++) {
    await (prisma as any).courseEpisodeProgress.upsert({
      where: { memberId_episodeId: { memberId: m1.id, episodeId: episodes[i].id } },
      create: {
        memberId: m1.id,
        episodeId: episodes[i].id,
        completed: true,
        completedAt: daysAgo(5 - i),
        lastWatchedSecs: episodes[i].durationSeconds,
        actualWatchedSecs: episodes[i].durationSeconds,
      },
      update: {},
    });
  }
  // ep4 — 60% watched, not yet complete
  await (prisma as any).courseEpisodeProgress.upsert({
    where: { memberId_episodeId: { memberId: m1.id, episodeId: episodes[3].id } },
    create: {
      memberId: m1.id,
      episodeId: episodes[3].id,
      completed: false,
      lastWatchedSecs: Math.floor(episodes[3].durationSeconds * 0.6),
      actualWatchedSecs: Math.floor(episodes[3].durationSeconds * 0.6),
    },
    update: {},
  });

  // Member 2: ep1 complete, ep2 in progress
  const m2 = members[2];
  await (prisma as any).courseEpisodeProgress.upsert({
    where: { memberId_episodeId: { memberId: m2.id, episodeId: episodes[0].id } },
    create: {
      memberId: m2.id,
      episodeId: episodes[0].id,
      completed: true,
      completedAt: daysAgo(2),
      lastWatchedSecs: episodes[0].durationSeconds,
      actualWatchedSecs: episodes[0].durationSeconds,
    },
    update: {},
  });
  await (prisma as any).courseEpisodeProgress.upsert({
    where: { memberId_episodeId: { memberId: m2.id, episodeId: episodes[1].id } },
    create: {
      memberId: m2.id,
      episodeId: episodes[1].id,
      completed: false,
      lastWatchedSecs: Math.floor(episodes[1].durationSeconds * 0.4),
      actualWatchedSecs: Math.floor(episodes[1].durationSeconds * 0.4),
    },
    update: {},
  });

  console.log('   ✅ Arjun: 5/5 lessons done');
  console.log('   ✅ Deepika: 3/5 done, ep4 in progress');
  console.log('   ✅ Karthik: 1/5 done, ep2 in progress');

  // ── Seed MemberXP ────────────────────────────────────────────────────────────
  console.log('\n⚡ Seeding XP...');

  // Member 0: 5 episodes × 15 XP + 3 quiz passes × 15 XP = 120 XP
  for (let i = 0; i < episodes.length; i++) {
    await (prisma as any).memberXP.create({
      data: { memberId: m0.id, courseId: course.id, source: 'episode_complete', amount: 15, earnedAt: daysAgo(8 - i) },
    });
  }
  // bonus quiz XP for episodes that have quizzes (ep2-ep5)
  for (let i = 1; i < episodes.length; i++) {
    await (prisma as any).memberXP.create({
      data: { memberId: m0.id, courseId: course.id, source: 'quiz_pass', amount: 15, earnedAt: daysAgo(8 - i) },
    });
  }

  // Member 1: 3 episodes + 2 quiz passes = 75 XP
  for (let i = 0; i < 3; i++) {
    await (prisma as any).memberXP.create({
      data: { memberId: m1.id, courseId: course.id, source: 'episode_complete', amount: 15, earnedAt: daysAgo(5 - i) },
    });
  }
  for (let i = 1; i < 3; i++) {
    await (prisma as any).memberXP.create({
      data: { memberId: m1.id, courseId: course.id, source: 'quiz_pass', amount: 15, earnedAt: daysAgo(5 - i) },
    });
  }

  // Member 2: 1 episode = 15 XP
  await (prisma as any).memberXP.create({
    data: { memberId: m2.id, courseId: course.id, source: 'episode_complete', amount: 15, earnedAt: daysAgo(2) },
  });

  console.log('   ✅ XP seeded: Arjun 120 XP, Deepika 75 XP, Karthik 15 XP');

  // ── Seed CourseStreak ────────────────────────────────────────────────────────
  console.log('\n🔥 Seeding streaks...');
  await (prisma as any).courseStreak.upsert({
    where: { memberId_courseId: { memberId: m0.id, courseId: course.id } },
    create: { memberId: m0.id, courseId: course.id, currentStreak: 5, longestStreak: 7, lastActivityAt: daysAgo(0) },
    update: { currentStreak: 5, longestStreak: 7, lastActivityAt: daysAgo(0) },
  });
  await (prisma as any).courseStreak.upsert({
    where: { memberId_courseId: { memberId: m1.id, courseId: course.id } },
    create: { memberId: m1.id, courseId: course.id, currentStreak: 3, longestStreak: 3, lastActivityAt: daysAgo(1) },
    update: { currentStreak: 3, longestStreak: 3, lastActivityAt: daysAgo(1) },
  });
  await (prisma as any).courseStreak.upsert({
    where: { memberId_courseId: { memberId: m2.id, courseId: course.id } },
    create: { memberId: m2.id, courseId: course.id, currentStreak: 1, longestStreak: 2, lastActivityAt: daysAgo(2) },
    update: { currentStreak: 1, longestStreak: 2, lastActivityAt: daysAgo(2) },
  });
  console.log('   ✅ Streaks: Arjun 5d, Deepika 3d, Karthik 1d');

  // ── Seed CourseBadges ────────────────────────────────────────────────────────
  console.log('\n🏅 Seeding badges...');
  const badge1 = await (prisma as any).courseBadge.create({
    data: {
      courseId: course.id,
      slug: 'dmm-fast-learner',
      label: 'Fast Learner',
      iconUrl: 'https://tamil-business-tribe-cdn.b-cdn.net/thumbnails/screenshot-2026.png',
      criteria: { description: 'Complete the course within 7 days of first access' },
    },
  });
  const badge2 = await (prisma as any).courseBadge.create({
    data: {
      courseId: course.id,
      slug: 'dmm-quiz-champion',
      label: 'Quiz Champion',
      iconUrl: 'https://tamil-business-tribe-cdn.b-cdn.net/thumbnails/screenshot-2026.png',
      criteria: { description: 'Pass all episode quizzes with 100% score' },
    },
  });

  // Award both badges to member 0 (completed all + all quizzes)
  await (prisma as any).memberCourseBadge.upsert({
    where: { memberId_badgeId: { memberId: m0.id, badgeId: badge1.id } },
    create: { memberId: m0.id, badgeId: badge1.id, earnedAt: daysAgo(3) },
    update: {},
  });
  await (prisma as any).memberCourseBadge.upsert({
    where: { memberId_badgeId: { memberId: m0.id, badgeId: badge2.id } },
    create: { memberId: m0.id, badgeId: badge2.id, earnedAt: daysAgo(2) },
    update: {},
  });
  console.log(`   ✅ Badge "${badge1.label}" created and awarded to ${m0.firstName}`);
  console.log(`   ✅ Badge "${badge2.label}" created and awarded to ${m0.firstName}`);

  // ── Quiz attempts for member 0 ───────────────────────────────────────────────
  console.log('\n📝 Seeding quiz attempts...');
  // ep2 quiz — all correct (100%)
  await (prisma as any).courseQuizAttempt.create({
    data: {
      memberId: m0.id,
      episodeId: episodes[1].id,
      answers: { ep2q1: 'a', ep2q2: 'b', ep2q3: 'c' },
      score: 100,
      passed: true,
      attemptedAt: daysAgo(7),
    },
  });
  // ep3 quiz — 3/4 correct (75%)
  await (prisma as any).courseQuizAttempt.create({
    data: {
      memberId: m0.id,
      episodeId: episodes[2].id,
      answers: { ep3q1: 'a', ep3q2: 'b', ep3q3: 'b', ep3q4: 'c' },
      score: 75,
      passed: true,
      attemptedAt: daysAgo(6),
    },
  });
  // ep4 quiz — all correct (100%)
  await (prisma as any).courseQuizAttempt.create({
    data: {
      memberId: m0.id,
      episodeId: episodes[3].id,
      answers: { ep4q1: 'b', ep4q2: 'c', ep4q3: 'c' },
      score: 100,
      passed: true,
      attemptedAt: daysAgo(5),
    },
  });
  // ep5 quiz — all correct (100%)
  await (prisma as any).courseQuizAttempt.create({
    data: {
      memberId: m0.id,
      episodeId: episodes[4].id,
      answers: { ep5q1: 'a', ep5q2: 'c', ep5q3: 'b', ep5q4: 'c' },
      score: 100,
      passed: true,
      attemptedAt: daysAgo(3),
    },
  });
  // Member 1: ep2 + ep3 quiz attempts
  await (prisma as any).courseQuizAttempt.create({
    data: {
      memberId: m1.id,
      episodeId: episodes[1].id,
      answers: { ep2q1: 'a', ep2q2: 'b', ep2q3: 'c' },
      score: 100,
      passed: true,
      attemptedAt: daysAgo(4),
    },
  });
  await (prisma as any).courseQuizAttempt.create({
    data: {
      memberId: m1.id,
      episodeId: episodes[2].id,
      answers: { ep3q1: 'a', ep3q2: 'b', ep3q3: 'b', ep3q4: 'a' },
      score: 75,
      passed: true,
      attemptedAt: daysAgo(3),
    },
  });
  console.log('   ✅ Quiz attempts seeded');

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('🎉 Gamified course seeded successfully!\n');
  console.log(`   Course:   ${course.title}`);
  console.log(`   ID:       ${course.id}`);
  console.log(`   URL:      /learning/${course.id}`);
  console.log(`   Episodes: ${episodes.length} (4 with quizzes)`);
  console.log(`   XP/ep:    15  |  Pass score: 70%`);
  console.log(`   Members:  ${members.length} granted access`);
  console.log(`   Badges:   Fast Learner, Quiz Champion`);
  console.log('─'.repeat(60));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

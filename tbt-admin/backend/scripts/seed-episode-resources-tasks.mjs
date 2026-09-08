// Seed dummy resources and tasks for course episodes.
// Idempotent — skips episodes that already have resources/tasks attached.
//
// Run with: node scripts/seed-episode-resources-tasks.mjs (from tbt-admin/backend/)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Public sample files for resources
const SAMPLE_PDF = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
const SAMPLE_XLSX = 'https://file-examples.com/storage/fe6b9df3be64ddb39702ad7/2017/02/file_example_XLS_10.xls';

const RESOURCE_TEMPLATES = [
  {
    title: 'Episode Slides',
    fileType: 'pdf',
    fileUrl: SAMPLE_PDF,
    previewUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=280&fit=crop',
    description: 'Download the presentation slides for this lesson to follow along and take notes.',
    isVisible: true,
  },
  {
    title: 'Worksheet & Exercises',
    fileType: 'pdf',
    fileUrl: SAMPLE_PDF,
    previewUrl: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=400&h=280&fit=crop',
    description: 'Practice worksheet with exercises to reinforce the concepts covered in this episode.',
    isVisible: true,
  },
  {
    title: 'Reference Cheat Sheet',
    fileType: 'pdf',
    fileUrl: SAMPLE_PDF,
    previewUrl: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=400&h=280&fit=crop',
    description: 'Quick-reference summary of key formulas, frameworks, and steps from this lesson.',
    isVisible: true,
  },
  {
    title: 'Template — Action Plan',
    fileType: 'xlsx',
    fileUrl: SAMPLE_XLSX,
    previewUrl: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=280&fit=crop',
    description: 'Editable action-plan spreadsheet. Fill it in as you watch to plan your next steps.',
    isVisible: true,
  },
];

const TASK_TEMPLATES = [
  {
    title: 'Watch & Reflect',
    description: 'Watch the full episode and write 3 key takeaways that you can apply to your business this week.',
    deliverables: 'A short written response (3–5 sentences) listing your takeaways.',
    proofType: 'text',
    basePoints: 50,
    estimatedMinutes: 20,
    isMilestone: false,
    bonusPoints: 0,
    sortOrder: 1,
  },
  {
    title: 'Apply the Framework',
    description: 'Apply the framework taught in this episode to your own business or a case study. Document your process and outcome.',
    deliverables: 'Screenshot or photo of your completed framework, or a written explanation of how you applied it.',
    proofType: 'image',
    basePoints: 100,
    estimatedMinutes: 45,
    isMilestone: false,
    bonusPoints: 0,
    sortOrder: 2,
  },
  {
    title: 'Share Your Win',
    description: 'Implement one action from this lesson and share a photo or short video of your result in the community.',
    deliverables: 'Photo or video showing the outcome of applying this lesson\'s action.',
    proofType: 'video',
    basePoints: 150,
    estimatedMinutes: 60,
    isMilestone: true,
    milestoneLabel: 'Action Taker',
    bonusPoints: 50,
    sortOrder: 3,
  },
];

async function withRetry(fn, label, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === retries) throw e;
      console.log(`  ⚠ retry ${attempt}/${retries} for ${label}: ${e.message}`);
      await new Promise(r => setTimeout(r, 1500 * attempt));
      try { await prisma.$disconnect(); } catch (_) {}
      try { await prisma.$connect(); } catch (_) {}
    }
  }
}

async function seedEpisode(episode, epIndex) {
  // Check if resources already exist for this episode
  const existingResources = await withRetry(
    () => prisma.$queryRawUnsafe(`SELECT id FROM app_resources WHERE course_episode_id = $1::uuid LIMIT 1`, episode.id),
    episode.title
  );
  const existingTasks = await withRetry(
    () => prisma.$queryRawUnsafe(`SELECT id FROM tasks WHERE course_episode_id = $1::uuid LIMIT 1`, episode.id),
    episode.title
  );

  const hasResources = existingResources.length > 0;
  const hasTasks = existingTasks.length > 0;

  if (hasResources && hasTasks) {
    console.log(`  ✓ episode already seeded: ${episode.title}`);
    return;
  }

  // Pick 2–3 resources based on episode index (cycle through templates)
  if (!hasResources) {
    const count = (epIndex % 2 === 0) ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const tmpl = RESOURCE_TEMPLATES[i % RESOURCE_TEMPLATES.length];
      const res = await withRetry(() => prisma.appResource.create({
        data: {
          title: tmpl.title,
          fileType: tmpl.fileType,
          fileUrl: tmpl.fileUrl,
          previewUrl: tmpl.previewUrl,
          description: tmpl.description,
          isVisible: tmpl.isVisible,
          order: i + 1,
        },
      }), `resource:${tmpl.title}`);
      await withRetry(() => prisma.$executeRawUnsafe(
        `UPDATE app_resources SET course_episode_id = $1::uuid WHERE id = $2::uuid`,
        episode.id, res.id
      ), `link resource`);
    }
    console.log(`  + resources added to: ${episode.title}`);
  }

  // Pick 1–2 tasks based on episode index
  if (!hasTasks) {
    const count = (epIndex % 3 === 0) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const tmpl = TASK_TEMPLATES[i % TASK_TEMPLATES.length];
      const task = await withRetry(() => prisma.task.create({
        data: {
          title: tmpl.title,
          description: tmpl.description,
          deliverables: tmpl.deliverables,
          proofType: tmpl.proofType,
          basePoints: tmpl.basePoints,
          estimatedMinutes: tmpl.estimatedMinutes,
          isMilestone: tmpl.isMilestone,
          milestoneLabel: tmpl.milestoneLabel ?? null,
          bonusPoints: tmpl.bonusPoints,
          sortOrder: tmpl.sortOrder,
          dayNumber: 1,
        },
      }), `task:${tmpl.title}`);
      await withRetry(() => prisma.$executeRawUnsafe(
        `UPDATE tasks SET course_episode_id = $1::uuid WHERE id = $2::uuid`,
        episode.id, task.id
      ), `link task`);
    }
    console.log(`  + tasks added to: ${episode.title}`);
  }
}

async function main() {
  // Ensure startup columns exist (normally created by prisma.ts on server boot)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE app_resources ADD COLUMN IF NOT EXISTS course_episode_id UUID REFERENCES course_episodes(id) ON DELETE CASCADE`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS course_episode_id UUID REFERENCES course_episodes(id) ON DELETE CASCADE`
  );

  console.log('\n── Fetching courses and episodes ──');

  const courses = await prisma.course.findMany({
    include: { courseEpisodes: { orderBy: { order: 'asc' } } },
  });

  if (courses.length === 0) {
    console.log('  No courses found. Create at least one course with episodes first.');
    return;
  }

  for (const course of courses) {
    const episodes = course.courseEpisodes;
    if (episodes.length === 0) {
      console.log(`\n  Course "${course.title}" has no episodes — skipping.`);
      continue;
    }
    console.log(`\n── Course: ${course.title} (${episodes.length} episodes) ──`);
    for (let i = 0; i < episodes.length; i++) {
      await seedEpisode(episodes[i], i);
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log('\n✓ Seed complete.\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

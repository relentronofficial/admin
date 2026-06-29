/**
 * Seed: Add mid-video cue quizzes to Digital Marketing Fundamentals episodes.
 * Run: npx tsx prisma/seed-cue-quizzes-dmf.ts  (from backend/)
 *
 * Episode durations: Ep1=26s, Ep2=30s, Ep3=46s
 * Cue timestamps are chosen to fire well before the end of each episode.
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const CUE_QUIZZES: Record<number, Array<{ id: string; atSeconds: number; questions: any[] }>> = {
  1: [
    {
      id: 'dmf-ep1-cue-1',
      atSeconds: 12,
      questions: [
        {
          id: 'dmf-ep1c1q1',
          question: 'What does "digital marketing" primarily use to reach customers?',
          options: [
            { id: 'a', text: 'Printed flyers and posters', correct: false },
            { id: 'b', text: 'Internet and digital channels', correct: true },
            { id: 'c', text: 'Radio advertisements only', correct: false },
            { id: 'd', text: 'Physical store displays', correct: false },
          ],
        },
      ],
    },
  ],

  2: [
    {
      id: 'dmf-ep2-cue-1',
      atSeconds: 15,
      questions: [
        {
          id: 'dmf-ep2c1q1',
          question: 'Which of the following is a core concept in digital marketing?',
          options: [
            { id: 'a', text: 'Print media distribution', correct: false },
            { id: 'b', text: 'SEO — Search Engine Optimisation', correct: true },
            { id: 'c', text: 'Cold calling telephone lists', correct: false },
            { id: 'd', text: 'Billboard placement strategy', correct: false },
          ],
        },
        {
          id: 'dmf-ep2c1q2',
          question: 'What does "conversion" mean in digital marketing?',
          options: [
            { id: 'a', text: 'Converting a video file to MP4 format', correct: false },
            { id: 'b', text: 'A visitor completing a desired action (purchase, sign-up, etc.)', correct: true },
            { id: 'c', text: 'Switching your website to a new platform', correct: false },
            { id: 'd', text: 'Translating your website into another language', correct: false },
          ],
        },
      ],
    },
  ],

  3: [
    {
      id: 'dmf-ep3-cue-1',
      atSeconds: 15,
      questions: [
        {
          id: 'dmf-ep3c1q1',
          question: 'Which advanced technique helps you show ads to people who already visited your website?',
          options: [
            { id: 'a', text: 'Cold outreach emails', correct: false },
            { id: 'b', text: 'Retargeting / Remarketing', correct: true },
            { id: 'c', text: 'Press release distribution', correct: false },
            { id: 'd', text: 'Print catalogue mailing', correct: false },
          ],
        },
      ],
    },
    {
      id: 'dmf-ep3-cue-2',
      atSeconds: 35,
      questions: [
        {
          id: 'dmf-ep3c2q1',
          question: 'What is A/B testing used for in digital marketing?',
          options: [
            { id: 'a', text: 'Testing internet connection speed', correct: false },
            { id: 'b', text: 'Comparing two versions of a page/ad to see which performs better', correct: true },
            { id: 'c', text: 'Grading your website on a scale from A to B', correct: false },
            { id: 'd', text: 'Choosing between two website hosting providers', correct: false },
          ],
        },
        {
          id: 'dmf-ep3c2q2',
          question: 'Which best practice helps improve your email open rates?',
          options: [
            { id: 'a', text: 'Sending emails at the same time every single day', correct: false },
            { id: 'b', text: 'Writing a compelling, personalised subject line', correct: true },
            { id: 'c', text: 'Using as many images as possible', correct: false },
            { id: 'd', text: 'Keeping the email body empty for minimalism', correct: false },
          ],
        },
      ],
    },
  ],
};

async function main() {
  console.log('🎯 Adding mid-video cue quizzes to Digital Marketing Fundamentals episodes...\n');

  const course = await (prisma as any).course.findFirst({
    where: { slug: 'digital-marketing-fundamentals' },
  });
  if (!course) {
    console.error('❌ Course not found: digital-marketing-fundamentals');
    process.exit(1);
  }
  console.log(`✅ Found course: ${course.title}  (id: ${course.id})\n`);

  const episodes = await (prisma as any).courseEpisode.findMany({
    where: { courseId: course.id },
    orderBy: { order: 'asc' },
  });

  for (const ep of episodes) {
    const cues = CUE_QUIZZES[ep.order];
    if (!cues) {
      console.log(`⏭  Ep${ep.order}: no cues defined — skipped`);
      continue;
    }

    const existing = ep.quizData as any;
    const updatedQuizData = {
      questions: existing?.questions ?? [],
      cues,
    };

    await (prisma as any).courseEpisode.update({
      where: { id: ep.id },
      data: { quizData: updatedQuizData },
    });

    console.log(`✅ Ep${ep.order}: "${ep.title}"`);
    console.log(`   Duration: ${ep.durationSeconds}s`);
    console.log(`   Mid-video cues: ${cues.length} (at ${cues.map(c => `${c.atSeconds}s`).join(', ')})`);
    console.log(`   Cue questions:  ${cues.reduce((acc, c) => acc + c.questions.length, 0)} total\n`);
  }

  console.log('🎉 Done! Cue quizzes added to Digital Marketing Fundamentals.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

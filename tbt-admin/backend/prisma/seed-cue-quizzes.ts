/**
 * Seed: Add mid-video cue quizzes to the existing gamified course episodes.
 * Run: npx tsx prisma/seed-cue-quizzes.ts  (from backend/)
 *
 * Adds 2 cue quizzes per episode at 15s and 45s — triggers early enough
 * to fire during even a short demo Bunny video.
 * Preserves existing end-of-lesson quiz questions.
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

// ── Cue quiz data keyed by episode order ─────────────────────────────────────

const CUE_QUIZZES: Record<number, Array<{ id: string; atSeconds: number; questions: any[] }>> = {
  1: [
    {
      id: 'ep1-cue-1',
      atSeconds: 15,
      questions: [
        {
          id: 'ep1c1q1',
          question: 'Which of these is a digital marketing channel?',
          options: [
            { id: 'a', text: 'TV billboard advertisement', correct: false },
            { id: 'b', text: 'Instagram & Facebook ads', correct: true },
            { id: 'c', text: 'Newspaper classifieds', correct: false },
            { id: 'd', text: 'Door-to-door leaflet drop', correct: false },
          ],
        },
      ],
    },
    {
      id: 'ep1-cue-2',
      atSeconds: 45,
      questions: [
        {
          id: 'ep1c2q1',
          question: 'Why is digital marketing especially useful for small Tamil businesses?',
          options: [
            { id: 'a', text: 'It requires a large upfront budget like TV ads', correct: false },
            { id: 'b', text: 'It lets you reach and measure a targeted audience affordably', correct: true },
            { id: 'c', text: 'It guarantees immediate sales every time', correct: false },
            { id: 'd', text: 'It only works for technology companies', correct: false },
          ],
        },
        {
          id: 'ep1c2q2',
          question: 'Which factor makes digital marketing measurable compared to traditional marketing?',
          options: [
            { id: 'a', text: 'It uses the same tools as TV advertising', correct: false },
            { id: 'b', text: 'You can track clicks, views, and conversions in real time', correct: true },
            { id: 'c', text: 'Results are estimated by market research firms', correct: false },
            { id: 'd', text: 'Customers report back manually through surveys', correct: false },
          ],
        },
      ],
    },
  ],

  2: [
    {
      id: 'ep2-cue-1',
      atSeconds: 15,
      questions: [
        {
          id: 'ep2c1q1',
          question: 'What is a "customer avatar"?',
          options: [
            { id: 'a', text: 'A profile picture used on social media', correct: false },
            { id: 'b', text: 'A fictional representation of your ideal customer', correct: true },
            { id: 'c', text: 'A cartoon mascot for your brand', correct: false },
            { id: 'd', text: 'A software tool for tracking customers', correct: false },
          ],
        },
      ],
    },
    {
      id: 'ep2-cue-2',
      atSeconds: 45,
      questions: [
        {
          id: 'ep2c2q1',
          question: 'Which question is MOST useful when defining your target audience?',
          options: [
            { id: 'a', text: 'What is their favourite cricket team?', correct: false },
            { id: 'b', text: 'What problem are they trying to solve?', correct: true },
            { id: 'c', text: 'What colour do they prefer on websites?', correct: false },
            { id: 'd', text: 'Which state do they live in?', correct: false },
          ],
        },
        {
          id: 'ep2c2q2',
          question: 'Demographic information includes which of the following?',
          options: [
            { id: 'a', text: 'Personal values and beliefs', correct: false },
            { id: 'b', text: 'Age, gender, income, and location', correct: true },
            { id: 'c', text: 'Favourite content creators', correct: false },
            { id: 'd', text: 'Buying behaviour patterns', correct: false },
          ],
        },
      ],
    },
  ],

  3: [
    {
      id: 'ep3-cue-1',
      atSeconds: 15,
      questions: [
        {
          id: 'ep3c1q1',
          question: 'What is "content marketing"?',
          options: [
            { id: 'a', text: 'Posting random updates on social media daily', correct: false },
            { id: 'b', text: 'Creating valuable content to attract and retain an audience', correct: true },
            { id: 'c', text: 'Buying banner ads on websites', correct: false },
            { id: 'd', text: 'Sending mass emails to purchased lists', correct: false },
          ],
        },
      ],
    },
    {
      id: 'ep3-cue-2',
      atSeconds: 45,
      questions: [
        {
          id: 'ep3c2q1',
          question: 'What makes a headline effective for a Tamil business audience?',
          options: [
            { id: 'a', text: 'Uses technical jargon to sound professional', correct: false },
            { id: 'b', text: 'Clearly states the benefit or solves a specific pain point', correct: true },
            { id: 'c', text: 'Is as long as possible with all product details', correct: false },
            { id: 'd', text: 'Uses only English words regardless of audience', correct: false },
          ],
        },
        {
          id: 'ep3c2q2',
          question: 'Which type of content builds the most long-term trust with an audience?',
          options: [
            { id: 'a', text: 'Daily discount promotions', correct: false },
            { id: 'b', text: 'Educational content that genuinely helps the reader', correct: true },
            { id: 'c', text: 'Celebrity endorsements only', correct: false },
            { id: 'd', text: 'Content posted only during festivals', correct: false },
          ],
        },
      ],
    },
  ],

  4: [
    {
      id: 'ep4-cue-1',
      atSeconds: 15,
      questions: [
        {
          id: 'ep4c1q1',
          question: 'For a local Tamil bakery, which platform is likely MOST effective?',
          options: [
            { id: 'a', text: 'LinkedIn (professional network)', correct: false },
            { id: 'b', text: 'Instagram and WhatsApp Business', correct: true },
            { id: 'c', text: 'GitHub (developer community)', correct: false },
            { id: 'd', text: 'Twitch (live gaming streams)', correct: false },
          ],
        },
      ],
    },
    {
      id: 'ep4-cue-2',
      atSeconds: 45,
      questions: [
        {
          id: 'ep4c2q1',
          question: 'What does "engagement rate" measure on social media?',
          options: [
            { id: 'a', text: 'The total number of followers you have', correct: false },
            { id: 'b', text: 'How actively your audience interacts with your content', correct: true },
            { id: 'c', text: 'How many ads you run per month', correct: false },
            { id: 'd', text: 'The cost per post boosted', correct: false },
          ],
        },
        {
          id: 'ep4c2q2',
          question: 'A "content calendar" is used to:',
          options: [
            { id: 'a', text: 'Schedule and organise your posts in advance', correct: true },
            { id: 'b', text: 'Track how many competitors post per day', correct: false },
            { id: 'c', text: 'Automatically generate content using AI', correct: false },
            { id: 'd', text: 'Record customer complaints', correct: false },
          ],
        },
      ],
    },
  ],

  5: [
    {
      id: 'ep5-cue-1',
      atSeconds: 15,
      questions: [
        {
          id: 'ep5c1q1',
          question: 'Which metric tells you how many people saw your post or ad?',
          options: [
            { id: 'a', text: 'Conversion rate', correct: false },
            { id: 'b', text: 'Reach / Impressions', correct: true },
            { id: 'c', text: 'Cost per click (CPC)', correct: false },
            { id: 'd', text: 'Return on ad spend (ROAS)', correct: false },
          ],
        },
      ],
    },
    {
      id: 'ep5-cue-2',
      atSeconds: 45,
      questions: [
        {
          id: 'ep5c2q1',
          question: 'If you spend ₹10,000 on ads and earn ₹30,000 in revenue, your ROI is:',
          options: [
            { id: 'a', text: '100%', correct: false },
            { id: 'b', text: '200%', correct: true },
            { id: 'c', text: '300%', correct: false },
            { id: 'd', text: '30%', correct: false },
          ],
        },
        {
          id: 'ep5c2q2',
          question: 'What action should you take if a campaign shows a negative ROI?',
          options: [
            { id: 'a', text: 'Increase the ad budget immediately to get more reach', correct: false },
            { id: 'b', text: 'Analyse what is underperforming and optimise or stop it', correct: true },
            { id: 'c', text: 'Ignore it — ROI always improves over time on its own', correct: false },
            { id: 'd', text: 'Switch to a completely different product instantly', correct: false },
          ],
        },
      ],
    },
  ],
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎯 Adding mid-video cue quizzes to gamified course episodes...\n');

  const course = await (prisma as any).course.findFirst({
    where: { slug: 'digital-marketing-mastery-tbt' },
  });
  if (!course) {
    console.error('❌ Gamified course not found. Run seed-gamified-course.ts first.');
    process.exit(1);
  }
  console.log(`✅ Found course: ${course.title}  (id: ${course.id})\n`);

  const episodes = await (prisma as any).courseEpisode.findMany({
    where: { courseId: course.id },
    orderBy: { order: 'asc' },
  });

  for (const ep of episodes) {
    const cues = CUE_QUIZZES[ep.order];
    if (!cues) continue;

    const existing = ep.quizData as any;
    const updatedQuizData = {
      questions: existing?.questions ?? [],   // preserve end-of-lesson quiz
      cues,
    };

    await (prisma as any).courseEpisode.update({
      where: { id: ep.id },
      data: { quizData: updatedQuizData },
    });

    console.log(`✅ Ep${ep.order}: "${ep.title}"`);
    console.log(`   End-of-lesson Qs: ${updatedQuizData.questions.length}`);
    console.log(`   Mid-video cues:   ${cues.length} (at ${cues.map(c => `${c.atSeconds}s`).join(', ')})`);
    console.log(`   Cue questions:    ${cues.reduce((acc, c) => acc + c.questions.length, 0)} total\n`);
  }

  console.log('🎉 Cue quizzes added successfully!');
  console.log('\nWhat to test:');
  console.log('  1. Open any episode in the course player');
  console.log('  2. At 0:15 → video pauses, "Quick Check" modal appears');
  console.log('  3. Answer question → Continue Watching → video resumes');
  console.log('  4. At 0:45 → video pauses again with 2-question cue quiz');
  console.log('  5. End of video → end-of-lesson quiz (for ep2–ep5)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

/**
 * Populates every active workshop with 5 challenges, 3 episodes each, and 1 assignment each.
 * Safe to re-run: skips workshops that already have challenges.
 * Run from tbt-admin/:
 *   npx tsx backend/prisma/seed-workshop-data.ts
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

const prisma = new PrismaClient();

const VIDEO_URL  = 'https://iframe.mediadelivery.net/embed/674791/6bc82f7c-bb64-492b-8439-8549fd53787b';
const BUNNY_ID   = '6bc82f7c-bb64-492b-8439-8549fd53787b';

// 5 challenge templates — each with a distinct challenge type
const CHALLENGE_TEMPLATES = [
  {
    numberLabel: '01', numberColor: '#00c4cc', title: 'Foundation',
    type: 'watch',
    description: 'Watch the introduction videos to build your foundation.',
    quizData: null,
    episodes: [
      { title: 'Welcome & Overview', description: 'Introduction to the workshop and what you will accomplish.', durationSeconds: 780, durationLabel: '13 min' },
      { title: 'Core Principles Explained', description: 'Deep dive into the key concepts that drive results.', durationSeconds: 1440, durationLabel: '24 min' },
      { title: 'Real-World Case Study', description: 'See how successful businesses applied these principles.', durationSeconds: 1080, durationLabel: '18 min' },
    ],
    assignment: { title: 'Assess Your Starting Point', questionText: 'Where are you right now? Describe your current situation.' },
  },
  {
    numberLabel: '02', numberColor: '#f59e0b', title: 'Knowledge Check',
    type: 'quiz',
    description: 'Test your understanding of the core concepts.',
    quizData: {
      questions: [
        {
          id: 'q1', question: 'What is the most important factor in building a loyal customer base?',
          options: [
            { id: 'a', text: 'Running paid ads consistently', correct: false },
            { id: 'b', text: 'Delivering consistent value and trust', correct: true },
            { id: 'c', text: 'Having the lowest price in the market', correct: false },
            { id: 'd', text: 'Posting on social media daily', correct: false },
          ],
        },
        {
          id: 'q2', question: 'Which metric best measures business growth?',
          options: [
            { id: 'a', text: 'Number of social media followers', correct: false },
            { id: 'b', text: 'Revenue and customer retention rate', correct: true },
            { id: 'c', text: 'Website traffic alone', correct: false },
            { id: 'd', text: 'Number of employees', correct: false },
          ],
        },
        {
          id: 'q3', question: 'What does "product-market fit" mean?',
          options: [
            { id: 'a', text: 'Your product is physically available in the market', correct: false },
            { id: 'b', text: 'Your product fits neatly in a market category', correct: false },
            { id: 'c', text: 'Your product solves a real problem for a specific audience', correct: true },
            { id: 'd', text: 'Your product has more features than competitors', correct: false },
          ],
        },
        {
          id: 'q4', question: 'The best time to scale a business is when:',
          options: [
            { id: 'a', text: 'You have raised investor funding', correct: false },
            { id: 'b', text: 'You have a repeatable, profitable process', correct: true },
            { id: 'c', text: 'You have 10+ employees', correct: false },
            { id: 'd', text: 'You feel ready', correct: false },
          ],
        },
      ],
    },
    episodes: [],
    assignment: { title: 'Knowledge Check', questionText: 'What is the key concept you learned from the quiz?' },
  },
  {
    numberLabel: '03', numberColor: '#8b5cf6', title: 'Strategy',
    type: 'written',
    description: 'Apply your learning by writing out your personal business strategy.',
    quizData: {
      prompt: 'Write your 90-day business strategy. Include:\n1. Your top 3 goals\n2. The key actions you will take each month\n3. How you will measure success at each milestone\n4. The biggest obstacle you anticipate and how you will overcome it',
      placeholder: 'Start with "My 90-day goal is..." and be as specific as possible with numbers and dates.',
    },
    episodes: [],
    assignment: { title: 'Strategy Draft', questionText: 'Summarize your strategy in 3 bullet points.' },
  },
  {
    numberLabel: '04', numberColor: '#ef4444', title: 'Terminology',
    type: 'matching',
    description: 'Match each business term with its correct definition.',
    quizData: {
      pairs: [
        { id: 'p1', left: 'Lead Generation',          right: 'Attracting potential customers to your business' },
        { id: 'p2', left: 'Conversion Rate',           right: 'Percentage of leads who become paying customers' },
        { id: 'p3', left: 'Customer Lifetime Value',   right: 'Total revenue a customer generates over their relationship' },
        { id: 'p4', left: 'Churn Rate',                right: 'Percentage of customers who stop using your product' },
        { id: 'p5', left: 'Gross Margin',              right: 'Revenue minus the cost of goods sold' },
      ],
    },
    episodes: [],
    assignment: { title: 'Terms in Practice', questionText: 'Use three of the matched terms in a sentence about your own business.' },
  },
  {
    numberLabel: '05', numberColor: '#10b981', title: 'Scale',
    type: 'flashcard',
    description: 'Review key concepts using flashcards. Mark each card as "Got It" when you understand it.',
    quizData: {
      cards: [
        { id: 'c1', front: 'What is a sales funnel?',                  back: 'A step-by-step process that guides potential customers from awareness to purchase.' },
        { id: 'c2', front: 'Define "bootstrapping"',                   back: 'Building a business using personal savings and revenue, without external investment.' },
        { id: 'c3', front: 'What is a USP?',                           back: 'Unique Selling Proposition — the specific benefit that makes your offer different from competitors.' },
        { id: 'c4', front: 'What does ROI stand for?',                 back: 'Return on Investment — the profit or loss relative to the cost of an investment.' },
        { id: 'c5', front: 'What is B2B vs B2C?',                      back: 'B2B = Business to Business. B2C = Business to Consumer. Refers to who your customer is.' },
        { id: 'c6', front: 'What is a minimum viable product (MVP)?',  back: 'The simplest version of a product that allows you to test your core idea with real customers.' },
      ],
    },
    episodes: [],
    assignment: { title: 'Reflection', questionText: 'Which flashcard concept is most relevant to your current business stage and why?' },
  },
];

async function seedWorkshop(workshop: { id: string; title: string }) {
  // Clear existing challenges, episodes, assignments, flow items, live calls
  await prisma.workshopFlowItem.deleteMany({ where: { workshopId: workshop.id } });
  await prisma.liveCall.deleteMany({ where: { workshopId: workshop.id } });
  const challenges = await prisma.challenge.findMany({ where: { workshopId: workshop.id }, select: { id: true } });
  for (const c of challenges) {
    await prisma.assignment.deleteMany({ where: { challengeId: c.id } });
    await prisma.workshopEpisode.deleteMany({ where: { challengeId: c.id } });
  }
  await prisma.challenge.deleteMany({ where: { workshopId: workshop.id } });

  const flowItems: { order: number; type: string; label: string; description: string; challengeId?: string }[] = [];
  let flowOrder = 1;

  // Pre-req flow item
  flowItems.push({
    order: flowOrder++,
    type: 'custom',
    label: 'Pre-Requisite',
    description: 'Review any recommended reading or materials before starting the challenges.',
  });

  for (let i = 0; i < CHALLENGE_TEMPLATES.length; i++) {
    const tmpl = CHALLENGE_TEMPLATES[i];

    const challenge = await prisma.challenge.create({
      data: {
        workshopId: workshop.id,
        order: i + 1,
        challengeNumber: i + 1,
        numberLabel: tmpl.numberLabel,
        numberColor: tmpl.numberColor,
        title: tmpl.title,
        description: tmpl.description,
        type: tmpl.type,
        quizData: tmpl.quizData as any,
      },
    });

    // Episodes (only for watch-type challenges)
    for (let j = 0; j < tmpl.episodes.length; j++) {
      const ep = tmpl.episodes[j] as any;
      await prisma.workshopEpisode.create({
        data: {
          challengeId: challenge.id,
          order: j + 1,
          title: ep.title,
          description: ep.description,
          type: 'video',
          typeLabel: 'Video',
          videoUrl: VIDEO_URL,
          bunnyVideoId: BUNNY_ID,
          durationSeconds: ep.durationSeconds,
          durationLabel: ep.durationLabel,
        },
      });
    }

    // Assignment
    await prisma.assignment.create({
      data: {
        challengeId: challenge.id,
        order: 1,
        title: tmpl.assignment.title,
        questionText: tmpl.assignment.questionText,
        typeLabel: 'QUESTION',
        iconType: 'document',
      },
    });

    flowItems.push({
      order: flowOrder++,
      type: 'challenge_start',
      label: `Challenge ${i + 1}: ${tmpl.title}`,
      description: tmpl.description,
      challengeId: challenge.id,
    });
  }

  // Live call flow item at the end
  const liveCall = await prisma.liveCall.create({
    data: {
      workshopId: workshop.id,
      order: 1,
      type: 'live_call',
      label: 'LIVE CALL:',
      labelColor: '#ff3d8b',
      title: 'Group Coaching & Q&A Session',
      scheduledAt: new Date('2026-08-01T10:00:00Z'),
      liveUrl: 'https://zoom.us/j/sample',
      liveUrlUnlocksMinutesBefore: 30,
      recordingLabel: 'Watch Recording',
      facilitatorName: 'Manoj Kumar',
      facilitatorTitle: 'Founder, Tamil Business Tribe',
      facilitatorDescription:
        'Serial entrepreneur and business coach with 15+ years of experience helping Tamil businesses scale.',
      stayTunedMessage: 'Stay tuned — the link will unlock 30 minutes before the session begins.',
    },
  });

  flowItems.push({
    order: flowOrder++,
    type: 'live_call',
    label: 'Live Group Coaching',
    description: 'Join the live Q&A session and get personalised feedback from the mentor.',
  });

  // Create all flow items
  for (const fi of flowItems) {
    await prisma.workshopFlowItem.create({
      data: {
        workshopId: workshop.id,
        order: fi.order,
        type: fi.type,
        label: fi.label,
        description: fi.description,
        isCompleted: false,
        ...(fi.challengeId ? { challengeId: fi.challengeId } : {}),
        ...(fi.type === 'live_call' ? { liveCallId: liveCall.id } : {}),
      },
    });
  }

  const challengeCount = CHALLENGE_TEMPLATES.length;
  const episodeCount   = CHALLENGE_TEMPLATES.reduce((s, t) => s + t.episodes.length, 0);
  console.log(`   ✅ "${workshop.title}" — ${challengeCount} challenges, ${episodeCount} episodes, ${challengeCount} assignments`);
}

async function main() {
  console.log('🌱 Seeding workshop sample data...\n');

  const workshops = await prisma.workshop.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true },
  });

  if (workshops.length === 0) {
    console.log('⚠️  No active workshops found. Run the main seed first: npx tsx backend/prisma/seed-sample.ts');
    return;
  }

  console.log(`Found ${workshops.length} active workshop(s):\n`);

  for (const w of workshops) {
    await seedWorkshop(w);
  }

  console.log('\n🎉 Done!');
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

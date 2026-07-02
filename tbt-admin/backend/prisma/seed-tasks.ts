/**
 * Task Module Sample Data Seed
 * Run: npx tsx prisma/seed-tasks.ts  (from backend/)
 *   or: npm run seed:tasks            (from tbt-admin/)
 *
 * Creates:
 *   - 1 Program  : "90-Day Tamil Business Growth Program"
 *   - 15 Tasks   : Days 1–5 (3 per day), all proof types, 2 milestone tasks
 *   - Inline tasks on the first active batch (if any) — Days 1–3
 *
 * Idempotent — skips creation if the program already exists.
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

// ── Program definition ────────────────────────────────────────────────────────

const PROGRAM = {
  name: '90-Day Tamil Business Growth Program',
  description:
    'A structured 90-day journey to build, launch, and scale your Tamil business. Each day contains targeted tasks covering mindset, marketing, sales, and operations.',
  durationDays: 90,
};

// ── Task definitions (Days 1–5, 3 tasks per day) ─────────────────────────────
// proofType options: watch | text | image | link | video | file

const TASKS = [
  // ── Day 1: Foundation ──────────────────────────────────────────────────────
  {
    dayNumber: 1,
    sortOrder: 0,
    title: 'Watch: Introduction to the 90-Day Journey',
    description: 'Watch the orientation video to understand the program structure and what to expect over the next 90 days.',
    deliverables: null,
    contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    proofType: 'watch',
    basePoints: 20,
    bonusPoints: 0,
    estimatedMinutes: 10,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 1,
    sortOrder: 1,
    title: 'Write Your Business Vision Statement',
    description: 'In 2–3 sentences, describe what your business will look like 1 year from now. Be specific about revenue, customers, and impact.',
    deliverables: 'A written vision statement (2–3 sentences minimum). Include your target revenue, customer count, and the problem you solve.',
    contentUrl: null,
    proofType: 'text',
    basePoints: 50,
    bonusPoints: 0,
    estimatedMinutes: 20,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 1,
    sortOrder: 2,
    title: 'Share Your Day 1 Commitment Post',
    description: 'Post a short video or image on your WhatsApp/Instagram story announcing you have started the 90-day challenge. Tag the TBT community.',
    deliverables: 'Screenshot or link to your public commitment post.',
    contentUrl: null,
    proofType: 'image',
    basePoints: 75,
    bonusPoints: 25,
    estimatedMinutes: 15,
    isMilestone: true,
    milestoneLabel: 'Day 1 Committed 🔥',
  },

  // ── Day 2: Identify Your Niche ─────────────────────────────────────────────
  {
    dayNumber: 2,
    sortOrder: 0,
    title: 'Watch: How to Pick a Profitable Niche',
    description: 'Learn the 3-filter method for validating your niche — passion, market demand, and profit margin.',
    deliverables: null,
    contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    proofType: 'watch',
    basePoints: 20,
    bonusPoints: 0,
    estimatedMinutes: 12,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 2,
    sortOrder: 1,
    title: 'Complete the Niche Validation Worksheet',
    description: 'Download and fill in the Niche Validation Worksheet. Score your top 3 business ideas across the 3 filters.',
    deliverables: 'Upload a photo or scan of your completed worksheet. All 3 ideas must be scored.',
    contentUrl: 'https://docs.google.com/spreadsheets/d/sample',
    proofType: 'file',
    basePoints: 80,
    bonusPoints: 0,
    estimatedMinutes: 30,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 2,
    sortOrder: 2,
    title: 'Post Your Niche Decision in the Community',
    description: 'Share your chosen niche in the TBT community group and explain why you picked it. Get at least 2 replies.',
    deliverables: 'Paste the link to your community post.',
    contentUrl: null,
    proofType: 'link',
    basePoints: 60,
    bonusPoints: 0,
    estimatedMinutes: 10,
    isMilestone: false,
    milestoneLabel: null,
  },

  // ── Day 3: Know Your Customer ──────────────────────────────────────────────
  {
    dayNumber: 3,
    sortOrder: 0,
    title: 'Watch: Building Your Customer Avatar',
    description: 'Understand how to build a detailed customer profile that drives every marketing and product decision.',
    deliverables: null,
    contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    proofType: 'watch',
    basePoints: 20,
    bonusPoints: 0,
    estimatedMinutes: 15,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 3,
    sortOrder: 1,
    title: 'Interview 1 Potential Customer',
    description: 'Call or meet one person who fits your ideal customer profile. Ask them 5 discovery questions about their pain points.',
    deliverables: 'Write a summary of the interview: who you spoke to, their 3 biggest pain points, and one insight that surprised you.',
    contentUrl: null,
    proofType: 'text',
    basePoints: 100,
    bonusPoints: 0,
    estimatedMinutes: 45,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 3,
    sortOrder: 2,
    title: 'Record a 60-Second Customer Avatar Video',
    description: 'Record a short video describing your ideal customer as if they were a real person. Name them, give them an age, a job, and a problem.',
    deliverables: 'Upload your 60-second video or paste a link to it (YouTube/Drive/WhatsApp).',
    contentUrl: null,
    proofType: 'video',
    basePoints: 80,
    bonusPoints: 0,
    estimatedMinutes: 20,
    isMilestone: false,
    milestoneLabel: null,
  },

  // ── Day 4: Your Offer ──────────────────────────────────────────────────────
  {
    dayNumber: 4,
    sortOrder: 0,
    title: 'Watch: Crafting an Irresistible Offer',
    description: 'Learn the 4-part offer framework: outcome, mechanism, proof, and price anchor.',
    deliverables: null,
    contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    proofType: 'watch',
    basePoints: 20,
    bonusPoints: 0,
    estimatedMinutes: 18,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 4,
    sortOrder: 1,
    title: 'Draft Your Core Offer in One Sentence',
    description: 'Use the formula: "I help [target customer] achieve [outcome] without [pain point] using [mechanism]."',
    deliverables: 'Write your one-sentence offer using the formula. Then write 2 alternatives and explain which one you prefer and why.',
    contentUrl: null,
    proofType: 'text',
    basePoints: 75,
    bonusPoints: 0,
    estimatedMinutes: 25,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 4,
    sortOrder: 2,
    title: 'Create a Simple Offer Flyer',
    description: 'Design a basic offer flyer using Canva (free). Include your offer headline, 3 benefits, price, and a call-to-action.',
    deliverables: 'Upload a photo of your flyer or the Canva export as an image.',
    contentUrl: 'https://www.canva.com',
    proofType: 'image',
    basePoints: 90,
    bonusPoints: 0,
    estimatedMinutes: 40,
    isMilestone: false,
    milestoneLabel: null,
  },

  // ── Day 5: First Sale Attempt ──────────────────────────────────────────────
  {
    dayNumber: 5,
    sortOrder: 0,
    title: 'Watch: The Psychology of the First Sale',
    description: 'Why your first sale is the hardest and the exact conversation framework to make it happen.',
    deliverables: null,
    contentUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    proofType: 'watch',
    basePoints: 20,
    bonusPoints: 0,
    estimatedMinutes: 14,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 5,
    sortOrder: 1,
    title: 'Send 5 Direct Offer Messages',
    description: 'Send your offer directly to 5 people in your phone contacts or WhatsApp. Use the script provided in the resource link.',
    deliverables: 'Screenshot of 5 conversations showing you sent the offer message. Blur names if needed. Include their responses.',
    contentUrl: null,
    proofType: 'image',
    basePoints: 150,
    bonusPoints: 0,
    estimatedMinutes: 30,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 5,
    sortOrder: 2,
    title: 'Close Your First Sale (or Scheduled Call)',
    description: 'Either close a paying customer or book a discovery call. Both count — money in hand is a bonus milestone.',
    deliverables: 'Screenshot of payment confirmation, or a screenshot of the booked call/meeting. Write 2–3 sentences on how it went.',
    contentUrl: null,
    proofType: 'image',
    basePoints: 200,
    bonusPoints: 500,
    estimatedMinutes: 60,
    isMilestone: true,
    milestoneLabel: 'First Sale / Call Booked 💰',
  },
];

// ── Inline batch tasks (added to the first available active batch) ─────────────

const INLINE_TASKS = [
  {
    dayNumber: 1,
    sortOrder: 0,
    title: 'Join the batch WhatsApp group',
    description: 'Click the group link and introduce yourself in 2 sentences.',
    deliverables: null,
    contentUrl: null,
    proofType: 'watch',
    basePoints: 10,
    bonusPoints: 0,
    estimatedMinutes: 5,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 1,
    sortOrder: 1,
    title: 'Submit your Day 1 checkin photo',
    description: 'Take a selfie at your workspace and post it in the group.',
    deliverables: 'Upload the selfie photo.',
    contentUrl: null,
    proofType: 'image',
    basePoints: 20,
    bonusPoints: 0,
    estimatedMinutes: 5,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 2,
    sortOrder: 0,
    title: 'Complete the goal-setting form',
    description: 'Fill in the linked Google Form with your 30-day targets.',
    deliverables: 'Paste the form submission link.',
    contentUrl: 'https://forms.google.com/sample',
    proofType: 'link',
    basePoints: 30,
    bonusPoints: 0,
    estimatedMinutes: 10,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 2,
    sortOrder: 1,
    title: 'Write your accountability partner message',
    description: 'Send a message to your assigned accountability partner introducing yourself.',
    deliverables: 'Write what you sent them and their reply.',
    contentUrl: null,
    proofType: 'text',
    basePoints: 25,
    bonusPoints: 0,
    estimatedMinutes: 10,
    isMilestone: false,
    milestoneLabel: null,
  },
  {
    dayNumber: 3,
    sortOrder: 0,
    title: 'Post your Day 3 reflection video',
    description: 'Record a 30-second reflection on your biggest insight from Days 1–3.',
    deliverables: 'Paste the YouTube/Drive link to your reflection video.',
    contentUrl: null,
    proofType: 'video',
    basePoints: 40,
    bonusPoints: 10,
    estimatedMinutes: 15,
    isMilestone: true,
    milestoneLabel: 'Week 1 Kick-Off ✅',
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Task Module sample data…\n');

  // ── 1. Upsert Program ──────────────────────────────────────────────────────
  const existing = await prisma.program.findFirst({ where: { name: PROGRAM.name } });
  let program;
  if (existing) {
    console.log(`⚠️  Program already exists — skipping creation (id: ${existing.id})`);
    program = existing;
  } else {
    program = await prisma.program.create({ data: PROGRAM });
    console.log(`✅ Program created: "${program.name}" (id: ${program.id})`);
  }

  // ── 2. Upsert Task Initiatives ─────────────────────────────────────────────
  let created = 0;
  let skipped = 0;

  for (const t of TASKS) {
    const exists = await (prisma as any).task.findFirst({
      where: { programId: program.id, dayNumber: t.dayNumber, title: t.title },
    });
    if (exists) {
      skipped++;
      continue;
    }
    await (prisma as any).task.create({
      data: {
        programId:        program.id,
        dayNumber:        t.dayNumber,
        sortOrder:        t.sortOrder,
        title:            t.title,
        description:      t.description,
        deliverables:     t.deliverables,
        contentUrl:       t.contentUrl,
        proofType:        t.proofType,
        basePoints:       t.basePoints,
        bonusPoints:      t.bonusPoints,
        estimatedMinutes: t.estimatedMinutes,
        isMilestone:      t.isMilestone,
        milestoneLabel:   t.milestoneLabel,
      },
    });
    created++;
  }

  console.log(`✅ Task Initiatives: ${created} created, ${skipped} skipped`);

  // ── 3. Inline batch tasks (first active/upcoming batch, if any) ────────────
  const batch = await prisma.batch.findFirst({
    where: { isActive: true },
    orderBy: { startsAt: 'asc' },
  });

  if (!batch) {
    console.log('ℹ️  No active/upcoming batch found — skipping inline task seed');
  } else {
    console.log(`\n📦 Adding inline tasks to batch: "${batch.name}" (id: ${batch.id})`);
    let inlineCreated = 0;
    let inlineSkipped = 0;

    for (const t of INLINE_TASKS) {
      const exists = await (prisma as any).task.findFirst({
        where: { batchId: batch.id, dayNumber: t.dayNumber, title: t.title },
      });
      if (exists) { inlineSkipped++; continue; }

      await (prisma as any).task.create({
        data: {
          batchId:          batch.id,
          programId:        null,
          dayNumber:        t.dayNumber,
          sortOrder:        t.sortOrder,
          title:            t.title,
          description:      t.description,
          deliverables:     t.deliverables,
          contentUrl:       t.contentUrl,
          proofType:        t.proofType,
          basePoints:       t.basePoints,
          bonusPoints:      t.bonusPoints,
          estimatedMinutes: t.estimatedMinutes,
          isMilestone:      t.isMilestone,
          milestoneLabel:   t.milestoneLabel,
        },
      });
      inlineCreated++;
    }
    console.log(`✅ Inline Tasks: ${inlineCreated} created, ${inlineSkipped} skipped`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const totalTasks = await (prisma as any).task.count({ where: { programId: program.id } });
  console.log(`\n📊 Summary`);
  console.log(`   Program : ${program.name}`);
  console.log(`   Tasks   : ${totalTasks} total in program (Days 1–5)`);
  if (batch) {
    const batchTasks = await (prisma as any).task.count({ where: { batchId: batch.id } });
    console.log(`   Inline  : ${batchTasks} total in batch "${batch.name}"`);
  }
  console.log('\n✨ Done!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

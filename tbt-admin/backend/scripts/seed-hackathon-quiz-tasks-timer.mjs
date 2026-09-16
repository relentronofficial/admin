// Seed assessments (quiz_data), tasks, and episode timers for the TBT Hackathon course.
// Idempotent — skips each field individually if already set.
//
// Run with: node scripts/seed-hackathon-quiz-tasks-timer.mjs  (from tbt-admin/backend/)

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

// ── Episode timer: default 10 min for every episode ──────────────────────────
const DEFAULT_TIMER_SECONDS = 10 * 60; // 600 s = 10 min

// ── Assessment (quiz) banks — one per episode slot (cycles if more episodes) ─
const QUIZ_BANKS = [
  {
    questions: [
      {
        id: 'q1', question: 'What is the primary goal of the TBT Hackathon?',
        options: [
          { id: 'a', text: 'Build a product and present a business case', correct: true },
          { id: 'b', text: 'Write academic research papers', correct: false },
          { id: 'c', text: 'Complete a coding challenge alone', correct: false },
          { id: 'd', text: 'Pitch to venture capitalists only', correct: false },
        ],
      },
      {
        id: 'q2', question: 'Which of the following best defines a "Minimum Viable Product" (MVP)?',
        options: [
          { id: 'a', text: 'The cheapest product you can build', correct: false },
          { id: 'b', text: 'The smallest product that delivers core value and can be tested with real users', correct: true },
          { id: 'c', text: 'A product with no bugs', correct: false },
          { id: 'd', text: 'A fully polished final version', correct: false },
        ],
      },
      {
        id: 'q3', question: 'What does "problem-first thinking" mean in product development?',
        options: [
          { id: 'a', text: 'Focus on technical challenges first', correct: false },
          { id: 'b', text: 'Start by identifying a clear user problem before designing a solution', correct: true },
          { id: 'c', text: 'Listing all problems you face personally', correct: false },
          { id: 'd', text: 'Solving competitor problems', correct: false },
        ],
      },
    ],
  },
  {
    questions: [
      {
        id: 'q1', question: 'In a hackathon pitch, what should the first 30 seconds focus on?',
        options: [
          { id: 'a', text: 'Your team\'s resumes', correct: false },
          { id: 'b', text: 'The technical architecture of your product', correct: false },
          { id: 'c', text: 'A compelling problem statement that resonates with the audience', correct: true },
          { id: 'd', text: 'Your revenue projections', correct: false },
        ],
      },
      {
        id: 'q2', question: 'Which of these is the most important element of a strong value proposition?',
        options: [
          { id: 'a', text: 'A catchy brand name', correct: false },
          { id: 'b', text: 'A clear statement of the benefit your product delivers to a specific customer', correct: true },
          { id: 'c', text: 'A long list of features', correct: false },
          { id: 'd', text: 'A low price point', correct: false },
        ],
      },
      {
        id: 'q3', question: 'What is the purpose of customer discovery interviews?',
        options: [
          { id: 'a', text: 'To sell your product early', correct: false },
          { id: 'b', text: 'To validate assumptions about customer problems and needs before building', correct: true },
          { id: 'c', text: 'To record testimonials', correct: false },
          { id: 'd', text: 'To find investors', correct: false },
        ],
      },
    ],
  },
  {
    questions: [
      {
        id: 'q1', question: 'What is a "Go-To-Market" (GTM) strategy?',
        options: [
          { id: 'a', text: 'A plan for manufacturing products at scale', correct: false },
          { id: 'b', text: 'A roadmap for reaching your target market and generating revenue', correct: true },
          { id: 'c', text: 'A legal document for launching a company', correct: false },
          { id: 'd', text: 'A social media content calendar', correct: false },
        ],
      },
      {
        id: 'q2', question: 'Which metric best measures product-market fit in early stages?',
        options: [
          { id: 'a', text: 'Total website visits', correct: false },
          { id: 'b', text: 'Number of social media followers', correct: false },
          { id: 'c', text: 'Retention rate — do users come back after first use?', correct: true },
          { id: 'd', text: 'Press coverage count', correct: false },
        ],
      },
      {
        id: 'q3', question: 'What does TAM stand for in market sizing?',
        options: [
          { id: 'a', text: 'Total Addressable Market', correct: true },
          { id: 'b', text: 'Target Audience Metrics', correct: false },
          { id: 'c', text: 'Time And Money', correct: false },
          { id: 'd', text: 'Team Assessment Model', correct: false },
        ],
      },
    ],
  },
  {
    questions: [
      {
        id: 'q1', question: 'In a lean startup methodology, what is a "pivot"?',
        options: [
          { id: 'a', text: 'Closing the business', correct: false },
          { id: 'b', text: 'A structured change in strategy based on validated learning', correct: true },
          { id: 'c', text: 'Hiring new team members', correct: false },
          { id: 'd', text: 'Adding new product features', correct: false },
        ],
      },
      {
        id: 'q2', question: 'What is the Build-Measure-Learn loop designed to minimise?',
        options: [
          { id: 'a', text: 'Development costs', correct: false },
          { id: 'b', text: 'Team size', correct: false },
          { id: 'c', text: 'Wasted time building things customers don\'t want', correct: true },
          { id: 'd', text: 'Marketing spend', correct: false },
        ],
      },
      {
        id: 'q3', question: 'Which of the following is an example of a vanity metric?',
        options: [
          { id: 'a', text: 'Monthly recurring revenue', correct: false },
          { id: 'b', text: 'Customer acquisition cost', correct: false },
          { id: 'c', text: 'Total page views without context of conversion', correct: true },
          { id: 'd', text: 'Net promoter score', correct: false },
        ],
      },
    ],
  },
  {
    questions: [
      {
        id: 'q1', question: 'What is the key advantage of a subscription-based revenue model?',
        options: [
          { id: 'a', text: 'Higher one-time payment per customer', correct: false },
          { id: 'b', text: 'Predictable recurring revenue and higher customer lifetime value', correct: true },
          { id: 'c', text: 'No need for customer support', correct: false },
          { id: 'd', text: 'Lower marketing costs', correct: false },
        ],
      },
      {
        id: 'q2', question: 'What does "unit economics" refer to?',
        options: [
          { id: 'a', text: 'The economics of a single country', correct: false },
          { id: 'b', text: 'Revenue and cost associated with a single unit or customer', correct: true },
          { id: 'c', text: 'Price per product unit in manufacturing', correct: false },
          { id: 'd', text: 'Number of units sold per month', correct: false },
        ],
      },
      {
        id: 'q3', question: 'What is the break-even point?',
        options: [
          { id: 'a', text: 'When your product launches', correct: false },
          { id: 'b', text: 'When total revenue equals total costs — no profit or loss', correct: true },
          { id: 'c', text: 'When you run out of funding', correct: false },
          { id: 'd', text: 'When you hire your first employee', correct: false },
        ],
      },
    ],
  },
  {
    questions: [
      {
        id: 'q1', question: 'What is the purpose of a competitive analysis?',
        options: [
          { id: 'a', text: 'To copy competitors\' strategies', correct: false },
          { id: 'b', text: 'To understand competitor strengths/weaknesses and identify your differentiation', correct: true },
          { id: 'c', text: 'To sue competitors', correct: false },
          { id: 'd', text: 'To track competitors\' social media', correct: false },
        ],
      },
      {
        id: 'q2', question: 'Which framework is commonly used to identify internal strengths and external opportunities?',
        options: [
          { id: 'a', text: 'AIDA', correct: false },
          { id: 'b', text: 'SWOT Analysis', correct: true },
          { id: 'c', text: 'SMART Goals', correct: false },
          { id: 'd', text: 'OKRs', correct: false },
        ],
      },
      {
        id: 'q3', question: 'What does differentiation mean in a competitive context?',
        options: [
          { id: 'a', text: 'Having a lower price than competitors', correct: false },
          { id: 'b', text: 'Offering unique value that makes customers choose you over alternatives', correct: true },
          { id: 'c', text: 'Targeting a different geography', correct: false },
          { id: 'd', text: 'Having a different logo', correct: false },
        ],
      },
    ],
  },
  {
    questions: [
      {
        id: 'q1', question: 'What is the role of a prototype in product development?',
        options: [
          { id: 'a', text: 'The final version of the product ready for sale', correct: false },
          { id: 'b', text: 'An early model used to test ideas and gather feedback quickly', correct: true },
          { id: 'c', text: 'A legal document for investors', correct: false },
          { id: 'd', text: 'A marketing brochure', correct: false },
        ],
      },
      {
        id: 'q2', question: 'In UI/UX design, what does "user flow" refer to?',
        options: [
          { id: 'a', text: 'How fast users can type on a keyboard', correct: false },
          { id: 'b', text: 'The path a user takes through your product to complete a task', correct: true },
          { id: 'c', text: 'The number of users visiting your site', correct: false },
          { id: 'd', text: 'The colour scheme of your interface', correct: false },
        ],
      },
      {
        id: 'q3', question: 'Which testing method involves observing real users interacting with your product?',
        options: [
          { id: 'a', text: 'A/B testing', correct: false },
          { id: 'b', text: 'Usability testing', correct: true },
          { id: 'c', text: 'Load testing', correct: false },
          { id: 'd', text: 'Unit testing', correct: false },
        ],
      },
    ],
  },
  {
    questions: [
      {
        id: 'q1', question: 'What is the most critical factor when presenting to a panel of judges in a hackathon?',
        options: [
          { id: 'a', text: 'Having the most slides', correct: false },
          { id: 'b', text: 'A clear problem, credible solution, and evidence of traction or validation', correct: true },
          { id: 'c', text: 'Using technical jargon to impress', correct: false },
          { id: 'd', text: 'A polished demo video only', correct: false },
        ],
      },
      {
        id: 'q2', question: 'What does "social proof" mean in business and marketing?',
        options: [
          { id: 'a', text: 'Proof that you have a social media account', correct: false },
          { id: 'b', text: 'Evidence that other people have used and trust your product (reviews, testimonials, case studies)', correct: true },
          { id: 'c', text: 'Government documentation', correct: false },
          { id: 'd', text: 'A legal disclaimer', correct: false },
        ],
      },
      {
        id: 'q3', question: 'What is a stakeholder in a business context?',
        options: [
          { id: 'a', text: 'Only company shareholders', correct: false },
          { id: 'b', text: 'Anyone who has an interest in or is affected by the business — customers, employees, investors, partners', correct: true },
          { id: 'c', text: 'The founding team only', correct: false },
          { id: 'd', text: 'Government regulators only', correct: false },
        ],
      },
    ],
  },
];

// ── Task templates (2 per episode) ───────────────────────────────────────────
const TASK_PAIRS = [
  [
    {
      title: 'Define Your Problem Statement',
      description: 'Write a one-paragraph problem statement for the challenge you are solving in the hackathon. Include: who has the problem, how often it occurs, and what the current workaround is.',
      deliverables: 'A written problem statement (150–200 words) submitted as text.',
      proofType: 'text', basePoints: 50, estimatedMinutes: 20, isMilestone: false, sortOrder: 1,
    },
    {
      title: 'Sketch Your MVP',
      description: 'Draw or describe the 3 core features your MVP must have to solve the problem. Justify why you chose these 3 over everything else.',
      deliverables: 'A photo of your sketch or a written description of the 3 core features with reasoning.',
      proofType: 'image', basePoints: 75, estimatedMinutes: 30, isMilestone: false, sortOrder: 2,
    },
  ],
  [
    {
      title: 'Conduct 2 Customer Discovery Calls',
      description: 'Interview 2 potential users about the problem you are solving. Use the questions learned in this episode. Note their exact words, not your interpretations.',
      deliverables: 'Written summary of each interview: who you talked to, 3 key insights, and 1 surprising thing you heard.',
      proofType: 'text', basePoints: 100, estimatedMinutes: 60, isMilestone: false, sortOrder: 1,
    },
    {
      title: 'Build a Value Proposition Canvas',
      description: 'Complete a Value Proposition Canvas for your target customer segment. Identify their jobs-to-be-done, pains, and gains, then map your solution to each.',
      deliverables: 'Photo or digital version of your completed Value Proposition Canvas.',
      proofType: 'image', basePoints: 75, estimatedMinutes: 40, isMilestone: false, sortOrder: 2,
    },
  ],
  [
    {
      title: 'Map Your Go-To-Market Plan',
      description: 'Create a simple one-page GTM plan for your hackathon product. Include: target segment, acquisition channel, pricing model, and success metric for week 1.',
      deliverables: 'A one-page GTM plan (text or photo of a filled template).',
      proofType: 'text', basePoints: 75, estimatedMinutes: 35, isMilestone: false, sortOrder: 1,
    },
    {
      title: 'Estimate Your Market Size',
      description: 'Calculate the TAM, SAM, and SOM for your product idea using the top-down or bottom-up method shown in this episode. Show your workings.',
      deliverables: 'A written or tabular breakdown of TAM/SAM/SOM with sources and assumptions.',
      proofType: 'text', basePoints: 100, estimatedMinutes: 45, isMilestone: true, milestoneLabel: 'Market Researcher', sortOrder: 2,
    },
  ],
  [
    {
      title: 'Run a 24-Hour Build Sprint',
      description: 'Build the simplest possible version of your idea that you can show to someone. It could be a Figma mockup, a landing page, or even a paper prototype. The goal is to have something tangible within 24 hours.',
      deliverables: 'Screenshot or photo of your prototype or MVP, with a 2-sentence description of what you built.',
      proofType: 'image', basePoints: 150, estimatedMinutes: 90, isMilestone: true, milestoneLabel: 'First Builder', sortOrder: 1,
    },
    {
      title: 'Apply Build-Measure-Learn',
      description: 'Share your prototype with at least 3 people. Record what they do (not what they say), measure one metric, and write down what you learned.',
      deliverables: 'A short written report: what you built, how you measured, what you learned, and what you will change.',
      proofType: 'text', basePoints: 100, estimatedMinutes: 60, isMilestone: false, sortOrder: 2,
    },
  ],
  [
    {
      title: 'Build Your Financial Model',
      description: 'Create a simple 3-month revenue projection for your hackathon idea. Include assumptions for customer count, pricing, and key costs. Use a spreadsheet or the template from this episode.',
      deliverables: 'Screenshot of your financial model with all assumptions visible.',
      proofType: 'image', basePoints: 100, estimatedMinutes: 50, isMilestone: false, sortOrder: 1,
    },
    {
      title: 'Calculate Your Unit Economics',
      description: 'Calculate the Customer Acquisition Cost (CAC) and Customer Lifetime Value (CLV) for your product. Show whether your model is viable (CLV > 3× CAC).',
      deliverables: 'Written calculation with numbers and a one-line conclusion on viability.',
      proofType: 'text', basePoints: 75, estimatedMinutes: 30, isMilestone: false, sortOrder: 2,
    },
  ],
  [
    {
      title: 'Competitive Landscape Map',
      description: 'Identify your top 3 competitors and place them on a 2×2 matrix (axes: price vs quality, or any two dimensions that matter). Explain where your product sits and why.',
      deliverables: 'Photo or digital version of the 2×2 matrix with a 2-sentence explanation of your positioning.',
      proofType: 'image', basePoints: 75, estimatedMinutes: 30, isMilestone: false, sortOrder: 1,
    },
    {
      title: 'Write Your Differentiation Statement',
      description: 'Write a one-sentence differentiation statement using this formula: "For [target customer] who [need], [your product] is a [category] that [key benefit], unlike [competitor] which [limitation]."',
      deliverables: 'Your completed differentiation statement as text.',
      proofType: 'text', basePoints: 50, estimatedMinutes: 20, isMilestone: false, sortOrder: 2,
    },
  ],
  [
    {
      title: 'Create a Clickable Prototype',
      description: 'Build a clickable prototype of your product\'s core flow using Figma, Marvel, or any tool you prefer. It should show at least 3 screens and allow a user to complete one key task.',
      deliverables: 'A shareable link to your prototype or screenshots of all screens.',
      proofType: 'text', basePoints: 150, estimatedMinutes: 90, isMilestone: true, milestoneLabel: 'Prototype Builder', sortOrder: 1,
    },
    {
      title: 'Run a 15-Minute Usability Test',
      description: 'Give your prototype to one person who has not seen it before. Watch them use it without helping. Note 3 points where they got confused or hesitated.',
      deliverables: 'Written summary: 3 usability issues found and your proposed fix for each.',
      proofType: 'text', basePoints: 75, estimatedMinutes: 30, isMilestone: false, sortOrder: 2,
    },
  ],
  [
    {
      title: 'Prepare Your 3-Minute Pitch',
      description: 'Draft and rehearse a 3-minute pitch for your hackathon project. Use the structure: Problem → Solution → Market → Traction → Ask. Record yourself or do a practice run with a partner.',
      deliverables: 'A short video (≤3 min) of your pitch, or a written script with speaker notes.',
      proofType: 'video', basePoints: 150, estimatedMinutes: 60, isMilestone: true, milestoneLabel: 'Pitch Ready', sortOrder: 1,
    },
    {
      title: 'Collect Feedback & Iterate',
      description: 'Share your pitch/demo with at least 2 mentors or peers. Collect structured feedback and document the top 2 changes you will make before the final presentation.',
      deliverables: 'Written feedback summary and a before/after comparison of the 2 changes you made.',
      proofType: 'text', basePoints: 75, estimatedMinutes: 30, isMilestone: false, sortOrder: 2,
    },
  ],
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function withRetry(fn, label, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try { return await fn(); }
    catch (e) {
      if (attempt === retries) throw e;
      console.log(`  ⚠ retry ${attempt}/${retries} for [${label}]: ${e.message}`);
      await new Promise(r => setTimeout(r, 1500 * attempt));
      try { await prisma.$disconnect(); } catch (_) {}
      try { await prisma.$connect(); } catch (_) {}
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Ensure raw-SQL columns exist (idempotent, normally added by server startup)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE course_episodes ADD COLUMN IF NOT EXISTS timer_seconds INT`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS course_episode_id UUID REFERENCES course_episodes(id) ON DELETE CASCADE`
  );

  // Find hackathon course
  const courses = await prisma.course.findMany({
    where: { title: { contains: 'hackathon', mode: 'insensitive' } },
    include: { courseEpisodes: { orderBy: { order: 'asc' } } },
  });

  if (courses.length === 0) {
    const all = await prisma.course.findMany({ select: { id: true, title: true } });
    console.log('\nNo hackathon course found. All courses:');
    all.forEach(c => console.log(`  [${c.id}] ${c.title}`));
    process.exit(1);
  }

  for (const course of courses) {
    const episodes = course.courseEpisodes;
    console.log(`\n── Course: "${course.title}" | ${episodes.length} episodes ──\n`);

    if (episodes.length === 0) {
      console.log('  No episodes — skipping.');
      continue;
    }

    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      console.log(`  [${i + 1}/${episodes.length}] ${ep.title}`);

      // ── 1. Timer ──────────────────────────────────────────────────────────
      const [timerRow] = await prisma.$queryRawUnsafe(
        `SELECT timer_seconds FROM course_episodes WHERE id = $1::uuid`, ep.id
      );
      if (timerRow?.timer_seconds == null) {
        await withRetry(
          () => prisma.$executeRawUnsafe(
            `UPDATE course_episodes SET timer_seconds = $1 WHERE id = $2::uuid`,
            DEFAULT_TIMER_SECONDS, ep.id
          ),
          'timer'
        );
        console.log(`      ✓ timer set to ${DEFAULT_TIMER_SECONDS / 60} min`);
      } else {
        console.log(`      – timer already set (${timerRow.timer_seconds / 60} min)`);
      }

      // ── 2. Assessment (quiz_data) ─────────────────────────────────────────
      const [quizRow] = await prisma.$queryRawUnsafe(
        `SELECT quiz_data FROM course_episodes WHERE id = $1::uuid`, ep.id
      );
      const hasQuiz = quizRow?.quiz_data != null &&
        Array.isArray(quizRow.quiz_data?.questions) && quizRow.quiz_data.questions.length > 0;

      if (!hasQuiz) {
        const bank = QUIZ_BANKS[i % QUIZ_BANKS.length];
        await withRetry(
          () => prisma.$executeRawUnsafe(
            `UPDATE course_episodes SET quiz_data = $1::jsonb WHERE id = $2::uuid`,
            JSON.stringify(bank), ep.id
          ),
          'quiz_data'
        );
        console.log(`      ✓ assessment added (${bank.questions.length} questions)`);
      } else {
        console.log(`      – assessment already exists`);
      }

      // ── 3. Tasks (2 per episode) ──────────────────────────────────────────
      const existingTasks = await withRetry(
        () => prisma.$queryRawUnsafe(
          `SELECT id FROM tasks WHERE course_episode_id = $1::uuid LIMIT 1`, ep.id
        ),
        'check tasks'
      );

      if (existingTasks.length === 0) {
        const taskPair = TASK_PAIRS[i % TASK_PAIRS.length];
        for (const tmpl of taskPair) {
          const task = await withRetry(
            () => prisma.task.create({
              data: {
                title: tmpl.title,
                description: tmpl.description,
                deliverables: tmpl.deliverables,
                proofType: tmpl.proofType,
                basePoints: tmpl.basePoints,
                estimatedMinutes: tmpl.estimatedMinutes,
                isMilestone: tmpl.isMilestone,
                milestoneLabel: tmpl.milestoneLabel ?? null,
                bonusPoints: 0,
                sortOrder: tmpl.sortOrder,
                dayNumber: 1,
              },
            }),
            `task:${tmpl.title}`
          );
          await withRetry(
            () => prisma.$executeRawUnsafe(
              `UPDATE tasks SET course_episode_id = $1::uuid WHERE id = $2::uuid`,
              ep.id, task.id
            ),
            'link task'
          );
        }
        console.log(`      ✓ ${taskPair.length} tasks added`);
      } else {
        console.log(`      – tasks already exist`);
      }

      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log('\n✓ Done.\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

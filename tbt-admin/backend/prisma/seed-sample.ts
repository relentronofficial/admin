import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const CDN = 'https://tamil-business-tribe-cdn.b-cdn.net/thumbnails';
const IMG = {
  drip:       `${CDN}/drip-marketing.png`,
  zero:       `${CDN}/zero-rupee-marketing.png`,
  mindset:    `${CDN}/mindset-mastery.png`,
  scale:      `${CDN}/business-scalability.png`,
  screenshot: `${CDN}/screenshot-2026.png`,
};
const LOGO_URL = 'https://tamil-business-tribe-cdn.b-cdn.net/thumbnails/screenshot-2026.png';
const VIDEO_URL   = 'https://iframe.mediadelivery.net/embed/674791/6bc82f7c-bb64-492b-8439-8549fd53787b';
const BUNNY_ID    = '6bc82f7c-bb64-492b-8439-8549fd53787b';

async function main() {
  console.log('🌱 Seeding sample data...\n');

  // ── Get super admin ──────────────────────────────────────────────────────────
  const admin = await prisma.admin.findFirst({ where: { role: 'super_admin' } });
  if (!admin) { console.error('❌ Super admin not found. Run: npx prisma db seed first'); process.exit(1); }
  const adminId = admin.id;
  console.log(`✅ Using admin: ${admin.fullName}`);

  // ── SiteConfig ───────────────────────────────────────────────────────────────
  console.log('⚙️  SiteConfig...');
  await prisma.siteConfig.deleteMany();
  await prisma.siteConfig.create({ data: {
    siteName: 'Tamil Business Tribe',
    logoUrl: LOGO_URL,
    faviconUrl: LOGO_URL,
    footerText: '© 2026 Tamil Business Tribe. All rights reserved.',
    splashLogoUrl: LOGO_URL,
    splashDurationMs: 2000,
    accentColor: '#00c4cc',
    alertColor: '#ff3d8b',
    successColor: '#22c55e',
    bgPrimary: '#000000',
    bgSurface: '#111111',
    navShowNotifications: true,
    navShowMessages: true,
    navShowProfile: true,
    heroAutoPlayIntervalMs: 5000,
    loginBgUrl: IMG.drip,
    loginBgMobileUrl: IMG.drip,
  }});
  console.log('   ✅ SiteConfig');

  // ── NavItems ─────────────────────────────────────────────────────────────────
  console.log('📌 NavItems...');
  await prisma.navItem.deleteMany();
  const navDefs = [
    { label: 'Home',          href: '/tbt',            order: 1 },
    { label: 'Workshops',     href: '/workshops',      order: 2 },
    { label: 'Task',          href: '/batch-program',  order: 3 },
    { label: 'Products',      href: '/Products',       order: 4 },
    { label: 'Resources',     href: '/Resources',      order: 5 },
    { label: 'Notifications', href: '/notifications',  order: 6 },
    { label: 'Messages',      href: '/messages',       order: 7 },
    { label: 'Profile',       href: '/profile',        order: 8 },
  ];
  for (const n of navDefs) await prisma.navItem.create({ data: { ...n, isVisible: true } });
  console.log(`   ✅ ${navDefs.length} nav items`);

  // ── UiStrings ────────────────────────────────────────────────────────────────
  console.log('🔤 UiStrings...');
  const existingStrings = await prisma.uiStrings.findFirst();
  if (!existingStrings) await prisma.uiStrings.create({ data: {} });
  console.log('   ✅ UiStrings ready');

  // ── Tiers ────────────────────────────────────────────────────────────────────
  console.log('🏆 Tiers...');
  await prisma.tier.deleteMany();
  await prisma.tier.createMany({ data: [
    { tierNumber: 1, label: 'Starter',  description: 'Begin your business journey with core fundamentals.', unlockConditionText: 'Available on all plans', isActive: true },
    { tierNumber: 2, label: 'Builder',  description: 'Build systems that scale with advanced strategies.', unlockConditionText: 'Complete 30 days', isActive: true },
    { tierNumber: 3, label: 'Scaler',   description: 'Scale your business to new heights.', unlockConditionText: 'Complete 60 days', isActive: true },
  ]});
  console.log('   ✅ 3 tiers');

  // ── DisplayBadges ────────────────────────────────────────────────────────────
  console.log('🏅 DisplayBadges...');
  await prisma.displayBadge.deleteMany();
  const badges = await Promise.all([
    prisma.displayBadge.create({ data: { label: 'Rising Star',  color: '#ffffff', bgColor: '#f59e0b', isActive: true } }),
    prisma.displayBadge.create({ data: { label: 'Top Performer',color: '#ffffff', bgColor: '#ef4444', isActive: true } }),
    prisma.displayBadge.create({ data: { label: 'Mentor',       color: '#ffffff', bgColor: '#8b5cf6', isActive: true } }),
    prisma.displayBadge.create({ data: { label: 'Pioneer',      color: '#ffffff', bgColor: '#06b6d4', isActive: true } }),
  ]);
  console.log(`   ✅ ${badges.length} display badges`);

  // ── HeroSlides ───────────────────────────────────────────────────────────────
  console.log('🎬 HeroSlides...');
  await prisma.heroSlide.deleteMany();
  await prisma.heroSlide.createMany({ data: [
    { order: 1, title: 'Master Drip Marketing', description: 'Automate your lead nurturing and convert prospects into loyal customers with proven drip sequences.', bgImageUrl: IMG.drip, ctaLabel: 'Start Learning', ctaUrl: '/workshops', ctaType: 'internal', badgeText: 'NEW', isActive: true },
    { order: 2, title: 'Zero Rupee Marketing',  description: 'Grow your business without spending a single rupee on ads. Real strategies. Real growth.', bgImageUrl: IMG.zero, ctaLabel: 'Explore Workshops', ctaUrl: '/workshops', ctaType: 'internal', badgeText: 'LIVE', isActive: true },
    { order: 3, title: 'Business Scalability',  description: 'Build scalable systems and a strong team to take your business to 10x growth.', bgImageUrl: IMG.scale, ctaLabel: 'View Courses', ctaUrl: '/tbt', ctaType: 'internal', badgeText: 'HOT', isActive: true },
  ]});
  console.log('   ✅ 3 hero slides');

  // ── Program + Batch ──────────────────────────────────────────────────────────
  console.log('📅 Program + Batch...');
  const program = await prisma.program.create({ data: {
    name: 'TBT 90-Day Business Accelerator',
    description: 'A structured 90-day program to build, grow and scale your business with Tamil Business Tribe.',
    durationDays: 90, incubationDays: 7, status: 'active',
  }});
  const batch = await prisma.batch.create({ data: {
    name: 'Batch 2026 — Cohort A',
    description: 'First cohort of 2026. Join us for an intensive 90-day journey.',
    programId: program.id,
    startsAt: new Date('2026-06-01'), endsAt: new Date('2026-08-31'), isActive: true,
  }});
  console.log(`   ✅ Program: ${program.name}`);
  console.log(`   ✅ Batch: ${batch.name}`);

  // ── Members ──────────────────────────────────────────────────────────────────
  console.log('👥 Members...');
  await prisma.member.deleteMany({ where: { clerkId: null } });
  const memberDefs = [
    { memberId: 'TBT-1001', firstName: 'Arjun',   lastName: 'Subramaniam', email: 'arjun.sub@test.tbt',   phone: '+919876500001', city: 'Chennai',   businessName: 'Arjun Digital', sector: 'Marketing', currentTier: 1, membershipPlan: 'premium' as const },
    { memberId: 'TBT-1002', firstName: 'Priya',   lastName: 'Krishnan',    email: 'priya.k@test.tbt',     phone: '+919876500002', city: 'Coimbatore', businessName: 'PK Ventures',   sector: 'Retail',    currentTier: 2, membershipPlan: 'premium' as const },
    { memberId: 'TBT-1003', firstName: 'Ravi',    lastName: 'Murugan',     email: 'ravi.m@test.tbt',      phone: '+919876500003', city: 'Madurai',    businessName: 'Ravi Foods',    sector: 'Food & Bev',currentTier: 1, membershipPlan: 'starter' as const },
    { memberId: 'TBT-1004', firstName: 'Deepika', lastName: 'Natarajan',   email: 'deepika.n@test.tbt',   phone: '+919876500004', city: 'Salem',      businessName: 'DN Textiles',   sector: 'Textiles',  currentTier: 3, membershipPlan: 'vip' as const },
    { memberId: 'TBT-1005', firstName: 'Karthik', lastName: 'Selvam',      email: 'karthik.s@test.tbt',   phone: '+919876500005', city: 'Trichy',     businessName: 'KS Tech',       sector: 'Technology',currentTier: 2, membershipPlan: 'premium' as const },
  ];
  const members: any[] = [];
  for (const m of memberDefs) {
    const member = await prisma.member.upsert({
      where: { email: m.email },
      create: { ...m, status: 'active', batchId: batch.id, totalPoints: Math.floor(Math.random()*500+100), healthScore: Math.floor(Math.random()*40+60), onboardingCompleted: true, lastActiveAt: new Date() },
      update: { batchId: batch.id },
    });
    members.push(member);
  }
  console.log(`   ✅ ${members.length} members`);

  // ── BatchDays (Days 1-30 with full content) ──────────────────────────────────
  console.log('📅 BatchDays...');
  await prisma.memberDayProgress.deleteMany({ where: { batchId: batch.id } });
  await prisma.batchDay.deleteMany({ where: { batchId: batch.id } });

  const BATCH_DAYS = [
    { day: 1,  title: 'Define Your Vision',          notes: 'Start by writing a clear vision statement for your business. Where do you want to be in 90 days?', tasks: [{ id: 't1-1', title: 'Write your 90-day vision statement', order: 1 }, { id: 't1-2', title: 'List your top 3 business goals', order: 2 }, { id: 't1-3', title: 'Share your vision in the community', order: 3 }] },
    { day: 2,  title: 'Know Your Customer',           notes: 'Deep research on your ideal customer. The better you know them, the better you can serve them.', tasks: [{ id: 't2-1', title: 'Create a customer avatar document', order: 1 }, { id: 't2-2', title: 'Interview 2 existing customers', order: 2 }, { id: 't2-3', title: 'Identify their top 3 pain points', order: 3 }] },
    { day: 3,  title: 'Competitive Analysis',         notes: 'Understand your market landscape. Find the gaps where you can win.', tasks: [{ id: 't3-1', title: 'List 5 top competitors', order: 1 }, { id: 't3-2', title: 'Analyse their strengths and weaknesses', order: 2 }, { id: 't3-3', title: 'Identify your differentiation', order: 3 }] },
    { day: 4,  title: 'Craft Your USP',               notes: 'Your Unique Selling Proposition is the reason customers choose you over everyone else.', tasks: [{ id: 't4-1', title: 'Write your USP in one sentence', order: 1 }, { id: 't4-2', title: 'Test it on 3 people outside your business', order: 2 }] },
    { day: 5,  title: 'Revenue Goals',                notes: 'Set specific, measurable revenue targets for the next 30, 60 and 90 days.', tasks: [{ id: 't5-1', title: 'Set your 30-day revenue target', order: 1 }, { id: 't5-2', title: 'Set your 60-day revenue target', order: 2 }, { id: 't5-3', title: 'Set your 90-day revenue target', order: 3 }, { id: 't5-4', title: 'Calculate what you need to sell to hit each target', order: 4 }] },
    { day: 6,  title: 'Product/Service Audit',        notes: 'Review everything you currently offer. Keep what works, eliminate what doesn\'t.', tasks: [{ id: 't6-1', title: 'List all your current offerings', order: 1 }, { id: 't6-2', title: 'Identify your most profitable product/service', order: 2 }, { id: 't6-3', title: 'Remove or improve your lowest performer', order: 3 }] },
    { day: 7,  title: 'Weekly Review & Plan',         notes: 'First weekly review! Reflect on week 1 and plan week 2 with intention.', tasks: [{ id: 't7-1', title: 'Write your Week 1 wins and lessons', order: 1 }, { id: 't7-2', title: 'Plan your top 3 priorities for Week 2', order: 2 }, { id: 't7-3', title: 'Update your accountability tracker', order: 3 }] },
    { day: 8,  title: 'Social Media Strategy',        notes: 'Choose your platforms strategically. Focus beats presence everywhere.', tasks: [{ id: 't8-1', title: 'Choose 2 primary social platforms', order: 1 }, { id: 't8-2', title: 'Optimise your bio/profile on both', order: 2 }, { id: 't8-3', title: 'Post one piece of value content', order: 3 }] },
    { day: 9,  title: 'Content Pillars',              notes: 'Define the 3-5 core topics you will consistently create content about.', tasks: [{ id: 't9-1', title: 'Define your 3 content pillars', order: 1 }, { id: 't9-2', title: 'Create 5 content ideas for each pillar', order: 2 }] },
    { day: 10, title: 'Lead Generation',              notes: 'Build a consistent system for attracting new potential customers every day.', tasks: [{ id: 't10-1', title: 'Identify your top 3 lead sources', order: 1 }, { id: 't10-2', title: 'Set a daily lead outreach target', order: 2 }, { id: 't10-3', title: 'Send 5 personalised outreach messages today', order: 3 }] },
    { day: 11, title: 'Email List Building',          notes: 'Your email list is your most valuable asset. Start building it today.', tasks: [{ id: 't11-1', title: 'Set up a free lead magnet', order: 1 }, { id: 't11-2', title: 'Create a simple opt-in landing page', order: 2 }, { id: 't11-3', title: 'Share the link in your social profiles', order: 3 }] },
    { day: 12, title: 'Sales Conversation Skills',    notes: 'Learn how to convert a prospect into a customer with confidence.', tasks: [{ id: 't12-1', title: 'Write your core sales script', order: 1 }, { id: 't12-2', title: 'Role-play the script with a partner', order: 2 }, { id: 't12-3', title: 'Handle 5 objections in writing', order: 3 }] },
    { day: 13, title: 'Pricing Strategy',             notes: 'Price for value, not just cost. Understand your pricing psychology.', tasks: [{ id: 't13-1', title: 'Review your current pricing', order: 1 }, { id: 't13-2', title: 'Research competitor pricing', order: 2 }, { id: 't13-3', title: 'Adjust one price based on your findings', order: 3 }] },
    { day: 14, title: 'Weekly Review & Plan',         notes: 'Week 2 review. Celebrate your wins and course-correct where needed.', tasks: [{ id: 't14-1', title: 'Write your Week 2 wins and lessons', order: 1 }, { id: 't14-2', title: 'Plan your top 3 priorities for Week 3', order: 2 }] },
    { day: 15, title: 'Customer Retention System',    notes: 'Keeping a customer costs 5x less than acquiring a new one. Build your retention system.', tasks: [{ id: 't15-1', title: 'Map your current customer journey', order: 1 }, { id: 't15-2', title: 'Identify 3 drop-off points', order: 2 }, { id: 't15-3', title: 'Create one follow-up sequence for new customers', order: 3 }] },
    { day: 16, title: 'Referral Programme',           notes: 'Turn happy customers into your best sales team.', tasks: [{ id: 't16-1', title: 'Design a simple referral incentive', order: 1 }, { id: 't16-2', title: 'Reach out to 10 existing customers for referrals', order: 2 }] },
    { day: 17, title: 'Business Systems Audit',       notes: 'Identify what processes can be systematised or delegated.', tasks: [{ id: 't17-1', title: 'List every recurring task in your business', order: 1 }, { id: 't17-2', title: 'Mark which can be systematised', order: 2 }, { id: 't17-3', title: 'Document one process as an SOP', order: 3 }] },
    { day: 18, title: 'Financial Hygiene',            notes: 'Know your numbers. A business that doesn\'t track cash is flying blind.', tasks: [{ id: 't18-1', title: 'Update your income and expenses tracker', order: 1 }, { id: 't18-2', title: 'Calculate your net profit for the month so far', order: 2 }, { id: 't18-3', title: 'Identify one unnecessary expense to cut', order: 3 }] },
    { day: 19, title: 'Brand Identity',               notes: 'Consistent branding builds trust and recognition. Audit your brand today.', tasks: [{ id: 't19-1', title: 'Audit your logo, colours, and fonts', order: 1 }, { id: 't19-2', title: 'Ensure consistency across all platforms', order: 2 }] },
    { day: 20, title: 'Community Engagement',         notes: 'The Tamil Business Tribe community is your growth engine. Use it actively.', tasks: [{ id: 't20-1', title: 'Comment on 5 posts in the community', order: 1 }, { id: 't20-2', title: 'Share one insight or win in the community', order: 2 }, { id: 't20-3', title: 'Connect with 2 new members', order: 3 }] },
    { day: 21, title: 'Weekly Review & Plan',         notes: 'Week 3 review. You are 21 days in — a new habit is forming!', tasks: [{ id: 't21-1', title: 'Write your Week 3 wins and lessons', order: 1 }, { id: 't21-2', title: 'Plan Week 4 priorities', order: 2 }, { id: 't21-3', title: 'Reflect: what habit has changed in 3 weeks?', order: 3 }] },
    { day: 22, title: 'Video Marketing',              notes: 'Video builds trust faster than any other medium. Start with one short video today.', tasks: [{ id: 't22-1', title: 'Record one 60-second value video', order: 1 }, { id: 't22-2', title: 'Post it to your primary platform', order: 2 }] },
    { day: 23, title: 'Networking Strategy',          notes: 'Your network is your net worth. Be intentional about who you connect with.', tasks: [{ id: 't23-1', title: 'Identify 10 people you want to connect with this month', order: 1 }, { id: 't23-2', title: 'Reach out to 3 of them with a genuine message', order: 2 }] },
    { day: 24, title: 'Partnership Opportunities',   notes: 'Find businesses that serve your customer without competing with you.', tasks: [{ id: 't24-1', title: 'List 5 potential business partners', order: 1 }, { id: 't24-2', title: 'Draft a collaboration proposal for one of them', order: 2 }] },
    { day: 25, title: 'Customer Feedback System',    notes: 'Feedback is the fastest path to product improvement.', tasks: [{ id: 't25-1', title: 'Create a 3-question customer survey', order: 1 }, { id: 't25-2', title: 'Send it to 20 customers', order: 2 }, { id: 't25-3', title: 'Summarise the top 3 insights from responses', order: 3 }] },
    { day: 26, title: 'Google Business Profile',     notes: 'If you have a local business, your Google profile is free real estate. Optimise it.', tasks: [{ id: 't26-1', title: 'Claim or update your Google Business Profile', order: 1 }, { id: 't26-2', title: 'Add photos, hours, and services', order: 2 }, { id: 't26-3', title: 'Request 3 reviews from customers', order: 3 }] },
    { day: 27, title: 'WhatsApp Marketing',          notes: 'WhatsApp is the most powerful direct marketing tool for Indian businesses.', tasks: [{ id: 't27-1', title: 'Create a WhatsApp broadcast list', order: 1 }, { id: 't27-2', title: 'Write and send a value message to your list', order: 2 }] },
    { day: 28, title: 'Weekly Review & Plan',         notes: 'Week 4 complete — 1 month in! Celebrate and recalibrate.', tasks: [{ id: 't28-1', title: 'Write your Week 4 and Month 1 reflection', order: 1 }, { id: 't28-2', title: 'Compare actual vs planned revenue', order: 2 }, { id: 't28-3', title: 'Set Month 2 targets', order: 3 }] },
    { day: 29, title: 'Upsell Strategy',             notes: 'The easiest sale is to a customer who already trusts you. Build your upsell path.', tasks: [{ id: 't29-1', title: 'Design a premium version of your best offer', order: 1 }, { id: 't29-2', title: 'Write the upsell pitch for existing customers', order: 2 }] },
    { day: 30, title: '30-Day Milestone Review',     notes: 'Congratulations on completing Day 30! This is a major milestone. Review everything.', tasks: [{ id: 't30-1', title: 'Write your 30-day achievement summary', order: 1 }, { id: 't30-2', title: 'Share a win in the community', order: 2 }, { id: 't30-3', title: 'Set your top 3 focus areas for Days 31-60', order: 3 }] },
  ];

  for (const bd of BATCH_DAYS) {
    await prisma.batchDay.create({ data: {
      batchId: batch.id,
      dayNumber: bd.day,
      title: bd.title,
      notes: bd.notes,
      resourceUrl: bd.day % 5 === 0 ? VIDEO_URL : null,
      tasks: bd.tasks,
    }});
  }
  // Seed remaining days 31-90 with generic titles
  for (let d = 31; d <= 90; d++) {
    const week = Math.ceil(d / 7);
    const isReview = d % 7 === 0;
    await prisma.batchDay.create({ data: {
      batchId: batch.id,
      dayNumber: d,
      title: isReview ? `Week ${week} Review & Plan` : `Day ${d} — Growth Activity`,
      notes: isReview ? `Review your progress from Week ${week} and plan next week\'s priorities.` : `Focus on consistent execution of your daily habits and growth activities.`,
      tasks: isReview
        ? [{ id: `t${d}-1`, title: `Write your Week ${week} wins`, order: 1 }, { id: `t${d}-2`, title: 'Plan next week\'s priorities', order: 2 }]
        : [{ id: `t${d}-1`, title: 'Complete today\'s growth task', order: 1 }, { id: `t${d}-2`, title: 'Update your accountability tracker', order: 2 }],
    }});
  }
  console.log('   ✅ 90 batch days seeded');

  // Seed some MemberDayProgress for first 3 members
  const today = new Date();
  const batchStart = new Date(batch.startsAt);
  const daysSinceStart = Math.floor((today.getTime() - batchStart.getTime()) / 86_400_000);
  const completedUpTo = Math.min(daysSinceStart, 30);

  const progressStatuses = ['approved', 'approved', 'approved', 'pending_approval', 'approved', 'approved', 'approved', 'rejected', 'approved', 'in_progress'] as const;

  for (let di = 0; di < Math.min(completedUpTo, 10); di++) {
    const dayNum = di + 1;
    const dayData = BATCH_DAYS.find(b => b.day === dayNum);
    const taskIds = dayData?.tasks.map(t => t.id) ?? [];
    const status = progressStatuses[di % progressStatuses.length];

    // Member 0 has most progress
    await prisma.memberDayProgress.upsert({
      where: { batchId_memberId_dayNumber: { batchId: batch.id, memberId: members[0].id, dayNumber: dayNum } },
      create: {
        batchId: batch.id, memberId: members[0].id, dayNumber: dayNum,
        status, isCompleted: status === 'approved',
        completedTaskIds: taskIds,
        journalEntry: `Day ${dayNum} was productive. I completed all tasks and learned a lot about ${dayData?.title ?? 'the topic'}.`,
        submittedAt: status !== 'in_progress' && status !== 'not_started' ? new Date(batchStart.getTime() + dayNum * 86_400_000) : null,
        reviewedAt: status === 'approved' || status === 'rejected' ? new Date() : null,
        reviewNote: status === 'rejected' ? 'Please add more detail to your journal entry and complete all tasks before resubmitting.' : null,
      },
      update: {},
    });

    // Member 1 has partial progress (first 5 days approved)
    if (di < 5) {
      await prisma.memberDayProgress.upsert({
        where: { batchId_memberId_dayNumber: { batchId: batch.id, memberId: members[1].id, dayNumber: dayNum } },
        create: {
          batchId: batch.id, memberId: members[1].id, dayNumber: dayNum,
          status: 'approved', isCompleted: true,
          completedTaskIds: taskIds,
          journalEntry: `Completed day ${dayNum} tasks successfully.`,
          submittedAt: new Date(batchStart.getTime() + dayNum * 86_400_000),
          reviewedAt: new Date(),
        },
        update: {},
      });
    }
  }
  console.log(`   ✅ Member day progress seeded for first ${Math.min(completedUpTo, 10)} days`);

  // ── Subscriptions ────────────────────────────────────────────────────────────
  console.log('💳 Subscriptions...');
  for (const m of members) {
    const existing = await prisma.subscription.findFirst({ where: { memberId: m.id } });
    if (!existing) {
      await prisma.subscription.create({ data: {
        memberId: m.id,
        plan: m.membershipPlan,
        status: 'active',
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2027-01-01'),
        amount: m.membershipPlan === 'vip' ? 9999 : m.membershipPlan === 'premium' ? 4999 : 1999,
      }});
    }
  }
  console.log(`   ✅ ${members.length} subscriptions`);

  // ── Workshops ────────────────────────────────────────────────────────────────
  console.log('🎓 Workshops...');
  await prisma.workshopFlowItem.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.workshopEpisode.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.liveCall.deleteMany();
  await prisma.qAPost.deleteMany();
  await prisma.workshop.deleteMany();

  const workshopDefs = [
    { title: 'Drip Marketing Mastery', slug: 'drip-marketing-mastery', description: 'Master the art of automated email sequences that nurture leads and drive conversions on autopilot.', thumbnailUrl: IMG.drip, requiredTier: 1 },
    { title: 'Zero Rupee Marketing',   slug: 'zero-rupee-marketing',   description: 'Grow your business without ad spend using organic strategies, word-of-mouth and community power.', thumbnailUrl: IMG.zero, requiredTier: 1 },
    { title: 'Mindset Mastery',        slug: 'mindset-mastery',        description: 'Rewire your thinking for entrepreneurial success. Build resilience, focus and a growth mindset.', thumbnailUrl: IMG.mindset, requiredTier: 2 },
  ];

  for (const wDef of workshopDefs) {
    const workshop = await prisma.workshop.create({ data: {
      ...wDef, isActive: true, deliveryMode: 'online', batchId: batch.id,
      tabChallengesLabel: 'Challenges', tabQaLabel: 'Q & A', tabAssignmentLabel: 'Assignment',
      progressWidgetLabel: 'Learning Progress', workshopFlowLabel: 'Workshop Flow',
    }});

    // Enroll all members
    for (const m of members) {
      await prisma.workshopEnrollment.upsert({
        where: { workshopId_memberId: { workshopId: workshop.id, memberId: m.id } },
        create: { workshopId: workshop.id, memberId: m.id, status: 'active' },
        update: {},
      });
    }

    // Challenge 1 — 3 episodes
    const c1 = await prisma.challenge.create({ data: {
      workshopId: workshop.id, order: 1, challengeNumber: 1, numberLabel: '01', numberColor: '#00c4cc',
      title: 'Foundation', description: 'Build the core foundation of your strategy.',
    }});
    const ep1 = await prisma.workshopEpisode.create({ data: { challengeId: c1.id, order: 1, title: 'Introduction & Overview', description: 'Welcome to the workshop. Here\'s what you\'ll learn.', videoUrl: VIDEO_URL, bunnyVideoId: BUNNY_ID, durationSeconds: 1200, durationLabel: '20 min', typeLabel: 'Video' }});
    const ep2 = await prisma.workshopEpisode.create({ data: { challengeId: c1.id, order: 2, title: 'Core Concepts Explained', description: 'Deep dive into the fundamental principles.', videoUrl: VIDEO_URL, bunnyVideoId: BUNNY_ID, durationSeconds: 1800, durationLabel: '30 min', typeLabel: 'Video' }});
    const ep3 = await prisma.workshopEpisode.create({ data: { challengeId: c1.id, order: 3, title: 'Practical Exercise', description: 'Apply what you\'ve learned with this hands-on exercise.', videoUrl: VIDEO_URL, bunnyVideoId: BUNNY_ID, durationSeconds: 900, durationLabel: '15 min', typeLabel: 'Video' }});
    const a1 = await prisma.assignment.create({ data: { challengeId: c1.id, order: 1, title: 'Define Your Target Audience', questionText: 'Describe your ideal customer in detail. Include demographics, pain points, and what drives their purchasing decisions.', typeLabel: 'QUESTION', iconType: 'document' }});

    // Challenge 2 — 2 episodes
    const c2 = await prisma.challenge.create({ data: {
      workshopId: workshop.id, order: 2, challengeNumber: 2, numberLabel: '02', numberColor: '#f59e0b',
      title: 'Strategy Building', description: 'Develop your personalised action plan.',
    }});
    const ep4 = await prisma.workshopEpisode.create({ data: { challengeId: c2.id, order: 1, title: 'Building Your Strategy', description: 'Step-by-step guide to creating your roadmap.', videoUrl: VIDEO_URL, bunnyVideoId: BUNNY_ID, durationSeconds: 2100, durationLabel: '35 min', typeLabel: 'Video' }});
    const ep5 = await prisma.workshopEpisode.create({ data: { challengeId: c2.id, order: 2, title: 'Implementation Tactics', description: 'Tactical execution tips from successful businesses.', videoUrl: VIDEO_URL, bunnyVideoId: BUNNY_ID, durationSeconds: 1500, durationLabel: '25 min', typeLabel: 'Video' }});
    const a2 = await prisma.assignment.create({ data: { challengeId: c2.id, order: 1, title: 'Create Your 30-Day Plan', questionText: 'Write out your 30-day action plan with specific daily tasks, milestones, and measurable outcomes you want to achieve.', typeLabel: 'QUESTION', iconType: 'document' }});

    // Live Call
    const liveCall = await prisma.liveCall.create({ data: {
      workshopId: workshop.id, order: 1, type: 'live_call',
      label: 'LIVE CALL:', labelColor: '#ff3d8b',
      title: 'Group Coaching & Q&A',
      scheduledAt: new Date('2026-07-15T10:00:00Z'),
      liveUrl: 'https://zoom.us/j/sample',
      liveUrlUnlocksMinutesBefore: 30,
      recordingLabel: 'Watch Recording',
      facilitatorName: 'Manoj Kumar', facilitatorTitle: 'Founder, Tamil Business Tribe',
      facilitatorDescription: 'Serial entrepreneur and business coach with 15+ years of experience helping Tamil businesses scale.',
      stayTunedMessage: 'Stay tuned — the link will unlock 30 minutes before the session begins.',
    }});

    // Workshop Flow
    await prisma.workshopFlowItem.createMany({ data: [
      { workshopId: workshop.id, order: 1, type: 'custom',         label: 'Pre-Requisite Reading', description: 'Complete the foundation reading before attending the live session.', isCompleted: false },
      { workshopId: workshop.id, order: 2, type: 'challenge_start', label: 'Challenge 1: Foundation',  description: 'Start with the foundation modules.',        isCompleted: false, challengeId: c1.id },
      { workshopId: workshop.id, order: 3, type: 'challenge_start', label: 'Challenge 2: Strategy',    description: 'Build your personalised strategy.',          isCompleted: false, challengeId: c2.id },
      { workshopId: workshop.id, order: 4, type: 'live_call',       label: 'Live Group Coaching',      description: 'Join our live Q&A session with the mentor.', isCompleted: false, liveCallId: liveCall.id },
    ]});

    // Q&A Posts (from test members)
    const qaQ1 = await prisma.qAPost.create({ data: { workshopId: workshop.id, memberId: members[0].id, questionText: 'How long before I see results using these strategies in my business?' }});
    await prisma.qAReply.create({ data: { postId: qaQ1.id, adminId: adminId, replyText: 'Most members see initial traction within 2-4 weeks. Consistency is key — stick to the daily tasks and you\'ll see momentum build quickly.' }});

    const qaQ2 = await prisma.qAPost.create({ data: { workshopId: workshop.id, memberId: members[1].id, questionText: 'Can I apply this to a product-based business or is it only for services?' }});
    await prisma.qAReply.create({ data: { postId: qaQ2.id, adminId: adminId, replyText: 'Absolutely! The principles work for both product and service businesses. We have members from retail, food & beverage, and manufacturing all applying these strategies successfully.' }});

    const qaQ3 = await prisma.qAPost.create({ data: { workshopId: workshop.id, memberId: members[2].id, questionText: 'What is the best time to do the daily tasks?' }});

    // Some episode progress for first member
    for (const ep of [ep1, ep2]) {
      await prisma.memberEpisodeProgress.upsert({
        where: { memberId_episodeId: { memberId: members[0].id, episodeId: ep.id } },
        create: { memberId: members[0].id, episodeId: ep.id, isCompleted: true, completedAt: new Date(), lastWatchedSecs: ep.durationSeconds ?? 0 },
        update: {},
      });
    }

    console.log(`   ✅ Workshop: ${workshop.title}`);
  }

  // ── Courses + Episodes ───────────────────────────────────────────────────────
  console.log('📚 Courses...');
  await prisma.courseEpisode.deleteMany();
  await prisma.course.deleteMany();

  const courseDefs = [
    { title: 'Digital Marketing Fundamentals', slug: 'digital-marketing-fundamentals', description: 'Learn the core principles of digital marketing including SEO, social media, email marketing and paid ads.', thumbnailUrl: IMG.drip,    level: 'beginner' as const,      accessType: 'subscription' as const, requiredTier: 1, totalModules: 3, totalLessons: 9 },
    { title: 'Business Scalability Blueprint',  slug: 'business-scalability-blueprint',  description: 'A comprehensive guide to building scalable systems, processes and teams for rapid business growth.',       thumbnailUrl: IMG.scale,   level: 'intermediate' as const,  accessType: 'subscription' as const, requiredTier: 2, totalModules: 3, totalLessons: 9 },
    { title: 'Mindset & Productivity Mastery',  slug: 'mindset-productivity-mastery',    description: 'Develop the mental frameworks and daily habits of highly successful entrepreneurs.',                       thumbnailUrl: IMG.mindset, level: 'beginner' as const,      accessType: 'free' as const,         requiredTier: 1, totalModules: 2, totalLessons: 6 },
  ];

  for (const cDef of courseDefs) {
    const course = await prisma.course.create({ data: {
      ...cDef, isPublished: true, isFeatured: true, status: 'published',
      isActive: true, sortOrder: 1, durationHours: 4.5,
      createdBy: adminId,
    }});

    // 3 episodes per course
    const episodeTitles = [
      [`Introduction to ${cDef.title}`, 'Core Concepts Deep Dive', 'Advanced Techniques & Best Practices'],
      ['Building Your Framework', 'Systems & Processes', 'Scaling Your Operations'],
      ['Mindset Fundamentals', 'Productivity Systems', 'Sustaining Long-term Growth'],
    ];
    const titles = episodeTitles[courseDefs.indexOf(cDef)] ?? episodeTitles[0];
    for (let i = 0; i < titles.length; i++) {
      await prisma.courseEpisode.create({ data: {
        courseId: course.id, order: i + 1, title: titles[i],
        thumbnailUrl: cDef.thumbnailUrl, videoUrl: VIDEO_URL,
        bunnyVideoId: BUNNY_ID, durationSeconds: 1200 + i * 300, isVisible: true,
      }});
    }

    // Enroll first 3 members
    for (const m of members.slice(0, 3)) {
      await prisma.courseEnrollment.upsert({
        where: { memberId_courseId: { memberId: m.id, courseId: course.id } },
        create: { memberId: m.id, courseId: course.id, progressPercentage: Math.floor(Math.random()*60+10) },
        update: {},
      });
    }

    console.log(`   ✅ Course: ${course.title}`);
  }

  // ── ContentSections + Items ──────────────────────────────────────────────────
  console.log('📦 Content Sections...');
  await prisma.contentItem.deleteMany();
  await prisma.contentSection.deleteMany();

  // Look up created workshops for relation linking
  const [wsDrip, wsZero] = await Promise.all([
    prisma.workshop.findUnique({ where: { slug: 'drip-marketing-mastery' }, select: { id: true } }),
    prisma.workshop.findUnique({ where: { slug: 'zero-rupee-marketing' },   select: { id: true } }),
  ]);

  const courses = await prisma.course.findMany({ take: 4 });
  const sectionDefs = [
    { title: 'Featured Series', slug: 'featured-series', order: 1, requiredTier: 1,
      items: [
        { title: 'Drip Marketing Mastery',        thumbnailUrl: IMG.drip,       contentType: 'series',     categoryTag: 'Marketing',    workshopId: wsDrip?.id ?? null,  playUrl: null },
        { title: 'Zero Rupee Marketing',           thumbnailUrl: IMG.zero,       contentType: 'series',     categoryTag: 'Growth',       workshopId: wsZero?.id ?? null,  playUrl: null },
        { title: 'Business Scalability Blueprint', thumbnailUrl: IMG.scale,      contentType: 'series',     categoryTag: 'Strategy',     workshopId: null, playUrl: '/tbt' },
        { title: 'Mindset Mastery Podcast',        thumbnailUrl: IMG.mindset,    contentType: 'podcast',    categoryTag: 'Mindset',      workshopId: null, playUrl: '/tbt' },
      ]},
    { title: 'Continue Learning', slug: 'continue-learning', order: 2, requiredTier: 1,
      items: [
        { title: 'Digital Marketing Fundamentals', thumbnailUrl: IMG.drip,       contentType: 'standalone', categoryTag: 'Marketing',    workshopId: null, playUrl: '/tbt' },
        { title: 'Mindset & Productivity',         thumbnailUrl: IMG.mindset,    contentType: 'standalone', categoryTag: 'Productivity', workshopId: null, playUrl: '/tbt' },
        { title: 'Customer Acquisition',           thumbnailUrl: IMG.screenshot, contentType: 'standalone', categoryTag: 'Sales',        workshopId: null, playUrl: '/tbt' },
      ]},
    { title: 'Tier 2 Exclusive', slug: 'tier-2-exclusive', order: 3, requiredTier: 2, lockBadgeText: 'Builder',
      items: [
        { title: 'Advanced Sales Funnel Design',   thumbnailUrl: IMG.scale,      contentType: 'series',     categoryTag: 'Sales',        workshopId: null, playUrl: '/tbt', requiredTier: 2 },
        { title: 'Team Building Masterclass',      thumbnailUrl: IMG.screenshot, contentType: 'series',     categoryTag: 'Leadership',   workshopId: null, playUrl: '/tbt', requiredTier: 2 },
      ]},
  ];

  for (const sDef of sectionDefs) {
    const section = await prisma.contentSection.create({ data: {
      title: sDef.title, slug: sDef.slug, order: sDef.order,
      isVisible: true, requiredTier: sDef.requiredTier,
      lockBadgeText: sDef.lockBadgeText,
    }});
    for (let i = 0; i < sDef.items.length; i++) {
      const item = sDef.items[i];
      await prisma.contentItem.create({ data: {
        sectionId: section.id, order: i + 1, isVisible: true,
        title: item.title, thumbnailUrl: item.thumbnailUrl,
        contentType: item.contentType, categoryTag: item.categoryTag,
        workshopId: (item as any).workshopId ?? null,
        playUrl: (item as any).workshopId ? null : (item.playUrl ?? null),
        requiredTier: (item as any).requiredTier ?? sDef.requiredTier,
      }});
    }
    console.log(`   ✅ Section: ${section.title} (${sDef.items.length} items)`);
  }

  // ── Products ─────────────────────────────────────────────────────────────────
  console.log('🛍 Products...');
  await prisma.productCta.deleteMany();
  await prisma.product.deleteMany();

  const productDefs = [
    { title: 'TBT Premium Membership', description: 'Unlock full access to all workshops, courses, live calls and exclusive resources. Join 500+ Tamil entrepreneurs already growing with TBT.', thumbnailUrl: IMG.drip,    order: 1,
      ctas: [{ label: 'Join Now',      url: 'https://tbt.com/join',    type: 'primary' }, { label: 'Learn More', url: 'https://tbt.com/premium', type: 'secondary' }] },
    { title: 'Business Growth Toolkit', description: 'A curated collection of templates, worksheets and tools to accelerate your business growth. Includes 50+ ready-to-use resources.', thumbnailUrl: IMG.scale,   order: 2,
      ctas: [{ label: 'Download Free', url: 'https://tbt.com/toolkit', type: 'primary' }] },
    { title: '1-on-1 Mentorship Session', description: 'Book a private coaching session with our expert mentors. Get personalised guidance for your specific business challenges.', thumbnailUrl: IMG.mindset, order: 3,
      ctas: [{ label: 'Book Session',  url: 'https://tbt.com/mentor',  type: 'primary' }, { label: 'See Pricing', url: 'https://tbt.com/pricing', type: 'secondary' }] },
  ];

  for (const pDef of productDefs) {
    const product = await prisma.product.create({ data: { title: pDef.title, description: pDef.description, thumbnailUrl: pDef.thumbnailUrl, order: pDef.order, isVisible: true }});
    for (let i = 0; i < pDef.ctas.length; i++) {
      await prisma.productCta.create({ data: { productId: product.id, ...pDef.ctas[i], openInNewTab: true, order: i + 1 }});
    }
    console.log(`   ✅ Product: ${product.title}`);
  }

  // ── AppResources ─────────────────────────────────────────────────────────────
  console.log('📁 Resources...');
  await prisma.appResource.deleteMany();
  await prisma.appResource.createMany({ data: [
    { title: 'Business Plan Template',         author: 'TBT Team', fileUrl: 'https://tamil-business-tribe-cdn.b-cdn.net/resources/business-plan-template.pdf',    previewUrl: IMG.scale,     fileType: 'pdf',  fileCount: 1, order: 1, isVisible: true },
    { title: 'Digital Marketing Checklist',    author: 'TBT Team', fileUrl: 'https://tamil-business-tribe-cdn.b-cdn.net/resources/digital-marketing-checklist.pdf',previewUrl: IMG.drip,      fileType: 'pdf',  fileCount: 1, order: 2, isVisible: true },
    { title: 'Sales Funnel Worksheet',         author: 'TBT Team', fileUrl: 'https://tamil-business-tribe-cdn.b-cdn.net/resources/sales-funnel-worksheet.pdf',     previewUrl: IMG.zero,      fileType: 'pdf',  fileCount: 1, order: 3, isVisible: true },
    { title: 'Social Media Content Calendar',  author: 'TBT Team', fileUrl: 'https://tamil-business-tribe-cdn.b-cdn.net/resources/social-media-calendar.pdf',      previewUrl: IMG.screenshot,fileType: 'pdf',  fileCount: 1, order: 4, isVisible: true },
    { title: 'Mindset Journal Template',       author: 'TBT Team', fileUrl: 'https://tamil-business-tribe-cdn.b-cdn.net/resources/mindset-journal.pdf',            previewUrl: IMG.mindset,   fileType: 'pdf',  fileCount: 1, order: 5, isVisible: true },
  ]});
  console.log('   ✅ 5 resources');

  // ── AppNotifications ─────────────────────────────────────────────────────────
  console.log('🔔 AppNotifications...');
  await prisma.appNotificationRecipient.deleteMany();
  await prisma.appNotification.deleteMany();

  const notifDefs = [
    { title: 'Welcome to TBT! 🎉',             message: 'You\'re now part of the Tamil Business Tribe. Explore your workshops and start your journey today.', type: 'info' },
    { title: 'New Workshop Available',           message: 'Drip Marketing Mastery is now live. Start your first challenge and unlock the path to automation.', type: 'info' },
    { title: 'Live Call This Weekend',           message: 'Group Coaching & Q&A session is scheduled for Saturday 10 AM IST. Add it to your calendar now.', type: 'info' },
    { title: 'Complete Your Profile',            message: 'Add your business details to get personalised recommendations and unlock your tier benefits.', type: 'info' },
    { title: 'Batch 2026 — Day 1 Begins!',      message: 'Your 90-day accelerator program starts today. Check your workshop flow and complete challenge 1.', type: 'info' },
  ];

  for (const nDef of notifDefs) {
    const notif = await prisma.appNotification.create({ data: { title: nDef.title, message: nDef.message, type: nDef.type }});
    for (const m of members) {
      await prisma.appNotificationRecipient.create({ data: { notificationId: notif.id, memberId: m.id }});
    }
  }
  console.log(`   ✅ ${notifDefs.length} notifications sent to ${members.length} members each`);

  // ── Conversations + Messages ─────────────────────────────────────────────────
  console.log('💬 Conversations...');
  await prisma.directMessage.deleteMany();
  await prisma.conversation.deleteMany();

  const convoDefs = [
    { member: members[0], subject: 'Question about the Live Call schedule',
      messages: [
        { body: 'Hi! I wanted to confirm the schedule for the upcoming live call. Will it be recorded if I can\'t attend live?', senderType: 'member' as const },
        { body: 'Hello Arjun! Yes, all live calls are recorded and available within 24 hours in your workshop flow. You\'ll get a notification when it\'s ready.', senderType: 'admin' as const },
        { body: 'That\'s great, thank you! Looking forward to the session.', senderType: 'member' as const },
      ]},
    { member: members[1], subject: 'Need help accessing Tier 2 content',
      messages: [
        { body: 'I completed challenge 1 in the Drip Marketing workshop but Tier 2 content is still locked. How do I unlock it?', senderType: 'member' as const },
        { body: 'Hi Priya! Tier 2 unlocks after 30 days from your batch start date (June 1). You\'re on track — just 3 more days to go! Keep completing your daily challenges.', senderType: 'admin' as const },
      ]},
    { member: members[2], subject: 'Workshop completion certificate',
      messages: [
        { body: 'I\'ve completed the Zero Rupee Marketing workshop. When will I receive my certificate?', senderType: 'member' as const },
      ]},
  ];

  for (const cDef of convoDefs) {
    const conv = await prisma.conversation.create({ data: {
      memberId: cDef.member.id,
      subject: cDef.subject,
      status: 'open',
      memberUnreadCount: cDef.messages.filter(m => m.senderType === 'admin').length,
      adminUnreadCount: cDef.messages.filter(m => m.senderType === 'member').length,
      lastMessageAt: new Date(),
    }});

    for (const msg of cDef.messages) {
      await prisma.directMessage.create({ data: {
        conversationId: conv.id,
        memberId: cDef.member.id,
        senderId: msg.senderType === 'member' ? cDef.member.id : adminId,
        senderType: msg.senderType,
        body: msg.body,
        isRead: false,
      }});
    }
    console.log(`   ✅ Conversation: "${cDef.subject}"`);
  }

  // ── ProductsPageConfig ───────────────────────────────────────────────────────
  console.log('🛒 ProductsPageConfig...');
  const existingPPC = await prisma.productsPageConfig.findFirst();
  if (!existingPPC) {
    await prisma.productsPageConfig.create({ data: { pageTitle: 'Grow with TBT', pageBg: 'linear-gradient(135deg, #00c4cc 0%, #a855f7 100%)' }});
  } else {
    await prisma.productsPageConfig.update({ where: { id: existingPPC.id }, data: { pageTitle: 'Grow with TBT' }});
  }
  console.log('   ✅ ProductsPageConfig');

  // ── ResourcesPageConfig ──────────────────────────────────────────────────────
  console.log('📖 ResourcesPageConfig...');
  const existingRPC = await prisma.resourcesPageConfig.findFirst();
  if (!existingRPC) {
    await prisma.resourcesPageConfig.create({ data: { pageTitle: 'Resources', searchPlaceholder: 'Search resources...', totalLabel: 'resources', defaultView: 'list' }});
  }
  console.log('   ✅ ResourcesPageConfig');

  // ── Webinars ─────────────────────────────────────────────────────────────────
  console.log('🎥 Webinars...');
  await prisma.webinarRegistration.deleteMany();
  await prisma.webinar.deleteMany();
  const webinar = await prisma.webinar.create({ data: {
    title: 'Zero to Revenue — Live Business Masterclass',
    description: 'Join Manoj Kumar live for an intensive 3-hour masterclass on generating your first ₹10 lakhs in revenue using proven Tamil business strategies.',
    scheduledAt: new Date('2026-07-20T09:00:00Z'),
    durationMinutes: 180,
    meetingUrl: 'https://zoom.us/j/sample-webinar',
    status: 'scheduled', maxAttendees: 500,
    hostId: adminId,
  }});
  for (const m of members.slice(0, 3)) {
    await prisma.webinarRegistration.create({ data: { memberId: m.id, webinarId: webinar.id, attended: false }});
  }
  console.log(`   ✅ Webinar: ${webinar.title}`);

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n🎉 Sample data seeded successfully!\n');
  console.log('─────────────────────────────────────────');
  console.log('  SiteConfig:           1');
  console.log('  NavItems:             8  (incl. Task → /batch-program)');
  console.log('  Tiers:                3');
  console.log('  DisplayBadges:        4');
  console.log('  HeroSlides:           3');
  console.log('  Program + Batch:      1 each');
  console.log('  BatchDays:            90 (days 1-30 fully configured)');
  console.log('  Members:              5  (with subscriptions + day progress)');
  console.log('  Workshops:            3  (with episodes, flow, Q&A, assignments)');
  console.log('  Courses:              3  (with episodes + enrollments)');
  console.log('  ContentSections:      3  (with items)');
  console.log('  Products:             3  (with CTAs)');
  console.log('  Resources:            5');
  console.log('  Notifications:        5  (sent to all members)');
  console.log('  Conversations:        3  (with messages)');
  console.log('  Webinar:              1');
  console.log('─────────────────────────────────────────\n');
  console.log('Run next: npx tsx backend/prisma/seed-workshop-data.ts');
  console.log('  → Adds 5 challenges per workshop (watch/quiz/written/matching/flashcard)\n');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

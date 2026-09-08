// One-off podcast seed for QA of the Voice of Sakthi screens.
// Creates 2 series (Mindset, Growth) and 6 episodes across them.
// Idempotent: skips series with slugs that already exist.
//
// Run with: node scripts/seed-podcasts.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Public creative-commons MP3s for demo purposes. All are short (<1 min)
// so the player can actually reach completion while testing.
const DEMO_AUDIO = [
  'https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3',
  'https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3',
];
const DEMO_COVER =
  'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=400&fit=crop';

async function main() {
  const [mindsetCat] = await prisma.podcastCategory.findMany({
    where: { name: { contains: 'Mindset', mode: 'insensitive' } },
    take: 1,
  });
  const [growthCat] = await prisma.podcastCategory.findMany({
    where: { name: { contains: 'Business', mode: 'insensitive' } },
    take: 1,
  });
  console.log('mindsetCat:', mindsetCat?.name, 'growthCat:', growthCat?.name);

  const series = [
    {
      title: 'The Founder Mindset',
      slug: 'founder-mindset',
      description:
        'Weekly insights from Tamil founders on staying resilient through the ups and downs of building a business.',
      coverImage: DEMO_COVER,
      status: 'active',
      sortOrder: 1,
    },
    {
      title: 'Business Growth Playbook',
      slug: 'business-growth-playbook',
      description:
        'Practical tactics for scaling revenue, hiring, and operations — straight from the tribe.',
      coverImage:
        'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&h=400&fit=crop',
      status: 'active',
      sortOrder: 2,
    },
  ];

  const createdSeries = [];
  for (const s of series) {
    const existing = await prisma.podcastSeries.findUnique({ where: { slug: s.slug } });
    if (existing) {
      console.log(`  ↷ series ${s.slug} exists (id=${existing.id.slice(0, 8)}…)`);
      createdSeries.push(existing);
      continue;
    }
    const row = await prisma.podcastSeries.create({ data: s });
    console.log(`  + series ${s.slug} (id=${row.id.slice(0, 8)}…)`);
    createdSeries.push(row);
  }

  const episodes = [
    {
      seriesId: createdSeries[0].id,
      categoryId: mindsetCat?.id ?? null,
      title: 'Episode 1 — Why founders quit (and how to not)',
      slug: 'why-founders-quit',
      description:
        'Sakthi on the emotional cliff at year two of building any business, and the three habits that keep you moving.',
      coverImage: DEMO_COVER,
      audioUrl: DEMO_AUDIO[0],
      durationSeconds: 55,
      speaker: 'Sakthi',
      tags: ['mindset', 'resilience'],
      isFeatured: true,
      publishDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      sortOrder: 1,
    },
    {
      seriesId: createdSeries[0].id,
      categoryId: mindsetCat?.id ?? null,
      title: 'Episode 2 — The morning ritual that changed everything',
      slug: 'morning-ritual-changed',
      description: 'A 15-minute routine that founders in the tribe swear by.',
      coverImage: DEMO_COVER,
      audioUrl: DEMO_AUDIO[0],
      durationSeconds: 42,
      speaker: 'Sakthi',
      tags: ['mindset', 'productivity'],
      isFeatured: false,
      publishDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      sortOrder: 2,
    },
    {
      seriesId: createdSeries[0].id,
      categoryId: mindsetCat?.id ?? null,
      title: 'Episode 3 — Managing burnout as a solo founder',
      slug: 'managing-burnout-solo',
      description: 'Signs you\'re burning out, and how to catch it early.',
      coverImage: DEMO_COVER,
      audioUrl: DEMO_AUDIO[0],
      durationSeconds: 48,
      speaker: 'Sakthi',
      tags: ['mindset', 'wellness'],
      isFeatured: false,
      publishDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      sortOrder: 3,
    },
    {
      seriesId: createdSeries[1].id,
      categoryId: growthCat?.id ?? null,
      title: 'Growth Play — Pricing your first product',
      slug: 'pricing-first-product',
      description: 'The five-step framework tribe founders use to set anchor prices.',
      coverImage:
        'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&h=400&fit=crop',
      audioUrl: DEMO_AUDIO[1],
      durationSeconds: 60,
      speaker: 'Sakthi',
      tags: ['growth', 'pricing'],
      isFeatured: true,
      publishDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      sortOrder: 1,
    },
    {
      seriesId: createdSeries[1].id,
      categoryId: growthCat?.id ?? null,
      title: 'Growth Play — Hiring your first three teammates',
      slug: 'hiring-first-three',
      description: 'Who to hire in what order and why the sequence matters.',
      coverImage:
        'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&h=400&fit=crop',
      audioUrl: DEMO_AUDIO[1],
      durationSeconds: 52,
      speaker: 'Sakthi',
      tags: ['growth', 'hiring'],
      isFeatured: false,
      publishDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      sortOrder: 2,
    },
    {
      seriesId: createdSeries[1].id,
      categoryId: growthCat?.id ?? null,
      title: 'Growth Play — Getting your first 10 customers',
      slug: 'first-10-customers',
      description: 'A door-to-door playbook adapted for the Tamil market.',
      coverImage:
        'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&h=400&fit=crop',
      audioUrl: DEMO_AUDIO[1],
      durationSeconds: 47,
      speaker: 'Sakthi',
      tags: ['growth', 'sales'],
      isFeatured: false,
      publishDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      sortOrder: 3,
    },
  ];

  for (const ep of episodes) {
    const existing = await prisma.podcastEpisode.findUnique({ where: { slug: ep.slug } });
    if (existing) {
      console.log(`  ↷ episode ${ep.slug} exists`);
      continue;
    }
    await prisma.podcastEpisode.create({ data: ep });
    console.log(`  + episode "${ep.title}"`);
  }

  const finalCount = await prisma.podcastEpisode.count({ where: { status: 'active' } });
  console.log(`\n✅ Active episodes: ${finalCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

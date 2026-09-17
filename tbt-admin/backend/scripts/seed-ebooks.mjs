// One-off ebook seed for QA of the Ebooks landing/detail/reader screens.
// Idempotent — skips categories/books/banners whose slug or title already
// exists so re-running is safe.
//
// Run with: node scripts/seed-ebooks.mjs (from tbt-admin/backend/)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COVER_A = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=560&fit=crop';
const COVER_B = 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=560&fit=crop';
const COVER_C = 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400&h=560&fit=crop';
const COVER_D = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=560&fit=crop';
const COVER_E = 'https://images.unsplash.com/photo-1531592937781-344ad608fabf?w=400&h=560&fit=crop';
const BANNER_BG = 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&h=500&fit=crop';

// Public sample PDFs — small (<200KB) so the reader loads instantly.
const SAMPLE_PDF =
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

const CATEGORIES = [
  { name: 'Mindset', slug: 'mindset', sortOrder: 1 },
  { name: 'Business Growth', slug: 'business-growth', sortOrder: 2 },
  { name: 'Leadership', slug: 'leadership', sortOrder: 3 },
];

async function upsertCategory(cat) {
  const existing = await prisma.ebookCategory.findUnique({ where: { slug: cat.slug } });
  if (existing) {
    console.log(`  ✓ category exists: ${cat.name}`);
    return existing;
  }
  const created = await prisma.ebookCategory.create({
    data: { ...cat, status: 'active' },
  });
  console.log(`  + category created: ${cat.name}`);
  return created;
}

async function upsertBook(book) {
  const existing = await prisma.ebook.findUnique({ where: { slug: book.slug } });
  if (existing) {
    console.log(`  ✓ book exists: ${book.title}`);
    return existing;
  }
  const created = await prisma.ebook.create({ data: book });
  console.log(`  + book created: ${book.title}`);
  return created;
}

async function upsertBanner(banner) {
  const existing = await prisma.ebookBanner.findFirst({ where: { title: banner.title } });
  if (existing) {
    console.log(`  ✓ banner exists: ${banner.title}`);
    return existing;
  }
  const created = await prisma.ebookBanner.create({ data: banner });
  console.log(`  + banner created: ${banner.title}`);
  return created;
}

async function main() {
  console.log('\n── Seeding ebook categories ──');
  const [mindset, growth, leadership] = await Promise.all(CATEGORIES.map(upsertCategory));

  console.log('\n── Seeding ebook banners ──');
  await upsertBanner({
    title: 'Read what founders read',
    subtitle: 'A curated library for members of the Tamil Business Tribe.',
    backgroundImage: BANNER_BG,
    buttonText: 'Explore library',
    status: 'active',
    sortOrder: 1,
  });

  console.log('\n── Seeding ebooks ──');
  const books = [
    {
      title: 'The Founder Mindset',
      slug: 'the-founder-mindset',
      description:
        'A practical guide to staying resilient through the ups and downs of building a company from scratch.',
      author: 'Priya Ramanathan',
      categoryId: mindset.id,
      coverImage: COVER_A,
      pdfUrl: SAMPLE_PDF,
      contentUrl: SAMPLE_PDF,
      totalPages: 24,
      readingTime: '20 min',
      isFeatured: true,
      sortOrder: 1,
      status: 'active',
    },
    {
      title: 'Zero to Revenue',
      slug: 'zero-to-revenue',
      description:
        'How the first ten Tamil-founded startups reached their first ₹1 crore, told in their own words.',
      author: 'Karthik Selvam',
      categoryId: growth.id,
      coverImage: COVER_B,
      pdfUrl: SAMPLE_PDF,
      contentUrl: SAMPLE_PDF,
      totalPages: 42,
      readingTime: '35 min',
      isFeatured: true,
      sortOrder: 2,
      status: 'active',
    },
    {
      title: 'Leading Without Ego',
      slug: 'leading-without-ego',
      description:
        'Field notes on servant leadership from twenty-plus years running distributed teams across three continents.',
      author: 'Meera Iyer',
      categoryId: leadership.id,
      coverImage: COVER_C,
      pdfUrl: SAMPLE_PDF,
      contentUrl: SAMPLE_PDF,
      totalPages: 31,
      readingTime: '25 min',
      isFeatured: false,
      sortOrder: 3,
      status: 'active',
    },
    {
      title: 'The Discipline of Deep Work',
      slug: 'the-discipline-of-deep-work',
      description:
        'A short primer on structuring your day so the hardest, most valuable work actually gets done.',
      author: 'Arjun Ravi',
      categoryId: mindset.id,
      coverImage: COVER_D,
      pdfUrl: SAMPLE_PDF,
      contentUrl: SAMPLE_PDF,
      totalPages: 18,
      readingTime: '15 min',
      isFeatured: false,
      sortOrder: 4,
      status: 'active',
    },
    {
      title: 'The Playbook: Scaling Sales',
      slug: 'the-playbook-scaling-sales',
      description:
        'Ten repeatable plays that took our members from founder-led selling to a functioning sales team.',
      author: 'Ravi Murugan',
      categoryId: growth.id,
      coverImage: COVER_E,
      pdfUrl: SAMPLE_PDF,
      contentUrl: SAMPLE_PDF,
      totalPages: 56,
      readingTime: '45 min',
      isFeatured: true,
      sortOrder: 5,
      status: 'active',
    },
  ];
  for (const b of books) {
    await upsertBook(b);
  }

  const [totalBooks, totalCats, totalBanners] = await Promise.all([
    prisma.ebook.count(),
    prisma.ebookCategory.count(),
    prisma.ebookBanner.count(),
  ]);

  console.log('\n── Done ──');
  console.log(`  ebooks     : ${totalBooks}`);
  console.log(`  categories : ${totalCats}`);
  console.log(`  banners    : ${totalBanners}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

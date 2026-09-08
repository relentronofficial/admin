// Dummy ad campaign seed for QA testing of the ads system.
// Creates 3 active campaigns covering image ads and a timed ad.
// Uses raw SQL so it works without regenerating Prisma.
// Idempotent — skips campaigns whose campaign_code already exists.
//
// Run with: node scripts/seed-ads.mjs (from tbt-admin/backend/)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOW = new Date().toISOString();
const PLUS_90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

const CAMPAIGNS = [
  {
    code: 'TEST-APP-LAUNCH-001',
    name: '[TEST] App Launch — Brand Promo',
    description: 'Full-screen image shown on app launch. Tests skip-after-5s + CTA.',
    mediaUrl: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1080&h=1920&fit=crop',
    objectFit: 'cover',
    bgColor: '#0f0f0f',
    placements: JSON.stringify(['app_launch']),
    platforms: JSON.stringify(['web', 'mobile']),
    os: JSON.stringify(['android', 'ios', 'web']),
    triggerType: 'app_launch',
    triggerConfig: JSON.stringify({}),
    freqConfig: JSON.stringify({ maxPerSession: 1, maxPerDay: 1, minIntervalSeconds: 3600 }),
    skipConfig: JSON.stringify({ enabled: true, type: 'seconds', value: 5 }),
    closeConfig: JSON.stringify({ enabled: true, autoClose: false }),
    ctaConfig: JSON.stringify({ enabled: true, text: 'Explore TBT', type: 'internal_route', target: '/tbt', showAfterSeconds: 3 }),
    audience: JSON.stringify({ scope: 'all' }),
    priority: 10,
  },
  {
    code: 'TEST-HOME-BANNER-002',
    name: '[TEST] Home — Course Promotion',
    description: 'Shown when entering home/dashboard. Auto-closes at 10s.',
    mediaUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1080&h=1920&fit=crop',
    objectFit: 'contain',
    bgColor: '#111827',
    placements: JSON.stringify(['home', 'global']),
    platforms: JSON.stringify(['web', 'mobile']),
    os: null,
    triggerType: 'route_enter',
    triggerConfig: JSON.stringify({}),
    freqConfig: JSON.stringify({ maxPerSession: 1, maxPerDay: 2, minIntervalSeconds: 1800 }),
    skipConfig: JSON.stringify({ enabled: false }),
    closeConfig: JSON.stringify({ enabled: true, autoClose: true, autoCloseSeconds: 10 }),
    ctaConfig: JSON.stringify({ enabled: true, text: 'Browse Courses', type: 'internal_route', target: '/courses', showAfterSeconds: 0 }),
    audience: JSON.stringify({ scope: 'all' }),
    priority: 5,
  },
  {
    code: 'TEST-TIMED-COMMUNITY-003',
    name: '[TEST] Community — Timed Interval (2 min)',
    description: 'Fires every 2 minutes of active use. Unskippable, closes after 8s.',
    mediaUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1080&h=1920&fit=crop',
    objectFit: 'cover',
    bgColor: '#1a1a2e',
    placements: JSON.stringify(['community', 'global']),
    platforms: JSON.stringify(['web', 'mobile']),
    os: null,
    triggerType: 'timed_interval',
    triggerConfig: JSON.stringify({ repeatIntervalSeconds: 120 }),
    freqConfig: JSON.stringify({ maxPerSession: 3, maxPerDay: 5, minIntervalSeconds: 600 }),
    skipConfig: JSON.stringify({ enabled: true, type: 'after_end' }),
    closeConfig: JSON.stringify({ enabled: true, autoClose: true, autoCloseSeconds: 8 }),
    ctaConfig: JSON.stringify({ enabled: true, text: 'Join Community', type: 'internal_route', target: '/community', showAfterSeconds: 2 }),
    audience: JSON.stringify({ scope: 'all' }),
    priority: 3,
  },
];

async function main() {
  console.log('🎯 Seeding ad campaigns...\n');

  for (const c of CAMPAIGNS) {
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM ad_campaigns WHERE campaign_code = $1`,
      c.code,
    );
    if (existing.length > 0) {
      console.log(`  ✓ already exists: ${c.name}`);
      continue;
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO ad_campaigns (
        campaign_code, name, description, status, priority,
        media_type, media_url, object_fit, background_color,
        autoplay, muted, loop,
        start_at, end_at, timezone,
        target_platforms, target_os, placements,
        audience_config,
        trigger_type, trigger_config, frequency_config,
        skip_config, close_config, cta_config,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'active', $4,
        'image', $5, $6, $7,
        true, true, false,
        $8::timestamptz, $9::timestamptz, 'Asia/Kolkata',
        $10::jsonb, $11::jsonb, $12::jsonb,
        $13::jsonb,
        $14, $15::jsonb, $16::jsonb,
        $17::jsonb, $18::jsonb, $19::jsonb,
        now(), now()
      )`,
      c.code, c.name, c.description, c.priority,
      c.mediaUrl, c.objectFit, c.bgColor,
      NOW, PLUS_90,
      c.platforms, c.os ?? '["android","ios","web"]', c.placements,
      c.audience,
      c.triggerType, c.triggerConfig, c.freqConfig,
      c.skipConfig, c.closeConfig, c.ctaConfig,
    );
    console.log(`  + created: ${c.name}`);
  }

  console.log('\n✅ Done. Three active campaigns ready for testing.\n');
  console.log('Campaign codes:');
  CAMPAIGNS.forEach((c) => console.log(`  ${c.code} — ${c.name}`));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

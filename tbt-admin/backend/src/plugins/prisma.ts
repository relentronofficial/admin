import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

function buildDatasourceUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '15');
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '30');
    return url.toString();
  } catch {
    return raw;
  }
}

async function prismaPlugin(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  const prisma = new PrismaClient({
    datasources: { db: { url: buildDatasourceUrl(env.DATABASE_URL) } },
  });

  try {
    await prisma.$connect();
    fastify.log.info('✅ Database connected');
    // Enum migrations must run sequentially before table changes that use them
    await prisma.$executeRawUnsafe(`ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'pending'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "CoursePaymentMethod" ADD VALUE IF NOT EXISTS 'external'`);

    // Parallelize all table mutations — grouped per table so each table gets one ALTER statement
    await Promise.all([
      // courses — combine all ADD COLUMN into one statement (avoids 6 round-trips)
      // require_sequential + completion_threshold_percent added 2026-07-16 for
      // sequential-unlock feature. Default `true`/95 means every existing
      // course opts into the new behaviour automatically — historical progress
      // rows are preserved, but locked/unlocked status is recomputed live from
      // the completion history on the next lesson-list read.
      prisma.$executeRawUnsafe(`
        ALTER TABLE courses
          ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
          ADD COLUMN IF NOT EXISTS access_duration_days INTEGER,
          ADD COLUMN IF NOT EXISTS max_enrollments INTEGER,
          ADD COLUMN IF NOT EXISTS upsell_course_ids TEXT[] DEFAULT '{}',
          ADD COLUMN IF NOT EXISTS cross_sell_course_ids TEXT[] DEFAULT '{}',
          ADD COLUMN IF NOT EXISTS xp_per_episode INTEGER NOT NULL DEFAULT 10,
          ADD COLUMN IF NOT EXISTS passing_score_percent INTEGER NOT NULL DEFAULT 70,
          ADD COLUMN IF NOT EXISTS require_sequential BOOLEAN NOT NULL DEFAULT true,
          ADD COLUMN IF NOT EXISTS completion_threshold_percent INTEGER NOT NULL DEFAULT 95
      `),
      // course_episodes
      prisma.$executeRawUnsafe(`
        ALTER TABLE course_episodes
          ADD COLUMN IF NOT EXISTS quiz_data JSONB,
          ADD COLUMN IF NOT EXISTS quiz_unlock_percent INTEGER NOT NULL DEFAULT 80,
          ADD COLUMN IF NOT EXISTS drm_enabled BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS bunny_drm_token TEXT
      `),
      // products
      prisma.$executeRawUnsafe(`
        ALTER TABLE products
          ADD COLUMN IF NOT EXISTS price DECIMAL(10,2),
          ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR',
          ADD COLUMN IF NOT EXISTS category VARCHAR(100),
          ADD COLUMN IF NOT EXISTS stock_status VARCHAR(50) NOT NULL DEFAULT 'in_stock'
      `),
      // assignments
      prisma.$executeRawUnsafe(`
        ALTER TABLE assignments
          ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(50) NOT NULL DEFAULT 'qa'
      `).then(() => Promise.all([
        prisma.$executeRawUnsafe(`ALTER TABLE assignments ALTER COLUMN question_text DROP NOT NULL`).catch(() => {}),
        prisma.$executeRawUnsafe(`ALTER TABLE assignment_submissions ALTER COLUMN answer_text DROP NOT NULL`).catch(() => {}),
        prisma.$executeRawUnsafe(`ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS image_url TEXT`),
      ])),
      // ui_strings — single statement for all 40+ string columns
      prisma.$executeRawUnsafe(`
        ALTER TABLE ui_strings
          ADD COLUMN IF NOT EXISTS reflect_title TEXT NOT NULL DEFAULT 'Reflect & Retain',
          ADD COLUMN IF NOT EXISTS reflect_prompt_prefix TEXT NOT NULL DEFAULT 'What''s one thing from',
          ADD COLUMN IF NOT EXISTS reflect_prompt_suffix TEXT NOT NULL DEFAULT 'you''ll actually apply?',
          ADD COLUMN IF NOT EXISTS reflect_placeholder TEXT NOT NULL DEFAULT 'Write in your own words — 2-3 sentences is enough…',
          ADD COLUMN IF NOT EXISTS reflect_skip_label TEXT NOT NULL DEFAULT 'Skip',
          ADD COLUMN IF NOT EXISTS reflect_save_label TEXT NOT NULL DEFAULT 'Save Reflection',
          ADD COLUMN IF NOT EXISTS reflect_saved_label TEXT NOT NULL DEFAULT '✓ Saved!',
          ADD COLUMN IF NOT EXISTS batch_program_label TEXT NOT NULL DEFAULT 'Program',
          ADD COLUMN IF NOT EXISTS batch_not_assigned_msg TEXT NOT NULL DEFAULT 'You haven''t been assigned to a batch yet.',
          ADD COLUMN IF NOT EXISTS batch_contact_msg TEXT NOT NULL DEFAULT 'Contact your account manager to get assigned.',
          ADD COLUMN IF NOT EXISTS batch_days_approved_label TEXT NOT NULL DEFAULT 'days approved',
          ADD COLUMN IF NOT EXISTS batch_all_days_label TEXT NOT NULL DEFAULT 'All Days',
          ADD COLUMN IF NOT EXISTS batch_status_not_started TEXT NOT NULL DEFAULT 'Not started',
          ADD COLUMN IF NOT EXISTS batch_status_in_progress TEXT NOT NULL DEFAULT 'In progress',
          ADD COLUMN IF NOT EXISTS batch_status_pending_review TEXT NOT NULL DEFAULT 'Pending review',
          ADD COLUMN IF NOT EXISTS batch_status_approved TEXT NOT NULL DEFAULT 'Approved',
          ADD COLUMN IF NOT EXISTS batch_status_needs_revision TEXT NOT NULL DEFAULT 'Needs revision',
          ADD COLUMN IF NOT EXISTS batch_status_approved_check TEXT NOT NULL DEFAULT 'Approved ✓',
          ADD COLUMN IF NOT EXISTS batch_approved_pill_label TEXT NOT NULL DEFAULT 'Approved',
          ADD COLUMN IF NOT EXISTS batch_pending_pill_label TEXT NOT NULL DEFAULT 'Pending',
          ADD COLUMN IF NOT EXISTS batch_needs_revision_pill_label TEXT NOT NULL DEFAULT 'Needs Revision',
          ADD COLUMN IF NOT EXISTS batch_in_progress_pill_label TEXT NOT NULL DEFAULT 'In Progress',
          ADD COLUMN IF NOT EXISTS batch_today_label TEXT NOT NULL DEFAULT 'Today',
          ADD COLUMN IF NOT EXISTS batch_not_assigned_note TEXT NOT NULL DEFAULT 'You are not currently assigned to a batch.',
          ADD COLUMN IF NOT EXISTS batch_revision_label TEXT NOT NULL DEFAULT 'Revision requested',
          ADD COLUMN IF NOT EXISTS batch_future_note TEXT NOT NULL DEFAULT 'This day hasn''t started yet. You can view but not submit.',
          ADD COLUMN IF NOT EXISTS batch_pending_note TEXT NOT NULL DEFAULT 'Submitted for review — waiting for account manager approval',
          ADD COLUMN IF NOT EXISTS batch_approved_note TEXT NOT NULL DEFAULT 'Day approved by your account manager',
          ADD COLUMN IF NOT EXISTS batch_open_resource_label TEXT NOT NULL DEFAULT 'Open Resource',
          ADD COLUMN IF NOT EXISTS batch_checklist_label TEXT NOT NULL DEFAULT 'Checklist',
          ADD COLUMN IF NOT EXISTS batch_done_label TEXT NOT NULL DEFAULT 'done',
          ADD COLUMN IF NOT EXISTS batch_journal_label TEXT NOT NULL DEFAULT 'Daily Journal',
          ADD COLUMN IF NOT EXISTS batch_journal_placeholder TEXT NOT NULL DEFAULT 'What did you do today? What did you learn? Any challenges?',
          ADD COLUMN IF NOT EXISTS batch_save_draft_label TEXT NOT NULL DEFAULT 'Save Draft',
          ADD COLUMN IF NOT EXISTS batch_submit_label TEXT NOT NULL DEFAULT 'Submit for Review',
          ADD COLUMN IF NOT EXISTS batch_progress_saved TEXT NOT NULL DEFAULT 'Progress saved',
          ADD COLUMN IF NOT EXISTS batch_progress_save_error TEXT NOT NULL DEFAULT 'Failed to save progress',
          ADD COLUMN IF NOT EXISTS batch_submit_success TEXT NOT NULL DEFAULT 'Submitted for review!',
          ADD COLUMN IF NOT EXISTS batch_attendance_label TEXT NOT NULL DEFAULT 'Attendance',
          ADD COLUMN IF NOT EXISTS batch_mark_present_label TEXT NOT NULL DEFAULT 'Mark Present',
          ADD COLUMN IF NOT EXISTS batch_present_label TEXT NOT NULL DEFAULT 'Present',
          ADD COLUMN IF NOT EXISTS batch_absent_label TEXT NOT NULL DEFAULT 'Absent',
          ADD COLUMN IF NOT EXISTS batch_break_label TEXT NOT NULL DEFAULT 'Break',
          ADD COLUMN IF NOT EXISTS batch_attendance_rate_label TEXT NOT NULL DEFAULT 'Attendance Rate',
          ADD COLUMN IF NOT EXISTS batch_request_break_label TEXT NOT NULL DEFAULT 'Request Break',
          ADD COLUMN IF NOT EXISTS batch_break_reason_placeholder TEXT NOT NULL DEFAULT 'Reason for taking a break...',
          ADD COLUMN IF NOT EXISTS batch_break_submitted_msg TEXT NOT NULL DEFAULT 'Break request submitted',
          ADD COLUMN IF NOT EXISTS batch_break_approved_label TEXT NOT NULL DEFAULT 'Break approved',
          ADD COLUMN IF NOT EXISTS batch_break_pending_label TEXT NOT NULL DEFAULT 'Break pending approval',
          ADD COLUMN IF NOT EXISTS batch_category_label TEXT NOT NULL DEFAULT 'Category',
          ADD COLUMN IF NOT EXISTS batch_not_marked_label TEXT NOT NULL DEFAULT 'Not marked',
          ADD COLUMN IF NOT EXISTS batch_extended_days_label TEXT NOT NULL DEFAULT 'Extended days',
          ADD COLUMN IF NOT EXISTS batch_break_start_label TEXT NOT NULL DEFAULT 'Start day',
          ADD COLUMN IF NOT EXISTS batch_break_end_label TEXT NOT NULL DEFAULT 'End day',
          ADD COLUMN IF NOT EXISTS batch_break_reason_label TEXT NOT NULL DEFAULT 'Reason',
          ADD COLUMN IF NOT EXISTS batch_break_rejected_label TEXT NOT NULL DEFAULT 'Rejected',
          ADD COLUMN IF NOT EXISTS batch_break_submit_label TEXT NOT NULL DEFAULT 'Submit Request'
      `),
      // miscellaneous single-column additions (different tables, fully parallel)
      prisma.$executeRawUnsafe(`ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS login_bg_images JSONB`).catch(() => {}),
      prisma.$executeRawUnsafe(`ALTER TABLE member_episode_progress ADD COLUMN IF NOT EXISTS watched_segments TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE workshops ADD COLUMN IF NOT EXISTS batch_ids JSONB`),
      prisma.$executeRawUnsafe(`ALTER TABLE app_resources ADD COLUMN IF NOT EXISTS visibility JSONB`),
      prisma.$executeRawUnsafe(`ALTER TABLE app_resources ADD COLUMN IF NOT EXISTS description TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE batch_days ADD COLUMN IF NOT EXISTS category VARCHAR(100)`),
      prisma.$executeRawUnsafe(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'`),
      prisma.$executeRawUnsafe(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS snapshot_days INT`),
      // Task unification — Phase 1 migrations
      prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(id) ON DELETE CASCADE`),
      prisma.$executeRawUnsafe(`ALTER TABLE tasks ALTER COLUMN program_id DROP NOT NULL`).catch(() => {}),
      prisma.$executeRawUnsafe(`
        ALTER TABLE task_submissions
          ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(id),
          ADD COLUMN IF NOT EXISTS day_progress_id UUID REFERENCES member_day_progress(id) ON DELETE CASCADE,
          ADD COLUMN IF NOT EXISTS day_number INT
      `),
      prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_task_sub_day_progress ON task_submissions(day_progress_id)`),
      prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_task_sub_batch_member ON task_submissions(batch_id, member_id)`),
      // FIX-05: replace global unique(member_id, task_id) with day-scoped partial indexes
      // so the same task can appear on different days without collision
      prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          DROP INDEX IF EXISTS idx_task_sub_unique;
          DROP INDEX IF EXISTS "task_submissions_member_id_task_id_key";
        END $$
      `).catch(() => {}),
      prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_task_sub_batch_scoped
        ON task_submissions(member_id, task_id, batch_id, day_number)
        WHERE batch_id IS NOT NULL AND day_number IS NOT NULL
      `),
      prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_task_sub_program_scoped
        ON task_submissions(member_id, task_id)
        WHERE batch_id IS NULL AND day_number IS NULL
      `),
      // CREATE TABLE statements (idempotent)
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS product_inquiries (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          message    TEXT,
          status     VARCHAR(50) NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS member_attendance (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
          day_number INT NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'present',
          notes TEXT,
          marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(member_id, batch_id, day_number)
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS batch_break_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
          start_day INT NOT NULL,
          end_day INT NOT NULL,
          reason TEXT,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          admin_note TEXT,
          reviewed_by TEXT,
          reviewed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS member_batch_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
          extended_days INT NOT NULL DEFAULT 0,
          notes TEXT,
          updated_by TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(member_id, batch_id)
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS admin_notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          type VARCHAR(50) NOT NULL DEFAULT 'info',
          metadata JSONB,
          is_read BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      // ── Master data tables (2026-07-16) ───────────────────────────
      // Cities / states / business types shared across members. Each
      // has a unique index on lower(name) for case-insensitive dedup
      // ("Chennai", "chennai", "CHENNAI" collapse to one entry).
      // Names are stored in canonical title-cased form via the create
      // handlers, but the unique index makes the dedup guarantee
      // enforced at the DB level regardless of what upstream code
      // does. Members store city/state/businessType as plain strings
      // (not FK) — the master tables are for autocomplete + admin
      // visibility, not referential integrity. See
      // backend/src/modules/masters/ for the API.
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS cities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS cities_name_lower_uniq ON cities (lower(name));
        CREATE INDEX IF NOT EXISTS cities_name_lower_search ON cities (lower(name) text_pattern_ops);
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS states (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS states_name_lower_uniq ON states (lower(name));
        CREATE INDEX IF NOT EXISTS states_name_lower_search ON states (lower(name) text_pattern_ops);
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS business_types (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS business_types_name_lower_uniq ON business_types (lower(name));
        CREATE INDEX IF NOT EXISTS business_types_name_lower_search ON business_types (lower(name) text_pattern_ops);
      `),
      // Add business_type as a plain string on members (matches the
      // existing city/state pattern — no FK, just a value the master
      // list mirrors for autocomplete).
      prisma.$executeRawUnsafe(`
        ALTER TABLE members
          ADD COLUMN IF NOT EXISTS business_type TEXT
      `),
      // ── AI Content Buddy (2026-07-18) ─────────────────────────────
      // Claude-backed chat assistant for members (text/voice/image →
      // generated content). Ported from co-worker's admin-app but
      // adapted for our stack: `member_id UUID` (FK to members) instead
      // of `user_id TEXT` (anon UUID), matches our JWT-cookie auth
      // model. Rate limits (30/day + 10/min) enforced in-app via the
      // ai_usage_counters composite-PK table. See modules/ai/.
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ai_conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          title TEXT NOT NULL DEFAULT 'New Conversation',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ai_conversations_member ON ai_conversations(member_id, updated_at DESC);
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ai_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
          sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
          message TEXT NOT NULL,
          input_type TEXT NOT NULL CHECK (input_type IN ('text', 'voice', 'image')),
          image_url TEXT,
          content_type TEXT,
          language TEXT,
          tone TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS saved_ai_content (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'other'
            CHECK (category IN ('social_media', 'advertisement', 'business', 'personal', 'video_script', 'email', 'other')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_saved_ai_content_member ON saved_ai_content(member_id, created_at DESC);
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ai_usage_counters (
          member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          window_type TEXT NOT NULL CHECK (window_type IN ('day', 'minute')),
          window_start TIMESTAMPTZ NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (member_id, window_type, window_start)
        )
      `),
      // ── Podcasts (2026-07-18) ─────────────────────────────────────
      // Ported from co-worker's FULL_MIGRATION.sql lines 106-193.
      // Adapted for our stack: `member_id UUID` FK to members (was
      // `user_id TEXT` anon UUID). Slugs kept unique per table; sort
      // order + status VARCHAR match the admin CRUD contract; tags
      // stored as TEXT[] (native Postgres array) for cheap ANY() filters.
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS podcast_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS podcast_series (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          cover_image TEXT,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS podcast_episodes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          category_id UUID REFERENCES podcast_categories(id) ON DELETE SET NULL,
          series_id UUID REFERENCES podcast_series(id) ON DELETE SET NULL,
          cover_image TEXT,
          audio_url TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL DEFAULT 0,
          speaker VARCHAR(255),
          tags TEXT[] NOT NULL DEFAULT '{}',
          is_featured BOOLEAN NOT NULL DEFAULT false,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          publish_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_podcast_episodes_category ON podcast_episodes(category_id);
        CREATE INDEX IF NOT EXISTS idx_podcast_episodes_series ON podcast_episodes(series_id);
        CREATE INDEX IF NOT EXISTS idx_podcast_episodes_status ON podcast_episodes(status);
      `),
      // NOTE: named `podcast_episode_progress` (not `podcast_progress`)
      // because the primary schema has an older, unused `podcast_progress`
      // table + Prisma model dating back to a scaffolded-but-never-wired
      // podcast attempt (FK to `podcasts`, no episodes). Renaming here
      // avoids a destructive DROP of that legacy table and keeps the
      // old Prisma model compiling untouched.
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS podcast_episode_progress (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          episode_id UUID NOT NULL REFERENCES podcast_episodes(id) ON DELETE CASCADE,
          current_position_seconds INTEGER NOT NULL DEFAULT 0,
          total_duration_seconds INTEGER NOT NULL DEFAULT 0,
          completed BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (member_id, episode_id)
        );
        CREATE INDEX IF NOT EXISTS idx_podcast_episode_progress_member ON podcast_episode_progress(member_id, updated_at DESC);
      `),
      // Seed default categories — matches co-worker's FULL_MIGRATION.sql
      // line 188. Idempotent via slug ON CONFLICT. First-time admins
      // see a populated dropdown instead of an empty one; existing
      // slugs are preserved untouched.
      prisma.$executeRawUnsafe(`
        INSERT INTO podcast_categories (name, slug, status, sort_order) VALUES
          ('Mindset', 'mindset', 'active', 1),
          ('Business', 'business', 'active', 2),
          ('Growth', 'growth', 'active', 3),
          ('Leadership', 'leadership', 'active', 4)
        ON CONFLICT (slug) DO NOTHING
      `),
      // ── E-books (2026-07-18) ──────────────────────────────────────
      // Ported from co-worker's FULL_MIGRATION.sql lines 206-266.
      // Same adaptations as podcasts: member_id UUID FK to members,
      // no RLS (backend enforces auth). Book PDFs live in R2 via the
      // shared upload flow.
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ebook_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ebooks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          author VARCHAR(255),
          category_id UUID REFERENCES ebook_categories(id) ON DELETE SET NULL,
          cover_image TEXT,
          pdf_url TEXT,
          content_url TEXT,
          total_pages INTEGER NOT NULL DEFAULT 0,
          reading_time VARCHAR(50),
          is_featured BOOLEAN NOT NULL DEFAULT false,
          sort_order INTEGER NOT NULL DEFAULT 0,
          publish_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ebooks_category ON ebooks(category_id);
        CREATE INDEX IF NOT EXISTS idx_ebooks_status ON ebooks(status);
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ebook_banners (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          subtitle TEXT,
          background_image TEXT,
          button_text VARCHAR(100),
          button_link TEXT,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ebook_bookmarks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          book_id UUID NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
          page_number INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (member_id, book_id)
        );
        CREATE INDEX IF NOT EXISTS idx_ebook_bookmarks_member ON ebook_bookmarks(member_id, created_at DESC);
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ebook_progress (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          book_id UUID NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
          current_page INTEGER NOT NULL DEFAULT 0,
          total_pages INTEGER NOT NULL DEFAULT 0,
          progress_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
          completed BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (member_id, book_id)
        );
        CREATE INDEX IF NOT EXISTS idx_ebook_progress_member ON ebook_progress(member_id, updated_at DESC);
      `),
    ]).catch((err) => {
      fastify.log.warn('⚠️ Some startup SQL statements failed (non-fatal):', err);
    });

    // Backfill: publish any active courses that were created before the admin
    // Publish toggle existed (the create handler now defaults isPublished=true,
    // but earlier rows are stuck at is_published=false and never appear on the
    // user side). Idempotent — no-op once every active course is published.
    await prisma
      .$executeRawUnsafe(
        `UPDATE courses SET is_published = true WHERE is_active = true AND is_published = false`,
      )
      .catch((err) => {
        fastify.log.warn('⚠️ Course backfill (is_published) failed (non-fatal):', err);
      });

    // Master-data seed: harvest distinct city + state values from
    // existing members into the master tables. Idempotent — the
    // ON CONFLICT clause preserves whatever's already there. Runs
    // AFTER the CREATE TABLE block above so the target tables exist
    // and BEFORE any request lands so the first admin who opens the
    // city dropdown sees historical values, not an empty list.
    //
    // Deliberately does NOT touch member.city / member.state — those
    // values remain untouched on the row. The master table is a
    // parallel index of "values that have been used", not a source
    // of truth.
    await Promise.all([
      prisma.$executeRawUnsafe(`
        INSERT INTO cities (name)
        SELECT DISTINCT INITCAP(TRIM(city))
        FROM members
        WHERE city IS NOT NULL AND TRIM(city) <> ''
        ON CONFLICT (lower(name)) DO NOTHING
      `),
      prisma.$executeRawUnsafe(`
        INSERT INTO states (name)
        SELECT DISTINCT INITCAP(TRIM(state))
        FROM members
        WHERE state IS NOT NULL AND TRIM(state) <> ''
        ON CONFLICT (lower(name)) DO NOTHING
      `),
    ]).catch((err) => {
      fastify.log.warn('⚠️ Master-data seed failed (non-fatal):', err);
    });

    // Nav item inserts (run after table locks from above are released)
    await Promise.all([
      prisma.$executeRawUnsafe(`
        INSERT INTO nav_items (id, label, href, "order", is_visible, created_at, updated_at)
        SELECT gen_random_uuid(), 'Task', '/batch-program',
               COALESCE((SELECT MAX("order") FROM nav_items), 0) + 1,
               true, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM nav_items WHERE href = '/batch-program')
      `),
      prisma.$executeRawUnsafe(`
        INSERT INTO nav_items (id, label, href, "order", is_visible, created_at, updated_at)
        SELECT gen_random_uuid(), 'Courses', '/courses',
               COALESCE((SELECT MAX("order") FROM nav_items), 0) + 1,
               true, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM nav_items WHERE href = '/courses')
      `),
    ]).catch(() => {});

    // Ensure admin_notifications exists even if the main startup batch above partially failed
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'info',
        metadata JSONB,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch(() => {});
  } catch (err) {
    // Non-fatal: allow instance to start and connect lazily on first query.
    // This prevents deployment deadlocks when the DB connection pool is full
    // (e.g. during rolling deployments where old instances still hold all slots).
    fastify.log.warn('⚠️ DB connect on startup failed — will retry on first query:', err as any);
  }

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(prismaPlugin);

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
      prisma.$executeRawUnsafe(`ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS admin_reply TEXT`),
      prisma.$executeRawUnsafe(`ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS admin_replied_at TIMESTAMPTZ`),
      prisma.$executeRawUnsafe(`ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium'`),
      prisma.$executeRawUnsafe(`ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS preferred_contact VARCHAR(20)`),
      prisma.$executeRawUnsafe(`ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS attachment_urls JSONB`),
      // Auto-numbering — sequence starts at 1001 so ticket IDs look like
      // #TBT-1001 instead of #TBT-1 from day one.
      prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS helpdesk_ticket_display_seq START 1001`),
      prisma.$executeRawUnsafe(`ALTER TABLE helpdesk_tickets ADD COLUMN IF NOT EXISTS display_number INT`),
      prisma.$executeRawUnsafe(`ALTER TABLE helpdesk_tickets ALTER COLUMN display_number SET DEFAULT nextval('helpdesk_ticket_display_seq')`),
      // Backfill display_number for pre-existing rows so every historical
      // ticket also gets a printable ID.
      prisma.$executeRawUnsafe(`UPDATE helpdesk_tickets SET display_number = nextval('helpdesk_ticket_display_seq') WHERE display_number IS NULL`),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS helpdesk_ticket_replies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ticket_id UUID NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
          body TEXT NOT NULL,
          is_from_admin BOOLEAN NOT NULL DEFAULT false,
          author_name VARCHAR(255),
          member_id UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS helpdesk_ticket_replies_ticket_id_created_at_idx ON helpdesk_ticket_replies(ticket_id, created_at)`),
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
      // Extended profile fields (2026-07-28) — role, team_size,
      // registered_office, target_network_description power the
      // Business tab of the enriched profile page.
      prisma.$executeRawUnsafe(`
        ALTER TABLE members
          ADD COLUMN IF NOT EXISTS role TEXT,
          ADD COLUMN IF NOT EXISTS team_size TEXT,
          ADD COLUMN IF NOT EXISTS registered_office TEXT,
          ADD COLUMN IF NOT EXISTS target_network_description TEXT
      `),
      // Legal pages (2026-07-28) — Terms & Conditions / Privacy Policy
      // markdown bodies. Slug-based lookup via /api/pub/legal/:slug.
      // Sequenced with .then(...) so the INSERT doesn't race the CREATE
      // TABLE (both would run in parallel inside this Promise.all).
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS legal_pages (
          slug VARCHAR(50) PRIMARY KEY,
          title TEXT NOT NULL,
          body_markdown TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `).then(() => prisma.$executeRawUnsafe(`
        INSERT INTO legal_pages (slug, title, body_markdown) VALUES
          ('terms', 'Terms & Conditions', 'By using Tamil Business Tribe you agree to our terms. Full terms will appear here.'),
          ('privacy', 'Privacy Policy', 'We respect your privacy. Full privacy policy will appear here.')
        ON CONFLICT (slug) DO NOTHING
      `)),
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
      // ── Helpdesk / Support Center (2026-07-20) ────────────────────
      // Ported from co-worker's FULL_MIGRATION.sql lines 432-495.
      // Named `helpdesk_*` (not `support_*`) because the primary has a
      // scaffolded SupportTicket + SupportMessage model with a totally
      // different shape (member-only, priority enum, message thread).
      // Renaming avoids the collision non-destructively.
      // Tickets now include an optional member_id FK — when submitted
      // by an authenticated member the row remembers who, but the
      // name/email/phone fields survive for anonymous submissions from
      // future public help center pages.
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS helpdesk_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL DEFAULT 'Support Center',
          subtitle TEXT,
          whatsapp_number VARCHAR(50),
          phone_number VARCHAR(50),
          email VARCHAR(255),
          website_url TEXT,
          support_timing VARCHAR(255),
          address TEXT,
          button_text VARCHAR(100) NOT NULL DEFAULT 'Contact Us',
          banner_image TEXT,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS helpdesk_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          icon TEXT,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS helpdesk_faqs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          question VARCHAR(500) NOT NULL,
          answer TEXT NOT NULL,
          category_id UUID REFERENCES helpdesk_categories(id) ON DELETE SET NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_helpdesk_faqs_category ON helpdesk_faqs(category_id);
        CREATE INDEX IF NOT EXISTS idx_helpdesk_faqs_status ON helpdesk_faqs(status);
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS helpdesk_tickets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID REFERENCES members(id) ON DELETE SET NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          subject VARCHAR(255) NOT NULL,
          category_id UUID REFERENCES helpdesk_categories(id) ON DELETE SET NULL,
          message TEXT NOT NULL,
          attachment_url TEXT,
          admin_notes TEXT,
          status VARCHAR(50) NOT NULL DEFAULT 'new'
            CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_status ON helpdesk_tickets(status);
        CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_member ON helpdesk_tickets(member_id, created_at DESC);
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS helpdesk_feedback (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID REFERENCES members(id) ON DELETE SET NULL,
          name VARCHAR(255),
          email VARCHAR(255),
          rating INTEGER CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
          message TEXT NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'new'
            CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_helpdesk_feedback_status ON helpdesk_feedback(status);
      `),
      // Seed default helpdesk settings row so first-time admins see a
      // populated form. Idempotent — only inserts if the table is empty.
      prisma.$executeRawUnsafe(`
        INSERT INTO helpdesk_settings (title, subtitle, button_text, status)
        SELECT 'Support Center', 'We are here to help.', 'Contact Us', 'active'
        WHERE NOT EXISTS (SELECT 1 FROM helpdesk_settings)
      `),
      // ── TBT Gamification (2026-07-20) ─────────────────────────────
      // Ported from co-worker's FULL_MIGRATION.sql lines 551-654.
      // Adapted: user_id TEXT → member_id UUID FK. Table names kept
      // as-is (`tbt_*` namespace) — no collision with primary's
      // generic `tasks` / `points_ledger` / `badges` tables since
      // these are TBT-90day-journey specific.
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS tbt_activity_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          points INTEGER NOT NULL DEFAULT 0,
          source VARCHAR(50) NOT NULL DEFAULT 'task_completion',
          activity_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')::DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_tbt_activity_log_member ON tbt_activity_log(member_id);
        CREATE INDEX IF NOT EXISTS idx_tbt_activity_log_member_date ON tbt_activity_log(member_id, activity_date);
        -- reference_id: enables idempotent backfill of legacy point sources
        -- (workshop episodes / challenges / assignments / course XP). Partial
        -- unique index means task_completion rows (which set no ref) are
        -- unaffected and can still stack multiple entries per member.
        ALTER TABLE tbt_activity_log ADD COLUMN IF NOT EXISTS reference_id UUID;
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_tbt_activity_log_member_source_ref
          ON tbt_activity_log(member_id, source, reference_id)
          WHERE reference_id IS NOT NULL;
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS tbt_levels (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          level_number INTEGER NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          required_points INTEGER NOT NULL,
          reward VARCHAR(255),
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS tbt_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          task_order INTEGER NOT NULL UNIQUE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          required_action VARCHAR(255),
          reward_points INTEGER NOT NULL DEFAULT 0,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_tbt_tasks_order ON tbt_tasks(task_order);
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS tbt_task_completions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
          task_id UUID NOT NULL REFERENCES tbt_tasks(id) ON DELETE CASCADE,
          completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (member_id, task_id)
        );
        CREATE INDEX IF NOT EXISTS idx_tbt_task_completions_member ON tbt_task_completions(member_id);
      `),
      // Seed levels + tasks — matches co-worker's FULL_MIGRATION.sql
      // seeds exactly. ON CONFLICT keeps admin-edited values intact.
      prisma.$executeRawUnsafe(`
        INSERT INTO tbt_levels (level_number, name, description, required_points, reward, sort_order) VALUES
          (1, 'Starter', 'Complete your first tasks and get the ball rolling.', 200, 'Bronze Badge', 1),
          (2, 'Builder', 'Keep the momentum going with consistent daily progress.', 300, 'Silver Badge', 2),
          (3, 'Achiever', 'Turn consistency into real, visible business results.', 500, 'Gold Badge', 3),
          (4, 'Momentum Maker', 'Push through the mid-program grind and compound your gains.', 800, 'Platinum Badge', 4),
          (5, 'Elite Performer', 'Join the top tier of consistently high-performing members.', 1200, 'Elite Badge', 5),
          (6, 'Legend', 'Complete the full journey and cement your status as a TBT Legend.', 2000, 'Legend Trophy', 6)
        ON CONFLICT (level_number) DO NOTHING
      `),
      prisma.$executeRawUnsafe(`
        INSERT INTO tbt_tasks (task_order, title, description, required_action, reward_points, status, sort_order) VALUES
          (1, 'Attend Onboarding Call',
            'Attend the live onboarding kick-off session or watch the video replay to align on the core 90-day execution framework.',
            'Complete your onboarding profile and join the community groups.', 250, 'active', 1),
          (2, 'Define Your Customer Segment',
            'Define the high-value target audience for your product. Focus on psychological triggers, spending capacity, and pain points that align with your unique value proposition.',
            'Fill in the Customer Segment section of your Business Model Canvas.', 500, 'active', 2),
          (3, 'Conduct 5 Customer Interviews',
            'Validate the core problem statement with potential target clients and record feedback. Gather qualitative data regarding their constraints.',
            'Complete 5 customer interviews and summarize the feedback.', 300, 'active', 3),
          (4, 'Launch Landing Page MVP',
            'Create a simple landing page showcasing the offer value proposition and signup form. Collect early subscriber signups.',
            'Publish your landing page and share the link.', 400, 'active', 4),
          (5, 'Submit Step 4 Milestone',
            'Consolidate all learnings, customer interviews, and MVP landing page analytics into the final execution summary.',
            'Submit your consolidated milestone summary.', 500, 'active', 5)
        ON CONFLICT (task_order) DO NOTHING
      `),
      // ── Community posts extensions (Module 9A) ─────────────────────
      // Two flags the co-worker's home-page composer needs:
      //   is_mentor   → post authored by a mentor (visual badge)
      //   is_approved → moderation flag; only approved posts show in feed
      prisma.$executeRawUnsafe(`
        ALTER TABLE community_posts
          ADD COLUMN IF NOT EXISTS is_mentor BOOLEAN NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT true
      `),
      // ── Morning Ritual (2026-07-20, Module 8B) ─────────────────────
      // Ported from co-worker's FULL_MIGRATION.sql lines 305-342.
      // No member FK — habits are global; each member's daily yes/no
      // answers stay client-side (not persisted).
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS habits (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          icon VARCHAR(100) NOT NULL DEFAULT 'fa-sun',
          raw_question TEXT NOT NULL,
          highlight_word VARCHAR(255) NOT NULL DEFAULT '',
          subtitle VARCHAR(255) NOT NULL DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS buttons_config (
          id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
          yes_label VARCHAR(100) NOT NULL DEFAULT 'Yes',
          not_yet_label VARCHAR(100) NOT NULL DEFAULT 'Not Yet',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `),
      // Seed 5 default habits so first-run mobile users see the ritual.
      prisma.$executeRawUnsafe(`
        INSERT INTO habits (icon, raw_question, highlight_word, subtitle, sort_order)
        SELECT * FROM (VALUES
          ('fa-sun', 'Did you write your morning pages?', 'morning pages', 'Build clarity. Boost focus. Start your day right.', 1),
          ('fa-spa', 'Did you meditate for 10 minutes?', 'for 10 minutes', 'Calm your mind. Find presence. Center yourself.', 2),
          ('fa-bullseye', 'Did you plan your daily goals?', 'daily goals', 'Prioritize tasks. Direct your energy. Stay productive.', 3),
          ('fa-dumbbell', 'Did you exercise or stretch today?', 'stretch today', 'Activate your body. Boost energy. Stay healthy.', 4),
          ('fa-coffee', 'Did you eat a healthy breakfast?', 'healthy breakfast', 'Nourish your body. Fuel your mind for the day.', 5)
        ) AS seed(icon, raw_question, highlight_word, subtitle, sort_order)
        WHERE NOT EXISTS (SELECT 1 FROM habits)
      `),
      prisma.$executeRawUnsafe(`
        INSERT INTO buttons_config (id, yes_label, not_yet_label)
        VALUES ('default', 'Yes', 'Not Yet')
        ON CONFLICT (id) DO NOTHING
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

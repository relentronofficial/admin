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
      prisma.$executeRawUnsafe(`
        ALTER TABLE courses
          ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
          ADD COLUMN IF NOT EXISTS access_duration_days INTEGER,
          ADD COLUMN IF NOT EXISTS max_enrollments INTEGER,
          ADD COLUMN IF NOT EXISTS upsell_course_ids TEXT[] DEFAULT '{}',
          ADD COLUMN IF NOT EXISTS cross_sell_course_ids TEXT[] DEFAULT '{}',
          ADD COLUMN IF NOT EXISTS xp_per_episode INTEGER NOT NULL DEFAULT 10,
          ADD COLUMN IF NOT EXISTS passing_score_percent INTEGER NOT NULL DEFAULT 70
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
      prisma.$executeRawUnsafe(`ALTER TABLE member_day_progress ADD COLUMN IF NOT EXISTS task_proofs JSONB`),
      prisma.$executeRawUnsafe(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS xp_per_day INT NOT NULL DEFAULT 50`),
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
    ]);

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
    ]);
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

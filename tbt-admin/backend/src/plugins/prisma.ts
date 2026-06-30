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
    // Idempotent enum migration — adds 'pending' to MemberStatus if not already present.
    // Safe to run on every startup; PostgreSQL ignores it when the value already exists.
    await prisma.$executeRawUnsafe(`ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'pending'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "CoursePaymentMethod" ADD VALUE IF NOT EXISTS 'external'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS payment_link_url TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS login_bg_images JSONB`).catch(() => {});
    // Idempotent column additions for Product e-commerce fields
    await prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(10,2)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_status VARCHAR(50) NOT NULL DEFAULT 'in_stock'`);
    // Watched segments bitmask column — stores JSON array of 10s segment indices actually watched
    await prisma.$executeRawUnsafe(`ALTER TABLE member_episode_progress ADD COLUMN IF NOT EXISTS watched_segments TEXT`);
    // Assignment type (qa vs image_upload) and image submission support
    await prisma.$executeRawUnsafe(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(50) NOT NULL DEFAULT 'qa'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE assignments ALTER COLUMN question_text DROP NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE assignment_submissions ALTER COLUMN answer_text DROP NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS image_url TEXT`);
    // Product inquiries table — idempotent, safe on every startup
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS product_inquiries (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        message    TEXT,
        status     VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Batch-based access control columns
    await prisma.$executeRawUnsafe(`ALTER TABLE workshops ADD COLUMN IF NOT EXISTS batch_ids JSONB`);
    await prisma.$executeRawUnsafe(`ALTER TABLE app_resources ADD COLUMN IF NOT EXISTS visibility JSONB`);
    // Batch program nav item — insert only if /batch-program link doesn't exist yet
    await prisma.$executeRawUnsafe(`
      INSERT INTO nav_items (id, label, href, "order", is_visible, created_at, updated_at)
      SELECT gen_random_uuid(), 'Task', '/batch-program',
             COALESCE((SELECT MAX("order") FROM nav_items), 0) + 1,
             true, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM nav_items WHERE href = '/batch-program')
    `);
    // Courses nav item — insert only if /courses link doesn't exist yet
    await prisma.$executeRawUnsafe(`
      INSERT INTO nav_items (id, label, href, "order", is_visible, created_at, updated_at)
      SELECT gen_random_uuid(), 'Courses', '/courses',
             COALESCE((SELECT MAX("order") FROM nav_items), 0) + 1,
             true, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM nav_items WHERE href = '/courses')
    `);
    // Course platform — new columns on courses table (§2.5)
    await prisma.$executeRawUnsafe(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS access_duration_days INTEGER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS max_enrollments INTEGER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS upsell_course_ids TEXT[] DEFAULT '{}'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS cross_sell_course_ids TEXT[] DEFAULT '{}'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS xp_per_episode INTEGER NOT NULL DEFAULT 10`);
    await prisma.$executeRawUnsafe(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS passing_score_percent INTEGER NOT NULL DEFAULT 70`);
    // Course platform — new columns on course_episodes table (§2.6)
    await prisma.$executeRawUnsafe(`ALTER TABLE course_episodes ADD COLUMN IF NOT EXISTS quiz_data JSONB`);
    await prisma.$executeRawUnsafe(`ALTER TABLE course_episodes ADD COLUMN IF NOT EXISTS quiz_unlock_percent INTEGER NOT NULL DEFAULT 80`);
    await prisma.$executeRawUnsafe(`ALTER TABLE course_episodes ADD COLUMN IF NOT EXISTS drm_enabled BOOLEAN NOT NULL DEFAULT false`);
    await prisma.$executeRawUnsafe(`ALTER TABLE course_episodes ADD COLUMN IF NOT EXISTS bunny_drm_token TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS payment_link_url TEXT`);
    // Resource description field
    await prisma.$executeRawUnsafe(`ALTER TABLE app_resources ADD COLUMN IF NOT EXISTS description TEXT`);
    // Reflection modal UI strings
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS reflect_title TEXT NOT NULL DEFAULT 'Reflect & Retain'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS reflect_prompt_prefix TEXT NOT NULL DEFAULT 'What''s one thing from'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS reflect_prompt_suffix TEXT NOT NULL DEFAULT 'you''ll actually apply?'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS reflect_placeholder TEXT NOT NULL DEFAULT 'Write in your own words — 2-3 sentences is enough…'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS reflect_skip_label TEXT NOT NULL DEFAULT 'Skip'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS reflect_save_label TEXT NOT NULL DEFAULT 'Save Reflection'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS reflect_saved_label TEXT NOT NULL DEFAULT '✓ Saved!'`);
    // Batch program UI strings
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_program_label TEXT NOT NULL DEFAULT 'Program'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_not_assigned_msg TEXT NOT NULL DEFAULT 'You haven''t been assigned to a batch yet.'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_contact_msg TEXT NOT NULL DEFAULT 'Contact your account manager to get assigned.'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_days_approved_label TEXT NOT NULL DEFAULT 'days approved'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_all_days_label TEXT NOT NULL DEFAULT 'All Days'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_status_not_started TEXT NOT NULL DEFAULT 'Not started'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_status_in_progress TEXT NOT NULL DEFAULT 'In progress'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_status_pending_review TEXT NOT NULL DEFAULT 'Pending review'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_status_approved TEXT NOT NULL DEFAULT 'Approved'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_status_needs_revision TEXT NOT NULL DEFAULT 'Needs revision'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_status_approved_check TEXT NOT NULL DEFAULT 'Approved ✓'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_approved_pill_label TEXT NOT NULL DEFAULT 'Approved'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_pending_pill_label TEXT NOT NULL DEFAULT 'Pending'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_needs_revision_pill_label TEXT NOT NULL DEFAULT 'Needs Revision'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_in_progress_pill_label TEXT NOT NULL DEFAULT 'In Progress'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_today_label TEXT NOT NULL DEFAULT 'Today'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_not_assigned_note TEXT NOT NULL DEFAULT 'You are not currently assigned to a batch.'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_revision_label TEXT NOT NULL DEFAULT 'Revision requested'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_future_note TEXT NOT NULL DEFAULT 'This day hasn''t started yet. You can view but not submit.'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_pending_note TEXT NOT NULL DEFAULT 'Submitted for review — waiting for account manager approval'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_approved_note TEXT NOT NULL DEFAULT 'Day approved by your account manager'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_open_resource_label TEXT NOT NULL DEFAULT 'Open Resource'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_checklist_label TEXT NOT NULL DEFAULT 'Checklist'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_done_label TEXT NOT NULL DEFAULT 'done'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_journal_label TEXT NOT NULL DEFAULT 'Daily Journal'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_journal_placeholder TEXT NOT NULL DEFAULT 'What did you do today? What did you learn? Any challenges?'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_save_draft_label TEXT NOT NULL DEFAULT 'Save Draft'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_submit_label TEXT NOT NULL DEFAULT 'Submit for Review'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_progress_saved TEXT NOT NULL DEFAULT 'Progress saved'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_progress_save_error TEXT NOT NULL DEFAULT 'Failed to save progress'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_submit_success TEXT NOT NULL DEFAULT 'Submitted for review!'`);
    // Attendance & break system
    await prisma.$executeRawUnsafe(`ALTER TABLE batch_days ADD COLUMN IF NOT EXISTS category VARCHAR(100)`);
    await prisma.$executeRawUnsafe(`
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
    `);
    await prisma.$executeRawUnsafe(`
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
    `);
    await prisma.$executeRawUnsafe(`
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
    `);
    // New UiStrings for attendance/break/category
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_attendance_label TEXT NOT NULL DEFAULT 'Attendance'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_mark_present_label TEXT NOT NULL DEFAULT 'Mark Present'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_present_label TEXT NOT NULL DEFAULT 'Present'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_absent_label TEXT NOT NULL DEFAULT 'Absent'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_break_label TEXT NOT NULL DEFAULT 'Break'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_attendance_rate_label TEXT NOT NULL DEFAULT 'Attendance Rate'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_request_break_label TEXT NOT NULL DEFAULT 'Request Break'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_break_reason_placeholder TEXT NOT NULL DEFAULT 'Reason for taking a break...'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_break_submitted_msg TEXT NOT NULL DEFAULT 'Break request submitted'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_break_approved_label TEXT NOT NULL DEFAULT 'Break approved'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_break_pending_label TEXT NOT NULL DEFAULT 'Break pending approval'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_category_label TEXT NOT NULL DEFAULT 'Category'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_not_marked_label TEXT NOT NULL DEFAULT 'Not marked'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_extended_days_label TEXT NOT NULL DEFAULT 'Extended days'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_break_start_label TEXT NOT NULL DEFAULT 'Start day'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_break_end_label TEXT NOT NULL DEFAULT 'End day'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_break_reason_label TEXT NOT NULL DEFAULT 'Reason'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_break_rejected_label TEXT NOT NULL DEFAULT 'Rejected'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE ui_strings ADD COLUMN IF NOT EXISTS batch_break_submit_label TEXT NOT NULL DEFAULT 'Submit Request'`);
    // Batch task proofs — stores per-task proof URLs/text submitted by member
    await prisma.$executeRawUnsafe(`ALTER TABLE member_day_progress ADD COLUMN IF NOT EXISTS task_proofs JSONB`);
    // Configurable XP awarded per approved day (default 50)
    await prisma.$executeRawUnsafe(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS xp_per_day INT NOT NULL DEFAULT 50`);
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

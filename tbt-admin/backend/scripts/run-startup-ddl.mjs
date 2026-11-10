/**
 * Run the backend startup DDL against a target database.
 * Usage: DATABASE_URL=... DIRECT_URL=... node scripts/run-startup-ddl.mjs
 *
 * This script connects to the database and runs all the same DDL that
 * prisma.ts runs at startup — idempotent ALTER TABLE / CREATE TABLE
 * statements. Run this against Cloud SQL after prisma db push to add
 * all the raw-SQL columns/tables that the backend expects.
 */
import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;
const DIRECT_URL = process.env.DIRECT_URL;

if (!DATABASE_URL || !DIRECT_URL) {
  console.error('Usage: DATABASE_URL=... DIRECT_URL=... node scripts/run-startup-ddl.mjs');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

async function run() {
  await prisma.$connect();
  console.log('Connected to database');

  // ── Enum migrations ───────────────────────────────────────────────────────
  console.log('Running enum migrations...');
  await prisma.$executeRawUnsafe(`ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'pending'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "CoursePaymentMethod" ADD VALUE IF NOT EXISTS 'external'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'changes_requested'`);
  console.log('Enums done');

  // ── courses ───────────────────────────────────────────────────────────────
  console.log('Altering courses...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE courses
      ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
      ADD COLUMN IF NOT EXISTS access_duration_days INTEGER,
      ADD COLUMN IF NOT EXISTS max_enrollments INTEGER,
      ADD COLUMN IF NOT EXISTS upsell_course_ids TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS cross_sell_course_ids TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS xp_per_episode INTEGER NOT NULL DEFAULT 10,
      ADD COLUMN IF NOT EXISTS passing_score_percent INTEGER NOT NULL DEFAULT 70,
      ADD COLUMN IF NOT EXISTS require_sequential BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS completion_threshold_percent INTEGER NOT NULL DEFAULT 95,
      ADD COLUMN IF NOT EXISTS module VARCHAR(100),
      ADD COLUMN IF NOT EXISTS applicable_business_types TEXT[]
  `);

  // ── course_episode_progress ────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE course_episode_progress ADD COLUMN IF NOT EXISTS interaction_response TEXT`);

  // ── course_episodes ────────────────────────────────────────────────────────
  console.log('Altering course_episodes...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE course_episodes
      ADD COLUMN IF NOT EXISTS quiz_data JSONB,
      ADD COLUMN IF NOT EXISTS quiz_unlock_percent INTEGER NOT NULL DEFAULT 80,
      ADD COLUMN IF NOT EXISTS drm_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS bunny_drm_token TEXT,
      ADD COLUMN IF NOT EXISTS timer_seconds INTEGER,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS streak_points INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lifeline_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS lifeline_count INTEGER NOT NULL DEFAULT 3,
      ADD COLUMN IF NOT EXISTS lifeline_coin_cost INTEGER NOT NULL DEFAULT 50,
      ADD COLUMN IF NOT EXISTS max_purchased_lifelines INTEGER NOT NULL DEFAULT 5,
      ADD COLUMN IF NOT EXISTS episode_side_content JSONB,
      ADD COLUMN IF NOT EXISTS episode_form_config JSONB
  `);

  // ── member_episode_progress ────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE member_episode_progress ADD COLUMN IF NOT EXISTS watched_segments TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE member_episode_progress ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMPTZ`);
  await prisma.$executeRawUnsafe(`ALTER TABLE member_episode_progress ADD COLUMN IF NOT EXISTS timer_seconds INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE member_episode_progress ADD COLUMN IF NOT EXISTS completed_early BOOLEAN`);

  // ── batches ────────────────────────────────────────────────────────────────
  console.log('Altering batches...');
  await prisma.$executeRawUnsafe(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS xp_per_day INT NOT NULL DEFAULT 50`);
  await prisma.$executeRawUnsafe(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS snapshot_days INT`);

  // ── tasks ──────────────────────────────────────────────────────────────────
  console.log('Altering tasks...');
  await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(id) ON DELETE CASCADE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS timer_seconds INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS course_episode_id UUID REFERENCES course_episodes(id) ON DELETE CASCADE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE CASCADE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_mode VARCHAR(50) NOT NULL DEFAULT 'manual'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS graph_week_id TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS graph_milestone_id TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);

  // ── task_submissions ────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(id) ON DELETE CASCADE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS day_progress_id UUID`);
  await prisma.$executeRawUnsafe(`ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS day_number INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS submitted_after_expiry BOOLEAN NOT NULL DEFAULT false`);

  // ── workshops ─────────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE workshops ADD COLUMN IF NOT EXISTS batch_ids JSONB`);

  // ── app_resources ─────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE app_resources ADD COLUMN IF NOT EXISTS description TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE app_resources ADD COLUMN IF NOT EXISTS visibility JSONB`);
  await prisma.$executeRawUnsafe(`ALTER TABLE app_resources ADD COLUMN IF NOT EXISTS course_episode_id UUID REFERENCES course_episodes(id) ON DELETE CASCADE`);

  // ── site_configs ───────────────────────────────────────────────────────────
  console.log('Altering site_configs...');
  await prisma.$executeRawUnsafe(`ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS login_bg_images JSONB`);
  await prisma.$executeRawUnsafe(`ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS hidden_menu_keys JSONB`);
  await prisma.$executeRawUnsafe(`ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS early_completion_bonus_xp INT NOT NULL DEFAULT 5`);
  await prisma.$executeRawUnsafe(`ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS task_timer_seconds INT NOT NULL DEFAULT 300`);
  await prisma.$executeRawUnsafe(`ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS free_lifelines_per_session INT NOT NULL DEFAULT 3`);
  await prisma.$executeRawUnsafe(`ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS lifeline_coin_cost INT NOT NULL DEFAULT 50`);
  await prisma.$executeRawUnsafe(`ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS theme_mode VARCHAR(10) NOT NULL DEFAULT 'light'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS courses_banner_url TEXT`);

  // ── programs ──────────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS allowed_modules JSONB`);

  // ── members ───────────────────────────────────────────────────────────────
  console.log('Altering members...');
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS watched_video_steps JSONB DEFAULT '[]'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS business_type VARCHAR(100)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS role VARCHAR(100)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS team_size VARCHAR(50)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS registered_office VARCHAR(200)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS target_network_description TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS has_website BOOLEAN`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS weekly_website_orders INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS weekly_learning_hours INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS business_started_from VARCHAR(100)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS instagram_stats JSONB`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS facebook_stats JSONB`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS website_url TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS revenue_goal_after_tbt TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS skill_business_foundation INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS skill_content INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS skill_funnels INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS skill_ads INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS skill_sales INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN IF NOT EXISTS skill_overall_marketing INTEGER`);

  // ── member_batch_settings ─────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE member_batch_settings ADD COLUMN IF NOT EXISTS lifelines_total INTEGER NOT NULL DEFAULT 3`);
  await prisma.$executeRawUnsafe(`ALTER TABLE member_batch_settings ADD COLUMN IF NOT EXISTS lifelines_used INTEGER NOT NULL DEFAULT 0`);

  // ── tbt_activity_log ──────────────────────────────────────────────────────
  console.log('Altering tbt_activity_log...');
  await prisma.$executeRawUnsafe(`ALTER TABLE tbt_activity_log ADD COLUMN IF NOT EXISTS reference_id UUID`);
  await prisma.$executeRawUnsafe(`ALTER TABLE tbt_activity_log ADD COLUMN IF NOT EXISTS activity_date DATE`);

  // ── whatsapp_messages ─────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS report_type VARCHAR(50)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS report_period VARCHAR(50)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS provider_message_id TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS failure_reason TEXT`);

  // ── chat_groups ────────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE chat_groups ADD COLUMN IF NOT EXISTS announcement_only BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE chat_groups ADD COLUMN IF NOT EXISTS disappearing_duration_seconds INTEGER`);

  // ── chat_group_messages ────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS forwarded_from_message_id UUID`);
  await prisma.$executeRawUnsafe(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS link_preview JSONB`);

  // ── chat_group_message_reads ───────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE chat_group_message_reads ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ`);

  // ── direct_messages ────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false`);

  // ── onboarding_content ─────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS onboarding_content (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      step_key VARCHAR(100) NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      media_url TEXT,
      media_type VARCHAR(50),
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      cta_label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE onboarding_content ADD COLUMN IF NOT EXISTS cta_label TEXT`);

  // ── courses — batch_visibility_ids ──────────────────────────────────────────
  await prisma.$executeRawUnsafe(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS batch_visibility_ids JSONB`);

  // ── Raw SQL tables (no Prisma models) ─────────────────────────────────────
  console.log('Creating raw SQL tables...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS member_attendance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'present',
      notes TEXT,
      marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(member_id, batch_id, day_number)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS batch_break_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      reason TEXT,
      start_day INTEGER NOT NULL,
      end_day INTEGER,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS member_batch_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      extended_days INTEGER NOT NULL DEFAULT 0,
      lifelines_total INTEGER NOT NULL DEFAULT 3,
      lifelines_used INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(member_id, batch_id)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS product_inquiries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      message TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(100) NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      metadata JSONB,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS course_sections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      timer_seconds INTEGER
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE course_episodes ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES course_sections(id) ON DELETE SET NULL`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS lesson_feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
      feedback_text TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(member_id, course_id, lesson_id)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS lesson_timer_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      episode_id UUID NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      duration_seconds INTEGER NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS episode_lifeline_state (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      episode_id UUID NOT NULL,
      free_used INTEGER NOT NULL DEFAULT 0,
      purchased_used INTEGER NOT NULL DEFAULT 0,
      total_used INTEGER NOT NULL DEFAULT 0,
      UNIQUE(member_id, episode_id)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS psychometric_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      correct_answer TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS psychometric_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      answers JSONB NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS legal_pages (
      slug VARCHAR(100) PRIMARY KEY,
      title TEXT NOT NULL,
      body_markdown TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      title TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ai_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS saved_ai_content (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      title TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ai_usage_counters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(member_id, date)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS cities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      state_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS states (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS business_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS helpdesk_ticket_activity_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID NOT NULL,
      action VARCHAR(100) NOT NULL,
      performed_by_admin_id UUID,
      performed_by_member_id UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS onboarding_buttons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── plan_entitlements ────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS plan_entitlements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_name VARCHAR(100) NOT NULL,
      support_type VARCHAR(100) NOT NULL,
      allocated INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(plan_name, support_type)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS support_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      support_type VARCHAR(100) NOT NULL,
      used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes TEXT
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS credit_purchases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      credit_type VARCHAR(100) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      amount_inr DECIMAL(10,2),
      payment_ref TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      reviewed_by UUID REFERENCES admins(id),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS credit_pricing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      credit_type VARCHAR(100) NOT NULL UNIQUE,
      price_inr DECIMAL(10,2) NOT NULL,
      description TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS task_processes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS process_id UUID REFERENCES task_processes(id) ON DELETE SET NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS stage_position INTEGER`);

  // ── video_feedback tables ──────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS video_feedback_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      episode_id UUID NOT NULL,
      episode_type VARCHAR(50) NOT NULL DEFAULT 'course',
      question TEXT NOT NULL,
      question_type VARCHAR(50) NOT NULL DEFAULT 'rating',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS video_feedback_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id UUID NOT NULL REFERENCES video_feedback_questions(id) ON DELETE CASCADE,
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      response TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── graph tables ───────────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS graph_weeks (
      id TEXT PRIMARY KEY,
      batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      day_start INTEGER NOT NULL,
      day_end INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS graph_milestones (
      id TEXT PRIMARY KEY,
      batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      threshold_amount NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS member_graph_milestone_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      milestone_id TEXT NOT NULL,
      week_id TEXT NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes TEXT
    )
  `);

  await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS graph_week_id TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS graph_milestone_id TEXT`);

  // ── support call tables ────────────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS support_call_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category VARCHAR(100) NOT NULL,
      title TEXT NOT NULL,
      host_admin_id UUID REFERENCES admins(id),
      starts_at TIMESTAMPTZ NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      capacity INTEGER NOT NULL DEFAULT 1,
      meeting_url TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS support_call_bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES support_call_sessions(id) ON DELETE CASCADE,
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'booked',
      usage_id UUID,
      expected_starts_at TIMESTAMPTZ,
      booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cancelled_at TIMESTAMPTZ,
      cancel_reason TEXT,
      UNIQUE(session_id, member_id, status) DEFERRABLE INITIALLY DEFERRED
    )
  `);

  // ── tbt_activity_log indexes ───────────────────────────────────────────────
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tbt_activity_unique ON tbt_activity_log(member_id, reference_id, source) WHERE reference_id IS NOT NULL`);

  console.log('All startup DDL complete!');
}

run()
  .catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

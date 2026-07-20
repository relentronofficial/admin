-- ============================================================================
-- FINAL_MIGRATION.sql — TBT Admin consolidated schema
-- ============================================================================
-- Generated: 2026-07-20 (post Modules 1–7)
-- Purpose:   Standalone, idempotent, non-destructive snapshot of every SQL
--            statement the Fastify backend applies at boot via
--            plugins/prisma.ts. Intended for:
--              * Audit trail (what's actually in Supabase)
--              * Disaster recovery (rebuild a lost staging/prod schema)
--              * Fresh Supabase project bootstrap (dev → new env promotion)
--
-- Safety:    Every statement is idempotent — safe to run multiple times.
--            Uses IF NOT EXISTS on tables, columns, and indexes; uses
--            ON CONFLICT DO NOTHING on seeds so admin edits are preserved.
--            No DROP, no TRUNCATE, no DELETE — this file cannot destroy data.
--
-- Ownership: Cloud Run staging & production run this same set of statements
--            on every backend boot. You do NOT need to execute this file
--            manually against a live environment — the backend does it for
--            you. This file exists as a canonical reference.
--
-- Note:      Prisma-managed models (Members, Courses, Workshops, etc.) are
--            NOT in this file — those live in prisma/schema.prisma and are
--            applied via `prisma db push`. This file only covers the raw
--            SQL layer the Fastify backend adds at boot.
-- ============================================================================


-- ============================================================================
-- 1. ENUM EXTENSIONS
-- ============================================================================
ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "CoursePaymentMethod" ADD VALUE IF NOT EXISTS 'external';


-- ============================================================================
-- 2. COURSES — extended columns for the sequential-unlock + paid platform
-- ============================================================================
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS access_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS max_enrollments INTEGER,
  ADD COLUMN IF NOT EXISTS upsell_course_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cross_sell_course_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS xp_per_episode INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS passing_score_percent INTEGER NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS require_sequential BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS completion_threshold_percent INTEGER NOT NULL DEFAULT 95;

ALTER TABLE course_episodes
  ADD COLUMN IF NOT EXISTS quiz_data JSONB,
  ADD COLUMN IF NOT EXISTS quiz_unlock_percent INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS drm_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bunny_drm_token TEXT;


-- ============================================================================
-- 3. PRODUCTS — pricing + stock columns
-- ============================================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS stock_status VARCHAR(50) NOT NULL DEFAULT 'in_stock';


-- ============================================================================
-- 4. ASSIGNMENTS — multi-type support (question / image / video)
-- ============================================================================
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(50) NOT NULL DEFAULT 'qa';

-- Relax NOT NULL constraints so non-text assignment types don't require
-- a `question_text` on the assignment or `answer_text` on the submission.
-- Wrapped in DO block in the backend; represented here plainly.
ALTER TABLE assignments ALTER COLUMN question_text DROP NOT NULL;
ALTER TABLE assignment_submissions ALTER COLUMN answer_text DROP NOT NULL;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS image_url TEXT;


-- ============================================================================
-- 5. UI STRINGS — 40+ batch-related string overrides
-- ============================================================================
-- Kept as one ALTER TABLE with many ADD COLUMN clauses so a partial failure
-- reverts atomically. All defaults present so a fresh row is fully populated.
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
  ADD COLUMN IF NOT EXISTS batch_break_submit_label TEXT NOT NULL DEFAULT 'Submit Request';


-- ============================================================================
-- 6. MISCELLANEOUS COLUMN ADDITIONS
-- ============================================================================
ALTER TABLE site_configs           ADD COLUMN IF NOT EXISTS login_bg_images JSONB;
ALTER TABLE member_episode_progress ADD COLUMN IF NOT EXISTS watched_segments TEXT;
ALTER TABLE workshops              ADD COLUMN IF NOT EXISTS batch_ids JSONB;
ALTER TABLE app_resources          ADD COLUMN IF NOT EXISTS visibility JSONB;
ALTER TABLE app_resources          ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE batch_days             ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE batches                ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE batches                ADD COLUMN IF NOT EXISTS snapshot_days INT;
ALTER TABLE members                ADD COLUMN IF NOT EXISTS business_type TEXT;


-- ============================================================================
-- 7. TASK UNIFICATION (Phase 1) — tasks can belong to batches OR programs
-- ============================================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(id) ON DELETE CASCADE;
ALTER TABLE tasks ALTER COLUMN program_id DROP NOT NULL;

ALTER TABLE task_submissions
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batches(id),
  ADD COLUMN IF NOT EXISTS day_progress_id UUID REFERENCES member_day_progress(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS day_number INT;

CREATE INDEX IF NOT EXISTS idx_task_sub_day_progress
  ON task_submissions(day_progress_id);
CREATE INDEX IF NOT EXISTS idx_task_sub_batch_member
  ON task_submissions(batch_id, member_id);

-- Replace the old global unique(member_id, task_id) with day-scoped partial
-- indexes so the same task can appear on different days without collision.
DO $$ BEGIN
  DROP INDEX IF EXISTS idx_task_sub_unique;
  DROP INDEX IF EXISTS "task_submissions_member_id_task_id_key";
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_sub_batch_scoped
  ON task_submissions(member_id, task_id, batch_id, day_number)
  WHERE batch_id IS NOT NULL AND day_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_sub_program_scoped
  ON task_submissions(member_id, task_id)
  WHERE batch_id IS NULL AND day_number IS NULL;


-- ============================================================================
-- 8. PRE-MERGE SUPPORTING TABLES (product inquiries, attendance, admin notifs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_inquiries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  message    TEXT,
  status     VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

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
);

CREATE TABLE IF NOT EXISTS member_batch_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  extended_days INT NOT NULL DEFAULT 0,
  notes TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, batch_id)
);

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- 9. MASTER DATA TABLES (2026-07-16) — cities, states, business_types
-- ============================================================================
-- Case-insensitive dedup via functional unique index on lower(name).
-- Names stored in canonical title-cased form. Members reference by TEXT
-- (not FK) so the master tables can be edited without cascade risk.

CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS cities_name_lower_uniq
  ON cities (lower(name));
CREATE INDEX IF NOT EXISTS cities_name_lower_search
  ON cities (lower(name) text_pattern_ops);

CREATE TABLE IF NOT EXISTS states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS states_name_lower_uniq
  ON states (lower(name));
CREATE INDEX IF NOT EXISTS states_name_lower_search
  ON states (lower(name) text_pattern_ops);

CREATE TABLE IF NOT EXISTS business_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS business_types_name_lower_uniq
  ON business_types (lower(name));
CREATE INDEX IF NOT EXISTS business_types_name_lower_search
  ON business_types (lower(name) text_pattern_ops);


-- ============================================================================
-- 10. MODULE 1 — AI CONTENT BUDDY (2026-07-18)
-- ============================================================================
-- Claude-backed chat assistant. member_id UUID FK swaps in for the
-- co-worker's per-device anonymous UUID. Rate limits enforced in-app via
-- ai_usage_counters (composite PK by window).

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_member
  ON ai_conversations(member_id, updated_at DESC);

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
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
  ON ai_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS saved_ai_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('social_media', 'advertisement', 'business',
                        'personal', 'video_script', 'email', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_ai_content_member
  ON saved_ai_content(member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage_counters (
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  window_type TEXT NOT NULL CHECK (window_type IN ('day', 'minute')),
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id, window_type, window_start)
);


-- ============================================================================
-- 11. MODULE 2 — PODCASTS (2026-07-18)
-- ============================================================================
-- Progress table named `podcast_episode_progress` (NOT `podcast_progress`)
-- because the primary has a legacy `podcast_progress` table from a
-- scaffolded-but-never-wired earlier attempt. Renaming avoids collision.

CREATE TABLE IF NOT EXISTS podcast_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

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
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_series   ON podcast_episodes(series_id);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_status   ON podcast_episodes(status);

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
CREATE INDEX IF NOT EXISTS idx_podcast_episode_progress_member
  ON podcast_episode_progress(member_id, updated_at DESC);

-- Podcast categories seed
INSERT INTO podcast_categories (name, slug, status, sort_order) VALUES
  ('Mindset', 'mindset', 'active', 1),
  ('Business', 'business', 'active', 2),
  ('Growth', 'growth', 'active', 3),
  ('Leadership', 'leadership', 'active', 4)
ON CONFLICT (slug) DO NOTHING;


-- ============================================================================
-- 12. MODULE 3 — E-BOOKS (2026-07-18)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ebook_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
CREATE INDEX IF NOT EXISTS idx_ebooks_status   ON ebooks(status);

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
);

CREATE TABLE IF NOT EXISTS ebook_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES ebooks(id) ON DELETE CASCADE,
  page_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, book_id)
);
CREATE INDEX IF NOT EXISTS idx_ebook_bookmarks_member
  ON ebook_bookmarks(member_id, created_at DESC);

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
CREATE INDEX IF NOT EXISTS idx_ebook_progress_member
  ON ebook_progress(member_id, updated_at DESC);


-- ============================================================================
-- 13. MODULE 4 — SUPPORT / HELPDESK (2026-07-20)
-- ============================================================================
-- Named `helpdesk_*` (NOT `support_*`) because the primary has scaffolded
-- SupportTicket + SupportMessage Prisma models with a different shape
-- (member-only, priority enum, message thread). Renaming avoids collision
-- non-destructively.

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
);

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
);

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
CREATE INDEX IF NOT EXISTS idx_helpdesk_faqs_status   ON helpdesk_faqs(status);

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

-- Seed a default settings row so first-time admins see a populated form.
-- Idempotent — only inserts if the table is empty.
INSERT INTO helpdesk_settings (title, subtitle, button_text, status)
SELECT 'Support Center', 'We are here to help.', 'Contact Us', 'active'
WHERE NOT EXISTS (SELECT 1 FROM helpdesk_settings);


-- ============================================================================
-- 14. MODULE 6 — TBT GAMIFICATION (2026-07-20)
-- ============================================================================
-- Table names kept as `tbt_*` — no collision with primary's generic
-- `tasks` / `points_ledger` / `badges` since TBT gamification is a
-- distinct 90-day-journey feature.

CREATE TABLE IF NOT EXISTS tbt_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  source VARCHAR(50) NOT NULL DEFAULT 'task_completion',
  activity_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')::DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tbt_activity_log_member
  ON tbt_activity_log(member_id);
CREATE INDEX IF NOT EXISTS idx_tbt_activity_log_member_date
  ON tbt_activity_log(member_id, activity_date);

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
);

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

CREATE TABLE IF NOT EXISTS tbt_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tbt_tasks(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_tbt_task_completions_member
  ON tbt_task_completions(member_id);

-- TBT levels seed
INSERT INTO tbt_levels (level_number, name, description, required_points, reward, sort_order) VALUES
  (1, 'Starter', 'Complete your first tasks and get the ball rolling.', 200, 'Bronze Badge', 1),
  (2, 'Builder', 'Keep the momentum going with consistent daily progress.', 300, 'Silver Badge', 2),
  (3, 'Achiever', 'Turn consistency into real, visible business results.', 500, 'Gold Badge', 3),
  (4, 'Momentum Maker', 'Push through the mid-program grind and compound your gains.', 800, 'Platinum Badge', 4),
  (5, 'Elite Performer', 'Join the top tier of consistently high-performing members.', 1200, 'Elite Badge', 5),
  (6, 'Legend', 'Complete the full journey and cement your status as a TBT Legend.', 2000, 'Legend Trophy', 6)
ON CONFLICT (level_number) DO NOTHING;

-- TBT tasks seed (90-day path)
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
ON CONFLICT (task_order) DO NOTHING;


-- ============================================================================
-- 15. BACKFILLS (non-blocking one-off UPDATEs)
-- ============================================================================
-- Publish any active courses that were created before the admin Publish
-- toggle existed. Idempotent: no-op once every active course is published.
UPDATE courses
SET is_published = true
WHERE is_active = true AND is_published = false;


-- ============================================================================
-- END OF FINAL_MIGRATION.sql
-- ============================================================================
-- Verification query — paste into the Supabase SQL editor to confirm the
-- 21 tables landed by Modules 1–4 + 6:
-- ----------------------------------------------------------------------------
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'ai_conversations','ai_messages','saved_ai_content','ai_usage_counters',
--     'podcast_categories','podcast_series','podcast_episodes','podcast_episode_progress',
--     'ebook_categories','ebooks','ebook_banners','ebook_bookmarks','ebook_progress',
--     'helpdesk_settings','helpdesk_categories','helpdesk_faqs','helpdesk_tickets','helpdesk_feedback',
--     'tbt_activity_log','tbt_levels','tbt_tasks','tbt_task_completions'
--   )
-- ORDER BY table_name;
-- ----------------------------------------------------------------------------
-- Expected: 22 rows (all Module 1–4 + 6 tables).
-- ============================================================================

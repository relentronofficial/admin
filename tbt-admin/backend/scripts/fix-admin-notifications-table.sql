-- Recreate admin_notifications if missing.
-- Idempotent: safe to run repeatedly. Matches the schema created by
-- backend/src/plugins/prisma.ts startup SQL block.
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

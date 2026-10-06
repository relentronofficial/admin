import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extractStartupManagedObjects, guardSchemaDiff, buildApplyScript, splitSqlStatements } from './schemaGuardLogic.js';

const STARTUP = `
  await prisma.$executeRawUnsafe(\`
    ALTER TABLE site_configs
      ADD COLUMN IF NOT EXISTS hidden_menu_keys JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS ad_skip_label TEXT NOT NULL DEFAULT 'Skip; now',
      ADD COLUMN IF NOT EXISTS theme_mode VARCHAR(10) NOT NULL DEFAULT 'light'
  \`);
  prisma.$executeRawUnsafe('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id)');
  prisma.$executeRawUnsafe(\`CREATE TABLE IF NOT EXISTS plan_entitlements (id UUID PRIMARY KEY, plan TEXT UNIQUE)\`);
  prisma.$executeRawUnsafe(\`CREATE UNIQUE INDEX IF NOT EXISTS member_xp_episode_dedup ON member_xp (member_id, episode_id) WHERE episode_id IS NOT NULL\`);
  prisma.$executeRawUnsafe(\`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_course_enrollments_course_id ON course_enrollments(course_id)\`);
  prisma.$executeRawUnsafe(\`CREATE SEQUENCE IF NOT EXISTS helpdesk_ticket_display_seq START 1001\`);
  prisma.$executeRawUnsafe(\`ALTER TABLE helpdesk_tickets ALTER COLUMN display_number SET DEFAULT nextval('helpdesk_ticket_display_seq')\`);
  prisma.$executeRawUnsafe(\`ALTER TABLE tasks ALTER COLUMN program_id DROP NOT NULL\`).catch(() => {});
`;
const managed = extractStartupManagedObjects(STARTUP);

describe('extractStartupManagedObjects', () => {
  it('collects tables, columns (including after quoted defaults) and indexes', () => {
    expect([...managed.tables]).toEqual(['plan_entitlements']);
    expect([...managed.columns.get('site_configs')!]).toEqual(['hidden_menu_keys', 'ad_skip_label', 'theme_mode']);
    expect([...managed.columns.get('tasks')!]).toEqual(['member_id']);
    expect(managed.indexes.has('member_xp_episode_dedup')).toBe(true);
    expect(managed.indexes.has('idx_course_enrollments_course_id')).toBe(true);
  });

  it('finds the incident objects in the real startup DDL (src/plugins/prisma.ts)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const real = extractStartupManagedObjects(readFileSync(resolve(here, '../plugins/prisma.ts'), 'utf8'));
    for (const t of ['plan_entitlements', 'credit_pricing', 'legal_pages', 'course_modules', 'course_episode_modules']) {
      expect(real.tables.has(t), t).toBe(true);
    }
    expect(real.columns.get('site_configs')?.has('hidden_menu_keys')).toBe(true);
    expect(real.columns.get('tasks')?.has('completion_mode')).toBe(true);
    for (const c of ['lifeline_enabled', 'lifeline_count', 'lifeline_coin_cost', 'max_purchased_lifelines', 'streak_points']) {
      expect(real.columns.get('course_episodes')?.has(c), c).toBe(true);
    }
  });
});

describe('guardSchemaDiff', () => {
  it('keeps startup-managed tables, columns, FKs and indexes instead of dropping them', () => {
    const diff = `
-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_member_id_fkey";

-- DropIndex
DROP INDEX "member_xp_episode_dedup";

-- AlterTable
ALTER TABLE "site_configs" DROP COLUMN "hidden_menu_keys",
DROP COLUMN "theme_mode";

-- DropTable
DROP TABLE "plan_entitlements";
`;
    const r = guardSchemaDiff(diff, managed);
    expect(r.blocked).toEqual([]);
    expect(r.apply).toEqual([]);
    expect(r.skipped).toHaveLength(5);
    expect(buildApplyScript(r.apply)).toBe('');
  });

  it('keeps startup-managed sequences, column defaults and nullability', () => {
    const diff = `
-- AlterTable
ALTER TABLE "helpdesk_tickets" ALTER COLUMN "display_number" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "program_id" SET NOT NULL;

-- DropSequence
DROP SEQUENCE "helpdesk_ticket_display_seq";
`;
    const r = guardSchemaDiff(diff, managed);
    expect(r.blocked).toEqual([]);
    expect(r.skipped).toHaveLength(3);
  });

  it('blocks default/nullability/sequence changes the startup DDL does not own', () => {
    const diff = `
ALTER TABLE "courses" ALTER COLUMN "slug" DROP DEFAULT;
ALTER TABLE "courses" ALTER COLUMN "title" SET NOT NULL;
DROP SEQUENCE "members_number_seq";
`;
    expect(guardSchemaDiff(diff, managed).blocked).toHaveLength(3);
  });

  it('blocks drops of Prisma-owned tables, columns and indexes', () => {
    const diff = `
DROP TABLE "members";
ALTER TABLE "courses" DROP COLUMN "title";
DROP INDEX "members_phone_key";
ALTER TABLE "courses" DROP CONSTRAINT "courses_category_id_fkey";
`;
    const r = guardSchemaDiff(diff, managed);
    expect(r.blocked).toHaveLength(4);
    expect(r.apply).toEqual([]);
  });

  it('blocks type changes, renames, defaults, enum rewrites and data statements', () => {
    const diff = `
ALTER TABLE "courses" ALTER COLUMN "price" SET DATA TYPE INTEGER;
ALTER TABLE "courses" RENAME COLUMN "title" TO "name";
ALTER TABLE "courses" ALTER COLUMN "slug" DROP DEFAULT;
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('admin');
ALTER TABLE "admins" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
DROP TYPE "Role";
COMMIT;
TRUNCATE "members";
DELETE FROM "members";
`;
    const r = guardSchemaDiff(diff, managed);
    // CREATE TYPE is additive on its own; everything else here must be blocked.
    expect(r.apply).toEqual(['CREATE TYPE "Role_new" AS ENUM (\'admin\')']);
    expect(r.blocked.length).toBe(9);
  });

  it('blocks the whole ALTER when it mixes an additive clause with a destructive one', () => {
    const r = guardSchemaDiff(`ALTER TABLE "courses" ADD COLUMN "x" TEXT,\nDROP COLUMN "title";`, managed);
    expect(r.apply).toEqual([]);
    expect(r.blocked).toEqual(['ALTER TABLE "courses" DROP COLUMN "title"']);
  });

  it('applies additive changes, keeping startup-owned drops out, in one transaction', () => {
    const diff = `
-- CreateTable
CREATE TABLE "new_things" (
    "id" UUID NOT NULL,
    "note" TEXT DEFAULT 'a;b',
    CONSTRAINT "new_things_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "site_configs" ADD COLUMN "new_flag" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "hidden_menu_keys";

-- CreateIndex
CREATE UNIQUE INDEX "new_things_note_key" ON "new_things"("note");

-- AlterEnum
ALTER TYPE "MemberStatus" ADD VALUE 'archived';

-- AddForeignKey
ALTER TABLE "new_things" ADD CONSTRAINT "new_things_id_fkey" FOREIGN KEY ("id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
`;
    const r = guardSchemaDiff(diff, managed);
    expect(r.blocked).toEqual([]);
    expect(r.skipped).toEqual(['ALTER TABLE "site_configs" DROP COLUMN "hidden_menu_keys"']);
    expect(r.apply).toHaveLength(5);
    expect(r.apply[1]).toBe('ALTER TABLE "site_configs" ADD COLUMN "new_flag" BOOLEAN NOT NULL DEFAULT false');
    const script = buildApplyScript(r.apply);
    expect(script.startsWith('BEGIN;\n')).toBe(true);
    expect(script.trimEnd().endsWith('COMMIT;')).toBe(true);
  });

  it('splits statements without breaking on semicolons inside string literals', () => {
    expect(splitSqlStatements(`CREATE TABLE "a" ("n" TEXT DEFAULT 'x;y');\nDROP TABLE "b";`)).toHaveLength(2);
  });
});

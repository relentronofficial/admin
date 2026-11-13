// One-off fix: add CV-01/CV-02 columns that failed to create via startup DDL.
// Run from tbt-admin/backend/:  node scripts/fix-cv-columns.mjs
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const url = process.env.DIRECT_URL;
if (!url) {
  console.error('❌ DIRECT_URL is not set in .env — cannot bypass PgBouncer.');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

const alters = [
  `CREATE TABLE IF NOT EXISTS member_business_profiles (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
     business_categories JSONB NOT NULL DEFAULT '[]',
     CONSTRAINT uq_mbp_member UNIQUE (member_id)
   )`,
  `ALTER TABLE courses ADD COLUMN IF NOT EXISTS batch_visibility_ids JSONB DEFAULT '[]'`,
  `ALTER TABLE courses ADD COLUMN IF NOT EXISTS applicable_business_types TEXT[]`,
];

for (const sql of alters) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('✅', sql.slice(0, 80));
  } catch (e) {
    console.error('❌', sql.slice(0, 80), '\n  ', e.message);
  }
}

await prisma.$disconnect();
console.log('Done.');

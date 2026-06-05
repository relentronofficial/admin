/**
 * Syncs all existing Clerk users into the admins table.
 * Run once to populate the DB from Clerk:
 *   npx tsx prisma/sync-admins-from-clerk.ts
 *
 * Skips users that already have a DB record (matched by clerkId or email).
 * Defaults new records to role=admin, status=active — edit in the UI afterwards.
 */

import { PrismaClient } from '@prisma/client';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function main() {
  console.log('🔄 Syncing Clerk users → admins table...\n');

  // Fetch all Clerk users (paginate in batches of 100)
  const allUsers: any[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await clerk.users.getUserList({ limit, offset });
    const users = response.data ?? response;
    if (!Array.isArray(users) || users.length === 0) break;
    allUsers.push(...users);
    if (users.length < limit) break;
    offset += limit;
  }

  console.log(`Found ${allUsers.length} user(s) in Clerk.\n`);

  let created = 0;
  let skipped = 0;

  for (const user of allUsers) {
    const primaryEmail = user.emailAddresses?.find(
      (e: any) => e.id === user.primaryEmailAddressId
    )?.emailAddress;

    if (!primaryEmail) {
      console.log(`  ⚠️  Skipping user ${user.id} — no primary email`);
      skipped++;
      continue;
    }

    // Check if already in DB
    const existing = await prisma.admin.findFirst({
      where: { OR: [{ clerkId: user.id }, { email: primaryEmail }] },
    });

    if (existing) {
      // If found by email but missing clerkId, patch it
      if (!existing.clerkId) {
        await prisma.admin.update({
          where: { id: existing.id },
          data: { clerkId: user.id },
        });
        console.log(`  🔧 Patched clerkId for existing record: ${primaryEmail}`);
      } else {
        console.log(`  ✓  Already exists: ${primaryEmail}`);
      }
      skipped++;
      continue;
    }

    // Build full name from Clerk profile
    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.username ||
      primaryEmail.split('@')[0];

    // Generate employee ID
    const sequence = await prisma.adminIdSequence.create({ data: {} });
    const employeeId = `TBT-ADMIN-${new Date().getFullYear()}-${String(sequence.id).padStart(4, '0')}`;

    await prisma.admin.create({
      data: {
        clerkId: user.id,
        employeeId,
        fullName,
        email: primaryEmail,
        username: user.username ?? undefined,
        role: 'super_admin',   // change to 'admin' if you prefer a lower default
        status: 'active',
        country: 'India',
      },
    });

    console.log(`  ✅ Created: ${fullName} <${primaryEmail}> (${employeeId})`);
    created++;
  }

  console.log(`\n📊 Done — ${created} created, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error('❌ Sync failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

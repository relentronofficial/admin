import { PrismaClient } from '@prisma/client';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function main() {
  const username = 'manoj_admin';
  const password = 'Manoj!@#8520';
  const email = 'manojdatascientist08@gmail.com';

  console.log('🌱 Seeding Super Admin...');

  let clerkUserId = '';
  try {
    console.log(`☁️  Checking Clerk for user: ${email}...`);
    const users = await clerk.users.getUserList({ emailAddress: [email] });

    if (users.data.length > 0) {
      console.log('⚠️  User already exists in Clerk. Updating password...');
      clerkUserId = users.data[0].id;
      await clerk.users.updateUser(clerkUserId, {
        password,
        username,
        skipPasswordChecks: true,
      });
      console.log('✅ Clerk user updated.');
    } else {
      console.log('✨ Creating user in Clerk...');
      const newUser = await clerk.users.createUser({
        username,
        password,
        emailAddress: [email],
        firstName: 'Manoj',
        lastName: 'Admin',
        skipPasswordChecks: true,
      });
      clerkUserId = newUser.id;
      console.log('✅ Clerk user created.');
    }

    // Verify the email
    const updatedUser = await clerk.users.getUser(clerkUserId);
    for (const emailObj of updatedUser.emailAddresses) {
      if (emailObj.emailAddress === email && emailObj.verification?.status !== 'verified') {
        await clerk.emailAddresses.updateEmailAddress(emailObj.id, {
          verified: true,
          primary: true,
        });
        console.log('✅ Email verified.');
      }
    }
  } catch (error: any) {
    console.error('❌ Clerk operation failed:', error.message);
    process.exit(1);
  }

  if (!clerkUserId) {
    console.error('❌ Could not resolve Clerk user ID. Aborting.');
    process.exit(1);
  }

  // Upsert the DB record using the correct schema field names
  const existing = await prisma.admin.findFirst({
    where: { OR: [{ username }, { email }] },
  });

  if (existing) {
    // Update clerkId if it's missing (in case seed was run before fix)
    if (!existing.clerkId || existing.clerkId !== clerkUserId) {
      await prisma.admin.update({
        where: { id: existing.id },
        data: { clerkId: clerkUserId },
      });
      console.log('✅ Existing DB record updated with correct clerkId.');
    } else {
      console.log('⚠️  Super Admin already exists in DB — skipped.');
    }
  } else {
    // Generate sequence ID
    const sequence = await prisma.adminIdSequence.create({ data: {} });
    const employeeId = `TBT-ADMIN-${new Date().getFullYear()}-${String(sequence.id).padStart(4, '0')}`;

    await prisma.admin.create({
      data: {
        clerkId: clerkUserId,
        employeeId,
        fullName: 'Manoj Admin',
        email,
        phone: '+919876543210',
        username,
        role: 'super_admin',
        status: 'active',
        department: 'Technology',
        designation: 'Chief Architect',
        country: 'India',
      },
    });
    console.log('✅ Super Admin DB record created.');
  }

  console.log(`
🎉 Super Admin Setup Complete!
------------------------------
Username : ${username}
Password : ${password}
Email    : ${email}
------------------------------
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

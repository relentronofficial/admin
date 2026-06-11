/**
 * One-time script: fix placeholder phone numbers for members created via Clerk auto-provision.
 * Assigns dummy phones to members with phone starting with "clerk:"
 * Special case: manojdatascientist08@gmail.com gets 917806928166
 *
 * Run: npx tsx prisma/fix-member-phones.ts  (from backend/)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const placeholders = await prisma.member.findMany({
    where: { phone: { startsWith: 'clerk:' } as any } as any,
    select: { id: true, email: true, phone: true } as any,
  }) as any[];

  console.log(`Found ${placeholders.length} members with placeholder phones`);

  let dummyCounter = 1;

  for (const member of placeholders) {
    let newPhone: string;

    if (member.email === 'manojdatascientist08@gmail.com') {
      newPhone = '917806928166';
    } else {
      newPhone = `9190000${String(dummyCounter).padStart(5, '0')}`;
      dummyCounter++;
    }

    try {
      await (prisma.member as any).update({
        where: { id: member.id },
        data: { phone: newPhone },
      });
      console.log(`  ${member.email}: ${member.phone} → ${newPhone}`);
    } catch (err: any) {
      console.error(`  FAILED ${member.email}: ${err.message}`);
    }
  }

  console.log('Done');
}

main().finally(() => prisma.$disconnect());

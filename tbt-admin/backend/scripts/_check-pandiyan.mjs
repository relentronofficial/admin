import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const member = await prisma.member.findFirst({
  where: {
    OR: [
      { firstName: { contains: 'Pandiyan', mode: 'insensitive' } },
      { lastName: { contains: 'Pandiyan', mode: 'insensitive' } },
    ],
  },
  select: {
    id: true, firstName: true, lastName: true,
    status: true, createdBy: true, deletedAt: true, membershipPlan: true,
  },
});

console.log('Member:', JSON.stringify(member, null, 2));

if (member) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT verification_status, onboarding_completed FROM members WHERE id = $1::uuid`,
    member.id
  );
  console.log('Extra fields:', JSON.stringify(rows, null, 2));
}

await prisma.$disconnect();

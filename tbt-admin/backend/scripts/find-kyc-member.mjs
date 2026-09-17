import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
const prisma = new PrismaClient();
const members = await prisma.member.findMany({
  where: { status: 'pending' },
  select: { id: true, firstName: true, lastName: true, phone: true, status: true, verificationStatus: true, membershipPlan: true },
  take: 10,
});
console.log(JSON.stringify(members, null, 2));
await prisma.$disconnect();

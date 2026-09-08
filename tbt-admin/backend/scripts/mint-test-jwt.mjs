// Dev helper: pick an active member and print a JWT + refresh cookie pair.
// Run with:  node scripts/mint-test-jwt.mjs
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const prisma = new PrismaClient();

const member = await prisma.member.findFirst({
  where: { status: 'active' },
  select: { id: true, firstName: true, lastName: true, phone: true, email: true, membershipPlan: true },
  orderBy: { createdAt: 'asc' },
});

if (!member) {
  console.error('No active member found in DB');
  process.exit(1);
}

const secret = process.env.JWT_ACCESS_SECRET;
if (!secret) {
  console.error('JWT_ACCESS_SECRET missing from env');
  process.exit(1);
}

const token = jwt.sign({ memberId: member.id }, secret, { expiresIn: '2h' });

console.log(JSON.stringify({ member, token }, null, 2));

await prisma.$disconnect();

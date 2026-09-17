// Sets a known password on the first pending+awaiting_kyc member for onboarding testing
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';
const prisma = new PrismaClient();
const hash = await bcrypt.hash('Test@1234', 10);
const updated = await prisma.member.updateMany({
  where: { phone: '9076419358' },
  data: { passwordHash: hash },
});
console.log('Updated:', updated);
await prisma.$disconnect();

// Temporarily set Nandhini to pending+awaiting_kyc for onboarding flow testing.
// Run restore-test-account.mjs after testing to revert.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';
const prisma = new PrismaClient();

const before = await prisma.member.findFirst({
  where: { phone: '8438056679' },
  select: { id: true, status: true, verificationStatus: true, passwordHash: true },
});
console.log('Before:', JSON.stringify(before, null, 2));

// Save original state to restore later
import { writeFileSync } from 'fs';
writeFileSync('scripts/.test-account-backup.json', JSON.stringify(before, null, 2));

const hash = await bcrypt.hash('Test@1234', 10);
const updated = await prisma.member.update({
  where: { id: before.id },
  data: {
    status: 'pending',
    verificationStatus: 'awaiting_kyc',
    passwordHash: hash,
  },
  select: { id: true, firstName: true, phone: true, status: true, verificationStatus: true },
});
console.log('Updated:', JSON.stringify(updated, null, 2));
await prisma.$disconnect();

// Restores Nandhini's account to its original state after onboarding testing.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import 'dotenv/config';
const prisma = new PrismaClient();

const backup = JSON.parse(readFileSync('scripts/.test-account-backup.json', 'utf8'));
console.log('Restoring to:', JSON.stringify(backup, null, 2));

const updated = await prisma.member.update({
  where: { id: backup.id },
  data: {
    status: backup.status,
    verificationStatus: backup.verificationStatus,
    passwordHash: backup.passwordHash,
  },
  select: { id: true, firstName: true, phone: true, status: true, verificationStatus: true },
});
console.log('Restored:', JSON.stringify(updated, null, 2));
await prisma.$disconnect();

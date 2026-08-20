// One-off: find a member by phone and send them a test batch report.
// Run: npx tsx --env-file=.env scripts/send-test-report.ts <phone> [weekly|monthly]
//
// Example: npx tsx --env-file=.env scripts/send-test-report.ts 7010834661 weekly

import { PrismaClient } from '@prisma/client';
import { deliverMemberReport, generateMemberReport } from '../src/lib/batchReports.js';

const [, , phone, reportType = 'weekly'] = process.argv;

if (!phone) {
  console.error('Usage: npx tsx --env-file=.env scripts/send-test-report.ts <phone> [weekly|monthly]');
  process.exit(1);
}
if (reportType !== 'weekly' && reportType !== 'monthly') {
  console.error('reportType must be "weekly" or "monthly"');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const normalised = phone.replace(/\D/g, '');
  const member = await prisma.member.findFirst({
    where: { phone: { in: [normalised, `+91${normalised}`, `91${normalised}`] } },
    select: { id: true, firstName: true, lastName: true, phone: true, status: true, batchId: true },
  });

  if (!member) {
    console.error(`No member found with phone: ${phone}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Found member: ${member.firstName} ${member.lastName ?? ''} (${member.phone}) — status: ${member.status}, batchId: ${member.batchId}`);

  const preview = await generateMemberReport(prisma, member.id, reportType as 'weekly' | 'monthly');
  if (!preview.eligible) {
    console.error(`Member not eligible: ${preview.reason}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\n─── Message preview ──────────────────────────');
  console.log(preview.message);
  console.log('──────────────────────────────────────────────\n');

  // force=true bypasses the duplicate-period guard so this works as a test any time
  const result = await deliverMemberReport(prisma, member.id, reportType as 'weekly' | 'monthly', { force: true });
  console.log(`Delivery result: ${result.status}${result.reason ? ` — ${result.reason}` : ''}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
